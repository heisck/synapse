'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Lightbulb, Send } from 'lucide-react'
import { toast } from 'sonner'

export function TipInput() {
  const [tip, setTip] = useState('')
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

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
        Share a Learning Tip
      </h4>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder="What helps you learn?"
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          className="text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!tip.trim()}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  )
}