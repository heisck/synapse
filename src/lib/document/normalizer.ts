/**
 * Document Normalizer + Structured Document Builder (UNIFIED-PLAN tasks 25/26/29,
 * req C3/C4/C8).
 *
 * Takes the flat slides the upload extractors produce and builds the internal
 * learning format:
 *  - every page classified by educational purpose (title/course-info/lecturer/
 *    objectives/summary/references/appendix/learning) — this is what lets the
 *    tutor skip non-essential content (A10) and the player fade it (C18)
 *  - title-only pages merged into the section they introduce
 *  - a COMPACT sequence (teaching pages only) alongside the untouched ORIGINAL
 *  - every paragraph/bullet/heading/code/formula block gets a stable ID
 *    (`page_3/paragraph_02`) and a character range in its page — the text-
 *    extraction stand-in for coordinates, enough for highlighting and TTS sync
 *
 * Pure TypeScript, no I/O: runs server-side at upload time, and the result is
 * stored ONLY user-side (IndexedDB / BYO db, rule R1) via localLibrary.
 */

export type PageKind =
  | 'title'
  | 'course-info'
  | 'lecturer'
  | 'objectives'
  | 'summary'
  | 'references'
  | 'appendix'
  | 'learning';

export type BlockType = 'heading' | 'paragraph' | 'bullet' | 'code' | 'formula' | 'table';

export interface DocBlock {
  /** Stable ID: `page_3/paragraph_02` — the anchor for highlighting (C9/C19). */
  id: string;
  type: BlockType;
  text: string;
  /** 0-based position within the page. */
  order: number;
  /** Character range within the page's original text (position preservation). */
  charStart: number;
  charEnd: number;
}

export interface DocPage {
  /** Stable ID: `page_3` (1-based original page number). */
  id: string;
  pageNumber: number;
  title: string;
  kind: PageKind;
  /** The untouched extracted text of this page. */
  original: string;
  blocks: DocBlock[];
  /** Page id this title-only page was merged into (compact view), if any. */
  mergedInto: string | null;
}

export interface StructuredDocument {
  version: 1;
  sourceFile: string;
  createdAt: string;
  pages: DocPage[];
  /** Ordered page ids forming the compact (teaching-only) sequence. */
  compact: string[];
}

// ─── Page classification (C3) ────────────────────────────────────────────────

const KIND_PATTERNS: Array<{ kind: PageKind; title: RegExp; body?: RegExp }> = [
  { kind: 'objectives', title: /\b(objectives?|learning (outcomes?|goals?)|at the end of|by the end)\b/i, body: /\bby the end of (this|the)\b/i },
  { kind: 'summary', title: /\b(summary|recap|conclusions?|key takeaways?|wrap[- ]?up|review)\b/i },
  { kind: 'references', title: /\b(references?|bibliograph|further reading|citations?|sources|reading list)\b/i },
  { kind: 'appendix', title: /\bappendix|appendices\b/i },
  { kind: 'course-info', title: /\b(course (outline|info|overview|structure)|syllabus|assessment|grading|credit)\b/i, body: /\b(assessment|grading|credit hours?|prerequisites?)\b/i },
  { kind: 'lecturer', title: /\b(lecturer|instructor|professor|about (me|the (lecturer|instructor))|contact)\b/i, body: /\b(office hours?|department of)\b/i },
];

const DOI_OR_CITATION = /\b(doi:|https?:\/\/|et al\.|\(\d{4}\)\.|\[\d+\])/g;

function classifyPage(title: string, content: string, pageNumber: number, totalPages: number): PageKind {
  for (const p of KIND_PATTERNS) {
    if (p.title.test(title)) return p.kind;
    if (p.body && p.body.test(content.slice(0, 400))) return p.kind;
  }
  // Reference-dense pages without a "References" title still classify by shape
  const citations = content.match(DOI_OR_CITATION)?.length ?? 0;
  const lines = content.split('\n').filter((l) => l.trim()).length;
  if (lines >= 4 && citations >= Math.max(3, lines * 0.5)) return 'references';
  // A very short first page is the deck's title page
  if (pageNumber === 1 && totalPages > 2 && content.trim().length < 220) return 'title';
  return 'learning';
}

// ─── Block parsing (C4) + formula detection (C8, task 29) ────────────────────

const BULLET_RE = /^\s*(?:[-•·▪*]|\d{1,2}[.)])\s+/;
// Formula shape: math operators/symbols present and prose density low — or
// explicit LaTeX. Deliberately conservative: a false 'paragraph' is harmless,
// a false 'formula' would suppress teaching text.
const MATH_SYMBOLS = /[=≈≠≤≥±×÷√∑∏∫∂∞→←Δθλμσπαβγ^]|\\(frac|sum|int|sqrt|alpha|beta|cdot)/;

function isFormulaLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 200) return false;
  if (/\\(frac|sum|int|sqrt)\b/.test(t)) return true;
  if (!MATH_SYMBOLS.test(t)) return false;
  const words = t.split(/\s+/);
  const proseWords = words.filter((w) => /^[A-Za-z]{4,}$/.test(w)).length;
  return proseWords / words.length < 0.4 && /[=≤≥≈∑∫√^]|\d/.test(t);
}

function isHeadingLine(line: string, index: number): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 70 || BULLET_RE.test(t)) return false;
  if (/[.:;,]$/.test(t)) return false;
  // ALL-CAPS short lines, markdown headings, or a short opening line
  return /^#{1,6}\s/.test(t) || (t === t.toUpperCase() && /[A-Z]{3,}/.test(t)) || (index === 0 && t.split(/\s+/).length <= 8);
}

function buildBlocks(pageId: string, content: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const counters: Record<string, number> = {};
  const push = (type: BlockType, text: string, charStart: number, charEnd: number) => {
    counters[type] = (counters[type] ?? 0) + 1;
    blocks.push({
      id: `${pageId}/${type}_${String(counters[type]).padStart(2, '0')}`,
      type,
      text: text.trim(),
      order: blocks.length,
      charStart,
      charEnd,
    });
  };

  // Fenced code blocks first — their contents must not be re-parsed as prose
  const segments: Array<{ text: string; start: number; isCode: boolean }> = [];
  let cursor = 0;
  const fenceRe = /```[\s\S]*?```/g;
  for (const m of content.matchAll(fenceRe)) {
    if (m.index! > cursor) segments.push({ text: content.slice(cursor, m.index), start: cursor, isCode: false });
    segments.push({ text: m[0], start: m.index!, isCode: true });
    cursor = m.index! + m[0].length;
  }
  if (cursor < content.length) segments.push({ text: content.slice(cursor), start: cursor, isCode: false });

  for (const seg of segments) {
    if (seg.isCode) {
      push('code', seg.text.replace(/^```\w*\n?|```$/g, ''), seg.start, seg.start + seg.text.length);
      continue;
    }
    // Group physical lines into logical blocks: consecutive bullets stay
    // separate items; consecutive prose lines join into one paragraph
    const lines = seg.text.split('\n');
    let offset = seg.start;
    let para: { text: string; start: number } | null = null;
    const flushPara = () => {
      if (para && para.text.trim()) push('paragraph', para.text, para.start, para.start + para.text.length);
      para = null;
    };
    lines.forEach((line, li) => {
      const lineStart = offset;
      offset += line.length + 1;
      const t = line.trim();
      if (!t) { flushPara(); return; }
      if (BULLET_RE.test(line)) {
        flushPara();
        push('bullet', t.replace(BULLET_RE, ''), lineStart, lineStart + line.length);
      } else if (isFormulaLine(line)) {
        flushPara();
        push('formula', t, lineStart, lineStart + line.length);
      } else if (isHeadingLine(line, li) && blocks.length + (para ? 1 : 0) < 3) {
        flushPara();
        push('heading', t.replace(/^#{1,6}\s/, ''), lineStart, lineStart + line.length);
      } else if (para) {
        para.text += ' ' + t;
      } else {
        para = { text: t, start: lineStart };
      }
    });
    flushPara();
  }
  return blocks;
}

// ─── Normalizer entry point ──────────────────────────────────────────────────

export function normalizeDocument(
  slides: Array<{ title: string; content: string }>,
  sourceFile: string,
): StructuredDocument {
  const total = slides.length;
  const pages: DocPage[] = slides.map((s, i) => {
    const pageId = `page_${i + 1}`;
    return {
      id: pageId,
      pageNumber: i + 1,
      title: s.title,
      kind: classifyPage(s.title, s.content, i + 1, total),
      original: s.content,
      blocks: buildBlocks(pageId, s.content),
      mergedInto: null,
    };
  });

  // Title-only slide merge (C3): a learning page whose content is just its
  // heading introduces the NEXT learning page — compact view folds them together
  for (let i = 0; i < pages.length - 1; i++) {
    const p = pages[i];
    const next = pages[i + 1];
    const contentBeyondTitle = p.original.replace(p.title, '').trim();
    if (p.kind === 'learning' && contentBeyondTitle.length < 40 && next.kind === 'learning') {
      p.mergedInto = next.id;
    }
  }

  // Compact sequence (C18): teaching content only; merged title pages ride
  // along inside their target, non-teaching pages are skipped entirely
  const compact = pages
    .filter((p) => p.kind === 'learning' && !p.mergedInto)
    .map((p) => p.id);

  return {
    version: 1,
    sourceFile,
    createdAt: new Date().toISOString(),
    pages,
    compact,
  };
}

/** Look up any block by its stable id — the highlighting/TTS-sync primitive (C9). */
export function findBlock(doc: StructuredDocument, blockId: string): { page: DocPage; block: DocBlock } | null {
  const pageId = blockId.split('/')[0];
  const page = doc.pages.find((p) => p.id === pageId);
  const block = page?.blocks.find((b) => b.id === blockId);
  return page && block ? { page, block } : null;
}
