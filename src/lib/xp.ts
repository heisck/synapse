import type { StudySession, AdaptiveResult } from '@/types';

/** XP → Level calculator (1-50). Each level requires progressively more XP. */
export function xpToLevel(totalXP: number): number {
  let accumulated = 0;
  for (let level = 1; level <= 50; level++) {
    accumulated += Math.round(100 * Math.pow(1.18, level - 1));
    if (totalXP < accumulated) return level;
  }
  return 50;
}

export interface UserStats {
  totalXP: number;
  weeklyXP: number;
  level: number;
  quizAccuracy: number;
}

/**
 * Single source of truth for XP math, derived entirely from the user's own
 * locally-stored activity. 10 XP per study minute, up to 500 XP from quiz
 * accuracy, 50 XP per completed daily challenge.
 */
export function computeUserStats(input: {
  studySessions: StudySession[];
  adaptiveResults: AdaptiveResult[];
  dailyChallengeCompleted: number;
}): UserStats {
  const { studySessions, adaptiveResults, dailyChallengeCompleted } = input;

  const sessionXP = studySessions.reduce((sum, s) => sum + s.duration * 10, 0);
  const totalAdaptive = adaptiveResults.length;
  const correctAdaptive = adaptiveResults.filter((r) => r.correct).length;
  const quizAccuracy = totalAdaptive > 0 ? Math.round((correctAdaptive / totalAdaptive) * 100) : 0;
  const quizXP = Math.round(quizAccuracy * 5);
  const challengeXP = (dailyChallengeCompleted || 0) * 50;
  const totalXP = sessionXP + quizXP + challengeXP;

  const weekAgo = Date.now() - 7 * 86400000;
  const weeklyXP = studySessions
    .filter((s) => new Date(s.date).getTime() >= weekAgo)
    .reduce((sum, s) => sum + s.duration * 10, 0);

  return { totalXP, weeklyXP, level: xpToLevel(totalXP), quizAccuracy };
}

/** Reads the current study streak persisted by addStudySession. */
export function getStudyStreakFromStorage(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem('synapse-study-streak');
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { lastStudyDate: string; streak: number };
    const last = new Date(parsed.lastStudyDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - last.getTime()) / 86400000);
    return diffDays <= 1 ? parsed.streak : 0;
  } catch {
    return 0;
  }
}
