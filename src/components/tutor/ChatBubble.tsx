'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Brain, Copy, Check, RefreshCw, RotateCcw, Volume2, VolumeX, Loader2, Star, BookMarked } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/appStore'
import { InteractiveQuizCard, parseQuizPayload } from './InteractiveQuizCard'
import type { ChatMessage } from '@/types'

// Reaction options for assistant messages
const REACTIONS = [
  { emoji: '👍', label: 'Helpful' },
  { emoji: '👎', label: 'Not helpful' },
  { emoji: '💡', label: 'Insightful' },
  { emoji: '🤔', label: 'Thought-provoking' },
]

// Browser-native speech synthesis (Web Speech API) — free, no server round trip,
// no external API/config dependency, and pairs with the browser's native
// SpeechRecognition already used for voice input.
export function stopAllTTS() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

interface ChatBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  onRegenerate?: (messageId: string) => void
  onSaveAsNote?: (message: ChatMessage) => void
  scrollToMessage?: (messageId: string) => void
  /** The quiz in this message is being answered in the side panel — show a chip instead */
  quizAside?: boolean
  /** Resend this user message (e.g. after the AI hit a snag) */
  onResend?: (content: string) => void
  /** Put this user message's text back into the composer for editing */
  onRecall?: (content: string) => void
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
    <motion.button
      onClick={handleCopy}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
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
    </motion.button>
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
      className="inline-block w-0.5 h-[1em] bg-primary ml-0.5 align-text-bottom rounded-full"
      animate={{ opacity: [1, 0, 1] }}
      transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
    />
  )
}

