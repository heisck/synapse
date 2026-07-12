/**
 * Shared quiz-launch service (UNIFIED-PLAN task 19, req D35/D36).
 *
 * Every quiz entry point — dashboard Quick Quiz, course "Take Quiz",
 * exam mode, AI-initiated (A4) — funnels through launchQuiz(), so behavior is
 * structurally consistent: bank first (retrieve-before-generate, A7), then
 * stored questions, then a fresh generation pass; and when there is genuinely
 * no material, one clear explanation instead of a stuck buffer.
 */

import { useAppStore } from '@/stores/appStore';
import { aiFetch } from '@/lib/aiKey';
import { getSlideBank } from '@/lib/questionCache';
import { isLocalCourse, getLocalSlides } from '@/lib/localLibrary';
import type { Question } from '@/types';

export interface QuizLaunchResult {
  ok: boolean;
  /** Human-readable explanation when ok=false (D36) — show it, don't spin. */
  reason?: string;
  source?: 'bank' | 'stored' | 'generated';
  count?: number;
}

export interface QuizLaunchOptions {
  courseId?: string;
  /** Restrict to one slide's bank (tutor "quiz me on this slide"). */
  slideId?: string;
  /** Requested number of questions (A5) — no hard cap; bank serves what it has. */
  count?: number;
  /** Question formats to include. */
  types?: string[];
}

async function courseContent(courseId: string): Promise<string | undefined> {
  if (!isLocalCourse(courseId)) return undefined;
  const slides = await getLocalSlides(courseId);
  if (!slides || slides.length === 0) return undefined;
  return slides.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');
}

/**
 * Launches the quiz view for a course. Resolution order:
 *  1. unused questions from the client-side bank (instant, no request)
 *  2. previously stored questions on the server (legacy courses)
 *  3. one generation pass
 * Navigates only when there is something to show; otherwise returns a reason.
 */
export async function launchQuiz(options: QuizLaunchOptions = {}): Promise<QuizLaunchResult> {
  const store = useAppStore.getState();
  const courseId = options.courseId ?? store.activeCourse?.id;

  if (!courseId) {
    const anyCourse = store.courses[0];
    if (!anyCourse) {
      return {
        ok: false,
        reason: 'No study material yet — upload slides first, then quizzes are generated from them.',
      };
    }
    return launchQuiz({ ...options, courseId: anyCourse.id });
  }

  if (store.activeCourse?.id !== courseId) {
    const course = store.courses.find((c) => c.id === courseId);
    if (course) store.setActiveCourse(course);
  }

  const wanted = options.count && options.count > 0 ? options.count : undefined;
  const typeFilter = (qs: Question[]) =>
    options.types && options.types.length > 0 ? qs.filter((q) => options.types!.includes(q.type)) : qs;

  // 1. Bank first (A7): unused questions, then used ones for repeat practice
  const bank = getSlideBank(courseId, options.slideId);
  const fromBank = typeFilter([...bank.unused, ...bank.used]);
  if (fromBank.length >= Math.min(wanted ?? 5, 5)) {
    store.setCurrentQuestions(wanted ? fromBank.slice(0, wanted) : fromBank);
    store.navigate('quiz');
    return { ok: true, source: 'bank', count: Math.min(fromBank.length, wanted ?? fromBank.length) };
  }

  // 2. Stored server questions (legacy, non-local courses)
  if (!isLocalCourse(courseId)) {
    try {
      const res = await fetch(`/api/questions?courseId=${courseId}`);
      if (res.ok) {
        const data = await res.json();
        const stored = typeFilter((data.questions ?? []) as Question[]);
        if (stored.length > 0) {
          store.setCurrentQuestions(wanted ? stored.slice(0, wanted) : stored);
          store.navigate('quiz');
          return { ok: true, source: 'stored', count: stored.length };
        }
      }
    } catch {
      // fall through to generation
    }
  }

  // 3. Generate now
  const content = await courseContent(courseId);
  if (isLocalCourse(courseId) && !content) {
    return {
      ok: false,
      reason: 'This course has no readable slide content to generate questions from. Try re-uploading the material.',
    };
  }
  try {
    const res = await aiFetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId,
        slideId: options.slideId,
        content,
        types: options.types,
        count: wanted,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, reason: err.error || 'Question generation failed. Please try again.' };
    }
    const data = await res.json();
    const generated = (data.questions ?? []) as Question[];
    if (generated.length === 0) {
      return { ok: false, reason: 'The material did not yield any valid questions — try a different course or slide.' };
    }
    const tagged = generated.map((q) => ({ ...q, provenance: q.provenance ?? ('ondemand' as const) }));
    store.setCurrentQuestions(wanted ? tagged.slice(0, wanted) : tagged);
    store.navigate('quiz');
    return { ok: true, source: 'generated', count: tagged.length };
  } catch {
    return { ok: false, reason: 'Could not reach the question generator. Check your connection and API key in Settings.' };
  }
}
