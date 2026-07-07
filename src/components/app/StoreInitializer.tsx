'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import type { Course } from '@/types';

export function StoreInitializer() {
  const { setCourses, courses } = useAppStore();

  // Restore persisted session state from localStorage
  useSessionPersistence();

  useEffect(() => {
    if (courses.length > 0) return;

    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/courses');
        if (res.ok) {
          const data: Course[] = await res.json();
          setCourses(data);
        }
      } catch {
        // silently fail — dashboard handles empty state
      }
    };

    fetchCourses();
  }, [courses.length, setCourses]);

  return null;
}