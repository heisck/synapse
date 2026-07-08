'use client';

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  ArrowLeft,
  Trophy,
  Sparkles,
  AlertTriangle,
  BookOpen,
  GripVertical,
  Flame,
  Zap,
  Shuffle,
  Layers,
  HelpCircle,
  Lightbulb,
  Clock,
  Copy,
  Calendar,
  Bookmark,
  BookmarkCheck,
  Brain,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAppStore } from '@/stores/appStore';
import { useSpacedRepetition } from '@/hooks/useSpacedRepetition';
import { toast } from 'sonner';
import type { Question, AdaptiveResult, LearnerProfile } from '@/types';

type StudyMode = 'quiz' | 'flashcard' | 'daily' | 'review';

// ---------- Levenshtein distance (standard DP) ----------
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0) as number[]);
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[n][m];
}

function isFuzzyMatch(userAnswer: string, correctAnswer: string, maxDistance: number = 2): boolean {
  const ua = userAnswer.trim().toLowerCase();
  const ca = correctAnswer.trim().toLowerCase();
  if (ua === ca) return true;
  if (ua.includes(ca) || ca.includes(ua)) return true;
  // Levenshtein distance for typo tolerance
  const dist = levenshtein(ua, ca);
  // Allow 1 typo for short answers, 2 for longer ones
  const threshold = maxDistance || (ca.length <= 4 ? 1 : 2);
  if (dist <= threshold) return true;
  // Word-level check: all words of correct answer present in user answer (in any order)
  const correctWords = ca.split(/\s+/);
  const userWords = ua.split(/\s+/);
  if (correctWords.every((w) => userWords.some((uw) => uw.includes(w) || w.includes(uw)))) return true;
  return false;
}

// ---------- Fill-in-blank grading with Levenshtein tolerance ----------
// Case-insensitive, trimmed comparison with partial credit for typos:
//   Exact match → 100% (or 75% if hint used)
//   Levenshtein ≤ 2 → 80% (× 0.75 if hint)
//   Levenshtein ≤ 3 → 50% (× 0.75 if hint)
//   Otherwise → 0
type FillBlankGrade = { status: 'correct' | 'close' | 'wrong'; points: number; message: string };

function gradeFillBlank(userAnswer: string, correctAnswer: string, hintUsed: boolean = false): FillBlankGrade {
  const ua = userAnswer.trim().toLowerCase();
  const ca = correctAnswer.trim().toLowerCase();
  if (ua === ca) {
    return { status: 'correct', points: hintUsed ? 0.75 : 1, message: '' };
  }
  const dist = levenshtein(ua, ca);
  let basePoints = 0;
  if (dist <= 2) basePoints = 0.8;
  else if (dist <= 3) basePoints = 0.5;
  if (basePoints > 0) {
    return { status: 'close', points: basePoints * (hintUsed ? 0.75 : 1), message: `Close! Did you mean: "${correctAnswer}"?` };
  }
  return { status: 'wrong', points: 0, message: '' };
}

// ---------- Timer helper ----------
function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ---------- Course filter ----------
interface DailyChallengeData {
  date: string;
  completed: boolean;
  score: number;
  total: number;
  questions: string[];
}

const DAILY_STORAGE_KEY = 'synapse-daily-challenge';
const DAILY_STREAK_KEY = 'synapse-daily-streak';
const DAILY_QUESTION_COUNT = 5;

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function loadDailyChallenge(): DailyChallengeData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDailyChallenge(data: DailyChallengeData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable
  }
}

function loadDailyStreak(): { current: number; best: number; lastDate: string } {
  if (typeof window === 'undefined') return { current: 0, best: 0, lastDate: '' };
  try {
    const raw = localStorage.getItem(DAILY_STREAK_KEY);
    return raw ? JSON.parse(raw) : { current: 0, best: 0, lastDate: '' };
  } catch {
    return { current: 0, best: 0, lastDate: '' };
  }
}

function saveDailyStreak(data: { current: number; best: number; lastDate: string }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable
  }
}

