import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE: Remove a single slide
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const existing = await db.slide.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Slide not found.' }, { status: 404 });
    }

    await db.slide.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/slides/[id] DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete slide. Please try again.' },
      { status: 500 },
    );
  }
}
