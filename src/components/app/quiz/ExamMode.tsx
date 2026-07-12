'use client';

/**
 * Exam mode (docs/ROADMAP.md): the learner sets a time limit and question
 * count, the screen locks into a fullscreen exam, questions keep generating
 * section-by-section in the background while the countdown runs, and results
 * (score, accuracy, missed concepts) are stored in the browser for stats.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  GraduationCap,
  Loader2,
  Trophy,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBackgroundGeneration } from '@/hooks/useBackgroundGeneration';
import { loadQuestionCache } from '@/lib/questionCache';
import type { Question } from '@/types';
import { formatTimer, gradeFillBlank } from './helpers';

export interface ExamRecord {
  id: string;
  courseId: string | null;
  courseTitle: string;
  startedAt: number;
  durationSeconds: number;
  timeUsedSeconds: number;
  total: number;
  correct: number;
  missedConcepts: string[];
}

const EXAM_HISTORY_KEY = 'synapse-exam-history';

export function loadExamHistory(): ExamRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EXAM_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as ExamRecord[]) : [];
  } catch {
    return [];
  }
}

function saveExamRecord(record: ExamRecord): void {
  try {
    const history = [record, ...loadExamHistory()].slice(0, 50);
    localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable — the exam still completes, history just isn't kept
  }
}

const TIME_PRESETS = [5, 10, 15, 30];
const COUNT_PRESETS = [10, 20, 30];

interface ExamModeProps {
  courseId: string | null;
  courseTitle: string;
  /** Questions already available (store + cache merged by the parent). */
  initialPool: Question[];
  onExit: () => void;
}

type ExamPhase = 'config' | 'running' | 'finished';

