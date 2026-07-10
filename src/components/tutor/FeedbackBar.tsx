'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import {
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Zap,
  Clock,
  Check,
  Brain,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { UserFeedback } from '@/types'

const feedbackOptions: Array<{
  type: UserFeedback['type']
  icon: LucideIcon
  label: string
  rating: number
  color: string
  activeColor: string
}> = [
  { type: 'dislike', icon: ThumbsDown, label: 'Not helpful', rating: 1, color: 'text-muted-foreground', activeColor: 'text-red-500' },
  { type: 'confused', icon: HelpCircle, label: 'Confused', rating: 2, color: 'text-muted-foreground', activeColor: 'text-orange-500' },
  { type: 'too_slow', icon: Clock, label: 'Too slow', rating: 3, color: 'text-muted-foreground', activeColor: 'text-amber-500' },
  { type: 'too_fast', icon: Zap, label: 'Too fast', rating: 4, color: 'text-muted-foreground', activeColor: 'text-teal-500' },
  { type: 'like', icon: ThumbsUp, label: 'Helpful', rating: 5, color: 'text-muted-foreground', activeColor: 'text-emerald-500' },
]

const SATISFACTION_LABELS = ['', 'Needs work', 'Getting there', 'Alright', 'Good', 'Great!']

export function FeedbackBar() {
  const addFeedbackItem = useAppStore((s) => s.addFeedbackItem)
  const [selectedType, setSelectedType] = useState<UserFeedback['type'] | null>(null)
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [justSubmitted, setJustSubmitted] = useState(false)

  const handleClick = (type: UserFeedback['type'], label: string, rating: number) => {
    if (justSubmitted) return
    setSelectedType(type)
    setSelectedRating(rating)
    addFeedbackItem({
      id: crypto.randomUUID(),
      type,
      createdAt: new Date().toISOString(),
    })
    toast.success(`Feedback: ${label}`)

    // Show check animation then reset
    setJustSubmitted(true)
    setTimeout(() => {
      setJustSubmitted(false)
      setSelectedType(null)
      setSelectedRating(null)
    }, 1800)
  }

  const meterPercent = selectedRating ? (selectedRating / 5) * 100 : 0

  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-sm font-semibold text-foreground">Rate this explanation</h4>
        </div>
        {justSubmitted && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"
          >
            <Check className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Thanks!</span>
          </motion.div>
        )}
      </motion.div>

      {/* Satisfaction meter bar */}
      <div className="space-y-1.5">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-red-400 via-amber-400 to-emerald-500"
            animate={{ width: `${meterPercent}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          >
            <div className="absolute inset-0 bg-linear-to-t from-transparent via-white/20 to-white/30 rounded-full" />
          </motion.div>
        </div>
        <AnimatePresence mode="wait">
          {selectedRating !== null && (
            <motion.p
              key={`label-${selectedRating}`}
              className="text-[10px] font-medium text-muted-foreground text-right"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {SATISFACTION_LABELS[selectedRating]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Feedback option buttons */}
      <div className="flex items-center justify-between gap-1">
        {feedbackOptions.map(({ type, icon: Icon, label, rating, color, activeColor }, idx) => {
          const isSelected = selectedType === type
          return (
            <motion.button
              key={type}
              onClick={() => handleClick(type, label, rating)}
              className="relative flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg transition-colors cursor-pointer group"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.04, type: 'spring', stiffness: 350, damping: 25 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.92 }}
              title={label}
              aria-label={label}
              disabled={justSubmitted}
            >
              {/* Active background */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 rounded-lg bg-emerald-50 dark:bg-emerald-950/40"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  />
                )}
              </AnimatePresence>

              {/* Check overlay for just-submitted state */}
              {isSelected && justSubmitted && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  >
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </motion.div>
                </motion.div>
              )}

              <div className={`relative transition-colors ${isSelected ? activeColor : color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[9px] leading-none font-medium transition-colors ${
                isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
              }`}>
                {label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}