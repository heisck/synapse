'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Brain, Copy, Check, RefreshCw, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  isStreaming?: boolean
  onRegenerate?: (messageId: string) => void
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
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <Check className="w-3 h-3 text-emerald-400" />
          </motion.div>
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

// Typewriter hook: reveals text word by word
function useTypewriter(text: string, enabled: boolean, speed = 18) {
  const [displayedText, setDisplayedText] = useState(enabled ? '' : text)
  const [isComplete, setIsComplete] = useState(!enabled)
  const indexRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    // Streaming mode: word-by-word reveal
    indexRef.current = 0

    const words = text.split(/(\s+)/) // preserve whitespace
    let currentIndex = 0

    // Reset state asynchronously to satisfy lint rule
    const rafId = requestAnimationFrame(() => {
      setDisplayedText('')
      setIsComplete(false)
    })

    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        const batch = Math.min(2, words.length - currentIndex)
        const chunk = words.slice(currentIndex, currentIndex + batch).join('')
        setDisplayedText((prev) => prev + chunk)
        currentIndex += batch
        indexRef.current = currentIndex
      } else {
        setIsComplete(true)
        clearInterval(interval)
      }
    }, speed)

    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(interval)
    }
  }, [text, enabled, speed])

  // Allow immediate completion
  const complete = useCallback(() => {
    setDisplayedText(text)
    setIsComplete(true)
    indexRef.current = text.length
  }, [text])

  return { displayedText, isComplete, complete }
}

// Blinking cursor component
function BlinkingCursor({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <motion.span
      className="inline-block w-[2px] h-[1em] bg-primary ml-0.5 align-text-bottom rounded-full"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
    />
  )
}

// Markdown renderer (shared logic)
function MarkdownContent({ content }: { content: string }) {
  return (
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
        {content}
      </ReactMarkdown>
    </div>
  )
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Hover action buttons for assistant messages
function MessageActions({
  message,
  onRegenerate,
  onTTS,
  isTTSLoading,
  isTTSPlaying,
}: {
  message: ChatMessage
  onRegenerate: () => void
  onTTS: () => void
  isTTSLoading: boolean
  isTTSPlaying: boolean
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = message.content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [message.content])

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="flex items-center gap-0.5 mt-1 ml-1"
      >
        {/* Copy */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
              onClick={handleCopy}
              aria-label="Copy message"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <Check className="h-3 w-3 text-emerald-500" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <Copy className="h-3 w-3" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {copied ? 'Copied!' : 'Copy'}
          </TooltipContent>
        </Tooltip>

        {/* Regenerate */}
        {onRegenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
                onClick={onRegenerate}
                aria-label="Regenerate response"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Regenerate
            </TooltipContent>
          </Tooltip>
        )}

        {/* Speak / TTS */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
              onClick={onTTS}
              disabled={isTTSLoading}
              aria-label={isTTSPlaying ? 'Stop speech' : 'Read aloud'}
            >
              {isTTSLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isTTSPlaying ? (
                <VolumeX className="h-3 w-3 text-emerald-500" />
              ) : (
                <Volume2 className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isTTSPlaying ? 'Stop' : 'Read aloud'}
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </TooltipProvider>
  )
}

export function ChatBubble({ message, isStreaming = false, onRegenerate }: ChatBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isAssistant = message.role === 'assistant'
  const [isTTSLoading, setIsTTSLoading] = useState(false)
  const [isTTSPlaying, setIsTTSPlaying] = useState(false)
  const playingMessageIdRef = useRef<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [glowVisible, setGlowVisible] = useState(isAssistant && isStreaming)

  // Typewriter effect for assistant messages
  const { displayedText, isComplete, complete: completeTypewriter } = useTypewriter(
    message.content,
    isAssistant && isStreaming,
    18
  )

  // Fade out glow after 2s
  useEffect(() => {
    if (glowVisible) {
      const timer = setTimeout(() => setGlowVisible(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [glowVisible])

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

  const handleRegenerate = useCallback(() => {
    if (onRegenerate) {
      onRegenerate(message.id)
    }
  }, [message.id, onRegenerate])

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex justify-center my-2"
      >
        <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </motion.div>
    )
  }

  // Determine which text to render
  const renderContent = isAssistant && isStreaming && !isComplete ? displayedText : message.content
  const showCursor = isAssistant && isStreaming && !isComplete

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div className={`flex items-end gap-2 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.05 }}
            className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mb-4"
          >
            <Brain className="w-4 h-4 text-primary" />
          </motion.div>
        )}
        <div className="flex flex-col gap-1">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut', delay: 0.05 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={showCursor ? completeTypewriter : undefined}
            className={`relative px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md chat-bubble-user'
                : 'bg-card/80 backdrop-blur-sm border rounded-2xl rounded-bl-md chat-bubble-assistant'
            } ${showCursor ? 'cursor-pointer' : ''}`}
          >
            {/* Emerald pulse glow on new assistant messages */}
            {isAssistant && glowVisible && (
              <motion.div
                className="absolute -inset-0.5 rounded-2xl bg-emerald-400/20 dark:bg-emerald-500/10 blur-sm -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.8, 0] }}
                transition={{ duration: 2, ease: 'easeOut' }}
                onAnimationComplete={() => setGlowVisible(false)}
              />
            )}

            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <>
                <MarkdownContent content={renderContent} />
                <BlinkingCursor visible={showCursor} />
              </>
            )}
          </motion.div>

          {/* Timestamp */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className={`flex flex-col ${isUser ? 'items-end mr-2' : 'items-start ml-1'} mb-1`}
          >
            <span className="text-[10px] text-muted-foreground">
              {formatTime(message.createdAt)}
            </span>
          </motion.div>

          {/* Hover action buttons for assistant messages */}
          {isAssistant && !isStreaming && (
            <div
              className="overflow-hidden transition-all duration-200 ease-out"
              style={{
                opacity: isHovered ? 1 : 0,
                maxHeight: isHovered ? 40 : 0,
                marginTop: isHovered ? 0 : -4,
              }}
            >
              <MessageActions
                message={message}
                onRegenerate={handleRegenerate}
                onTTS={handleTTS}
                isTTSLoading={isTTSLoading}
                isTTSPlaying={isTTSPlaying}
              />
            </div>
          )}

          {/* TTS button during streaming */}
          {isAssistant && isStreaming && !isComplete && (
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
    </motion.div>
  )
}