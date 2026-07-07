'use client'

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { StudySoundscapes } from '@/components/app/StudySoundscapes'
import { ConversationInsights } from './ConversationInsights'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PanelRightOpen,
  PanelRightClose,
  Send,
  Lightbulb,
  MessageSquareText,
  ListChecks,
  MoreHorizontal,
  BookOpen,
  MessageCircle,
  Columns,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Timer,
  Coffee,
  Brain,
  Mic,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  LogOut,
  Trophy,
  Sparkles,
  BookMarked,
  Target,
  Clock,
  CheckCircle2,
  Download,
  Star,
  StickyNote,
  Tag,
  Layers,
  ClipboardCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'

// ---------- SpeechRecognition Types ----------
type SpeechRecognitionResultType = {
  isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternativeType
  [index: number]: SpeechRecognitionAlternativeType
}
type SpeechRecognitionAlternativeType = {
  readonly transcript: string
  readonly confidence: number
}
type SpeechRecognitionEventType = {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListType
}
type SpeechRecognitionResultListType = {
  readonly length: number
  item(index: number): SpeechRecognitionResultType
  [index: number]: SpeechRecognitionResultType
}
type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventType) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null
  return (
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  ) as (new () => SpeechRecognitionInstance) | null
}

import { ChatBubble, stopAllTTS } from './ChatBubble'
import { InteractiveQuizCard, parseQuizPayload } from './InteractiveQuizCard'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { TypingIndicator } from './TypingIndicator'
import { MasteryTracker } from './MasteryTracker'
import { SessionControls } from './SessionControls'
import { TipInput } from './TipInput'
import { FeedbackBar } from './FeedbackBar'
import { CourseContextPanel } from './CourseContextPanel'
import { PersonaSelector } from './PersonaSelector'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ChatMessage } from '@/types'

// ---------- Pomodoro Timer ----------
const POMODORO_MODES = [
  { id: 'focus' as const, label: 'Focus', duration: 25 * 60, icon: Brain, color: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'shortBreak' as const, label: 'Short Break', duration: 5 * 60, icon: Coffee, color: 'text-teal-600 dark:text-teal-400' },
  { id: 'longBreak' as const, label: 'Long Break', duration: 15 * 60, icon: Timer, color: 'text-cyan-600 dark:text-cyan-400' },
]

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 660
    osc.type = 'sine'
    gain.gain.value = 0.3
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.stop(ctx.currentTime + 0.5)
    // Second beep
    setTimeout(() => {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.value = 880
      osc2.type = 'sine'
      gain2.gain.value = 0.3
      osc2.start()
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc2.stop(ctx.currentTime + 0.5)
    }, 200)
  } catch {
    // Audio not available
  }
}

const QUICK_ACTIONS = [
  { label: 'Give hint', icon: Lightbulb, prompt: 'Give me a hint about what we were just discussing.' },
  { label: 'Explain differently', icon: MessageSquareText, prompt: 'Can you explain that differently?' },
  { label: 'Show example', icon: ListChecks, prompt: 'Can you show me an example?' },
  { label: 'Quiz me', icon: ListChecks, prompt: 'Quiz me on what we just covered.' },
]

const SUGGESTED_PROMPTS = [
  'Explain this concept',
  'Give me a quiz',
  'Show examples',
  'Summarize key points',
]

const CONTEXTUAL_SUGGESTIONS = [
  'Explain in simpler terms',
  'Give me an example',
  'Quiz me on this',
  'Go deeper',
]

const MAX_INPUT_CHARS = 500

const AVAILABLE_NOTE_TAGS = ['biology', 'cs', 'math', 'chemistry', 'physics', 'history', 'general', 'review', 'exam-prep', 'research']

type InputSize = 'small' | 'medium' | 'large'

const INPUT_SIZES: Record<InputSize, { minH: number; maxH: number; rows: number; label: string }> = {
  small: { minH: 40, maxH: 80, rows: 1, label: 'Small' },
  medium: { minH: 40, maxH: 150, rows: 1, label: 'Medium' },
  large: { minH: 80, maxH: 300, rows: 3, label: 'Large' },
}

const INPUT_SIZE_CYCLE: InputSize[] = ['small', 'medium', 'large']

const TUTOR_MODES = [
  { id: 'text' as const, label: 'Chat', icon: MessageCircle, desc: 'Text-only conversation' },
  { id: 'slide' as const, label: 'Slides', icon: BookOpen, desc: 'Slide-focused learning' },
  { id: 'hybrid' as const, label: 'Hybrid', icon: Columns, desc: 'Chat + slides together' },
  { id: 'cards' as const, label: 'Cards', icon: Layers, desc: 'Flashcards first — text the AI below' },
]

