import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const learnerProfileSchema = z.object({
  learningStyle: z.enum(['visual', 'auditory', 'reading', 'kinesthetic']).default('reading'),
  pace: z.enum(['slow', 'steady', 'fast']).default('steady'),
  vocabularySensitive: z.boolean().default(true),
  prefersStory: z.boolean().default(true),
  prefersBigPicture: z.boolean().default(false),
  simpleGrammar: z.boolean().default(false),
  jargonTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
  masteryApproach: z.enum(['evidence', 'self-reported']).default('evidence'),
});

// Default profile values
const DEFAULT_PROFILE = {
  learningStyle: 'reading',
  pace: 'steady',
  vocabularySensitive: true,
  prefersStory: true,
  prefersBigPicture: false,
  simpleGrammar: false,
  jargonTolerance: 'medium',
  masteryApproach: 'evidence',
} as const;

// GET: Fetch or create learner profile
export async function GET() {
  try {
    let profile = await db.learnerProfile.findFirst();

    if (!profile) {
      profile = await db.learnerProfile.create({ data: { ...DEFAULT_PROFILE } });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('[/api/learner GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learner profile.' },
      { status: 500 },
    );
  }
}

// PUT: Upsert learner profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = learnerProfileSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid profile data.' },
        { status: 400 },
      );
    }

    const existing = await db.learnerProfile.findFirst();

    let profile;
    if (existing) {
      profile = await db.learnerProfile.update({
        where: { id: existing.id },
        data: parsed.data,
      });
    } else {
      profile = await db.learnerProfile.create({ data: parsed.data });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('[/api/learner PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update learner profile.' },
      { status: 500 },
    );
  }
}