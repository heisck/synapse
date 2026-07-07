'use client';

import { useState, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/stores/appStore';
import type { Question } from '@/types';

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
  },
  {
    id: 'tf-1',
    type: 'true_false',
    question: 'Photosynthesis occurs in the mitochondria of plant cells.',
    answer: 'False',
    explanation: 'Photosynthesis occurs in the chloroplasts, not the mitochondria. Chloroplasts contain chlorophyll and are the site of the light-dependent and light-independent reactions.',
    difficulty: 'easy',
    concept: 'Cell Biology',
  },
  {
    id: 'sa-1',
    type: 'short_answer',
    question: 'What is the chemical equation for cellular respiration?',
    answer: 'C6H12O6 + 6O2 → 6CO2 + 6H2O + ATP',
    explanation: 'Cellular respiration converts glucose and oxygen into carbon dioxide, water, and energy in the form of ATP.',
    difficulty: 'medium',
    concept: 'Biochemistry',
  },
  {
    id: 'fb-1',
    type: 'fill_blank',
    question: 'The ____ is the control center of the cell, containing the genetic material DNA.',
    answer: 'nucleus',
    explanation: 'The nucleus is a membrane-bound organelle that contains the cell\'s chromosomes and regulates gene expression.',
    difficulty: 'easy',
    concept: 'Cell Biology',
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
  },
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

// ---------- Matching question component ----------
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

  const handleSubmit = () => {
    const answer = Object.entries(matches)
      .map(([l, r]) => `${l}-${r}`)
      .join(', ');
    onAnswer(answer);
  };

  const allMatched = pairs.every((p) => matches[p.left]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Click a left item, then click its match on the right.</p>
      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="flex flex-col gap-2">
          {pairs.map((p) => (
            <button
              key={p.left}
              onClick={() => handleLeftClick(p.left)}
              className={`rounded-lg border p-3 text-left text-sm font-medium transition-all ${
                selectedLeft === p.left
                  ? 'border-primary bg-primary/10 text-primary'
                  : matches[p.left]
                    ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                    : 'border-border hover:border-primary/30'
              }`}
            >
              {p.left}
              {matches[p.left] && (
                <span className="ml-2 text-xs opacity-60">→ {matches[p.left]}</span>
              )}
            </button>
          ))}
        </div>
        {/* Right column */}
        <div className="flex flex-col gap-2">
          {shuffledRight.map((r) => {
            const isUsed = Object.values(matches).includes(r);
            return (
              <button
                key={r}
                onClick={() => !isUsed && handleRightClick(r)}
                disabled={isUsed || !selectedLeft}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  isUsed
                    ? 'border-border bg-muted/50 text-muted-foreground line-through'
                    : selectedLeft
                      ? 'border-border hover:border-primary/30 hover:bg-primary/5 cursor-pointer'
                      : 'border-border opacity-60'
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={!allMatched} size="sm" className="mt-2">
        Submit Matches
      </Button>
    </div>
  );
}

// ---------- Main QuizView ----------
export function QuizView() {
  const { navigate, currentQuestions } = useAppStore();

  const questions = currentQuestions.length > 0 ? currentQuestions : MOCK_QUESTIONS;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const isCorrect = (q: Question, userAnswer: string): boolean => {
    const ua = userAnswer.trim().toLowerCase();
    const ca = q.answer.trim().toLowerCase();
    if (q.type === 'short_answer' || q.type === 'error_correction') {
      return ua === ca || ua.includes(ca) || ca.includes(ua);
    }
    return ua === ca;
  };

  const handleAnswer = useCallback(
    (answer: string) => {
      if (answered[currentQ.id]) return;

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
    [answered, answers, currentQ],
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
  }, [questions, answered, answers]);

  const circumference = 2 * Math.PI * 54;
  const scorePercent = questions.length > 0 ? score / questions.length : 0;
  const strokeDashoffset = circumference * (1 - scorePercent);

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
                ? 'Excellent! 🎉'
                : scorePercent >= 0.6
                  ? 'Good effort! 👍'
                  : 'Keep practicing! 💪'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              You answered {score} out of {questions.length} questions correctly
            </p>
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

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full font-medium">
              {currentQ.type.replace('_', ' ')}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="glass rounded-xl p-6 space-y-6"
          >
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
                    <button
                      key={opt}
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
                    </button>
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
                    <button
                      key={opt}
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
                    </button>
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
                <p className="text-muted-foreground">Your answer: </p>
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
                    {currentQ.type === 'short_answer' || currentQ.type === 'error_correction' ? (
                      <div className="mt-2">
                        <span className="text-xs text-muted-foreground">Expected answer: </span>
                        <span className="text-xs font-medium">{currentQ.answer}</span>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Next button */}
            {answered[currentQ.id] && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end"
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
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}