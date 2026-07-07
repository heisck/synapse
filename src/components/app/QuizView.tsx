'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/appStore';
import type { Question } from '@/types';

type StudyMode = 'quiz' | 'flashcard';

// ---------- Typo-tolerance helper ----------
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[b.length][a.length];
}

function isFuzzyMatch(userAnswer: string, correctAnswer: string, maxDistance: number = 2): boolean {
  const ua = userAnswer.trim().toLowerCase();
  const ca = correctAnswer.trim().toLowerCase();
  if (ua === ca) return true;
  if (ua.includes(ca) || ca.includes(ua)) return true;
  // Levenshtein distance for typo tolerance
  const dist = levenshteinDistance(ua, ca);
  // Allow 1 typo for short answers, 2 for longer ones
  const threshold = maxDistance || (ca.length <= 4 ? 1 : 2);
  if (dist <= threshold) return true;
  // Word-level check: all words of correct answer present in user answer (in any order)
  const correctWords = ca.split(/\s+/);
  const userWords = ua.split(/\s+/);
  if (correctWords.every((w) => userWords.some((uw) => uw.includes(w) || w.includes(uw)))) return true;
  return false;
}

// ---------- Timer helper ----------
function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ---------- Mock questions for all 6 types ----------
const MOCK_QUESTIONS: Question[] = [
  {
    id: 'mc-1',
    type: 'multiple_choice',
    question: 'What is the primary function of mitochondria in a cell?',
    options: ['Protein synthesis', 'Energy production (ATP)', 'Cell division', 'Waste removal'],
    answer: 'Energy production (ATP)',
    explanation: 'Mitochondria are known as the "powerhouse of the cell" because they generate most of the cell\'s supply of ATP, used as a source of chemical energy.',
    difficulty: 'easy',
    concept: 'Cell Biology',
    courseId: 'demo-course',
  },
  {
    id: 'tf-1',
    type: 'true_false',
    question: 'Photosynthesis occurs in the mitochondria of plant cells.',
    answer: 'False',
    explanation: 'Photosynthesis occurs in the chloroplasts, not the mitochondria. Chloroplasts contain chlorophyll and are the site of the light-dependent and light-independent reactions.',
    difficulty: 'easy',
    concept: 'Cell Biology',
    courseId: 'demo-course',
  },
  {
    id: 'sa-1',
    type: 'short_answer',
    question: 'What is the chemical equation for cellular respiration?',
    answer: 'C6H12O6 + 6O2 → 6CO2 + 6H2O + ATP',
    explanation: 'Cellular respiration converts glucose and oxygen into carbon dioxide, water, and energy in the form of ATP.',
    difficulty: 'medium',
    concept: 'Biochemistry',
    courseId: 'demo-course',
  },
  {
    id: 'fb-1',
    type: 'fill_blank',
    question: 'The ____ is the control center of the cell, containing the genetic material DNA.',
    answer: 'nucleus',
    explanation: 'The nucleus is a membrane-bound organelle that contains the cell\'s chromosomes and regulates gene expression.',
    difficulty: 'easy',
    concept: 'Cell Biology',
    courseId: 'demo-course',
  },
  {
    id: 'fb-2',
    type: 'fill_blank',
    question: '____ is the process by which cells divide to form two identical daughter cells.',
    answer: 'mitosis',
    explanation: 'Mitosis ensures that each daughter cell receives an exact copy of the parent cell\'s DNA.',
    difficulty: 'medium',
    concept: 'Cell Biology',
    courseId: 'demo-course',
  },
  {
    id: 'match-1',
    type: 'matching',
    question: 'Match each cell organelle to its primary function.',
    matchingPairs: [
      { left: 'Ribosome', right: 'Protein synthesis' },
      { left: 'Golgi apparatus', right: 'Packaging & shipping' },
      { left: 'Lysosome', right: 'Digestion & recycling' },
      { left: 'Endoplasmic reticulum', right: 'Lipid synthesis & transport' },
    ],
    answer: 'Ribosome-Protein synthesis, Golgi apparatus-Packaging & shipping, Lysosome-Digestion & recycling, Endoplasmic reticulum-Lipid synthesis & transport',
    explanation: 'Each organelle has a specialized function that contributes to the overall operation of the cell.',
    difficulty: 'medium',
    concept: 'Cell Biology',
    courseId: 'demo-course',
  },
  {
    id: 'ec-1',
    type: 'error_correction',
    question: 'Identify and correct the errors in the following statement:',
    errorText: 'Mitochondria are found only in animal cells. They are responsible for photosynthesis and converting sunlight into glucose. Plant cells do not have mitochondria.',
    answer: 'Mitochondria are found in both animal and plant cells. They are responsible for cellular respiration and converting glucose into ATP (energy).',
    explanation: 'The original text had three errors: (1) mitochondria are in both plant and animal cells, (2) they perform cellular respiration not photosynthesis, and (3) plant cells do have mitochondria.',
    difficulty: 'hard',
    concept: 'Cell Biology',
    courseId: 'demo-course',
  },
  {
    id: 'mc-2',
    type: 'multiple_choice',
    question: 'Which data structure uses LIFO (Last In, First Out) ordering?',
    options: ['Queue', 'Stack', 'Linked List', 'Tree'],
    answer: 'Stack',
    explanation: 'A Stack follows LIFO ordering — the last element pushed onto the stack is the first one popped off. Think of a stack of plates.',
    difficulty: 'easy',
    concept: 'Data Structures',
    courseId: 'cs-course',
  },
  {
    id: 'sa-2',
    type: 'short_answer',
    question: 'What is the time complexity of binary search?',
    answer: 'O(log n)',
    explanation: 'Binary search divides the search space in half each step, giving logarithmic time complexity.',
    difficulty: 'medium',
    concept: 'Algorithms',
    courseId: 'cs-course',
  },
];

