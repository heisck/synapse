import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db';

// Self-heal: the dev server may hold a Prisma client instantiated before the
// Presence model existed (cached on globalThis across hot reloads). If so,
// mint a fresh client from the regenerated package.
let healedClient: PrismaClient | null = null;
function presenceDb(): PrismaClient {
  if ((db as PrismaClient).presence) return db as PrismaClient;
  if (!healedClient) healedClient = new PrismaClient();
  return healedClient;
}

// An instance counts as online if it heartbeat within this window.
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
// Instances quiet for longer than this are pruned entirely.
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Heartbeat: a client instance reports the stats it keeps in its own browser.
 * The server never stores learning content — only enough for instances to
 * discover each other (name, XP, streak, current topic).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const instanceId = String(body.instanceId || '').slice(0, 64);
    if (!instanceId) {
      return NextResponse.json({ success: false, error: 'instanceId required' }, { status: 400 });
    }

    const clampInt = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
    const data = {
      displayName: String(body.displayName || '').slice(0, 60),
      avatarGradient: String(body.avatarGradient || 'from-emerald-400 to-teal-500').slice(0, 80),
      totalXP: clampInt(body.totalXP, 100_000_000),
      weeklyXP: clampInt(body.weeklyXP, 100_000_000),
      level: clampInt(body.level, 50),
      streak: clampInt(body.streak, 100_000),
      coursesCompleted: clampInt(body.coursesCompleted, 100_000),
      quizAccuracy: clampInt(body.quizAccuracy, 100),
      currentTopic: String(body.currentTopic || '').slice(0, 120),
      lastSeen: new Date(),
    };

    const client = presenceDb();
    await client.presence.upsert({
      where: { instanceId },
      update: data,
      create: { instanceId, ...data },
    });

    // Opportunistic prune of long-dead instances
    await client.presence.deleteMany({
      where: { lastSeen: { lt: new Date(Date.now() - PRUNE_AFTER_MS) } },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[presence] heartbeat failed:', err);
    return NextResponse.json({ success: false, error: 'heartbeat failed' }, { status: 500 });
  }
}

/** Returns the live leaderboard of known instances, most XP first. */
export async function GET(req: NextRequest) {
  try {
    const exclude = req.nextUrl.searchParams.get('exclude') || '';
    const rows = await presenceDb().presence.findMany({
      where: exclude ? { instanceId: { not: exclude } } : undefined,
      orderBy: { totalXP: 'desc' },
      take: 100,
    });

    const now = Date.now();
    const peers = rows.map((r) => ({
      id: r.instanceId,
      name: r.displayName || 'Learner',
      avatarGradient: r.avatarGradient,
      totalXP: r.totalXP,
      weeklyXP: r.weeklyXP,
      level: r.level,
      streak: r.streak,
      coursesCompleted: r.coursesCompleted,
      quizAccuracy: r.quizAccuracy,
      currentTopic: r.currentTopic,
      isOnline: now - r.lastSeen.getTime() <= ONLINE_WINDOW_MS,
      lastSeen: r.lastSeen.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      peers,
      onlineCount: peers.filter((p) => p.isOnline).length,
    });
  } catch (err) {
    console.error('[presence] list failed:', err);
    return NextResponse.json({ success: false, peers: [], onlineCount: 0 }, { status: 500 });
  }
}