// Reaction bar for assistant messages
function ReactionBar({
  reactions,
  onToggle,
}: {
  reactions: Record<string, number>
  onToggle: (emoji: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex items-center gap-1 mt-0.5 ml-1"
    >
      {REACTIONS.map(({ emoji, label }) => {
        const count = reactions[emoji] || 0
        return (
          <motion.button
            key={emoji}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onToggle(emoji)}
            className={`relative flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors ${
              count > 0
                ? 'bg-primary/10 text-foreground border border-primary/20'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
            }`}
            aria-label={label}
            title={label}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-[10px] font-medium min-w-[12px] text-center"
              >
                {count}
              </motion.span>
            )}
          </motion.button>
        )
      })}
    </motion.div>
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
                <div className="relative my-2.5 rounded-lg overflow-hidden border border-zinc-800 card-hover-shadow-lift">
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
  isStarred,
  onToggleStar,
  onSaveAsNote,
}: {
  message: ChatMessage
  onRegenerate: () => void
  onTTS: () => void
  isTTSLoading: boolean
  isTTSPlaying: boolean
  isStarred: boolean
  onToggleStar: () => void
  onSaveAsNote?: () => void
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

        {/* Star / Bookmark */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 rounded-md ${isStarred ? 'text-amber-500 hover:text-amber-600' : 'text-muted-foreground hover:text-foreground'} hover:bg-accent/50`}
              onClick={onToggleStar}
              aria-label={isStarred ? 'Unstar message' : 'Star message'}
            >
              <motion.div
                animate={isStarred ? { scale: [0, 1.2, 1], rotate: [0, -15, 0] } : { scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <Star className={`h-3 w-3 ${isStarred ? 'fill-amber-500' : ''}`} />
              </motion.div>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {isStarred ? 'Unstar' : 'Star message'}
          </TooltipContent>
        </Tooltip>

        {/* Save as Note */}
        {onSaveAsNote && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50"
                onClick={onSaveAsNote}
                aria-label="Save as note"
              >
                <BookMarked className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Save as Note
            </TooltipContent>
          </Tooltip>
        )}
      </motion.div>
    </TooltipProvider>
  )
}

export function ChatBubble({ message, isStreaming = false, onRegenerate, onSaveAsNote, scrollToMessage, quizAside = false, onResend, onRecall }: ChatBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isAssistant = message.role === 'assistant'
  const [isTTSLoading, setIsTTSLoading] = useState(false)
  const [isTTSPlaying, setIsTTSPlaying] = useState(false)
  const playingMessageIdRef = useRef<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [glowVisible, setGlowVisible] = useState(isAssistant && isStreaming)
  const [reactions, setReactions] = useState<Record<string, number>>({})
  const { starredMessages, toggleStarMessage } = useAppStore()
  const isStarred = starredMessages.some((sm) => sm.messageId === message.id)

  // Toggle a reaction on this message
  const handleReaction = useCallback((emoji: string) => {
    setReactions((prev) => {
      const current = prev[emoji] || 0
      if (current > 0) {
        // Remove reaction
        const next = { ...prev }
        delete next[emoji]
        return next
      }
      return { ...prev, [emoji]: current + 1 }
    })
  }, [])

  // Interactive quiz/flashcards: assistant messages can carry a ```quiz JSON
  // block — render it as a selectable card instead of text with answers
  const quizData = isAssistant ? parseQuizPayload(message.content) : null

  // Typewriter effect for assistant messages (skipped for quiz cards)
  const { displayedText, isComplete, complete: completeTypewriter } = useTypewriter(
    message.content,
    isAssistant && isStreaming && !quizData,
    18
  )

  // Fade out glow after 2s
  useEffect(() => {
    if (glowVisible) {
      const timer = setTimeout(() => setGlowVisible(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [glowVisible])

  // Stop speech when component unmounts
  useEffect(() => {
    return () => {
      if (playingMessageIdRef.current === message.id) {
        stopAllTTS()
      }
    }
  }, [message.id])

  const handleTTS = useCallback(() => {
    // If currently playing this message, stop it
    if (isTTSPlaying && playingMessageIdRef.current === message.id) {
      stopAllTTS()
      setIsTTSPlaying(false)
      playingMessageIdRef.current = null
      return
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return
    }

    // Stop any other utterance first
    stopAllTTS()
    playingMessageIdRef.current = null

    // Strip markdown syntax so it isn't read aloud literally
    const plainText = message.content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[`*_#>~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    const utterance = new SpeechSynthesisUtterance(plainText)
    playingMessageIdRef.current = message.id
    setIsTTSPlaying(true)

    utterance.onend = () => {
      setIsTTSPlaying(false)
      playingMessageIdRef.current = null
    }

    utterance.onerror = () => {
      setIsTTSPlaying(false)
      playingMessageIdRef.current = null
    }

    window.speechSynthesis.speak(utterance)
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
  const renderContent = isAssistant && isStreaming && !isComplete && !quizData ? displayedText : message.content
  const showCursor = isAssistant && isStreaming && !isComplete && !quizData

  // A quiz/flashcards fence that hasn't finished streaming (or failed to
  // parse) must never leak raw JSON into the chat — cut it off and show a
  // preparing hint until the block completes and parses into a card
  const partialFenceIdx = isAssistant && !quizData ? renderContent.search(/```(?:quiz|flashcards?)\b/) : -1
  const visibleContent = partialFenceIdx >= 0 ? renderContent.slice(0, partialFenceIdx).trim() : renderContent
  const preparingCards = partialFenceIdx >= 0

  return (
    <motion.div
      data-message-id={message.id}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div className={`flex items-end gap-2 max-w-[85%] sm:max-w-[80%] min-w-0 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.05 }}
            className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mb-4"
          >
            <Brain className="w-4 h-4 text-primary" />
          </motion.div>
        )}
        <div
          className="flex flex-col gap-1 min-w-0"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 26, delay: 0.05 }}
            onClick={showCursor ? completeTypewriter : undefined}
            onDoubleClick={isUser && onRecall ? () => onRecall(message.content) : undefined}
            className={`relative px-4 py-2.5 text-sm leading-relaxed overflow-hidden min-w-0 max-w-full break-words [overflow-wrap:anywhere] ${
              isUser
                ? 'bg-emerald-600 text-white rounded-2xl rounded-br-md chat-bubble-user'
                : 'tutor-ai-bubble glass-card-shine rounded-2xl rounded-bl-md'
            } ${showCursor ? 'cursor-pointer' : ''}`}
          >
            {/* Pulsing emerald gradient left border for user messages */}
            {isUser && (
              <motion.div
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-linear-to-b from-emerald-400 via-teal-300 to-emerald-400"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {/* Starred emerald left border glow for assistant messages */}
            {isAssistant && isStarred && (
              <motion.div
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-linear-to-b from-emerald-400 via-teal-300 to-emerald-400"
                animate={{ opacity: [0.6, 1, 0.6], boxShadow: ['0 0 4px oklch(0.7 0.15 160)', '0 0 10px oklch(0.7 0.15 160)', '0 0 4px oklch(0.7 0.15 160)'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {/* Gradient glow on new assistant messages */}
            {isAssistant && glowVisible && (
              <motion.div
                className="absolute -inset-1 rounded-2xl -z-10 blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2, ease: 'easeOut' }}
                onAnimationComplete={() => setGlowVisible(false)}
                style={{
                  background: 'radial-gradient(ellipse at 30% 40%, rgba(16,185,129,0.3) 0%, rgba(20,184,166,0.2) 40%, rgba(16,185,129,0.1) 70%, transparent 100%)',
                }}
              />
            )}

            {isUser ? (
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
            ) : quizData && quizAside ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px]">?</span>
                {quizData.payload.mode === 'flashcards' ? 'Flashcards' : 'Quiz'} ready — answer it in the Practice panel →
              </span>
            ) : quizData ? (
              <>
                {quizData.before && <MarkdownContent content={quizData.before} />}
                <InteractiveQuizCard payload={quizData.payload} messageId={message.id} />
                {quizData.after && <MarkdownContent content={quizData.after} />}
              </>
            ) : (
              <>
                {visibleContent && <MarkdownContent content={visibleContent} />}
                {preparingCards && (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Preparing your cards…
                  </span>
                )}
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

          {/* User message actions: copy + resend. Hover on desktop, always
              visible on touch screens. Double-click the bubble to put the
              text back into the composer. */}
          {isUser && (onResend || onRecall) && (
            <div className={`flex justify-end gap-1 mr-1 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-100 md:opacity-0'}`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                aria-label="Copy message"
                title="Copy"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(message.content) } catch { /* ignore */ }
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
              {onResend && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                  aria-label="Resend message"
                  title="Resend"
                  onClick={() => onResend(message.content)}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {/* Hover actions + reactions collapse together in ONE container —
              two separately-animated collapses made the bubble jump twice
              when the pointer left the message */}
          {isAssistant && !isStreaming && (
            <div
              className="overflow-hidden transition-all duration-200 ease-out"
              style={{
                opacity: isHovered ? 1 : 0,
                maxHeight: isHovered ? 88 : 0,
                marginTop: isHovered ? 0 : -4,
              }}
            >
              <MessageActions
                message={message}
                onRegenerate={handleRegenerate}
                onTTS={handleTTS}
                isTTSLoading={isTTSLoading}
                isTTSPlaying={isTTSPlaying}
                isStarred={isStarred}
                onToggleStar={() => toggleStarMessage(message.id)}
                onSaveAsNote={onSaveAsNote ? () => onSaveAsNote(message) : undefined}
              />
              <ReactionBar reactions={reactions} onToggle={handleReaction} />
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