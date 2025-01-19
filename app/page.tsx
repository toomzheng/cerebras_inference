'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import ChatInterface from "./components/chat-interface"
import { ChatSessions, type ChatSession } from "./components/chat-sessions"

export default function RootPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const isInitialMount = useRef(true)

  // Load sessions from local storage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('chatSessions')
    if (savedSessions) {
      const parsedSessions = JSON.parse(savedSessions)
      setSessions(parsedSessions)
      // Set current session to the most recent one
      if (parsedSessions.length > 0) {
        setCurrentSessionId(parsedSessions[0].id)
      }
    }
    isInitialMount.current = false
  }, [])

  // Save sessions to local storage whenever they change
  useEffect(() => {
    if (!isInitialMount.current && sessions.length > 0) {
      localStorage.setItem('chatSessions', JSON.stringify(sessions))
    }
  }, [sessions])

  const handleNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      messages: []
    }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
  }, [])

  const handleSessionSelect = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
  }, [])

  const handleMessagesUpdate = useCallback((messages: ChatSession['messages']) => {
    if (!currentSessionId) return

    setSessions(prev => {
      const updated = prev.map(session => 
        session.id === currentSessionId
          ? {
              ...session,
              messages,
              // Update title to first user message if it exists
              title: messages.find(m => m.role === 'user')?.content.slice(0, 30) || 'New Chat'
            }
          : session
      )
      return updated
    })
  }, [currentSessionId])

  // Create initial session if none exist
  useEffect(() => {
    if (!isInitialMount.current && sessions.length === 0) {
      handleNewSession()
    }
  }, [sessions.length, handleNewSession])

  const currentSession = sessions.find(s => s.id === currentSessionId)

  return (
    <div className="flex h-screen">
      <ChatSessions
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
      />
      <div className="flex-1">
        {currentSession && (
          <ChatInterface
            key={currentSessionId}
            initialMessages={currentSession.messages}
            onMessagesChange={handleMessagesUpdate}
          />
        )}
      </div>
    </div>
  )
}