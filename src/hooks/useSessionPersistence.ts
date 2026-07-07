'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import type { LearnerProfile, MasteryMap, ChatMessage, Course, StudyGoal } from '@/types';

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
    return JSON.parse(raw) as T;
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
    const savedProfile: LearnerProfile | null = safeGetItem(KEYS.learnerProfile, null);
    const savedCourses: Course[] = safeGetItem(KEYS.courses, []);
    const savedMasteryMap: MasteryMap = safeGetItem(KEYS.masteryMap, {});
    const savedQuizScore: { score: number; total: number } | null = safeGetItem(KEYS.quizScore, null);
    const savedOnboarding: boolean = safeGetItem(KEYS.onboarding, false);
    const savedUserName: string = safeGetItem(KEYS.userName, '');
    const savedUserEmail: string = safeGetItem(KEYS.userEmail, '');
    const savedHardSubjects: string[] = safeGetItem(KEYS.hardSubjects, []);
    const savedBestTeachingStyle: string = safeGetItem(KEYS.bestTeachingStyle, '');
    const savedAlwaysConfuses: string = safeGetItem(KEYS.alwaysConfuses, '');
    const savedPersona: string = safeGetItem(KEYS.activePersona, 'storyteller');
    const savedTutorMode: 'text' | 'slide' | 'hybrid' = safeGetItem(KEYS.tutorMode, 'hybrid');
    const savedDailyChallenge = safeGetItem<{
      lastCompletedDate: string | null;
      streak: number;
      bestScore: number;
      totalCompleted: number;
      todayResults: { score: number; total: number; timeTaken: number; stars: number } | null;
    } | null>(KEYS.dailyChallenge, null);
    const savedMoodSettings: { energy: number; formality: number; patience: number; humor: number } = safeGetItem(KEYS.moodSettings, { energy: 50, formality: 50, patience: 70, humor: 30 });
    const savedStudyGoals: StudyGoal[] = safeGetItem(KEYS.studyGoals, []);

    // Only restore if there is meaningful persisted data
    const hasData =
      savedMessages.length > 0 ||
      savedProfile !== null ||
      savedCourses.length > 0 ||
      Object.keys(savedMasteryMap).length > 0 ||
      savedOnboarding ||
      savedDailyChallenge !== null ||
      savedStudyGoals.length > 0;

    if (!hasData) return;

    // Batch all restorations into a single Zustand set call
    useAppStore.setState({
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
    });
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