import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";

const systemPrompt = `
You are an AI assistant for "Rate My Professor," dedicated to helping students find the best classes and professors based on their queries...
`;

// Initialize Google Generative AI and Pinecone instances
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("rag").namespace("ns1");

export async function POST(req) {
  try {
    const rawData = await req.text();
    const data = JSON.parse(rawData)
    const text = data[data.length - 1].content;

    // Generate embedding for the query text
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embedding = (await model.embedContent(text)).embedding;

    // Query Pinecone for the top 3 matches
    const results = await index.query({
      topK: 3,
      includeMetadata: true,
      vector: embedding.values,
    });

    // Construct result string from the matches
    let resultString = "";
    results.matches.forEach((match) => {
      resultString += `
      Professor: ${match.id}
      Review: ${match.metadata.content}
      Subject: ${match.metadata.subject}
      Stars: ${match.metadata.stars}
      \n\n`;
    });

    const lastMessageContent = text + resultString;
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1);

    // Initialize chat model and start the chat session
    const chatModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const chat = chatModel.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        ...lastDataWithoutLastMessage.map((message) => ({
          role: message.role,
          parts: [{ text: message.content }],
        })),
      ],
    });

    // Send message and process the stream
    const result = await chat.sendMessageStream(
      lastMessageContent
    );

    // Check if the stream is iterable
    if (result && result.stream) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          try {
            for await (const chunk of result.stream) {
              const content = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            }
          } catch (err) {
            console.error("Stream processing error:", err);
            controller.error(err);
          } finally {
            controller.close();
          }
        },
      });

      return new NextResponse(stream);
    } else {
      throw new Error("Result stream is not iterable or is undefined.");
    }
  } catch (err) {
    console.error("Error processing POST request:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
