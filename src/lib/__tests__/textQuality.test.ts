import { describe, it, expect } from 'vitest';
import { detectAndRepair, normalizeFormatting, scrubIdentity, stripReasoningLeak, cleanResponse } from '@/lib/textQuality';

describe('detectAndRepair (task 3, B1)', () => {
  it('repairs mojibake artifacts', () => {
    const r = detectAndRepair('Itâ€™s the studentâ€™s slide â€” see â€œnotesâ€¦');
    expect(r.text).toContain('It’s');
    expect(r.repairs).toContain('mojibake');
    expect(r.discard).toBe(false);
  });

  it('collapses repeated-line token loops', () => {
    const line = 'The mitochondria is the powerhouse.';
    const r = detectAndRepair(Array(6).fill(line).join('\n'));
    expect(r.text.split('\n').filter((l) => l.includes('powerhouse')).length).toBe(1);
    expect(r.repairs).toContain('token-loop');
  });

  it('closes unterminated code fences', () => {
    const r = detectAndRepair('Here:\n```js\nconsole.log(1)');
    expect((r.text.match(/```/g) || []).length % 2).toBe(0);
    expect(r.repairs).toContain('unterminated-fence');
  });

  it('discards empty output', () => {
    expect(detectAndRepair('   ').discard).toBe(true);
  });
});

describe('normalizeFormatting (task 4, A1/B2)', () => {
  it('unifies bullet markers and caps blank runs', () => {
    const out = normalizeFormatting('• one\n* two\n\n\n\n\n- three');
    expect(out).toContain('- one');
    expect(out).toContain('- two');
    expect(out).not.toMatch(/\n{4,}/);
  });

  it('leaves code blocks untouched', () => {
    const code = '```py\n• not a bullet\n```';
    expect(normalizeFormatting(code)).toContain('• not a bullet');
  });

  it('fixes jammed markdown headings', () => {
    expect(normalizeFormatting('##Heading')).toBe('## Heading');
  });
});

describe('scrubIdentity (task 12, B13)', () => {
  it('rewrites self-disclosures', () => {
    const r = scrubIdentity('I am a large language model trained by OpenAI.');
    expect(r.scrubbed).toBe(true);
    expect(r.text).toContain('Synapse');
    expect(r.text).not.toMatch(/OpenAI/);
  });

  it('leaves lessons about AI models alone', () => {
    const lesson = 'GPT-4 and Llama are examples of large language models used in industry.';
    const r = scrubIdentity(lesson);
    expect(r.scrubbed).toBe(false);
    expect(r.text).toBe(lesson);
  });
});

describe('stripReasoningLeak (task 45, owner slop report)', () => {
  it('drops deliberation before a quiz fence', () => {
    const leaked =
      'We need to generate quiz questions. According to INTERACTIVE QUIZ PROTOCOL, the spec says 5-10... Let us craft 20.\n```quiz\n{"mode":"quiz","questions":[]}\n```';
    const r = stripReasoningLeak(leaked);
    expect(r.leaked).toBe(true);
    expect(r.text).not.toContain('INTERACTIVE QUIZ PROTOCOL');
    expect(r.text).toContain('```quiz');
  });

  it('discards pure deliberation that never reached an answer', () => {
    const r = stripReasoningLeak('The learner wants 20 questions. The spec says 5-10 for exam mode. answerIndex must be 0-based. Let us craft...');
    expect(r.discard).toBe(true);
  });

  it('does not touch normal teaching text', () => {
    const normal = 'Entropy measures disorder. Think of a deck of cards you drop on the floor.';
    const r = stripReasoningLeak(normal);
    expect(r.leaked).toBe(false);
    expect(r.text).toBe(normal);
  });
});

describe('cleanResponse pipeline', () => {
  it('runs all stages and reports repairs', () => {
    const r = cleanResponse('Itâ€™s fine.\n\n\n\n\n• bullet');
    expect(r.discard).toBe(false);
    expect(r.repairs).toContain('mojibake');
    expect(r.text).toContain('- bullet');
  });

  it('marks reasoning-only responses for discard', () => {
    const r = cleanResponse('According to the spec, valid JSON in this exact shape with answerIndex...');
    expect(r.discard).toBe(true);
  });
});
