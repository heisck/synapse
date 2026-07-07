import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const createCourseSchema = z.object({
  title: z.string().min(1, 'Course title is required').max(200),
  description: z.string().max(2000).default(''),
  subject: z.string().max(100).default(''),
  thumbnail: z.string().max(500).optional(),
});

// GET: Fetch all courses with counts
export async function GET() {
  try {
    const courses = await db.course.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            slides: true,
            enrollments: true,
            sessions: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, courses });
  } catch (error) {
    console.error('[/api/courses GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses.' },
      { status: 500 },
    );
  }
}

// POST: Create a new course
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createCourseSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid input.' },
        { status: 400 },
      );
    }

    const { title, description, subject, thumbnail } = parsed.data;

    const course = await db.course.create({
      data: {
        title,
        description,
        subject,
        thumbnail,
      },
    });

    return NextResponse.json({ success: true, course }, { status: 201 });
  } catch (error) {
    console.error('[/api/courses POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create course. Please try again.' },
      { status: 500 },
    );
  }
}