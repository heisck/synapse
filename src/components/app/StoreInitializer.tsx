'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Trophy } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { usePresence } from '@/hooks/usePresence';
import { listLocalCourses } from '@/lib/localLibrary';

export function StoreInitializer() {
  const { setCourses, courses, achievements } = useAppStore();
  const prevAchievementsRef = useRef<Record<string, string | null>>({});

  // Restore persisted session state from localStorage
  useSessionPersistence();

  // Report this instance to the presence backend + pull live peers
  usePresence();

  // Track previous achievements to detect unlocks
  useEffect(() => {
    const currentMap: Record<string, string | null> = {};
    const prevMap = prevAchievementsRef.current;

    for (const a of achievements) {
      currentMap[a.id] = a.unlockedAt;

      // Detect newly unlocked: was null, now has a value, and wasn't already tracked as unlocked
      const wasUnlocked = prevMap[a.id] !== null && prevMap[a.id] !== undefined;
      const isNowUnlocked = a.unlockedAt !== null;

      if (isNowUnlocked && !wasUnlocked && Object.keys(prevMap).length > 0) {
        toast(
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-500">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Achievement Unlocked!</p>
              <p className="mt-0.5 text-sm font-medium text-emerald-100">{a.title}</p>
              <p className="mt-0.5 text-xs text-emerald-200/80">{a.description}</p>
            </div>
          </div>,
          {
            duration: 6000,
            style: {
              background: 'linear-gradient(135deg, #059669, #0d9488)',
              border: 'none',
              color: 'white',
              borderRadius: '0.75rem',
              padding: '0.875rem 1rem',
            },
            unstyled: true,
          }
        );
      }
    }

    prevAchievementsRef.current = currentMap;
  }, [achievements]);

  useEffect(() => {
    if (courses.length > 0) return;

    const fetchCourses = async () => {
      // Local-first ONLY (ROADMAP Phase 2): a new browser is a clean slate.
      // The shared DB is never consulted for courses — not a grain of one
      // learner's content ever shows up on another device.
      const local = await listLocalCourses();
      if (local.length > 0) setCourses(local);
    };

    fetchCourses();
  }, [courses.length, setCourses]);

  return null;
}