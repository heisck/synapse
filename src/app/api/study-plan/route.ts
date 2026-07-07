import { NextRequest, NextResponse } from 'next/server';
import { LLM } from '@/lib/ai';
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

const studyPlanSchema = z.object({
  topics: z.array(z.string().max(100)).min(1).max(5),
  hoursPerWeek: z.number().int().min(1).max(20),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  goals: z.array(z.string().max(200)).max(3),
  preferences: z.object({
    pace: z.string().max(50),
    style: z.string().max(50),
  }),
});

const FALLBACK_PLAN = {
  plan: {
    overview:
      'A balanced weekly study plan designed to build foundational knowledge through structured sessions of learning, practice, and review.',
    totalHours: 10,
    days: [
      {
        day: 'Monday',
        title: 'Foundation Building',
        sessions: [
          {
            topic: 'Core Concepts',
            duration: 45,
            type: 'learn',
            description: 'Study the fundamental principles and key terminology.',
            resources: ['Textbook Chapter 1', 'Online tutorial videos'],
          },
        ],
      },
      {
        day: 'Tuesday',
        title: 'Active Practice',
        sessions: [
          {
            topic: 'Problem Solving',
            duration: 30,
            type: 'practice',
            description: 'Apply concepts through guided exercises.',
            resources: ['Practice problem sets'],
          },
        ],
      },
      {
        day: 'Wednesday',
        title: 'Deep Dive',
        sessions: [
          {
            topic: 'Advanced Topics',
            duration: 45,
            type: 'learn',
            description: 'Explore more complex material and edge cases.',
            resources: ['Research papers', 'Advanced guides'],
          },
        ],
      },
      {
        day: 'Thursday',
        title: 'Review & Reinforce',
        sessions: [
          {
            topic: 'Weekly Review',
            duration: 30,
            type: 'review',
            description: 'Revisit material from the first half of the week.',
            resources: ['Flashcards', 'Summary notes'],
          },
        ],
      },
      {
        day: 'Friday',
        title: 'Knowledge Check',
        sessions: [
          {
            topic: 'Self-Assessment',
            duration: 30,
            type: 'quiz',
            description: 'Test your understanding with practice questions.',
            resources: ['Practice quiz', 'Past exam questions'],
          },
        ],
      },
      {
        day: 'Saturday',
        title: 'Exploration',
        sessions: [
          {
            topic: 'Related Topics',
            duration: 45,
            type: 'learn',
            description: 'Explore related subjects to broaden understanding.',
            resources: ['Documentaries', 'Supplementary reading'],
          },
        ],
      },
      {
        day: 'Sunday',
        title: 'Light Review',
        sessions: [
          {
            topic: 'Weekly Recap',
            duration: 20,
            type: 'review',
            description: 'Quick review of the week and prepare for next week.',
            resources: ['Personal notes', 'Mind maps'],
          },
        ],
      },
    ],
    milestones: [
      'Complete foundational concepts by end of week 1',
      'Achieve 80% on practice quiz by end of week 2',
      'Apply knowledge to a real-world project by end of month',
    ],
    tips: [
      'Use spaced repetition for key terms and definitions.',
      'Teach concepts to someone else to solidify understanding.',
      'Take regular breaks using the Pomodoro technique.',
    ],
  },
};

function buildSystemPrompt(
  topics: string[],
  hoursPerWeek: number,
  level: string,
  goals: string[],
  preferences: { pace: string; style: string },
): string {
  return `You are an expert study planner and learning science specialist. Create a personalized weekly study plan for a student.

STUDENT CONTEXT:
- Topics to study: ${topics.join(', ')}
- Available hours per week: ${hoursPerWeek}
- Current level: ${level}
- Goals: ${goals.length > 0 ? goals.join('; ') : 'General understanding and retention'}
- Preferred pace: ${preferences.pace}
- Preferred learning style: ${preferences.style}

INSTRUCTIONS:
1. Distribute the ${hoursPerWeek} hours across 7 days (Monday-Sunday). Some days can have 0 sessions (rest days).
2. Each day should have a clear title and 1-3 sessions.
3. Each session must include: topic, duration (minutes), type (one of: "learn", "practice", "review", "quiz"), description, and suggested resources.
4. Include 3-5 milestones the student should aim for.
5. Include 3-5 practical study tips.
6. The overview should be 2-3 sentences summarizing the plan.

IMPORTANT: Return ONLY valid JSON matching this exact structure. No markdown, no explanation outside the JSON.
{
  "plan": {
    "overview": "2-3 sentence summary",
    "totalHours": <number>,
    "days": [
      {
        "day": "Monday",
        "title": "Day title",
        "sessions": [
          {
            "topic": "Topic name",
            "duration": 45,
            "type": "learn|practice|review|quiz",
            "description": "What to study",
            "resources": ["suggested resource"]
          }
        ]
      }
    ],
    "milestones": ["Milestone 1", "Milestone 2"],
    "tips": ["Study tip 1", "Study tip 2"]
  }
}`;
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
    const parsed = studyPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input. Please check your selections.', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { topics, hoursPerWeek, level, goals, preferences } = parsed.data;

    const systemPrompt = buildSystemPrompt(
      topics,
      hoursPerWeek,
      level,
      goals,
      preferences,
    );

    const userMessage = `Create a weekly study plan for: ${topics.join(', ')}. Level: ${level}. Hours available: ${hoursPerWeek}/week. Goals: ${goals.length > 0 ? goals.join('; ') : 'General mastery'}. Pace: ${preferences.pace}. Style: ${preferences.style}.`;

    const result = await LLM.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    if (!result?.choices?.[0]?.message?.content) {
      return NextResponse.json(FALLBACK_PLAN);
    }

    // Try to parse the AI response as JSON
    const rawContent = result.choices[0].message.content.trim();

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsedPlan = JSON.parse(jsonStr);
      if (parsedPlan.plan && parsedPlan.plan.days) {
        return NextResponse.json(parsedPlan);
      }
    } catch {
      // If parsing fails, try to find JSON object in the response
      const objectMatch = rawContent.match(/\{[\s\S]*"plan"[\s\S]*\}/);
      if (objectMatch) {
        try {
          const parsedPlan = JSON.parse(objectMatch[0]);
          if (parsedPlan.plan && parsedPlan.plan.days) {
            return NextResponse.json(parsedPlan);
          }
        } catch {
          // Fall through to fallback
        }
      }
    }

    // Return fallback plan if AI response can't be parsed
    return NextResponse.json(FALLBACK_PLAN);
  } catch (error) {
    console.error('[/api/study-plan] Error:', error);
    return NextResponse.json(FALLBACK_PLAN);
  }
}