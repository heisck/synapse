'use client'

import { aiFetch, degradedNoticeMessage } from '@/lib/aiKey';
import { readStreamWithWatchdog, StreamStalledError } from '@/lib/streamWatchdog';
import { cleanResponse } from '@/lib/textQuality';
import { loadQuestionCache, appendToQuestionCache, getSlideBank } from '@/lib/questionCache';
import { requestSlideQuestions } from '@/lib/backgroundGenService';
import { whisperSupported, startWhisperRecording, type WhisperRecording } from '@/lib/voice/stt';
import { getLocalDoc } from '@/lib/localLibrary';
import type { StructuredDocument } from '@/lib/document/normalizer';
import type { Question } from '@/types';
import { useState, useRef, useEffect, useCallback, useMemo, startTransition, type ReactNode } from 'react'
import { useAppStore, listCourseChats, loadCourseChatMessages, clearCourseChat } from '@/stores/appStore'
import { isLocalCourse, getLocalSlides } from '@/lib/localLibrary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  AudioLines,
  PanelRightClose,
  Send,
  Lightbulb,
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
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Trophy,
  Sparkles,
  BookMarked,
  Target,
  Clock,
  CheckCircle2,
  Star,
  StickyNote,
  Layers,
  ClipboardCheck,
  SquarePen,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { detectSlideReference, detectRepeatedQuestion, parseQuestionIntent } from './TutorCoach'

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
import { buildAppSnapshot, snapshotSummary } from '@/lib/orchestrator/context'
import { launchQuiz } from '@/lib/quizLaunch'
import { VoiceMode } from './VoiceMode'

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