/** Slim collapsible section for the right panel — keeps it compact */
function PanelSection({
  title,
  icon: Icon,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string
  icon?: typeof Star
  defaultOpen?: boolean
  badge?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {title}
          {typeof badge === 'number' && badge > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{badge}</Badge>
          )}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getPhaseColor(phase: string): string {
  switch (phase) {
    case 'discovery': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'starter': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    case 'teaching': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'review': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

export function TutorView() {
  const {
    messages,
    addMessage,
    sessionPhase,
    activeSessionId,
    activeTopic,
    setActiveTopic,
    setActiveSession,
    setSessionPhase,
    learnerProfile,
    masteryMap,
    userName,
    setLoading,
    isLoading,
    activePersona,
    moodSettings,
    tutorMode,
    setTutorMode,
    activeSlides,
    setActiveSlides,
    setActiveCourse,
    currentSlideIndex,
    setCurrentSlideIndex,
    activeSlideContent,
    navigate,
    starredMessages,
    unstarMessage,
    clearAllStarredMessages,
    addNote,
    courses,
    activeCourse,
    addStudySession,
    tips,
    feedbackItems,
    settings,
    hardSubjects,
    alwaysConfuses,
    bestTeachingStyle,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [inputSize, setInputSize] = useState<InputSize>('medium')
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle')
  const speechRef = useRef<SpeechRecognitionInstance | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const timerStarted = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Pomodoro state
  const [pomodoroExpanded, setPomodoroExpanded] = useState(false)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroModeIndex, setPomodoroModeIndex] = useState(0)
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(POMODORO_MODES[0].duration)
  const [pomodoroSessions, setPomodoroSessions] = useState(0)
  const pomodoroRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Save as Note dialog state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteDialogContent, setNoteDialogContent] = useState('')
  const [noteDialogTitle, setNoteDialogTitle] = useState('')
  const [noteDialogTags, setNoteDialogTags] = useState<string[]>([])

  // Starred messages filter state
  const [showStarredOnly, setShowStarredOnly] = useState(false)

  const currentPomodoroMode = POMODORO_MODES[pomodoroModeIndex]
  const pomodoroProgress = 1 - pomodoroTimeLeft / currentPomodoroMode.duration
  const pomodoroCircumference = 2 * Math.PI * 16
  const pomodoroStrokeOffset = pomodoroCircumference * (1 - pomodoroProgress)

  const handlePomodoroToggle = useCallback(() => {
    setPomodoroRunning((prev) => !prev)
  }, [])

  const handlePomodoroReset = useCallback(() => {
    setPomodoroRunning(false)
    setPomodoroTimeLeft(currentPomodoroMode.duration)
  }, [currentPomodoroMode.duration])

  const handleExportChat = useCallback(() => {
    if (messages.length === 0) {
      toast.error('No messages to export')
      return
    }
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    let md = `# SynapseLearn Chat Session\nDate: ${dateStr}\n\n`
    for (const msg of messages) {
      const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ''
      const role = msg.role === 'user' ? 'User' : 'Assistant'
      md += `## ${role}${time ? ` - ${time}` : ''}\n${msg.content}\n\n---\n\n`
    }
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `synapse-chat-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Chat exported successfully')
  }, [messages])

  const handlePomodoroSkip = useCallback(() => {
    setPomodoroRunning(false)
    const nextIndex = (pomodoroModeIndex + 1) % POMODORO_MODES.length
    // Auto-transition: Focus -> Short Break, every 4th Focus -> Long Break
    if (pomodoroModeIndex === 0) {
      // Was in focus mode
      const newSessionCount = pomodoroSessions + 1
      setPomodoroSessions(newSessionCount)
      if (newSessionCount % 4 === 0) {
        // Every 4th: go to long break
        setPomodoroModeIndex(2)
        setPomodoroTimeLeft(POMODORO_MODES[2].duration)
        return
      }
    }
    setPomodoroModeIndex(nextIndex)
    setPomodoroTimeLeft(POMODORO_MODES[nextIndex].duration)
  }, [pomodoroModeIndex, pomodoroSessions])

  // Pomodoro tick
  useEffect(() => {
    if (pomodoroRunning) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTimeLeft((prev) => {
          if (prev <= 1) {
            playBeep()
            toast.success(`${currentPomodoroMode.label} session complete!`)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (pomodoroRef.current) {
      clearInterval(pomodoroRef.current)
      pomodoroRef.current = null
    }
    return () => {
      if (pomodoroRef.current) clearInterval(pomodoroRef.current)
    }
  }, [pomodoroRunning, currentPomodoroMode.label])

  // Auto-stop pomodoro when time reaches 0
  useEffect(() => {
    if (pomodoroTimeLeft === 0 && pomodoroRunning) {
      setPomodoroRunning(false)
    }
  }, [pomodoroTimeLeft, pomodoroRunning])

  // ---------- Session Summary & Search State ----------
  const [showEndSession, setShowEndSession] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [confettiParticles] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * -60 - 10,
      rotation: Math.random() * 360,
      scale: Math.random() * 0.6 + 0.4,
      color: ['#10b981', '#14b8a6', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6'][Math.floor(Math.random() * 6)],
      delay: Math.random() * 0.5,
      drift: (Math.random() - 0.5) * 60,
    }))
  )

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  // Close search on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  // ---------- Computed Session Stats ----------
  const sessionStats = useMemo(() => {
    const userMsgs = messages.filter((m) => m.role === 'user')
    const assistantMsgs = messages.filter((m) => m.role === 'assistant')
    const messagesExchanged = userMsgs.length + assistantMsgs.length
    const conceptsExplored = Object.keys(masteryMap).length
    const masteryValues = Object.values(masteryMap)
    const avgMastery = masteryValues.length > 0
      ? Math.round(masteryValues.reduce((sum, c) => sum + c.level, 0) / masteryValues.length)
      : 0
    const topicsCovered = new Set<string>()
    if (activeTopic) topicsCovered.add(activeTopic)
    Object.keys(masteryMap).forEach((k) => topicsCovered.add(k))
    const keyTakeaways = assistantMsgs
      .filter((m) => m.content.length > 20)
      .slice(-3)
      .map((m) => m.content.length > 100 ? m.content.slice(0, 100) + '…' : m.content)
    return {
      duration: timerSeconds,
      messagesExchanged,
      topicsCovered: Array.from(topicsCovered),
      conceptsExplored,
      avgMastery,
      keyTakeaways,
      showConfetti: timerSeconds > 600, // > 10 minutes
    }
  }, [messages, masteryMap, activeTopic, timerSeconds])

  // ---------- Chat Search ----------
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return { filtered: messages, matchCount: 0 }
    const q = searchQuery.toLowerCase()
    const matched = messages.filter((m) => m.content.toLowerCase().includes(q))
    return { filtered: matched, matchCount: matched.length }
  }, [messages, searchQuery])

  // Highlight text with emerald background
  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return text
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-emerald-300/60 dark:bg-emerald-500/40 text-inherit rounded-sm px-0.5">{part}</mark>
        : part
    )
  }, [])

  const showSlidePanel = (tutorMode === 'slide' || tutorMode === 'hybrid') && activeSlides.length > 0

  // Quick topic suggestions derived from the user's real courses
  // Dedupe: users can have multiple courses with the same title
  const quickTopics = useMemo(() => [...new Set(courses.map((c) => c.title))].slice(0, 5), [courses])

  // Most recent quiz/flashcard deck the AI produced — powers the Practice
  // panel and the cards-first tutor mode
  const latestQuiz = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'assistant') {
        const q = parseQuizPayload(m.content)
        if (q) return { payload: q.payload, messageId: m.id }
      }
    }
    return null
  }, [messages])

  // When a deck exists and the right panel is open, it answers on the side
  const quizShownAside = latestQuiz !== null && rightPanelOpen && tutorMode !== 'cards'

  // Initialize session on mount
  useEffect(() => {
    if (!activeSessionId) {
      const state = useAppStore.getState()
      // A fresh session starts with the user's chosen default persona
      if (state.settings.defaultPersona && state.settings.defaultPersona !== state.activePersona) {
        state.setActivePersona(state.settings.defaultPersona)
      }
      const sessionId = crypto.randomUUID()
      setActiveSession(sessionId)
      addMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: `Welcome${userName ? ', ' + userName : ''}! I'm your AI tutor. What would you like to learn about today? Pick a topic below or type your own!`,
        createdAt: new Date().toISOString(),
      })
    }
  }, [])

  // Timer
  useEffect(() => {
    if (messages.length > 0 && !timerStarted.current) {
      timerStarted.current = true
      timerRef.current = setInterval(() => {
        setTimerSeconds((s) => s + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [messages.length])

  // Auto-scroll on new messages & stop TTS. The ScrollArea ref is the Radix
  // root — the element that actually scrolls is the viewport inside it.
  const prevMessagesLen = useRef(messages.length)
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
    if (viewport) {
      // Scroll so a fresh AI response is read from its start; anything else
      // (user message, typing indicator) just pins to the bottom.
      const last = messages[messages.length - 1]
      requestAnimationFrame(() => {
        if (last?.role === 'assistant' && !isLoading) {
          const el = viewport.querySelector<HTMLElement>(`[data-message-id="${last.id}"]`)
          if (el) {
            viewport.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
            return
          }
        }
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' })
      })
    }
    if (messages.length > prevMessagesLen.current) {
      stopAllTTS()
    }
    prevMessagesLen.current = messages.length
  }, [messages, isLoading])

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    const size = INPUT_SIZES[inputSize]
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, size.maxH)}px`
  }, [inputSize])

  const cycleInputSize = useCallback(() => {
    setInputSize((prev) => {
      const idx = INPUT_SIZE_CYCLE.indexOf(prev)
      const next = INPUT_SIZE_CYCLE[(idx + 1) % INPUT_SIZE_CYCLE.length]
      return next
    })
  }, [])

  const charCount = input.length
  const charColorClass = charCount < 350 ? 'text-emerald-600 dark:text-emerald-400' : charCount < 450 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'

  // ── Voice Input ──
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
    }
    silenceTimerRef.current = setTimeout(() => {
      if (speechRef.current && voiceState === 'listening') {
        speechRef.current.stop()
      }
    }, 5000)
  }, [voiceState])

  const stopVoice = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (speechRef.current) {
      speechRef.current.abort()
      speechRef.current = null
    }
    setVoiceState('idle')
  }, [])

  const toggleVoice = useCallback(() => {
    if (voiceState === 'listening') {
      stopVoice()
      return
    }

    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      toast.error('Voice input is not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = document.documentElement.lang || navigator.language || 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setVoiceState('listening')
      resetSilenceTimer()
    }

    recognition.onresult = (event: SpeechRecognitionEventType) => {
      resetSilenceTimer()
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' '
        }
      }
      if (finalTranscript) {
        setVoiceState('processing')
        setInput((prev) => {
          const base = prev.endsWith(' ') ? prev : prev ? prev + ' ' : ''
          const combined = base + finalTranscript.trim()
          return combined.length > MAX_INPUT_CHARS ? combined.slice(0, MAX_INPUT_CHARS) : combined
        })
        setTimeout(() => {
          if (voiceState === 'processing') {
            setVoiceState('listening')
          }
        }, 300)
      }
    }

    recognition.onerror = (event: { error: string }) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setVoiceState('idle')
      } else {
        setVoiceState('error')
        toast.error(`Voice input error: ${event.error}`)
        setTimeout(() => setVoiceState('idle'), 2000)
      }
    }

    recognition.onend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      speechRef.current = null
      setVoiceState('idle')
    }

    speechRef.current = recognition
    try {
      recognition.start()
    } catch {
      toast.error('Failed to start voice input')
      setVoiceState('idle')
    }
  }, [voiceState, stopVoice, resetSilenceTimer])

  // Stop voice on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && voiceState === 'listening') {
        stopVoice()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [voiceState, stopVoice])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speechRef.current) {
        speechRef.current.abort()
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
      }
    }
  }, [])

  const speechSupported = useMemo(() => typeof window !== 'undefined' && !!getSpeechRecognition(), [])

  const handleSend = useCallback(async (text?: string) => {
    const content = (text || input).trim()
    if (!content) return

    const sessionId = activeSessionId || crypto.randomUUID()
    if (!activeSessionId) {
      setActiveSession(sessionId)
    }

    const userMsg = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user' as const,
      content,
      createdAt: new Date().toISOString(),
    }
    addMessage(userMsg)
    setInput('')

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setLoading(true)

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          // Read fresh from the store: revision/quiz controls may have just changed the phase
          phase: useAppStore.getState().sessionPhase,
          topic: activeTopic || activeCourse?.title || undefined,
          learnerProfile,
          masteryMap,
          history,
          persona: activePersona,
          moodSettings,
          // Learning context so the tutor actually adapts
          userName,
          tips: tips.slice(-5).map((t) => t.content),
          feedbackItems: feedbackItems.slice(-5).map((f) => ({ type: f.type, createdAt: f.createdAt })),
          responseSpeed: settings.responseSpeed,
          language: settings.language,
          hardSubjects,
          alwaysConfuses,
          bestTeachingStyle,
          // The tutor always knows what the learner is looking at
          slideContext: activeSlides.length > 0
            ? {
                courseTitle: activeCourse?.title,
                index: currentSlideIndex + 1,
                total: activeSlides.length,
                title: activeSlides[currentSlideIndex]?.title,
                content: (activeSlides[currentSlideIndex]?.content || '').slice(0, 1800),
              }
            : activeSlideContent
              ? { courseTitle: activeCourse?.title, content: activeSlideContent.slice(0, 1800) }
              : undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to get response')

      const data = await res.json()
      const responseText = data.response || data.message || data.content || "I'm sorry, I couldn't generate a response. Please try again."

      addMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: responseText,
        createdAt: new Date().toISOString(),
      })

      const phaseNow = useAppStore.getState().sessionPhase
      if (phaseNow === 'discovery' || phaseNow === 'starter') {
        setSessionPhase('teaching')
      }
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: "Hmm, I ran into an issue. Let me try again — could you repeat your question?",
        createdAt: new Date().toISOString(),
      })
      toast.error('Failed to get a response. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [input, activeSessionId, messages, learnerProfile, masteryMap, addMessage, setActiveSession, setLoading, setSessionPhase, activePersona, moodSettings, activeTopic, activeCourse, userName, tips, feedbackItems, settings.responseSpeed, settings.language, hardSubjects, alwaysConfuses, bestTeachingStyle, activeSlides, currentSlideIndex, activeSlideContent])

  // Revision mode: SessionControls sets the phase to 'review', then this sends
  // a visible revision request through the normal chat path
  const handleRevisionRequest = useCallback(() => {
    handleSend("Let's revise what we've covered so far")
  }, [handleSend])

  // Record the session as a real StudySession (feeds heatmaps, streaks, achievements)
  const recordStudySession = useCallback(() => {
    const hasExchange = messages.some((m) => m.role === 'user')
    if (!hasExchange) return
    addStudySession({
      id: crypto.randomUUID(),
      topic: activeTopic || activeCourse?.title || 'Tutor Session',
      date: new Date().toISOString(),
      duration: Math.max(1, Math.round(timerSeconds / 60)),
      messagesCount: messages.length,
      masteryGained: sessionStats.avgMastery,
    })
  }, [messages, activeTopic, activeCourse, timerSeconds, sessionStats.avgMastery, addStudySession])

  const handleRegenerate = useCallback((messageId: string) => {
    // Find the user message that preceded this assistant message
    const msgIndex = messages.findIndex((m) => m.id === messageId)
    if (msgIndex > 0) {
      const prevMsg = messages[msgIndex - 1]
      if (prevMsg.role === 'user') {
        handleSend(prevMsg.content)
      }
    }
  }, [messages, handleSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // When a suggested topic matches one of the user's courses, pull that
  // course's slides straight into the slide panel — no trip to Courses needed.
  const loadCourseSlidesByTitle = useCallback(async (title: string) => {
    const course = courses.find((c) => c.title === title)
    if (!course) return
    setActiveCourse(course)
    setCurrentSlideIndex(0)
    if (course.slides && course.slides.length > 0) {
      setActiveSlides(course.slides)
      return
    }
    try {
      const res = await fetch(`/api/courses/${course.id}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.course?.slides?.length) {
        setActiveCourse(data.course)
        setActiveSlides(data.course.slides)
      }
    } catch {
      // Slides are a bonus here — the chat continues without them
    }
  }, [courses, setActiveCourse, setActiveSlides, setCurrentSlideIndex])

  const handleTopicClick = (topic: string) => {
    setActiveTopic(topic)
    loadCourseSlidesByTitle(topic)
    handleSend(`I'd like to learn about ${topic}`)
  }

  const handleQuickAction = (prompt: string) => {
    handleSend(prompt)
  }

  const handleSaveAndClose = useCallback(() => {
    recordStudySession()
    toast.success('Session saved!')
    navigate('dashboard')
  }, [recordStudySession, navigate])

  // Save as Note handler
  const handleSaveAsNote = useCallback((message: ChatMessage) => {
    setNoteDialogContent(message.content)
    setNoteDialogTitle(message.content.length > 50 ? message.content.slice(0, 50) : message.content)
    setNoteDialogTags([])
    setNoteDialogOpen(true)
  }, [])

  const handleSaveNoteDialog = useCallback(() => {
    if (!noteDialogTitle.trim()) return
    addNote({
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: noteDialogTitle.trim(),
      content: noteDialogContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: noteDialogTags,
    })
    setNoteDialogOpen(false)
    toast.success('Note saved!')
  }, [noteDialogTitle, noteDialogContent, noteDialogTags, addNote])

  const handleToggleNoteTag = useCallback((tag: string) => {
    setNoteDialogTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }, [])

  // Scroll to starred message handler
  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header - Frosted glass */}
      <header className="glass-header flex items-center justify-between px-4 py-3 z-10">
        <div className="flex items-center gap-3">
          {/* AI Active indicator + name */}
          <div className="flex items-center gap-2">
            <motion.span
              className="relative flex h-2.5 w-2.5"
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(16, 185, 129, 0.5)',
                  '0 0 0 5px rgba(16, 185, 129, 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            >
              <span className="absolute inset-0 rounded-full bg-emerald-500" />
            </motion.span>
            <h1 className="text-lg font-semibold">
              {activeTopic || 'AI Tutor'}
            </h1>
          </div>
          <Badge variant="secondary" className={getPhaseColor(sessionPhase)}>
            {sessionPhase}
          </Badge>
          {/* Mode Selector — pill sizes itself to the active button */}
          <div className="hidden sm:flex items-center rounded-lg border border-border bg-background/50 p-0.5">
            {TUTOR_MODES.map((mode) => {
              const Icon = mode.icon
              const isActive = tutorMode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => setTutorMode(mode.id)}
                  className={`relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={mode.desc}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tutor-mode-indicator"
                      className="absolute inset-0 rounded-md bg-primary shadow-sm"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon className="relative z-10 w-3.5 h-3.5" />
                  <span className="relative z-10">{mode.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Collapsible Pomodoro Timer */}
          <div className="relative">
            <button
              onClick={() => setPomodoroExpanded(!pomodoroExpanded)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border glass hover:bg-accent/50 transition-colors"
              aria-label="Toggle Pomodoro timer"
            >
              <svg width="20" height="20" className="-rotate-90">
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted/30"
                />
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="url(#pomoGrad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={pomodoroCircumference}
                  strokeDashoffset={pomodoroStrokeOffset}
                  className="transition-all duration-500"
                />
                <defs>
                  <linearGradient id="pomoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#14b8a6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className={`font-mono text-xs font-medium ${currentPomodoroMode.color}`}>
                {Math.floor(pomodoroTimeLeft / 60)}:{String(pomodoroTimeLeft % 60).padStart(2, '0')}
              </span>
            </button>

            {/* Expanded Pomodoro Panel */}
            <AnimatePresence>
              {pomodoroExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute top-full right-0 mt-2 z-50 w-64 rounded-xl border bg-card p-4 shadow-lg space-y-3"
                >
                  {/* Mode tabs */}
                  <div className="flex items-center rounded-lg border border-border bg-background/50 p-0.5">
                    {POMODORO_MODES.map((mode, i) => {
                      const Icon = mode.icon
                      return (
                        <button
                          key={mode.id}
                          onClick={() => {
                            setPomodoroModeIndex(i)
                            setPomodoroTimeLeft(mode.duration)
                            setPomodoroRunning(false)
                          }}
                          className={`flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all ${
                            pomodoroModeIndex === i
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span className="hidden sm:inline">{mode.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Circular timer */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <svg width="96" height="96" className="-rotate-90">
                        <circle
                          cx="48"
                          cy="48"
                          r="42"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="text-muted/20"
                        />
                        <motion.circle
                          cx="48"
                          cy="48"
                          r="42"
                          fill="none"
                          stroke="url(#pomoGradLarge)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 42}
                          strokeDashoffset={2 * Math.PI * 42 * (1 - pomodoroProgress)}
                          className="transition-all duration-1000"
                        />
                        <defs>
                          <linearGradient id="pomoGradLarge" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#14b8a6" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-2xl font-bold font-mono ${currentPomodoroMode.color}`}>
                          {Math.floor(pomodoroTimeLeft / 60)}:{String(pomodoroTimeLeft % 60).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{currentPomodoroMode.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Session count */}
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground">
                      Session <span className={`font-bold ${currentPomodoroMode.color}`}>{(pomodoroSessions % 4) + 1}</span> / 4
                    </span>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handlePomodoroReset}
                      aria-label="Reset timer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-9 w-9"
                      onClick={handlePomodoroToggle}
                      aria-label={pomodoroRunning ? 'Pause' : 'Start'}
                    >
                      {pomodoroRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handlePomodoroSkip}
                      aria-label="Skip to next"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Session timer with pulsing emerald ring when running */}
          <motion.div
            className="relative"
            animate={timerSeconds > 0 ? {
              boxShadow: [
                '0 0 0 0 rgba(16, 185, 129, 0.2)',
                '0 0 0 4px rgba(16, 185, 129, 0)',
              ],
            } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          >
            <Badge variant="outline" className="font-mono text-xs rounded-full">
              <span className={timerSeconds > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                {formatTimer(timerSeconds)}
              </span>
            </Badge>
          </motion.div>
          {/* Word Count Stats Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 glass text-xs text-muted-foreground">
            <MessageCircle className="w-3 h-3 text-emerald-500" />
            <span className="font-mono font-medium tabular-nums">{messages.length}</span>
            <span className="text-muted-foreground/60">·</span>
            <Clock className="w-3 h-3 text-emerald-500" />
            <span className="font-mono font-medium tabular-nums">{formatTimer(timerSeconds)}</span>
          </div>
          <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="gradient-border rounded-lg"
              aria-label={rightPanelOpen ? 'Close side panel' : 'Open side panel'}
            >
              {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </Button>
          </motion.div>
          {/* Study Soundscapes */}
          <StudySoundscapes />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide Panel - visible in slide or hybrid mode when slides exist */}
        <AnimatePresence initial={false}>
        {showSlidePanel && (
          <motion.div
            key="slide-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: tutorMode === 'slide' ? '50%' : '40%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ width: { type: 'spring', stiffness: 260, damping: 32 }, opacity: { duration: 0.2 } }}
            style={{ willChange: 'width' }}
            className="border-r glass overflow-hidden flex flex-col card-shadow"
          >
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Course Slides</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {currentSlideIndex + 1} / {activeSlides.length}
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                {/* Slide navigation dots */}
                <div className="flex gap-1 mb-3 flex-wrap">
                  {activeSlides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlideIndex(idx)}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentSlideIndex
                          ? 'bg-primary w-6'
                          : 'bg-muted w-2 hover:bg-primary/50'
                      }`}
                    />
                  ))}
                </div>
                {activeSlides[currentSlideIndex] && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {activeSlides[currentSlideIndex].title}
                    </h3>
                    <div className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {activeSlides[currentSlideIndex].content}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={currentSlideIndex === 0}
                        onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={currentSlideIndex === activeSlides.length - 1}
                        onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Course Context Panel - fallback when no dedicated slide panel */}
          {!showSlidePanel && <CourseContextPanel />}

          {/* Chat sub-header with slide navigation + search button */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border/40">
            <span className="text-xs text-muted-foreground truncate shrink min-w-0">
              {activeTopic ? `Studying: ${activeTopic}` : 'Ready to learn'}
            </span>
            {/* Slide controls: advance slides without leaving the chat */}
            {activeSlides.length > 0 && (
              <div className="flex items-center gap-1 min-w-0 shrink-0 max-w-[55%]">
                <button
                  onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                  disabled={currentSlideIndex === 0}
                  className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 tabular-nums shrink-0">
                  {currentSlideIndex + 1}/{activeSlides.length}
                </Badge>
                <span
                  className="text-xs text-muted-foreground truncate min-w-0 hidden sm:inline"
                  title={activeSlides[currentSlideIndex]?.title}
                >
                  {activeSlides[currentSlideIndex]?.title}
                </span>
                <button
                  onClick={() => setCurrentSlideIndex(Math.min(activeSlides.length - 1, currentSlideIndex + 1))}
                  disabled={currentSlideIndex === activeSlides.length - 1}
                  className="flex items-center gap-0.5 px-1.5 py-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors text-[11px] font-medium"
                  aria-label="Next slide"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery('') }}
              className={`p-1.5 rounded-lg transition-colors ${searchOpen ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
              aria-label="Search within chat"
            >
              <Search className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Search Bar - slides down with framer-motion */}
          <AnimatePresence>
            {searchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden border-b border-border/60"
              >
                <div className="flex items-center gap-2 px-4 py-2 glass">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search within chat..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {searchQuery && (
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {searchMatches.matchCount} match{searchMatches.matchCount !== 1 ? 'es' : ''}
                    </span>
                  )}
                  <button
                    onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                    className="shrink-0 p-0.5 rounded-md hover:bg-accent transition-colors"
                    aria-label="Close search"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <ScrollArea className="flex-1 min-h-0 p-4 tutor-chat-glass" ref={scrollRef}>
            {/* Quick topic chips from the user's real courses */}
            {!activeTopic && messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {quickTopics.length > 0 ? (
                  quickTopics.map((topic) => (
                    <Button
                      key={topic}
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => handleTopicClick(topic)}
                    >
                      {topic}
                    </Button>
                  ))
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs gap-1.5"
                    onClick={() => navigate('upload')}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Upload slides to get topic suggestions
                  </Button>
                )}
              </div>
            )}

            {searchOpen && searchQuery.trim()
              ? searchMatches.matchCount > 0
                ? searchMatches.filtered.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`rounded-xl p-3 mb-2 border ${
                        msg.role === 'user'
                          ? 'ml-8 bg-primary/5 border-primary/20'
                          : 'mr-8 glass border-border/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${msg.role === 'user' ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {msg.role === 'user' ? 'You' : 'AI Tutor'}
                        </span>
                      </div>
                      <div className="text-sm leading-relaxed text-foreground/90">
                        {highlightText(msg.content, searchQuery)}
                      </div>
                    </motion.div>
                  ))
                : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Search className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm">No messages match "{searchQuery}"</p>
                    </div>
                  )
              : tutorMode === 'cards' ? (
                  /* Cards-first mode: the deck is the teaching surface; text the AI below */
                  <div className="mx-auto max-w-xl py-4 space-y-4">
                    {latestQuiz ? (
                      <InteractiveQuizCard key={latestQuiz.messageId} payload={latestQuiz.payload} messageId={latestQuiz.messageId} />
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <Layers className="h-8 w-8 text-primary/60" />
                        <p className="text-sm text-muted-foreground max-w-xs">
                          Card mode — your tutor teaches through flashcards you answer.
                        </p>
                        <Button
                          size="sm"
                          disabled={isLoading}
                          onClick={() => handleSend('Give me flashcards on what we are studying')}
                        >
                          Create flashcards
                        </Button>
                      </div>
                    )}
                    {/* Last piece of tutor text, compact, for context */}
                    {(() => {
                      const lastText = [...messages].reverse().find((m) => m.role === 'assistant' && !parseQuizPayload(m.content))
                      return lastText ? (
                        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-3 line-clamp-4">
                          {lastText.content}
                        </p>
                      ) : null
                    })()}
                  </div>
                )
              : messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    message={msg}
                    isStreaming={false}
                    onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
                    onSaveAsNote={msg.role === 'assistant' ? handleSaveAsNote : undefined}
                    scrollToMessage={handleScrollToMessage}
                    quizAside={quizShownAside && latestQuiz?.messageId === msg.id}
                  />
                ))
            }

            {isLoading && <TypingIndicator />}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t tutor-floating-input">
            {/* Suggested Prompts Bar */}
            <AnimatePresence>
              {!inputFocused && input.trim() === '' && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pt-2.5 pb-1 max-w-3xl mx-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <motion.button
                          key={prompt}
                          whileHover={{ scale: 1.03, y: -1 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleSend(prompt)}
                          className="px-3 py-1.5 text-xs font-medium rounded-full border border-border/60 glass-hover text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 hover:shadow-[0_0_12px_rgba(16,185,129,0.1)] transition-all duration-200"
                        >
                          {prompt}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="px-3 pb-3 pt-1">
              <div className="max-w-3xl mx-auto">
                {/* Gradient border glow wrapper */}
                <div className="relative gradient-border rounded-xl">
                  {inputFocused && (
                    <motion.div
                      layoutId="input-glow"
                      className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-emerald-500/30 via-teal-500/30 to-emerald-500/30 blur-sm -z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                  <div className="flex items-end gap-1.5 glass-blur-strong rounded-xl border border-border/60 p-1.5 transition-shadow duration-300">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Ask me anything..."
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      className="resize-none flex-1 border-0 shadow-none focus-visible:ring-0 p-2 text-sm bg-transparent placeholder:text-muted-foreground"
                      style={{ minHeight: INPUT_SIZES[inputSize].minH, maxHeight: INPUT_SIZES[inputSize].maxH }}
                      rows={INPUT_SIZES[inputSize].rows}
                    />

                    {/* Character count */}
                    <div className="flex items-center gap-1 pb-1.5 pr-1">
                      {charCount > 0 && (
                        <motion.span
                          initial={{ opacity: 0, x: 4 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 4 }}
                          className={`text-[10px] font-mono tabular-nums ${charColorClass}`}
                        >
                          {charCount}/{MAX_INPUT_CHARS}
                        </motion.span>
                      )}

                      {/* Voice Input (Mic) Button */}
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 rounded-lg transition-all ${
                            voiceState === 'listening'
                              ? 'text-red-500 dark:text-red-400'
                              : voiceState === 'error'
                                ? 'text-red-500 dark:text-red-400'
                                : voiceState === 'processing'
                                  ? 'text-amber-500 dark:text-amber-400'
                                  : speechSupported
                                    ? 'text-muted-foreground hover:text-foreground'
                                    : 'text-muted-foreground/30 cursor-not-allowed'
                          }`}
                          onClick={toggleVoice}
                          disabled={!speechSupported || voiceState === 'processing'}
                          aria-label={
                            voiceState === 'listening'
                              ? 'Stop voice input'
                              : voiceState === 'processing'
                                ? 'Processing voice...'
                                : speechSupported
                                  ? 'Start voice input'
                                  : 'Voice input not supported'
                          }
                          title={
                            !speechSupported
                              ? 'Voice input not supported in this browser'
                              : voiceState === 'listening'
                                ? 'Click to stop'
                                : 'Voice input'
                          }
                        >
                          <AnimatePresence mode="wait">
                            {voiceState === 'listening' ? (
                              <motion.span
                                key="listening"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                className="relative flex items-center justify-center"
                              >
                                {/* Pulsing ring */}
                                <motion.span
                                  className="absolute inset-0 rounded-full bg-red-500/20"
                                  animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                                />
                                <motion.span
                                  className="absolute inset-0 rounded-full bg-red-500/15"
                                  animate={{ scale: [1, 2.2], opacity: [0.4, 0] }}
                                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                                />
                                <Mic className="w-3.5 h-3.5 relative z-10" />
                              </motion.span>
                            ) : voiceState === 'processing' ? (
                              <motion.span
                                key="processing"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                              >
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              </motion.span>
                            ) : (
                              <motion.span
                                key="idle"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                              >
                                <Mic className="w-3.5 h-3.5" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </Button>
                      </motion.div>

                      {/* Waveform animation when listening */}
                      <AnimatePresence>
                        {voiceState === 'listening' && (
                          <motion.div
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            className="flex items-center gap-0.5 overflow-hidden"
                          >
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="w-0.5 bg-red-500 dark:bg-red-400 rounded-full"
                                animate={{
                                  height: [4, 12 + i * 4, 4],
                                }}
                                transition={{
                                  duration: 0.6,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                  delay: i * 0.15,
                                }}
                              />
                            ))}
                            <span className="text-[10px] text-red-500 dark:text-red-400 font-medium ml-1 whitespace-nowrap">
                              Listening...
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Expand/Collapse button */}
                      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                          onClick={cycleInputSize}
                          aria-label={`Input size: ${INPUT_SIZES[inputSize].label}. Click to change.`}
                        >
                          {inputSize === 'small' ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : inputSize === 'large' ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </motion.div>

                      {/* Quick actions menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" aria-label="Quick actions">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {QUICK_ACTIONS.map((action) => (
                            <DropdownMenuItem
                              key={action.label}
                              onClick={() => handleQuickAction(action.prompt)}
                              className="gap-2"
                            >
                              <action.icon className="w-4 h-4" />
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Send button */}
                      <Button
                        size="icon"
                        className={`shrink-0 h-7 w-7 rounded-lg ${input.trim() ? 'pulse-glow' : ''}`}
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        aria-label="Send message"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Contextual suggestion chips below input */}
                <AnimatePresence>
                  {!isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="flex flex-wrap gap-1.5 mt-2 justify-center"
                    >
                      {CONTEXTUAL_SUGGESTIONS.map((suggestion, index) => (
                        <motion.button
                          key={suggestion}
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 28,
                            delay: index * 0.06,
                          }}
                          whileHover={{ scale: 1.05, y: -1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSend(suggestion)}
                          className="px-3 py-1 text-[11px] font-medium rounded-full border border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors"
                        >
                          {suggestion}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel — compact: Practice first, everything else collapsible */}
        {rightPanelOpen && (
          <div className="w-72 border-l glass overflow-y-auto hidden md:block">
            <div className="p-3">
              {/* Practice: the latest quiz/flashcards answer here, chat stays central */}
              {latestQuiz && tutorMode !== 'cards' && (
                <div className="pb-2">
                  <div className="flex items-center gap-1.5 py-2 text-xs font-semibold text-muted-foreground">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Practice
                  </div>
                  <InteractiveQuizCard key={latestQuiz.messageId} payload={latestQuiz.payload} messageId={latestQuiz.messageId} />
                  <Separator className="mt-3" />
                </div>
              )}

              {/* Session controls (phase stepper + quiz/revision/export/end) */}
              <SessionControls onRevision={handleRevisionRequest} onEndSession={recordStudySession} />

              <Separator className="my-2" />

              <PanelSection title="Persona & Mood" icon={Brain}>
                <PersonaSelector />
              </PanelSection>

              <PanelSection title="Concept Mastery" icon={Target}>
                <MasteryTracker />
              </PanelSection>

              <PanelSection title="Insights" icon={Sparkles}>
                <ConversationInsights messages={messages} masteryMap={masteryMap} />
              </PanelSection>

              <PanelSection title="Teach me better" icon={Lightbulb}>
                <div className="space-y-4">
                  <TipInput />
                  <FeedbackBar />
                </div>
              </PanelSection>

              {learnerProfile && (
                <p className="py-2 text-[11px] text-muted-foreground">
                  Learning style: <span className="text-foreground">{learnerProfile.learningStyle}</span>
                  {' · '}pace: <span className="text-foreground">{learnerProfile.pace}</span>
                </p>
              )}

              <Separator className="my-2" />

              {/* Starred Messages Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <button
                        onClick={() => setShowStarredOnly(!showStarredOnly)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-500" />
                        Starred
                        {starredMessages.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">
                            {starredMessages.length}
                          </Badge>
                        )}
                      </button>
                    </motion.div>
                  </div>
                  {starredMessages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px] text-muted-foreground hover:text-red-500 px-1.5"
                      onClick={clearAllStarredMessages}
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                {starredMessages.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {starredMessages.map((sm) => {
                      const originalMsg = messages.find((m) => m.id === sm.messageId)
                      if (!originalMsg) return null
                      return (
                        <motion.div
                          key={sm.messageId}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="group rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-2 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
                          onClick={() => handleScrollToMessage(sm.messageId)}
                        >
                          <p className="text-[11px] text-foreground/80 line-clamp-2 leading-relaxed">
                            {originalMsg.content.length > 100
                              ? originalMsg.content.slice(0, 100) + '...'
                              : originalMsg.content}
                          </p>
                          {sm.reason && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                              <StickyNote className="w-2.5 h-2.5" />
                              {sm.reason}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(sm.starredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                unstarMessage(sm.messageId)
                                toast.info('Message unstarred')
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
                              aria-label="Unstar"
                            >
                              <X className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-2">
                    Star important messages to bookmark them
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* End Session Summary Panel */}
      <AnimatePresence>
        {showEndSession && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowEndSession(false)}
            />

            {/* Confetti Particles */}
            {sessionStats.showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {confettiParticles.map((p) => (
                  <motion.div
                    key={p.id}
                    className="absolute w-2 h-2 rounded-sm"
                    style={{ backgroundColor: p.color, left: `${p.x}%`, top: `${p.y}%` }}
                    initial={{ y: 0, opacity: 1, rotate: 0, x: 0 }}
                    animate={{
                      y: [0, 200, 400, 600],
                      x: [0, p.drift * 0.3, p.drift * 0.7, p.drift],
                      opacity: [1, 1, 0.8, 0],
                      rotate: [p.rotation, p.rotation + 360],
                    }}
                    transition={{
                      duration: 3,
                      delay: p.delay,
                      ease: 'easeIn',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Panel */}
            <motion.div
              className="relative z-10 w-full max-w-lg mx-4 mb-4 rounded-2xl glass card-shadow border border-border/50 overflow-hidden"
              initial={{ y: '100%', opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: '100%', opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-2">
                  {sessionStats.showConfetti && <Trophy className="w-5 h-5 text-amber-500" />}
                  <h2 className="text-lg font-bold gradient-text">Session Summary</h2>
                </div>
                <button
                  onClick={() => setShowEndSession(false)}
                  className="p-1 rounded-lg hover:bg-accent transition-colors"
                  aria-label="Close summary"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-6 pb-6 space-y-5">
                {/* Session Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl glass border border-border/40 gradient-border p-3 space-y-1 card-shadow">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Duration</span>
                    </div>
                    <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                      {formatTimer(sessionStats.duration)}
                    </p>
                  </div>
                  <div className="rounded-xl glass border border-border/40 gradient-border p-3 space-y-1 card-shadow">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Messages</span>
                    </div>
                    <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                      {sessionStats.messagesExchanged}
                    </p>
                  </div>
                  <div className="rounded-xl glass border border-border/40 gradient-border p-3 space-y-1 card-shadow">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <BookMarked className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Topics Covered</span>
                    </div>
                    <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                      {sessionStats.topicsCovered.length}
                    </p>
                  </div>
                  <div className="rounded-xl glass border border-border/40 gradient-border p-3 space-y-1 card-shadow">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Target className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Concepts Explored</span>
                    </div>
                    <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                      {sessionStats.conceptsExplored}
                    </p>
                  </div>
                </div>

                {/* Mastery Progress Bar */}
                {sessionStats.conceptsExplored > 0 && (
                  <div className="rounded-xl glass border border-border/40 gradient-border p-3 space-y-2 card-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Avg Mastery Gained</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {sessionStats.avgMastery}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${sessionStats.avgMastery}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {/* Topics List */}
                {sessionStats.topicsCovered.length > 0 && (
                  <div className="rounded-xl glass border border-border/40 gradient-border p-3 space-y-2 card-shadow">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Topics</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sessionStats.topicsCovered.map((topic) => (
                        <Badge key={topic} variant="secondary" className="text-xs">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Takeaways */}
                {sessionStats.keyTakeaways.length > 0 && (
                  <div className="rounded-xl glass border border-border/40 gradient-border p-3 space-y-2 card-shadow">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Key Takeaways</span>
                    </div>
                    <ul className="space-y-1.5">
                      {sessionStats.keyTakeaways.map((takeaway, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground/80 leading-relaxed">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          {takeaway}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowEndSession(false)}
                  >
                    Continue Studying
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                    onClick={handleSaveAndClose}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Save & Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save as Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-primary" />
              Save as Note
            </DialogTitle>
            <DialogDescription>
              Capture this AI response as a study note for later review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                id="note-title"
                value={noteDialogTitle}
                onChange={(e) => setNoteDialogTitle(e.target.value)}
                placeholder="Note title..."
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-content">Content</Label>
              <Textarea
                id="note-content"
                value={noteDialogContent}
                onChange={(e) => setNoteDialogContent(e.target.value)}
                placeholder="Note content..."
                className="text-sm min-h-[120px] max-h-[200px] resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_NOTE_TAGS.map((tag) => (
                  <motion.button
                    key={tag}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleToggleNoteTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      noteDialogTags.includes(tag)
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-muted/50 border-border/40 text-muted-foreground hover:border-primary/20 hover:text-foreground'
                    }`}
                  >
                    {tag}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveNoteDialog}
              disabled={!noteDialogTitle.trim()}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
