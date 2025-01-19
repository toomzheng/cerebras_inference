'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FileButton } from '@/components/ui/file-button'
import { FileText, Send, Check } from 'lucide-react'
import { TooltipWrapper } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Particles } from '@/components/ui/particles'
import { useTheme } from 'next-themes'
import { SparklesText } from '@/components/ui/sparkles-text'
import { motion, AnimatePresence } from 'framer-motion'
import { Progress } from '@/components/ui/progress'
import { API_BASE_URL } from '../config'

// Set this to true to use mock responses (for development without backend)
const USE_MOCK_RESPONSES = false

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type ChatMode = 'chat' | 'pdf'

interface ChatInterfaceProps {
  initialMessages?: Message[]
  onMessagesChange?: (messages: Message[]) => void
}

const mockResponses = {
  chat: async (message: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    return {
      response: `This is a mock response to: "${message}". The backend server is not running, so I'm providing placeholder responses for development.`
    }
  },
  upload: async (file: File) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return {
      success: true,
      message: `Mock processed file: ${file.name}`,
      session_id: 'mock-session-' + Date.now()
    }
  },
  createSession: async () => {
    await new Promise(resolve => setTimeout(resolve, 500))
    return {
      session_id: 'mock-session-' + Math.random().toString(36).substring(7)
    }
  }
}

