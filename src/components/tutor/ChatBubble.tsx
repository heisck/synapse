'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brain, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/types'

// Module-level audio instance for cross-component control
let activeAudio: HTMLAudioElement | null = null

export function stopAllTTS() {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.currentTime = 0
    URL.revokeObjectURL(activeAudio.src)
    activeAudio = null
  }
}

interface ChatBubbleProps {
  message: ChatMessage
}

function parseMarkdown(text: string): string {
  let html = text
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="bg-muted rounded-md p-3 my-2 overflow-x-auto text-sm"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-3 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-3 mb-1">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[*-] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
  return html
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const parsedContent = parseMarkdown(message.content)
  const [isTTSLoading, setIsTTSLoading] = useState(false)
  const [isTTSPlaying, setIsTTSPlaying] = useState(false)
  const playingMessageIdRef = useRef<string | null>(null)

  // Stop audio when component unmounts
  useEffect(() => {
    return () => {
      if (playingMessageIdRef.current === message.id && activeAudio) {
        activeAudio.pause()
        activeAudio.currentTime = 0
        URL.revokeObjectURL(activeAudio.src)
        activeAudio = null
      }
    }
  }, [message.id])

  const handleTTS = useCallback(async () => {
    // If currently playing this message, stop it
    if (isTTSPlaying && playingMessageIdRef.current === message.id) {
      stopAllTTS()
      setIsTTSPlaying(false)
      playingMessageIdRef.current = null
      return
    }

    // Stop any other playing audio first
    stopAllTTS()
    playingMessageIdRef.current = null

    setIsTTSLoading(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message.content }),
      })

      if (!res.ok) throw new Error('TTS generation failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      activeAudio = audio
      playingMessageIdRef.current = message.id
      setIsTTSLoading(false)
      setIsTTSPlaying(true)

      audio.onended = () => {
        setIsTTSPlaying(false)
        playingMessageIdRef.current = null
        URL.revokeObjectURL(url)
        activeAudio = null
      }

      audio.onerror = () => {
        setIsTTSPlaying(false)
        playingMessageIdRef.current = null
        URL.revokeObjectURL(url)
        activeAudio = null
      }

      await audio.play()
    } catch {
      setIsTTSLoading(false)
      setIsTTSPlaying(false)
      playingMessageIdRef.current = null
    }
  }, [message.content, message.id, isTTSPlaying])

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-2"
      >
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div className={`flex items-end gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Brain className="w-4 h-4 text-primary" />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div
            className={`px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md chat-bubble-user'
                : 'bg-card/80 backdrop-blur-sm border rounded-2xl rounded-bl-md chat-bubble-assistant'
            }`}
            dangerouslySetInnerHTML={{ __html: parsedContent }}
          />
          {/* TTS Button - only for assistant messages */}
          {!isUser && !isSystem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="ml-1"
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
                onClick={handleTTS}
                disabled={isTTSLoading}
                aria-label={isTTSPlaying ? 'Stop speech' : 'Read aloud'}
              >
                {isTTSLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isTTSPlaying ? (
                  <VolumeX className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
              </Button>
            </motion.div>
          )}
        </div>
      </div>
      <div className={`flex flex-col ${isUser ? 'items-end mr-2' : 'items-start ml-2'} mb-1`}>
        <span className="text-[10px] text-muted-foreground">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </motion.div>
  )
}