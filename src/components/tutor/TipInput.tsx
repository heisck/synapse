'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Lightbulb,
  Send,
  ChevronDown,
  Gauge,
  RefreshCw,
  Layers,
  ArrowDown,
} from 'lucide-react'
import { toast } from 'sonner'

const PRESETS = [
  { label: 'Too fast', icon: Gauge, content: 'You are going too fast, please slow down.' },
  { label: 'Explain differently', icon: RefreshCw, content: 'Could you explain this in a different way?' },
  { label: 'More examples', icon: Layers, content: 'Please give me more examples to understand this better.' },
  { label: 'Too simple', icon: ArrowDown, content: 'This is too simple for me, can we go deeper?' },
]

const MAX_CHARS = 200

export function TipInput() {
  const [tip, setTip] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const addTip = useAppStore((s) => s.addTip)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tip.trim()) return
    addTip({
      id: crypto.randomUUID(),
      content: tip.trim(),
      category: 'learning_tip',
      createdAt: new Date().toISOString(),
    })
    toast.success('Tip saved! This helps me teach you better.')
    setTip('')
  }

  const handlePreset = (content: string) => {
    addTip({
      id: crypto.randomUUID(),
      content,
      category: 'learning_tip',
      createdAt: new Date().toISOString(),
    })
    toast.success('Preset tip sent!')
  }

  const charRatio = tip.length / MAX_CHARS
  const charColor =
    charRatio > 0.9 ? 'text-red-500' : charRatio > 0.7 ? 'text-amber-500' : 'text-muted-foreground'

  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full group cursor-pointer"
      >
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <motion.div
            className="flex items-center justify-center w-5 h-5 rounded-md bg-linear-to-br from-amber-400 to-orange-400"
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 3, repeatDelay: 2, ease: 'easeInOut' }}
          >
            <Lightbulb className="w-3 h-3 text-white" />
          </motion.div>
          Share a Learning Tip
        </h4>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {/* Preset tip buttons */}
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset, idx) => {
                  const Icon = preset.icon
                  return (
                    <motion.button
                      key={preset.label}
                      onClick={() => handlePreset(preset.content)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer gradient-border"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.04, type: 'spring', stiffness: 350, damping: 25 }}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <Icon className="w-3 h-3" />
                      {preset.label}
                    </motion.button>
                  )
                })}
              </div>

              {/* Input form */}
              <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <Input
                    placeholder="What helps you learn?"
                    value={tip}
                    onChange={(e) => setTip(e.target.value.slice(0, MAX_CHARS))}
                    className="text-sm pr-12 rounded-lg border-border focus:border-emerald-500/50 transition-colors"
                    maxLength={MAX_CHARS}
                  />
                  {/* Character count */}
                  {tip.length > 0 && (
                    <motion.span
                      className={`absolute right-2.5 bottom-1/2 translate-y-1/2 text-[10px] font-medium tabular-nums ${charColor}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {tip.length}/{MAX_CHARS}
                    </motion.span>
                  )}
                </div>
                <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!tip.trim()}
                    className="h-9 w-9 p-0 rounded-lg bg-linear-to-br from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20 transition-shadow disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </motion.div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}