// Single set of quick actions — each one distinct, shown once below the input
const QUICK_ACTIONS = [
  { label: 'Give me a hint', prompt: 'Give me a hint about what we were just discussing.' },
  { label: 'Show an example', prompt: 'Can you show me an example?' },
  { label: 'Explain it more simply', prompt: 'Explain that again in simpler terms.' },
  { label: 'Quiz me on this', prompt: 'Quiz me on what we just covered.' },
  { label: 'Summarize key points', prompt: 'Summarize the key points so far.' },
  { label: 'Go deeper', prompt: 'Go deeper into this topic.' },
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
    updateMessage,
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
    chatRequestStatus,
    activePersona,
    moodSettings,
    tutorMode,
    setTutorMode,
    activeSlides,
    setActiveSlides,
    setActiveCourse,
    currentSlideIndex,
    setCurrentSlideIndex: setCurrentSlideIndexRaw,
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
    setCurrentQuestions,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [inputSize, setInputSize] = useState<InputSize>('medium')
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle')
  const speechRef = useRef<SpeechRecognitionInstance | null>(null)
  const whisperRecRef = useRef<WhisperRecording | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Live dictation: the input as it was when the mic opened + the finalized
  // speech so far, so we can render interim words in real time (like voice
  // mode) without clobbering what the learner had already typed.
  const voiceBaseRef = useRef('')
  const voiceFinalRef = useRef('')
  // Phones open straight into the chat: the side panel would otherwise cover
  // the thread and has to be closed by hand. Start collapsed on small screens,
  // open on desktop (matches the rightPanelWidth client-init pattern below).
  const [rightPanelOpen, setRightPanelOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 1024
  })
  // Voice conversation mode (hands-free loop with barge-in)
  const [voiceModeOpen, setVoiceModeOpen] = useState(false)

  // Resizable right panel (owner request): drag its left edge to grow/shrink
  // the Practice/session/persona panel; the chosen width persists.
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 288
    const saved = Number(localStorage.getItem('synapse-tutor-panel-width'))
    return saved >= 240 && saved <= 560 ? saved : 288
  })
  useEffect(() => {
    try { localStorage.setItem('synapse-tutor-panel-width', String(rightPanelWidth)) } catch { /* storage unavailable */ }
  }, [rightPanelWidth])
  const handlePanelResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = rightPanelWidth
    const onMove = (ev: PointerEvent) => {
      setRightPanelWidth(Math.min(560, Math.max(240, startWidth + (startX - ev.clientX))))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [rightPanelWidth])
  const [timerSeconds, setTimerSeconds] = useState(0)
  const timerStarted = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ---------- Code-driven coach: mobile slides overlay, advance suggestion, break timer ----------
  // On phones there is no room for a split view — the slide panel becomes a
  // fullscreen overlay with an X to close (subheader Next/Back still work).
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    queueMicrotask(update)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const [mobileSlidesOpen, setMobileSlidesOpen] = useState(false)
  // Session history overlay: search / resume / delete archived chats
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyVersion, setHistoryVersion] = useState(0)
  // Mobile hybrid: slides-on-top height (px), adjusted by dragging the divider.
  // Dragging all the way down → slide mode; all the way up → chat mode.
  const [hybridHeight, setHybridHeight] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.38) : 280,
  )
  const hybridDragRef = useRef<{ startY: number; startH: number } | null>(null)
  const handleHybridDragMove = (e: React.PointerEvent) => {
    const drag = hybridDragRef.current
    if (!drag) return
    const next = drag.startH + (e.clientY - drag.startY)
    setHybridHeight(Math.max(40, Math.min(window.innerHeight - 180, next)))
  }
  const handleHybridDragEnd = () => {
    if (!hybridDragRef.current) return
    hybridDragRef.current = null
    // Snap at the extremes — mode changes happen once, on release, so the UI
    // never flickers open/closed mid-drag
    if (hybridHeight <= 90) {
      setTutorMode('text')
      setHybridHeight(Math.round(window.innerHeight * 0.38))
    } else if (hybridHeight >= window.innerHeight * 0.62) {
      setTutorMode('slide')
      setMobileSlidesOpen(true)
      setHybridHeight(Math.round(window.innerHeight * 0.38))
    }
  }

  // Structured document (tasks 31/37): page classification + compact sequence
  // from the learner's own library — powers slide-purpose-aware tutoring (A10)
  // and the Original/Compact slide player toggle (C18)
  const [structuredDoc, setStructuredDoc] = useState<StructuredDocument | null>(null)
  useEffect(() => {
    let cancelled = false
    const courseId = activeCourse?.id
    // Async resolve keeps setState out of the synchronous effect body
    ;(courseId ? getLocalDoc(courseId) : Promise.resolve(null)).then((rec) => {
      if (!cancelled) setStructuredDoc((rec?.structuredDoc as StructuredDocument) ?? null)
    })
    return () => { cancelled = true }
  }, [activeCourse?.id])

  // Orchestrator continuity blob (task 51/D28): lives client-side only (R1)
  const orchestratorStateRef = useRef<unknown>(null)

  // Pending "how many questions?" ask (task 57): set when the learner asked
  // for a quiz without a count — the next number answers it
  const pendingQuizAskRef = useRef<{ slideNumber: number | null } | null>(null)

  // Last quiz request that failed to generate — "generate them again" /
  // "retry" re-runs the SAME request through the bank-first interceptor
  // instead of falling through to the LLM (which invents an inline quiz).
  const lastFailedQuizIntentRef = useRef<ReturnType<typeof parseQuestionIntent>>(null)

  // Quiz debrief (task 57): when a tutor-launched quiz finished, its results
  // land in tutorQuizContext.result — greet the learner with the outcome and
  // offer review / re-explanation / another round, then clear the context.
  const tutorQuizResult = useAppStore((s) => s.tutorQuizContext)
  useEffect(() => {
    const ctx = tutorQuizResult
    if (!ctx?.result || !activeSessionId) return
    const { correct, total, missedConcepts } = ctx.result
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    const missed = missedConcepts.filter(Boolean).slice(0, 4)
    addMessage({
      id: crypto.randomUUID(),
      sessionId: activeSessionId,
      role: 'assistant',
      content:
        `Welcome back! You scored **${correct}/${total} (${pct}%)** on that quiz.` +
        (missed.length > 0
          ? `\n\nThe concepts that tripped you up: ${missed.map((c) => `**${c}**`).join(', ')}.\n\nWant me to re-explain any of them, review the questions you missed, or set up another quiz?`
          : pct === 100
            ? "\n\nPerfect score — this slide is yours. Say **next** when you're ready to move on."
            : '\n\nWant to review the ones you missed, or try another round?'),
      createdAt: new Date().toISOString(),
    })
    useAppStore.getState().setTutorQuizContext(null)
     
  }, [tutorQuizResult, activeSessionId])

  // Learning boundary (B16): the furthest slide the learner has reached in
  // this course — the tutor must not teach past it unless explicitly asked.
  // The LAST-viewed index is saved too, so a resumed session reopens on the
  // exact slide the learner left (task 47).
  const furthestSlideRef = useRef(0)
  useEffect(() => {
    if (!activeCourse?.id) return
    const key = `synapse-progress-${activeCourse.id}`
    try {
      const saved = Number(localStorage.getItem(key) ?? 0)
      furthestSlideRef.current = Math.max(saved, currentSlideIndex)
      localStorage.setItem(key, String(furthestSlideRef.current))
      localStorage.setItem(`synapse-lastslide-${activeCourse.id}`, String(currentSlideIndex))
    } catch { /* storage unavailable */ }
  }, [activeCourse?.id, currentSlideIndex])

  // Session restore (task 47): resuming a course conversation must bring the
  // slides and their controls back, positioned on the slide the learner was
  // on — not a slide-less chat with missing icons. Keys off activeCourseId
  // (the persisted string), NOT the activeCourse object — the object is
  // rehydrated asynchronously from IndexedDB and losing that race used to
  // leave a resumed session slide-less.
  const restoredActiveCourseId = useAppStore((s) => s.activeCourseId)
  useEffect(() => {
    let cancelled = false
    const courseId = activeCourse?.id ?? restoredActiveCourseId
    if (!courseId || activeSlides.length > 0) return
    ;(async () => {
      const slides = isLocalCourse(courseId) ? await getLocalSlides(courseId) : []
      if (cancelled || slides.length === 0) return
      setActiveSlides(slides)
      try {
        const last = Number(localStorage.getItem(`synapse-lastslide-${courseId}`) ?? 0)
        if (last > 0 && last < slides.length) setCurrentSlideIndexRaw(last)
      } catch { /* storage unavailable */ }
    })()
    return () => { cancelled = true }
  }, [activeCourse?.id, restoredActiveCourseId, activeSlides.length, setActiveSlides, setCurrentSlideIndexRaw])

  // Slide Player dual mode (task 31, C18): Original shows every page;
  // Compact walks only the teaching sequence from the normalizer — title,
  // references, lecturer and admin pages are skipped during navigation.
  const [slideViewMode, setSlideViewMode] = useState<'original' | 'compact'>('original')
  const compactSet = useMemo(() => {
    if (!structuredDoc || structuredDoc.compact.length === 0) return null
    return new Set(structuredDoc.compact.map((id) => Number(id.split('_')[1]) - 1))
  }, [structuredDoc])

  // Atomic teaching units by default (task 65): once the normalizer's compact
  // sequence exists, teaching walks it automatically — admin/title/lecturer
  // pages are cleaned out unless the learner toggles back to Original.
  // Adjust-during-render pattern (runs once per course).
  const [autoCompactedFor, setAutoCompactedFor] = useState<string | null>(null)
  if (compactSet && activeCourse?.id && autoCompactedFor !== activeCourse.id) {
    setAutoCompactedFor(activeCourse.id)
    setSlideViewMode('compact')
  }

  // Slide navigation is non-blocking (B11): the heavy re-render of this view
  // (slide text, markdown, highlights) runs as a transition, so the tap that
  // triggered it never freezes — the button stays responsive and the slide
  // swaps in when ready. In Compact mode, landing on a non-teaching page
  // snaps to the nearest teaching page in the direction of travel.
  const setCurrentSlideIndex = useCallback((index: number) => {
    let target = index
    if (slideViewMode === 'compact' && compactSet && !compactSet.has(target)) {
      const total = useAppStore.getState().activeSlides.length
      const dir = target >= useAppStore.getState().currentSlideIndex ? 1 : -1
      let t = target
      while (t >= 0 && t < total && !compactSet.has(t)) t += dir
      if (t < 0 || t >= total) {
        t = target
        while (t >= 0 && t < total && !compactSet.has(t)) t -= dir
      }
      if (t >= 0 && t < total) target = t
    }
    startTransition(() => setCurrentSlideIndexRaw(target))
  }, [setCurrentSlideIndexRaw, slideViewMode, compactSet])

  // First meaningful concept (task 65): a fresh course (no saved position)
  // opens on the first teaching page, not the deck's title/admin page.
  const firstConceptAppliedRef = useRef<string | null>(null)
  useEffect(() => {
    const courseId = activeCourse?.id
    if (!courseId || !compactSet || activeSlides.length === 0) return
    if (firstConceptAppliedRef.current === courseId) return
    firstConceptAppliedRef.current = courseId
    let saved = 0
    try { saved = Number(localStorage.getItem(`synapse-lastslide-${courseId}`) ?? 0) } catch { /* storage unavailable */ }
    const idx = useAppStore.getState().currentSlideIndex
    if (saved === 0 && idx === 0 && !compactSet.has(0)) {
      const first = Math.min(...compactSet)
      if (Number.isFinite(first)) setCurrentSlideIndexRaw(first)
    }
  }, [activeCourse?.id, compactSet, activeSlides.length, setCurrentSlideIndexRaw])

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

  // Pomodoro tick — stops itself the instant it hits 0, from inside the
  // interval callback, instead of a second effect just watching for that.
  useEffect(() => {
    if (pomodoroRunning) {
      pomodoroRef.current = setInterval(() => {
        setPomodoroTimeLeft((prev) => {
          if (prev <= 1) {
            playBeep()
            toast.success(`${currentPomodoroMode.label} session complete!`)
            setPomodoroRunning(false)
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

  // Re-open the mobile fullscreen overlay when Slide mode is picked.
  // Hybrid on phones uses the draggable split instead — no overlay.
  useEffect(() => {
    if (tutorMode === 'slide') {
      queueMicrotask(() => setMobileSlidesOpen(true))
    }
  }, [tutorMode])

  // Quick topic suggestions derived from the user's real courses
  // Dedupe: users can have multiple courses with the same title
  const quickTopics = useMemo(() => [...new Set(courses.map((c) => c.title))].slice(0, 5), [courses])

  // Most recent quiz/flashcard deck the AI produced — powers the Practice
  // panel and the cards-first tutor mode
  const latestQuiz = useMemo(() => {
    const lastAssistantWithQuiz = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && parseQuizPayload(m.content))
    if (!lastAssistantWithQuiz) return null
    const q = parseQuizPayload(lastAssistantWithQuiz.content)
    return q ? { payload: q.payload, messageId: lastAssistantWithQuiz.id } : null
  }, [messages])

  // When a deck exists and the right panel is open, it answers on the side
  const quizShownAside = latestQuiz !== null && rightPanelOpen && tutorMode !== 'cards'

  // Initialize session on mount — RESUME, never wipe. Leaving the page and
  // coming back continues the conversation; a blank slate only happens via
  // the New-session button.
  useEffect(() => {
    if (!activeSessionId) {
      const state = useAppStore.getState()
      if (state.messages.length > 0) {
        // Restored conversation (from localStorage) — attach a session id
        // WITHOUT calling setActiveSession, which would clear the messages
        useAppStore.setState({ activeSessionId: crypto.randomUUID() })
        return
      }
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

  // On (re)entry with an existing conversation, restore the saved scroll
  // position for this session (B6) — fall back to the latest exchange.
  useEffect(() => {
    const el = scrollRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
    if (el && useAppStore.getState().messages.length > 1) {
      const sid = useAppStore.getState().activeSessionId
      const saved = sid ? sessionStorage.getItem(`synapse-chat-scroll-${sid}`) : null
      queueMicrotask(() => {
        el.scrollTop = saved != null ? Number(saved) : el.scrollHeight
      })
    }
    // mount-only: resuming a session should land where the user left off
  }, [])

  // Track whether the user is pinned to the bottom; persist position per
  // session (B6) and drive the floating scroll-to-bottom button (D19).
  const [isAtBottom, setIsAtBottom] = useState(true)
  const isAtBottomRef = useRef(true)
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
    if (!viewport) return
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80
      isAtBottomRef.current = atBottom
      setIsAtBottom(atBottom)
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        const sid = useAppStore.getState().activeSessionId
        if (sid) sessionStorage.setItem(`synapse-chat-scroll-${sid}`, String(viewport.scrollTop))
      }, 250)
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(saveTimer)
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [])

  const scrollToBottom = useCallback((smooth = true) => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
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
        // Respect a deliberate scroll-up (B7): while the user is reading
        // history, new tokens/messages must not yank the view down. The
        // floating button is their way back.
        if (!isAtBottomRef.current && last?.role === 'assistant') return
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

  // Returning to this view: land on the newest message without manual
  // scrolling. The mount-time scroll above fires before the page transition
  // (~300ms) finishes laying out, so re-pin once afterwards.
  useEffect(() => {
    const t = setTimeout(() => {
      const viewport = scrollRef.current?.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
      if (!viewport) return
      const sid = useAppStore.getState().activeSessionId
      const saved = sid ? sessionStorage.getItem(`synapse-chat-scroll-${sid}`) : null
      // Re-apply the restored position (B6) or pin to bottom, after the page
      // transition finishes laying out.
      viewport.scrollTo({ top: saved != null ? Number(saved) : viewport.scrollHeight })
    }, 380)
    return () => clearTimeout(t)
  }, [])

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
      // Check the ref, not voiceState: this closure captures voiceState from
      // when the timer was armed, so the state check never saw 'listening'
      if (speechRef.current) {
        speechRef.current.stop()
      }
    }, 5000)
  }, [])

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
      // Whisper fallback recording in progress? Stop and transcribe it.
      if (whisperRecRef.current) {
        const rec = whisperRecRef.current
        whisperRecRef.current = null
        setVoiceState('processing')
        void rec.stop().then((text) => {
          if (text) {
            setInput((prev) => {
              const base = prev.endsWith(' ') ? prev : prev ? prev + ' ' : ''
              const combined = base + text
              return combined.length > MAX_INPUT_CHARS ? combined.slice(0, MAX_INPUT_CHARS) : combined
            })
          } else {
            toast.error("Couldn't make out any speech — try again closer to the mic.")
          }
          setVoiceState('idle')
        })
        return
      }
      stopVoice()
      return
    }

    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      // Whisper STT fallback (task 50): record with MediaRecorder, transcribe
      // in-browser with whisper-base — voice input works on Firefox too.
      if (whisperSupported()) {
        setVoiceState('listening')
        void startWhisperRecording()
          .then((rec) => { whisperRecRef.current = rec })
          .catch(() => {
            setVoiceState('error')
            toast.error('Microphone access is blocked — allow the mic for this site.')
            setTimeout(() => setVoiceState('idle'), 2000)
          })
        return
      }
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
      // Snapshot whatever was already typed so dictation appends to it.
      const cur = textareaRef.current?.value ?? ''
      voiceBaseRef.current = cur ? (cur.endsWith(' ') ? cur : cur + ' ') : ''
      voiceFinalRef.current = ''
      resetSilenceTimer()
    }

    recognition.onresult = (event: SpeechRecognitionEventType) => {
      resetSilenceTimer()
      // Show interim words LIVE (real-time, like voice mode): finalized speech
      // accumulates; the current interim guess renders on top and is replaced
      // as you keep talking — no waiting for each phrase to finalize.
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) voiceFinalRef.current += result[0].transcript + ' '
        else interim += result[0].transcript
      }
      const combined = (voiceBaseRef.current + voiceFinalRef.current + interim).slice(0, MAX_INPUT_CHARS)
      setInput(combined)
    }

    recognition.onerror = (event: { error: string }) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setVoiceState('idle')
        return
      }
      const friendly: Record<string, string> = {
        'not-allowed': 'Microphone access is blocked — allow the mic for this site in your browser settings.',
        'service-not-allowed': 'Voice recognition is disabled by your browser. Try Chrome or Edge.',
        'audio-capture': 'No microphone found. Plug one in or check your input settings.',
        network: 'Voice recognition needs an internet connection and is only available in some browsers (Chrome/Edge work best).',
        'language-not-supported': 'This language is not supported for voice input.',
      }
      setVoiceState('error')
      toast.error(friendly[event.error] || `Voice input failed (${event.error}). Try again or type instead.`)
      setTimeout(() => setVoiceState('idle'), 2000)
    }

    recognition.onend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      // Commit base + finalized speech, dropping any dangling interim guess.
      const finalCombined = (voiceBaseRef.current + voiceFinalRef.current).trim().slice(0, MAX_INPUT_CHARS)
      setInput(finalCombined)
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
      whisperRecRef.current?.cancel()
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
      }
    }
  }, [])

  // Voice input works with SpeechRecognition OR the Whisper fallback (task 50)
  const speechSupported = useMemo(
    () => typeof window !== 'undefined' && (!!getSpeechRecognition() || whisperSupported()),
    [],
  )

  // AI-initiated quiz navigation (A4): when the tutor answers with an
  // "exam"-mode quiz block, the app switches to the quiz view immediately,
  // initialized with those questions — no manual navigation. The questions
  // also join the slide's bank (provenance "tutor") for the shared pool (A7).
  const maybeStartExam = useCallback((responseText: string) => {
    const parsed = parseQuizPayload(responseText)
    if (parsed?.payload.mode !== 'exam') return
    const courseId = activeCourse?.id
    const slideId = activeSlides[currentSlideIndex]?.id
    const converted: Question[] = parsed.payload.questions.map((q) => ({
      id: crypto.randomUUID(),
      courseId,
      slideId,
      type: 'multiple_choice' as const,
      question: q.question,
      options: q.options,
      answer: q.options[q.answerIndex],
      explanation: q.explanation,
      concept: q.concept,
      difficulty: 'medium' as const,
      provenance: 'tutor' as const,
    }))
    if (converted.length === 0) return
    if (courseId) {
      const cache = loadQuestionCache(courseId)
      appendToQuestionCache(courseId, converted, cache?.sectionsDone ?? 0, cache?.sectionsTotal ?? null)
    }
    setCurrentQuestions(converted)
    toast(`Starting your quiz${parsed.payload.title ? `: ${parsed.payload.title}` : ''}…`)
    navigate('quiz')
  }, [activeCourse, activeSlides, currentSlideIndex, setCurrentQuestions, navigate])

  const handleSend = useCallback(async (text?: string) => {
    const content = (text || input).trim()
    if (!content) return
    // Request state machine (B9): one in-flight request, no duplicate sends
    if (!useAppStore.getState().canSendChat()) return

    // Clears the "thinking" indicator + request lock — used by the early-return
    // branches below (navigate/quiz/advance) that show the indicator during the
    // orchestrator round-trip but never reach the streaming chat path.
    const resetSendState = () => {
      setLoading(false)
      useAppStore.getState().setChatRequestStatus('idle')
    }

    // Tutor navigation (task 66): "next" / "next slide" / "continue" advances
    // to the next atomic teaching unit without calling the AI, updates the
    // tutor context, and begins explaining the new unit immediately.
    if (/^(next( slide)?|continue|n)$/i.test(content) && activeSlides.length > 0) {
      setInput('')
      let nxt = currentSlideIndex + 1
      if (slideViewMode === 'compact' && compactSet) {
        while (nxt < activeSlides.length && !compactSet.has(nxt)) nxt++
      }
      if (nxt < activeSlides.length) {
        setCurrentSlideIndex(nxt)
        toast(`Slide ${nxt + 1}/${activeSlides.length}: ${activeSlides[nxt]?.title ?? ''}`)
        useAppStore.getState().setPendingSlideExplain(nxt)
      } else {
        toast('Already on the last slide')
      }
      return
    }

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

    // Bank-first question interceptor (task 43): "give me 20 questions on
    // slide 8" is served by CODE from the question bank — unused questions
    // first, background top-up for the shortfall — never by asking the LLM
    // to write quiz JSON. The LLM is only involved when the bank is empty,
    // and even then through the validated /api/questions path.
    let questionIntent = parseQuestionIntent(content)
    // Retry after a failed generation: "generate the questions again",
    // "try again", "retry" — re-run the exact same request (same count,
    // same slide) through the bank-first path.
    if (!questionIntent && lastFailedQuizIntentRef.current && /\b(again|retry|regenerate|once more|one more time)\b/i.test(content)) {
      questionIntent = lastFailedQuizIntentRef.current
      lastFailedQuizIntentRef.current = null
    }
    // Pending "how many?" (task 57): the previous turn was a quiz request
    // without a count — a bare number (or "N questions") now answers it.
    if (!questionIntent && pendingQuizAskRef.current) {
      const numMatch = content.match(/\b(\d{1,3})\b/)
      if (numMatch) {
        questionIntent = {
          count: Math.min(Math.max(parseInt(numMatch[1], 10), 1), 50),
          explicitCount: true,
          slideNumber: pendingQuizAskRef.current.slideNumber,
          flashcards: false,
          review: false,
        }
      }
      pendingQuizAskRef.current = null
    }
    if (questionIntent && activeCourse && !questionIntent.explicitCount) {
      // Controlled generation (task 12/57): ask before generating anything
      pendingQuizAskRef.current = { slideNumber: questionIntent.slideNumber }
      addMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: `Happy to quiz you${questionIntent.slideNumber ? ` on slide ${questionIntent.slideNumber}` : ' on this slide'}! How many questions do you want? (e.g. 5, 10, 20)`,
        createdAt: new Date().toISOString(),
      })
      return
    }
    if (questionIntent && activeCourse) {
      const slideIdx = questionIntent.slideNumber != null && questionIntent.slideNumber >= 1 && questionIntent.slideNumber <= activeSlides.length
        ? questionIntent.slideNumber - 1
        : currentSlideIndex
      const slide = activeSlides[slideIdx]
      const slideLabel = slide ? `slide ${slideIdx + 1}` : 'your course'
      // Slide-grounded bank first, whole-course unused pool as fallback.
      // Answered questions are NEVER reused (task 70) unless the learner
      // explicitly asked for a review — shortfalls generate fresh ones.
      const slideBank = slide ? getSlideBank(activeCourse.id, slide.id) : { unused: [], used: [] }
      const courseBank = getSlideBank(activeCourse.id)
      const pool = questionIntent.review
        ? [...slideBank.unused, ...slideBank.used]
        : slideBank.unused
      const fallback = courseBank.unused.filter((q) => !pool.includes(q))
      const available = [...pool, ...fallback]
      const wanted = questionIntent.count
      const have = available.slice(0, wanted)

      // Tutor-initiated session (task 57): the quiz page offers "Return to
      // Tutor" and the results come back here for a debrief
      const markTutorQuiz = () => useAppStore.getState().setTutorQuizContext({
        sessionId,
        courseId: activeCourse.id,
        slideId: slide?.id,
        slideIndex: slideIdx,
      })

      const sessionMsg = (text: string) => addMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant' as const,
        content: text,
        createdAt: new Date().toISOString(),
      })

      if (have.length >= Math.min(wanted, 3)) {
        setCurrentQuestions(have)
        const topUp = wanted - have.length
        sessionMsg(
          topUp > 0
            ? `Loaded ${have.length} questions from your bank for ${slideLabel} — generating the remaining ${topUp} in the background. Opening the quiz…`
            : `${have.length} questions ready for ${slideLabel} — opening the quiz…`,
        )
        if (topUp > 0 && slide) {
          void requestSlideQuestions(activeCourse.id, slide.id, slide.content ?? '', topUp)
        }
        markTutorQuiz()
        navigate('quiz')
        return
      }

      // Bank empty for this request: one slide-grounded generation pass
      const genId = crypto.randomUUID()
      addMessage({ id: genId, sessionId, role: 'assistant', content: `Generating ${wanted} questions for ${slideLabel} — a few seconds…`, createdAt: new Date().toISOString() })
      const added = slide
        ? await requestSlideQuestions(activeCourse.id, slide.id, slide.content ?? '', wanted)
        : []
      const ready = [...have, ...added].slice(0, wanted)
      if (ready.length > 0) {
        setCurrentQuestions(ready)
        updateMessage(genId, `Ready — ${ready.length} questions for ${slideLabel}. Opening the quiz…`)
        markTutorQuiz()
        navigate('quiz')
      } else {
        // Remember the request so "generate them again" retries it exactly
        lastFailedQuizIntentRef.current = questionIntent
        updateMessage(genId, `I couldn't generate the ${wanted} questions right now — the model may be busy. Say **again** to retry, or check your OpenRouter key in Settings.`)
      }
      return
    }

    // Orchestrator loop (tasks 51/78, CR22 full wiring): EVERY turn that
    // reaches the AI is routed through the orchestrator first. Deterministic
    // interceptors above (question counts, "next", bank-first) still win —
    // the orchestrator only sees what code didn't already handle. Its
    // decision either triggers a code action (navigate/quiz/advance) or
    // shapes the tutor's reply (remediate/motivate/break/assess/review) —
    // it never generates learner-facing content itself. A 4s timeout keeps
    // it off the critical path: any failure falls through to plain chat.
    // Show the thinking indicator NOW — the orchestrator round-trip below (up
    // to 4s) must not delay it, or the chat feels frozen for seconds after the
    // user hits send. Early-return branches call resetSendState() to clear it.
    setLoading(true)
    useAppStore.getState().setChatRequestStatus('sending')

    let orchestratorHint: string | null = null
    try {
      // Maintain the continuity blob's inputs client-side (D28): struggle
      // streak from the repeated-question detector, rolling digest of turns.
      const prevState = (orchestratorStateRef.current ?? {}) as { struggleStreak?: number; digest?: string }
      const struggling = detectRepeatedQuestion(content, messages)
      orchestratorStateRef.current = {
        ...prevState,
        version: 1,
        struggleStreak: struggling ? (prevState.struggleStreak ?? 0) + 1 : 0,
        digest: `${prevState.digest ?? ''}\nU: ${content.slice(0, 80)}`.slice(-600),
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const res = await aiFetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: content,
          state: orchestratorStateRef.current,
          // System authority (task 78): the orchestrator sees the app's
          // real state — assembled by code, not by the model
          app: snapshotSummary(buildAppSnapshot()),
          topic: activeTopic || activeCourse?.title,
          slide: activeSlides.length > 0
            ? { index: currentSlideIndex + 1, total: activeSlides.length, title: activeSlides[currentSlideIndex]?.title, kind: structuredDoc?.pages[currentSlideIndex]?.kind }
            : undefined,
        }),
      })
      clearTimeout(timer)
      if (res.ok) {
        const data = await res.json()
        if (data.state) orchestratorStateRef.current = data.state
        const KNOWN_VIEWS = ['dashboard', 'courses', 'quiz', 'upload', 'notes', 'focus-timer', 'profile', 'leaderboard', 'settings']
        const target = typeof data.target === 'string' ? data.target : ''

        if ((data.decision === 'navigate' || data.decision === 'tool') && KNOWN_VIEWS.includes(target)) {
          // "Take me to the quiz" must arrive at a READY quiz, not a bare
          // page — go through the shared launch service (bank → stored →
          // generate) and only announce success when it worked.
          if (target === 'quiz' && activeCourse) {
            addMessage({ id: crypto.randomUUID(), sessionId, role: 'assistant', content: 'Setting up your quiz —', createdAt: new Date().toISOString() })
            // Register the session so the results come back for a debrief
            useAppStore.getState().setTutorQuizContext({
              sessionId,
              courseId: activeCourse.id,
              slideId: activeSlides[currentSlideIndex]?.id,
              slideIndex: currentSlideIndex,
            })
            const result = await launchQuiz({ courseId: activeCourse.id })
            if (!result.ok) {
              useAppStore.getState().setTutorQuizContext(null)
              addMessage({ id: crypto.randomUUID(), sessionId, role: 'assistant', content: result.reason || 'The quiz could not be prepared — try again in a moment.', createdAt: new Date().toISOString() })
            }
            resetSendState()
            return
          }
          addMessage({ id: crypto.randomUUID(), sessionId, role: 'assistant', content: `Taking you to ${target.replace('-', ' ')} —`, createdAt: new Date().toISOString() })
          navigate(target)
          resetSendState()
          return
        }

        // "Test me properly" that the code interceptor didn't catch — enter
        // the SAME controlled flow: ask for a count, then bank-first (task 12/57)
        if (data.decision === 'quiz' && activeCourse) {
          pendingQuizAskRef.current = { slideNumber: null }
          addMessage({ id: crypto.randomUUID(), sessionId, role: 'assistant', content: 'Happy to test you on this slide! How many questions do you want? (e.g. 5, 10, 20)', createdAt: new Date().toISOString() })
          resetSendState()
          return
        }

        // "Got it, let's move on" — advance to the next teaching unit and
        // start explaining, exactly like typing "next" (task 66)
        if (data.decision === 'advance' && activeSlides.length > 0) {
          let nxt = currentSlideIndex + 1
          if (slideViewMode === 'compact' && compactSet) {
            while (nxt < activeSlides.length && !compactSet.has(nxt)) nxt++
          }
          if (nxt < activeSlides.length) {
            setCurrentSlideIndex(nxt)
            toast(`Slide ${nxt + 1}/${activeSlides.length}: ${activeSlides[nxt]?.title ?? ''}`)
            useAppStore.getState().setPendingSlideExplain(nxt)
            resetSendState()
            return
          }
          // Last slide — fall through to chat with a review hint instead
          orchestratorHint = 'review'
        }

        // Reply-shaping decisions ride into /api/chat as a hint
        if (['remediate', 'review', 'motivate', 'break', 'assess'].includes(data.decision)) {
          orchestratorHint = data.decision
        }
      }
    } catch { /* orchestrator unavailable/slow — normal chat handles it */ }

    setLoading(true)
    useAppStore.getState().setChatRequestStatus('sending')

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      const res = await aiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          // Stream tokens as the model produces them (ChatGPT-style)
          stream: true,
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
          // The tutor always knows what the learner is looking at. If the
          // message mentions another slide by number ("back on slide 4"),
          // code detects it and sends that slide too — the model gets the
          // material even if it fell out of the conversation window.
          // Context awareness (B10): if this message closely repeats an earlier
          // question, tell the tutor so it tries a different angle
          struggleSignal: detectRepeatedQuestion(content, messages),
          // Orchestrator reply-shaping (task 78): remediate/review/motivate/
          // break/assess — decided by the fast role, rendered by the tutor
          orchestratorDecision: orchestratorHint ?? undefined,
          // "How did I do?" (task 57): the most recent finished quiz rides
          // along on every message — read from the recorded sessions, so the
          // tutor knows the score even for quizzes it didn't launch itself.
          lastQuizResult: (() => {
            try {
              const raw = localStorage.getItem('synapse-quiz-sessions')
              const sessions = raw ? (JSON.parse(raw) as Array<{ correct: number; total: number; completedAt: string }>) : []
              const last = sessions[sessions.length - 1]
              return last ? { correct: last.correct, total: last.total, completedAt: last.completedAt } : undefined
            } catch { return undefined }
          })(),
          slideContext: activeSlides.length > 0
            ? (() => {
                const refIdx = detectSlideReference(content, activeSlides.length, currentSlideIndex);
                return {
                  courseTitle: activeCourse?.title,
                  index: currentSlideIndex + 1,
                  total: activeSlides.length,
                  // Atomic teaching unit position (task 64): "which slide are
                  // we on?" answers with both slide and unit numbering
                  unit: compactSet
                    ? {
                        index: [...compactSet].filter((i) => i <= currentSlideIndex).length,
                        total: compactSet.size,
                      }
                    : undefined,
                  title: activeSlides[currentSlideIndex]?.title,
                  // Slide purpose from the normalizer (A10) + learning boundary (B16)
                  kind: structuredDoc?.pages[currentSlideIndex]?.kind,
                  furthestIndex: Math.max(furthestSlideRef.current, currentSlideIndex) + 1,
                  content: (activeSlides[currentSlideIndex]?.content || '').slice(0, 1800),
                  referenced: refIdx != null
                    ? {
                        index: refIdx + 1,
                        title: activeSlides[refIdx]?.title,
                        content: (activeSlides[refIdx]?.content || '').slice(0, 1200),
                      }
                    : undefined,
                };
              })()
            : activeSlideContent
              ? { courseTitle: activeCourse?.title, content: activeSlideContent.slice(0, 1800) }
              : undefined,
        }),
      })

      if (!res.ok) throw new Error('Failed to get response')

      // Keyless-fallback nudge: if the reply came from the free floor (no key /
      // rate-limited / models down), tell the learner how to get full quality.
      if (res.headers.get('X-AI-Degraded') === '1') {
        const msg = degradedNoticeMessage(res.headers.get('X-AI-Degraded-Reason'))
        if (msg) toast(msg, { icon: '⚠️', duration: 9000 })
      }

      const contentType = res.headers.get('Content-Type') || ''
      if (res.body && contentType.includes('text/plain')) {
        // Streaming path: grow the assistant message token by token
        const assistantId = crypto.randomUUID()
        addMessage({
          id: assistantId,
          sessionId,
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
        })
        useAppStore.getState().setChatRequestStatus('streaming')
        let firstChunk = true
        let acc = ''
        try {
          acc = await readStreamWithWatchdog(res.body, {
            onChunk: (accumulated) => {
              acc = accumulated
              if (firstChunk && accumulated.trim()) {
                // Swap the typing indicator for the live-growing message
                setLoading(false)
                firstChunk = false
              }
              updateMessage(assistantId, accumulated)
            },
          })
        } catch (err) {
          if (err instanceof StreamStalledError) {
            // Watchdog fired (B8): keep whatever arrived, tell the user plainly
            updateMessage(
              assistantId,
              acc.trim()
                ? `${acc.trimEnd()}\n\n*(The response stalled and was cut short — ask me to continue.)*`
                : "The response timed out before it started. Please try again.",
            )
            toast.error(err.message)
            return
          }
          throw err
        }
        // Corruption repair + formatting normalization on the final text (B1/B2)
        const report = cleanResponse(acc)
        const finalText = report.discard || !report.text.trim()
          ? "I'm sorry, I couldn't generate a readable response. Please try again."
          : report.text
        updateMessage(assistantId, finalText)
        maybeStartExam(finalText)
      } else {
        const data = await res.json()
        if (data.degraded) {
          const msg = degradedNoticeMessage(data.degradedReason)
          if (msg) toast(msg, { icon: '⚠️', duration: 9000 })
        }
        const rawText = data.response || data.message || data.content || ''
        const report = cleanResponse(rawText)
        const responseText = report.discard || !report.text.trim()
          ? "I'm sorry, I couldn't generate a response. Please try again."
          : report.text

        addMessage({
          id: crypto.randomUUID(),
          sessionId,
          role: 'assistant',
          content: responseText,
          createdAt: new Date().toISOString(),
        })
        maybeStartExam(responseText)
      }

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
      // Every exit path lands back on idle — the composer can never lock (B9)
      useAppStore.getState().setChatRequestStatus('idle')
    }
  }, [input, activeSessionId, messages, learnerProfile, masteryMap, addMessage, updateMessage, setActiveSession, setLoading, setSessionPhase, activePersona, moodSettings, activeTopic, activeCourse, userName, tips, feedbackItems, settings.responseSpeed, settings.language, hardSubjects, alwaysConfuses, bestTeachingStyle, activeSlides, currentSlideIndex, activeSlideContent, maybeStartExam, structuredDoc, slideViewMode, compactSet, setCurrentSlideIndex])

  // Revision mode: SessionControls sets the phase to 'review', then this sends
  // a visible revision request through the normal chat path
  const handleRevisionRequest = useCallback(() => {
    handleSend("Let's revise what we've covered so far")
  }, [handleSend])

  // Tutor navigation (task 66): a queued "teach this unit" request — set by
  // the slide list in CourseDetail or by "next"/"continue" above — fires as
  // soon as the slide index has caught up, so the explanation always grounds
  // in the unit the learner just moved to. handleSend goes through a ref to
  // keep this effect from re-firing on every render.
  const handleSendRef = useRef(handleSend)
  useEffect(() => { handleSendRef.current = handleSend }, [handleSend])
  const pendingSlideExplain = useAppStore((s) => s.pendingSlideExplain)
  useEffect(() => {
    if (pendingSlideExplain == null || activeSlides.length === 0) return
    if (currentSlideIndex !== pendingSlideExplain) return
    if (!useAppStore.getState().canSendChat()) return
    useAppStore.getState().setPendingSlideExplain(null)
    handleSendRef.current('Teach me this slide.')
  }, [pendingSlideExplain, currentSlideIndex, activeSlides.length])

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
    // Local-first courses live in this browser's IndexedDB, not the server
    if (isLocalCourse(course.id)) {
      const slides = await getLocalSlides(course.id)
      if (slides.length > 0) setActiveSlides(slides)
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

  // New session: archive the current thread per course, then a clean page
  const handleNewSession = useCallback(() => {
    const state = useAppStore.getState()
    const sessionId = crypto.randomUUID()
    state.setActiveSession(sessionId)
    useAppStore.setState({ messages: [] })
    addMessage({
      id: crypto.randomUUID(),
      sessionId,
      role: 'assistant',
      content: `Fresh session${userName ? ', ' + userName : ''}! What shall we learn now?`,
      createdAt: new Date().toISOString(),
    })
  }, [addMessage, userName])

  // Scroll to starred message handler
  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Header - Frosted glass */}
      <header className="glass-header flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Title stays for screen readers only — the header is for controls */}
          <h1 className="sr-only">{activeTopic || 'AI Tutor'}</h1>
          <Badge variant="secondary" className={`${getPhaseColor(sessionPhase)} shrink-0 hidden sm:inline-flex`}>
            {sessionPhase}
          </Badge>
          {/* Mode Selector — pill sizes itself to the active button */}
          <div className="hidden sm:flex items-center rounded-lg border border-border bg-background/50 p-0.5">
            {TUTOR_MODES.filter((m) => activeSlides.length > 0 || (m.id !== 'slide' && m.id !== 'hybrid')).map((mode) => {
              const Icon = mode.icon
              const isActive = tutorMode === mode.id
              return (
                <Tooltip key={mode.id} delayDuration={400}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setTutorMode(mode.id)}
                      className={`relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        isActive
                          ? 'text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
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
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                    {mode.desc}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          {/* Mode Selector — phones: icon-only so it fits the header */}
          <div className="flex sm:hidden items-center rounded-lg border border-border bg-background/50 p-0.5">
            {TUTOR_MODES.filter((m) => activeSlides.length > 0 || (m.id !== 'slide' && m.id !== 'hybrid')).map((mode) => {
              const Icon = mode.icon
              const isActive = tutorMode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => setTutorMode(mode.id)}
                  className={`relative flex items-center justify-center rounded-md p-1.5 transition-colors ${
                    isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                  }`}
                  aria-label={mode.label}
                  title={mode.desc}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Phones: New session / History / Upload collapse into one ... menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setVoiceModeOpen(true)}>
                  <AudioLines className="w-3.5 h-3.5 mr-2" /> Voice mode
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleNewSession}>
                  <SquarePen className="w-3.5 h-3.5 mr-2" /> New session
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                  <History className="w-3.5 h-3.5 mr-2" /> History
                </DropdownMenuItem>
                {quickTopics.length === 0 && !activeTopic && (
                  <DropdownMenuItem onClick={() => navigate('upload')}>
                    <BookOpen className="w-3.5 h-3.5 mr-2" /> Upload slides
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* New session — a clean page, current chat stays archived per course */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex h-8 w-8"
            title="Start a new session"
            aria-label="Start a new session"
            onClick={handleNewSession}
          >
            <SquarePen className="w-4 h-4" />
          </Button>
          {/* History — fullscreen overlay: search, resume, delete */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex h-8 w-8"
            title="Session history"
            aria-label="Session history"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="w-4 h-4" />
          </Button>
          {/* Upload prompt lives up here, not inside the chat thread */}
          {quickTopics.length === 0 && !activeTopic && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex h-7 rounded-full text-xs gap-1.5 px-2.5"
              onClick={() => navigate('upload')}
              title="Upload slides to get topic suggestions"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Upload slides</span>
            </Button>
          )}
          {/* Collapsible Pomodoro Timer */}
          <div className="relative">
            <button
              onClick={() => setPomodoroExpanded(!pomodoroExpanded)}
              className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full border border-border glass hover:bg-accent/50 transition-colors"
              aria-label="Toggle Pomodoro timer"
            >
              <svg width="20" height="20" className="-rotate-90">
                {/* Track tinted with foreground so the ring reads as a ring even
                    at 0% progress — muted/30 was invisible and left a blank gap */}
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground/40"
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
                  className="absolute top-full right-0 mt-2 z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border bg-card p-4 shadow-lg space-y-3"
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
                          className={`flex-1 flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-all ${
                            pomodoroModeIndex === i
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <Icon className="w-3 h-3 shrink-0" />
                          <span className="whitespace-nowrap">{mode.label}</span>
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
                          className="text-muted-foreground/25"
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

          {/* Session stats: message count + elapsed time, in one pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 glass text-xs text-muted-foreground">
            <MessageCircle className="w-3 h-3 text-emerald-500" />
            <span className="font-mono font-medium tabular-nums">{messages.length}</span>
            <span className="text-muted-foreground/60">·</span>
            <Clock className="w-3 h-3 text-emerald-500" />
            <span className="font-mono font-medium tabular-nums">{formatTimer(timerSeconds)}</span>
          </div>
          {/* Voice conversation mode — talk, get spoken answers, interrupt.
              Phones use the "…" menu's Voice mode item instead, so hide this
              standalone button below sm to avoid a duplicate voice icon. */}
          <motion.div className="hidden sm:block" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setVoiceModeOpen(true)}
              className="gradient-border rounded-lg"
              aria-label="Start voice conversation"
              title="Voice mode — talk with the tutor"
            >
              <AudioLines className="w-4 h-4" />
            </Button>
          </motion.div>
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
          {/* Study Soundscapes — desktop only; the ... menu keeps phones tight */}
          <div className="hidden sm:block">
            <StudySoundscapes />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Break overlay: fullscreen countdown that survives app restarts */}
        {/* Session history: fullscreen overlay — search, click to resume, delete */}
        {historyOpen && (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <div className="flex items-center justify-between gap-2 p-3 border-b">
              <div className="flex items-center gap-2 min-w-0">
                <History className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold">Session History</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistoryOpen(false)} aria-label="Close history">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-3 border-b">
              <Input
                placeholder="Search conversations..."
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                className="h-9 text-sm placeholder:text-xs"
              />
            </div>
            {/* Plain scroll div: Radix ScrollArea's table wrapper let wide
                rows push past the right edge */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <div className="p-3 space-y-2 max-w-2xl mx-auto w-full">
                {(() => {
                  void historyVersion // re-list after deletes
                  const q = historyQuery.trim().toLowerCase()
                  const entries = listCourseChats()
                    .map((entry) => {
                      const course = courses.find((c) => c.id === entry.courseId)
                      const msgs = loadCourseChatMessages(entry.courseId)
                      const title = entry.courseId === 'general' ? 'General chat' : course?.title ?? 'Untitled course'
                      const lastText = [...msgs].reverse().find((m) => m.content)?.content ?? ''
                      return { ...entry, title, msgs, lastText }
                    })
                    .filter((e) =>
                      !q ||
                      e.title.toLowerCase().includes(q) ||
                      e.msgs.some((m) => m.content.toLowerCase().includes(q)),
                    )
                  if (entries.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground text-center py-10">
                        {q ? 'No conversations match your search.' : 'No archived sessions yet — your chats will appear here.'}
                      </p>
                    )
                  }
                  return entries.map((entry) => (
                    <div
                      key={entry.courseId}
                      className="flex items-start gap-2 rounded-xl border border-border/60 glass p-3 hover:border-primary/30 transition-colors min-w-0 max-w-full overflow-hidden"
                    >
                      <button
                        className="flex-1 min-w-0 text-left"
                        onClick={async () => {
                          const course = courses.find((c) => c.id === entry.courseId)
                          useAppStore.setState({
                            activeSessionId: crypto.randomUUID(),
                            activeCourseId: entry.courseId === 'general' ? null : entry.courseId,
                            activeTopic: entry.courseId === 'general' ? null : entry.title,
                            messages: entry.msgs,
                          })
                          // Bring the course's slides back too, so the Slide /
                          // Hybrid modes reappear with the resumed session
                          if (course) {
                            setActiveCourse(course)
                            if (course.slides?.length) setActiveSlides(course.slides)
                            else if (isLocalCourse(course.id)) {
                              const slides = await getLocalSlides(course.id)
                              if (slides.length > 0) setActiveSlides(slides)
                            }
                          }
                          setHistoryOpen(false)
                          toast(`Resumed ${entry.title}`)
                        }}
                      >
                        <p className="text-sm font-medium truncate">{entry.title}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.lastText}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">
                          {entry.messageCount} messages{entry.lastAt ? ` · ${new Date(entry.lastAt).toLocaleString()}` : ''}
                        </p>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${entry.title} history`}
                        title="Delete this conversation"
                        onClick={() => {
                          clearCourseChat(entry.courseId)
                          setHistoryVersion((v) => v + 1)
                          toast(`Deleted ${entry.title} history`)
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Mobile: slides as a fullscreen overlay — no split view on phones */}
        {isMobile && tutorMode === 'slide' && mobileSlidesOpen && activeSlides.length > 0 && (
          <div className="fixed inset-0 z-40 bg-background flex flex-col">
            {/* Controls on top */}
            <div className="flex items-center justify-between gap-2 p-3 border-b">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold truncate">Course Slides</span>
                <Badge variant="secondary" className="text-[10px] shrink-0 tabular-nums">
                  {currentSlideIndex + 1} / {activeSlides.length}
                </Badge>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={currentSlideIndex === 0}
                  onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={currentSlideIndex === activeSlides.length - 1}
                  onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    // Closing the slide panel returns the app to chat mode so
                    // the mode selector/nav indicator never lies (B12)
                    setMobileSlidesOpen(false)
                    setTutorMode('text')
                  }}
                  aria-label="Close slides"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {/* Slide text below */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-3">
                {activeSlides[currentSlideIndex] && (
                  <>
                    <h3 className="text-base font-semibold">{activeSlides[currentSlideIndex].title}</h3>
                    <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {activeSlides[currentSlideIndex].content}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Slide Panel - visible in slide or hybrid mode when slides exist (desktop split) */}
        <AnimatePresence initial={false}>
        {showSlidePanel && !isMobile && (
          <motion.div
            key="slide-panel"
            initial={{ width: 0, opacity: 0 }}
            // Slide mode means SLIDE: the whole page, not a half split
            animate={{ width: tutorMode === 'slide' ? '100%' : '40%', opacity: 1 }}
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
                <div className="flex items-center gap-1.5">
                  {/* Slide Player dual mode (C18): Compact walks teaching pages only */}
                  {compactSet && (
                    <button
                      onClick={() => setSlideViewMode((m) => (m === 'original' ? 'compact' : 'original'))}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        slideViewMode === 'compact'
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                      title={slideViewMode === 'compact' ? 'Compact: teaching pages only — click for all pages' : 'Original: all pages — click for teaching pages only'}
                    >
                      {slideViewMode === 'compact' ? 'Compact' : 'Original'}
                    </button>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {currentSlideIndex + 1} / {activeSlides.length}
                  </Badge>
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                {/* Slide navigation dots — non-teaching pages fade in Compact mode */}
                <div className="flex gap-1 mb-3 flex-wrap">
                  {activeSlides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlideIndex(idx)}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentSlideIndex
                          ? 'bg-primary w-6'
                          : 'bg-muted w-2 hover:bg-primary/50'
                      } ${slideViewMode === 'compact' && compactSet && !compactSet.has(idx) ? 'opacity-25' : ''}`}
                    />
                  ))}
                </div>
                {activeSlides[currentSlideIndex] && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground truncate" title={activeSlides[currentSlideIndex].title}>
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

        {/* Chat Panel — hidden entirely in slide-only mode on desktop */}
        <div className={`relative flex-1 flex flex-col min-w-0 min-h-0 ${!isMobile && tutorMode === 'slide' && activeSlides.length > 0 ? 'hidden' : ''}`}>
          {/* Mobile hybrid: slides on top, chat below, draggable divider */}
          {isMobile && tutorMode === 'hybrid' && activeSlides.length > 0 && (
            <div className="flex flex-col border-b shrink-0" style={{ height: hybridHeight + 20 }}>
              <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/40">
                <span className="text-xs font-semibold truncate flex items-center gap-1.5 min-w-0">
                  <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{activeSlides[currentSlideIndex]?.title}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentSlideIndex === 0} onClick={() => setCurrentSlideIndex(currentSlideIndex - 1)} aria-label="Previous slide">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Badge variant="secondary" className="text-[10px] tabular-nums">{currentSlideIndex + 1}/{activeSlides.length}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentSlideIndex === activeSlides.length - 1} onClick={() => setCurrentSlideIndex(currentSlideIndex + 1)} aria-label="Next slide">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {activeSlides[currentSlideIndex]?.content}
                </div>
              </div>
              {/* Drag divider: down = more slide (bottom = slide-only), up = more chat (top = chat-only) */}
              <div
                className="flex h-5 shrink-0 items-center justify-center cursor-row-resize touch-none select-none bg-background/60"
                onPointerDown={(e) => {
                  hybridDragRef.current = { startY: e.clientY, startH: hybridHeight }
                  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                }}
                onPointerMove={handleHybridDragMove}
                onPointerUp={handleHybridDragEnd}
                onPointerCancel={handleHybridDragEnd}
                role="separator"
                aria-label="Resize slides panel"
              >
                <div className="h-1 w-12 rounded-full bg-border" />
              </div>
            </div>
          )}

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
                {/* Mobile: reopen the fullscreen slide overlay any time */}
                <button
                  onClick={() => { setTutorMode('slide'); setMobileSlidesOpen(true) }}
                  className="md:hidden flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-[11px] font-medium"
                  aria-label="Open slides"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Slides
                </button>
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
            {!activeTopic && messages.length <= 1 && quickTopics.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {quickTopics.map((topic) => (
                  <Button
                    key={topic}
                    variant="outline"
                    size="sm"
                    className="rounded-full text-xs"
                    // handleTopicClick calls handleSend, which reads
                    // textareaRef.current, but only inside this onClick
                    // callback body — strictly after the click fires, never
                    // during render. The rule's call-graph analysis can't
                    // distinguish that from an unsafe render-time ref read.
                    onClick={() => handleTopicClick(topic)}
                  >
                    {topic}
                  </Button>
                ))}
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
                          onClick={() => {
                            // Name the topic explicitly when we know it — a bare
                            // "what we are studying" made the model ask back
                            const knownTopic = activeTopic || activeCourse?.title || activeSlides[currentSlideIndex]?.title
                            handleSend(knownTopic ? `Give me flashcards on ${knownTopic}` : 'Give me flashcards on what we are studying')
                          }}
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
                    onResend={msg.role === 'user' ? (content) => handleSend(content) : undefined}
                    onRecall={msg.role === 'user' ? (content) => { setInput(content); textareaRef.current?.focus() } : undefined}
                  />
                ))
            }

            {isLoading && <TypingIndicator />}
          </ScrollArea>

          {/* Floating scroll-to-bottom (D19): visible whenever the user has
              scrolled up; one tap returns to the newest message */}
          <AnimatePresence>
            {!isAtBottom && messages.length > 1 && (
              <motion.button
                key="scroll-bottom"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={() => scrollToBottom()}
                className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/95 shadow-md backdrop-blur hover:bg-accent transition-colors"
                aria-label="Scroll to latest message"
              >
                <ChevronDown className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="border-t tutor-floating-input">
            <div className="px-3 pb-3 pt-1">
              {/* Full available width minus page gutters (A2) — the textarea
                  inside flexes and wraps before the action buttons */}
              <div className="w-full max-w-5xl mx-auto">
                {/* Gradient border glow wrapper */}
                <div className="gradient-border rounded-xl">
                  {inputFocused && (
                    <motion.div
                      layoutId="input-glow"
                      className="absolute -inset-px rounded-xl bg-linear-to-r from-emerald-500/30 via-teal-500/30 to-emerald-500/30 blur-sm -z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                  {/* Relative wrapper: the textarea spans the FULL width and the
                      action cluster is pinned to the bottom-right corner, so text
                      uses the whole input instead of leaving a dead right column.
                      The textarea's bottom padding reserves the small strip the
                      buttons occupy so typed text never runs under them. */}
                  <div className="relative glass-blur-strong rounded-xl border border-border/60 p-1.5 transition-shadow duration-300">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Ask me anything..."
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      onFocus={(e) => {
                        setInputFocused(true)
                        // Keep the input above the on-screen keyboard on phones
                        setTimeout(() => e.target.scrollIntoView({ block: 'end', behavior: 'smooth' }), 300)
                      }}
                      onBlur={() => setInputFocused(false)}
                      className="resize-none w-full border-0 shadow-none focus-visible:ring-0 p-2 pb-9 text-sm bg-transparent placeholder:text-muted-foreground placeholder:text-xs sm:placeholder:text-sm placeholder:truncate"
                      style={{ minHeight: INPUT_SIZES[inputSize].minH, maxHeight: INPUT_SIZES[inputSize].maxH }}
                      rows={INPUT_SIZES[inputSize].rows}
                    />

                    {/* Character count + actions — pinned to the bottom-right corner */}
                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
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

                      {/* Quick actions — three dots beside the mic on phones */}
                      <div className="md:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                              aria-label="Quick actions"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {QUICK_ACTIONS.map((action) => (
                              <DropdownMenuItem key={action.label} onClick={() => handleSend(action.prompt)}>
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

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

                      {/* Send button */}
                      <Button
                        size="icon"
                        className={`shrink-0 h-7 w-7 rounded-lg ${input.trim() ? 'pulse-glow' : ''}`}
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isLoading || chatRequestStatus === 'sending' || chatRequestStatus === 'streaming'}
                        aria-label="Send message"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Quick actions — chips on wide screens, a single "…" menu on
                    small ones so the row never wraps */}
                <AnimatePresence>
                  {!isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="mt-2"
                    >
                      <div className="hidden md:flex flex-nowrap gap-1.5 justify-center overflow-x-auto scrollbar-none">
                        {QUICK_ACTIONS.map((action, index) => (
                          <motion.button
                            key={action.label}
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              type: 'spring',
                              stiffness: 400,
                              damping: 28,
                              delay: index * 0.06,
                            }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleSend(action.prompt)}
                            className="px-3 py-1 text-[11px] font-medium rounded-full border border-border/60 bg-background/40 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors whitespace-nowrap"
                          >
                            {action.label}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel — compact: Practice first, everything else collapsible.
            On small screens it overlays the chat as a drawer instead of being
            hidden entirely (the toggle used to silently do nothing there). */}
        {rightPanelOpen && (
          <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setRightPanelOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-background/95 backdrop-blur-xl shadow-xl border-l glass overflow-y-auto md:relative md:z-auto md:w-(--panel-w) md:max-w-none md:bg-transparent md:shadow-none md:block md:shrink-0"
            style={{ '--panel-w': `${rightPanelWidth}px` } as React.CSSProperties}
          >
            {/* Drag handle (desktop): resize the panel by its left edge */}
            <div
              onPointerDown={handlePanelResizeStart}
              className="absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize md:block hover:bg-primary/30 active:bg-primary/50 transition-colors"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize side panel"
            />
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
          </>
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
                  <div className="rounded-xl glass border border-border/40 gradient-border gradient-border-static p-3 space-y-1 card-shadow">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Duration</span>
                    </div>
                    <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                      {formatTimer(sessionStats.duration)}
                    </p>
                  </div>
                  <div className="rounded-xl glass border border-border/40 gradient-border gradient-border-static p-3 space-y-1 card-shadow">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Messages</span>
                    </div>
                    <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                      {sessionStats.messagesExchanged}
                    </p>
                  </div>
                  <div className="rounded-xl glass border border-border/40 gradient-border gradient-border-static p-3 space-y-1 card-shadow">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <BookMarked className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Topics Covered</span>
                    </div>
                    <p className="text-sm font-bold font-mono tabular-nums text-foreground">
                      {sessionStats.topicsCovered.length}
                    </p>
                  </div>
                  <div className="rounded-xl glass border border-border/40 gradient-border gradient-border-static p-3 space-y-1 card-shadow">
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
                  <div className="rounded-xl glass border border-border/40 gradient-border gradient-border-static p-3 space-y-2 card-shadow">
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
                        className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${sessionStats.avgMastery}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {/* Topics List */}
                {sessionStats.topicsCovered.length > 0 && (
                  <div className="rounded-xl glass border border-border/40 gradient-border gradient-border-static p-3 space-y-2 card-shadow">
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
                  <div className="rounded-xl glass border border-border/40 gradient-border gradient-border-static p-3 space-y-2 card-shadow">
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
                    className="flex-1 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
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
                className="text-sm min-h-30 max-h-50 resize-y"
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
              className="bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voice conversation mode — full-screen overlay, barge-in supported */}
      <AnimatePresence>
        {voiceModeOpen && <VoiceMode onClose={() => setVoiceModeOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
