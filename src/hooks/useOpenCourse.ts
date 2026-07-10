'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { getLocalSlides, isLocalCourse } from '@/lib/localLibrary';
import type { Course } from '@/types';

/**
 * Opens a course in the Course Detail view. The course list only carries
 * slide counts, not content, so this fetches the real slides first (unless
 * they're already loaded, e.g. right after uploading this same course).
 */
export function useOpenCourse() {
  const { setActiveCourse, setActiveSlides, setCurrentSlideIndex, navigate } = useAppStore();
  const [openingCourseId, setOpeningCourseId] = useState<string | null>(null);

  const openCourse = async (course: Course) => {
    if (openingCourseId) return; // already opening a course, ignore duplicate clicks

    setActiveCourse(course);
    setCurrentSlideIndex(0);

    if (course.slides && course.slides.length > 0) {
      setActiveSlides(course.slides);
      navigate('course-detail');
      return;
    }

    setOpeningCourseId(course.id);

    // Local-first courses live in this browser's IndexedDB — no network
    if (isLocalCourse(course.id)) {
      const slides = await getLocalSlides(course.id);
      setActiveSlides(slides);
      navigate('course-detail');
      setOpeningCourseId(null);
      return;
    }

    const loadingToast = toast.loading('Opening course…');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`/api/courses/${course.id}`, { signal: controller.signal });
      if (!res.ok) throw new Error('Failed to load course');
      const data = await res.json();
      setActiveCourse(data.course);
      setActiveSlides(data.course.slides || []);
      navigate('course-detail');
    } catch {
      toast.error('Failed to load this course. Please check your connection and try again.');
    } finally {
      clearTimeout(timeout);
      toast.dismiss(loadingToast);
      setOpeningCourseId(null);
    }
  };

  return { openCourse, openingCourseId };
}
