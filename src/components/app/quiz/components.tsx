'use client';

/**
 * Self-contained quiz subcomponents (confetti, stars, matching drag-and-drop,
 * error-correction input, weakness report dialog) — extracted from
 * QuizView.tsx to keep the main component file manageable.
 */
import { aiFetch } from '@/lib/aiKey';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Sparkles,
  AlertTriangle,
  BookOpen,
  GripVertical,
  Zap,
  Lightbulb,
  Copy,
  Brain,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Question, LearnerProfile } from '@/types';
import { gradeFillBlank, type FillBlankGrade } from './helpers';

// ---------- Confetti particle ----------
export function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const x = Math.random() * 300 - 150;
  const y = -(Math.random() * 200 + 100);
  const rotation = Math.random() * 720 - 360;
  const scale = Math.random() * 0.5 + 0.5;

  return (
    <motion.div
      initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale }}
      animate={{
        opacity: 0,
        x,
        y,
        rotate: rotation,
        scale: scale * 0.3,
      }}
      transition={{ duration: 1.2, delay, ease: 'easeOut' }}
      className="absolute h-3 w-3 rounded-sm pointer-events-none"
      style={{ backgroundColor: color, top: '40%', left: '50%' }}
    />
  );
}

export const CONFETTI_COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#ffffff', '#06b6d4', '#f97316', '#22c55e', '#ec4899'];

export const DAILY_CONFETTI_COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#ffffff'];
export const DAILY_TIMER_SECONDS = 180; // 3 minutes

export function getScoreMultiplier(streak: number): number {
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  return 1;
}

export function getStars(score: number, total: number): number {
  const pct = total > 0 ? score / total : 0;
  if (pct >= 0.8) return 3;
  if (pct >= 0.5) return 2;
  if (pct > 0) return 1;
  return 0;
}

// Star component with bounce animation
export function Star({ filled, delay }: { filled: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: filled ? 1 : 0.8, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 12, delay }}
    >
      <motion.div
        animate={filled ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.4, delay: delay + 0.2 }}
        className={filled ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]' : 'text-muted-foreground/30'}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </motion.div>
    </motion.div>
  );
}

// ---------- Animated counter hook ----------
export function useAnimatedCounter(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return count;
}

// ---------- Type badge gradient map ----------
export const TYPE_BADGE_GRADIENT: Record<string, string> = {
  multiple_choice: 'bg-linear-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  true_false: 'bg-linear-to-r from-amber-500/15 to-orange-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  short_answer: 'bg-linear-to-r from-cyan-500/15 to-sky-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
  fill_blank: 'bg-linear-to-r from-violet-500/15 to-purple-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20',
  matching: 'bg-linear-to-r from-rose-500/15 to-pink-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
  error_correction: 'bg-linear-to-r from-red-500/15 to-destructive/15 text-red-700 dark:text-red-300 border-red-500/20',
};

// ---------- Error correction component ----------
export function ErrorCorrectionInput({
  errorText,
  onAnswer,
}: {
  errorText: string;
  onAnswer: (answer: string) => void;
}) {
  const [correction, setCorrection] = useState('');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">Statement with errors:</span>
        </div>
        <p className="text-sm leading-relaxed">{errorText}</p>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Your corrected version:</p>
        <textarea
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          placeholder="Type the corrected statement here..."
        />
        <Button
          onClick={() => onAnswer(correction)}
          disabled={!correction.trim()}
          size="sm"
          className="mt-2"
        >
          Submit Correction
        </Button>
      </div>
    </div>
  );
}