function updateDailyStreak(): { current: number; best: number; lastDate: string } {
  const streak = loadDailyStreak();
  const today = getTodayStr();

  if (streak.lastDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newCurrent: number;
  if (streak.lastDate === yesterdayStr) {
    newCurrent = streak.current + 1;
  } else {
    newCurrent = 1;
  }

  const newBest = Math.max(streak.best, newCurrent);
  const updated = { current: newCurrent, best: newBest, lastDate: today };
  saveDailyStreak(updated);
  return updated;
}

function getTimeUntilMidnight(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function selectDailyQuestions(allQs: Question[]): Question[] {
  const seed = new Date().toISOString().split('T')[0];
  const hash = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  // Seeded pseudo-random shuffle
  const indexed = allQs.map((q, i) => ({ q, sortKey: ((hash * (i + 1) * 2654435761) >>> 0) % 100000 }));
  indexed.sort((a, b) => a.sortKey - b.sortKey);
  return indexed.slice(0, DAILY_QUESTION_COUNT).map((x) => x.q);
}

const COURSE_QUIZ_GROUPS = [
  { id: 'all', label: 'All Questions', icon: BookOpen },
  { id: 'demo-course', label: 'Cell Biology', icon: BookOpen },
  { id: 'cs-course', label: 'Computer Science', icon: BookOpen },
];

// ---------- Adaptive Difficulty Helpers ----------
const ADAPTIVE_STORAGE_KEY = 'synapse-adaptive-results';

function loadAdaptiveResults(): AdaptiveResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ADAPTIVE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAdaptiveResults(results: AdaptiveResult[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify(results));
  } catch {
    // storage unavailable
  }
}

interface AdaptiveScoringInput {
  question: Question;
  masteryMap: Record<string, { level: number; evidence: string[]; lastAssessed: number; attempts: number }>;
  adaptiveResults: AdaptiveResult[];
  dueConcepts: Set<string>;
}

interface ScoredQuestion {
  question: Question;
  score: number;
  reasons: string[];
}

function scoreQuestionForAdaptive(input: AdaptiveScoringInput): ScoredQuestion {
  const { question, masteryMap, adaptiveResults, dueConcepts } = input;
  let score = 0;
  const reasons: string[] = [];
  const concept = question.concept || 'Unknown';
  const mastery = masteryMap[concept];

  // 1. Low mastery bonus (level 1-2)
  if (mastery && mastery.level < 3) {
    score += 3;
    reasons.push('low mastery');
  }

  // 2. Spaced repetition due for review
  if (dueConcepts.has(concept)) {
    score += 2;
    reasons.push('needs review');
  }

  // 3. Recent performance: last 5 results on concept
  const conceptResults = adaptiveResults
    .filter((r) => r.concept === concept)
    .slice(-5);
  const last3 = conceptResults.slice(-3);
  const wrongCount = last3.filter((r) => !r.correct).length;
  const correctCount = conceptResults.filter((r) => r.correct).length;

  if (wrongCount >= 2) {
    score += 2;
    reasons.push('recent struggles');
  }

  // 4. Difficulty match bonus
  const targetLevel = mastery ? Math.min(mastery.level + 1, 3) : 1;
  const targetDifficulty = targetLevel === 1 ? 'easy' : targetLevel === 2 ? 'medium' : 'hard';
  if (question.difficulty === targetDifficulty) {
    score += 1;
  } else if (
    (targetDifficulty === 'medium' && question.difficulty === 'easy') ||
    (targetDifficulty === 'hard' && question.difficulty === 'medium')
  ) {
    score += 0.5;
  }

  // 5. Boost for concepts with many wrong answers (weaker areas)
  if (correctCount >= 3) {
    score += 1;
    reasons.push('ready for harder questions');
  }

  return { question, score, reasons };
}

function getAdaptiveReasoning(scored: ScoredQuestion[]): string {
  if (scored.length === 0) return '';

  const conceptReasons = new Map<string, string[]>();
  for (const sq of scored.slice(0, 5)) {
    const concept = sq.question.concept || 'Unknown';
    const existing = conceptReasons.get(concept) || [];
    conceptReasons.set(concept, [...existing, ...sq.reasons]);
  }

  const parts: string[] = [];
  for (const [concept, reasons] of conceptReasons) {
    const uniqueReasons = [...new Set(reasons)];
    const desc = uniqueReasons.map((r) => {
      switch (r) {
        case 'low mastery': return 'low mastery';
        case 'needs review': return 'needs review';
        case 'recent struggles': return 'struggling recently';
        case 'ready for harder questions': return 'ready for challenge';
        default: return r;
      }
    }).join(', ');
    parts.push(`${concept} (${desc})`);
  }

  return 'Focusing on: ' + parts.join(', ');
}

// ---------- Confetti particle ----------
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
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

const CONFETTI_COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#ffffff', '#06b6d4', '#f97316', '#22c55e', '#ec4899'];

const DAILY_CONFETTI_COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#ffffff'];
const DAILY_TIMER_SECONDS = 180; // 3 minutes

function getScoreMultiplier(streak: number): number {
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  return 1;
}

function getStars(score: number, total: number): number {
  const pct = total > 0 ? score / total : 0;
  if (pct >= 0.8) return 3;
  if (pct >= 0.5) return 2;
  if (pct > 0) return 1;
  return 0;
}

// Star component with bounce animation
function Star({ filled, delay }: { filled: boolean; delay: number }) {
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
function useAnimatedCounter(target: number, duration: number = 1200) {
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
const TYPE_BADGE_GRADIENT: Record<string, string> = {
  multiple_choice: 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  true_false: 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20',
  short_answer: 'bg-gradient-to-r from-cyan-500/15 to-sky-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
  fill_blank: 'bg-gradient-to-r from-violet-500/15 to-purple-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20',
  matching: 'bg-gradient-to-r from-rose-500/15 to-pink-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20',
  error_correction: 'bg-gradient-to-r from-red-500/15 to-destructive/15 text-red-700 dark:text-red-300 border-red-500/20',
};

// ---------- Error correction component ----------
function ErrorCorrectionInput({
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
function MatchingInput({
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
                      className="text-xs opacity-70 truncate max-w-[120px] text-emerald-600 dark:text-emerald-400"
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

interface ErrorAnalysisResponse {
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

const ERROR_REPORT_STORAGE_KEY = 'synapse-error-report';

// ---------- Weakness Report Dialog ----------

function WeaknessReportDialog({
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
                                  className={`h-full rounded-full bg-gradient-to-r ${masteryBarColor(wa.masteryEstimate)}`}
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
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold">
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

// ---------- Main QuizView ----------
export function QuizView() {
  const { navigate, currentQuestions, activeCourse, updateMastery, adaptiveResults, addAdaptiveResult, masteryMap } = useAppStore();

  const allQuestions = currentQuestions;

  const [studyMode, setStudyMode] = useState<StudyMode>('quiz');
  const [adaptiveOn, setAdaptiveOn] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const [showBonusPopup, setShowBonusPopup] = useState(false);
  const [hintsUsed, setHintsUsed] = useState<Record<string, boolean>>({});
  const [fillBlankValues, setFillBlankValues] = useState<Record<string, string>>({});
  const [fillBlankGrades, setFillBlankGrades] = useState<Record<string, FillBlankGrade>>({});
  const [weaknessReportOpen, setWeaknessReportOpen] = useState(false);
  const [weaknessReportLoading, setWeaknessReportLoading] = useState(false);
  const [weaknessReport, setWeaknessReport] = useState<ErrorAnalysisResponse | null>(null);
  const [lastReportExists] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !!localStorage.getItem(ERROR_REPORT_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  // Spaced Repetition
  const { dueItems, reviewItem, overdueCount } = useSpacedRepetition();
  const [reviewShowResults, setReviewShowResults] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Adaptive difficulty: compute adaptive questions and reasoning
  const dueConcepts = useMemo(() => new Set(dueItems.map((item) => item.questionId)), [dueItems]);

  const { adaptiveQuestions, adaptiveReasoning } = useMemo(() => {
    if (!adaptiveOn || studyMode !== 'quiz') {
      return { adaptiveQuestions: null as Question[] | null, adaptiveReasoning: '' };
    }

    // Load additional adaptive results from localStorage for richer history
    const localStorageResults = loadAdaptiveResults();
    const allAdaptiveResults = [...localStorageResults, ...adaptiveResults];

    const pool = selectedCourse === 'all' ? allQuestions : allQuestions.filter((q) => q.courseId === selectedCourse);

    const scored = pool
      .filter((q) => q.concept)
      .map((q) => scoreQuestionForAdaptive({
        question: q,
        masteryMap,
        adaptiveResults: allAdaptiveResults,
        dueConcepts,
      }))
      .sort((a, b) => b.score - a.score);

    const top10 = scored.slice(0, 10).map((s) => s.question);
    const reasoning = getAdaptiveReasoning(scored);

    return { adaptiveQuestions: top10, adaptiveReasoning: reasoning };
  }, [adaptiveOn, studyMode, selectedCourse, allQuestions, masteryMap, adaptiveResults, dueConcepts]);

  // Review questions: match dueItems to actual questions by concept
  const reviewQuestions = useMemo<Question[]>(() => {
    const dueConcepts = new Set(dueItems.map((item) => item.questionId));
    return allQuestions.filter((q) => q.concept && dueConcepts.has(q.concept));
  }, [dueItems, allQuestions]);

  const reviewCurrentQ = reviewQuestions[currentIndex];
  const reviewProgress = reviewQuestions.length > 0
    ? (reviewedCount / reviewQuestions.length) * 100
    : 0;

  // Listen for start-spaced-review custom event
  useEffect(() => {
    const handler = () => setStudyMode('review');
    window.addEventListener('start-spaced-review', handler);
    return () => window.removeEventListener('start-spaced-review', handler);
  }, []);

  // Daily Challenge state
  const { dailyChallenge: storeDailyChallenge, setDailyChallenge: setStoreDailyChallenge } = useAppStore();
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeData | null>(null);
  const [dailyStreak, setDailyStreak] = useState({ current: 0, best: 0, lastDate: '' });
  const [dailyTimeLeft, setDailyTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [dailyShowResults, setDailyShowResults] = useState(false);
  const [dailyShareCopied, setDailyShareCopied] = useState(false);
  const [dailyTimerLeft, setDailyTimerLeft] = useState(DAILY_TIMER_SECONDS);
  const [dailyTimerActive, setDailyTimerActive] = useState(false);

  const handleViewLastReport = useCallback(() => {
    try {
      const stored = localStorage.getItem(ERROR_REPORT_STORAGE_KEY);
      if (stored) {
        const data: ErrorAnalysisResponse = JSON.parse(stored);
        setWeaknessReport(data);
        setWeaknessReportOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleStartReviewFromReport = useCallback((topic: string) => {
    const { setActiveTopic, navigate: nav } = useAppStore.getState();
    setActiveTopic(topic);
    nav('tutor');
  }, []);

  const isCorrect = useCallback(
    (q: Question, userAnswer: string): boolean => {
      const ua = userAnswer.trim().toLowerCase();
      const ca = q.answer.trim().toLowerCase();
      if (q.type === 'short_answer' || q.type === 'error_correction') {
        return isFuzzyMatch(userAnswer, q.answer, 3);
      }
      if (q.type === 'fill_blank') {
        return userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
      }
      return ua === ca;
    },
    [],
  );

  const dailyQuestions = useMemo<Question[]>(() => {
    if (dailyChallenge?.questions) {
      return dailyChallenge.questions
        .map((id) => allQuestions.find((q) => q.id === id))
        .filter((q): q is Question => !!q);
    }
    return [];
  }, [dailyChallenge, allQuestions]);
  const dailyCurrentQ = dailyQuestions[currentIndex];
  const dailyProgress = dailyQuestions.length > 0
    ? ((currentIndex + 1) / dailyQuestions.length) * 100
    : 0;
  const dailyScore = useMemo(() => {
    return dailyQuestions.filter((q) => answered[q.id] && isCorrect(q, answers[q.id] || '')).length;
  }, [dailyQuestions, answered, answers, isCorrect]);
  const dailyCircumference = 2 * Math.PI * 62;
  const dailyScorePercent = dailyQuestions.length > 0 ? dailyScore / dailyQuestions.length : 0;
  const dailyStrokeDashoffset = dailyCircumference * (1 - dailyScorePercent);
  const dailyAnimatedScore = useAnimatedCounter(dailyShowResults ? dailyScore : 0, 1500);
  const dailyMultiplier = getScoreMultiplier(dailyStreak.current);
  const dailyStars = getStars(dailyScore, dailyQuestions.length);
  const dailyTimerCircumference = 2 * Math.PI * 28;
  const dailyTimerPercent = dailyTimerLeft / DAILY_TIMER_SECONDS;
  const dailyTimerStroke = dailyTimerCircumference * (1 - dailyTimerPercent);

  // Validate streak from store on mount
  useEffect(() => {
    const dc = storeDailyChallenge;
    if (!dc.lastCompletedDate) return;
    const today = getTodayStr();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (dc.lastCompletedDate !== today && dc.lastCompletedDate !== yesterdayStr) {
      setStoreDailyChallenge({ streak: 0 });
    }
  }, []);

  // Load daily challenge data on mount and when mode changes
  useEffect(() => {
    if (studyMode !== 'daily') return;
    const today = getTodayStr();
    const saved = loadDailyChallenge();
    const streakData = loadDailyStreak();
    // Use store streak as source of truth if available
    const effectiveStreak = storeDailyChallenge.streak > 0 ? { current: storeDailyChallenge.streak, best: Math.max(storeDailyChallenge.streak, streakData.best), lastDate: storeDailyChallenge.lastCompletedDate || streakData.lastDate } : streakData;

    if (saved && saved.date === today) {
      setDailyChallenge(saved);
      setDailyStreak(effectiveStreak);
      if (saved.completed) {
        setDailyShowResults(true);
        setDailyTimerActive(false);
      }
    } else {
      // New day, new challenge
      const selected = selectDailyQuestions(allQuestions);
      const newChallenge: DailyChallengeData = {
        date: today,
        completed: false,
        score: 0,
        total: DAILY_QUESTION_COUNT,
        questions: selected.map((q) => q.id),
      };
      saveDailyChallenge(newChallenge);
      setDailyChallenge(newChallenge);
      setDailyStreak(effectiveStreak);
      setDailyShowResults(false);
      setDailyTimerLeft(DAILY_TIMER_SECONDS);
      setDailyTimerActive(false);
    }
  }, [studyMode, allQuestions, storeDailyChallenge.streak, storeDailyChallenge.lastCompletedDate]);

  // Update daily countdown timer
  useEffect(() => {
    if (studyMode !== 'daily') return;
    setDailyTimeLeft(getTimeUntilMidnight());
    const interval = setInterval(() => {
      setDailyTimeLeft(getTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, [studyMode]);

  // Daily challenge 3-minute countdown timer
  useEffect(() => {
    if (studyMode !== 'daily' || !dailyTimerActive || dailyShowResults) return;
    if (dailyTimerLeft <= 0) {
      // Time's up — auto-complete challenge
      const finalScore = dailyQuestions.filter((q) => answered[q.id] && isCorrect(q, answers[q.id] || '')).length;
      const updatedStreak = updateDailyStreak();
      setDailyStreak(updatedStreak);
      const completedData: DailyChallengeData = {
        date: getTodayStr(),
        completed: true,
        score: finalScore,
        total: dailyQuestions.length,
        questions: dailyQuestions.map((q) => q.id),
      };
      saveDailyChallenge(completedData);
      setDailyChallenge(completedData);
      setDailyShowResults(true);
      setDailyTimerActive(false);
      const stars = getStars(finalScore, dailyQuestions.length);
      setStoreDailyChallenge({
        lastCompletedDate: getTodayStr(),
        streak: updatedStreak.current,
        bestScore: Math.max(storeDailyChallenge.bestScore, finalScore),
        totalCompleted: storeDailyChallenge.totalCompleted + 1,
        todayResults: { score: finalScore, total: dailyQuestions.length, timeTaken: DAILY_TIMER_SECONDS, stars },
      });
      return;
    }
    const timeout = setTimeout(() => setDailyTimerLeft((s) => s - 1), 1000);
    return () => clearTimeout(timeout);
  }, [studyMode, dailyTimerActive, dailyShowResults, dailyTimerLeft, dailyQuestions, answered, answers, isCorrect, storeDailyChallenge.bestScore, storeDailyChallenge.totalCompleted, setStoreDailyChallenge]);

  const [timerStarted, setTimerStarted] = useState(false);

  const handleDailyAnswer = useCallback(
    (answer: string) => {
      if (!dailyCurrentQ || answered[dailyCurrentQ.id]) return;

      if (!timerStarted) setTimerStarted(true);
      if (!dailyTimerActive) setDailyTimerActive(true);

      const newAnswers = { ...answers, [dailyCurrentQ.id]: answer };
      const newAnswered = { ...answered, [dailyCurrentQ.id]: true };
      setAnswers(newAnswers);
      setAnswered(newAnswered);
      setShowExplanation(true);

      if (isCorrect(dailyCurrentQ, answer)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);
        if (newStreak >= 3) {
          setShowStreakPopup(true);
          setTimeout(() => setShowStreakPopup(false), 1200);
        }
      } else {
        setStreak(0);
      }
    },
    [answered, answers, dailyCurrentQ, isCorrect, streak, bestStreak, timerStarted, dailyTimerActive],
  );

  const handleDailyNext = useCallback(() => {
    setShowExplanation(false);
    if (currentIndex < dailyQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Challenge complete — save results
      const finalScore = dailyQuestions.filter((q) => answered[q.id] && isCorrect(q, answers[q.id] || '')).length;
      const updatedStreak = updateDailyStreak();
      setDailyStreak(updatedStreak);
      const stars = getStars(finalScore, dailyQuestions.length);

      const completedData: DailyChallengeData = {
        date: getTodayStr(),
        completed: true,
        score: finalScore,
        total: dailyQuestions.length,
        questions: dailyQuestions.map((q) => q.id),
      };
      saveDailyChallenge(completedData);
      setDailyChallenge(completedData);
      setDailyShowResults(true);
      setDailyTimerActive(false);

      // Update Zustand store
      const timeTaken = DAILY_TIMER_SECONDS - dailyTimerLeft;
      setStoreDailyChallenge({
        lastCompletedDate: getTodayStr(),
        streak: updatedStreak.current,
        bestScore: Math.max(storeDailyChallenge.bestScore, finalScore),
        totalCompleted: storeDailyChallenge.totalCompleted + 1,
        todayResults: { score: finalScore, total: dailyQuestions.length, timeTaken, stars },
      });
    }
  }, [currentIndex, dailyQuestions, answered, answers, isCorrect, dailyTimerLeft, storeDailyChallenge.bestScore, storeDailyChallenge.totalCompleted, setStoreDailyChallenge]);

  const handleDailyShare = useCallback(async () => {
    const text = `SynapseLearn Daily Challenge - ${dailyScore}/${dailyQuestions.length} - ${dailyStreak.current} day streak`;
    try {
      await navigator.clipboard.writeText(text);
      setDailyShareCopied(true);
      setTimeout(() => setDailyShareCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [dailyScore, dailyQuestions.length, dailyStreak.current]);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Flashcard state
  const [flipped, setFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [stillLearningCards, setStillLearningCards] = useState<Set<string>>(new Set());
  const [difficultCards, setDifficultCards] = useState<Set<string>>(new Set());
  const [flashcardReviewed, setFlashcardReviewed] = useState<Set<string>>(new Set());
  const [showFlashcardSummary, setShowFlashcardSummary] = useState(false);
  const [hasEverFlipped, setHasEverFlipped] = useState(false);

  // Swipe motion values for flashcard (no re-renders)
  const dragXMotion = useMotionValue(0);

  // Bookmark persistence
  useEffect(() => {
    try {
      const stored = localStorage.getItem('synapse-bookmarked-questions');
      if (stored) {
        setBookmarkedQuestions(new Set(JSON.parse(stored) as string[]));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('synapse-bookmarked-questions', JSON.stringify([...bookmarkedQuestions]));
    } catch { /* ignore */ }
  }, [bookmarkedQuestions]);

  const toggleBookmark = useCallback((questionId: string) => {
    setBookmarkedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  // checkOpacity and crossOpacity use the existing dragXMotion (defined above for flashcard swipe)
  const checkOpacity = useTransform(dragXMotion, [0, 100], [0, 0.7]);
  const crossOpacity = useTransform(dragXMotion, [-100, 0], [0.7, 0]);
  const hasDraggedRef = useRef(false);

  // Timer effect
  useEffect(() => {
    if (!timerStarted || showResults) return;
    const interval = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStarted, showResults]);

  const flashcardQuestions = useMemo(() => {
    if (selectedCourse === 'all') return allQuestions;
    return allQuestions.filter((q) => q.courseId === selectedCourse);
  }, [allQuestions, selectedCourse]);

  const flashcardProgress = flashcardQuestions.length > 0
    ? (flashcardReviewed.size / flashcardQuestions.length) * 100
    : 0;

  const handleFlashcardPrev = useCallback(() => {
    setFlipped(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleFlashcardNext = useCallback(() => {
    setFlipped(false);
    if (currentIndex < flashcardQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, flashcardQuestions.length]);

  // Keyboard shortcuts for flashcard mode
  useEffect(() => {
    if (studyMode !== 'flashcard' || showFlashcardSummary) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setFlipped((prev) => {
            if (!prev) setHasEverFlipped(true);
            return !prev;
          });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleFlashcardPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleFlashcardNext();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [studyMode, showFlashcardSummary, handleFlashcardPrev, handleFlashcardNext]);

  // Filter questions by selected course and bookmarked
  const questions = useMemo(() => {
    if (adaptiveOn && studyMode === 'quiz' && adaptiveQuestions) {
      return adaptiveQuestions;
    }
    let filtered = selectedCourse === 'all' ? allQuestions : allQuestions.filter((q) => q.courseId === selectedCourse);
    if (showBookmarked) {
      filtered = filtered.filter((q) => bookmarkedQuestions.has(q.id));
    }
    return filtered;
  }, [allQuestions, selectedCourse, showBookmarked, bookmarkedQuestions, adaptiveOn, studyMode, adaptiveQuestions]);

  // Difficulty distribution
  const difficultyCounts = useMemo(() => {
    if (studyMode === 'daily') return { easy: 0, medium: 0, hard: 0 };
    const targetQuestions = studyMode === 'quiz' ? questions : flashcardQuestions;
    return {
      easy: targetQuestions.filter((q) => q.difficulty === 'easy').length,
      medium: targetQuestions.filter((q) => q.difficulty === 'medium').length,
      hard: targetQuestions.filter((q) => q.difficulty === 'hard').length,
    };
  }, [studyMode, questions, flashcardQuestions]);

  const handleShuffle = useCallback(() => {
    setCurrentIndex(0);
    setFlipped(false);
  }, []);

  const handleFlashcardMark = useCallback((type: 'known' | 'learning') => {
    if (!flashcardQuestions[currentIndex]) return;
    const id = flashcardQuestions[currentIndex].id;
    const newReviewed = new Set(flashcardReviewed);
    newReviewed.add(id);
    setFlashcardReviewed(newReviewed);

    if (type === 'known') {
      setKnownCards((prev) => new Set(prev).add(id));
      setStillLearningCards((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setStillLearningCards((prev) => new Set(prev).add(id));
      setKnownCards((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }

    // Mark as difficult adds to review queue
    if (type === 'learning' && !difficultCards.has(id)) {
      setDifficultCards((prev) => new Set(prev).add(id));
    }

    setFlipped(false);
    if (currentIndex < flashcardQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowFlashcardSummary(true);
    }
  }, [currentIndex, flashcardQuestions, flashcardReviewed]);

  const handleFlashcardReset = useCallback(() => {
    setCurrentIndex(0);
    setFlipped(false);
    setKnownCards(new Set());
    setStillLearningCards(new Set());
    setDifficultCards(new Set());
    setFlashcardReviewed(new Set());
    setShowFlashcardSummary(false);
    setHasEverFlipped(false);
  }, []);

  const handleMarkDifficult = useCallback(() => {
    if (!flashcardQuestions[currentIndex]) return;
    const id = flashcardQuestions[currentIndex].id;
    setDifficultCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast('Removed from review queue');
      } else {
        next.add(id);
        toast('Marked as difficult — added to review queue', {
          icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        });
      }
      return next;
    });
  }, [currentIndex, flashcardQuestions]);

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    setCurrentIndex(0);
    setAnswers({});
    setAnswered({});
    setShowExplanation(false);
    setShowResults(false);
    setStreak(0);
    setBestStreak(0);
    setFlipped(false);
    setKnownCards(new Set());
    setStillLearningCards(new Set());
    setDifficultCards(new Set());
    setFlashcardReviewed(new Set());
    setShowFlashcardSummary(false);
    setHasEverFlipped(false);
    setTimerStarted(false);
    setTimerSeconds(0);
    setHintsUsed({});
    setFillBlankValues({});
    setFillBlankGrades({});
  };

  const handleModeChange = (mode: StudyMode) => {
    setStudyMode(mode);
    setCurrentIndex(0);
    setAnswers({});
    setAnswered({});
    setShowExplanation(false);
    setShowResults(false);
    setStreak(0);
    setBestStreak(0);
    setFlipped(false);
    setKnownCards(new Set());
    setStillLearningCards(new Set());
    setDifficultCards(new Set());
    setFlashcardReviewed(new Set());
    setShowFlashcardSummary(false);
    setHasEverFlipped(false);
    setTimerStarted(false);
    setTimerSeconds(0);
    setDailyShowResults(false);
    setDailyShareCopied(false);
    setReviewShowResults(false);
    setReviewedCount(0);
    setDailyTimerLeft(DAILY_TIMER_SECONDS);
    setDailyTimerActive(false);
    setHintsUsed({});
    setFillBlankValues({});
    setFillBlankGrades({});
  };

  const currentQ = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  // Compute wrong answers for error analysis
  const wrongAnswers = useMemo(() => {
    return questions
      .filter((q) => answered[q.id] && !isCorrect(q, answers[q.id] || ''))
      .map((q) => ({
        question: q.question,
        userAnswer: answers[q.id] || '',
        correctAnswer: q.answer,
        concept: q.concept || 'General',
      }));
  }, [questions, answered, answers, isCorrect]);

  const handleAnalyzeMistakes = useCallback(async () => {
    if (wrongAnswers.length === 0) return;
    setWeaknessReportLoading(true);
    setWeaknessReportOpen(true);
    setWeaknessReport(null);
    try {
      const { learnerProfile } = useAppStore.getState();
      const res = await fetch('/api/error-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wrongAnswers,
          learnerProfile: learnerProfile || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to analyze errors');
      }
      const data: ErrorAnalysisResponse = await res.json();
      setWeaknessReport(data);
      // Persist to localStorage
      try {
        localStorage.setItem(ERROR_REPORT_STORAGE_KEY, JSON.stringify(data));
      } catch {
        // ignore storage errors
      }
    } catch {
      toast.error('Failed to analyze mistakes. Please try again.');
      setWeaknessReportOpen(false);
    } finally {
      setWeaknessReportLoading(false);
    }
  }, [wrongAnswers]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!currentQ || answered[currentQ.id]) return;

      // Start timer on first answer
      if (!timerStarted) setTimerStarted(true);

      const newAnswers = { ...answers, [currentQ.id]: answer };
      const newAnswered = { ...answered, [currentQ.id]: true };
      setAnswers(newAnswers);
      setAnswered(newAnswered);
      setShowExplanation(true);

      // Grade fill_blank with Levenshtein tolerance
      if (currentQ.type === 'fill_blank') {
        const grade = gradeFillBlank(answer, currentQ.answer, hintsUsed[currentQ.id] || false);
        setFillBlankGrades((prev) => ({ ...prev, [currentQ.id]: grade }));
      }

      if (isCorrect(currentQ, answer)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);
        if (newStreak >= 3) {
          setShowStreakPopup(true);
          setTimeout(() => setShowStreakPopup(false), 1200);
        }
        // Streak milestone toasts
        if (newStreak > 0 && newStreak % 3 === 0 && newStreak % 5 !== 0) {
          toast.success(`🔥 Hot streak! ${newStreak} in a row!`);
        }
        if (newStreak > 0 && newStreak % 5 === 0) {
          toast.success(`🔥🔥 AMAZING! ${newStreak} in a row! Bonus points earned!`, {
            description: `Score multiplier: ${getScoreMultiplier(newStreak)}x`,
            duration: 4000,
          });
          setShowBonusPopup(true);
          setTimeout(() => setShowBonusPopup(false), 2500);
        }
      } else {
        setStreak(0);
      }

      // Track adaptive result
      if (adaptiveOn && studyMode === 'quiz' && currentQ.concept) {
        const result: AdaptiveResult = {
          concept: currentQ.concept,
          correct: isCorrect(currentQ, answer),
          difficulty: currentQ.difficulty,
          timestamp: Date.now(),
        };
        addAdaptiveResult(result);
        saveAdaptiveResults([...adaptiveResults, result].slice(-200));
      }
    },
    [answered, answers, currentQ, isCorrect, streak, bestStreak, timerStarted, adaptiveOn, studyMode, adaptiveResults, addAdaptiveResult, hintsUsed],
  );

  // Review mode answer handler
  const handleReviewAnswer = useCallback(
    (answer: string) => {
      if (!reviewCurrentQ || answered[reviewCurrentQ.id]) return;

      const newAnswers = { ...answers, [reviewCurrentQ.id]: answer };
      const newAnswered = { ...answered, [reviewCurrentQ.id]: true };
      setAnswers(newAnswers);
      setAnswered(newAnswered);
      setShowExplanation(true);

      const correct = isCorrect(reviewCurrentQ, answer);
      const quality = correct ? 5 : 0;

      // Update spaced repetition
      if (reviewCurrentQ.concept) {
        reviewItem(reviewCurrentQ.concept, quality);
      }

      // Update mastery in app store
      if (reviewCurrentQ.concept) {
        const newLevel = correct ? 5 : 1;
        updateMastery(
          reviewCurrentQ.concept,
          newLevel,
          `Spaced review: ${correct ? 'correct' : 'incorrect'}`,
        );
      }

      // Show confetti on correct
      if (correct) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
      }

      // Track reviewed count
      setReviewedCount((prev) => prev + 1);
    },
    [reviewCurrentQ, answered, answers, isCorrect, reviewItem, updateMastery],
  );

  const handleNext = () => {
    setShowExplanation(false);
    if (studyMode === 'review') {
      if (currentIndex < reviewQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setReviewShowResults(true);
      }
    } else if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowResults(true);
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setAnswers({});
    setAnswered({});
    setShowExplanation(false);
    setShowResults(false);
    setShowConfetti(false);
    setStreak(0);
    setBestStreak(0);
    setTimerStarted(false);
    setTimerSeconds(0);
    setShowBookmarked(false);
    setHintsUsed({});
    setFillBlankValues({});
    setFillBlankGrades({});
  };

  const score = useMemo(() => {
    return questions.reduce((total, q) => {
      if (!answered[q.id]) return total;
      const userAnswer = answers[q.id] || '';
      if (q.type === 'fill_blank') {
        const grade = fillBlankGrades[q.id];
        if (grade) return total + grade.points;
        return total + (isCorrect(q, userAnswer) ? 1 : 0);
      }
      return total + (isCorrect(q, userAnswer) ? 1 : 0);
    }, 0);
  }, [questions, answered, answers, isCorrect, fillBlankGrades]);
  const animatedScore = useAnimatedCounter(showResults ? score : 0, 1500);

  const circumference = 2 * Math.PI * 62;
  const scorePercent = questions.length > 0 ? score / questions.length : 0;
  const strokeDashoffset = circumference * (1 - scorePercent);

  const difficultyTotal = difficultyCounts.easy + difficultyCounts.medium + difficultyCounts.hard;

  // ---------- Empty State ----------
  if (studyMode !== 'daily' && studyMode !== 'review' && questions.length === 0 && flashcardQuestions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[70vh] gap-6"
      >
        <div className="glass rounded-2xl p-8 text-center space-y-4 max-w-md">
          <BookOpen className="h-16 w-16 text-primary/30 mx-auto" />
          <h2 className="text-xl font-bold">No questions available</h2>
          <p className="text-muted-foreground text-sm">
            {selectedCourse !== 'all'
              ? `No questions found for this course. Try selecting a different category.`
              : 'Upload some study materials or generate questions from your courses to start practicing.'}
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => navigate('upload')}>
              <BookOpen className="h-4 w-4 mr-2" />
              Upload Slides
            </Button>
            <Button variant="outline" onClick={() => navigate('dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ---------- Results Screen ----------
  if (showResults) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="flex flex-col items-center justify-center min-h-[70vh] gap-6"
      >
        {/* Confetti burst for high scores */}
        <AnimatePresence>
          {scorePercent >= 0.8 && (
            <div className="fixed inset-0 pointer-events-none z-50">
              {Array.from({ length: 32 }).map((_, i) => (
                <ConfettiParticle
                  key={`result-${i}`}
                  delay={i * 0.04}
                  color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
        <div className="glass rounded-2xl p-8 text-center space-y-6 max-w-md w-full glow-emerald-strong">
          {/* Animated grade badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.2 }}
            className="mx-auto"
          >
            <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold shadow-lg ${
              scorePercent >= 0.9
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-amber-400/30'
                : scorePercent >= 0.7
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-emerald-400/30'
                  : scorePercent >= 0.5
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-cyan-400/30'
                    : 'bg-gradient-to-r from-orange-400 to-red-400 text-white shadow-orange-400/30'
            }`}>
              {scorePercent >= 0.9 ? <Trophy className="h-4 w-4" /> : scorePercent >= 0.7 ? <Zap className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
              {scorePercent >= 0.9 ? 'Outstanding' : scorePercent >= 0.7 ? 'Well Done' : scorePercent >= 0.5 ? 'Good Try' : 'Keep Going'}
            </div>
          </motion.div>
          <div className="relative inline-flex">
            <svg width="160" height="160" className="-rotate-90">
              <circle
                cx="80"
                cy="80"
                r="62"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-muted/20"
              />
              <motion.circle
                cx="80"
                cy="80"
                r="62"
                fill="none"
                stroke="url(#scoreGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className="text-4xl font-bold gradient-text"
                key={animatedScore}
              >
                {score % 1 === 0 ? animatedScore : score.toFixed(1)}<span className="text-lg font-normal text-muted-foreground">/{questions.length}</span>
              </motion.span>
              <span className="text-xs text-muted-foreground mt-1 text-gradient-emerald font-medium">
                {Math.round(scorePercent * 100)}% correct
              </span>
            </div>
          </div>
          {/* Best streak */}
          {bestStreak >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex items-center justify-center gap-1.5 text-sm"
            >
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-muted-foreground">Best streak: <span className="font-bold text-foreground">{bestStreak} in a row</span></span>
            </motion.div>
          )}

          <div>
            <h2 className="text-2xl font-bold">
              {scorePercent >= 0.8
                ? 'Excellent!'
                : scorePercent >= 0.6
                  ? 'Good effort!'
                  : 'Keep practicing!'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              You answered {score} out of {questions.length} questions correctly
            </p>
          </div>

          {/* Per-question breakdown */}
          <div className="space-y-2 text-left">
            <h3 className="text-sm font-semibold">Question Breakdown</h3>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {questions.map((q, i) => {
                let wasCorrect = answered[q.id] && isCorrect(q, answers[q.id] || '');
                let wasClose = false;
                if (q.type === 'fill_blank' && answered[q.id] && fillBlankGrades[q.id]) {
                  const grade = fillBlankGrades[q.id];
                  wasCorrect = grade.status === 'correct';
                  wasClose = grade.status === 'close';
                }
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${wasCorrect ? 'bg-emerald-500/5' : wasClose ? 'bg-amber-500/5' : 'bg-destructive/5'}`}
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, delay: i * 0.05 }}
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${wasCorrect ? 'bg-emerald-500 text-white' : wasClose ? 'bg-amber-500 text-white' : 'bg-destructive/20 text-destructive'}`}
                    >
                      {wasCorrect ? <CheckCircle2 className="h-3 w-3" /> : wasClose ? <span className="text-[10px] font-bold">~</span> : <XCircle className="h-3 w-3" />}
                    </motion.span>
                    <span className="flex-1 truncate">{q.question.slice(0, 60)}{q.question.length > 60 ? '...' : ''}</span>
                    <span className={`text-[9px] px-1.5 py-0 rounded-full font-medium border ${TYPE_BADGE_GRADIENT[q.type] || 'bg-muted text-muted-foreground border-border'}`}>
                      {q.type.replace('_', ' ')}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            {wrongAnswers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Button
                  onClick={handleAnalyzeMistakes}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze My Mistakes
                </Button>
              </motion.div>
            )}
            {wrongAnswers.length === 0 && lastReportExists && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Button
                  onClick={handleViewLastReport}
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  View Last Report
                </Button>
              </motion.div>
            )}
            {wrongAnswers.length > 0 && lastReportExists && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Button
                  onClick={handleViewLastReport}
                  variant="outline"
                  size="sm"
                >
                  View Last Report
                </Button>
              </motion.div>
            )}
            <Button onClick={handleRetry} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            {bookmarkedQuestions.size > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  onClick={() => { setShowResults(false); setShowBookmarked(true); setCurrentIndex(0); setAnswers({}); setAnswered({}); setStreak(0); setBestStreak(0); setTimerStarted(false); setTimerSeconds(0); }}
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <BookmarkCheck className="h-4 w-4 mr-2" />
                  Review Bookmarked ({bookmarkedQuestions.size})
                </Button>
              </motion.div>
            )}
            <Button onClick={() => navigate('dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        <WeaknessReportDialog
          open={weaknessReportOpen}
          onOpenChange={setWeaknessReportOpen}
          report={weaknessReport}
          loading={weaknessReportLoading}
          onStartReview={handleStartReviewFromReport}
        />
      </motion.div>
    );
  }

  // ---------- Flashcard Summary ----------
  if (studyMode === 'flashcard' && showFlashcardSummary) {
    const knownCount = knownCards.size;
    const learningCount = stillLearningCards.size;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="flex flex-col items-center justify-center min-h-[70vh] gap-6"
      >
        <div className="glass rounded-2xl p-8 text-center space-y-6 max-w-md w-full">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.2 }}
            className="mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold shadow-lg bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-emerald-400/30">
              <Layers className="h-4 w-4" />
              Study Complete
            </div>
          </motion.div>

          <div>
            <h2 className="text-2xl font-bold">
              {knownCount === flashcardQuestions.length
                ? 'Perfect recall!'
                : knownCount >= flashcardQuestions.length * 0.7
                  ? 'Great progress!'
                  : 'Keep practicing!'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              You knew <span className="font-bold text-emerald-600 dark:text-emerald-400">{knownCount}</span> out of <span className="font-bold">{flashcardQuestions.length}</span> cards
            </p>
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{knownCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Known</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{learningCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Still Learning</div>
            </div>
          </div>

          {learningCount > 0 && (
            <div className="text-left space-y-2">
              <h3 className="text-sm font-semibold">Cards to review</h3>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {flashcardQuestions
                  .filter((q) => stillLearningCards.has(q.id))
                  .map((q) => (
                    <div key={q.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-amber-500/5 border border-amber-500/10">
                      <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="flex-1 truncate">{q.question.slice(0, 60)}{q.question.length > 60 ? '...' : ''}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Button onClick={handleFlashcardReset} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Study Again
            </Button>
            <Button onClick={() => navigate('dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ---------- Question Screen ----------
  return (
    <div className="">
      <div className="relative">
        {/* Progress bar at the very top of quiz view */}
        {studyMode === 'quiz' && questions.length > 0 && (
          <div
            className="quiz-top-progress"
            style={{ '--quiz-progress': `${(Object.keys(answered).length / questions.length) * 100}%` } as React.CSSProperties}
          />
        )}
        {/* Streak popup */}
        <AnimatePresence>
          {showStreakPopup && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            >
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30">
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.4, repeat: 2 }}
                >
                  <Flame className="h-5 w-5" />
                </motion.span>
                {streak} in a row!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bonus streak popup (every 5) */}
        <AnimatePresence>
          {showBonusPopup && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.5, rotate: -5 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, y: -30, scale: 0.6, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            >
              <div className="relative flex flex-col items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 text-white shadow-2xl shadow-orange-500/40">
                <motion.div
                  animate={{ scale: [1, 1.4, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.8, repeat: 2 }}
                  className="text-3xl"
                >
                  🔥
                </motion.div>
                <div className="text-center">
                  <div className="text-lg font-black leading-tight">{streak} STREAK!</div>
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm font-bold mt-0.5"
                  >
                    +{getScoreMultiplier(streak)}x Bonus!
                  </motion.div>
                </div>
                {/* Sparkle particles */}
                <motion.div
                  className="absolute -top-2 -right-2 h-3 w-3 rounded-full bg-yellow-300"
                  animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.8, repeat: 2, delay: 0.1 }}
                />
                <motion.div
                  className="absolute -bottom-1 -left-3 h-2 w-2 rounded-full bg-white"
                  animate={{ scale: [0, 2, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.7, repeat: 2, delay: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confetti */}
        <AnimatePresence>
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-50">
              {Array.from({ length: 16 }).map((_, i) => (
                <ConfettiParticle
                  key={i}
                  delay={i * 0.03}
                  color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Animated header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl p-5 mesh-gradient gradient-border relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold gradient-text">{studyMode === 'quiz' ? 'Quiz Practice' : studyMode === 'flashcard' ? 'Flashcard Study' : studyMode === 'review' ? 'Spaced Review' : 'Daily Challenge'}</h1>
                {/* Adaptive toggle */}
                <button
                  onClick={() => {
                    setAdaptiveOn((prev) => !prev);
                    setCurrentIndex(0);
                    setAnswers({});
                    setAnswered({});
                    setShowExplanation(false);
                    setShowResults(false);
                    setStreak(0);
                    setBestStreak(0);
                    setTimerStarted(false);
                    setTimerSeconds(0);
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all border ${
                    adaptiveOn
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  }`}
                  title={adaptiveOn ? 'Disable adaptive difficulty' : 'Enable adaptive difficulty'}
                >
                  <Brain className="w-3.5 h-3.5" />
                  Adaptive
                </button>
                {/* Mode toggle */}
                <div className="flex items-center rounded-lg border border-border bg-background/50 p-0.5">
                  <button
                    onClick={() => handleModeChange('quiz')}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      studyMode === 'quiz'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Quiz
                  </button>
                  <button
                    onClick={() => handleModeChange('flashcard')}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      studyMode === 'flashcard'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Flashcard
                  </button>
                  <button
                    onClick={() => handleModeChange('daily')}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      studyMode === 'daily'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Daily
                  </button>
                  <button
                    onClick={() => handleModeChange('review')}
                    className={`relative flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      studyMode === 'review'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Brain className="w-3.5 h-3.5" />
                    Review
                    {overdueCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white px-1">
                        {overdueCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Adaptive badge */}
                {adaptiveOn && studyMode === 'quiz' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1"
                  >
                    <Brain className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Adaptive</span>
                  </motion.div>
                )}
                {/* Timer display (quiz mode only) */}
                {studyMode === 'quiz' && timerStarted && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="quiz-timer-ring"
                    aria-live="polite"
                  >
                    <svg width="36" height="36" viewBox="0 0 36 36">
                      <circle
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className={`text-muted/20`}
                      />
                      <motion.circle
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke={timerSeconds < 30 && !showResults ? '#ef4444' : '#10b981'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 15}
                        initial={false}
                        animate={{
                          strokeDashoffset: showResults
                            ? 2 * Math.PI * 15
                            : 2 * Math.PI * 15 * (1 - (timerSeconds % 60) / 60),
                        }}
                        transition={{ duration: 1, ease: 'linear' }}
                        style={{ opacity: timerStarted && !showResults ? 0.7 : 0.3 }}
                      />
                    </svg>
                    <span className={`absolute text-[10px] font-mono font-medium ${
                      timerSeconds < 30 && !showResults ? 'text-red-500' : 'text-muted-foreground'
                    }`}>{formatTimer(timerSeconds)}</span>
                  </motion.div>
                )}
                {studyMode === 'quiz' && streak >= 2 && (
                  <motion.div
                    key={streak}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20"
                  >
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{streak} streak</span>
                  </motion.div>
                )}
                {/* Question Map button (quiz mode) */}
                {studyMode === 'quiz' && questions.length > 1 && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuestionMap(true)}
                      className="h-8 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Map
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
            {/* Course filter tabs (not shown in daily mode) */}
            {studyMode !== 'daily' && studyMode !== 'review' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {COURSE_QUIZ_GROUPS.map((group) => (
              <button
                key={group.id}
                onClick={() => { handleCourseChange(group.id); if (showBookmarked) setShowBookmarked(false); }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCourse === group.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                }`}
              >
                <group.icon className="h-3.5 w-3.5" />
                {group.label}
                <span className={`ml-0.5 text-[10px] ${selectedCourse === group.id ? 'bg-white/20 px-1 rounded' : 'text-muted-foreground'}`}>
                  {group.id === 'all'
                    ? allQuestions.length
                    : allQuestions.filter((q) => q.courseId === group.id).length}
                </span>
              </button>
            ))}
            {/* Bookmarked filter chip */}
            {bookmarkedQuestions.size > 0 && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setShowBookmarked(!showBookmarked); if (showBookmarked) setCurrentIndex(0); else setCurrentIndex(0); }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                  showBookmarked
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 glass shadow-sm'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/30 glass-hover'
                }`}
              >
                <BookmarkCheck className="h-3.5 w-3.5" />
                Bookmarked
                <span className={`ml-0.5 text-[10px] ${showBookmarked ? 'bg-emerald-500/20 px-1 rounded' : 'text-muted-foreground'}`}>
                  {bookmarkedQuestions.size}
                </span>
              </motion.button>
            )}
          </div>
            )}
            {/* Adaptive reasoning */}
            {adaptiveOn && studyMode === 'quiz' && adaptiveReasoning && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-muted-foreground mt-1.5 truncate max-w-full"
              >
                {adaptiveReasoning}
              </motion.p>
            )}
          {studyMode !== 'daily' && studyMode !== 'review' && difficultyTotal > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 flex h-1.5 rounded-full overflow-hidden bg-muted/40">
                {difficultyCounts.easy > 0 && (
                  <motion.div
                    className="bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(difficultyCounts.easy / difficultyTotal) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                )}
                {difficultyCounts.medium > 0 && (
                  <motion.div
                    className="bg-amber-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(difficultyCounts.medium / difficultyTotal) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                  />
                )}
                {difficultyCounts.hard > 0 && (
                  <motion.div
                    className="bg-rose-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(difficultyCounts.hard / difficultyTotal) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                {difficultyCounts.easy > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                    {difficultyCounts.easy} Easy
                  </span>
                )}
                {difficultyCounts.medium > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                    {difficultyCounts.medium} Med
                  </span>
                )}
                {difficultyCounts.hard > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
                    {difficultyCounts.hard} Hard
                  </span>
                )}
              </div>
            </div>
          )}
          {studyMode !== 'daily' && studyMode !== 'review' && (
          <div className="flex items-center justify-between mb-2 mt-1">
            <span className="text-sm font-medium">
              {studyMode === 'quiz'
                ? `Question ${currentIndex + 1} of ${questions.length}`
                : `Card ${currentIndex + 1} of ${flashcardQuestions.length}`}
            </span>
            <div className="flex items-center gap-2">
              {studyMode === 'quiz' && (
                <>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                    currentQ?.difficulty === 'easy'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                      : currentQ?.difficulty === 'medium'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                        : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                  }`}>
                    {currentQ?.difficulty}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TYPE_BADGE_GRADIENT[currentQ?.type || ''] || 'bg-muted text-muted-foreground border-border'}`}>
                    {currentQ?.type.replace('_', ' ')}
                  </span>
                </>
              )}
              {studyMode === 'flashcard' && (
                <span className="text-xs text-muted-foreground">
                  {flashcardReviewed.size} of {flashcardQuestions.length} reviewed
                </span>
              )}
            </div>
          </div>
          )}
          {/* Custom gradient progress bar (not shown in daily/review mode) */}
          {studyMode !== 'daily' && studyMode !== 'review' && (
          <div className="relative h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, oklch(0.627 0.194 149.214) 0%, oklch(0.687 0.159 177.89) 50%, oklch(0.565 0.194 149.214) 100%)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${studyMode === 'quiz' ? progress : flashcardProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold text-white drop-shadow-sm"
              animate={{ left: `${Math.max(studyMode === 'quiz' ? progress : flashcardProgress, 5)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {Math.round(studyMode === 'quiz' ? progress : flashcardProgress)}%
            </motion.div>
          </div>
          )}
          </div>
        </motion.div>

        {/* Daily Challenge Hero Banner */}
        {studyMode === 'daily' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className={`glass-accent-top rounded-2xl p-6 animated-border relative overflow-hidden ${dailyStreak.current > 3 ? 'ring-2 ring-orange-500/30' : ''}`}>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold gradient-text-animated">Daily Challenge</h2>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                      </div>
                      {dailyStreak.current > 0 && (
                        <motion.div
                          initial={{ scale: 0.9 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-1.5 font-semibold"
                          style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                        >
                          <motion.div
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <Flame className="h-4 w-4" style={{ color: '#f97316' }} />
                          </motion.div>
                          <span>{dailyStreak.current} day streak!</span>
                        </motion.div>
                      )}
                      {dailyMultiplier > 1 && (
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-600 dark:text-amber-400"
                        >
                          <Zap className="h-3 w-3" />
                          {dailyMultiplier}x multiplier
                        </motion.div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Circular SVG Timer */}
                    {!dailyShowResults && (
                      <div className="relative" aria-live="polite">
                        <svg width="64" height="64" className="-rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="text-muted/20"
                          />
                          <motion.circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="none"
                            stroke="url(#dailyTimerGrad)"
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={dailyTimerCircumference}
                            animate={{ strokeDashoffset: dailyTimerStroke }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                          <defs>
                            <linearGradient id="dailyTimerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#14b8a6" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-xs font-mono font-bold ${dailyTimerLeft <= 30 ? 'text-destructive' : 'text-foreground'}`}>
                            {formatTimer(dailyTimerLeft)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Resets in</span>
                      </div>
                      <div className="font-mono text-lg font-bold tabular-nums">
                        {String(dailyTimeLeft.hours).padStart(2, '0')}:{String(dailyTimeLeft.minutes).padStart(2, '0')}:{String(dailyTimeLeft.seconds).padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Daily progress bar */}
                {!dailyShowResults && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Question {Math.min(currentIndex + 1, dailyQuestions.length)} of {dailyQuestions.length}</span>
                      <span>{dailyScore} correct</span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${dailyProgress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Daily Challenge Results Screen */}
        {studyMode === 'daily' && dailyShowResults && dailyChallenge?.completed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="flex flex-col items-center justify-center min-h-[50vh] gap-6"
          >
            {/* Confetti burst (30 particles always on completion) */}
            <AnimatePresence>
              <div className="fixed inset-0 pointer-events-none z-50">
                {Array.from({ length: 30 }).map((_, i) => (
                  <ConfettiParticle
                    key={`daily-confetti-${i}`}
                    delay={i * 0.04}
                    color={DAILY_CONFETTI_COLORS[i % DAILY_CONFETTI_COLORS.length]}
                  />
                ))}
              </div>
            </AnimatePresence>
            <div className="glass rounded-2xl p-8 text-center space-y-6 max-w-md w-full glow-emerald-strong">
              {/* "Challenge Complete!" badge */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.1 }}
                className="mx-auto"
              >
                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold shadow-lg bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-amber-400/30">
                  <Trophy className="h-4 w-4" />
                  Challenge Complete!
                </div>
              </motion.div>

              {/* Animated circular progress */}
              <div className="relative inline-flex">
                <svg width="160" height="160" className="-rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="62"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-muted/20"
                  />
                  <motion.circle
                    cx="80"
                    cy="80"
                    r="62"
                    fill="none"
                    stroke="url(#dailyScoreGrad)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={dailyCircumference}
                    initial={{ strokeDashoffset: dailyCircumference }}
                    animate={{ strokeDashoffset: dailyStrokeDashoffset }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                  <defs>
                    <linearGradient id="dailyScoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="50%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-4xl font-bold gradient-text"
                    key={dailyAnimatedScore}
                  >
                    {dailyAnimatedScore}<span className="text-lg font-normal text-muted-foreground">/{dailyChallenge.total}</span>
                  </motion.span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {Math.round(dailyScorePercent * 100)}% correct
                  </span>
                </div>
              </div>

              {/* Star rating */}
              <div className="flex items-center justify-center gap-2">
                <Star filled={dailyStars >= 1} delay={0.3} />
                <Star filled={dailyStars >= 2} delay={0.5} />
                <Star filled={dailyStars >= 3} delay={0.7} />
              </div>

              {/* Streak display with animated flame */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="flex items-center justify-center gap-2"
              >
                <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Flame className="h-5 w-5 text-orange-500" />
                  </motion.div>
                  <span className="font-bold text-orange-600 dark:text-orange-400">{dailyStreak.current} day streak</span>
                </div>
              </motion.div>

              {dailyStreak.best > 1 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 }}
                  className="text-xs text-muted-foreground"
                >
                  Best streak: {dailyStreak.best} days
                </motion.p>
              )}

              {/* Result message */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="text-center"
              >
                <h2 className="text-xl font-bold">
                  {dailyChallenge.score === dailyChallenge.total
                    ? 'Perfect Score!'
                    : dailyScorePercent >= 0.6
                      ? 'Great work!'
                      : 'Keep practicing!'}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {dailyMultiplier > 1 ? `Score multiplied by ${dailyMultiplier}x from your streak! ` : ''}
                  Come back tomorrow for a new challenge!
                </p>
              </motion.div>

              {/* Tomorrow's Challenge teaser */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 }}
                className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Tomorrow's Challenge</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {String(dailyTimeLeft.hours).padStart(2, '0')}:{String(dailyTimeLeft.minutes).padStart(2, '0')}:{String(dailyTimeLeft.seconds).padStart(2, '0')}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      animate={{ width: `${((24 * 60 - (dailyTimeLeft.hours * 60 + dailyTimeLeft.minutes)) / (24 * 60)) * 100}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">New questions at midnight</span>
                </div>
              </motion.div>

              {/* Per-question breakdown */}
              <div className="space-y-2 text-left">
                <h3 className="text-sm font-semibold">Question Breakdown</h3>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {dailyQuestions.map((q, i) => {
                    const wasCorrect = answered[q.id] && isCorrect(q, answers[q.id] || '');
                    return (
                      <motion.div
                        key={q.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 + 0.3 }}
                        className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${wasCorrect ? 'bg-emerald-500/5' : 'bg-destructive/5'}`}
                      >
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, delay: i * 0.05 + 0.3 }}
                          className={`flex h-5 w-5 items-center justify-center rounded-full ${wasCorrect ? 'bg-emerald-500 text-white' : 'bg-destructive/20 text-destructive'}`}
                        >
                          {wasCorrect ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        </motion.span>
                        <span className="flex-1 truncate">{q.question.slice(0, 60)}{q.question.length > 60 ? '...' : ''}</span>
                        <span className={`text-[9px] px-1.5 py-0 rounded-full font-medium border ${TYPE_BADGE_GRADIENT[q.type] || 'bg-muted text-muted-foreground border-border'}`}>
                          {q.type.replace('_', ' ')}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button onClick={handleDailyShare} variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  {dailyShareCopied ? 'Copied!' : 'Share Results'}
                </Button>
                <Button onClick={() => navigate('dashboard')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Daily Challenge Question Card */}
        {studyMode === 'daily' && !dailyShowResults && dailyCurrentQ && (
        <AnimatePresence mode="wait">
          {dailyCurrentQ && (
            <motion.div
              key={dailyCurrentQ.id}
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`glass rounded-xl p-6 space-y-6 glow-emerald ${dailyStreak.current > 3 ? 'ring-2 ring-orange-500/40' : ''}`}
            >
              {/* Concept tag */}
              {dailyCurrentQ.concept && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  <Badge variant="secondary" className="text-xs bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/10">
                    {dailyCurrentQ.concept}
                  </Badge>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                    dailyCurrentQ.difficulty === 'easy'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                      : dailyCurrentQ.difficulty === 'medium'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                        : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                  }`}>
                    {dailyCurrentQ.difficulty}
                  </span>
                </motion.div>
              )}

              {/* Question text */}
              <h2 className="text-lg font-semibold leading-relaxed">{dailyCurrentQ.question}</h2>

              {/* Question type renderers — reuse the same pattern as quiz mode */}
              {dailyCurrentQ.type === 'multiple_choice' && dailyCurrentQ.options && (
                <div className="grid gap-2">
                  {dailyCurrentQ.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isAnswered = answered[dailyCurrentQ.id];
                    const isSelected = answers[dailyCurrentQ.id] === opt;
                    const isCorrectOpt = opt === dailyCurrentQ.answer;

                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAnswered ? { scale: 1.01, y: -1 } : {}}
                        whileTap={!isAnswered ? { scale: 0.99 } : {}}
                        onClick={() => !isAnswered && handleDailyAnswer(opt)}
                        disabled={isAnswered}
                        aria-label={`Option ${letter}: ${opt}`}
                        className={`relative flex items-center gap-3 rounded-lg border p-4 text-left text-sm transition-all ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500/60 bg-emerald-500/8 shadow-sm shadow-emerald-500/10'
                              : isSelected
                                ? 'border-destructive/60 bg-destructive/8'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                          isAnswered && isCorrectOpt
                            ? 'bg-emerald-500 text-white'
                            : isAnswered && isSelected
                              ? 'bg-destructive text-white'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {isAnswered && isCorrectOpt ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isAnswered && isSelected ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            letter
                          )}
                        </span>
                        <span className={isAnswered && isCorrectOpt ? 'text-emerald-700 dark:text-emerald-300' : ''}>{opt}</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {dailyCurrentQ.type === 'true_false' && (
                <div className="flex gap-3">
                  {['True', 'False'].map((opt) => {
                    const isAnswered = answered[dailyCurrentQ.id];
                    const isSelected = answers[dailyCurrentQ.id] === opt;
                    const isCorrectOpt = opt === dailyCurrentQ.answer;

                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAnswered ? { scale: 1.03, y: -2 } : {}}
                        whileTap={!isAnswered ? { scale: 0.97 } : {}}
                        onClick={() => !isAnswered && handleDailyAnswer(opt)}
                        disabled={isAnswered}
                        aria-label={`Answer: ${opt}`}
                        className={`flex-1 rounded-lg border p-4 text-center font-semibold transition-all ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500/60 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10'
                              : isSelected
                                ? 'border-destructive/60 bg-destructive/8 text-destructive'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        {isAnswered && isCorrectOpt && <CheckCircle2 className="h-5 w-5 inline mr-1.5" />}
                        {isAnswered && isSelected && !isCorrectOpt && <XCircle className="h-5 w-5 inline mr-1.5" />}
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {dailyCurrentQ.type === 'short_answer' && !answered[dailyCurrentQ.id] && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your answer..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        handleDailyAnswer((e.target as HTMLInputElement).value);
                      }
                    }}
                    id="daily-short-answer-input"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('daily-short-answer-input') as HTMLInputElement;
                      if (input?.value.trim()) handleDailyAnswer(input.value);
                    }}
                  >
                    Submit
                  </Button>
                </div>
              )}

              {dailyCurrentQ.type === 'short_answer' && answered[dailyCurrentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your answer:</p>
                  <p className="font-medium">{answers[dailyCurrentQ.id]}</p>
                </div>
              )}

              {dailyCurrentQ.type === 'fill_blank' && !answered[dailyCurrentQ.id] && (
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Fill in the blank..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        handleDailyAnswer((e.target as HTMLInputElement).value);
                      }
                    }}
                    id="daily-fill-blank-input"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('daily-fill-blank-input') as HTMLInputElement;
                      if (input?.value.trim()) handleDailyAnswer(input.value);
                    }}
                  >
                    Submit
                  </Button>
                </div>
              )}

              {dailyCurrentQ.type === 'fill_blank' && answered[dailyCurrentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your answer:</p>
                  <p className="font-medium">{answers[dailyCurrentQ.id]}</p>
                </div>
              )}

              {dailyCurrentQ.type === 'matching' && dailyCurrentQ.matchingPairs && !answered[dailyCurrentQ.id] && (
                <MatchingInput
                  pairs={dailyCurrentQ.matchingPairs}
                  onAnswer={(answer) => handleDailyAnswer(answer)}
                />
              )}

              {dailyCurrentQ.type === 'error_correction' && dailyCurrentQ.errorText && !answered[dailyCurrentQ.id] && (
                <ErrorCorrectionInput
                  errorText={dailyCurrentQ.errorText}
                  onAnswer={(answer) => handleDailyAnswer(answer)}
                />
              )}

              {dailyCurrentQ.type === 'error_correction' && answered[dailyCurrentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your correction:</p>
                  <p className="font-medium">{answers[dailyCurrentQ.id] || '(empty)'}</p>
                </div>
              )}

              {/* Explanation */}
              <AnimatePresence>
                {showExplanation && dailyCurrentQ.explanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-primary">Explanation</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {dailyCurrentQ.explanation}
                      </p>
                      {dailyCurrentQ.type === 'short_answer' || dailyCurrentQ.type === 'error_correction' || dailyCurrentQ.type === 'fill_blank' ? (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">Expected answer: </span>
                          <span className="text-xs font-medium">{dailyCurrentQ.answer}</span>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="text-muted-foreground"
                >
                  Previous
                </Button>
                {answered[dailyCurrentQ.id] && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Button onClick={handleDailyNext}>
                      {currentIndex < dailyQuestions.length - 1 ? (
                        <>
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      ) : (
                        <>
                          Finish Challenge <Trophy className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}

        {/* Daily challenge question navigator dots */}
        {studyMode === 'daily' && !dailyShowResults && dailyQuestions.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
            {dailyQuestions.map((q, i) => (
              <motion.button
                key={q.id}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setCurrentIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === currentIndex
                    ? 'bg-primary w-7 shadow-sm shadow-primary/30'
                    : answered[q.id]
                      ? isCorrect(q, answers[q.id] || '')
                        ? 'bg-emerald-500 w-2.5'
                        : 'bg-destructive/60 w-2.5'
                      : 'bg-muted hover:bg-primary/40 w-2.5'
                }`}
                aria-label={`Go to question ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Review Mode Progress Banner */}
        {studyMode === 'review' && !reviewShowResults && reviewQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-4 p-3 rounded-lg glass"
          >
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">
                {reviewedCount}/{reviewQuestions.length} reviews complete
              </span>
            </div>
            <div className="relative h-2 w-32 rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${reviewProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}

        {/* Review Mode Empty State */}
        {studyMode === 'review' && !reviewShowResults && reviewQuestions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[40vh] gap-4"
          >
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Brain className="h-8 w-8 text-emerald-500/60" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">No reviews due</h2>
              <p className="text-sm text-muted-foreground">Complete quizzes to unlock spaced repetition reviews</p>
            </div>
            <Button variant="outline" onClick={() => handleModeChange('quiz')}>
              <HelpCircle className="h-4 w-4 mr-2" />
              Start a Quiz
            </Button>
          </motion.div>
        )}

        {/* Review Mode Question Card */}
        {studyMode === 'review' && !reviewShowResults && reviewCurrentQ && (
          <AnimatePresence mode="wait">
            <motion.div
              key={reviewCurrentQ.id}
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass rounded-xl p-6 space-y-6 glow-emerald"
            >
              {/* Concept tag */}
              {reviewCurrentQ.concept && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/10">
                    {reviewCurrentQ.concept}
                  </Badge>
                </div>
              )}

              <h2 className="text-lg font-semibold leading-relaxed">{reviewCurrentQ.question}</h2>

              {/* Multiple choice */}
              {reviewCurrentQ.type === 'multiple_choice' && reviewCurrentQ.options && (
                <div className="grid gap-2">
                  {reviewCurrentQ.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isAns = answered[reviewCurrentQ.id];
                    const isSel = answers[reviewCurrentQ.id] === opt;
                    const isCor = opt === reviewCurrentQ.answer;
                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAns ? { scale: 1.01, y: -1 } : {}}
                        whileTap={!isAns ? { scale: 0.99 } : {}}
                        onClick={() => !isAns && handleReviewAnswer(opt)}
                        disabled={isAns}
                        aria-label={`Option ${letter}: ${opt}`}
                        className={`relative flex items-center gap-3 rounded-lg border p-4 text-left text-sm transition-all ${
                          isAns
                            ? isCor
                              ? 'border-emerald-500/60 bg-emerald-500/8 shadow-sm shadow-emerald-500/10'
                              : isSel
                                ? 'border-destructive/60 bg-destructive/8'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                          isAns && isCor ? 'bg-emerald-500 text-white' : isAns && isSel ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                          {isAns && isCor ? <CheckCircle2 className="h-4 w-4" /> : isAns && isSel ? <XCircle className="h-4 w-4" /> : letter}
                        </span>
                        <span className={isAns && isCor ? 'text-emerald-700 dark:text-emerald-300' : ''}>{opt}</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* True/False */}
              {reviewCurrentQ.type === 'true_false' && (
                <div className="flex gap-3">
                  {['True', 'False'].map((opt) => {
                    const isAns = answered[reviewCurrentQ.id];
                    const isSel = answers[reviewCurrentQ.id] === opt;
                    const isCor = opt === reviewCurrentQ.answer;
                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAns ? { scale: 1.03, y: -2 } : {}}
                        whileTap={!isAns ? { scale: 0.97 } : {}}
                        onClick={() => !isAns && handleReviewAnswer(opt)}
                        disabled={isAns}
                        aria-label={`Answer: ${opt}`}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-4 text-sm font-medium transition-all ${
                          isAns
                            ? isCor ? 'border-emerald-500/60 bg-emerald-500/8' : isSel ? 'border-destructive/60 bg-destructive/8' : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                        }`}
                      >
                        {isAns && isCor ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : isAns && isSel ? <XCircle className="h-5 w-5 text-destructive" /> : null}
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Short answer / Fill blank / Error correction */}
              {(reviewCurrentQ.type === 'short_answer' || reviewCurrentQ.type === 'fill_blank' || reviewCurrentQ.type === 'error_correction') && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder={reviewCurrentQ.type === 'fill_blank' ? 'Type the missing term...' : 'Type your answer...'}
                      value={answers[reviewCurrentQ.id] || ''}
                      onChange={(e) => {
                        if (!answered[reviewCurrentQ.id]) {
                          setAnswers((prev) => ({ ...prev, [reviewCurrentQ.id]: e.target.value }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && answers[reviewCurrentQ.id]?.trim() && !answered[reviewCurrentQ.id]) {
                          handleReviewAnswer(answers[reviewCurrentQ.id].trim());
                        }
                      }}
                      disabled={answered[reviewCurrentQ.id]}
                      className="flex-1"
                    />
                    {!answered[reviewCurrentQ.id] && (
                      <Button
                        onClick={() => answers[reviewCurrentQ.id]?.trim() && handleReviewAnswer(answers[reviewCurrentQ.id].trim())}
                        disabled={!answers[reviewCurrentQ.id]?.trim()}
                        size="sm"
                      >
                        Submit
                      </Button>
                    )}
                  </div>
                  {answered[reviewCurrentQ.id] && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-sm ${isCorrect(reviewCurrentQ, answers[reviewCurrentQ.id]) ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                    >
                      {isCorrect(reviewCurrentQ, answers[reviewCurrentQ.id])
                        ? '✓ Correct!'
                        : `✗ Incorrect. Answer: ${reviewCurrentQ.answer}`}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Explanation */}
              <AnimatePresence>
                {showExplanation && reviewCurrentQ.explanation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-4"
                  >
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      <span className="font-semibold">Explanation: </span>
                      {reviewCurrentQ.explanation}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Next button */}
              {answered[reviewCurrentQ.id] && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <Button onClick={handleNext} size="sm">
                    {currentIndex < reviewQuestions.length - 1 ? (
                      <>Next <ChevronRight className="h-4 w-4 ml-1" /></>
                    ) : (
                      <>Finish <Trophy className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Review Mode Results Screen */}
        {studyMode === 'review' && reviewShowResults && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="flex flex-col items-center justify-center min-h-[50vh] gap-6"
          >
            {/* Confetti */}
            <AnimatePresence>
              {reviewedCount === reviewQuestions.length && (
                <div className="fixed inset-0 pointer-events-none z-50">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <ConfettiParticle
                      key={`review-confetti-${i}`}
                      delay={i * 0.03}
                      color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
            <div className="glass rounded-2xl p-8 text-center space-y-6 max-w-md w-full glow-emerald-strong">
              <div className="relative inline-flex">
                <svg width="140" height="140" className="-rotate-90">
                  <circle cx="70" cy="70" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
                  <motion.circle
                    cx="70" cy="70" r="54" fill="none" stroke="oklch(0.627 0.194 149.214)"
                    strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 54}
                    initial={{ strokeDashoffset: 2 * Math.PI * 54 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 54 * (1 - reviewQuestions.length > 0 ? reviewedCount / reviewQuestions.length : 0) }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-3xl font-bold gradient-text"
                    key={reviewedCount}
                  >
                    {reviewedCount}<span className="text-base font-normal text-muted-foreground">/{reviewQuestions.length}</span>
                  </motion.span>
                  <span className="text-xs text-muted-foreground mt-1">reviews done</span>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-xl font-bold">
                  {reviewedCount === reviewQuestions.length
                    ? 'Review Complete!'
                    : 'Reviews Updated'}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {reviewedCount === reviewQuestions.length
                    ? 'All due items have been reviewed. Great work staying on top of your learning!'
                    : 'Your review schedule has been updated.'}
                </p>
              </motion.div>

              {/* Per-question breakdown */}
              <div className="space-y-2 text-left">
                <h3 className="text-sm font-semibold">Review Breakdown</h3>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {reviewQuestions.map((q, i) => {
                    const wasCorrect = answered[q.id] && isCorrect(q, answers[q.id] || '');
                    return (
                      <motion.div
                        key={q.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 + 0.3 }}
                        className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${wasCorrect ? 'bg-emerald-500/5' : 'bg-destructive/5'}`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${wasCorrect ? 'bg-emerald-500 text-white' : 'bg-destructive/20 text-destructive'}`}>
                          {wasCorrect ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        </span>
                        <span className="flex-1 truncate">{q.concept || q.question.slice(0, 50)}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => handleModeChange('quiz')}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Back to Quiz
                </Button>
                <Button onClick={() => { handleModeChange('review'); }}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Review Again
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Review mode question navigator dots */}
        {studyMode === 'review' && !reviewShowResults && reviewQuestions.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
            {reviewQuestions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === currentIndex
                    ? 'bg-emerald-500 w-7 shadow-sm shadow-emerald-500/30'
                    : answered[q.id]
                      ? isCorrect(q, answers[q.id] || '')
                        ? 'bg-emerald-500 w-2.5'
                        : 'bg-destructive/60 w-2.5'
                      : 'bg-muted hover:bg-emerald-500/40 w-2.5'
                }`}
                aria-label={`Go to review question ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Quiz question card */}
        {studyMode === 'quiz' && (
        <div role="group" aria-label="Quiz questions">
        <AnimatePresence mode="wait">
          {currentQ && (
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass rounded-xl p-6 space-y-6 glow-emerald gradient-border relative overflow-hidden"
            >
              {/* Concept tag + bookmark */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentQ.concept && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <Badge variant="secondary" className="text-xs bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/10">
                        {currentQ.concept}
                      </Badge>
                    </motion.div>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => toggleBookmark(currentQ.id)}
                  className="opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted/50"
                  aria-label={bookmarkedQuestions.has(currentQ.id) ? 'Remove bookmark' : 'Bookmark question'}
                >
                  <AnimatePresence mode="wait">
                    {bookmarkedQuestions.has(currentQ.id) ? (
                      <motion.span
                        key="bookmarked"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="flex items-center justify-center"
                      >
                        <BookmarkCheck className="h-4.5 w-4.5 text-emerald-500 glow-emerald" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="not-bookmarked"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="flex items-center justify-center"
                      >
                        <Bookmark className="h-4.5 w-4.5 text-muted-foreground" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>

              {/* Question text */}
              <h2 className="text-lg font-semibold leading-relaxed">{currentQ.question}</h2>

              {/* Question type renderer */}
              {currentQ.type === 'multiple_choice' && currentQ.options && (
                <div className="grid gap-2">
                  {currentQ.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isAnswered = answered[currentQ.id];
                    const isSelected = answers[currentQ.id] === opt;
                    const isCorrectOpt = opt === currentQ.answer;

                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAnswered ? { scale: 1.01, y: -1 } : {}}
                        whileTap={!isAnswered ? { scale: 0.99 } : {}}
                        onClick={() => !isAnswered && handleAnswer(opt)}
                        disabled={isAnswered}
                        aria-label={`Option ${letter}: ${opt}`}
                        className={`relative flex items-center gap-3 rounded-lg border p-4 text-left text-sm transition-all hover-lift ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500/60 bg-emerald-500/8 shadow-sm shadow-emerald-500/10'
                              : isSelected
                                ? 'border-destructive/60 bg-destructive/8'
                                : 'border-border opacity-60'
                            : isSelected
                              ? 'border-primary/60 bg-primary/5 quiz-answer-pulse'
                              : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        <motion.span
                          initial={false}
                          animate={
                            isAnswered && isCorrectOpt
                              ? { scale: [1, 1.2, 1] }
                              : isAnswered && isSelected
                                ? { x: [0, -3, 3, -3, 3, 0] }
                                : {}
                          }
                          transition={{ duration: 0.4 }}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                            isAnswered && isCorrectOpt
                              ? 'bg-emerald-500 text-white'
                              : isAnswered && isSelected
                                ? 'bg-destructive text-white'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isAnswered && isCorrectOpt ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </motion.div>
                          ) : isAnswered && isSelected ? (
                            <motion.div
                              initial={{ scale: 0, rotate: 90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                            >
                              <XCircle className="h-4 w-4" />
                            </motion.div>
                          ) : (
                            letter
                          )}
                        </motion.span>
                        <span className={isAnswered && isCorrectOpt ? 'text-emerald-700 dark:text-emerald-300' : ''}>{opt}</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === 'true_false' && (
                <div className="flex gap-3">
                  {['True', 'False'].map((opt) => {
                    const isAnswered = answered[currentQ.id];
                    const isSelected = answers[currentQ.id] === opt;
                    const isCorrectOpt = opt === currentQ.answer;

                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAnswered ? { scale: 1.03, y: -2 } : {}}
                        whileTap={!isAnswered ? { scale: 0.97 } : {}}
                        onClick={() => !isAnswered && handleAnswer(opt)}
                        disabled={isAnswered}
                        aria-label={`Answer: ${opt}`}
                        className={`flex-1 rounded-lg border p-4 text-center font-semibold transition-all ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500/60 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10'
                              : isSelected
                                ? 'border-destructive/60 bg-destructive/8 text-destructive'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        <AnimatePresence mode="wait">
                          {isAnswered && isCorrectOpt ? (
                            <motion.span
                              key="check"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="inline-flex"
                            >
                              <CheckCircle2 className="h-5 w-5 inline mr-1.5" />
                            </motion.span>
                          ) : isAnswered && isSelected ? (
                            <motion.span
                              key="x"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="inline-flex"
                            >
                              <XCircle className="h-5 w-5 inline mr-1.5" />
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === 'short_answer' && !answered[currentQ.id] && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your answer..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        handleAnswer((e.target as HTMLInputElement).value);
                      }
                    }}
                    id="short-answer-input"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('short-answer-input') as HTMLInputElement;
                      if (input?.value.trim()) handleAnswer(input.value);
                    }}
                  >
                    Submit
                  </Button>
                </div>
              )}

              {currentQ.type === 'short_answer' && answered[currentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your answer:</p>
                  <p className="font-medium">{answers[currentQ.id]}</p>
                </div>
              )}

              {currentQ.type === 'fill_blank' && !answered[currentQ.id] && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Fill in the blank..."
                      value={fillBlankValues[currentQ.id] || ''}
                      onChange={(e) => setFillBlankValues((prev) => ({ ...prev, [currentQ.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                          handleAnswer((e.target as HTMLInputElement).value);
                        }
                      }}
                      className={hintsUsed[currentQ.id] ? 'border-blue-500 focus-visible:ring-blue-500' : ''}
                    />
                    <Button
                      onClick={() => {
                        const val = fillBlankValues[currentQ.id] || '';
                        if (val.trim()) handleAnswer(val);
                      }}
                      disabled={!fillBlankValues[currentQ.id]?.trim()}
                    >
                      Submit
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {(fillBlankValues[currentQ.id] || '').length} characters
                    </span>
                    {!hintsUsed[currentQ.id] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
                        onClick={() => {
                          const firstLetter = currentQ.answer[0] || '';
                          setHintsUsed((prev) => ({ ...prev, [currentQ.id]: true }));
                          setFillBlankValues((prev) => ({
                            ...prev,
                            [currentQ.id]: (prev[currentQ.id] || '') + firstLetter,
                          }));
                          toast.info(`Hint: First letter "${firstLetter}" revealed! (−25% points)`, { duration: 3000 });
                        }}
                      >
                        <Lightbulb className="h-3.5 w-3.5 mr-1" />
                        Hint
                      </Button>
                    )}
                    {hintsUsed[currentQ.id] && (
                      <span className="text-xs text-blue-500 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" />
                        Hint used (−25%)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {currentQ.type === 'fill_blank' && answered[currentQ.id] && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-lg border p-4 text-sm space-y-2 ${
                      fillBlankGrades[currentQ.id]?.status === 'correct'
                        ? 'border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                        : fillBlankGrades[currentQ.id]?.status === 'close'
                          ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                          : 'border-red-500/50 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                    }`}
                  >
                    <p className="text-muted-foreground">Your answer:</p>
                    <p className="font-medium">{answers[currentQ.id]}</p>
                    {fillBlankGrades[currentQ.id]?.status === 'correct' && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Correct! Full points
                      </motion.div>
                    )}
                    {fillBlankGrades[currentQ.id]?.status === 'close' && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-amber-600 dark:text-amber-400 text-xs font-medium"
                      >
                        {fillBlankGrades[currentQ.id].message} ({Math.round(fillBlankGrades[currentQ.id].points * 100)}% points)
                      </motion.div>
                    )}
                    {fillBlankGrades[currentQ.id]?.status === 'wrong' && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-600 dark:text-red-400 text-xs font-medium"
                      >
                        Correct answer: <span className="font-bold">{currentQ.answer}</span>
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {currentQ.type === 'matching' && currentQ.matchingPairs && !answered[currentQ.id] && (
                <MatchingInput
                  pairs={currentQ.matchingPairs}
                  onAnswer={(answer) => handleAnswer(answer)}
                />
              )}

              {currentQ.type === 'error_correction' && currentQ.errorText && !answered[currentQ.id] && (
                <ErrorCorrectionInput
                  errorText={currentQ.errorText}
                  onAnswer={(answer) => handleAnswer(answer)}
                />
              )}

              {currentQ.type === 'error_correction' && answered[currentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your correction:</p>
                  <p className="font-medium">{answers[currentQ.id] || '(empty)'}</p>
                </div>
              )}

              {/* Explanation */}
              <AnimatePresence>
                {showExplanation && currentQ.explanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-primary">Explanation</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {currentQ.explanation}
                      </p>
                      {currentQ.type === 'short_answer' || currentQ.type === 'error_correction' || currentQ.type === 'fill_blank' ? (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">Expected answer: </span>
                          <span className="text-xs font-medium">{currentQ.answer}</span>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="text-muted-foreground"
                >
                  Previous
                </Button>
                {answered[currentQ.id] && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Button onClick={handleNext}>
                      {currentIndex < questions.length - 1 ? (
                        <>
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      ) : (
                        <>
                          See Results <Trophy className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        )}

        {/* Flashcard Mode - 3D Flip with Swipe */}
        {studyMode === 'flashcard' && flashcardQuestions[currentIndex] && (
          <div className="space-y-6">
            <div className="relative w-full mx-auto" style={{ perspective: '1000px' }}>
              {/* Card stack effect - hint of next card behind */}
              {currentIndex < flashcardQuestions.length - 1 && (
                <div
                  className="absolute inset-x-3 top-3 glass rounded-2xl pointer-events-none"
                  style={{
                    transform: 'scale(0.97)',
                    opacity: 0.3,
                    zIndex: 0,
                  }}
                >
                  <div className="p-8 min-h-[280px] sm:min-h-[320px]" />
                </div>
              )}

              {/* Main card with swipe gesture */}
              <motion.div
                key={flashcardQuestions[currentIndex].id}
                initial={{ opacity: 0.5, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{ zIndex: 1, position: 'relative' }}
              >
                <motion.div
                  drag={flipped ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.8}
                  onDragStart={() => { hasDraggedRef.current = true; }}
                  onDrag={(_, info) => { dragXMotion.set(info.offset.x); }}
                  onDragEnd={(_, info) => {
                    dragXMotion.set(0);
                    setTimeout(() => { hasDraggedRef.current = false; }, 100);
                    if (flipped) {
                      if (info.offset.x > 100) {
                        handleFlashcardMark('known');
                        return;
                      }
                      if (info.offset.x < -100) {
                        handleFlashcardMark('learning');
                        return;
                      }
                    }
                  }}
                  onClick={() => {
                    if (hasDraggedRef.current) return;
                    setFlipped(!flipped);
                    if (!flipped) setHasEverFlipped(true);
                  }}
                  whileTap={!flipped ? { scale: 0.98 } : undefined}
                  className="relative cursor-pointer select-none"
                  role="button"
                  tabIndex={0}
                  aria-label={`Flashcard ${currentIndex + 1} of ${flashcardQuestions.length}. ${flipped ? 'Showing answer.' : 'Tap or press Space to flip.'}`}
                >
                  {/* Swipe direction hint icons */}
                  {flipped && (
                    <>
                      <motion.div
                        style={{ opacity: checkOpacity }}
                        className="absolute right-5 top-1/2 -translate-y-1/2 z-20 pointer-events-none"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">I know this</span>
                        </div>
                      </motion.div>
                      <motion.div
                        style={{ opacity: crossOpacity }}
                        className="absolute left-5 top-1/2 -translate-y-1/2 z-20 pointer-events-none"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <XCircle className="h-14 w-14 text-rose-500" />
                          <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Still learning</span>
                        </div>
                      </motion.div>
                    </>
                  )}

                  {/* 3D flip container */}
                  <motion.div
                    animate={{ rotateY: flipped ? 180 : 0 }}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                    style={{ transformStyle: 'preserve-3d' }}
                    className="relative"
                  >
                    {/* Front face */}
                    <div
                      className="glass rounded-2xl p-8 min-h-[280px] sm:min-h-[320px] flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent"
                      style={{ backfaceVisibility: 'hidden', position: 'relative' }}
                    >
                      <div className="flex items-center gap-2 mb-4 flex-wrap justify-center">
                        <HelpCircle className="w-5 h-5 text-primary/60" />
                        <Badge variant="secondary" className="text-xs bg-primary/10 border-primary/10">
                          {flashcardQuestions[currentIndex].concept || flashcardQuestions[currentIndex].type.replace('_', ' ')}
                        </Badge>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                          flashcardQuestions[currentIndex].difficulty === 'easy'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                            : flashcardQuestions[currentIndex].difficulty === 'medium'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                              : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                        }`}>
                          {flashcardQuestions[currentIndex].difficulty}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TYPE_BADGE_GRADIENT[flashcardQuestions[currentIndex].type] || 'bg-muted text-muted-foreground border-border'}`}>
                          {flashcardQuestions[currentIndex].type.replace('_', ' ')}
                        </span>
                        {flashcardQuestions[currentIndex].courseId && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium border border-border bg-muted/50 text-muted-foreground">
                            {COURSE_QUIZ_GROUPS.find((g) => g.id === flashcardQuestions[currentIndex].courseId)?.label || flashcardQuestions[currentIndex].courseId}
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg sm:text-xl font-semibold leading-relaxed max-w-lg">
                        {flashcardQuestions[currentIndex].question}
                      </h2>
                      {!hasEverFlipped && (
                        <motion.p
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className="text-xs text-muted-foreground mt-6 flex items-center gap-1.5"
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50 animate-pulse" />
                          Tap or press Space to reveal
                        </motion.p>
                      )}
                      {/* Progress indicator */}
                      <div className="mt-auto pt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold tabular-nums text-foreground/70">{currentIndex + 1}/{flashcardQuestions.length}</span>
                        {difficultCards.has(flashcardQuestions[currentIndex].id) && (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" /> Difficult
                          </span>
                        )}
                      </div>
                      {/* Swipe hint for users who have flipped before */}
                      {hasEverFlipped && !flipped && (
                        <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5 mt-3">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse" />
                          Tap, swipe, or press Space to flip
                        </p>
                      )}
                    </div>

                    {/* Back face */}
                    <div
                      className="glass rounded-2xl p-8 min-h-[280px] sm:min-h-[320px] flex flex-col items-center justify-center text-center absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <Lightbulb className="w-5 h-5 text-emerald-500" />
                        <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/10">
                          Answer
                        </Badge>
                        {flashcardQuestions[currentIndex].concept && (
                          <Badge variant="secondary" className="text-xs bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/10">
                            {flashcardQuestions[currentIndex].concept}
                          </Badge>
                        )}
                      </div>
                      <p className="text-base sm:text-lg font-medium leading-relaxed max-w-lg">
                        {flashcardQuestions[currentIndex].answer}
                      </p>
                      {flashcardQuestions[currentIndex].explanation && (
                        <p className="text-sm text-muted-foreground mt-4 max-w-lg leading-relaxed">
                          {flashcardQuestions[currentIndex].explanation}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-6 opacity-60">Swipe right → Known · Swipe left → Learning</p>
                      {/* Keyboard shortcut hints */}
                      <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-muted-foreground/50">
                        <span><kbd className="font-mono bg-muted/60 px-1 py-0.5 rounded border border-border/40 text-[10px]">Space</kbd> flip</span>
                        <span><kbd className="font-mono bg-muted/60 px-1 py-0.5 rounded border border-border/40 text-[10px]">←</kbd> prev</span>
                        <span><kbd className="font-mono bg-muted/60 px-1 py-0.5 rounded border border-border/40 text-[10px]">→</kbd> next</span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>

            {/* Known / Still Learning / Mark Difficult buttons */}
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-3"
              >
                <Button
                  variant="outline"
                  className="flex-1 max-w-[160px] border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
                  onClick={(e) => { e.stopPropagation(); handleFlashcardMark('learning'); }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Learning
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className={`shrink-0 h-10 w-10 ${difficultCards.has(flashcardQuestions[currentIndex].id) ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-border text-muted-foreground hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-400'}`}
                  onClick={(e) => { e.stopPropagation(); handleMarkDifficult(); }}
                  title={difficultCards.has(flashcardQuestions[currentIndex].id) ? 'Remove from review queue' : 'Mark as difficult'}
                >
                  <AlertTriangle className="h-4 w-4" />
                </Button>
                <Button
                  className="flex-1 max-w-[160px]"
                  onClick={(e) => { e.stopPropagation(); handleFlashcardMark('known'); }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Known
                </Button>
              </motion.div>
            )}

            {/* Flashcard navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFlashcardPrev}
                disabled={currentIndex === 0}
                className="text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const shuffled = [...flashcardQuestions].sort(() => Math.random() - 0.5);
                    setCurrentIndex(0);
                    setFlipped(false);
                  }}
                  className="text-muted-foreground"
                >
                  <Shuffle className="h-4 w-4 mr-1" />
                  Shuffle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFlashcardReset}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFlashcardNext}
                disabled={currentIndex === flashcardQuestions.length - 1}
                className="text-muted-foreground"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Flashcard progress dots */}
            {flashcardQuestions.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {flashcardQuestions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => { setCurrentIndex(i); setFlipped(false); }}
                    className={`h-2.5 rounded-full transition-all ${
                      i === currentIndex
                        ? 'bg-primary w-7 shadow-sm shadow-primary/30'
                        : knownCards.has(q.id)
                          ? 'bg-emerald-500 w-2.5'
                          : stillLearningCards.has(q.id)
                            ? 'bg-amber-500 w-2.5'
                            : flashcardReviewed.has(q.id)
                              ? 'bg-muted w-2.5'
                              : 'bg-muted/60 hover:bg-primary/40 w-2.5'
                    }`}
                    aria-label={`Go to card ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Question navigator dots (quiz mode only) */}
        {studyMode === 'quiz' && questions.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
            {questions.map((q, i) => (
              <motion.button
                key={q.id}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setCurrentIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === currentIndex
                    ? 'bg-primary w-7 shadow-sm shadow-primary/30'
                    : answered[q.id]
                      ? isCorrect(q, answers[q.id] || '')
                        ? 'bg-emerald-500 w-2.5'
                        : 'bg-destructive/60 w-2.5'
                      : 'bg-muted hover:bg-primary/40 w-2.5'
                }`}
                aria-label={`Go to question ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Question Map Dialog */}
        <Dialog open={showQuestionMap} onOpenChange={setShowQuestionMap}>
          <DialogContent className="max-w-md p-0">
            <DialogHeader className="px-6 pt-6 pb-3">
              <DialogTitle className="flex items-center gap-2 text-base">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Question Map
              </DialogTitle>
              <DialogDescription className="text-xs">
                Click a question to navigate. Color indicates your answer status.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-6">
              {/* Legend */}
              <div className="flex items-center gap-4 mb-4 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-emerald-500" />
                  Correct
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-amber-500" />
                  Close
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-red-500" />
                  Wrong
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-muted-foreground/30" />
                  Unanswered
                </div>
              </div>
              {/* Grid */}
              <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
                {questions.map((q, i) => {
                  const isCurrent = i === currentIndex;
                  const isAnswered = answered[q.id];
                  let statusColor = 'bg-muted/50 text-muted-foreground border-border';
                  let statusIcon: ReactNode = null;
                  if (isAnswered) {
                    if (q.type === 'fill_blank' && fillBlankGrades[q.id]) {
                      const grade = fillBlankGrades[q.id];
                      if (grade.status === 'correct') {
                        statusColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                        statusIcon = <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
                      } else if (grade.status === 'close') {
                        statusColor = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
                        statusIcon = <span className="text-[10px] font-bold text-amber-500">~</span>;
                      } else {
                        statusColor = 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30';
                        statusIcon = <XCircle className="h-3 w-3 text-red-500" />;
                      }
                    } else if (isCorrect(q, answers[q.id] || '')) {
                      statusColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                      statusIcon = <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
                    } else {
                      statusColor = 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30';
                      statusIcon = <XCircle className="h-3 w-3 text-red-500" />;
                    }
                  }
                  return (
                    <motion.button
                      key={q.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setCurrentIndex(i);
                        setShowQuestionMap(false);
                      }}
                      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg border p-2 text-xs font-medium transition-all ${statusColor} ${
                        isCurrent ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                      }`}
                    >
                      <span className="font-bold text-sm leading-none">{i + 1}</span>
                      {statusIcon}
                    </motion.button>
                  );
                })}
              </div>
              {/* Summary stats */}
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
                <span>{Object.keys(answered).length}/{questions.length} answered</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {questions.filter((q) => {
                    if (q.type === 'fill_blank' && fillBlankGrades[q.id]) return fillBlankGrades[q.id].status === 'correct';
                    return answered[q.id] && isCorrect(q, answers[q.id] || '');
                  }).length} correct
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}