export default function ChatInterface({
  initialMessages = [],
  onMessagesChange
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [mode, setMode] = useState<ChatMode>('chat')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isNewChat, setIsNewChat] = useState(initialMessages.length === 0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevMessagesRef = useRef<Message[]>(initialMessages)
  const { theme } = useTheme()
  const [particleColor, setParticleColor] = useState('#ffffff')

  useEffect(() => {
    setParticleColor(theme === 'dark' ? '#ffffff' : '#000000')
  }, [theme])

  useEffect(() => {
    if (!isNewChat && !isExpanded) {
      // Add a slight delay before expanding to allow the slide-down animation to complete
      const timer = setTimeout(() => {
        setIsExpanded(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isNewChat, isExpanded]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Update messages when initialMessages changes
  useEffect(() => {
    if (JSON.stringify(initialMessages) !== JSON.stringify(prevMessagesRef.current)) {
      setMessages(initialMessages)
      setIsNewChat(initialMessages.length === 0)
      prevMessagesRef.current = initialMessages
    }
  }, [initialMessages])

  // Notify parent of message changes
  const updateMessages = useCallback((newMessages: Message[]) => {
    setMessages(newMessages)
    if (JSON.stringify(newMessages) !== JSON.stringify(prevMessagesRef.current)) {
      onMessagesChange?.(newMessages)
      prevMessagesRef.current = newMessages
    }
  }, [onMessagesChange])

  useEffect(() => {
    const initializeChat = async () => {
      try {
        const response = USE_MOCK_RESPONSES
          ? await mockResponses.createSession()
          : await fetch(`${API_BASE_URL}/api/create-session`, {
              method: 'POST',
            }).then(res => res.json())

        setSessionId(response.session_id)
      } catch (error) {
        console.warn('Error creating session, continuing without one:', error)
      }
    }

    if (!sessionId) {
      initializeChat()
    }
  }, [sessionId])

  const handleFileUpload = async (file: File) => {
    setError(null)
    setSelectedFile(file)
    setMode('pdf')
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    try {
      if (USE_MOCK_RESPONSES) {
        const response = await mockResponses.upload(file)
        setUploadProgress(100)
        setSessionId(response.session_id)
        updateMessages([
          ...messages,
          {
            role: 'assistant',
            content: response.message
          }
        ])
        return
      }

      const response = await fetch(`${API_BASE_URL}/api/upload-pdf`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Upload failed')
      }

      setUploadProgress(100)
      setSessionId(data.session_id)
      updateMessages([
        ...messages,
        {
          role: 'assistant',
          content: `I've processed ${file.name}. What would you like to know about it?`
        }
      ])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to upload file')
      setMode('chat')
    } finally {
      setSelectedFile(null)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    setIsNewChat(false)
    const userMessage = { role: 'user' as const, content: input.trim() }
    updateMessages([...messages, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      if (USE_MOCK_RESPONSES) {
        const data = await mockResponses.chat(input)
        updateMessages([
          ...messages,
          userMessage,
          { role: 'assistant' as const, content: data.response }
        ])
        return
      }

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
        const error = await response.json()
        throw new Error(error.detail || 'Chat request failed')
      }

      const data = await response.json()
      updateMessages([
        ...messages,
        userMessage,
        { role: 'assistant' as const, content: data.response }
      ])
    } catch (error) {
      console.error('Error sending message:', error)
      updateMessages([
        ...messages,
        userMessage,
        {
          role: 'assistant' as const,
          content: 'Sorry, there was an error processing your request.',
        }
      ])
      setError('Failed to get response. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const TypingIndicator = () => (
    <div className="flex justify-start animate-fade">
      <div className="bg-gray-100/80 rounded-lg p-4 flex space-x-2">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );

  return (
    <div className="flex h-full relative">
      <Particles
        className="absolute inset-0 -z-10"
        quantity={100}
        ease={80}
        color={particleColor}
        size={0.4}
        staticity={50}
      />
      <div className={`flex-1 flex flex-col p-4 ${isNewChat ? 'animate-fade' : ''}`}>
        <div className="text-sm text-gray-600 mb-4 flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Llama 3.3 70B</span>
          </div>
        </div>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <Progress value={uploadProgress} className="mb-4" />
        )}

        <div className={`flex-1 overflow-y-auto mb-4 flex justify-center ${isNewChat ? 'hidden' : ''}`}>
          <div className={`w-full space-y-4 ${isExpanded ? 'max-w-5xl' : 'max-w-2xl'} transition-all duration-500`}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`p-4 rounded-lg backdrop-blur-sm max-w-[80%] ${message.role === 'user'
                      ? 'bg-orange-200/90 animate-fade'
                      : 'bg-gray-100/80 animate-fade'
                    }`}
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className={`transition-all duration-500 ease-in-out ${isNewChat ? 'flex-1 flex items-center justify-center' : 'flex justify-center animate-slide-down'
          }`}>
          <div className={`flex flex-col gap-2 w-full ${isExpanded ? 'max-w-5xl' : 'max-w-2xl'
            } transition-all duration-500`}>
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-gray-600 px-4">
                <FileText className="h-4 w-4" />
                <span className="truncate">{selectedFile.name}</span>
                <Check className="h-4 w-4 text-green-500 animate-fade" />
              </div>
            )}
            <div className="flex flex-col p-4">
              <AnimatePresence>
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -100 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <SparklesText 
                      text="Cerebras Inference" 
                      className="text-3xl text-center mb-6"
                      sparklesCount={7}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              {isNewChat && (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-slide-down">
                  <h1 className="text-4xl font-bold mb-4">
                    <SparklesText>Cerebras Fast Inference</SparklesText>
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                    Chat with Cerebras AI models for fast and efficient inference
                  </p>
                  {mode === 'chat' ? (
                    <></>
                  ) : (
                    <></>
                  )}
                </div>
              )}
              <div className={`flex items-end gap-2 ${isNewChat ? 'border rounded-lg shadow-lg p-4' : 'border-t p-4'} border-gray-200`}>
                <div className="flex items-end w-full gap-2">
                  <FileButton
                    onChange={handleFileUpload}
                    accept=".pdf"
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                  >
                    <TooltipWrapper content="Upload PDF">
                      <FileText className="h-5 w-5" />
                    </TooltipWrapper>
                  </FileButton>

                  <div className="flex-1 relative">
                    <Textarea
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message to Cerebras..."
                      className="resize-none overflow-hidden min-h-[40px] max-h-[200px] pr-24 w-full"
                      disabled={isLoading}
                      rows={1}
                    />
                    <Button
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black text-white hover:bg-gray-800 px-4 py-2 rounded-md"
                      disabled={!input.trim() || isLoading}
                      onClick={handleSubmit}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              {error && (
                <div className="text-sm text-red-500 mt-2">{error}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
