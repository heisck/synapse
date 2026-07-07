'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import type { MasteryMap } from '@/types';

export interface SRItem {
  questionId: string;
  concept: string;
  nextReview: number; // timestamp (ms)
  interval: number; // hours
  ease: number; // 1.0 - 3.0
  repetitions: number;
}

interface DailyStreak {
  current: number;
  best: number;
  lastDate: string; // ISO date string YYYY-MM-DD
}

const SR_STORAGE_KEY = 'synapse-sr-items';
const STREAK_STORAGE_KEY = 'synapse-daily-streak';

const MIN_INTERVAL_HOURS = 1;
const MAX_INTERVAL_HOURS = 30 * 24; // 30 days
const DEFAULT_EASE = 2.5;

// ---------- Pure utility functions ----------

export function getItemsDue(items: SRItem[]): SRItem[] {
  const now = Date.now();
  return items.filter((item) => item.nextReview <= now);
}

export function updateItemAfterReview(item: SRItem, quality: number): SRItem {
  // quality: 0-5 (0 = complete blackout, 5 = perfect recall)
  const q = Math.max(0, Math.min(5, quality));

  // Adjust ease factor
  // SM-2: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const easeDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  let newEase = item.ease + easeDelta;
  // Clamp ease between 1.0 and 3.0
  newEase = Math.max(1.0, Math.min(3.0, newEase));

  let newInterval: number;
  let newRepetitions: number;

  if (q < 3) {
    // Quality 0-2: repeat sooner
    if (item.repetitions === 0) {
      newInterval = 1; // 1 hour
    } else {
      newInterval = Math.max(MIN_INTERVAL_HOURS, item.interval * 0.5);
    }
    newRepetitions = 0; // Reset repetitions on failure
  } else if (q === 3) {
    // Quality 3: interval stays the same
    newInterval = Math.max(MIN_INTERVAL_HOURS, item.interval);
    newRepetitions = item.repetitions + 1;
  } else {
    // Quality 4-5: interval increases
    if (item.repetitions === 0) {
      newInterval = 6; // 6 hours for first successful review
    } else if (item.repetitions === 1) {
      newInterval = 24; // 1 day for second
    } else {
      newInterval = item.interval * newEase;
    }
    newRepetitions = item.repetitions + 1;
  }

  // Clamp interval
  newInterval = Math.max(MIN_INTERVAL_HOURS, Math.min(MAX_INTERVAL_HOURS, newInterval));

  const nextReview = Date.now() + newInterval * 60 * 60 * 1000;

  return {
    ...item,
    nextReview,
    interval: newInterval,
    ease: newEase,
    repetitions: newRepetitions,
  };
}

export function getStudyPlan(
  items: SRItem[],
  days: number,
): { date: string; count: number }[] {
  const plan: Record<string, number> = {};

  const now = new Date();
  for (let d = 0; d <= days; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    plan[dateStr] = 0;
  }

  for (const item of items) {
    const reviewDate = new Date(item.nextReview);
    const dateStr = reviewDate.toISOString().split('T')[0];
    if (dateStr in plan) {
      plan[dateStr]++;
    }
  }

  return Object.entries(plan).map(([date, count]) => ({ date, count }));
}

// ---------- localStorage helpers ----------

function loadSRItems(): SRItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSRItems(items: SRItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SR_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable
  }
}

export function loadStreak(): DailyStreak {
  if (typeof window === 'undefined') return { current: 0, best: 0, lastDate: '' };
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { current: 0, best: 0, lastDate: '' };
  } catch {
    return { current: 0, best: 0, lastDate: '' };
  }
}

export function saveStreak(streak: DailyStreak): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(streak));
  } catch {
    // Storage full or unavailable
  }
}

// ---------- Hook ----------

export function useSpacedRepetition() {
  const masteryMap = useAppStore((s) => s.masteryMap);
  const [items, setItems] = useState<SRItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    setItems(loadSRItems());
  }, []);

  // Sync: create SRItems for mastered concepts that don't have one yet
  useEffect(() => {
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.questionId));
      const newItems: SRItem[] = [];

      for (const [concept, data] of Object.entries(masteryMap)) {
        if (data.level >= 3 && !existingIds.has(concept)) {
          newItems.push({
            questionId: concept,
            concept,
            nextReview: Date.now(), // Due immediately for review
            interval: 24, // Start at 24 hours
            ease: DEFAULT_EASE,
            repetitions: 0,
          });
        }
      }

      if (newItems.length === 0) return prev;

      const merged = [...prev, ...newItems];
      saveSRItems(merged);
      return merged;
    });
  }, [masteryMap]);

  // Save to localStorage whenever items change (debounced by React batching)
  useEffect(() => {
    if (items.length > 0) {
      saveSRItems(items);
    }
  }, [items]);

  const dueItems = useMemo(() => getItemsDue(items), [items]);

  const overdueCount = useMemo(() => {
    const now = Date.now();
    return items.filter((item) => item.nextReview < now).length;
  }, [items]);

  const reviewItem = useCallback(
    (questionId: string, quality: number) => {
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.questionId === questionId);
        if (idx === -1) return prev;

        const updated = [...prev];
        updated[idx] = updateItemAfterReview(updated[idx], quality);
        saveSRItems(updated);
        return updated;
      });
    },
    [],
  );

  const getUpcomingPlan = useCallback(
    (days: number) => getStudyPlan(items, days),
    [items],
  );

  return {
    items,
    dueItems,
    reviewItem,
    getStudyPlan: getUpcomingPlan,
    overdueCount,
  } as const;
}