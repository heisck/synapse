'use client';

/**
 * Background question generation (docs/ROADMAP.md — user-toggleable).
 * While enabled and a course is selected, walks the course's content
 * section-by-section (one section per request), storing validated questions
 * in the browser cache so quiz/exam starts are instant later.
 *
 * Pauses automatically while the tutor is teaching (currentView === 'tutor')
 * and resumes when the learner leaves the tutor — exactly the "pause and
 * teach, then return" behavior requested.
 */
import { useEffect, useRef, useState } from 'react';
import { aiFetch } from '@/lib/aiKey';
import {
  appendToQuestionCache,
  getPreferredTypes,
  isBackgroundGenerationEnabled,
  loadQuestionCache,
  setBackgroundGenerationEnabled,
} from '@/lib/questionCache';
import { useAppStore } from '@/stores/appStore';
import { getLocalCourseContent, isLocalCourse } from '@/lib/localLibrary';
import type { Question } from '@/types';

export interface BackgroundGenState {
  enabled: boolean;
  running: boolean;
  paused: boolean;
  sectionsDone: number;
  sectionsTotal: number | null;
  cachedCount: number;
  error: string | null;
}

export function useBackgroundGeneration(courseId: string | null, options?: { force?: boolean }) {
  const force = options?.force ?? false;
  const currentView = useAppStore((s) => s.currentView);
  const [enabledToggle, setEnabledState] = useState(false);
  const enabled = force || enabledToggle;
  const [state, setState] = useState<Omit<BackgroundGenState, 'enabled' | 'paused'>>({
    running: false,
    sectionsDone: 0,
    sectionsTotal: null,
    cachedCount: 0,
    error: null,
  });
  const abortRef = useRef(false);
  const loopActive = useRef(false);

  // Hydrate toggle + cache state on mount / course change (async so React's
  // effect-setState lint stays satisfied — this is a one-shot read, not a loop)
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setEnabledState(isBackgroundGenerationEnabled());
      if (courseId) {
        const cache = loadQuestionCache(courseId);
        setState((s) => ({
          ...s,
          sectionsDone: cache?.sectionsDone ?? 0,
          sectionsTotal: cache?.sectionsTotal ?? null,
          cachedCount: cache?.questions.length ?? 0,
          error: null,
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const paused = currentView === 'tutor';

  useEffect(() => {
    if (!enabled || !courseId || paused || loopActive.current) return;
    const cache = loadQuestionCache(courseId);
    // Re-runnable: after a full pass, toggling Auto-gen on again walks the
    // sections once more, ADDING new questions (dedup by text) — until the
    // per-course cap. The learner's key, the learner's call.
    const QUESTION_CAP = 500;
    if ((cache?.questions.length ?? 0) >= QUESTION_CAP) return;

    abortRef.current = false;
    loopActive.current = true;

    (async () => {
      try {
        setState((s) => ({ ...s, running: true, error: null }));
        const startCache = loadQuestionCache(courseId);
        // Completed a full pass before? Start another from the top to ADD more
        let offset =
          startCache?.sectionsTotal != null && (startCache?.sectionsDone ?? 0) >= startCache.sectionsTotal
            ? 0
            : startCache?.sectionsDone ?? 0;
        for (;;) {
          if (abortRef.current) break;
          const res = await aiFetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId,
              sectionOffset: offset,
              maxSections: 1,
              types: getPreferredTypes(),
              // Local-first courses aren't in the shared DB — send content
              content: isLocalCourse(courseId) ? await getLocalCourseContent(courseId) : undefined,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Generation failed' }));
            setState((s) => ({ ...s, error: err.error || 'Generation failed' }));
            break;
          }
          const data = (await res.json()) as {
            questions: Question[];
            sectionsTotal: number;
            sectionsDone: number;
            hasMore: boolean;
          };
          const cacheNow = appendToQuestionCache(
            courseId,
            // Bank provenance (A8): these entered via the background worker
            (data.questions ?? []).map((q) => ({ ...q, provenance: q.provenance ?? 'background' as const })),
            data.sectionsDone,
            data.sectionsTotal,
          );
          offset = data.sectionsDone;
          setState((s) => ({
            ...s,
            sectionsDone: cacheNow.sectionsDone,
            sectionsTotal: cacheNow.sectionsTotal,
            cachedCount: cacheNow.questions.length,
          }));
          if (cacheNow.questions.length >= 500 || !data.hasMore) break;
        }
      } finally {
        loopActive.current = false;
        setState((s) => ({ ...s, running: false }));
      }
    })();

    return () => {
      abortRef.current = true;
    };
  }, [enabled, courseId, paused]);

  const setEnabled = (value: boolean) => {
    setBackgroundGenerationEnabled(value);
    setEnabledState(value);
    if (!value) abortRef.current = true;
  };

  return {
    ...state,
    enabled,
    paused,
    setEnabled,
  };
}
