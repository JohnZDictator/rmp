import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { Pinecone } from "@pinecone-database/pinecone";

const systemPrompt = `
You are an AI assistant for "Rate My Professor," dedicated to helping students find the best classes and professors based on their queries. For every user question, retrieve the top 3 professors that best match the user's criteria. Use the information about these professors to provide a detailed, accurate, and helpful answer to the student's query.

For each recommended professor, include the following details when relevant:

    Professor's Name: Full name.
    Department/Subject: The department or subject they teach.
    Rating: Overall rating (e.g., 4.5 out of 5).
    Key Feedback: Highlight key feedback from students (e.g., teaching style, difficulty level, or engagement).
    Course Information: Include details about the courses they teach that are relevant to the user's query.

If the query requires further clarification or additional details to provide the best recommendations, ask follow-up questions. Aim to deliver concise, informative, and actionable responses that will help the student make informed decisions about their classes and professors.
`

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
})
const index = pc.index('rag').namespace('ns1')

export async function POST(req) {
  const data = await req.text()
  
  // const text = data[data.length - 1].content
  // const model = genAI.getGenerativeModel({model: 'text-embedding-004'})
  // const embedding = (await model.embedContent(text)).embedding

  // const results = await index.query({
  //   topK : 5,
  //   includeMetadata: true,
  //   vector: embedding.values
  // })

  const lastMessage = data[data.length - 1];
  const text = lastMessage?.content;

  console.log(data);
  console.log(data.length)

  if (!text) {
    throw new Error('No content available for embedding.');
  }

  const model = genAI.getGenerativeModel({model: 'text-embedding-004'});
  const embedding = (await model.embedContent({ content: text })).embedding;
  

  const results = await index.query({
    topK: 5,
    includeMetadata: true,
    vector: embedding.values
  });


  let resultString = ''
  results.matches.forEach((match) => {
    resultString += `
    Returned Results:
    Professor: ${match.id}
    Review: ${match.metadata.content}
    Subject: ${match.metadata.subject}
    Stars: ${match.metadata.stars}
    \n\n`
  })

  // const lastMessage = data[data.length - 1]
  const lastMessageContent = lastMessage.content + resultString
  const lastDataWithoutLastMessage = data.slice(0, data.length - 1)

  const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
  const result = await chatModel.generateContentStream({
    history: [
      {
        role: "user", 
        parts:  [{text: systemPrompt}]
      },
      ...lastDataWithoutLastMessage,
      {
        role: "user",
        parts:[{text: lastMessageContent}]
      }
    ],
  })

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of result.stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            const text = encoder.encode(content)
            controller.enqueue(text)
          }
        }
      } catch (err) {
        controller.error(err)
      } finally {
        controller.close()
      }
    },
  })
  return new NextResponse(stream)
}