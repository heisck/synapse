'use client';

/**
 * Background-generation STATUS hook (UNIFIED-PLAN task 41 rework).
 *
 * Generation itself moved to the global singleton (`lib/backgroundGenService`)
 * which starts on app entry and survives page navigation — this hook no longer
 * runs its own request loop (two loops would double-spend the learner's key).
 * It is now a live view of the bank for quiz-page UI: cached count, progress,
 * and the on/off toggle the service obeys.
 */
import { useEffect, useState } from 'react';
import {
  isBackgroundGenerationEnabled,
  loadQuestionCache,
  setBackgroundGenerationEnabled,
} from '@/lib/questionCache';
import { ensureRunning } from '@/lib/backgroundGenService';
import { useAppStore } from '@/stores/appStore';

export interface BackgroundGenState {
  enabled: boolean;
  running: boolean;
  paused: boolean;
  sectionsDone: number;
  sectionsTotal: number | null;
  cachedCount: number;
  error: string | null;
}

const POLL_MS = 4_000;

export function useBackgroundGeneration(courseId: string | null, options?: { force?: boolean }) {
  const force = options?.force ?? false;
  const chatRequestStatus = useAppStore((s) => s.chatRequestStatus);
  const [enabledToggle, setEnabledState] = useState(false);
  const enabled = force || enabledToggle;
  const [state, setState] = useState<Omit<BackgroundGenState, 'enabled' | 'paused'>>({
    running: false,
    sectionsDone: 0,
    sectionsTotal: null,
    cachedCount: 0,
    error: null,
  });

  // Live view of the bank: poll the cache while mounted so the count grows on
  // screen as the global service works.
  useEffect(() => {
    let cancelled = false;
    const read = () => {
      if (cancelled) return;
      setEnabledState(isBackgroundGenerationEnabled());
      if (courseId) {
        const cache = loadQuestionCache(courseId);
        setState((s) => ({
          ...s,
          running: isBackgroundGenerationEnabled(),
          sectionsDone: cache?.sectionsDone ?? 0,
          sectionsTotal: cache?.sectionsTotal ?? null,
          cachedCount: cache?.questions.length ?? 0,
        }));
      }
    };
    queueMicrotask(read);
    const interval = setInterval(read, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [courseId]);

  // Forcing (exam mode) guarantees the service is alive and enabled
  useEffect(() => {
    if (force) {
      setBackgroundGenerationEnabled(true);
      ensureRunning();
    }
  }, [force]);

  const paused = chatRequestStatus === 'sending' || chatRequestStatus === 'streaming';

  const setEnabled = (value: boolean) => {
    setBackgroundGenerationEnabled(value);
    setEnabledState(value);
    if (value) ensureRunning();
  };

  return {
    ...state,
    enabled,
    paused,
    setEnabled,
  };
}
