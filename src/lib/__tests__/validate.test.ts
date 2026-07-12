import { describe, it, expect } from 'vitest';
import { validateQuestions, isRenderableQuestion } from '@/lib/validate';

const mcq = (over: Record<string, unknown> = {}) => ({
  question: 'What does an assembler translate?',
  type: 'multiple_choice',
  options: ['Assembly to machine code', 'Machine code to assembly', 'Python to C', 'HTML to CSS'],
  answer: 'Assembly to machine code',
  explanation: 'Assemblers convert mnemonic instructions into binary machine code.',
  difficulty: 'easy',
  ...over,
});

describe('validateQuestions (task 9 / old Phase 0.1 — the quiz-emptiness guard)', () => {
  it('accepts a well-formed batch', () => {
    const { valid, errors } = validateQuestions([mcq()]);
    expect(valid.length).toBe(1);
    expect(errors.length).toBe(0);
  });

  it('rejects empty questions and answers — the empty-quiz bug class', () => {
    const { valid, errors } = validateQuestions([mcq({ question: '' }), mcq({ answer: '' })]);
    expect(valid.length).toBe(0);
    expect(errors.length).toBe(2);
  });

  it('rejects meta/persona leakage', () => {
    const { valid } = validateQuestions([mcq({ question: 'As an AI, generate the quiz questions for this fast learner' })]);
    expect(valid.length).toBe(0);
  });

  it('requires exactly 4 distinct MCQ options with the answer among them', () => {
    expect(validateQuestions([mcq({ options: ['A', 'B', 'C'] })]).valid.length).toBe(0);
    expect(validateQuestions([mcq({ answer: 'Not an option' })]).valid.length).toBe(0);
  });

  it('enforces exactly ONE blank on fill_blank', () => {
    const fb = mcq({ type: 'fill_blank', options: undefined, question: 'The CPU executes ___ language and ___ code.', answer: 'machine' });
    expect(validateQuestions([fb]).valid.length).toBe(0);
    const ok = mcq({ type: 'fill_blank', options: undefined, question: 'The CPU directly executes ___ language.', answer: 'machine' });
    expect(validateQuestions([ok]).valid.length).toBe(1);
  });

  it('accepts short_answer with a brief expected phrase (task 22)', () => {
    const sa = mcq({ type: 'short_answer', options: undefined, question: 'What tool converts assembly mnemonics into executable binary?', answer: 'an assembler' });
    expect(validateQuestions([sa]).valid.length).toBe(1);
    const tooLong = mcq({ type: 'short_answer', options: undefined, answer: 'x'.repeat(100) });
    expect(validateQuestions([tooLong]).valid.length).toBe(0);
  });

  it('deduplicates near-identical questions', () => {
    const { valid } = validateQuestions([mcq(), mcq()]);
    expect(valid.length).toBe(1);
  });
});

describe('isRenderableQuestion (stale-format sweep)', () => {
  it('rejects legacy multi-blank fill_blank questions', () => {
    expect(isRenderableQuestion({ type: 'fill_blank', question: 'Fill ___ and ___ here please', answer: 'x' })).toBe(false);
  });
  it('keeps valid cached questions', () => {
    expect(isRenderableQuestion(mcq())).toBe(true);
  });
});
