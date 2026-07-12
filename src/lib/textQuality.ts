/**
 * Response text-quality layer (UNIFIED-PLAN tasks 3 + 4, req B1/B2/A1).
 *
 * Two stages, both meaning-preserving:
 *  1. Corruption detection/repair — mojibake, broken dash runs, repeated-token
 *     loops, unterminated code fences. Severe corruption is *reported* so the
 *     caller can discard/regenerate instead of rendering garbage.
 *  2. Formatting normalization — spacing, list markers, paragraph breaks.
 *
 * Dev builds log a before/after diff line so we can review whether the model
 * "did the right thing" (B2) and feed the prompt-improvement loop later.
 */

export interface TextQualityReport {
  text: string;
  /** Repairs applied, by name (empty = clean input). */
  repairs: string[];
  /** True when the text is too damaged to show and should be regenerated. */
  discard: boolean;
}

// UTF-8-read-as-Latin-1 artifacts (the â€™-class garbage) — the exact failure
// mode visible in the source requirements doc itself.
const MOJIBAKE_MAP: Array<[RegExp, string]> = [
  [/â€™/g, '’'],
  [/â€˜/g, '‘'],
  [/â€œ/g, '“'],
  [/â€?/g, '”'],
  [/â€"/g, '—'],
  [/â€“/g, '–'],
  [/â€¦/g, '…'],
  [/â¸»/g, '———'],
  [/Â /g, ' '],
  [/â¢/g, '•'],
  [/â¨/g, ''],
];

const REPLACEMENT_CHAR = /�/g;

function repairMojibake(text: string, repairs: string[]): string {
  let out = text;
  let hit = false;
  for (const [pattern, replacement] of MOJIBAKE_MAP) {
    if (pattern.test(out)) {
      out = out.replace(pattern, replacement);
      hit = true;
    }
  }
  if (REPLACEMENT_CHAR.test(out)) {
    out = out.replace(REPLACEMENT_CHAR, '');
    hit = true;
  }
  if (hit) repairs.push('mojibake');
  return out;
}

/** "- - - - -" / "— — —" chains and stray dash-only lines between paragraphs. */
function repairBrokenDashes(text: string, repairs: string[]): string {
  let out = text.replace(/^(?:[-–—]\s*){3,}$/gm, '---');
  out = out.replace(/(?:[-–—]\s+){4,}[-–—]?/g, ' — ');
  if (out !== text) repairs.push('dash-runs');
  return out;
}

/**
 * Model repetition loops: the same short line emitted 4+ times in a row is a
 * decoding failure, never intentional prose. Collapse to one occurrence.
 */
function repairTokenLoops(text: string, repairs: string[]): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let runStart = 0;
  for (let i = 1; i <= lines.length; i++) {
    if (i < lines.length && lines[i].trim() && lines[i].trim() === lines[runStart].trim()) continue;
    const runLen = i - runStart;
    out.push(lines[runStart]);
    if (runLen >= 4) {
      if (!repairs.includes('token-loop')) repairs.push('token-loop');
    } else {
      for (let j = runStart + 1; j < i; j++) out.push(lines[j]);
    }
    runStart = i;
  }
  return out.join('\n');
}

function repairUnterminatedFence(text: string, repairs: string[]): string {
  const fences = (text.match(/^```/gm) || []).length;
  if (fences % 2 === 1) {
    repairs.push('unterminated-fence');
    return text.trimEnd() + '\n```';
  }
  return text;
}

/** Stage 1: corruption detection & repair. */
export function detectAndRepair(raw: string): TextQualityReport {
  const repairs: string[] = [];
  let text = raw;

  text = repairMojibake(text, repairs);
  text = repairBrokenDashes(text, repairs);
  text = repairTokenLoops(text, repairs);
  text = repairUnterminatedFence(text, repairs);

  // Discard heuristics: mostly-unprintable output, or nothing readable left.
  const printable = text.replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n]/gu, '');
  const unreadableRatio = text.length > 40 ? 1 - printable.length / text.length : 0;
  const discard = text.trim().length === 0 || unreadableRatio > 0.3;

  return { text, repairs, discard };
}

