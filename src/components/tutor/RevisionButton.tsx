'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export function RevisionButton() {
  const [isActive, setIsActive] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)

  const handleClick = () => {
    if (isSpinning) return
    setIsSpinning(true)
    const nextActive = !isActive
    setIsActive(nextActive)

    toast.info(nextActive ? 'Revision mode activated.' : 'Revision mode deactivated.')

    setTimeout(() => setIsSpinning(false), 600)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClick}
            className={`relative gap-2 rounded-lg h-9 px-3 font-medium text-xs transition-all ${
              isActive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 shadow-sm shadow-emerald-500/15'
                : 'gradient-border hover:shadow-md hover:shadow-emerald-500/10'
            }`}
          >
            {/* Animated icon */}
            <motion.div
              animate={isSpinning ? { rotate: 360 } : { rotate: 0 }}
              transition={isSpinning
                ? { duration: 0.5, ease: 'easeInOut' }
                : { duration: 0 }
              }
            >
              <RefreshCw className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
            </motion.div>

            {/* Active indicator dot */}
            {isActive && (
              <motion.div
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 pulse-glow"
                layoutId="revision-dot"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
              />
            )}

            <span>{isActive ? 'Revising' : 'Revision'}</span>
          </Button>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px] text-center">
        <p>Toggle revision mode to review and reinforce previously covered concepts.</p>
      </TooltipContent>
    </Tooltip>
  )
}