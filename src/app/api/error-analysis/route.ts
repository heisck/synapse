import { NextRequest, NextResponse } from 'next/server';
import { LLM, authFromRequest, llmErrorResponse } from '@/lib/ai';
import { z } from 'zod';

// --- In-memory rate limiter (10 req/min per IP) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const wrongAnswerSchema = z.object({
  question: z.string().max(1000),
  userAnswer: z.string().max(500),
  correctAnswer: z.string().max(500),
  concept: z.string().max(100),
});

const errorAnalysisSchema = z.object({
  wrongAnswers: z.array(wrongAnswerSchema).min(1).max(50),
  learnerProfile: z
    .object({
      learningStyle: z.enum(['visual', 'auditory', 'reading', 'kinesthetic']).optional(),
      pace: z.enum(['slow', 'steady', 'fast']).optional(),
      vocabularySensitive: z.boolean().optional(),
      prefersStory: z.boolean().optional(),
      prefersBigPicture: z.boolean().optional(),
      simpleGrammar: z.boolean().optional(),
      jargonTolerance: z.enum(['low', 'medium', 'high']).optional(),
      masteryApproach: z.enum(['evidence', 'self-reported']).optional(),
    })
    .optional(),
});

interface ErrorAnalysisResponse {
  summary: string;
  errorPatterns: Array<{
    pattern: string;
    frequency: number;
    severity: 'low' | 'medium' | 'high';
    concepts: string[];
  }>;
  weakAreas: Array<{
    concept: string;
    masteryEstimate: number;
    errorType: 'misconception' | 'partial' | 'vocabulary' | 'careless' | 'gap';
    remediation: string;
    resources: string[];
  }>;
  studyPriority: string[];
  encouragement: string;
}

const FALLBACK_REPORT: ErrorAnalysisResponse = {
  summary:
    'Based on the incorrect answers, there are a few areas that need attention. Focused review of the concepts below will help strengthen understanding.',
  errorPatterns: [
    {
      pattern: 'Conceptual misunderstanding of fundamental principles',
      frequency: 1,
      severity: 'medium',
      concepts: ['General Review Needed'],
    },
  ],
  weakAreas: [
    {
      concept: 'Review Topic',
      masteryEstimate: 2,
      errorType: 'gap',
      remediation:
        'Revisit the core material for this topic. Start with foundational definitions and work up to application-level problems.',
      resources: ['Textbook review', 'Practice problems', 'Study group discussion'],
    },
  ],
  studyPriority: ['Review Topic', 'Related Concepts', 'Application Practice'],
  encouragement:
    'Every mistake is an opportunity to learn something new. Focus on understanding the "why" behind each answer, and you will see improvement quickly.',
};

function buildSystemPrompt(
  wrongAnswersCount: number,
  hasLearnerProfile: boolean,
): string {
  return `You are an expert learning analyst and educational psychologist. Analyze a student's wrong quiz answers to produce a detailed weakness report.

STUDENT CONTEXT:
- Total wrong answers to analyze: ${wrongAnswersCount}
${hasLearnerProfile ? '- Learner profile is available for personalized analysis' : '- No learner profile available, use general analysis'}

INSTRUCTIONS:
1. **Summary**: Write a 2-3 sentence overall assessment of the student's weaknesses. Be honest but constructive.
2. **Error Patterns**: Identify 2-5 recurring error patterns across the wrong answers. For each pattern:
   - "pattern": Clear description of the error pattern
   - "frequency": How many questions exhibit this pattern (integer)
   - "severity": "low", "medium", or "high"
   - "concepts": Array of concept names affected by this pattern
3. **Weak Areas**: For each distinct weak concept area:
   - "concept": The concept name
   - "masteryEstimate": Estimated mastery level 1-5 (1=very weak, 5=near mastery)
   - "errorType": One of: "misconception" (wrong mental model), "partial" (incomplete knowledge), "vocabulary" (terminology confusion), "careless" (calculation/reading error), "gap" (missing prerequisite knowledge)
   - "remediation": Specific, actionable study recommendation (2-3 sentences)
   - "resources": Array of 2-3 suggested study resource types (e.g., "Video tutorial on X", "Practice problems for Y")
4. **Study Priority**: Ordered list (most urgent first) of 3-5 specific topics/concepts to study.
5. **Encouragement**: A brief, motivating message (1-2 sentences) to keep the student engaged.

IMPORTANT: Return ONLY valid JSON matching this exact structure. No markdown, no explanation outside the JSON.
{
  "summary": "Overall assessment",
  "errorPatterns": [
    { "pattern": "Description", "frequency": 3, "severity": "high", "concepts": ["Concept1"] }
  ],
  "weakAreas": [
    { "concept": "Concept name", "masteryEstimate": 2, "errorType": "misconception", "remediation": "Study recommendation", "resources": ["Resource1"] }
  ],
  "studyPriority": ["Concept 1", "Concept 2", "Concept 3"],
  "encouragement": "Motivational message"
}`;
}

function buildUserMessage(
  wrongAnswers: Array<{
    question: string;
    userAnswer: string;
    correctAnswer: string;
    concept: string;
  }>,
  learnerProfile?: Record<string, unknown>,
): string {
  let msg = 'Analyze these wrong answers:\n\n';
  wrongAnswers.forEach((wa, i) => {
    msg += `Question ${i + 1}: ${wa.question}\n`;
    msg += `User answered: ${wa.userAnswer}\n`;
    msg += `Correct answer: ${wa.correctAnswer}\n`;
    msg += `Concept: ${wa.concept}\n\n`;
  });

  if (learnerProfile) {
    msg += `\nLearner Profile:\n${JSON.stringify(learnerProfile, null, 2)}\n`;
  }

  return msg;
}

function parseAIResponse(rawContent: string): ErrorAnalysisResponse | null {
  // Try to extract JSON from markdown code blocks
  let jsonStr = rawContent.trim();
  const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try direct parse
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.summary && parsed.weakAreas && parsed.studyPriority) {
      return parsed as ErrorAnalysisResponse;
    }
  } catch {
    // Continue to fallback attempts
  }

  // Try to find JSON object in the response
  const objectMatch = rawContent.match(/\{[\s\S]*"summary"[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed.summary && parsed.weakAreas && parsed.studyPriority) {
        return parsed as ErrorAnalysisResponse;
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = errorAnalysisSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid input. Please provide valid wrong answers.',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { wrongAnswers, learnerProfile } = parsed.data;

    const systemPrompt = buildSystemPrompt(
      wrongAnswers.length,
      !!learnerProfile,
    );
    const userMessage = buildUserMessage(wrongAnswers, learnerProfile);

    const result = await LLM.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      auth: authFromRequest(request),
    });

    if (!result?.choices?.[0]?.message?.content) {
      return NextResponse.json(FALLBACK_REPORT);
    }

    const rawContent = result.choices[0].message.content;
    const parsedResponse = parseAIResponse(rawContent);

    if (parsedResponse) {
      return NextResponse.json(parsedResponse);
    }

    // Return fallback if AI response can't be parsed
    return NextResponse.json(FALLBACK_REPORT);
  } catch (error) {
    const mapped = llmErrorResponse(error);
    if (mapped) return NextResponse.json(mapped.body, { status: mapped.status });
    console.error('[/api/error-analysis] Error:', error);
    return NextResponse.json(FALLBACK_REPORT);
  }
}