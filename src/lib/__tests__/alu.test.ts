import { describe, it, expect } from 'vitest';
import { validateAlus } from '@/lib/document/alu';

const pageIds = new Set(['page_1', 'page_2']);

const alu = (over: Record<string, unknown> = {}) => ({
  topic: 'Machine Language',
  definition: 'Binary code that a processor executes directly, made of 1s and 0s.',
  explanation:
    'Every CPU speaks exactly one native language made of binary instructions. Anything a computer does eventually becomes these 1s and 0s — higher-level languages exist for humans, but they all get translated down to this.',
  example: 'Like a lock that only opens with one exact key pattern — the CPU only responds to its exact bit patterns.',
  pageRefs: ['page_1'],
  related: ['Assembly Language'],
  practice: 'What language does a CPU execute directly?',
  ...over,
});

describe('validateAlus (task 30, C10)', () => {
  it('accepts a complete ALU', () => {
    const { valid, errors } = validateAlus([alu()], pageIds);
    expect(valid.length).toBe(1);
    expect(errors.length).toBe(0);
    expect(valid[0].id).toMatch(/^alu-/);
  });

  it('rejects ALUs citing nonexistent pages', () => {
    const { valid, errors } = validateAlus([alu({ pageRefs: ['page_99'] })], pageIds);
    expect(valid.length).toBe(0);
    expect(errors[0]).toContain('pageRefs');
  });

  it('accepts block-level refs on real pages', () => {
    const { valid } = validateAlus([alu({ pageRefs: ['page_2/paragraph_01'] })], pageIds);
    expect(valid.length).toBe(1);
  });

  it('rejects thin explanations and missing examples', () => {
    expect(validateAlus([alu({ explanation: 'Too short.' })], pageIds).valid.length).toBe(0);
    expect(validateAlus([alu({ example: '' })], pageIds).valid.length).toBe(0);
  });

  it('rejects meta leakage and duplicate topics', () => {
    expect(validateAlus([alu({ definition: 'As an AI, I would define this as a placeholder' })], pageIds).valid.length).toBe(0);
    expect(validateAlus([alu(), alu()], pageIds).valid.length).toBe(1);
  });
});
