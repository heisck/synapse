'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/appStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Upload,
  FileText,
  Layers,
  Tag,
} from 'lucide-react'

/**
 * Highlights key terms in slide content by wrapping them in <mark> tags.
 */
function highlightKeyTerms(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/)
  return sentences
    .map((sentence) => {
      const result = sentence.replace(
        /(?<=\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|[A-Z][a-z]{3,})/g,
        '<mark class="bg-emerald-200 dark:bg-emerald-800/50 text-emerald-900 dark:text-emerald-100 px-0.5 rounded-sm">$1</mark>'
      )
      return result
    })
    .join(' ')
}

/** Extract short topic tags from slide title and content */
function extractTopics(title: string, content: string): string[] {
  const words = `${title} ${content}`.split(/\s+/)
  const candidates = words
    .filter((w) => /^[A-Z][a-z]{3,}$/.test(w) && !['This', 'That', 'These', 'Those', 'There', 'They', 'Their', 'Which', 'What', 'When', 'Where', 'With', 'From', 'Have', 'Been', 'Each', 'Some', 'Will', 'Also'].includes(w))
  const unique = [...new Set(candidates)]
  return unique.slice(0, 4)
}

/** Color cycle for topic tags */
const TAG_COLORS = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
]

export function CourseContextPanel() {
  const navigate = useAppStore((s) => s.navigate)
  const activeSlides = useAppStore((s) => s.activeSlides)
  const currentSlideIndex = useAppStore((s) => s.currentSlideIndex)
  const setCurrentSlideIndex = useAppStore((s) => s.setCurrentSlideIndex)

  const [isOpen, setIsOpen] = useState(true)

  // Empty state: show Load Course CTA
  if (activeSlides.length === 0) {
    return (
      <motion.div
        className="mx-auto max-w-3xl px-4 mb-2"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div className="glass rounded-xl p-5 flex flex-col items-center text-center gap-3">
          {/* Illustration: stacked icons */}
          <div className="relative w-16 h-16">
            <motion.div
              className="absolute inset-0 flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40"
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            >
              <FileText className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            <motion.div
              className="absolute -bottom-1 -right-1 flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 shadow-lg shadow-emerald-500/20"
              animate={{ y: [0, 2, 0] }}
              transition={{ repeat: Infinity, duration: 3, delay: 0.5, ease: 'easeInOut' }}
            >
              <Upload className="w-4 h-4 text-white" />
            </motion.div>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">No course loaded</h3>
            <p className="text-xs text-muted-foreground max-w-[240px]">
              Upload your slides to get AI-powered context and explanations during tutoring.
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Button
              onClick={() => navigate('upload')}
              size="sm"
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md shadow-emerald-500/20 gap-2 transition-shadow hover:shadow-lg hover:shadow-emerald-500/30"
            >
              <Upload className="w-4 h-4" />
              Load Course
            </Button>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  const currentSlide = activeSlides[currentSlideIndex]
  if (!currentSlide) return null

  const isFirst = currentSlideIndex === 0
  const isLast = currentSlideIndex === activeSlides.length - 1
  const highlightedContent = highlightKeyTerms(currentSlide.content)
  const topics = extractTopics(currentSlide.title, currentSlide.content)
  const progressPercent = ((currentSlideIndex + 1) / activeSlides.length) * 100

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2">
      <div className="mx-auto max-w-3xl px-4">
        <motion.div
          className="rounded-xl overflow-hidden border border-emerald-200/80 dark:border-emerald-800/60 glass-subtle"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Trigger header */}
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-100/30 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer">
            <div className="flex items-center gap-2.5">
              {/* Course icon with gradient bg */}
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm shadow-emerald-500/20">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Course Context
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-emerald-200/70 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 font-semibold tabular-nums"
                  >
                    {currentSlideIndex + 1}/{activeSlides.length}
                  </Badge>
                </div>
              </div>
            </div>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
          </CollapsibleTrigger>

          {/* Mini progress bar */}
          <div className="h-0.5 bg-emerald-100 dark:bg-emerald-900/40">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            />
          </div>

          {/* Collapsible content */}
          <AnimatePresence>
            {isOpen && (
              <CollapsibleContent forceMount>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <div className="px-4 pb-4 pt-2">
                    {/* Slide title */}
                    <h3 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-500" />
                      {currentSlide.title}
                    </h3>

                    {/* Topic tags */}
                    {topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2.5">
                        <Tag className="w-3 h-3 text-muted-foreground mt-0.5" />
                        {topics.map((topic, idx) => (
                          <motion.span
                            key={topic}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${TAG_COLORS[idx % TAG_COLORS.length]}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05, type: 'spring', stiffness: 350, damping: 25 }}
                          >
                            {topic}
                          </motion.span>
                        ))}
                      </div>
                    )}

                    {/* Scrollable content preview */}
                    <div
                      className="max-h-[180px] overflow-y-auto rounded-lg border border-emerald-200/60 dark:border-emerald-800/40 bg-white/60 dark:bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground"
                    >
                      <div
                        dangerouslySetInnerHTML={{ __html: highlightedContent }}
                      />
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex items-center justify-between mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs rounded-lg gradient-border transition-shadow hover:shadow-md hover:shadow-emerald-500/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isFirst) setCurrentSlideIndex(currentSlideIndex - 1)
                        }}
                        disabled={isFirst}
                      >
                        <ChevronLeft className="w-3 h-3 mr-1" />
                        Previous
                      </Button>

                      {/* Dot indicators */}
                      <div className="flex gap-1">
                        {activeSlides.map((_, idx) => (
                          <motion.button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation()
                              setCurrentSlideIndex(idx)
                            }}
                            className="rounded-full transition-all cursor-pointer"
                            animate={{
                              width: idx === currentSlideIndex ? 12 : 6,
                              height: 6,
                              backgroundColor: idx === currentSlideIndex
                                ? 'var(--color-primary)'
                                : idx < currentSlideIndex
                                  ? 'oklch(0.7 0.15 155)'
                                  : 'var(--color-muted)',
                            }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            aria-label={`Go to slide ${idx + 1}`}
                          />
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs rounded-lg gradient-border transition-shadow hover:shadow-md hover:shadow-emerald-500/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isLast) setCurrentSlideIndex(currentSlideIndex + 1)
                        }}
                        disabled={isLast}
                      >
                        Next
                        <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </CollapsibleContent>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </Collapsible>
  )
}