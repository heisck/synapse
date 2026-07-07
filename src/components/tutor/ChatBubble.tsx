'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Brain, Volume2, VolumeX, Loader2, Copy, Check } from 'lucide-react'
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

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = code
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [code])

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-md border border-zinc-700/50 transition-colors"
      aria-label="Copy code"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          Copy
        </>
      )}
    </button>
  )
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
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
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md chat-bubble-user'
                : 'bg-card/80 backdrop-blur-sm border rounded-2xl rounded-bl-md chat-bubble-assistant'
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="markdown-body">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-lg font-bold mt-4 mb-2 text-foreground first:mt-0">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-base font-semibold mt-3 mb-1.5 text-foreground first:mt-0">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm font-semibold mt-2.5 mb-1 text-foreground first:mt-0">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-foreground/80">{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc ml-5 mb-2 space-y-0.5">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal ml-5 mb-2 space-y-0.5">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed">{children}</li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-3 border-l-emerald-500 pl-3 my-2 italic text-muted-foreground bg-emerald-500/5 py-1.5 rounded-r-md">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
                      >
                        {children}
                      </a>
                    ),
                    code: ({ className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '')
                      const codeString = String(children).replace(/\n$/, '')
                      if (match) {
                        return (
                          <div className="relative my-2.5 rounded-lg overflow-hidden border border-zinc-800">
                            <CopyCodeButton code={codeString} />
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{
                                margin: 0,
                                padding: '16px',
                                paddingRight: '64px',
                                borderRadius: 0,
                                fontSize: '13px',
                                lineHeight: '1.5',
                              }}
                              {...props}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                          </div>
                        )
                      }
                      return (
                        <code
                          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[13px] font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    },
                    pre: ({ children }) => (
                      <pre className="my-0 p-0 bg-transparent overflow-x-auto">{children}</pre>
                    ),
                    table: ({ children }) => (
                      <div className="my-2 overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-muted/50">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-3 py-2 text-left font-semibold text-foreground border-b">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="px-3 py-2 border-b last:border-b-0">{children}</td>
                    ),
                    hr: () => (
                      <hr className="my-3 border-border" />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </motion.div>
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