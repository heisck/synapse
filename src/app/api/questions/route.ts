import { NextRequest, NextResponse } from 'next/server';
import { LLM, authFromRequest, llmErrorResponse, type LLMAuth } from '@/lib/ai';
import { validateQuestions, GENERATABLE_TYPES, type ValidatedQuestion } from '@/lib/validate';
import { composeStrategyBlock, activeStrategyIds, recordStrategyOutcome } from '@/lib/strategy';
import { db } from '@/lib/db';
import type { Question } from '@prisma/client';

function toClientQuestion(q: { type: string; options: string | null } & Record<string, unknown>) {
  const parsed = q.options ? JSON.parse(q.options) : undefined;
  // Matching questions keep their pairs in the options column
  if (q.type === 'matching') {
    return { ...q, options: undefined, matchingPairs: parsed };
  }
  return { ...q, options: parsed };
}

// GET: Fetch previously-generated questions for a course
export async function GET(request: NextRequest) {
  try {
    const courseId = request.nextUrl.searchParams.get('courseId');
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required.' }, { status: 400 });
    }

    const questions = await db.question.findMany({
      where: { courseId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      questions: questions.map(toClientQuestion),
    });
  } catch (error) {
    console.error('[/api/questions GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch questions.' }, { status: 500 });
  }
}

function tryParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Splits material into sections of ~maxChars, preferring slide boundaries. */
function sectionContent(content: string, maxChars: number): string[] {
  const blocks = content.split(/\n\n(?=## )/);
  const sections: string[] = [];
  let current = '';
  for (const block of blocks) {
    if (current && current.length + block.length > maxChars) {
      sections.push(current);
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
    // A single oversized block still gets hard-split so nothing is dropped
    while (current.length > maxChars * 1.5) {
      sections.push(current.slice(0, maxChars));
      current = current.slice(maxChars);
    }
  }
  if (current.trim()) sections.push(current);
  return sections;
}

async function generateQuestions(
  content: string,
  auth: LLMAuth,
  types: string[] = [...GENERATABLE_TYPES],
): Promise<ValidatedQuestion[]> {
  const wants = (t: string) => types.includes(t);
  const typeSpecs = [
    wants('multiple_choice') &&
      `- "multiple_choice": { "question", "type": "multiple_choice", "options": [exactly 4 distinct strings], "answer": one of the options, "explanation", "concept", "difficulty" }`,
    wants('true_false') &&
      `- "true_false": { "question": a statement to judge, "type": "true_false", "answer": "True" or "False", "explanation", "concept", "difficulty" }`,
    wants('fill_blank') &&
      `- "fill_blank": { "question": a sentence with the key term replaced by "___", "type": "fill_blank", "answer": the missing term (short), "explanation", "concept", "difficulty" }`,
    wants('matching') &&
      `- "matching": { "question": e.g. "Match each term to its definition", "type": "matching", "matchingPairs": [3-5 objects {"left": term, "right": its match}], "answer": "", "explanation", "concept", "difficulty" }`,
  ]
    .filter(Boolean)
    .join('\n');
  const mixNote =
    types.length > 1
      ? `MANDATORY MIX: include AT LEAST ONE question of EACH allowed type (${types.join(', ')}) — a batch with only multiple_choice is invalid.`
      : `Every question must be type "${types[0]}".`;

  // Strategy Injection (R3): accumulated system knowledge rides along with
  // every generation request — structure, quality constraints, language policy
  const strategyBlock = await composeStrategyBlock('questions');
  const strategyIds = await activeStrategyIds('questions');

  const basePrompt = (intro: string) => `${intro}

Content:
"""
${content.slice(0, 3000)}
"""

Generate 6-10 questions. ${mixNote}
Allowed formats:
${typeSpecs}
${strategyBlock}

Respond ONLY with a valid JSON array of question objects, no other text.`;

  const promptVariants = [
    basePrompt('You are a quiz author. Based on this educational content, write quiz questions in valid JSON array format.'),
    basePrompt('Create a quiz strictly from this material. Every question must be answerable from the content alone.'),
    basePrompt('Write exam-quality questions covering the distinct facts and concepts in this material.'),
  ];

  // Validation layer (docs/ROADMAP.md Phase 0.1): the model's array is never
  // trusted as-is. Each attempt is schema-checked; the next attempt gets the
  // concrete validation errors appended so the model can fix them. Only items
  // that pass every check are ever returned or saved.
  const collected: ValidatedQuestion[] = [];
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    let prompt = promptVariants[attempt];
    if (lastErrors.length > 0) {
      prompt += `\n\nYour previous attempt was rejected by validation:\n${lastErrors
        .slice(0, 8)
        .map((e) => `- ${e}`)
        .join('\n')}\nFix every issue. Return ONLY the corrected JSON array.`;
    }

    const result = await LLM.chat({
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: 'Generate the quiz questions now. Output only valid JSON.',
        },
      ],
      auth,
    });

    const raw = result?.choices?.[0]?.message?.content;
    if (!raw) continue;

    // Parse: direct → fenced code block → first [...] span
    let parsed = tryParseJSON(raw);
    if (!Array.isArray(parsed)) {
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) parsed = tryParseJSON(jsonMatch[1].trim());
    }
    if (!Array.isArray(parsed)) {
      const bracketMatch = raw.match(/\[[\s\S]*\]/);
      if (bracketMatch) parsed = tryParseJSON(bracketMatch[0]);
    }
    if (!Array.isArray(parsed)) {
      lastErrors = ['response was not a JSON array of question objects'];
      continue;
    }

    const { valid, errors } = validateQuestions(parsed);
    // Outcome metrics (task 17): per-attempt pass/fail feeds strategy stats;
    // repeated failure patterns auto-file suggestions (stage 1, R2)
    void recordStrategyOutcome(strategyIds, errors.length === 0, errors.slice(0, 5).join('; ') || undefined);
    // Accumulate across attempts, deduping against what we already have
    const have = new Set(collected.map((q) => q.question.toLowerCase()));
    for (const q of valid) {
      if (!have.has(q.question.toLowerCase())) collected.push(q);
    }
    if (collected.length >= 5) return collected;
    lastErrors = errors.length > 0 ? errors : ['too few valid questions — generate more'];
  }

  return collected;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let content = body.content;
    const { courseId, slideId } = body;

    // If no direct content, try fetching from DB
    if (!content && slideId) {
      const slide = await db.slide.findUnique({ where: { id: slideId } });
      if (slide) content = slide.content;
    }

    if (!content && courseId) {
      const slides = await db.slide.findMany({
        where: { courseId },
        orderBy: { order: 'asc' },
      });
      content = slides.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'No content provided to generate questions from.' },
        { status: 400 },
      );
    }

    // Section the material instead of truncating it: previously everything
    // past the first 3000 chars was invisible to the model, so questions only
    // ever covered the start of a course. Each ~2800-char section (split on
    // slide boundaries) gets its own generation pass, capped per request to
    // stay inside serverless time limits. `sectionOffset`/`maxSections` let
    // the client walk ALL sections incrementally (background generation and
    // exam mode use maxSections=1 per tick).
    const allSections = sectionContent(content, 2800);
    const sectionOffset = Math.max(0, Math.min(Number(body.sectionOffset) || 0, allSections.length));
    const maxSections = Math.max(1, Math.min(Number(body.maxSections) || 4, 4));
    const sections = allSections.slice(sectionOffset, sectionOffset + maxSections);
    const auth = authFromRequest(request);
    // Optional learner-configured type mix (e.g. ["multiple_choice","matching"])
    const requestedTypes = Array.isArray(body.types)
      ? (body.types as string[]).filter((t) => (GENERATABLE_TYPES as readonly string[]).includes(t))
      : [];
    const types = requestedTypes.length > 0 ? requestedTypes : [...GENERATABLE_TYPES];
    const questions: ValidatedQuestion[] = [];
    const seenQ = new Set<string>();
    for (const section of sections) {
      const generated = await generateQuestions(section, auth, types);
      for (const q of generated) {
        const key = q.question.toLowerCase();
        if (!seenQ.has(key)) {
          seenQ.add(key);
          questions.push(q);
        }
      }
    }
    const sectionsDone = sectionOffset + sections.length;

    if (questions.length === 0 && sectionsDone >= allSections.length) {
      return NextResponse.json(
        { error: 'Failed to generate questions. Please try with different content.' },
        { status: 502 },
      );
    }

    // Local-first mode (ROADMAP Phase 2): questions for a learner's local
    // course never touch the shared DB — they get ids here and the browser
    // caches them. Triggered by persist:false or a local- course id.
    if (body.persist === false || (typeof courseId === 'string' && courseId.startsWith('local-'))) {
      return NextResponse.json({
        success: true,
        questions: questions.map((q) => ({
          id: `local-q-${crypto.randomUUID()}`,
          courseId: courseId || null,
          slideId: slideId || null,
          type: q.type,
          question: q.question,
          options: q.options,
          matchingPairs: q.matchingPairs,
          answer: q.answer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          concept: q.concept ?? null,
          createdAt: new Date().toISOString(),
        })),
        sectionsTotal: allSections.length,
        sectionsDone,
        hasMore: sectionsDone < allSections.length,
      });
    }

    // Save questions to database if courseId is provided. Everything here has
    // already passed the validation layer — no empty rows can be written.
    const savedQuestions: Question[] = [];
    for (const q of questions) {
      const saved = await db.question.create({
        data: {
          courseId: courseId || null,
          slideId: slideId || null,
          type: q.type,
          question: q.question,
          // Matching pairs ride in the options column; toClientQuestion
          // rehydrates them as matchingPairs
          options: q.matchingPairs
            ? JSON.stringify(q.matchingPairs)
            : q.options
              ? JSON.stringify(q.options)
              : null,
          answer: q.answer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          concept: q.concept ?? null,
        },
      });
      savedQuestions.push(saved);
    }

    return NextResponse.json({
      success: true,
      questions: savedQuestions.map(toClientQuestion),
      sectionsTotal: allSections.length,
      sectionsDone,
      hasMore: sectionsDone < allSections.length,
    });
  } catch (error) {
    const mapped = llmErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('[/api/questions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions. Please try again.' },
      { status: 500 },
    );
  }
}