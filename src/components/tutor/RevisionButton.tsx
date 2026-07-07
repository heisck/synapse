'use client'

import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

export function RevisionButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => toast.info('Revision mode starting...')}
    >
      <RotateCcw className="w-4 h-4" />
      Revision
    </Button>
  )
}