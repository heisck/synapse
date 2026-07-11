'use client';

/**
 * BYO cloud sync (docs/ROADMAP.md Phase 3): talks to the LEARNER'S OWN Turso/
 * libsql database straight from the browser using their saved credentials.
 * The platform never sees the data or the keys — one person, one account,
 * living on their device, or in their own cloud once they connect it.
 *
 * Data model is deliberately simple: JSON blobs keyed by id, so schema
 * changes in the app never need a migration in the learner's database.
 */
import { createClient, type Client } from '@libsql/client/web';
import { getByoStorage } from './byoStorage';
import { listLocalCourses, getLocalSlides, saveLocalCourse } from './localLibrary';
import type { Course, Slide } from '@/types';

export function hasByoDb(): boolean {
  const cfg = getByoStorage();
  return !!cfg.dbUrl && !!cfg.dbAuthToken;
}

function client(): Client {
  const cfg = getByoStorage();
  if (!cfg.dbUrl || !cfg.dbAuthToken) throw new Error('No database configured in Settings → Your Storage.');
  return createClient({ url: cfg.dbUrl, authToken: cfg.dbAuthToken });
}

async function ensureSchema(db: Client): Promise<void> {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS synapse_courses (id TEXT PRIMARY KEY, data TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS synapse_slides (id TEXT PRIMARY KEY, courseId TEXT NOT NULL, data TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS synapse_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  ], 'write');
}

/** localStorage keys worth carrying to the learner's own cloud. */
const KV_PREFIXES = [
  'synapse-qcache-',
  'synapse-course-chat-',
  'synapse-answered-questions',
  'synapse-exam-history',
  'synapse-bookmarked-questions',
  'synapse-adaptive-results',
  'synapse-notes',
  'synapse-goals',
];

export interface MigrationResult {
  courses: number;
  slides: number;
  kvEntries: number;
}

/** Push everything in this browser (courses, slides, caches, notes) to the learner's DB. */
export async function migrateBrowserToCloud(): Promise<MigrationResult> {
  const db = client();
  await ensureSchema(db);

  const courses = await listLocalCourses();
  let slideCount = 0;
  for (const course of courses) {
    const slides = await getLocalSlides(course.id);
    slideCount += slides.length;
    await db.execute({
      sql: `INSERT INTO synapse_courses (id, data, updatedAt) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
      args: [course.id, JSON.stringify(course), new Date().toISOString()],
    });
    for (const slide of slides) {
      await db.execute({
        sql: `INSERT INTO synapse_slides (id, courseId, data) VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        args: [slide.id, course.id, JSON.stringify(slide)],
      });
    }
  }

  let kvEntries = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !KV_PREFIXES.some((p) => key === p || key.startsWith(p))) continue;
    const value = localStorage.getItem(key);
    if (value == null) continue;
    await db.execute({
      sql: `INSERT INTO synapse_kv (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      args: [key, value],
    });
    kvEntries++;
  }

  return { courses: courses.length, slides: slideCount, kvEntries };
}

/** Pull courses + slides from the learner's DB into this browser's library. */
export async function pullCloudToBrowser(): Promise<number> {
  const db = client();
  await ensureSchema(db);
  const res = await db.execute(`SELECT id, data FROM synapse_courses`);
  let pulled = 0;
  for (const row of res.rows) {
    try {
      const course = JSON.parse(String(row.data)) as Course;
      const slidesRes = await db.execute({
        sql: `SELECT data FROM synapse_slides WHERE courseId = ?`,
        args: [String(row.id)],
      });
      const slides = slidesRes.rows.map((r) => JSON.parse(String(r.data)) as Slide);
      await saveLocalCourse(course, slides);
      pulled++;
    } catch {
      // one bad row shouldn't sink the rest
    }
  }
  // Restore kv entries that this browser doesn't have yet
  const kvRes = await db.execute(`SELECT key, value FROM synapse_kv`);
  for (const row of kvRes.rows) {
    const key = String(row.key);
    try {
      if (localStorage.getItem(key) == null) localStorage.setItem(key, String(row.value));
    } catch { /* quota */ }
  }
  return pulled;
}

/**
 * Wipe every trace of learner data from this browser: the IndexedDB library
 * and all synapse-* localStorage EXCEPT the credentials they explicitly want
 * to keep (API key + storage config) so the cloud copy stays reachable.
 */
export async function clearBrowserData(options?: { keepCredentials?: boolean }): Promise<void> {
  const keep = options?.keepCredentials ?? true;
  const preserved = keep ? ['synapse-openrouter-key', 'synapse-byo-storage'] : [];

  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if ((key.startsWith('synapse-') || key.startsWith('synapselearn_')) && !preserved.includes(key)) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });

  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('synapse-library');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