// ---------- Matching question component (drag-and-drop with SVG connectors) ----------
export function MatchingInput({
  pairs,
  onAnswer,
}: {
  pairs: Array<{ left: string; right: string }>;
  onAnswer: (answer: string) => void;
}) {
  const shuffledRight = useMemo(() => {
    const arr = [...pairs.map((p) => p.right)];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [pairs]);

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [linePositions, setLinePositions] = useState<Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build index maps for safe DOM queries
  const leftIdxMap = useMemo(() => {
    const map: Record<string, number> = {};
    pairs.forEach((p, i) => { map[p.left] = i; });
    return map;
  }, [pairs]);

  const rightIdxMap = useMemo(() => {
    const map: Record<string, number> = {};
    shuffledRight.forEach((r, i) => { map[r] = i; });
    return map;
  }, [shuffledRight]);

  // Compute SVG connector line positions
  const updateLinePositions = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const positions: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];

      for (const [left, right] of Object.entries(matches)) {
        const lIdx = leftIdxMap[left];
        const rIdx = rightIdxMap[right];
        if (lIdx === undefined || rIdx === undefined) continue;

        const leftEl = container.querySelector(`[data-left-idx="${lIdx}"]`);
        const rightEl = container.querySelector(`[data-right-idx="${rIdx}"]`);

        if (leftEl && rightEl) {
          const leftRect = leftEl.getBoundingClientRect();
          const rightRect = rightEl.getBoundingClientRect();

          positions.push({
            id: `${left}-${right}`,
            x1: leftRect.right - containerRect.left,
            y1: leftRect.top + leftRect.height / 2 - containerRect.top,
            x2: rightRect.left - containerRect.left,
            y2: rightRect.top + rightRect.height / 2 - containerRect.top,
          });
        }
      }

      setLinePositions(positions);
    });
  }, [matches, leftIdxMap, rightIdxMap]);

  // Recalculate on matches change
  useEffect(() => {
    updateLinePositions();
  }, [updateLinePositions]);

  // Recalculate on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(updateLinePositions);
    observer.observe(container);

    return () => observer.disconnect();
  }, [updateLinePositions]);

  const handleLeftClick = (left: string) => {
    if (matches[left]) {
      // Remove match by clicking connected left item
      setMatches((prev) => {
        const next = { ...prev };
        delete next[left];
        return next;
      });
      return;
    }
    setSelectedLeft(left);
  };

  const handleRightClick = (right: string) => {
    if (!selectedLeft) return;
    setMatches((prev) => ({ ...prev, [selectedLeft]: right }));
    setSelectedLeft(null);
  };

  const handleDragStart = (e: React.DragEvent, left: string) => {
    setDragItem(left);
    e.dataTransfer.setData('text/plain', left);
    e.dataTransfer.effectAllowed = 'link';
  };

  const handleDragOver = (e: React.DragEvent, right: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    const isUsedByOther = Object.entries(matches).some(
      ([k, v]) => v === right && k !== dragItem,
    );
    if (dragItem && !isUsedByOther) {
      setDragOverTarget(right);
    }
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = (e: React.DragEvent, right: string) => {
    e.preventDefault();
    const left = e.dataTransfer.getData('text/plain') || dragItem;
    if (left) {
      // Remove any existing match for this left item first
      setMatches((prev) => {
        const next = { ...prev };
        delete next[left];
        next[left] = right;
        return next;
      });
    }
    setDragItem(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverTarget(null);
  };

  const handleSubmit = () => {
    const answer = Object.entries(matches)
      .map(([l, r]) => `${l}-${r}`)
      .join(', ');
    onAnswer(answer);
  };

  const allMatched = pairs.every((p) => matches[p.left]);
  const usedRights = new Set(Object.values(matches));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Drag left items to their match on the right, or click to select. Click a connected left item to remove it.
      </p>
      <div ref={containerRef} className="relative grid grid-cols-2 gap-4">
        {/* SVG Connector Overlay */}
        <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="connectorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
          </defs>
          <AnimatePresence>
            {linePositions.map((pos) => {
              const midX = (pos.x1 + pos.x2) / 2;
              return (
                <motion.path
                  key={pos.id}
                  d={`M ${pos.x1} ${pos.y1} C ${midX} ${pos.y1}, ${midX} ${pos.y2}, ${pos.x2} ${pos.y2}`}
                  fill="none"
                  stroke="url(#connectorGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.85 }}
                  exit={{ pathLength: 0, opacity: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              );
            })}
          </AnimatePresence>
        </svg>

        {/* Left column */}
        <div className="flex flex-col gap-2">
          {pairs.map((p) => {
            const isMatched = !!matches[p.left];
            const isDragging = dragItem === p.left;
            return (
              <motion.button
                key={p.left}
                data-left-idx={leftIdxMap[p.left]}
                draggable={!isMatched}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleLeftClick(p.left)}
                onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, p.left)}
                onDragEnd={handleDragEnd}
                className={`rounded-lg border p-3 text-left text-sm font-medium transition-all ${
                  isDragging
                    ? 'border-primary/50 bg-primary/5 opacity-50 scale-95'
                    : selectedLeft === p.left
                      ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30 shadow-sm shadow-primary/10'
                      : isMatched
                        ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/5'
                        : 'border-border hover:border-primary/30 hover:bg-primary/5 cursor-grab active:cursor-grabbing'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="flex-1">{p.left}</span>
                  {isMatched && (
                    <motion.span
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs opacity-70 truncate max-w-30 text-emerald-600 dark:text-emerald-400"
                    >
                      {matches[p.left]}
                    </motion.span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
        {/* Right column */}
        <div className="flex flex-col gap-2">
          {shuffledRight.map((r) => {
            const isUsed = usedRights.has(r);
            const isDragOver = dragOverTarget === r && !isUsed;
            return (
              <motion.button
                key={r}
                data-right-idx={rightIdxMap[r]}
                whileTap={{ scale: 0.98 }}
                onClick={() => !isUsed && handleRightClick(r)}
                onDragOver={(e) => handleDragOver(e, r)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, r)}
                disabled={isUsed}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  isDragOver
                    ? 'border-emerald-500/60 bg-emerald-500/10 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                    : isUsed
                      ? 'border-border bg-muted/50 text-muted-foreground line-through opacity-50'
                      : selectedLeft
                        ? 'border-border hover:border-primary/30 hover:bg-primary/5 cursor-pointer hover:shadow-sm hover:shadow-primary/5'
                        : 'border-border opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="flex-1">{r}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 w-24 rounded-full bg-muted/50 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: 'linear-gradient(90deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89))' }}
              animate={{ width: `${(Object.keys(matches).length / pairs.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {Object.keys(matches).length}/{pairs.length} matched
          </span>
        </div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button onClick={handleSubmit} disabled={!allMatched} size="sm" className={allMatched ? 'glow-emerald' : ''}>
            Submit Matches
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

// ---------- Error Analysis Types ----------

export interface ErrorAnalysisResponse {
  summary: string;
  errorPatterns: Array<{
    pattern: string;
    frequency: number;
    severity: string;
    concepts: string[];
  }>;
  weakAreas: Array<{
    concept: string;
    masteryEstimate: number;
    errorType: string;
    remediation: string;
    resources: string[];
  }>;
  studyPriority: string[];
  encouragement: string;
}

export const ERROR_REPORT_STORAGE_KEY = 'synapse-error-report';

// ---------- Weakness Report Dialog ----------

export function WeaknessReportDialog({
  open,
  onOpenChange,
  report,
  loading,
  onStartReview,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  report: ErrorAnalysisResponse | null;
  loading: boolean;
  onStartReview: (topic: string) => void;
}) {
  const [expandedArea, setExpandedArea] = useState<string | null>(null);

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      default: return 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
    }
  };

  const errorTypeColor = (type: string) => {
    switch (type) {
      case 'misconception': return 'bg-red-500/10 text-red-600 dark:text-red-400';
      case 'gap': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
      case 'vocabulary': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'careless': return 'bg-teal-500/10 text-teal-600 dark:text-teal-400';
      case 'partial': return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const masteryBarColor = (level: number) => {
    if (level <= 1) return 'from-red-500 to-red-400';
    if (level <= 2) return 'from-orange-500 to-amber-500';
    if (level <= 3) return 'from-amber-500 to-yellow-400';
    if (level <= 4) return 'from-teal-400 to-emerald-400';
    return 'from-emerald-500 to-teal-500';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Weakness Analysis Report
          </DialogTitle>
          <DialogDescription>
            AI-powered analysis of your incorrect answers
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full bg-primary/20"
                />
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                  className="absolute -inset-3 rounded-full bg-primary/10"
                />
                <Brain className="h-10 w-10 text-primary relative z-10" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">Analyzing your mistakes...</p>
                <p className="text-xs text-muted-foreground">AI is identifying patterns and generating recommendations</p>
              </div>
            </div>
          ) : report ? (
            <>
              {/* Summary */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="glass rounded-xl p-4 card-hover-scale"
              >
                <h4 className="text-sm font-semibold mb-2">Overall Assessment</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
              </motion.div>

              {/* Error Patterns */}
              {report.errorPatterns.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
                  className="space-y-3"
                >
                  <h4 className="text-sm font-semibold">Error Patterns</h4>
                  <div className="space-y-2">
                    {report.errorPatterns.map((ep, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 350, damping: 25 }}
                        className="glass rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm flex-1">{ep.pattern}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-[10px] ${severityColor(ep.severity)}`}>
                              {ep.severity}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px]">
                              {ep.frequency}x
                            </Badge>
                          </div>
                        </div>
                        {ep.concepts.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {ep.concepts.map((c, j) => (
                              <Badge key={j} variant="outline" className="text-[10px] text-primary border-primary/20">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Weak Areas */}
              {report.weakAreas.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.2 }}
                  className="space-y-3"
                >
                  <h4 className="text-sm font-semibold">Weak Areas</h4>
                  <div className="space-y-2">
                    {report.weakAreas.map((wa, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 + i * 0.08, type: 'spring', stiffness: 350, damping: 25 }}
                        className="glass rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => setExpandedArea(expandedArea === wa.concept ? null : wa.concept)}
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{wa.concept}</span>
                              <Badge variant="outline" className={`text-[10px] ${errorTypeColor(wa.errorType)}`}>
                                {wa.errorType}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 w-full">
                              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(wa.masteryEstimate / 5) * 100}%` }}
                                  transition={{ duration: 0.8, delay: 0.3 + i * 0.08 }}
                                  className={`h-full rounded-full bg-linear-to-r ${masteryBarColor(wa.masteryEstimate)}`}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0 w-5 text-right">
                                {wa.masteryEstimate}/5
                              </span>
                            </div>
                          </div>
                          {expandedArea === wa.concept ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </button>
                        <AnimatePresence>
                          {expandedArea === wa.concept && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-3">
                                <p className="text-sm text-muted-foreground leading-relaxed">{wa.remediation}</p>
                                {wa.resources.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">Suggested Resources</p>
                                    <ul className="space-y-1">
                                      {wa.resources.map((r, j) => (
                                        <li key={j} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                                          {r}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Study Priority */}
              {report.studyPriority.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.35 }}
                  className="space-y-3"
                >
                  <h4 className="text-sm font-semibold">Study Priority</h4>
                  <div className="glass rounded-lg p-3 space-y-2">
                    {report.studyPriority.slice(0, 3).map((topic, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.1, type: 'spring', stiffness: 350, damping: 25 }}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold">
                          {i + 1}
                        </div>
                        <span className="text-sm">{topic}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Encouragement */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-center pt-2 pb-1"
              >
                <p className="text-sm font-medium gradient-text">{report.encouragement}</p>
              </motion.div>
            </>
          ) : null}
        </div>

        {!loading && report && (
          <DialogFooter className="px-6 pb-6 flex gap-2">
            {report.studyPriority.length > 0 && (
              <Button
                onClick={() => {
                  onStartReview(report.studyPriority[0]);
                  onOpenChange(false);
                }}
                className="glow-emerald"
              >
                <Brain className="h-4 w-4 mr-2" />
                Start Review Session
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

