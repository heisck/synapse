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
} from 'lucide-react'

/**
 * Highlights key terms in slide content by wrapping them in <mark> tags.
 * A "key term" heuristic: capitalized multi-word phrases, or words that are
 * 3+ chars and start with a capital letter (ignoring sentence-start).
 */
function highlightKeyTerms(text: string): string {
  // Split into sentences to avoid false positives on sentence-start words
  const sentences = text.split(/(?<=[.!?])\s+/)
  return sentences
    .map((sentence) => {
      // Match multi-word capitalized phrases (e.g., "Machine Learning")
      // Also match standalone capitalized words that aren't at the start
      const result = sentence.replace(
        /(?<=\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|[A-Z][a-z]{3,})/g,
        '<mark class="bg-emerald-200 dark:bg-emerald-800/50 text-emerald-900 dark:text-emerald-100 px-0.5 rounded-sm">$1</mark>'
      )
      return result
    })
    .join(' ')
}

export function CourseContextPanel() {
  const activeSlides = useAppStore((s) => s.activeSlides)
  const currentSlideIndex = useAppStore((s) => s.currentSlideIndex)
  const setCurrentSlideIndex = useAppStore((s) => s.setCurrentSlideIndex)

  const [isOpen, setIsOpen] = useState(true)

  // Don't render if no slides loaded
  if (activeSlides.length === 0) return null

  const currentSlide = activeSlides[currentSlideIndex]
  if (!currentSlide) return null

  const isFirst = currentSlideIndex === 0
  const isLast = currentSlideIndex === activeSlides.length - 1

  const highlightedContent = highlightKeyTerms(currentSlide.content)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2">
      <div className="mx-auto max-w-3xl px-4">
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 overflow-hidden">
          {/* Trigger header */}
          <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Course Context
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 bg-emerald-200/70 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300 font-medium"
              >
                Slide {currentSlideIndex + 1} of {activeSlides.length}
              </Badge>
            </div>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
          </CollapsibleTrigger>

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
                  <div className="px-3 pb-3">
                    {/* Slide title */}
                    <h3 className="text-sm font-semibold text-foreground mb-1.5">
                      {currentSlide.title}
                    </h3>

                    {/* Scrollable content preview */}
                    <div
                      className="max-h-[200px] overflow-y-auto rounded-md border border-emerald-200/60 dark:border-emerald-800/40 bg-white/60 dark:bg-background/60 p-2.5 text-xs leading-relaxed text-muted-foreground prose-xs"
                    >
                      <div
                        dangerouslySetInnerHTML={{ __html: highlightedContent }}
                      />
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex items-center justify-between mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isFirst) setCurrentSlideIndex(currentSlideIndex - 1)
                        }}
                        disabled={isFirst}
                      >
                        <ChevronLeft className="w-3 h-3 mr-1" />
                        Previous
                      </Button>
                      <div className="flex gap-1">
                        {activeSlides.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation()
                              setCurrentSlideIndex(idx)
                            }}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                              idx === currentSlideIndex
                                ? 'bg-emerald-600 dark:bg-emerald-400 w-3'
                                : 'bg-emerald-300 dark:bg-emerald-700 hover:bg-emerald-400 dark:hover:bg-emerald-600'
                            }`}
                            aria-label={`Go to slide ${idx + 1}`}
                          />
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs"
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
        </div>
      </div>
    </Collapsible>
  )
}
