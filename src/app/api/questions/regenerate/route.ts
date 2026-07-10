import { NextRequest, NextResponse } from 'next/server';
import { LLM, authFromRequest, llmErrorResponse } from '@/lib/ai';
import { validateOneQuestion } from '@/lib/validate';
import { db } from '@/lib/db';

function tryParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Extract a single JSON object from an LLM response (handles code fences / surrounding prose). */
function extractObject(raw: string): Record<string, unknown> | null {
  let parsed = tryParseJSON(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    parsed = tryParseJSON(fence[1].trim());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  const braces = raw.match(/\{[\s\S]*\}/);
  if (braces) {
    parsed = tryParseJSON(braces[0]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  return null;
}

// POST: re-phrase a single question into a fresh variation testing the SAME concept.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const original = body.question as
      | {
          type?: string;
          question?: string;
          answer?: string;
          concept?: string;
          difficulty?: string;
          courseId?: string;
          slideId?: string;
        }
      | undefined;

    if (!original?.question) {
      return NextResponse.json(
        { error: 'An existing question is required to regenerate from.' },
        { status: 400 },
      );
    }

    const type = original.type || 'multiple_choice';
    const concept = original.concept || 'the underlying concept';
    const difficulty = original.difficulty || 'medium';

    const prompt = `You are a quiz author. Rewrite the following question as a BRAND-NEW variation that tests the exact same concept ("${concept}") but with different wording, a different angle, and (where applicable) different options/numbers. Do NOT return the same question verbatim.

Original question: """${original.question}"""
Original answer: """${original.answer || ''}"""

Requirements:
- Keep type: "${type}"
- Keep difficulty: "${difficulty}"
- For multiple_choice provide 4 plausible options; for true_false the answer is "True" or "False".
- Provide a concise explanation of the correct answer.

Respond with ONLY a valid JSON object:
{
  "question": "...",
  "type": "${type}",
  "options": ["A", "B", "C", "D"],
  "answer": "correct answer",
  "explanation": "why this is correct",
  "concept": "${concept}",
  "difficulty": "${difficulty}"
}`;

    // Validation layer: the parsed object must survive full schema checks
    // (non-empty fields, 4 distinct options, answer among them, no leaked
    // task/persona text) — retries carry the specific errors back to the model.
    let obj: Record<string, unknown> | null = null;
    let lastErrors: string[] = [];
    for (let attempt = 0; attempt < 3 && !obj; attempt++) {
      const retryNote = lastErrors.length
        ? `\n\nYour previous attempt was rejected: ${lastErrors.join('; ')}. Fix every issue.`
        : '';
      const result = await LLM.chat({
        messages: [
          { role: 'system', content: prompt + retryNote },
          { role: 'user', content: 'Generate the new question variation now. Output only valid JSON.' },
        ],
        auth: authFromRequest(request),
      });
      const raw = result?.choices?.[0]?.message?.content;
      const candidate = raw ? extractObject(raw) : null;
      if (!candidate) {
        lastErrors = ['response was not a JSON object'];
        continue;
      }
      const { valid, errors } = validateOneQuestion(candidate);
      if (valid) {
        obj = candidate;
      } else {
        lastErrors = errors;
      }
    }

    if (!obj || !obj.question || !obj.answer) {
      return NextResponse.json(
        { error: 'Could not generate a new version. Please try again.' },
        { status: 502 },
      );
    }

    const options =
      obj.options && Array.isArray(obj.options) ? (obj.options as string[]) : undefined;

    const saved = await db.question.create({
      data: {
        courseId: original.courseId || null,
        slideId: original.slideId || null,
        type: (obj.type as string) || type,
        question: obj.question as string,
        options: options ? JSON.stringify(options) : null,
        answer: obj.answer as string,
        explanation: (obj.explanation as string) || null,
        difficulty: (obj.difficulty as string) || difficulty,
        concept: (obj.concept as string) || original.concept || null,
      },
    });

    return NextResponse.json({
      success: true,
      question: {
        id: saved.id,
        courseId: saved.courseId ?? undefined,
        slideId: saved.slideId ?? undefined,
        type: saved.type,
        question: saved.question,
        options,
        answer: saved.answer,
        explanation: saved.explanation ?? undefined,
        difficulty: saved.difficulty,
        concept: saved.concept ?? undefined,
      },
    });
  } catch (error) {
    const mapped = llmErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('[/api/questions/regenerate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate question. Please try again.' },
      { status: 500 },
    );
  }
}
