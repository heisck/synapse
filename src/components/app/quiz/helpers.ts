/**
 * Pure logic for the quiz experience: grading, timers, daily challenge
 * storage, adaptive-difficulty scoring. No JSX — extracted from QuizView.tsx
 * so the main component file stays reviewable and fast to compile.
 */
import { BookOpen } from 'lucide-react';
import type { Question, AdaptiveResult } from '@/types';

export type StudyMode = 'quiz' | 'flashcard' | 'daily' | 'review';

// ---------- Levenshtein distance (standard DP) ----------
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0) as number[]);
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[n][m];
}

export function isFuzzyMatch(userAnswer: string, correctAnswer: string, maxDistance: number = 2): boolean {
  const ua = userAnswer.trim().toLowerCase();
  const ca = correctAnswer.trim().toLowerCase();
  if (ua === ca) return true;
  if (ua.includes(ca) || ca.includes(ua)) return true;
  // Levenshtein distance for typo tolerance
  const dist = levenshtein(ua, ca);
  // Allow 1 typo for short answers, 2 for longer ones
  const threshold = maxDistance || (ca.length <= 4 ? 1 : 2);
  if (dist <= threshold) return true;
  // Word-level check: all words of correct answer present in user answer (in any order)
  const correctWords = ca.split(/\s+/);
  const userWords = ua.split(/\s+/);
  if (correctWords.every((w) => userWords.some((uw) => uw.includes(w) || w.includes(uw)))) return true;
  return false;
}

// ---------- Fill-in-blank grading with Levenshtein tolerance ----------
// Case-insensitive, trimmed comparison with partial credit for typos:
//   Exact match → 100% (or 75% if hint used)
//   Levenshtein ≤ 2 → 80% (× 0.75 if hint)
//   Levenshtein ≤ 3 → 50% (× 0.75 if hint)
//   Otherwise → 0
export type FillBlankGrade = { status: 'correct' | 'close' | 'wrong'; points: number; message: string };

export function gradeFillBlank(userAnswer: string, correctAnswer: string, hintUsed: boolean = false): FillBlankGrade {
  const ua = userAnswer.trim().toLowerCase();
  const ca = correctAnswer.trim().toLowerCase();
  if (ua === ca) {
    return { status: 'correct', points: hintUsed ? 0.75 : 1, message: '' };
  }
  const dist = levenshtein(ua, ca);
  let basePoints = 0;
  if (dist <= 2) basePoints = 0.8;
  else if (dist <= 3) basePoints = 0.5;
  if (basePoints > 0) {
    return { status: 'close', points: basePoints * (hintUsed ? 0.75 : 1), message: `Close! Did you mean: "${correctAnswer}"?` };
  }
  return { status: 'wrong', points: 0, message: '' };
}

// ---------- Timer helper ----------
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ---------- Course filter ----------
export interface DailyChallengeData {
  date: string;
  completed: boolean;
  score: number;
  total: number;
  questions: string[];
}

export const DAILY_STORAGE_KEY = 'synapse-daily-challenge';
export const DAILY_STREAK_KEY = 'synapse-daily-streak';
export const DAILY_QUESTION_COUNT = 5;

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function loadDailyChallenge(): DailyChallengeData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDailyChallenge(data: DailyChallengeData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable
  }
}

export function loadDailyStreak(): { current: number; best: number; lastDate: string } {
  if (typeof window === 'undefined') return { current: 0, best: 0, lastDate: '' };
  try {
    const raw = localStorage.getItem(DAILY_STREAK_KEY);
    return raw ? JSON.parse(raw) : { current: 0, best: 0, lastDate: '' };
  } catch {
    return { current: 0, best: 0, lastDate: '' };
  }
}

export function saveDailyStreak(data: { current: number; best: number; lastDate: string }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable
  }
}

