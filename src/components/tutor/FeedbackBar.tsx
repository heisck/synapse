'use client'

import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { ThumbsUp, ThumbsDown, HelpCircle, Zap, Clock } from 'lucide-react'
import { toast } from 'sonner'
import type { UserFeedback } from '@/types'

const feedbackOptions: Array<{
  type: UserFeedback['type']
  icon: React.ElementType
  label: string
  color: string
}> = [
  { type: 'like', icon: ThumbsUp, label: 'Helpful', color: 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700' },
  { type: 'dislike', icon: ThumbsDown, label: 'Not helpful', color: 'text-red-500 hover:bg-red-50 hover:text-red-600' },
  { type: 'confused', icon: HelpCircle, label: 'Confused', color: 'text-orange-500 hover:bg-orange-50 hover:text-orange-600' },
  { type: 'too_fast', icon: Zap, label: 'Too fast', color: 'text-amber-500 hover:bg-amber-50 hover:text-amber-600' },
  { type: 'too_slow', icon: Clock, label: 'Too slow', color: 'text-blue-500 hover:bg-blue-50 hover:text-blue-600' },
]

export function FeedbackBar() {
  const addFeedbackItem = useAppStore((s) => s.addFeedbackItem)

  const handleClick = (type: UserFeedback['type'], label: string) => {
    addFeedbackItem({
      id: crypto.randomUUID(),
      type,
      createdAt: new Date().toISOString(),
    })
    toast.info(`Feedback: ${label}`)
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Feedback</h4>
      <div className="flex flex-wrap gap-1.5">
        {feedbackOptions.map(({ type, icon: Icon, label, color }) => (
          <Button
            key={type}
            variant="ghost"
            size="sm"
            className={`gap-1.5 text-xs ${color}`}
            onClick={() => handleClick(type, label)}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}