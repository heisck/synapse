'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import {
  ClipboardCheck,
  RotateCcw,
  LogOut,
  Download,
  Search,
  BookOpen,
  BarChart3,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'

const PHASES = [
  { id: 'discovery', label: 'Discovery', icon: Search },
  { id: 'starter', label: 'Starter', icon: BookOpen },
  { id: 'teaching', label: 'Teaching', icon: ClipboardCheck },
  { id: 'review', label: 'Review', icon: BarChart3 },
] as const

export function SessionControls() {
  const navigate = useAppStore((s) => s.navigate)
  const sessionPhase = useAppStore((s) => s.sessionPhase)
  const messages = useAppStore((s) => s.messages)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const currentPhaseIndex = PHASES.findIndex((p) => p.id === sessionPhase)

  const handleStartQuiz = () => {
    navigate('quiz')
  }

  const handleRevision = () => {
    toast.info('Revision mode starting...')
  }

  const handleEndSession = () => {
    navigate('dashboard')
    setShowEndConfirm(false)
    toast.success('Session ended. Great work!')
  }

  const handleExportSession = async () => {
    setIsExporting(true)
    await new Promise((r) => setTimeout(r, 400))
    if (messages.length === 0) {
      toast.info('No messages to export.')
      setIsExporting(false)
      return
    }
    const md = messages
      .map((m) => {
        const role = m.role === 'user' ? '**You**' : '**AI Tutor**'
        const time = new Date(m.createdAt).toLocaleTimeString()
        return `### ${role} (${time})\n\n${m.content}\n`
      })
      .join('\n---\n\n')
    const header = `# SynapseLearn Session Export\n\nExported: ${new Date().toLocaleString()}\nMessages: ${messages.length}\n\n---\n\n`
    const blob = new Blob([header + md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `synapse-session-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Session exported as Markdown.')
    setIsExporting(false)
  }

  const buttonVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: 0.1 + i * 0.07, type: 'spring', stiffness: 300, damping: 24 },
    }),
  }

  return (
    <motion.div
      className="space-y-4"
      initial="hidden"
      animate="visible"
    >
      {/* Phase stepper */}
      <motion.div variants={buttonVariants} custom={0}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-foreground">Session Phase</h4>
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {PHASES[currentPhaseIndex]?.label ?? sessionPhase}
          </span>
        </div>
        <div className="relative flex items-center justify-between px-1">
          {/* Connector line */}
          <div className="absolute top-1/2 left-4 right-4 h-0.5 -translate-y-1/2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
              initial={false}
              animate={{ width: `${(currentPhaseIndex / (PHASES.length - 1)) * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            />
          </div>
          {PHASES.map((phase, idx) => {
            const Icon = phase.icon
            const isActive = idx === currentPhaseIndex
            const isPast = idx < currentPhaseIndex
            return (
              <motion.div
                key={phase.id}
                className="relative z-10 flex flex-col items-center gap-1"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.08, type: 'spring', stiffness: 350, damping: 25 }}
              >
                <motion.div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-500/25'
                      : isPast
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                  } ${isActive ? 'pulse-glow' : ''}`}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isPast ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </motion.div>
                <span className={`text-[9px] font-medium leading-none ${
                  isActive ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'
                }`}>
                  {phase.label}
                </span>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Action buttons */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-semibold text-foreground">Controls</h4>
        <div className="flex flex-col gap-1.5">
          <motion.div variants={buttonVariants} custom={1}>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 gradient-border rounded-lg h-9 transition-shadow hover:shadow-md hover:shadow-emerald-500/10"
              onClick={handleStartQuiz}
            >
              <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Start Quiz</span>
            </Button>
          </motion.div>

          <motion.div variants={buttonVariants} custom={2}>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 gradient-border rounded-lg h-9 transition-shadow hover:shadow-md hover:shadow-emerald-500/10"
              onClick={handleRevision}
            >
              <RotateCcw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Revision Mode</span>
            </Button>
          </motion.div>

          <motion.div variants={buttonVariants} custom={3}>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 gradient-border rounded-lg h-9 transition-shadow hover:shadow-md hover:shadow-emerald-500/10"
              onClick={handleExportSession}
              disabled={isExporting}
            >
              <motion.div
                animate={isExporting ? { rotate: 360 } : { rotate: 0 }}
                transition={isExporting ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0 }}
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </motion.div>
              <span>{isExporting ? 'Exporting...' : 'Export Session'}</span>
            </Button>
          </motion.div>

          {/* End session with inline confirmation */}
          <motion.div variants={buttonVariants} custom={4}>
            <AnimatePresence mode="wait">
              {!showEndConfirm ? (
                <motion.div
                  key="end-btn"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 rounded-lg h-9 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-300 dark:hover:border-red-800 transition-shadow hover:shadow-md hover:shadow-red-500/10"
                    onClick={() => setShowEndConfirm(true)}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>End Session</span>
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="end-confirm"
                  initial={{ opacity: 0, scale: 0.95, height: 0 }}
                  animate={{ opacity: 1, scale: 1, height: 'auto' }}
                  exit={{ opacity: 0, scale: 0.95, height: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="glass rounded-lg p-2.5 space-y-2"
                >
                  <p className="text-xs text-foreground font-medium">End this session?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-8 text-xs"
                      onClick={handleEndSession}
                    >
                      Yes, end
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setShowEndConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}