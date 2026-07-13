'use client';

/**
 * Global quiz-generation progress bar — a thin top-of-viewport fill shown
 * whenever a fresh question batch is being generated, regardless of which page
 * triggered it (course card, quiz page, or the tutor "setting up your quiz").
 * Reads the single store value driven by lib/quizProgress.ts, so the learner
 * always sees a consistent 0→100 instead of a dead spinner.
 */

import { useAppStore } from '@/stores/appStore';

export function QuizGenProgressBar() {
  const pct = useAppStore((s) => s.quizGenProgress);
  if (pct == null) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] h-0.5 pointer-events-none"
      role="progressbar"
      aria-label="Preparing quiz"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div
        className="h-full bg-primary shadow-[0_0_10px_rgba(0,0,0,0)] shadow-primary/60 transition-[width] duration-200 ease-out"
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}
