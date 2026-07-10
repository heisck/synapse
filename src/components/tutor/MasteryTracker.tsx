'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, useSpring, type Variants } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { TrendingUp } from 'lucide-react'

// Intensity buckets for the 28-day activity heatmap (index 0 = no activity)
const HEAT_LEVEL_CLASSES = [
  'bg-muted/50 dark:bg-muted/30',
  'bg-emerald-200 dark:bg-emerald-900/60',
  'bg-emerald-300 dark:bg-emerald-800/70',
  'bg-emerald-500 dark:bg-emerald-600/80',
  'bg-emerald-700 dark:bg-emerald-400',
]

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
  const studySessions = useAppStore((s) => s.studySessions)

  const concepts = Object.entries(masteryMap).map(([name, data]) => ({ name, level: data.level }))

  const masteredCount = concepts.filter((c) => c.level >= 80).length
  const totalCount = concepts.length

  // Real activity heatmap: study minutes per day over the last 28 days,
  // derived from recorded study sessions (like ProfileView's heatmap)
  const heatmapCells = useMemo(() => {
    const byDay: Record<string, { minutes: number; count: number }> = {}
    for (const session of studySessions) {
      const day = session.date.includes('T') ? session.date.split('T')[0] : session.date
      const entry = byDay[day] || { minutes: 0, count: 0 }
      entry.minutes += session.duration || 0
      entry.count += 1
      byDay[day] = entry
    }
    const cells: Array<{ date: string; minutes: number; level: number }> = []
    const today = new Date()
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const entry = byDay[dateStr]
      // Intensity: 0 = none, then bucketed by minutes studied that day
      let level = 0
      if (entry) {
        if (entry.minutes >= 60) level = 4
        else if (entry.minutes >= 30) level = 3
        else if (entry.minutes >= 15) level = 2
        else level = 1
      }
      cells.push({ date: dateStr, minutes: entry?.minutes || 0, level })
    }
    return cells
  }, [studySessions])

  const hasActivity = heatmapCells.some((c) => c.level > 0)

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  }

  const itemVariants: Variants = {
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
      {/* Counter only — the panel section provides the title/icon */}
      <motion.div variants={itemVariants} className="flex items-center justify-end gap-1.5 text-xs">
        <span className="text-muted-foreground">Mastered:</span>
        <span className="gradient-text font-bold text-sm">
          <AnimatedCounter value={masteredCount} />
        </span>
        <span className="text-muted-foreground">/ {totalCount}</span>
      </motion.div>

      {/* Activity heatmap grid (4x7, last 28 days of real study sessions) */}
      <motion.div variants={itemVariants} className="glass rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-medium text-muted-foreground">Activity Map</span>
        </div>
        {hasActivity ? (
          <>
            <div className="grid grid-cols-7 gap-1">
              {heatmapCells.map((cell, i) => (
                <motion.div
                  key={cell.date}
                  className={`aspect-square rounded-sm ${HEAT_LEVEL_CLASSES[cell.level]} transition-colors`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: i * 0.02,
                    type: 'spring',
                    stiffness: 400,
                    damping: 25,
                  }}
                  title={`${new Date(cell.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${
                    cell.minutes > 0 ? `${cell.minutes} min studied` : 'No activity'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-1 mt-2">
              <span className="text-[9px] text-muted-foreground">Less</span>
              <div className="flex gap-0.5">
                {HEAT_LEVEL_CLASSES.map((c, i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c}`} />
                ))}
              </div>
              <span className="text-[9px] text-muted-foreground">More</span>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground text-center py-3">
            Complete study sessions to see your activity here
          </p>
        )}
      </motion.div>

      {/* Skill bars */}
      {concepts.length > 0 ? (
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
                  className={`absolute inset-y-0 left-0 rounded-full bg-linear-to-r ${getGradientStyle(concept.level)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${concept.level}%` }}
                  transition={{
                    delay: 0.3 + idx * 0.1,
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <div className="absolute inset-0 bg-linear-to-t from-transparent via-white/20 to-white/30 rounded-full" />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div variants={itemVariants} className="glass rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Concepts you discuss will be tracked here as you learn
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}
