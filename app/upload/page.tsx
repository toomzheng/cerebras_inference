'use client';

import ChatInterface from "@/app/components/chat-interface";
import { SparklesText } from '@/components/ui/sparkles-text'

export default function UploadPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <SparklesText text="Upload Files" className="mb-8 text-4xl" />
      <div className="w-full max-w-2xl">
        <ChatInterface />
      </div>
    </div>
  )
}
