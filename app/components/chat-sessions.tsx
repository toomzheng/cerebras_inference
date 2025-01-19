'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MessageSquare, Clock } from 'lucide-react'
import { format } from 'date-fns'

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
}

export function ChatSessions({
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
}: ChatSessionsProps) {
  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col h-full">
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
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sessions.map((session) => (
          <Button
            key={session.id}
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
        ))}
      </div>
    </div>
  )
}