// ---------- Course filter ----------
const COURSE_QUIZ_GROUPS = [
  { id: 'all', label: 'All Questions', icon: BookOpen },
  { id: 'demo-course', label: 'Cell Biology', icon: BookOpen },
  { id: 'cs-course', label: 'Computer Science', icon: BookOpen },
];

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

const CONFETTI_COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#22c55e'];

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
                onDragStart={(e) => handleDragStart(e, p.left)}
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

// ---------- Main QuizView ----------
export function QuizView() {
  const { navigate, currentQuestions, activeCourse } = useAppStore();

  const allQuestions = currentQuestions.length > 0 ? currentQuestions : MOCK_QUESTIONS;

  const [studyMode, setStudyMode] = useState<StudyMode>('quiz');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const animatedScore = useAnimatedCounter(showResults ? score : 0, 1500);

  // Timer state
  const [timerStarted, setTimerStarted] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Flashcard state
  const [flipped, setFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [stillLearningCards, setStillLearningCards] = useState<Set<string>>(new Set());
  const [flashcardReviewed, setFlashcardReviewed] = useState<Set<string>>(new Set());
  const [showFlashcardSummary, setShowFlashcardSummary] = useState(false);
  const [hasEverFlipped, setHasEverFlipped] = useState(false);

  // Swipe motion values for flashcard (no re-renders)
  const dragXMotion = useMotionValue(0);
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

  // Difficulty distribution
  const difficultyCounts = useMemo(() => {
    const targetQuestions = studyMode === 'quiz' ? questions : flashcardQuestions;
    return {
      easy: targetQuestions.filter((q) => q.difficulty === 'easy').length,
      medium: targetQuestions.filter((q) => q.difficulty === 'medium').length,
      hard: targetQuestions.filter((q) => q.difficulty === 'hard').length,
    };
  }, [studyMode === 'quiz' ? questions : flashcardQuestions, studyMode]);

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

    setFlipped(false);
    if (currentIndex < flashcardQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowFlashcardSummary(true);
    }
  }, [currentIndex, flashcardQuestions, flashcardReviewed]);

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

  const handleFlashcardReset = useCallback(() => {
    setCurrentIndex(0);
    setFlipped(false);
    setKnownCards(new Set());
    setStillLearningCards(new Set());
    setFlashcardReviewed(new Set());
    setShowFlashcardSummary(false);
    setHasEverFlipped(false);
  }, []);

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
    setFlashcardReviewed(new Set());
    setShowFlashcardSummary(false);
    setHasEverFlipped(false);
    setTimerStarted(false);
    setTimerSeconds(0);
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
    setFlashcardReviewed(new Set());
    setShowFlashcardSummary(false);
    setHasEverFlipped(false);
    setTimerStarted(false);
    setTimerSeconds(0);
  };

  // Filter questions by selected course
  const questions = useMemo(() => {
    if (selectedCourse === 'all') return allQuestions;
    return allQuestions.filter((q) => q.courseId === selectedCourse);
  }, [allQuestions, selectedCourse]);

  const currentQ = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const isCorrect = useCallback(
    (q: Question, userAnswer: string): boolean => {
      const ua = userAnswer.trim().toLowerCase();
      const ca = q.answer.trim().toLowerCase();
      if (q.type === 'short_answer' || q.type === 'error_correction') {
        return isFuzzyMatch(userAnswer, q.answer, 3);
      }
      if (q.type === 'fill_blank') {
        return isFuzzyMatch(userAnswer, q.answer, 2);
      }
      return ua === ca;
    },
    [],
  );

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
      } else {
        setStreak(0);
      }
    },
    [answered, answers, currentQ, isCorrect, streak, bestStreak, timerStarted],
  );

  const handleNext = () => {
    setShowExplanation(false);
    if (currentIndex < questions.length - 1) {
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
  };

  const score = useMemo(() => {
    return questions.filter((q) => answered[q.id] && isCorrect(q, answers[q.id] || '')).length;
  }, [questions, answered, answers, isCorrect]);

  const circumference = 2 * Math.PI * 62;
  const scorePercent = questions.length > 0 ? score / questions.length : 0;
  const strokeDashoffset = circumference * (1 - scorePercent);

  const difficultyTotal = difficultyCounts.easy + difficultyCounts.medium + difficultyCounts.hard;

  // ---------- Empty State ----------
  if (questions.length === 0 && flashcardQuestions.length === 0) {
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
                {animatedScore}<span className="text-lg font-normal text-muted-foreground">/{questions.length}</span>
              </motion.span>
              <span className="text-xs text-muted-foreground mt-1">
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
                const wasCorrect = answered[q.id] && isCorrect(q, answers[q.id] || '');
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${wasCorrect ? 'bg-emerald-500/5' : 'bg-destructive/5'}`}
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, delay: i * 0.05 }}
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

          <div className="flex justify-center gap-3">
            <Button onClick={handleRetry} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
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
    <div className="pl-14 lg:pl-0">
      <div className="relative">
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
                <h1 className="text-xl font-bold gradient-text">{studyMode === 'quiz' ? 'Quiz Practice' : 'Flashcard Study'}</h1>
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
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Timer display (quiz mode only) */}
                {studyMode === 'quiz' && timerStarted && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 border border-border text-xs font-mono text-muted-foreground"
                  >
                    <motion.div
                      animate={showResults ? {} : { opacity: [1, 0.5, 1] }}
                      transition={showResults ? {} : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Clock className="h-3.5 w-3.5 text-primary/60" />
                    </motion.div>
                    <span>{formatTimer(timerSeconds)}</span>
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
              </div>
            </div>
            {/* Course filter tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {COURSE_QUIZ_GROUPS.map((group) => (
              <button
                key={group.id}
                onClick={() => handleCourseChange(group.id)}
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
          </div>
          {/* Difficulty Progress Tracker */}
          {difficultyTotal > 0 && (
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
          {/* Custom gradient progress bar */}
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
          </div>
        </motion.div>

        {/* Quiz question card */}
        {studyMode === 'quiz' && (
        <AnimatePresence mode="wait">
          {currentQ && (
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass rounded-xl p-6 space-y-6 glow-emerald"
            >
              {/* Concept tag */}
              {currentQ.concept && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  <Badge variant="secondary" className="text-xs bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/10">
                    {currentQ.concept}
                  </Badge>
                </motion.div>
              )}

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
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Fill in the blank..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        handleAnswer((e.target as HTMLInputElement).value);
                      }
                    }}
                    id="fill-blank-input"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('fill-blank-input') as HTMLInputElement;
                      if (input?.value.trim()) handleAnswer(input.value);
                    }}
                  >
                    Submit
                  </Button>
                </div>
              )}

              {currentQ.type === 'fill_blank' && answered[currentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your answer:</p>
                  <p className="font-medium">{answers[currentQ.id]}</p>
                </div>
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
                          Tap to reveal
                        </motion.p>
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
                      <p className="text-xs text-muted-foreground mt-6 opacity-60">Swipe or use buttons below</p>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>

            {/* Known / Still Learning buttons */}
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-3"
              >
                <Button
                  variant="outline"
                  className="flex-1 max-w-[200px] border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
                  onClick={(e) => { e.stopPropagation(); handleFlashcardMark('learning'); }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Still Learning
                </Button>
                <Button
                  className="flex-1 max-w-[200px]"
                  onClick={(e) => { e.stopPropagation(); handleFlashcardMark('known'); }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Known
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
      </div>
    </div>
  );
}