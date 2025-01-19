'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { FileButton } from '@/components/ui/file-button'
import { FileText, Send, RotateCcw } from 'lucide-react'
import { TooltipWrapper } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const API_BASE_URL = 'http://127.0.0.1:8000'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type ChatMode = 'chat' | 'pdf'

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [mode, setMode] = useState<ChatMode>('chat')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const createSession = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/create-session`, {
        method: 'POST',
      })
      const data = await response.json()
      if (data.session_id) {
        setSessionId(data.session_id)
      }
    } catch (error) {
      console.error('Error creating session:', error)
    }
  }

  useEffect(() => {
    // Create a session when component mounts
    createSession()
  }, [])

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file)
    setMode('pdf')
    setUploadProgress(0)
    setIsLoading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload-pdf`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      setSessionId(data.session_id)
      setUploadProgress(100)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `PDF "${file.name}" uploaded successfully! You can now ask questions about its contents.`
      }])
    } catch (error) {
      console.error('Error uploading file:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error uploading the PDF. Please try again.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = { role: 'user' as const, content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input,
          session_id: sessionId,
          mode: mode,
        }),
      })

      if (!response.ok) {
        throw new Error('Chat request failed')
      }

      const data = await response.json()
      setMessages((prev) => [
        ...prev,
        { role: 'assistant' as const, content: data.response },
      ])
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant' as const,
          content: 'Sorry, there was an error processing your request.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewChat = () => {
    setMessages([])
    setSelectedFile(null)
    setMode('chat')
    createSession()
  }

  return (
    <div className="flex h-screen max-w-4xl mx-auto">
      {/* Side Panel */}
      <div className="w-12 bg-gray-100 p-2 flex flex-col items-center gap-2">
        <TooltipWrapper content="Upload PDF">
          <FileButton
            accept=".pdf"
            onFileSelect={handleFileUpload}
            disabled={isLoading}
            variant="ghost"
            size="icon"
          >
            <FileText className="h-5 w-5" />
          </FileButton>
        </TooltipWrapper>
        <TooltipWrapper content="New Chat">
          <Button
            onClick={handleNewChat}
            variant="ghost"
            size="icon"
            disabled={isLoading}
          >
            <RotateCcw className="h-5 w-5" />
          </Button>
        </TooltipWrapper>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-4">
        {selectedFile && (
          <div className="text-sm text-gray-600 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {selectedFile.name}
          </div>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <Progress value={uploadProgress} className="mb-4" />
        )}

        <div className="flex-1 overflow-auto mb-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-100 ml-12'
                  : 'bg-gray-100 mr-12'
              }`}
            >
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'pdf'
                ? 'Ask a question about the PDF...'
                : 'Type a message...'
            }
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
