'use client';

/**
 * Interactive flashcard: instead of tap-to-reveal, the learner answers the
 * card — clicking an option (multiple choice) or typing the answer
 * (case-insensitive with typo tolerance). A correct answer flashes green and
 * auto-advances; a wrong answer flips the card to the answer + explanation
 * and stays until the learner continues. "Reveal" remains as a give-up path.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Eye,
  HelpCircle,
  Lightbulb,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Question } from '@/types';
import { gradeFillBlank } from './helpers';

const AUTO_ADVANCE_MS = 900;

interface InteractiveFlashcardProps {
  question: Question;
  index: number;
  total: number;
  isDifficult: boolean;
  /** Marks the card and advances (or opens the summary on the last card). */
  onMark: (type: 'known' | 'learning') => void;
  onToggleDifficult: () => void;
}

type Phase = 'answering' | 'correct' | 'revealed';

export function InteractiveFlashcard({
  question,
  index,
  total,
  isDifficult,
  onMark,
  onToggleDifficult,
}: InteractiveFlashcardProps) {
  const [phase, setPhase] = useState<Phase>('answering');
  const [chosen, setChosen] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [typedWrong, setTypedWrong] = useState(false);
  /** true when the learner answered wrong (vs. clicking Reveal) */
  const [answeredWrong, setAnsweredWrong] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options = Array.isArray(question.options) ? question.options : undefined;
  const isChoice = !!options && options.length >= 2;

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  // Space reveals the answer (parity with the old flip) — never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space' && phase === 'answering') {
        e.preventDefault();
        setPhase('revealed');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const scheduleAdvance = () => {
    advanceTimer.current = setTimeout(() => onMark('known'), AUTO_ADVANCE_MS);
  };

  const handleChoose = (option: string) => {
    if (phase !== 'answering') return;
    setChosen(option);
    if (option === question.answer) {
      setPhase('correct');
      scheduleAdvance();
    } else {
      setAnsweredWrong(true);
      setPhase('revealed');
    }
  };

  const handleTypedSubmit = () => {
    if (phase !== 'answering' || !typed.trim()) return;
    const grade = gradeFillBlank(typed, question.answer);
    if (grade.status === 'correct' || grade.status === 'close') {
      setPhase('correct');
      scheduleAdvance();
    } else {
      // First miss shakes and lets them retry; second miss reveals.
      if (!typedWrong) {
        setTypedWrong(true);
        return;
      }
      setAnsweredWrong(true);
      setPhase('revealed');
    }
  };

  const difficultyClass =
    question.difficulty === 'easy'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
      : question.difficulty === 'medium'
        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
        : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20';

  return (
    <div className="space-y-4">
      <motion.div
        key={question.id}
        initial={{ opacity: 0.5, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`glass rounded-2xl p-6 sm:p-8 min-h-80 flex flex-col ${
          phase === 'correct'
            ? 'ring-2 ring-emerald-500/60'
            : phase === 'revealed' && answeredWrong
              ? 'ring-2 ring-rose-500/40'
              : ''
        }`}
      >
        {/* Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap justify-center">
          <HelpCircle className="w-5 h-5 text-primary/60" />
          {question.concept && (
            <Badge variant="secondary" className="text-xs bg-primary/10 border-primary/10">
              {question.concept}
            </Badge>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${difficultyClass}`}>
            {question.difficulty}
          </span>
          {isDifficult && (
            <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" /> Difficult
            </span>
          )}
          <span className="ml-auto text-xs font-semibold tabular-nums text-foreground/60">
            {index + 1}/{total}
          </span>
        </div>

        {/* Question */}
        <h2 className="text-lg sm:text-xl font-semibold leading-relaxed text-center max-w-lg mx-auto">
          {question.question}
        </h2>

        {/* Interaction area */}
        <div className="mt-6 flex-1 flex flex-col justify-center max-w-lg w-full mx-auto">
          {phase === 'revealed' ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-3"
            >
              <div className="flex items-center justify-center gap-2">
                <Lightbulb className="w-5 h-5 text-emerald-500" />
                <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/10">
                  Answer
                </Badge>
              </div>
              <p className="text-base sm:text-lg font-medium leading-relaxed">{question.answer}</p>
              {question.explanation && (
                <p className="text-sm text-muted-foreground leading-relaxed">{question.explanation}</p>
              )}
              {answeredWrong && chosen && (
                <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1">
                  <XCircle className="h-3.5 w-3.5" /> You picked: {chosen}
                </p>
              )}
            </motion.div>
          ) : isChoice ? (
            <div className="grid gap-2">
              {options!.map((option) => {
                const isCorrectPick = phase === 'correct' && option === question.answer;
                return (
                  <motion.button
                    key={option}
                    whileTap={phase === 'answering' ? { scale: 0.98 } : undefined}
                    onClick={() => handleChoose(option)}
                    disabled={phase !== 'answering'}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      isCorrectPick
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'border-border bg-background/50 hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    {isCorrectPick && <CheckCircle2 className="inline h-4 w-4 mr-2 text-emerald-500" />}
                    {option}
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <motion.div
                animate={typedWrong && phase === 'answering' ? { x: [0, -8, 8, -5, 5, 0] } : {}}
                transition={{ duration: 0.35 }}
                className="flex gap-2"
              >
                <Input
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setTypedWrong(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTypedSubmit();
                  }}
                  placeholder="Type your answer…"
                  disabled={phase !== 'answering'}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className={typedWrong ? 'border-rose-500/60' : ''}
                />
                <Button onClick={handleTypedSubmit} disabled={!typed.trim() || phase !== 'answering'}>
                  Check
                </Button>
              </motion.div>
              <p className="text-[11px] text-muted-foreground text-center">
                {typedWrong
                  ? 'Not quite — try once more, or reveal the answer below'
                  : 'Casing and small typos are forgiven · Enter to check'}
              </p>
            </div>
          )}

          {phase === 'correct' && (
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400 text-center flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Correct — next card…
            </motion.p>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-center gap-3">
          {phase === 'answering' && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setPhase('revealed')}>
              <Eye className="h-4 w-4 mr-1.5" />
              Reveal answer
            </Button>
          )}
          {phase === 'revealed' && (
            <>
              <Button
                variant="outline"
                className="flex-1 max-w-40 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={() => onMark('learning')}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Learning
              </Button>
              <Button
                variant="outline"
                size="icon"
                className={`shrink-0 h-10 w-10 ${isDifficult ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'text-muted-foreground hover:border-amber-500/50'}`}
                onClick={onToggleDifficult}
                title={isDifficult ? 'Remove from review queue' : 'Mark as difficult'}
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
              <Button className="flex-1 max-w-40" onClick={() => onMark(answeredWrong ? 'learning' : 'known')}>
                {answeredWrong ? (
                  <>
                    Continue
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Known
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
