/**
 * System Intelligence review endpoint (UNIFIED-PLAN task 16, rule R2/D31).
 *
 * GET    — list live strategies (with effectiveness counters) + pending suggestions
 * POST   — { action: "seed" } inserts the built-in default strategies (idempotent)
 * PATCH  — { id, decision: "approve"|"reject", note? } promotes/rejects a suggestion
 *
 * This is the ONLY path from ai_suggestions into the live strategy tables, and
 * it is human-invoked. Models cannot reach it: nothing in the AI call graph
 * links here, and promotion re-validates content in code (see strategy.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { promoteSuggestion, seedDefaults } from '@/lib/strategy';

export async function GET() {
  const [strategies, suggestions] = await Promise.all([
    db.promptStrategy.findMany({ orderBy: [{ scope: 'asc' }, { slot: 'asc' }] }),
    db.aiSuggestion.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);
  return NextResponse.json({
    strategies: strategies.map((s) => ({
      ...s,
      passRate: s.uses > 0 ? Math.round((s.passCount / s.uses) * 100) : null,
    })),
    pendingSuggestions: suggestions,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'seed') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  let created = 0;
  for (const d of seedDefaults()) {
    const existing = await db.promptStrategy.findUnique({ where: { name: d.name } });
    if (!existing) {
      await db.promptStrategy.create({ data: d });
      created++;
    }
  }
  return NextResponse.json({ ok: true, created });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { id, decision, note } = body as { id?: string; decision?: string; note?: string };
  if (!id || (decision !== 'approve' && decision !== 'reject')) {
    return NextResponse.json({ error: 'Expected { id, decision: "approve"|"reject" }' }, { status: 400 });
  }
  const result = await promoteSuggestion(id, decision, note);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true });
}
