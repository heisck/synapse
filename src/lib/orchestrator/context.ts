'use client';

/**
 * Orchestrator app snapshot (UNIFIED-PLAN task 78, CR22).
 *
 * The orchestrator must always know the real application state — current
 * course, teaching unit, tutor session, quiz session, learner mistakes,
 * navigation and background-generation state. This module assembles that
 * snapshot DETERMINISTICALLY from the stores: plain code reading plain state,
 * no model involvement — the AI only ever *receives* it, so a hallucinating
 * model can mis-describe the app to itself but never mutate what the app
 * knows to be true (rule R2's spirit applied to runtime state).
 *
 * Snapshot stays client-side (R1): it rides along on /api/orchestrate calls
 * and is never persisted server-side.
 */

import { useAppStore } from '@/stores/appStore';
import { loadQuestionCache, isBackgroundGenerationEnabled } from '@/lib/questionCache';

export interface AppSnapshot {
  view: string;
  course?: { id: string; title: string };
  slide?: { index: number; total: number; title?: string };
  tutorSessionId?: string;
  /** Live tutor-initiated quiz session, if one is underway (task 57). */
  tutorQuiz?: { slideIndex: number; finished: boolean; correct?: number; total?: number };
  /** Last completed quiz result (feeds remediate decisions). */
  lastQuiz?: { correct: number; total: number };
  /** Question bank health for the active course. */
  bank?: { count: number; backgroundEnabled: boolean };
  /** Recent missed concepts — deterministic, from recorded answers. */
  recentMistakes?: string[];
}

export function buildAppSnapshot(): AppSnapshot {
  const s = useAppStore.getState();
  const snapshot: AppSnapshot = { view: s.currentView };

  if (s.activeCourse) {
    snapshot.course = { id: s.activeCourse.id, title: s.activeCourse.title };
    const cache = loadQuestionCache(s.activeCourse.id);
    snapshot.bank = {
      count: cache?.questions.length ?? 0,
      backgroundEnabled: isBackgroundGenerationEnabled(),
    };
  }
  if (s.activeSlides.length > 0) {
    snapshot.slide = {
      index: s.currentSlideIndex + 1,
      total: s.activeSlides.length,
      title: s.activeSlides[s.currentSlideIndex]?.title,
    };
  }
  if (s.activeSessionId) snapshot.tutorSessionId = s.activeSessionId;
  if (s.tutorQuizContext) {
    snapshot.tutorQuiz = {
      slideIndex: s.tutorQuizContext.slideIndex,
      finished: !!s.tutorQuizContext.result,
      correct: s.tutorQuizContext.result?.correct,
      total: s.tutorQuizContext.result?.total,
    };
  }
  if (s.quizScore !== null && s.quizTotal !== null) {
    snapshot.lastQuiz = { correct: s.quizScore, total: s.quizTotal };
  }
  // Most recent missed concepts, newest first, deduped, capped at 5
  const missed: string[] = [];
  for (let i = s.adaptiveResults.length - 1; i >= 0 && missed.length < 5; i--) {
    const r = s.adaptiveResults[i];
    if (!r.correct && r.concept && !missed.includes(r.concept)) missed.push(r.concept);
  }
  if (missed.length > 0) snapshot.recentMistakes = missed;

  return snapshot;
}

/** Compact single-line rendering for prompt injection (server does the framing). */
export function snapshotSummary(app: AppSnapshot): string {
  const bits: string[] = [`view=${app.view}`];
  if (app.course) bits.push(`course="${app.course.title}"`);
  if (app.slide) bits.push(`slide=${app.slide.index}/${app.slide.total}`);
  if (app.tutorSessionId) bits.push('tutor-session=active');
  if (app.tutorQuiz) bits.push(`tutor-quiz=${app.tutorQuiz.finished ? `finished ${app.tutorQuiz.correct}/${app.tutorQuiz.total}` : 'in-progress'}`);
  if (app.lastQuiz) bits.push(`last-quiz=${app.lastQuiz.correct}/${app.lastQuiz.total}`);
  if (app.bank) bits.push(`bank=${app.bank.count}q${app.bank.backgroundEnabled ? ' (bg on)' : ' (bg off)'}`);
  if (app.recentMistakes?.length) bits.push(`missed=[${app.recentMistakes.join('; ')}]`);
  return bits.join(', ');
}
