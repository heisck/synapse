import type { Question } from '@/types';

/** Levenshtein edit distance (mirrors the implementation used in QuizView). */
export function levenshtein(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[n][m];
}

/** Fuzzy string match with typo tolerance and word-level fallback (from QuizView). */
export function isFuzzyMatch(userAnswer: string, correctAnswer: string, maxDistance = 2): boolean {
  const ua = userAnswer.trim().toLowerCase();
  const ca = correctAnswer.trim().toLowerCase();
  if (!ua) return false;
  if (ua === ca) return true;
  if (ua.includes(ca) || ca.includes(ua)) return true;
  const dist = levenshtein(ua, ca);
  const threshold = maxDistance || (ca.length <= 4 ? 1 : 2);
  if (dist <= threshold) return true;
  const correctWords = ca.split(/\s+/);
  const userWords = ua.split(/\s+/);
  if (correctWords.every((w) => userWords.some((uw) => uw.includes(w) || w.includes(uw)))) return true;
  return false;
}

/** Answer correctness check matching QuizView's `isCorrect` semantics per question type. */
export function checkAnswer(q: Question, userAnswer: string): boolean {
  const ua = userAnswer.trim().toLowerCase();
  const ca = q.answer.trim().toLowerCase();
  if (!ua) return false;
  if (q.type === 'short_answer' || q.type === 'error_correction') {
    return isFuzzyMatch(userAnswer, q.answer, 3);
  }
  if (q.type === 'fill_blank') {
    return ua === ca;
  }
  return ua === ca;
}
