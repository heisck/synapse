'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MessageCircle,
  Send,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Layers,
  Lightbulb,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/stores/appStore';
import { useSpacedRepetition } from '@/hooks/useSpacedRepetition';
import { checkAnswer } from '@/lib/answerCheck';
import type { Question } from '@/types';

type ChatMsg = { role: 'user' | 'assistant'; content: string };

const spring = { type: 'spring' as const, stiffness: 260, damping: 26 };

const difficultyStyles: Record<string, string> = {
  easy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  hard: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

export function CardStudyView() {
  const { activeCourse, navigate, updateMastery } = useAppStore();
  const { reviewItem } = useSpacedRepetition();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [inputValue, setInputValue] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  // Per-card chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatByCard, setChatByCard] = useState<Record<string, ChatMsg[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const courseId = activeCourse?.id;

  // --- Load real questions: fetch existing, generate if none exist ---
  const loadQuestions = useCallback(async () => {
    if (!courseId) {
      setLoading(false);
      setError('No active course selected. Open a course first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions?courseId=${encodeURIComponent(courseId)}`);
      const data = await res.json();
      let list: Question[] = res.ok && Array.isArray(data.questions) ? data.questions : [];

      if (list.length === 0) {
        // No persisted questions yet — generate a fresh set via the LLM.
        setGenerating(true);
        const genRes = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        });
        const genData = await genRes.json();
        if (!genRes.ok || !Array.isArray(genData.questions) || genData.questions.length === 0) {
          throw new Error(genData.error || 'Failed to generate questions.');
        }
        list = genData.questions;
        setGenerating(false);
      }

      setQuestions(list);
      setCurrentIndex(0);
    } catch (e) {
      setGenerating(false);
      setError(e instanceof Error ? e.message : 'Failed to load cards.');
      toast.error('Could not load study cards. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const currentQ = questions[currentIndex];
  const total = questions.length;

  const scored = useMemo(() => {
    let correct = 0;
    let done = 0;
    for (const q of questions) {
      if (answered[q.id]) {
        done++;
        if (checkAnswer(q, answers[q.id] || '')) correct++;
      }
    }
    return { correct, done };
  }, [questions, answered, answers]);

  // Reset transient state when the active card changes.
  useEffect(() => {
    setInputValue('');
    setChatOpen(false);
    setChatInput('');
  }, [currentQ?.id]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatByCard, currentQ?.id, chatLoading]);

  // --- Answer submission: feeds spaced repetition + mastery, like QuizView review mode ---
  const submitAnswer = useCallback(
    (answer: string) => {
      if (!currentQ || answered[currentQ.id] || !answer.trim()) return;

      setAnswers((prev) => ({ ...prev, [currentQ.id]: answer }));
      setAnswered((prev) => ({ ...prev, [currentQ.id]: true }));

      const correct = checkAnswer(currentQ, answer);
      const concept = currentQ.concept;

      if (concept) {
        // Spaced repetition quality: 5 = perfect recall, 0 = blackout.
        reviewItem(concept, correct ? 5 : 0);
        // Mastery tracking (evidence-based), mirroring QuizView.handleReviewAnswer.
        updateMastery(
          concept,
          correct ? 5 : 1,
          `Card study: ${correct ? 'correct' : 'incorrect'} — ${currentQ.question.slice(0, 80)}`,
        );
      }

      if (correct) {
        toast.success('Correct!');
      } else {
        toast.error('Not quite — check the explanation.');
      }
    },
    [currentQ, answered, reviewItem, updateMastery],
  );

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(total - 1, i + 1));

  // --- Regenerate: request a fresh variation of the same concept from the AI ---
  const handleRegenerate = useCallback(async () => {
    if (!currentQ || regenerating) return;
    setRegenerating(true);
    try {
      const res = await fetch('/api/questions/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: { ...currentQ, courseId } }),
      });
      const data = await res.json();
      if (!res.ok || !data.question) {
        throw new Error(data.error || 'Failed to regenerate.');
      }
      const fresh: Question = data.question;
      const oldId = currentQ.id;
      setQuestions((prev) => prev.map((q, i) => (i === currentIndex ? fresh : q)));
      // Clear any answer state tied to the replaced card.
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[oldId];
        return next;
      });
      setAnswered((prev) => {
        const next = { ...prev };
        delete next[oldId];
        return next;
      });
      setInputValue('');
      toast.success('Fresh version generated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to regenerate this card.');
    } finally {
      setRegenerating(false);
    }
  }, [currentQ, regenerating, currentIndex, courseId]);

  // --- Per-card chat: ask the AI about THIS card ---
  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || !currentQ || chatLoading) return;

    const cardId = currentQ.id;
    const history = chatByCard[cardId] || [];
    const nextHistory: ChatMsg[] = [...history, { role: 'user', content: text }];
    setChatByCard((prev) => ({ ...prev, [cardId]: nextHistory }));
    setChatInput('');
    setChatLoading(true);

    const system =
      `You are Synapse, a concise study assistant helping with a single quiz card. ` +
      `Answer only about this card in 2-4 sentences.\n\n` +
      `Question: ${currentQ.question}\n` +
      (currentQ.options?.length ? `Options: ${currentQ.options.join(', ')}\n` : '') +
      `Correct answer: ${currentQ.answer}\n` +
      (currentQ.explanation ? `Explanation: ${currentQ.explanation}\n` : '');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: system }, ...nextHistory],
        }),
      });
      const data = await res.json();
      const reply = data.response || data.message || data.content;
      if (!res.ok || !reply) throw new Error(data.error || 'No response.');
      setChatByCard((prev) => ({
        ...prev,
        [cardId]: [...nextHistory, { role: 'assistant', content: reply }],
      }));
    } catch {
      setChatByCard((prev) => ({
        ...prev,
        [cardId]: [
          ...nextHistory,
          { role: 'assistant', content: 'Sorry, I could not answer that right now. Try again.' },
        ],
      }));
      toast.error('Chat failed. Please try again.');
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, currentQ, chatLoading, chatByCard]);

  // ---------- Render ----------

  if (loading || generating) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="h-10 w-10 text-primary" />
          </motion.div>
          <p className="gradient-text-animated text-lg font-semibold">
            {generating ? 'Generating study cards…' : 'Loading cards…'}
          </p>
          <p className="text-sm text-muted-foreground">
            {generating
              ? 'The AI is crafting questions from this course. This can take a few seconds.'
              : 'Fetching your questions.'}
          </p>
        </div>
      </div>
    );
  }

  if (error || total === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm text-center">
          <Layers className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-lg font-semibold">No cards available</p>
          <p className="text-sm text-muted-foreground">
            {error || 'There are no questions for this course yet.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('course-detail')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {courseId && (
              <Button size="sm" onClick={loadQuestions}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isAnswered = !!answered[currentQ.id];
  const userAnswer = answers[currentQ.id] || '';
  const correct = isAnswered && checkAnswer(currentQ, userAnswer);
  const options =
    currentQ.type === 'true_false'
      ? currentQ.options && currentQ.options.length > 0
        ? currentQ.options
        : ['True', 'False']
      : currentQ.options || [];
  const isChoice = currentQ.type === 'multiple_choice' || currentQ.type === 'true_false';
  const cardChat = chatByCard[currentQ.id] || [];

  return (
    <div className="space-y-4 pt-2 lg:pt-4">
      {/* Header */}
      <div className="glass rounded-xl p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('course-detail')}
          aria-label="Back to course"
          className="hover:bg-primary/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary shrink-0" />
            <h1 className="text-lg font-bold gradient-text truncate">Card Study</h1>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {activeCourse?.title ?? 'Study session'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold">
            Card {currentIndex + 1} of {total}
          </p>
          <p className="text-xs text-muted-foreground">
            {scored.correct}/{scored.done} correct
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background:
              'linear-gradient(90deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89))',
          }}
          animate={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ.id}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.98 }}
          transition={spring}
          className="glass rounded-2xl p-5 lg:p-6 space-y-5 glow-emerald"
        >
          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                difficultyStyles[currentQ.difficulty] || difficultyStyles.medium
              }`}
            >
              {currentQ.difficulty}
            </span>
            {currentQ.concept && (
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <Target className="h-3 w-3" />
                {currentQ.concept}
              </span>
            )}
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground">
              {currentQ.type.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Question */}
          <h2 className="text-lg lg:text-xl font-semibold leading-snug">{currentQ.question}</h2>

          {/* Answer area */}
          {isChoice ? (
            <div className="grid gap-2.5">
              {options.map((opt, i) => {
                const selected = userAnswer === opt;
                const isRight = opt.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();
                const showState = isAnswered && (isRight || selected);
                return (
                  <motion.button
                    key={`${opt}-${i}`}
                    type="button"
                    disabled={isAnswered}
                    whileHover={!isAnswered ? { scale: 1.01, x: 2 } : undefined}
                    whileTap={!isAnswered ? { scale: 0.99 } : undefined}
                    onClick={() => submitAnswer(opt)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      showState
                        ? isRight
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        : selected
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/60 hover:border-primary/30 hover:bg-accent/40'
                    } ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {showState && isRight && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                    {showState && !isRight && selected && <XCircle className="h-4 w-4 shrink-0" />}
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={isAnswered ? userAnswer : inputValue}
                disabled={isAnswered}
                placeholder="Type your answer…"
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitAnswer(inputValue);
                }}
                className="flex-1"
              />
              {!isAnswered && (
                <Button onClick={() => submitAnswer(inputValue)} disabled={!inputValue.trim()}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Submit
                </Button>
              )}
            </div>
          )}

          {/* Reveal + explanation */}
          <AnimatePresence>
            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={`rounded-xl border p-4 space-y-2 ${
                    correct
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-rose-500/30 bg-rose-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {correct ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Correct
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                        <XCircle className="h-4 w-4" /> Correct answer: {currentQ.answer}
                      </span>
                    )}
                  </div>
                  {currentQ.explanation && (
                    <p className="text-sm text-muted-foreground flex gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>{currentQ.explanation}</span>
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={regenerating}>
                  {regenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Regenerate this card?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    The AI will replace this card with a fresh variation testing the same concept.
                    Your current answer on this card will be cleared.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRegenerate}>
                    Generate new version
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              variant={chatOpen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChatOpen((v) => !v)}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {chatOpen ? 'Hide chat' : 'Ask AI'}
            </Button>
          </div>

          {/* Per-card chat */}
          <AnimatePresence>
            {chatOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border/60 bg-background/40 p-3 flex flex-col min-h-0">
                  <div
                    ref={chatScrollRef}
                    className="max-h-56 overflow-y-auto min-h-0 space-y-2 pr-1"
                  >
                    {cardChat.length === 0 && !chatLoading && (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        Ask anything about this card — e.g. &ldquo;why is this the answer?&rdquo;
                      </p>
                    )}
                    {cardChat.map((m, i) => (
                      <div
                        key={i}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] ${
                            m.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'glass'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="glass rounded-2xl px-3 py-2 text-sm flex items-center gap-1.5 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2 mt-2 border-t border-border/40">
                    <Input
                      value={chatInput}
                      placeholder="Ask about this card…"
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendChat();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      onClick={sendChat}
                      disabled={chatLoading || !chatInput.trim()}
                      aria-label="Send"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Stepper navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <div className="flex items-center gap-1 flex-wrap justify-center max-w-[50%]">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              aria-label={`Go to card ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === currentIndex
                  ? 'w-5 bg-primary'
                  : answered[q.id]
                    ? 'w-1.5 bg-emerald-500/60'
                    : 'w-1.5 bg-muted'
              }`}
            />
          ))}
        </div>
        <Button size="sm" onClick={goNext} disabled={currentIndex === total - 1}>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

export default CardStudyView;
