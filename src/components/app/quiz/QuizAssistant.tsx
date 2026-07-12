'use client';

/**
 * Floating AI assistant for quiz practice — a Brain bubble bottom-right that
 * opens a mini chat sheet. Conversation lives in component state so context
 * carries across questions within the quiz session.
 */
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/stores/appStore';
import { aiFetch } from '@/lib/aiKey';
import { cleanResponse } from '@/lib/textQuality';
import type { Question } from '@/types';

interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function QuizAssistant({ currentQuestion }: { currentQuestion?: Question }) {
  const activeCourse = useAppStore((s) => s.activeCourse);
  const activeSlides = useAppStore((s) => s.activeSlides);
  const currentSlideIndex = useAppStore((s) => s.currentSlideIndex);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    // Mid-quiz struggle (task 78): saying they don't get it — or re-asking
    // the same thing — flips the tutor into remediation instead of a repeat.
    const struggling =
      /\b(don'?t (get|understand)|confused|makes no sense|still lost|no idea)\b/i.test(text) ||
      messages.some((m) => m.role === 'user' && m.content.toLowerCase() === text.toLowerCase());
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    try {
      const res = await aiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          stream: false,
          history,
          orchestratorDecision: struggling ? 'remediate' : undefined,
          topic: activeCourse?.title,
          slideContext: {
            courseTitle: activeCourse?.title ?? '',
            index: currentSlideIndex + 1,
            total: activeSlides.length,
            content: currentQuestion
              ? `Quiz question: ${currentQuestion.question}\nOptions: ${currentQuestion.options?.join(', ') ?? ''}`
              : '',
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.response) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'No response');
      }
      const cleaned = cleanResponse(String(data.response));
      const reply = cleaned.discard || !cleaned.text.trim()
        ? "I couldn't put together a good answer there — could you rephrase your question?"
        : cleaned.text;
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong reaching the AI — please try again.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(true)}
        aria-label="Ask the AI assistant"
        className="fixed bottom-6 right-6 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-shadow"
      >
        <Brain className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm"
            />
            {/* Slide-up sheet — right-aligned card on desktop */}
            <motion.div
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md sm:inset-x-auto sm:right-6 sm:bottom-6 sm:mx-0"
              role="dialog"
              aria-label="Quiz assistant chat"
            >
              <div className="glass flex flex-col rounded-t-2xl sm:rounded-2xl border border-border/60 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50 bg-linear-to-r from-emerald-500/10 to-teal-500/10">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
                      <Brain className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">Quiz Assistant</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Ask about the current question or concept
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close assistant"
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Messages */}
                <div ref={scrollRef} className="h-72 overflow-y-auto px-4 py-3 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Stuck on a question? Ask for a hint, a simpler explanation, or why an answer is
                      right — without leaving the quiz.
                    </p>
                  )}
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                          m.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted/60 border border-border/50 rounded-bl-sm'
                        }`}
                      >
                        {m.content}
                      </div>
                    </motion.div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted/60 border border-border/50 px-3.5 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex items-center gap-2 border-t border-border/50 p-3">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Ask anything about this quiz..."
                    className="h-9 text-sm"
                    disabled={sending}
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleSend()}
                    disabled={sending || !input.trim()}
                    className="h-9 px-3 glow-emerald"
                    aria-label="Send message"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
