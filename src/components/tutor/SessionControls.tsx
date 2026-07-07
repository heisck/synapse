'use client'

import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { ClipboardCheck, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'

export function SessionControls() {
  const navigate = useAppStore((s) => s.navigate)

  const handleStartQuiz = () => {
    navigate('quiz')
  }

  const handleRevision = () => {
    toast.info('Revision mode starting...')
  }

  const handleEndSession = () => {
    toast.success('Session ended. Great work!')
    navigate('dashboard')
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Session Controls</h4>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleStartQuiz}
        >
          <ClipboardCheck className="w-4 h-4" />
          Start Quiz
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleRevision}
        >
          <RotateCcw className="w-4 h-4" />
          Revision Mode
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleEndSession}
        >
          <X className="w-4 h-4" />
          End Session
        </Button>
      </div>
    </div>
  )
}