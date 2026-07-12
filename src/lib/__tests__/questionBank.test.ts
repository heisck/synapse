import { describe, it, expect, beforeEach } from 'vitest';
import { parseQuestionIntent, detectRepeatedQuestion } from '@/lib/questionIntent';

// questionCache runs against localStorage — give node a tiny in-memory shim
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  get length() { return this.map.size; }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });

// Import AFTER the shims so the module sees them
const { appendToQuestionCache, getSlideBank, markQuestionAnswered, loadAnsweredIds, isBackgroundGenerationEnabled } =
  await import('@/lib/questionCache');

const q = (id: string, slideId?: string) => ({
  id,
  slideId,
  courseId: 'local-c1',
  type: 'multiple_choice' as const,
  question: `Question body long enough to be valid ${id}?`,
  options: ['A1', 'B2', 'C3', 'D4'],
  answer: 'A1',
  explanation: 'because',
  difficulty: 'medium' as const,
});

describe('question bank (tasks 18/43, A7/A8)', () => {
  beforeEach(() => localStorage.clear());

  it('serves unused questions first, per slide', () => {
    appendToQuestionCache('local-c1', [q('q1', 's1'), q('q2', 's1'), q('q3', 's2')], 1, 3);
    markQuestionAnswered('q1');
    const bank = getSlideBank('local-c1', 's1');
    expect(bank.unused.map((x) => x.id)).toEqual(['q2']);
    expect(bank.used.map((x) => x.id)).toEqual(['q1']);
    // course-wide view still sees everything
    const course = getSlideBank('local-c1');
    expect(course.unused.length + course.used.length).toBe(3);
  });

  it('dedupes by question text on append', () => {
    appendToQuestionCache('local-c1', [q('a', 's1')], 1, 2);
    appendToQuestionCache('local-c1', [{ ...q('b', 's1'), question: q('a').question }], 2, 2);
    const bank = getSlideBank('local-c1');
    expect(bank.unused.length).toBe(1);
  });

  it('persists answered ids across reads', () => {
    markQuestionAnswered('x1');
    markQuestionAnswered('x2');
    expect(loadAnsweredIds().has('x1')).toBe(true);
    expect(loadAnsweredIds().has('x2')).toBe(true);
  });

  it('background generation defaults ON, explicit opt-out respected (task 42)', () => {
    expect(isBackgroundGenerationEnabled()).toBe(true);
    localStorage.setItem('synapse-bg-generation', '0');
    expect(isBackgroundGenerationEnabled()).toBe(false);
  });
});

describe('parseQuestionIntent (task 43)', () => {
  it('parses the owner\'s exact failing request', () => {
    const intent = parseQuestionIntent('I want to go to the quiz section and answer 20 questions about only slide 8');
    expect(intent).not.toBeNull();
    expect(intent!.count).toBe(20);
    expect(intent!.slideNumber).toBe(8);
  });

  it('handles "quiz me" without a count', () => {
    const intent = parseQuestionIntent('quiz me properly on this');
    expect(intent).not.toBeNull();
    expect(intent!.count).toBe(10);
    expect(intent!.slideNumber).toBeNull();
  });

  it('does not hijack "I have a question about X"', () => {
    expect(parseQuestionIntent('I have a question about entropy')).toBeNull();
  });

  it('ignores plain explanations', () => {
    expect(parseQuestionIntent('explain slide 3 to me please')).toBeNull();
  });

  it('detects flashcard requests', () => {
    const intent = parseQuestionIntent('give me flashcards for this chapter');
    expect(intent).not.toBeNull();
    expect(intent!.flashcards).toBe(true);
  });
});

describe('detectRepeatedQuestion (task 40, B10)', () => {
  const history = [
    { role: 'user', content: 'What is machine language and how does the processor execute it?' },
    { role: 'assistant', content: 'Machine language is...' },
  ];
  it('flags a near-identical re-ask', () => {
    expect(detectRepeatedQuestion('what is machine language, how does the processor execute it??', history)).toBe(true);
  });
  it('passes genuinely new questions', () => {
    expect(detectRepeatedQuestion('Now explain how compilers differ from assemblers', history)).toBe(false);
  });
});
