'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore, type AppState } from '@/stores/appStore';
import type { LearnerProfile, MasteryMap, ChatMessage, Course, StudyGoal, StudyNotification, AdaptiveResult } from '@/types';

const STORAGE_KEY_PREFIX = 'synapselearn_';
const KEYS = {
  messages: `${STORAGE_KEY_PREFIX}messages`,
  learnerProfile: `${STORAGE_KEY_PREFIX}learner_profile`,
  courses: `${STORAGE_KEY_PREFIX}courses`,
  masteryMap: `${STORAGE_KEY_PREFIX}mastery_map`,
  quizScore: `${STORAGE_KEY_PREFIX}quiz_score`,
  onboarding: `${STORAGE_KEY_PREFIX}onboarding`,
  userName: `${STORAGE_KEY_PREFIX}user_name`,
  userEmail: `${STORAGE_KEY_PREFIX}user_email`,
  hardSubjects: `${STORAGE_KEY_PREFIX}hard_subjects`,
  bestTeachingStyle: `${STORAGE_KEY_PREFIX}best_teaching_style`,
  alwaysConfuses: `${STORAGE_KEY_PREFIX}always_confuses`,
  activePersona: `${STORAGE_KEY_PREFIX}active_persona`,
  tutorMode: `${STORAGE_KEY_PREFIX}tutor_mode`,
  moodSettings: `${STORAGE_KEY_PREFIX}mood_settings`,
  dailyChallenge: `${STORAGE_KEY_PREFIX}daily_challenge`,
  studyGoals: 'synapse-study-goals',
  viewedSlides: 'synapse-viewed-slides',
  completedCourses: 'synapse-completed-courses',
  notifications: 'synapse-notifications',
  adaptiveResults: 'synapse-adaptive-results',
  courseCategories: 'synapse-course-categories',
} as const;

// Safely write to localStorage with quota handling
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      // Attempt to free space by clearing older non-essential data
      try {
        localStorage.removeItem(KEYS.messages);
        // Retry after freeing space
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          console.warn('[SessionPersistence] localStorage quota exceeded even after cleanup');
          return false;
        }
      } catch {
        console.warn('[SessionPersistence] Failed to handle localStorage quota');
        return false;
      }
    }
    console.warn('[SessionPersistence] Failed to write to localStorage:', err);
    return false;
  }
}

// Safely read from localStorage
function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    // Defensive: if fallback is an array, ensure parsed is also an array
    if (Array.isArray(fallback) && !Array.isArray(parsed)) {
      console.warn(`[SessionPersistence] Expected array for key "${key}", got ${typeof parsed}. Using fallback.`);
      return fallback;
    }
    // Defensive: if fallback is an object (non-null, non-array), ensure parsed matches
    if (fallback !== null && typeof fallback === 'object' && !Array.isArray(fallback)) {
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        console.warn(`[SessionPersistence] Expected object for key "${key}", got ${typeof parsed}. Using fallback.`);
        return fallback;
      }
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * Clears all SynapseLearn session data from localStorage.
 * Should be called when the user signs out.
 */
export function clearSessionStorage(): void {
  try {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  } catch {
    // localStorage may be unavailable in some environments
  }
}

/**
 * Custom hook that persists critical application state to localStorage
 * and restores it on initialization. Uses a 500ms debounce for message
 * saves to avoid excessive writes.
 */
