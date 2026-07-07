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
} from 'lucide-react'
import { toast } from 'sonner'

import { ChatBubble, stopAllTTS } from './ChatBubble'
import { TypingIndicator } from './TypingIndicator'
import { MasteryTracker } from './MasteryTracker'
import { SessionControls } from './SessionControls'
import { TipInput } from './TipInput'
import { FeedbackBar } from './FeedbackBar'
import { CourseContextPanel } from './CourseContextPanel'
import { PersonaSelector } from './PersonaSelector'

const QUICK_TOPICS = ['Cell Biology', 'Data Structures', 'World History', 'Calculus', 'Creative Writing']

const QUICK_ACTIONS = [
  { label: 'Give hint', icon: Lightbulb, prompt: 'Give me a hint about what we were just discussing.' },
  { label: 'Explain differently', icon: MessageSquareText, prompt: 'Can you explain that differently?' },
  { label: 'Show example', icon: ListChecks, prompt: 'Can you show me an example?' },
  { label: 'Quiz me', icon: ListChecks, prompt: 'Quiz me on what we just covered.' },
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
  } = useAppStore()

  const [input, setInput] = useState('')
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const timerStarted = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialize session on mount
  useEffect(() => {
    if (!activeSessionId) {
      const sessionId = crypto.randomUUID()
      setActiveSession(sessionId)
      // Add greeting message
      addMessage({
        id: crypto.randomUUID(),
        sessionId,
        role: 'assistant',
        content: `Welcome${userName ? ', ' + userName : ''}! 👋 I'm your AI tutor. What would you like to learn about today? Pick a topic below or type your own!`,
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
    // Auto-stop TTS when a new message appears
    if (messages.length > prevMessagesLen.current) {
      stopAllTTS()
    }
    prevMessagesLen.current = messages.length
  }, [messages, isLoading])

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`
  }, [])

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

      // Update phase if needed
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
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            {activeTopic || 'AI Tutor'}
          </h1>
          <Badge variant="secondary" className={getPhaseColor(sessionPhase)}>
            {sessionPhase}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs">
            {formatTimer(timerSeconds)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {messages.length} messages
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            aria-label={rightPanelOpen ? 'Close side panel' : 'Open side panel'}
          >
            {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Course Context Panel (visible when slides are loaded) */}
          <CourseContextPanel />
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
              <ChatBubble key={msg.id} message={msg} />
            ))}

            {isLoading && <TypingIndicator />}
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t p-3 bg-card/50">
            <div className="flex items-end gap-2 max-w-3xl mx-auto">
              <Textarea
                ref={textareaRef}
                placeholder="Ask me anything..."
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="min-h-[40px] max-h-[150px] resize-none flex-1"
                rows={1}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 h-[40px] w-[40px]" aria-label="Quick actions">
                    <MoreHorizontal className="w-4 h-4" />
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
              <Button
                size="icon"
                className="shrink-0 h-[40px] w-[40px]"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </Button>
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