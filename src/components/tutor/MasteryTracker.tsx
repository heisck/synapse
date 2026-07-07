'use client'

import { useEffect, useState } from 'react'
import { motion, useSpring } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { Target, TrendingUp } from 'lucide-react'

function generateHeatmapData(seed: number): number[] {
  const data: number[] = []
  for (let i = 0; i < 28; i++) {
    const val = Math.sin(seed + i * 0.7) * 0.5 + Math.cos(seed + i * 1.3) * 0.3
    data.push(Math.max(0, Math.min(1, (val + 0.5) * (0.3 + (i % 7) * 0.1))))
  }
  return data
}

function getHeatColor(level: number): string {
  if (level < 0.2) return 'bg-emerald-100 dark:bg-emerald-950/60'
  if (level < 0.4) return 'bg-emerald-200 dark:bg-emerald-900/60'
  if (level < 0.6) return 'bg-emerald-300 dark:bg-emerald-800/70'
  if (level < 0.8) return 'bg-emerald-500 dark:bg-emerald-600/80'
  return 'bg-emerald-700 dark:bg-emerald-400'
}

function getGradientStyle(level: number): string {
  if (level <= 30) return 'from-red-400 to-orange-400'
  if (level <= 60) return 'from-orange-400 to-amber-400'
  if (level <= 80) return 'from-teal-400 to-emerald-400'
  return 'from-emerald-400 to-emerald-600'
}

function AnimatedCounter({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    spring.set(value)
    const unsub = spring.on('change', (v) => {
      setDisplay(Math.round(v))
    })
    return unsub
  }, [spring, value])

  return <span>{display}</span>
}

export function MasteryTracker() {
  const masteryMap = useAppStore((s) => s.masteryMap)

  const concepts = Object.keys(masteryMap).length > 0
    ? Object.entries(masteryMap).map(([name, data]) => ({ name, level: data.level }))
    : [
        { name: 'Cell Biology', level: 80 },
        { name: 'Genetics', level: 60 },
        { name: 'Evolution', level: 40 },
        { name: 'Ecology', level: 25 },
        { name: 'Biochemistry', level: 90 },
      ]

  const masteredCount = concepts.filter((c) => c.level >= 80).length
  const totalCount = concepts.length
  const seed = concepts.reduce((acc, c, i) => acc + c.name.charCodeAt(0) * (i + 1), 0)
  const heatmapData = generateHeatmapData(seed)

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  }

  return (
    <motion.div
      className="space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header with counter */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-emerald-400 to-teal-500">
            <Target className="w-3.5 h-3.5 text-white" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">Concept Mastery</h4>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Mastered:</span>
          <span className="gradient-text font-bold text-sm">
            <AnimatedCounter value={masteredCount} />
          </span>
          <span className="text-muted-foreground">/ {totalCount}</span>
        </div>
      </motion.div>

      {/* Mini heatmap grid (4x7 like a contribution graph) */}
      <motion.div variants={itemVariants} className="glass rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-medium text-muted-foreground">Activity Map</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {heatmapData.map((level, i) => (
            <motion.div
              key={i}
              className={`aspect-square rounded-sm ${getHeatColor(level)} transition-colors`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: i * 0.02,
                type: 'spring',
                stiffness: 400,
                damping: 25,
              }}
              title={`${Math.round(level * 100)}% activity`}
            />
          ))}
        </div>
        <div className="flex items-center justify-end gap-1 mt-2">
          <span className="text-[9px] text-muted-foreground">Less</span>
          <div className="flex gap-0.5">
            {['bg-emerald-100 dark:bg-emerald-950/60', 'bg-emerald-200 dark:bg-emerald-900/60', 'bg-emerald-300 dark:bg-emerald-800/70', 'bg-emerald-500 dark:bg-emerald-600/80', 'bg-emerald-700 dark:bg-emerald-400'].map((c, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c}`} />
            ))}
          </div>
          <span className="text-[9px] text-muted-foreground">More</span>
        </div>
      </motion.div>

      {/* Skill bars */}
      <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
        {concepts.map((concept, idx) => (
          <motion.div
            key={concept.name}
            className="space-y-1.5"
            variants={itemVariants}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground font-medium truncate max-w-[60%]">
                {concept.name}
              </span>
              <span className={`text-xs font-bold tabular-nums ${
                concept.level >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                concept.level >= 60 ? 'text-teal-600 dark:text-teal-400' :
                concept.level >= 40 ? 'text-amber-600 dark:text-amber-400' :
                'text-red-500 dark:text-red-400'
              }`}>
                {Math.round(concept.level)}%
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${getGradientStyle(concept.level)}`}
                initial={{ width: 0 }}
                animate={{ width: `${concept.level}%` }}
                transition={{
                  delay: 0.3 + idx * 0.1,
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-white/30 rounded-full" />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}