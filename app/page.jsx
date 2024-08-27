'use client'

import { useState, useEffect, useRef } from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import Message from "@/components/Message"
import { Input } from "@/components/ui/input"

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: 'model',
      content: `Hi! I'm the Rate My Professor support assistant. How can I help you today?` 
    }
  ])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const sendMessage = async () => {
    if(!message.trim()) return 
    setMessages((messages) => [
      ...messages,
      {role: 'user', content: message},
      {role: 'model', content: ''}
    ])
    
    setMessage('')
    const response = fetch('api/chat', {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([...messages, {role: 'user', content: message}])
    }).then(async(res) => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      let result = ''
      return reader.read().then(function processText({done, value}){
        if(done) {
          return result
        }
        const text = decoder.decode(value || new Uint8Array(), {stream: true})
        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1]
          let otherMessages = messages.slice(0, messages.length - 1)
          return [
            ...otherMessages,
            {...lastMessage, content: lastMessage.content + text},
          ]
        })

        return reader.read().then(processText)
      })
    })

  }

  const handleKeyPress = (e) => {
    if(e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({behaviour: 'smooth'})
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const commonPrompts = [
    'Show me top 3 professors on computer science', 
    'Show me top 3 professors on communication', 
    'Show me top 3 professors on mathematics',
    'Show me top 3 professors on biology',
  ]

  return (
    <div className="flex flex-col gap-4 h-screen w-screen md:w-[70%] mx-auto">
      <div className="flex-grow overflow-y-auto p-4">
        <p className="text-2xl xl:text-4xl text-black font-bold">Hi there, John<br/>What would you like to know?</p>
        <p className="text-medium font-normal text-gray-400/80 mt-2">Use one of the most common prompts <br/>below or use your own to begin</p>
        { messages.length < 2 &&
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 mt-6">
            {commonPrompts.map((prompt, index) => (
              <Card key={index} onClick={() => setMessage(prompt)}>
                <CardHeader></CardHeader>
                <CardContent>
                  <p className="text-md font-semibold">{prompt}</p>
                </CardContent>
                <CardFooter></CardFooter>
              </Card>
            ))}
          </div>
        }
        { messages.length > 1 &&
          <div className="flex-grow overflow-y-auto p-4">
            {messages.map((message, index) => <Message key={index} message={message.content} isUser={message.role === 'user'} />)}
            <div ref={messagesEndRef} />
          </div>
        }
      </div>
      <div className="mt-3 mb-8 flex flex-row space-x-4 gap-4">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} onKeyPress={handleKeyPress} disabled={isLoading} />
        <Button onClick={sendMessage} disabled={isLoading}>Submit</Button>
      </div>
    </div> 
  )
}
