'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  RotateCcw,
  ArrowLeft,
  Trophy,
  Sparkles,
  AlertTriangle,
  BookOpen,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/appStore';
import type { Question } from '@/types';

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

// ---------- Matching question component (drag-and-drop) ----------
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

  const handleLeftClick = (left: string) => {
    setSelectedLeft(left);
  };

  const handleRightClick = (right: string) => {
    if (!selectedLeft) return;
    setMatches((prev) => ({ ...prev, [selectedLeft]: right }));
    setSelectedLeft(null);
  };

  const handleRemoveMatch = (left: string) => {
    setMatches((prev) => {
      const next = { ...prev };
      delete next[left];
      return next;
    });
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
        Click a left item, then click its match on the right. Click a matched item to remove it.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-2">
          {pairs.map((p) => (
            <motion.button
              key={p.left}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                matches[p.left]
                  ? handleRemoveMatch(p.left)
                  : handleLeftClick(p.left)
              }
              className={`rounded-lg border p-3 text-left text-sm font-medium transition-all ${
                selectedLeft === p.left
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                  : matches[p.left]
                    ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                    : 'border-border hover:border-primary/30 hover:bg-primary/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span className="flex-1">{p.left}</span>
                {matches[p.left] && (
                  <span className="text-xs opacity-60 truncate max-w-[120px]">
                    → {matches[p.left]}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
        {/* Right column */}
        <div className="flex flex-col gap-2">
          {shuffledRight.map((r) => {
            const isUsed = usedRights.has(r);
            return (
              <motion.button
                key={r}
                whileTap={{ scale: 0.98 }}
                onClick={() => !isUsed && handleRightClick(r)}
                disabled={isUsed || !selectedLeft}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  isUsed
                    ? 'border-border bg-muted/50 text-muted-foreground line-through opacity-50'
                    : selectedLeft
                      ? 'border-border hover:border-primary/30 hover:bg-primary/5 cursor-pointer'
                      : 'border-border opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                  {r}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {Object.keys(matches).length} of {pairs.length} matched
        </span>
        <Button onClick={handleSubmit} disabled={!allMatched} size="sm">
          Submit Matches
        </Button>
      </div>
    </div>
  );
}

// ---------- Main QuizView ----------
export function QuizView() {
  const { navigate, currentQuestions, activeCourse } = useAppStore();

  const allQuestions = currentQuestions.length > 0 ? currentQuestions : MOCK_QUESTIONS;

  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    // Reset quiz state on course change
    setCurrentIndex(0);
    setAnswers({});
    setAnswered({});
    setShowExplanation(false);
    setShowResults(false);
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

      const newAnswers = { ...answers, [currentQ.id]: answer };
      const newAnswered = { ...answered, [currentQ.id]: true };
      setAnswers(newAnswers);
      setAnswered(newAnswered);
      setShowExplanation(true);

      if (isCorrect(currentQ, answer)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
      }
    },
    [answered, answers, currentQ, isCorrect],
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
  };

  const score = useMemo(() => {
    return questions.filter((q) => answered[q.id] && isCorrect(q, answers[q.id] || '')).length;
  }, [questions, answered, answers, isCorrect]);

  const circumference = 2 * Math.PI * 54;
  const scorePercent = questions.length > 0 ? score / questions.length : 0;
  const strokeDashoffset = circumference * (1 - scorePercent);

  // ---------- Empty State ----------
  if (questions.length === 0) {
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
        className="flex flex-col items-center justify-center min-h-[70vh] gap-6"
      >
        <div className="glass rounded-2xl p-8 text-center space-y-6 max-w-md w-full">
          <div className="relative inline-flex">
            <svg width="140" height="140" className="-rotate-90">
              <circle
                cx="70"
                cy="70"
                r="54"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-muted/30"
              />
              <motion.circle
                cx="70"
                cy="70"
                r="54"
                fill="none"
                stroke="url(#scoreGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Trophy className="h-6 w-6 text-amber-500 mb-1" />
              <span className="text-3xl font-bold">{score}/{questions.length}</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(scorePercent * 100)}% correct
              </span>
            </div>
          </div>

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
            <div className="max-h-48 overflow-y-auto space-y-1">
              {questions.map((q, i) => {
                const wasCorrect = answered[q.id] && isCorrect(q, answers[q.id] || '');
                return (
                  <div key={q.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${wasCorrect ? 'bg-emerald-500 text-white' : 'bg-destructive/20 text-destructive'}`}>
                      {wasCorrect ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{q.question.slice(0, 60)}{q.question.length > 60 ? '...' : ''}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{q.type.replace('_', ' ')}</Badge>
                  </div>
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

  // ---------- Question Screen ----------
  return (
    <div className="pl-14 lg:pl-0">
      <div className="relative">
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

        {/* Course filter + Progress bar */}
        <div className="mb-6 space-y-3">
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
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-1.5">
                {currentQ?.difficulty}
              </Badge>
              <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                {currentQ?.type.replace('_', ' ')}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          {currentQ && (
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="glass rounded-xl p-6 space-y-6"
            >
              {/* Concept tag */}
              {currentQ.concept && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {currentQ.concept}
                  </Badge>
                </div>
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
                        whileHover={!isAnswered ? { scale: 1.01 } : {}}
                        whileTap={!isAnswered ? { scale: 0.99 } : {}}
                        onClick={() => !isAnswered && handleAnswer(opt)}
                        disabled={isAnswered}
                        className={`flex items-center gap-3 rounded-lg border p-4 text-left text-sm transition-all ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : isSelected
                                ? 'border-destructive bg-destructive/10'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                            isAnswered && isCorrectOpt
                              ? 'bg-emerald-500 text-white'
                              : isAnswered && isSelected
                                ? 'bg-destructive text-white'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isAnswered && isCorrectOpt ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isAnswered && isSelected ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            letter
                          )}
                        </span>
                        <span>{opt}</span>
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
                        whileHover={!isAnswered ? { scale: 1.02 } : {}}
                        whileTap={!isAnswered ? { scale: 0.98 } : {}}
                        onClick={() => !isAnswered && handleAnswer(opt)}
                        disabled={isAnswered}
                        className={`flex-1 rounded-lg border p-4 text-center font-semibold transition-all ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : isSelected
                                ? 'border-destructive bg-destructive/10 text-destructive'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer'
                        }`}
                      >
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

        {/* Question navigator dots */}
        {questions.length > 1 && (
          <div className="flex items-center justify-center gap-1 mt-6 flex-wrap">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  i === currentIndex
                    ? 'bg-primary w-6'
                    : answered[q.id]
                      ? isCorrect(q, answers[q.id] || '')
                        ? 'bg-emerald-500'
                        : 'bg-destructive/60'
                      : 'bg-muted hover:bg-primary/40'
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
