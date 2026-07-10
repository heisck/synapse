'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, Trophy, Layers, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'

export interface QuizPayloadQuestion {
  question: string
  options: string[]
  answerIndex: number
  explanation?: string
  concept?: string
}

export interface QuizPayload {
  mode: 'quiz' | 'flashcards'
  title?: string
  questions: QuizPayloadQuestion[]
}

/**
 * Finds a fenced JSON quiz block in an assistant message and parses it.
 * The protocol asks for ```quiz, but models routinely tag the fence
 * ```flashcards / ```flashcard / ```json instead — accept them all rather
 * than leaking raw JSON into the chat.
 * Returns the payload plus the surrounding prose, or null if none present.
 */
export function parseQuizPayload(content: string): { payload: QuizPayload; before: string; after: string } | null {
  const match = content.match(/```(quiz|flashcards?|json)\s*\n?([\s\S]*?)```/)
  if (!match) return null
  const fenceTag = match[1]
  try {
    const parsed = JSON.parse(match[2])
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : []
    const valid: QuizPayloadQuestion[] = questions.filter(
      (q: QuizPayloadQuestion) =>
        q && typeof q.question === 'string' &&
        Array.isArray(q.options) && q.options.length >= 2 &&
        typeof q.answerIndex === 'number' && q.answerIndex >= 0 && q.answerIndex < q.options.length,
    )
    if (valid.length === 0) return null
    return {
      payload: {
        // Fence tag doubles as the mode when the JSON omits it
        mode: parsed.mode === 'flashcards' || (!parsed.mode && fenceTag.startsWith('flashcard')) ? 'flashcards' : 'quiz',
        title: typeof parsed.title === 'string' ? parsed.title : undefined,
        questions: valid,
      },
      before: content.slice(0, match.index).trim(),
      after: content.slice((match.index ?? 0) + match[0].length).trim(),
    }
  } catch {
    return null
  }
}

/**
 * Interactive in-chat quiz / flashcard deck. The learner selects an answer,
 * the card validates it, and every answer is recorded as a real
 * AdaptiveResult so mastery tracking learns from it.
 *
 * Progress lives in the app store keyed by the assistant message id, so the
 * same deck rendered in two places (in-chat and side panel) shares one state:
 * a question answered in one view is answered in both.
 */
export function InteractiveQuizCard({ payload, messageId }: { payload: QuizPayload; messageId: string }) {
  const addAdaptiveResult = useAppStore((s) => s.addAdaptiveResult)
  const updateMastery = useAppStore((s) => s.updateMastery)
  const activeTopic = useAppStore((s) => s.activeTopic)
  const masteryMap = useAppStore((s) => s.masteryMap)
  const setQuizCardProgress = useAppStore((s) => s.setQuizCardProgress)
  const progress = useAppStore((s) => s.quizProgress[messageId])

  const index = progress?.index ?? 0
  const selected = progress?.selected ?? null
  const correctCount = progress?.correctCount ?? 0
  const finished = progress?.finished ?? false

  const isFlashcards = payload.mode === 'flashcards'
  const question = payload.questions[index]
  const total = payload.questions.length
  const answered = selected !== null

  const handleSelect = useCallback((optIdx: number) => {
    if (selected !== null) return
    const correct = optIdx === question.answerIndex
    setQuizCardProgress(messageId, {
      index,
      selected: optIdx,
      correctCount: correct ? correctCount + 1 : correctCount,
      finished,
    })

    const concept = question.concept || payload.title || activeTopic || 'General'
    addAdaptiveResult({ concept, correct, difficulty: 'medium', timestamp: Date.now() })
    // Nudge mastery for the concept based on this answer
    const prev = masteryMap[concept]?.level ?? 40
    const next = Math.max(0, Math.min(100, correct ? prev + 8 : prev - 5))
    updateMastery(concept, next, correct ? `Answered "${question.question.slice(0, 60)}" correctly` : `Missed "${question.question.slice(0, 60)}"`)
  }, [selected, question, payload.title, activeTopic, addAdaptiveResult, updateMastery, masteryMap, messageId, index, correctCount, finished, setQuizCardProgress])

  const handleNext = useCallback(() => {
    if (index + 1 >= total) {
      setQuizCardProgress(messageId, { index, selected, correctCount, finished: true })
    } else {
      setQuizCardProgress(messageId, { index: index + 1, selected: null, correctCount, finished: false })
    }
  }, [index, total, selected, correctCount, messageId, setQuizCardProgress])

  const handleRestart = useCallback(() => {
    setQuizCardProgress(messageId, { index: 0, selected: null, correctCount: 0, finished: false })
  }, [messageId, setQuizCardProgress])

  if (finished) {
    const pct = Math.round((correctCount / total) * 100)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-xl border border-primary/20 p-5 my-1 text-center space-y-3"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500"
        >
          <Trophy className="h-6 w-6 text-white" />
        </motion.div>
        <div>
          <p className="text-sm font-semibold">
            {correctCount} / {total} correct ({pct}%)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {pct >= 80 ? 'Excellent — this is sticking!' : pct >= 50 ? 'Good work — a quick revision will lock it in.' : 'No worries — ask your tutor to re-explain the tricky ones.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRestart} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="glass rounded-xl border border-primary/20 p-4 my-1 space-y-3 min-w-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {isFlashcards ? <Layers className="h-3.5 w-3.5" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
          {payload.title || (isFlashcards ? 'Flashcards' : 'Quick Quiz')}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {index + 1} / {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
          initial={false}
          animate={{ width: `${((index + (answered ? 1 : 0)) / total) * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: isFlashcards ? 0 : 16, rotateY: isFlashcards ? -90 : 0 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          exit={{ opacity: 0, x: isFlashcards ? 0 : -16, rotateY: isFlashcards ? 90 : 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="space-y-2.5"
        >
          <p className="text-sm font-medium leading-relaxed">{question.question}</p>

          <div className="flex flex-col gap-1.5">
            {question.options.map((opt, i) => {
              const isCorrectOpt = i === question.answerIndex
              const isChosen = selected === i
              let style = 'border-border hover:border-primary/40 hover:bg-accent/40'
              if (answered) {
                if (isCorrectOpt) style = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                else if (isChosen) style = 'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300'
                else style = 'border-border opacity-50'
              }
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={answered}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[13px] transition-colors cursor-pointer disabled:cursor-default ${style}`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                    answered && isCorrectOpt ? 'border-emerald-500 bg-emerald-500 text-white'
                    : answered && isChosen ? 'border-red-500 bg-red-500 text-white'
                    : 'border-muted-foreground/40 text-muted-foreground'
                  }`}>
                    {answered && isCorrectOpt ? <CheckCircle2 className="h-3 w-3" /> : answered && isChosen ? <XCircle className="h-3 w-3" /> : String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{opt}</span>
                </button>
              )
            })}
          </div>

          {/* Explanation appears only after answering */}
          <AnimatePresence>
            {answered && question.explanation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
                  {question.explanation}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer row always occupies its height so the card doesn't jump
              when the Next button appears after answering */}
          <div className="flex h-8 justify-end">
            {answered && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button size="sm" onClick={handleNext} className="gap-1 h-8 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90">
                  {index + 1 >= total ? 'See results' : 'Next'}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
