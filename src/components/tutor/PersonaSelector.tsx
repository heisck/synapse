'use client'

import { motion } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { GraduationCap, Dumbbell, BookOpen, Smile } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Persona {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

const PERSONAS: Persona[] = [
  {
    id: 'professor',
    label: 'Professor',
    description: 'Formal & academic',
    icon: GraduationCap,
  },
  {
    id: 'coach',
    label: 'Coach',
    description: 'Energetic & motivating',
    icon: Dumbbell,
  },
  {
    id: 'storyteller',
    label: 'Storyteller',
    description: 'Narratives & analogies',
    icon: BookOpen,
  },
  {
    id: 'friend',
    label: 'Friend',
    description: 'Casual & simple',
    icon: Smile,
  },
]

export function PersonaSelector() {
  const activePersona = useAppStore((s) => s.activePersona)
  const setActivePersona = useAppStore((s) => s.setActivePersona)

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Tutor Persona</h4>
      <div className="grid grid-cols-2 gap-2">
        {PERSONAS.map((persona) => {
          const isSelected = activePersona === persona.id
          const Icon = persona.icon

          return (
            <motion.button
              key={persona.id}
              onClick={() => setActivePersona(persona.id)}
              className={`relative flex flex-col items-center gap-1 rounded-lg border p-2.5 text-center transition-colors cursor-pointer ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-500/30'
                  : 'border-border bg-background hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20'
              }`}
              whileTap={{ scale: 0.97 }}
              aria-label={`Select ${persona.label} persona`}
              aria-pressed={isSelected}
            >
              <Icon
                className={`w-5 h-5 ${
                  isSelected
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
                }`}
              />
              <span
                className={`text-[11px] font-medium leading-tight ${
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

              {/* Selection indicator dot */}
              {isSelected && (
                <motion.div
                  layoutId="persona-indicator"
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
