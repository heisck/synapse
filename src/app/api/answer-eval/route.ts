/**
 * Semantic written-answer evaluation (UNIFIED-PLAN task 62).
 *
 * POST { question, expected, answer } → { correct, feedback }
 *
 * Typed answers are graded on MEANING, not verbatim text: the fast role
 * judges whether the learner's answer carries the key ideas of the expected
 * answer, and names what's missing when it doesn't. Deterministic guards
 * wrap the model: trivially-matching answers short-circuit to correct, and
 * a model failure falls back to "incorrect but unpenalized feedback" rather
 * than blocking the quiz.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LLM, authFromRequest, llmErrorResponse } from '@/lib/ai';

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function POST(request: NextRequest) {
  try {
    const auth = authFromRequest(request);
    const body = await request.json();
    const question = String(body.question ?? '').slice(0, 600);
    const expected = String(body.expected ?? '').slice(0, 300);
    const answer = String(body.answer ?? '').slice(0, 600);

    if (!question || !expected || !answer.trim()) {
      return NextResponse.json({ error: 'question, expected and answer are required' }, { status: 400 });
    }

    // Deterministic short-circuit: exact/contained match needs no model
    const nExpected = normalize(expected);
    const nAnswer = normalize(answer);
    if (nAnswer === nExpected || (nExpected.length > 6 && nAnswer.includes(nExpected))) {
      return NextResponse.json({ correct: true, feedback: '' });
    }

    const result = await LLM.chatAs('fast', {
      messages: [
        {
          role: 'system',
          content: `You grade a learner's typed answer by MEANING, never exact wording.

QUESTION: ${question}
EXPECTED ANSWER (reference): ${expected}
LEARNER'S ANSWER: ${answer}

Mark correct when the learner's answer contains the key idea(s) of the expected answer, even with different words, spelling slips, or extra detail. Mark incorrect when a key idea is missing or wrong.

Respond with ONLY one line of valid JSON:
{"correct":true|false,"feedback":"<empty string when correct; when incorrect, ONE short sentence naming the missing/incorrect idea — never reveal the full expected answer verbatim>"}`,
        },
        { role: 'user', content: 'Grade it now. Output only the JSON line.' },
      ],
      auth,
    });

    const raw = result?.choices?.[0]?.message?.content ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          correct: parsed.correct === true,
          feedback: typeof parsed.feedback === 'string' ? parsed.feedback.slice(0, 300) : '',
        });
      } catch {
        // fall through
      }
    }
    // Model unavailable/unparseable: honest fallback — not correct, but say why gently
    return NextResponse.json({ correct: false, feedback: 'Could not verify the answer automatically — compare it with the explanation.' });
  } catch (error) {
    const mapped = llmErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('[/api/answer-eval] Error:', error);
    return NextResponse.json({ correct: false, feedback: 'Could not verify the answer automatically.' }, { status: 200 });
  }
}