export function useSessionPersistence(): void {
  const store = useAppStore;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoredRef = useRef(false);

  // Restore state from localStorage on first mount
  useEffect(() => {
    if (isRestoredRef.current) return;
    isRestoredRef.current = true;

    const savedMessages: ChatMessage[] = safeGetItem(KEYS.messages, []);
    const savedProfile = safeGetItem<LearnerProfile | null>(KEYS.learnerProfile, null);
    const savedCourses: Course[] = safeGetItem(KEYS.courses, []);
    const savedMasteryMap: MasteryMap = safeGetItem(KEYS.masteryMap, {});
    const savedQuizScore = safeGetItem<{ score: number; total: number } | null>(KEYS.quizScore, null);
    const savedOnboarding = safeGetItem<boolean>(KEYS.onboarding, false);
    const savedUserName: string = safeGetItem(KEYS.userName, '');
    const savedUserEmail: string = safeGetItem(KEYS.userEmail, '');
    const savedHardSubjects: string[] = safeGetItem(KEYS.hardSubjects, []);
    const savedBestTeachingStyle: string = safeGetItem(KEYS.bestTeachingStyle, '');
    const savedAlwaysConfuses: string = safeGetItem(KEYS.alwaysConfuses, '');
    const savedPersona: string = safeGetItem(KEYS.activePersona, 'storyteller');
    const savedTutorMode: 'text' | 'slide' | 'hybrid' | 'cards' = safeGetItem(KEYS.tutorMode, 'hybrid');
    const savedDailyChallenge = safeGetItem<{
      lastCompletedDate: string | null;
      streak: number;
      bestScore: number;
      totalCompleted: number;
      todayResults: { score: number; total: number; timeTaken: number; stars: number } | null;
    } | null>(KEYS.dailyChallenge, null);
    const savedMoodSettings: { energy: number; formality: number; patience: number; humor: number } = safeGetItem(KEYS.moodSettings, { energy: 50, formality: 50, patience: 70, humor: 30 });
    const savedStudyGoals: StudyGoal[] = safeGetItem(KEYS.studyGoals, []);
    const savedViewedSlides: string[] = safeGetItem(KEYS.viewedSlides, []);
    const savedCompletedCourses: string[] = safeGetItem(KEYS.completedCourses, []);
    const savedNotifications: StudyNotification[] = safeGetItem(KEYS.notifications, []);
    const savedAdaptiveResults: AdaptiveResult[] = safeGetItem(KEYS.adaptiveResults, []);
    const savedCourseCategories: Record<string, string> = safeGetItem(KEYS.courseCategories, {});

    // Only restore if there is meaningful persisted data
    const hasData =
      savedMessages.length > 0 ||
      savedProfile !== null ||
      savedCourses.length > 0 ||
      Object.keys(savedMasteryMap).length > 0 ||
      savedOnboarding ||
      savedDailyChallenge !== null ||
      savedStudyGoals.length > 0 ||
      savedViewedSlides.length > 0 ||
      savedCompletedCourses.length > 0 ||
      savedNotifications.length > 0 ||
      savedAdaptiveResults.length > 0 ||
      Object.keys(savedCourseCategories).length > 0;

    if (!hasData) return;

    // Batch all restorations into a single Zustand set call. Built as an
    // explicitly-typed variable first — passing the object literal directly
    // to setState's overloaded (state | partial | updater-fn) signature was
    // defeating contextual typing and making every conditional spread below
    // resolve to `never`.
    const restoredState: Partial<AppState> = {
      ...(savedMessages.length > 0 && { messages: savedMessages }),
      ...(savedProfile && { learnerProfile: savedProfile, onboardingComplete: true }),
      ...(savedCourses.length > 0 && { courses: savedCourses }),
      ...(Object.keys(savedMasteryMap).length > 0 && { masteryMap: savedMasteryMap }),
      ...(savedQuizScore && { quizScore: savedQuizScore.score, quizTotal: savedQuizScore.total }),
      ...(savedOnboarding && { onboardingComplete: savedOnboarding }),
      ...(savedUserName && { userName: savedUserName }),
      ...(savedUserEmail && { userEmail: savedUserEmail }),
      ...(savedHardSubjects.length > 0 && { hardSubjects: savedHardSubjects }),
      ...(savedBestTeachingStyle && { bestTeachingStyle: savedBestTeachingStyle }),
      ...(savedAlwaysConfuses && { alwaysConfuses: savedAlwaysConfuses }),
      ...(savedPersona && { activePersona: savedPersona }),
      ...(savedTutorMode && { tutorMode: savedTutorMode }),
      ...(savedDailyChallenge && { dailyChallenge: savedDailyChallenge }),
      moodSettings: savedMoodSettings,
      ...(savedStudyGoals.length > 0 && { studyGoals: savedStudyGoals }),
      ...(savedViewedSlides.length > 0 && { viewedSlides: savedViewedSlides }),
      ...(savedCompletedCourses.length > 0 && { completedCourses: savedCompletedCourses }),
      ...(savedNotifications.length > 0 && { notifications: savedNotifications }),
      ...(savedAdaptiveResults.length > 0 && { adaptiveResults: savedAdaptiveResults }),
      ...(Object.keys(savedCourseCategories).length > 0 && { courseCategories: savedCourseCategories }),
    };
    useAppStore.setState(restoredState);
  }, []);

  // Persist non-message state whenever it changes (no debounce needed)
  useEffect(() => {
    const unsubProfile = store.subscribe(
      (s) => s.learnerProfile,
      (profile) => {
        if (profile) {
          safeSetItem(KEYS.learnerProfile, JSON.stringify(profile));
        }
      },
    );

    const unsubCourses = store.subscribe(
      (s) => s.courses,
      (courses) => {
        if (courses.length > 0) {
          safeSetItem(KEYS.courses, JSON.stringify(courses));
        }
      },
    );

    const unsubMastery = store.subscribe(
      (s) => s.masteryMap,
      (masteryMap) => {
        if (Object.keys(masteryMap).length > 0) {
          safeSetItem(KEYS.masteryMap, JSON.stringify(masteryMap));
        }
      },
    );

    const unsubQuiz = store.subscribe(
      (s) => ({ score: s.quizScore, total: s.quizTotal }),
      ({ score, total }) => {
        if (score !== null && total !== null) {
          safeSetItem(KEYS.quizScore, JSON.stringify({ score, total }));
        }
      },
    );

    const unsubOnboarding = store.subscribe(
      (s) => s.onboardingComplete,
      (val) => {
        safeSetItem(KEYS.onboarding, JSON.stringify(val));
      },
    );

    const unsubUserName = store.subscribe(
      (s) => s.userName,
      (name) => {
        safeSetItem(KEYS.userName, JSON.stringify(name));
      },
    );

    const unsubUserEmail = store.subscribe(
      (s) => s.userEmail,
      (email) => {
        safeSetItem(KEYS.userEmail, JSON.stringify(email));
      },
    );

    const unsubHardSubjects = store.subscribe(
      (s) => s.hardSubjects,
      (subjects) => {
        safeSetItem(KEYS.hardSubjects, JSON.stringify(subjects));
      },
    );

    const unsubBestStyle = store.subscribe(
      (s) => s.bestTeachingStyle,
      (style) => {
        safeSetItem(KEYS.bestTeachingStyle, JSON.stringify(style));
      },
    );

    const unsubConfuses = store.subscribe(
      (s) => s.alwaysConfuses,
      (text) => {
        safeSetItem(KEYS.alwaysConfuses, JSON.stringify(text));
      },
    );

    const unsubPersona = store.subscribe(
      (s) => s.activePersona,
      (persona) => {
        safeSetItem(KEYS.activePersona, JSON.stringify(persona));
      },
    );

    const unsubTutorMode = store.subscribe(
      (s) => s.tutorMode,
      (mode) => {
        safeSetItem(KEYS.tutorMode, JSON.stringify(mode));
      },
    );

    const unsubMoodSettings = store.subscribe(
      (s) => s.moodSettings,
      (mood) => {
        safeSetItem(KEYS.moodSettings, JSON.stringify(mood));
      },
    );

    const unsubDailyChallenge = store.subscribe(
      (s) => s.dailyChallenge,
      (dc) => {
        safeSetItem(KEYS.dailyChallenge, JSON.stringify(dc));
      },
    );

    const unsubNotifications = store.subscribe(
      (s) => s.notifications,
      (notifications) => {
        if (notifications.length > 0) {
          safeSetItem(KEYS.notifications, JSON.stringify(notifications));
        }
      },
    );

    const unsubAdaptiveResults = store.subscribe(
      (s) => s.adaptiveResults,
      (adaptiveResults) => {
        if (adaptiveResults.length > 0) {
          safeSetItem(KEYS.adaptiveResults, JSON.stringify(adaptiveResults));
        }
      },
    );

    const unsubCourseCategories = store.subscribe(
      (s) => s.courseCategories,
      (courseCategories) => {
        if (Object.keys(courseCategories).length > 0) {
          safeSetItem(KEYS.courseCategories, JSON.stringify(courseCategories));
        }
      },
    );

    return () => {
      unsubProfile();
      unsubCourses();
      unsubMastery();
      unsubQuiz();
      unsubOnboarding();
      unsubUserName();
      unsubUserEmail();
      unsubHardSubjects();
      unsubBestStyle();
      unsubConfuses();
      unsubPersona();
      unsubTutorMode();
      unsubMoodSettings();
      unsubDailyChallenge();
      unsubNotifications();
      unsubAdaptiveResults();
      unsubCourseCategories();
    };
  }, [store]);

  // Persist messages with a 500ms debounce
  const saveMessages = useCallback((messages: ChatMessage[]) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      safeSetItem(KEYS.messages, JSON.stringify(messages));
      debounceTimerRef.current = null;
    }, 500);
  }, []);

  useEffect(() => {
    const unsubMessages = store.subscribe(
      (s) => s.messages,
      (messages) => {
        if (messages.length > 0) {
          saveMessages(messages);
        }
      },
    );

    return () => {
      unsubMessages();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [store, saveMessages]);
}