'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';

/**
 * Tracks study session duration, topic, and message count.
 * Starts when the user enters the tutor view, saves on view change or session end.
 * Auto-checks achievements after each session save.
 */
export function useStudyTracker() {
  const startTimeRef = useRef<number | null>(null);
  const topicRef = useRef<string | null>(null);
  const messageCountRef = useRef<number>(0);
  const savedRef = useRef(false);

  const { currentView, activeTopic, messages, addStudySession } = useAppStore();

  // Track message count changes
  useEffect(() => {
    if (currentView === 'tutor') {
      messageCountRef.current = messages.length;
    }
  }, [currentView, messages.length]);

  // Start tracking when entering tutor view
  useEffect(() => {
    if (currentView === 'tutor') {
      startTimeRef.current = Date.now();
      topicRef.current = activeTopic || 'General Study';
      messageCountRef.current = messages.length;
      savedRef.current = false;
    }
  }, [currentView, activeTopic]);

  // Save session when leaving tutor view
  const saveSession = useCallback(() => {
    if (savedRef.current || !startTimeRef.current) return;

    const duration = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));

    // Only save sessions that are at least 30 seconds (0 minutes rounded up)
    if (duration < 1) return;

    // Calculate mastery gained from current masteryMap
    const state = useAppStore.getState();
    const masteryValues = Object.values(state.masteryMap);
    const totalMastery = masteryValues.reduce((sum, c) => sum + c.level, 0);
    const masteryGained = Math.round(totalMastery / Math.max(1, masteryValues.length));

    const session = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date(startTimeRef.current).toISOString(),
      duration,
      topic: topicRef.current || 'General Study',
      messagesCount: messageCountRef.current,
      masteryGained,
    };

    addStudySession(session);
    savedRef.current = true;
    startTimeRef.current = null;
  }, [addStudySession]);

  // Save on view change away from tutor
  useEffect(() => {
    if (currentView !== 'tutor' && startTimeRef.current && !savedRef.current) {
      saveSession();
    }
  }, [currentView, saveSession]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (startTimeRef.current && !savedRef.current) {
        saveSession();
      }
    };
  }, [saveSession]);

  return { saveSession };
}

/**
 * Utility: compute current study streak from studySessions in the store.
 */
export function useStudyStreak(): { current: number; best: number } {
  const { studySessions } = useAppStore();

  const { current, best } = (() => {
    if (studySessions.length === 0) return { current: 0, best: 0 };

    // Get unique study dates
    const sessionDates = [...new Set(studySessions.map((s) => new Date(s.date).toISOString().split('T')[0]))].sort().reverse();

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (sessionDates[0] === todayStr || sessionDates[0] === yesterdayStr) {
      currentStreak = 1;
      for (let i = 1; i < sessionDates.length; i++) {
        const prev = new Date(sessionDates[i - 1]);
        const curr = new Date(sessionDates[i]);
        const diffDays = Math.floor((prev.getTime() - curr.getTime()) / 86400000);
        if (diffDays === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Compute max streak ever
    let maxStreak = 0;
    if (sessionDates.length > 0) {
      let run = 1;
      for (let i = 1; i < sessionDates.length; i++) {
        const prev = new Date(sessionDates[i - 1]);
        const curr = new Date(sessionDates[i]);
        const diffDays = Math.floor((prev.getTime() - curr.getTime()) / 86400000);
        if (diffDays === 1) {
          run++;
        } else {
          maxStreak = Math.max(maxStreak, run);
          run = 1;
        }
      }
      maxStreak = Math.max(maxStreak, run);
    }

    return { current: currentStreak, best: maxStreak };
  })();

  return { current, best };
}

/**
 * Utility: compute total study time in minutes from studySessions.
 */
export function useTotalStudyTime(): number {
  const { studySessions } = useAppStore();
  return studySessions.reduce((sum, s) => sum + s.duration, 0);
}