/** Stage 2: formatting normalization (never touches code blocks). */
export function normalizeFormatting(input: string): string {
  const segments = input.split(/(```[\s\S]*?```)/g);
  const normalized = segments.map((seg) => {
    if (seg.startsWith('```')) return seg; // leave code untouched
    let s = seg;
    s = s.replace(/[ \t]+$/gm, ''); // trailing whitespace
    s = s.replace(/\n{4,}/g, '\n\n\n'); // cap blank runs
    s = s.replace(/^[•·▪]\s*/gm, '- '); // unify bullet markers
    s = s.replace(/^(\s*)\*\s+/gm, '$1- '); // * lists → - lists
    s = s.replace(/^(#{1,6})([^\s#])/gm, '$1 $2'); // "##Heading" → "## Heading"
    // A list item jammed straight onto a paragraph needs a separating break
    s = s.replace(/([^\n])\n(- |\d+\. )/g, (m, prev, marker) =>
      /^(- |\d+\. )/.test(prev) ? m : `${prev}\n\n${marker}`);
    return s;
  });
  return normalized.join('').trim();
}

/**
 * Identity firewall output scrub (B13). Only SELF-referential disclosures are
 * rewritten ("I am a large language model trained by …") — a lesson that
 * legitimately teaches about AI models is left untouched.
 */
const SELF_DISCLOSURE_PATTERNS: RegExp[] = [
  /\b(?:I(?:'m| am)|as) an? (?:AI |artificial intelligence )?(?:large )?language model[^.!?\n]*/gi,
  /\bas an AI(?: assistant| model)?,?\s*(?:developed|created|trained|built) by [^.!?\n]*/gi,
  /\bI(?:'m| am| was) (?:developed|created|trained|built|made) by (?:OpenAI|Google|Meta|Anthropic|DeepSeek|Mistral|Nvidia|Tencent|Alibaba|Qwen)[^.!?\n]*/gi,
  /\bI(?:'m| am) (?:GPT[-\w.]*|Llama[-\w.]*|Gemma[-\w.]*|Gemini[-\w.]*|Claude[-\w.]*|DeepSeek[-\w.]*|Qwen[-\w.]*|Nemotron[-\w.]*|Mistral[-\w.]*)\b[^.!?\n]*/gi,
  /\bpowered by (?:OpenRouter|OpenAI|GPT[-\w.]*|Llama[-\w.]*|Gemini[-\w.]*|Claude[-\w.]*|DeepSeek[-\w.]*|Qwen[-\w.]*)[^.!?\n]*/gi,
];

export function scrubIdentity(text: string): { text: string; scrubbed: boolean } {
  let scrubbed = false;
  let out = text;
  for (const pattern of SELF_DISCLOSURE_PATTERNS) {
    if (pattern.test(out)) {
      out = out.replace(pattern, "I'm Synapse, your personal tutor in this app");
      scrubbed = true;
    }
    pattern.lastIndex = 0;
  }
  return { text: out, scrubbed };
}

/**
 * Full pipeline for a finished (non-streaming or fully-accumulated) response.
 * Streaming callers run this once at stream end — repairing mid-stream would
 * make text visibly rewrite itself under the user's cursor.
 */
export function cleanResponse(raw: string): TextQualityReport {
  const stage1 = detectAndRepair(raw);
  if (stage1.discard) return stage1;
  const identity = scrubIdentity(stage1.text);
  if (identity.scrubbed) stage1.repairs.push('identity-scrub');
  const text = normalizeFormatting(identity.text);
  if (process.env.NODE_ENV !== 'production' && (stage1.repairs.length || text !== raw.trim())) {
    console.debug('[textQuality]', {
      repairs: stage1.repairs,
      changed: text !== raw.trim(),
      before: raw.slice(0, 120),
      after: text.slice(0, 120),
    });
  }
  return { ...stage1, text };
}
