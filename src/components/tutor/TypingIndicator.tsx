'use client'

import { motion } from 'framer-motion'

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 max-w-3xl mx-auto">
      {/* Assistant avatar hint */}
      <div className="flex-shrink-0 mt-1 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm shadow-emerald-500/20">
        <span className="text-[10px] font-bold text-white">AI</span>
      </div>

      {/* Bubble */}
      <div className="chat-bubble-assistant relative px-4 py-3 shadow-sm">
        {/* Subtle pulse glow behind */}
        <motion.div
          className="absolute -inset-1 rounded-2xl bg-emerald-400/10 dark:bg-emerald-500/5 blur-md -z-10"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
        />

        <div className="flex items-center gap-3">
          {/* Three dots with staggered spring bounce */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500"
              animate={{ y: [0, -5, 0] }}
              transition={{
                repeat: Infinity,
                duration: 0.7,
                delay: i * 0.15,
                ease: [0.4, 0, 0.2, 1],
              }}
            />
          ))}

          {/* "AI is thinking..." text */}
          <motion.span
            className="text-[11px] text-muted-foreground ml-1"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.4, ease: 'easeOut' }}
          >
            AI is thinking...
          </motion.span>
        </div>
      </div>
    </div>
  )
}