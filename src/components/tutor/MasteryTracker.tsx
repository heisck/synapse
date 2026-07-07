'use client'

import { useAppStore } from '@/stores/appStore'
import { Progress } from '@/components/ui/progress'

export function MasteryTracker() {
  const masteryMap = useAppStore((s) => s.masteryMap)

  const concepts = Object.keys(masteryMap).length > 0
    ? Object.entries(masteryMap).map(([name, data]) => ({ name, level: data.level }))
    : [
        { name: 'Cell Biology', level: 80 },
        { name: 'Genetics', level: 60 },
        { name: 'Evolution', level: 40 },
      ]

  function getColor(level: number): string {
    if (level <= 30) return 'bg-red-500'
    if (level <= 60) return 'bg-orange-500'
    if (level <= 80) return 'bg-teal-500'
    return 'bg-emerald-500'
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Concept Mastery</h4>
      {concepts.map((concept) => (
        <div key={concept.name} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{concept.name}</span>
            <span className="font-medium">{Math.round(concept.level)}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getColor(concept.level)}`}
              style={{ width: `${concept.level}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}