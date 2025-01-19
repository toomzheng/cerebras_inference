'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, Clock, X, ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'

export type ChatSession = {
  id: string
  title: string
  createdAt: string
  messages: {
    role: 'user' | 'assistant'
    content: string
  }[]
}

interface ChatSessionsProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onNewSession: () => void
  onDeleteSession?: (sessionId: string) => void
}

export function ChatSessions({
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
}: ChatSessionsProps) {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? '48px' : '256px' }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative border-r border-gray-200 bg-gray-50 flex flex-col h-full"
    >
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <Button
            onClick={onNewSession}
            className="w-full justify-start transition-colors duration-200 hover:bg-gray-200/80"
            variant="outline"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>
      )}
      <div className={`flex-1 overflow-y-auto p-2 space-y-2 ${isCollapsed ? 'hidden' : ''}`}>
        {sessions.map((session) => (
          <div
            key={session.id}
            className="relative group"
            onMouseEnter={() => setHoveredSession(session.id)}
            onMouseLeave={() => setHoveredSession(null)}
          >
            <Button
              onClick={() => onSessionSelect(session.id)}
              variant={currentSessionId === session.id ? "secondary" : "ghost"}
              className={`w-full justify-start text-left transition-colors duration-200 ${
                currentSessionId === session.id 
                  ? 'bg-gray-200/80 hover:bg-gray-200/90' 
                  : 'hover:bg-gray-200/50 active:bg-gray-300/50'
              }`}
            >
              <div className="flex items-start space-x-2 overflow-hidden">
                <MessageSquare className="h-4 w-4 mt-1 flex-shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium">
                    {session.title || 'New Chat'}
                  </p>
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="mr-1 h-3 w-3" />
                    {format(new Date(session.createdAt), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
            </Button>
            {hoveredSession === session.id && onDeleteSession && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteSession(session.id)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                aria-label="Delete chat"
              >
                <X className="h-4 w-4 text-gray-500 hover:text-red-600 transition-colors" />
              </button>
            )}
          </div>
        ))}
      </div>
      <Button
        onClick={() => setIsCollapsed(!isCollapsed)}
        variant="ghost"
        size="sm"
        className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-100"
      >
        <motion.div
          initial={false}
          animate={{ rotate: isCollapsed ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronLeft className="h-4 w-4" />
        </motion.div>
      </Button>
    </motion.div>
  )
}