export function updateDailyStreak(): { current: number; best: number; lastDate: string } {
  const streak = loadDailyStreak();
  const today = getTodayStr();

  if (streak.lastDate === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newCurrent: number;
  if (streak.lastDate === yesterdayStr) {
    newCurrent = streak.current + 1;
  } else {
    newCurrent = 1;
  }

  const newBest = Math.max(streak.best, newCurrent);
  const updated = { current: newCurrent, best: newBest, lastDate: today };
  saveDailyStreak(updated);
  return updated;
}

export function getTimeUntilMidnight(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export function selectDailyQuestions(allQs: Question[]): Question[] {
  const seed = new Date().toISOString().split('T')[0];
  const hash = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  // Seeded pseudo-random shuffle
  const indexed = allQs.map((q, i) => ({ q, sortKey: ((hash * (i + 1) * 2654435761) >>> 0) % 100000 }));
  indexed.sort((a, b) => a.sortKey - b.sortKey);
  return indexed.slice(0, DAILY_QUESTION_COUNT).map((x) => x.q);
}

export const COURSE_QUIZ_GROUPS = [
  { id: 'all', label: 'All Questions', icon: BookOpen },
  { id: 'demo-course', label: 'Cell Biology', icon: BookOpen },
  { id: 'cs-course', label: 'Computer Science', icon: BookOpen },
];

// ---------- Adaptive Difficulty Helpers ----------
export const ADAPTIVE_STORAGE_KEY = 'synapse-adaptive-results';

export function loadAdaptiveResults(): AdaptiveResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ADAPTIVE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAdaptiveResults(results: AdaptiveResult[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify(results));
  } catch {
    // storage unavailable
  }
}

export interface AdaptiveScoringInput {
  question: Question;
  masteryMap: Record<string, { level: number; evidence: string[]; lastAssessed: number; attempts: number }>;
  adaptiveResults: AdaptiveResult[];
  dueConcepts: Set<string>;
}

export interface ScoredQuestion {
  question: Question;
  score: number;
  reasons: string[];
}

export function scoreQuestionForAdaptive(input: AdaptiveScoringInput): ScoredQuestion {
  const { question, masteryMap, adaptiveResults, dueConcepts } = input;
  let score = 0;
  const reasons: string[] = [];
  const concept = question.concept || 'Unknown';
  const mastery = masteryMap[concept];

  // 1. Low mastery bonus (level 1-2)
  if (mastery && mastery.level < 3) {
    score += 3;
    reasons.push('low mastery');
  }

  // 2. Spaced repetition due for review
  if (dueConcepts.has(concept)) {
    score += 2;
    reasons.push('needs review');
  }

  // 3. Recent performance: last 5 results on concept
  const conceptResults = adaptiveResults
    .filter((r) => r.concept === concept)
    .slice(-5);
  const last3 = conceptResults.slice(-3);
  const wrongCount = last3.filter((r) => !r.correct).length;
  const correctCount = conceptResults.filter((r) => r.correct).length;

  if (wrongCount >= 2) {
    score += 2;
    reasons.push('recent struggles');
  }

  // 4. Difficulty match bonus
  const targetLevel = mastery ? Math.min(mastery.level + 1, 3) : 1;
  const targetDifficulty = targetLevel === 1 ? 'easy' : targetLevel === 2 ? 'medium' : 'hard';
  if (question.difficulty === targetDifficulty) {
    score += 1;
  } else if (
    (targetDifficulty === 'medium' && question.difficulty === 'easy') ||
    (targetDifficulty === 'hard' && question.difficulty === 'medium')
  ) {
    score += 0.5;
  }

  // 5. Boost for concepts with many wrong answers (weaker areas)
  if (correctCount >= 3) {
    score += 1;
    reasons.push('ready for harder questions');
  }

  return { question, score, reasons };
}

export function getAdaptiveReasoning(scored: ScoredQuestion[]): string {
  if (scored.length === 0) return '';

  const conceptReasons = new Map<string, string[]>();
  for (const sq of scored.slice(0, 5)) {
    const concept = sq.question.concept || 'Unknown';
    const existing = conceptReasons.get(concept) || [];
    conceptReasons.set(concept, [...existing, ...sq.reasons]);
  }

  const parts: string[] = [];
  for (const [concept, reasons] of conceptReasons) {
    const uniqueReasons = [...new Set(reasons)];
    const desc = uniqueReasons.map((r) => {
      switch (r) {
        case 'low mastery': return 'low mastery';
        case 'needs review': return 'needs review';
        case 'recent struggles': return 'struggling recently';
        case 'ready for harder questions': return 'ready for challenge';
        default: return r;
      }
    }).join(', ');
    parts.push(`${concept} (${desc})`);
  }

  return 'Focusing on: ' + parts.join(', ');
}

