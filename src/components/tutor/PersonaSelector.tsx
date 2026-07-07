'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { GraduationCap, Dumbbell, BookOpen, Smile } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Persona {
  id: string
  label: string
  description: string
  icon: LucideIcon
  preview: string
  tint: string
  tintDark: string
}

const PERSONAS: Persona[] = [
  {
    id: 'professor',
    label: 'Professor',
    description: 'Formal & academic',
    icon: GraduationCap,
    preview: '"Let us examine the underlying principles..."',
    tint: 'bg-emerald-50/80',
    tintDark: 'dark:bg-emerald-950/30',
  },
  {
    id: 'coach',
    label: 'Coach',
    description: 'Energetic & motivating',
    icon: Dumbbell,
    preview: '"You\'re doing amazing! Let\'s push further!"',
    tint: 'bg-teal-50/80',
    tintDark: 'dark:bg-teal-950/30',
  },
  {
    id: 'storyteller',
    label: 'Storyteller',
    description: 'Narratives & analogies',
    icon: BookOpen,
    preview: '"Picture this: once upon a time..."',
    tint: 'bg-cyan-50/80',
    tintDark: 'dark:bg-cyan-950/30',
  },
  {
    id: 'friend',
    label: 'Friend',
    description: 'Casual & simple',
    icon: Smile,
    preview: '"Ok so basically, here\'s the deal..."',
    tint: 'bg-lime-50/80',
    tintDark: 'dark:bg-lime-950/30',
  },
]

export function PersonaSelector() {
  const activePersona = useAppStore((s) => s.activePersona)
  const setActivePersona = useAppStore((s) => s.setActivePersona)

  const currentPersona = PERSONAS.find((p) => p.id === activePersona) ?? PERSONAS[2]

  return (
    <motion.div
      className="space-y-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <h4 className="text-sm font-semibold text-foreground">Tutor Persona</h4>

      {/* Persona grid */}
      <div className="grid grid-cols-2 gap-2">
        {PERSONAS.map((persona, idx) => {
          const isSelected = activePersona === persona.id
          const Icon = persona.icon

          return (
            <motion.button
              key={persona.id}
              onClick={() => setActivePersona(persona.id)}
              className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors cursor-pointer overflow-hidden ${
                isSelected
                  ? 'border-emerald-500/60'
                  : 'border-border bg-background hover:border-emerald-300 dark:hover:border-emerald-700'
              }`}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05, type: 'spring', stiffness: 350, damping: 25 }}
              aria-label={`Select ${persona.label} persona`}
              aria-pressed={isSelected}
            >
              {/* Animated background tint */}
              <AnimatePresence mode="wait">
                {isSelected && (
                  <motion.div
                    key={`tint-${persona.id}`}
                    className={`absolute inset-0 ${persona.tint} ${persona.tintDark}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </AnimatePresence>

              {/* Gradient border indicator */}
              {isSelected && (
                <motion.div
                  layoutId="persona-border-indicator"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    padding: '1.5px',
                    background: 'linear-gradient(135deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89))',
                    WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center gap-1">
                {/* Avatar circle */}
                <motion.div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-500/20'
                      : 'bg-muted'
                  }`}
                  animate={isSelected ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4, type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isSelected
                        ? 'text-white'
                        : 'text-muted-foreground'
                    }`}
                  />
                </motion.div>
                <span
                  className={`text-[11px] font-semibold leading-tight ${
                    isSelected
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-foreground'
                  }`}
                >
                  {persona.label}
                </span>
                <span className="text-[9px] text-muted-foreground leading-tight">
                  {persona.description}
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Animated preview text */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPersona.id}
          className="glass-subtle rounded-lg px-3 py-2"
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: 6, height: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            {currentPersona.preview}
          </p>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}