'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

import { ChatBubble, stopAllTTS } from './ChatBubble'
import { TypingIndicator } from './TypingIndicator'
import { MasteryTracker } from './MasteryTracker'
import { SessionControls } from './SessionControls'
import { TipInput } from './TipInput'
import { FeedbackBar } from './FeedbackBar'
import { CourseContextPanel } from './CourseContextPanel'
import { PersonaSelector } from './PersonaSelector'

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

const QUICK_TOPICS = ['Cell Biology', 'Data Structures', 'World History', 'Calculus', 'Creative Writing']

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
]

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
    tutorMode,
    setTutorMode,
    activeSlides,
    currentSlideIndex,
    setCurrentSlideIndex,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [inputSize, setInputSize] = useState<InputSize>('medium')
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

  const showSlidePanel = (tutorMode === 'slide' || tutorMode === 'hybrid') && activeSlides.length > 0

  // Initialize session on mount
  useEffect(() => {
    if (!activeSessionId) {
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

  // Auto-scroll to bottom & stop TTS on new messages
  const prevMessagesLen = useRef(messages.length)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
  const charColorClass = charCount < 200 ? 'text-emerald-600 dark:text-emerald-400' : charCount < 400 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'

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
          phase: sessionPhase,
          learnerProfile,
          masteryMap,
          history,
          persona: activePersona,
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

      if (sessionPhase === 'discovery' || sessionPhase === 'starter') {
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
  }, [input, activeSessionId, messages, sessionPhase, learnerProfile, masteryMap, addMessage, setActiveSession, setLoading, setSessionPhase, activePersona])

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

  const handleTopicClick = (topic: string) => {
    setActiveTopic(topic)
    handleSend(`I'd like to learn about ${topic}`)
  }

  const handleQuickAction = (prompt: string) => {
    handleSend(prompt)
  }

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
          {/* Mode Selector - Pill toggle with sliding indicator */}
          <div className="hidden sm:flex items-center rounded-lg border border-border bg-background/50 p-0.5 relative">
            <AnimatePresence>
              {tutorMode && (
                <motion.div
                  layoutId="tutor-mode-indicator"
                  className="absolute inset-y-0.5 rounded-md bg-primary shadow-sm"
                  style={{
                    left: TUTOR_MODES.findIndex((m) => m.id === tutorMode) === 0
                      ? '2px'
                      : TUTOR_MODES.findIndex((m) => m.id === tutorMode) === 1
                        ? `${100 / 3}%`
                        : `${(200 / 3)}%`,
                    width: `${100 / 3}%`,
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
            </AnimatePresence>
            {TUTOR_MODES.map((mode) => {
              const Icon = mode.icon
              const isActive = tutorMode === mode.id
              return (
                <motion.button
                  key={mode.id}
                  onClick={() => setTutorMode(mode.id)}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className={`relative z-10 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title={mode.desc}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mode.label}
                </motion.button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Collapsible Pomodoro Timer */}
          <div className="relative">
            <button
              onClick={() => setPomodoroExpanded(!pomodoroExpanded)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border bg-card/50 hover:bg-accent/50 transition-colors"
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
          <Badge variant="outline" className="text-xs">
            {messages.length} messages
          </Badge>
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
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide Panel - visible in slide or hybrid mode when slides exist */}
        {showSlidePanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: tutorMode === 'slide' ? '50%' : '40%', opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-r bg-card/30 overflow-hidden flex flex-col"
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
            <ScrollArea className="flex-1">
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

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Course Context Panel - fallback when no dedicated slide panel */}
          {!showSlidePanel && <CourseContextPanel />}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {/* Quick topic chips when no topic is set */}
            {!activeTopic && messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {QUICK_TOPICS.map((topic) => (
                  <Button
                    key={topic}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => handleTopicClick(topic)}
                  >
                    {topic}
                  </Button>
                ))}
              </div>
            )}

            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                isStreaming={false}
                onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
              />
            ))}

            {isLoading && <TypingIndicator />}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t bg-card/50">
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
                          className="px-3 py-1.5 text-xs font-medium rounded-full border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
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
                <div className="relative">
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
                  <div className="flex items-end gap-1.5 bg-background rounded-xl border border-border p-1.5 transition-shadow duration-300">
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
                          {charCount}
                        </motion.span>
                      )}

                      {/* Microphone placeholder */}
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-muted-foreground cursor-not-allowed"
                        title="Voice input coming soon"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                        >
                          <Mic className="w-3.5 h-3.5" />
                        </motion.div>
                      </motion.div>

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
                        className="shrink-0 h-7 w-7 rounded-lg"
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading}
                        aria-label="Send message"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        {rightPanelOpen && (
          <div className="w-72 border-l bg-card/30 overflow-y-auto hidden md:block">
            <div className="p-4 space-y-5">
              {/* Session Phase */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Session Phase</h4>
                <Badge className={getPhaseColor(sessionPhase)}>
                  {sessionPhase.charAt(0).toUpperCase() + sessionPhase.slice(1)}
                </Badge>
              </div>

              <Separator />

              {/* Learner Profile */}
              {learnerProfile && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Learner Profile</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><span className="font-medium text-foreground">Style:</span> {learnerProfile.learningStyle}</p>
                    <p><span className="font-medium text-foreground">Pace:</span> {learnerProfile.pace}</p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Mastery Tracker */}
              <MasteryTracker />

              <Separator />

              {/* Session Controls */}
              <SessionControls />

              <Separator />

              {/* Tip Input */}
              <TipInput />

              <Separator />

              {/* Persona Selector */}
              <PersonaSelector />

              <Separator />

              {/* Feedback Bar */}
              <FeedbackBar />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
