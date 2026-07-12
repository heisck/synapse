import { describe, it, expect } from 'vitest';
import { normalizeDocument, findBlock } from '@/lib/document/normalizer';

const deck = [
  { title: 'CSC 101 — Introduction to Programming', content: 'CSC 101 — Introduction to Programming' },
  { title: 'Learning Objectives', content: 'By the end of this lecture you will:\n- explain machine language\n- describe assemblers' },
  { title: 'Machine Language', content: 'Machine Language' }, // title-only → merges into next
  {
    title: 'What is Machine Language?',
    content: 'MACHINE LANGUAGE BASICS\nMachine language is binary code executed directly by hardware.\n- made of 1s and 0s\n- native to a processor\nE = mc^2',
  },
  { title: 'Summary', content: 'Summary\nWe covered machine language and assemblers.' },
  { title: 'References', content: 'Smith et al. (2019). doi:10.1000/x\nhttps://example.com/a\nJones (2021). doi:10.1000/y\n[3] Brown (2020).' },
];

describe('normalizeDocument (tasks 25/26/29, C3/C4/C8)', () => {
  const doc = normalizeDocument(deck, 'lecture1.pdf');

  it('classifies page purposes', () => {
    expect(doc.pages[0].kind).toBe('title');
    expect(doc.pages[1].kind).toBe('objectives');
    expect(doc.pages[3].kind).toBe('learning');
    expect(doc.pages[4].kind).toBe('summary');
    expect(doc.pages[5].kind).toBe('references');
  });

  it('merges title-only pages into the section they introduce', () => {
    expect(doc.pages[2].mergedInto).toBe('page_4');
  });

  it('builds the compact teaching-only sequence', () => {
    expect(doc.compact).toEqual(['page_4']);
  });

  it('assigns stable block IDs with char ranges', () => {
    const page4 = doc.pages[3];
    expect(page4.blocks.length).toBeGreaterThan(2);
    for (const b of page4.blocks) {
      expect(b.id.startsWith('page_4/')).toBe(true);
      expect(b.charEnd).toBeGreaterThan(b.charStart);
    }
  });

  it('detects bullets and formulas (task 29)', () => {
    const page4 = doc.pages[3];
    expect(page4.blocks.some((b) => b.type === 'bullet' && b.text.includes('1s and 0s'))).toBe(true);
    expect(page4.blocks.some((b) => b.type === 'formula' && b.text.includes('mc^2'))).toBe(true);
  });

  it('findBlock resolves stable ids back to page + block', () => {
    const first = doc.pages[3].blocks[0];
    const hit = findBlock(doc, first.id);
    expect(hit?.page.id).toBe('page_4');
    expect(hit?.block.id).toBe(first.id);
  });

  it('never treats prose as a formula', () => {
    const prose = normalizeDocument(
      [{ title: 'T', content: 'The equation shows that energy and mass are related concepts in physics.' }],
      'x.txt',
    );
    expect(prose.pages[0].blocks.every((b) => b.type !== 'formula')).toBe(true);
  });
});
