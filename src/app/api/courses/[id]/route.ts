import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: Fetch a single course with its slides
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const course = await db.course.findUnique({
      where: { id },
      include: {
        slides: { orderBy: { order: 'asc' } },
        _count: { select: { slides: true, enrollments: true, sessions: true } },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, course });
  } catch (error) {
    console.error('[/api/courses/[id] GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course.' },
      { status: 500 },
    );
  }
}

// DELETE: Remove a course and its slides/enrollments (cascading per schema)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    await db.course.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/courses/[id] DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete course. Please try again.' },
      { status: 500 },
    );
  }
}