export function ExamMode({ courseId, courseTitle, initialPool, onExit }: ExamModeProps) {
  const [phase, setPhase] = useState<ExamPhase>('config');
  const [minutes, setMinutes] = useState(10);
  const [targetCount, setTargetCount] = useState<number | 'unlimited'>(10);

  // Background generation keeps topping the pool up while the exam runs
  const gen = useBackgroundGeneration(courseId, { force: phase === 'running' && !!courseId });

  const [pool, setPool] = useState<Question[]>(initialPool);
  const [index, setIndex] = useState(0);
  const [correctIds, setCorrectIds] = useState<string[]>([]);
  const [wrongQuestions, setWrongQuestions] = useState<Question[]>([]);
  const [typed, setTyped] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);

  // Refresh the pool from cache whenever the background generator adds cards.
  // Genuine external-source sync (localStorage cache keyed by gen.cachedCount),
  // not derivable during render.
  useEffect(() => {
    if (!courseId) return;
    const cache = loadQuestionCache(courseId);
    if (cache && cache.questions.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external cache sync
      setPool((prev) => {
        const seen = new Set(prev.map((q) => q.question.toLowerCase()));
        const merged = [...prev];
        for (const q of cache.questions) {
          if (!seen.has(q.question.toLowerCase())) {
            seen.add(q.question.toLowerCase());
            merged.push(q);
          }
        }
        return merged;
      });
    }
  }, [courseId, gen.cachedCount]);

  const answeredCount = correctIds.length + wrongQuestions.length;
  const reachedTarget = targetCount !== 'unlimited' && answeredCount >= targetCount;
  const outOfQuestions = index >= pool.length && !gen.running && (gen.sectionsTotal == null || gen.sectionsDone >= (gen.sectionsTotal ?? 0));

  const finishExam = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const timeUsed = minutes * 60 - secondsLeft;
    saveExamRecord({
      id: `exam-${Date.now()}`,
      courseId,
      courseTitle,
      startedAt: startedAtRef.current,
      durationSeconds: minutes * 60,
      timeUsedSeconds: Math.max(0, timeUsed),
      total: correctIds.length + wrongQuestions.length,
      correct: correctIds.length,
      missedConcepts: [...new Set(wrongQuestions.map((q) => q.concept).filter(Boolean))] as string[],
    });
    setPhase('finished');
  }, [minutes, secondsLeft, courseId, courseTitle, correctIds.length, wrongQuestions]);

  // Countdown
  useEffect(() => {
    if (phase !== 'running') return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          finishExam();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, finishExam]);

  // End conditions besides the clock
  useEffect(() => {
    if (phase !== 'running') return;
    if (reachedTarget || (outOfQuestions && answeredCount > 0)) finishExam();
  }, [phase, reachedTarget, outOfQuestions, answeredCount, finishExam]);

  const startExam = () => {
    finishedRef.current = false;
    setCorrectIds([]);
    setWrongQuestions([]);
    setIndex(0);
    setSecondsLeft(minutes * 60);
    startedAtRef.current = Date.now();
    setPhase('running');
  };

  const current = pool[index];
  const options = current && Array.isArray(current.options) ? current.options : undefined;
  const isChoice = !!options && options.length >= 2;

  const recordAnswer = (isCorrect: boolean) => {
    if (!current) return;
    if (isCorrect) setCorrectIds((prev) => [...prev, current.id]);
    else setWrongQuestions((prev) => [...prev, current]);
    setTyped('');
    setIndex((i) => i + 1);
  };

  const handleTypedSubmit = () => {
    if (!typed.trim() || !current) return;
    const grade = gradeFillBlank(typed, current.answer);
    recordAnswer(grade.status === 'correct' || grade.status === 'close');
  };

  const accuracy = answeredCount > 0 ? Math.round((correctIds.length / answeredCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="mx-auto max-w-2xl p-4 sm:p-8 min-h-full flex flex-col">
        {/* ---------- Config ---------- */}
        {phase === 'config' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="m-auto w-full max-w-xl space-y-6">
            <div className="text-center space-y-1">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold gradient-text">Exam Mode</h1>
              <p className="text-sm text-muted-foreground">{courseTitle}</p>
            </div>

            <div className="glass rounded-xl p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">Time limit</p>
                <div className="flex gap-2 flex-wrap">
                  {TIME_PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMinutes(m)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        minutes === m ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Questions</p>
                <div className="flex gap-2 flex-wrap">
                  {COUNT_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setTargetCount(c)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        targetCount === c ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                  <button
                    onClick={() => setTargetCount('unlimited')}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      targetCount === 'unlimited' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'
                    }`}
                  >
                    As many as I can
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {pool.length} questions ready now — more keep generating in the background while you
                answer. No explanations mid-exam; you review everything at the end.
              </p>
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={onExit}>Cancel</Button>
              <Button onClick={startExam} disabled={pool.length === 0 && !courseId} className="glow-emerald">
                Start Exam
              </Button>
            </div>
            {pool.length === 0 && (
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                No questions cached yet — they will generate as the exam starts
              </p>
            )}
          </motion.div>
        )}

        {/* ---------- Running ---------- */}
        {phase === 'running' && (
          <div className="flex-1 flex flex-col">
            {/* Locked header: timer + progress + give up */}
            <div className="flex items-center justify-between py-4 sticky top-0 bg-background/95 backdrop-blur z-10">
              <div className={`flex items-center gap-2 font-mono text-lg font-bold tabular-nums ${secondsLeft <= 30 ? 'text-rose-500' : ''}`}>
                <Clock className="h-5 w-5" />
                {formatTimer(secondsLeft)}
              </div>
              <div className="text-sm text-muted-foreground tabular-nums">
                {answeredCount}
                {targetCount !== 'unlimited' ? `/${targetCount}` : ''} answered · {accuracy}% right
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={finishExam}>
                <Flag className="h-4 w-4 mr-1.5" />
                Finish
              </Button>
            </div>

            <div className="flex-1 flex flex-col justify-center py-6 w-full max-w-xl mx-auto">
              <AnimatePresence mode="wait">
                {current ? (
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.18 }}
                    className="glass rounded-2xl p-6 sm:p-8 space-y-6"
                  >
                    <h2 className="text-lg sm:text-xl font-semibold leading-relaxed">{current.question}</h2>
                    {isChoice ? (
                      <div className="grid gap-2">
                        {options!.map((option) => (
                          <button
                            key={option}
                            onClick={() => recordAnswer(option === current.answer)}
                            className="w-full text-left px-4 py-3 rounded-xl border border-border bg-background/50 text-sm font-medium hover:border-primary/50 hover:bg-primary/5 transition-colors"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          value={typed}
                          onChange={(e) => setTyped(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleTypedSubmit(); }}
                          placeholder="Type your answer…"
                          autoComplete="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          autoFocus
                        />
                        <Button onClick={handleTypedSubmit} disabled={!typed.trim()}>Submit</Button>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="waiting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center space-y-3 text-muted-foreground"
                  >
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm">Generating the next questions…</p>
                    <p className="text-xs">
                      {gen.sectionsTotal != null ? `Section ${gen.sectionsDone}/${gen.sectionsTotal}` : 'Working through your slides'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ---------- Results ---------- */}
        {phase === 'finished' && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="m-auto w-full max-w-xl space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Trophy className="h-8 w-8 text-amber-500" />
              </div>
              <h1 className="text-2xl font-bold gradient-text">Exam Complete</h1>
              <p className="text-4xl font-bold tabular-nums">
                {correctIds.length}
                <span className="text-lg font-normal text-muted-foreground">/{answeredCount}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {accuracy}% accuracy · {formatTimer(minutes * 60 - secondsLeft)} used of {minutes} min
              </p>
            </div>

            {wrongQuestions.length > 0 && (
              <div className="glass rounded-xl p-5 space-y-3 max-h-80 overflow-y-auto">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-rose-500" />
                  Review what you missed
                </p>
                {wrongQuestions.map((q) => (
                  <div key={q.id} className="border-t border-border/50 pt-3 text-sm space-y-1">
                    <p className="font-medium">{q.question}</p>
                    <p className="text-emerald-600 dark:text-emerald-400 flex items-start gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {q.answer}
                    </p>
                    {q.explanation && <p className="text-xs text-muted-foreground">{q.explanation}</p>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={onExit}>Back to Quiz</Button>
              <Button onClick={() => { setPhase('config'); }}>New Exam</Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
