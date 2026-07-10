'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { GraduationCap, Dumbbell, BookOpen, Smile, Zap, Shirt, Hourglass, Sparkles, Crosshair, Coffee, Flame } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useMemo } from 'react'

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

interface MoodSliderConfig {
  key: 'energy' | 'formality' | 'patience' | 'humor'
  label: string
  icon: LucideIcon
  lowLabel: string
  highLabel: string
}

const MOOD_SLIDERS: MoodSliderConfig[] = [
  { key: 'energy', label: 'Energy', icon: Zap, lowLabel: 'Calm', highLabel: 'Energetic' },
  { key: 'formality', label: 'Formality', icon: Shirt, lowLabel: 'Casual', highLabel: 'Formal' },
  { key: 'patience', label: 'Patience', icon: Hourglass, lowLabel: 'Quick', highLabel: 'Thorough' },
  { key: 'humor', label: 'Humor', icon: Sparkles, lowLabel: 'Serious', highLabel: 'Playful' },
]

interface MoodPreset {
  id: string
  label: string
  icon: LucideIcon
  values: { energy: number; formality: number; patience: number; humor: number }
}

const MOOD_PRESETS: MoodPreset[] = [
  { id: 'focused', label: 'Focused', icon: Crosshair, values: { energy: 25, formality: 80, patience: 40, humor: 10 } },
  { id: 'chill', label: 'Chill', icon: Coffee, values: { energy: 20, formality: 25, patience: 85, humor: 20 } },
  { id: 'fun', label: 'Fun', icon: Sparkles, values: { energy: 85, formality: 20, patience: 60, humor: 90 } },
  { id: 'intense', label: 'Intense', icon: Flame, values: { energy: 90, formality: 75, patience: 25, humor: 15 } },
]

function getMoodLabel(config: MoodSliderConfig, value: number): string {
  if (value <= 25) return config.lowLabel
  if (value <= 50) {
    if (value <= 37) return `Slightly ${config.lowLabel.toLowerCase()}`
    return 'Balanced'
  }
  if (value <= 75) {
    if (value <= 62) return 'Moderate'
    return `Quite ${config.highLabel.toLowerCase()}`
  }
  return config.highLabel
}

export function PersonaSelector() {
  const activePersona = useAppStore((s) => s.activePersona)
  const setActivePersona = useAppStore((s) => s.setActivePersona)
  const moodSettings = useAppStore((s) => s.moodSettings)
  const setMoodSettings = useAppStore((s) => s.setMoodSettings)

  const currentPersona = PERSONAS.find((p) => p.id === activePersona) ?? PERSONAS[2]

  const activePresetId = useMemo(() => {
    return MOOD_PRESETS.find(
      (p) =>
        p.values.energy === moodSettings.energy &&
        p.values.formality === moodSettings.formality &&
        p.values.patience === moodSettings.patience &&
        p.values.humor === moodSettings.humor,
    )?.id ?? null
  }, [moodSettings])

  const handlePresetSelect = useCallback(
    (preset: MoodPreset) => {
      setMoodSettings(preset.values)
    },
    [setMoodSettings],
  )

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
                      ? 'bg-linear-to-br from-emerald-400 to-teal-500 shadow-md shadow-emerald-500/20'
                      : 'bg-muted'
                  }`}
                  animate={isSelected ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
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

      {/* Mood Tuning Panel */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="overflow-hidden"
        >
          <div className="glass rounded-xl p-3 space-y-3">
            {/* Section label */}
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold text-foreground">Mood Tuning</h5>
              <span className="text-[9px] text-muted-foreground">Fine-tune AI behavior</span>
            </div>

            {/* Quick presets */}
            <div className="flex gap-1.5 flex-wrap">
              {MOOD_PRESETS.map((preset) => {
                const isActive = activePresetId === preset.id
                const PresetIcon = preset.icon
                return (
                  <motion.button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer border ${
                      isActive
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-border bg-background text-muted-foreground hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-foreground'
                    }`}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    aria-label={`Apply ${preset.label} mood preset`}
                    aria-pressed={isActive}
                  >
                    <PresetIcon className="w-3 h-3" />
                    {preset.label}
                  </motion.button>
                )
              })}
            </div>

            {/* Sliders */}
            <div className="space-y-2.5">
              {MOOD_SLIDERS.map((slider, idx) => {
                const value = moodSettings[slider.key]
                const SliderIcon = slider.icon
                const label = getMoodLabel(slider, value)
                const percentage = value / 100

                return (
                  <motion.div
                    key={slider.key}
                    className="space-y-1"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: idx * 0.06,
                      type: 'spring',
                      stiffness: 350,
                      damping: 22,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <SliderIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[11px] font-medium text-foreground">{slider.label}</span>
                      </div>
                      <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {label}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={value}
                        onChange={(e) =>
                          setMoodSettings({ [slider.key]: Number(e.target.value) })
                        }
                        className="mood-slider w-full h-1.5 rounded-full appearance-none cursor-pointer"
                        style={
                          {
                            '--slider-progress': `${percentage}`,
                          } as React.CSSProperties
                        }
                        aria-label={`${slider.label}: ${label}`}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}