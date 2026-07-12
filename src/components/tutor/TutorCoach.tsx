'use client';

/**
 * Code-driven tutoring coach (no AI): the slide-advance suggestion card and
 * the break timer. Both are plain checks — this is the seam where the Hermes
 * orchestrator plugs in later; until then, simple rules run the show.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Coffee, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTimer } from '@/components/app/quiz/helpers';

// ---------- Slide advance suggestion ----------

interface SlideAdvanceSuggestionProps {
  slideIndex: number;
  total: number;
  onAccept: () => void;
  onDecline: () => void;
}

/** Interactive card (like the quiz cards): "ready to move on?" */
export function SlideAdvanceSuggestion({ slideIndex, total, onAccept, onDecline }: SlideAdvanceSuggestionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      className="mx-4 mb-2 rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center gap-3"
    >
      <p className="text-sm flex-1 min-w-40">
        You&apos;ve worked through this slide — ready to move to slide {slideIndex + 2} of {total}?
      </p>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={onAccept}>
          Yes, next slide
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDecline}>
          Not yet
        </Button>
      </div>
    </motion.div>
  );
}

// ---------- Break timer ----------

const BREAK_UNTIL_KEY = 'synapse-break-until';
const CONNECTED_SINCE_KEY = 'synapse-connected-since';
const BREAK_SNOOZE_KEY = 'synapse-break-snoozed-at';
/** Suggest a break after this much continuous connected time. */
const SUGGEST_AFTER_MS = 45 * 60 * 1000;
const SNOOZE_MS = 20 * 60 * 1000;
export const BREAK_MINUTES = 15;

function readTs(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeTs(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

/**
 * Break state machine. The break end is an ABSOLUTE timestamp in
 * localStorage, so the countdown keeps running even if the app is closed —
 * reopening mid-break shows the remaining time.
 */
export function useBreakTimer() {
  const [now, setNow] = useState(() => Date.now());

  // Connected-since: set on first mount of a browsing session
  useEffect(() => {
    if (!readTs(CONNECTED_SINCE_KEY)) writeTs(CONNECTED_SINCE_KEY, Date.now());
  }, []);

  // 1s tick — drives both the countdown and the suggestion check
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const breakUntil = readTs(BREAK_UNTIL_KEY);
  const onBreak = breakUntil > now;
  const breakSecondsLeft = onBreak ? Math.ceil((breakUntil - now) / 1000) : 0;

  // Derived on every 1s tick — no state needed: accepting sets the break
  // timestamp, declining sets the snooze timestamp, both hide the card.
  const connectedSince = readTs(CONNECTED_SINCE_KEY);
  const snoozedAt = readTs(BREAK_SNOOZE_KEY);
  const suggested =
    !onBreak &&
    connectedSince > 0 &&
    now - connectedSince >= SUGGEST_AFTER_MS &&
    now - snoozedAt >= SNOOZE_MS;

  const acceptBreak = () => {
    writeTs(BREAK_UNTIL_KEY, Date.now() + BREAK_MINUTES * 60 * 1000);
    setNow(Date.now());
  };
  const declineBreak = () => {
    writeTs(BREAK_SNOOZE_KEY, Date.now());
    setNow(Date.now());
  };
  const endBreakEarly = () => {
    writeTs(BREAK_UNTIL_KEY, 0);
    // A fresh stretch starts after the break
    writeTs(CONNECTED_SINCE_KEY, Date.now());
    writeTs(BREAK_SNOOZE_KEY, 0);
    setNow(Date.now());
  };

  // When a break finishes naturally, reset the connected clock
  useEffect(() => {
    if (!onBreak && breakUntil > 0 && breakUntil <= now) {
      writeTs(BREAK_UNTIL_KEY, 0);
      writeTs(CONNECTED_SINCE_KEY, Date.now());
      writeTs(BREAK_SNOOZE_KEY, 0);
    }
  }, [onBreak, breakUntil, now]);

  return { onBreak, breakSecondsLeft, suggested, acceptBreak, declineBreak, endBreakEarly };
}

export function BreakSuggestionCard({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="mx-4 mb-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex flex-wrap items-center gap-3"
    >
      <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-sm flex-1 min-w-40">
        You&apos;ve been studying a good while — take a {BREAK_MINUTES}-minute break? The timer
        keeps counting even if you close the app.
      </p>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={onAccept} className="bg-amber-600 hover:bg-amber-500 text-white">
          Take the break
        </Button>
        <Button size="sm" variant="ghost" onClick={onDecline}>
          Keep going
        </Button>
      </div>
    </motion.div>
  );
}

export function BreakOverlay({ secondsLeft, onEndEarly }: { secondsLeft: number; onEndEarly: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col items-center justify-center gap-6 p-6">
      <Coffee className="h-12 w-12 text-amber-500" />
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">Break time</h2>
        <p className="text-sm text-muted-foreground">Step away — your tutor waits right here.</p>
      </div>
      <p className="text-5xl font-bold font-mono tabular-nums">{formatTimer(secondsLeft)}</p>
      <Button variant="outline" onClick={onEndEarly}>
        <X className="h-4 w-4 mr-1.5" />
        End break early
      </Button>
    </div>
  );
}

// ---------- Slide reference detection ----------

// Pure intent detection lives in lib/questionIntent (unit-tested); re-exported
// here so existing imports keep working.
export { parseQuestionIntent, detectRepeatedQuestion, type QuestionIntent } from '@/lib/questionIntent';

/** Detects "slide 4" / "slide #12" mentions in a message. Returns 0-based index or null. */
export function detectSlideReference(message: string, totalSlides: number, currentIndex: number): number | null {
  const match = message.match(/\bslide\s*#?\s*(\d{1,3})\b/i);
  if (!match) return null;
  const oneBased = parseInt(match[1], 10);
  if (oneBased < 1 || oneBased > totalSlides) return null;
  const idx = oneBased - 1;
  return idx === currentIndex ? null : idx;
}
