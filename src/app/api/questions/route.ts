import { NextRequest, NextResponse } from 'next/server';
import { LLM } from '@/lib/ai';
import { buildQuizGenPrompt } from '@/lib/prompts';
import { db } from '@/lib/db';
import type { Question } from '@prisma/client';

function toClientQuestion(q: { options: string | null } & Record<string, unknown>) {
  return {
    ...q,
    options: q.options ? JSON.parse(q.options) : undefined,
  };
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

async function generateQuestions(content: string): Promise<unknown[]> {
  const promptVariants = [
    buildQuizGenPrompt('General', 'Content Analysis', 'medium', 'multiple_choice'),
    `Based on this educational content, generate quiz questions in valid JSON array format.

Content:
"""
${content.slice(0, 3000)}
"""

Generate 3-5 questions. Each question must be a JSON object with:
- "question": the question text
- "type": "multiple_choice"
- "options": array of 4 options
- "answer": the correct option
- "explanation": why this is correct
- "concept": the concept being tested
- "difficulty": "easy" | "medium" | "hard"

Respond ONLY with a valid JSON array, no other text.`,
    `Create a quiz from this material. Output ONLY a JSON array of question objects.

Material:
${content.slice(0, 3000)}

Each object: { "question", "type": "multiple_choice", "options": ["A","B","C","D"], "answer", "explanation", "concept", "difficulty" }`,
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    const prompt = promptVariants[attempt];
    const result = await LLM.chat({
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: 'Generate the quiz questions now. Output only valid JSON.',
        },
      ],
    });

    const raw = result?.choices?.[0]?.message?.content;
    if (!raw) continue;

    // Try direct parse
    let parsed = tryParseJSON(raw);
    if (parsed && Array.isArray(parsed)) return parsed;

    // Try extracting JSON from markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = tryParseJSON(jsonMatch[1].trim());
      if (parsed && Array.isArray(parsed)) return parsed;
    }

    // Try finding array brackets
    const bracketMatch = raw.match(/\[[\s\S]*\]/);
    if (bracketMatch) {
      parsed = tryParseJSON(bracketMatch[0]);
      if (parsed && Array.isArray(parsed)) return parsed;
    }
  }

  return [];
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
      content = slides.map((s) => s.content).join('\n\n');
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'No content provided to generate questions from.' },
        { status: 400 },
      );
    }

    const questions = await generateQuestions(content);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate questions. Please try with different content.' },
        { status: 502 },
      );
    }

    // Save questions to database if courseId is provided
    const savedQuestions: Question[] = [];
    for (const q of questions) {
      const question = q as Record<string, unknown>;
      const saved = await db.question.create({
        data: {
          courseId: courseId || null,
          slideId: slideId || null,
          type: (question.type as string) || 'multiple_choice',
          question: (question.question as string) || '',
          options: question.options ? JSON.stringify(question.options) : null,
          answer: (question.answer as string) || '',
          explanation: (question.explanation as string) || null,
          difficulty: (question.difficulty as string) || 'medium',
          concept: (question.concept as string) || null,
        },
      });
      savedQuestions.push(saved);
    }

    return NextResponse.json({
      success: true,
      questions: savedQuestions.map(toClientQuestion),
    });
  } catch (error) {
    console.error('[/api/questions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate questions. Please try again.' },
      { status: 500 },
    );
  }
}