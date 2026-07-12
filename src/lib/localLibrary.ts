'use client';

/**
 * Local-first course library (docs/ROADMAP.md Phase 2): the learner's courses
 * and slides live in THEIR browser (IndexedDB), not in the shared database.
 * The shared DB keeps only system data. Raw IndexedDB — no dependencies.
 *
 * Courses created locally get ids prefixed "local-" so every code path can
 * tell them apart from legacy server courses.
 */
import type { Course, Slide } from '@/types';

const DB_NAME = 'synapse-library';
const DB_VERSION = 2; // v2 adds the 'docs' store (structured documents + ALUs)

export function isLocalCourse(courseId: string): boolean {
  return courseId.startsWith('local-');
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('slides')) {
        const slides = db.createObjectStore('slides', { keyPath: 'id' });
        slides.createIndex('courseId', 'courseId', { unique: false });
      }
      // Index store (task 27, C9/R1): structured documents + ALUs, keyed by
      // courseId. The learner's index NEVER goes to the shared DB.
      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'courseId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(run: (db: IDBDatabase) => Promise<T>): Promise<T> {
  return openDb().then((db) =>
    run(db).finally(() => {
      db.close();
    }),
  );
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalCourse(course: Course, slides: Slide[]): Promise<void> {
  await tx(async (db) => {
    const t = db.transaction(['courses', 'slides'], 'readwrite');
    t.objectStore('courses').put(course);
    const slideStore = t.objectStore('slides');
    for (const slide of slides) slideStore.put(slide);
    return new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  });
}

export async function listLocalCourses(): Promise<Course[]> {
  try {
    return await tx(async (db) => {
      const req = db.transaction('courses').objectStore('courses').getAll();
      const all = await requestToPromise(req);
      return (all as Course[]).sort((a, b) =>
        String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
      );
    });
  } catch {
    return [];
  }
}

export async function getLocalSlides(courseId: string): Promise<Slide[]> {
  try {
    return await tx(async (db) => {
      const idx = db.transaction('slides').objectStore('slides').index('courseId');
      const all = await requestToPromise(idx.getAll(courseId));
      return (all as Slide[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
  } catch {
    return [];
  }
}

export async function deleteLocalCourse(courseId: string): Promise<void> {
  // Deleting a course removes every trace of it in this browser
  try {
    localStorage.removeItem(`synapse-course-chat-${courseId}`);
    localStorage.removeItem(`synapse-qcache-${courseId}`);
  } catch { /* ignore */ }
  await tx(async (db) => {
    const t = db.transaction(['courses', 'slides', 'docs'], 'readwrite');
    t.objectStore('courses').delete(courseId);
    t.objectStore('docs').delete(courseId);
    const idx = t.objectStore('slides').index('courseId');
    const keysReq = idx.getAllKeys(courseId);
    keysReq.onsuccess = () => {
      for (const key of keysReq.result) t.objectStore('slides').delete(key);
    };
    return new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  });
}

/** Full course text ("## title\ncontent" per slide) for question generation. */
export async function getLocalCourseContent(courseId: string): Promise<string> {
  const slides = await getLocalSlides(courseId);
  return slides.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');
}

// ─── Structured document + ALU store (tasks 27/30, C9/C10, rule R1) ─────────

export interface LocalDocRecord {
  courseId: string;
  structuredDoc?: unknown; // StructuredDocument from lib/document/normalizer
  alus?: unknown[]; // AtomicLearningUnit[] from lib/document/alu
  updatedAt: string;
}

export async function saveLocalDoc(record: Omit<LocalDocRecord, 'updatedAt'>): Promise<void> {
  try {
    await tx(async (db) => {
      const t = db.transaction('docs', 'readwrite');
      const existing = await requestToPromise(t.objectStore('docs').get(record.courseId)).catch(() => null);
      t.objectStore('docs').put({
        ...(existing as LocalDocRecord | null ?? {}),
        ...record,
        updatedAt: new Date().toISOString(),
      });
      return new Promise<void>((resolve, reject) => {
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    });
  } catch (err) {
    console.warn('[localLibrary] saveLocalDoc failed:', err);
  }
}

export async function getLocalDoc(courseId: string): Promise<LocalDocRecord | null> {
  try {
    return await tx(async (db) => {
      const req = db.transaction('docs').objectStore('docs').get(courseId);
      return ((await requestToPromise(req)) as LocalDocRecord) ?? null;
    });
  } catch {
    return null;
  }
}
