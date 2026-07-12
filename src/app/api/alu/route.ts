/**
 * ALU generation (UNIFIED-PLAN task 30, req C10).
 *
 * POST { pages: [{ id, title, content }], topic? } → { alus: AtomicLearningUnit[] }
 *
 * Stateless by design (R1): the browser sends the learning pages it wants ALUs
 * for and stores the validated result in ITS OWN library — nothing about the
 * learner's material persists here. Generation runs through strategy injection
 * (R3) and the retry-with-errors validation loop (R4).
 */

import { NextRequest, NextResponse } from 'next/server';
import { LLM, authFromRequest, llmErrorResponse } from '@/lib/ai';
import { validateAlus, type AtomicLearningUnit } from '@/lib/document/alu';
import { composeStrategyBlock, activeStrategyIds, recordStrategyOutcome } from '@/lib/strategy';

interface PageInput {
  id: string;
  title: string;
  content: string;
}

function tryParseJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authFromRequest(request);
    const body = await request.json();
    const pages: PageInput[] = Array.isArray(body.pages)
      ? body.pages
          .filter((p: PageInput) => p && typeof p.id === 'string' && typeof p.content === 'string')
          .slice(0, 4) // cap the material per request; the client batches
      : [];

    if (pages.length === 0) {
      return NextResponse.json({ error: 'No pages provided.' }, { status: 400 });
    }

    const validPageIds = new Set(pages.map((p) => p.id));
    const material = pages
      .map((p) => `[${p.id}] ${p.title}\n${p.content.slice(0, 2200)}`)
      .join('\n\n---\n\n');

    const strategyBlock = await composeStrategyBlock('chat');
    const strategyIds = await activeStrategyIds('chat');

    const basePrompt = `You are building Atomic Learning Units (ALUs) — self-contained teachable concepts — from course material. Each page below is labeled with its id in [brackets].

MATERIAL:
"""
${material}
"""

Extract every distinct concept a student must learn. For EACH concept output an object:
{
  "topic": "short concept name",
  "definition": "1-2 sentence precise definition in plain words",
  "explanation": "3-6 sentences teaching the concept simply, everyday language",
  "example": "one concrete everyday example",
  "formula": "the formula in LaTeX, ONLY if the material contains one for this concept",
  "pageRefs": ["page id(s) in brackets above where this concept appears"],
  "related": ["topics of other ALUs in this batch it connects to"],
  "practice": "one short practice question about this concept"
}
${strategyBlock}

Respond ONLY with a valid JSON array of ALU objects, no other text.`;

    const collected: AtomicLearningUnit[] = [];
    let lastErrors: string[] = [];

    for (let attempt = 0; attempt < 2; attempt++) {
      let prompt = basePrompt;
      if (lastErrors.length > 0) {
        prompt += `\n\nYour previous attempt was rejected by validation:\n${lastErrors.slice(0, 6).map((e) => `- ${e}`).join('\n')}\nFix every issue. Return ONLY the corrected JSON array.`;
      }

      const result = await LLM.chat({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Generate the ALUs now. Output only valid JSON.' },
        ],
        auth,
      });
      const raw = result?.choices?.[0]?.message?.content;
      if (!raw) continue;

      let parsed = tryParseJSON(raw);
      if (!Array.isArray(parsed)) {
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenced) parsed = tryParseJSON(fenced[1].trim());
      }
      if (!Array.isArray(parsed)) {
        const bracket = raw.match(/\[[\s\S]*\]/);
        if (bracket) parsed = tryParseJSON(bracket[0]);
      }
      if (!Array.isArray(parsed)) {
        lastErrors = ['response was not a JSON array of ALU objects'];
        continue;
      }

      const { valid, errors } = validateAlus(parsed, validPageIds);
      void recordStrategyOutcome(strategyIds, errors.length === 0, errors.slice(0, 5).join('; ') || undefined);
      const have = new Set(collected.map((a) => a.topic.toLowerCase()));
      for (const alu of valid) {
        if (!have.has(alu.topic.toLowerCase())) collected.push(alu);
      }
      if (collected.length >= 1 && errors.length === 0) break;
      lastErrors = errors;
    }

    if (collected.length === 0) {
      return NextResponse.json(
        { error: 'Could not extract valid learning units from this material.' },
        { status: 422 },
      );
    }
    return NextResponse.json({ alus: collected });
  } catch (error) {
    const mapped = llmErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('[/api/alu] Error:', error);
    return NextResponse.json({ error: 'ALU generation failed. Please try again.' }, { status: 500 });
  }
}
