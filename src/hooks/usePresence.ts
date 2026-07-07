'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { computeUserStats, getStudyStreakFromStorage } from '@/lib/xp';

const HEARTBEAT_MS = 60_000;
const INSTANCE_KEY = 'synapse-instance-id';

const AVATAR_GRADIENTS = [
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-pink-400 to-rose-500',
  'from-violet-400 to-purple-500',
  'from-cyan-400 to-blue-500',
  'from-lime-400 to-emerald-600',
  'from-sky-400 to-indigo-500',
];

export function getInstanceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(INSTANCE_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `inst-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(INSTANCE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

function pickGradient(instanceId: string): string {
  let hash = 0;
  for (let i = 0; i < instanceId.length; i++) hash = (hash * 31 + instanceId.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

/**
 * Connects this browser instance to the presence backend: periodically reports
 * the stats this browser keeps about its user, and pulls the live list of
 * other instances into `studyBuddies`. The server never receives learning
 * content — only the public leaderboard fields.
 */
export function usePresence(): void {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const instanceId = getInstanceId();
    if (!instanceId) return;

    let cancelled = false;

    const beat = async () => {
      const s = useAppStore.getState();
      const stats = computeUserStats({
        studySessions: s.studySessions,
        adaptiveResults: s.adaptiveResults,
        dailyChallengeCompleted: s.dailyChallenge.totalCompleted,
      });
      const activeCourseTitle = s.activeCourse?.title || s.activeTopic || '';

      try {
        await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId,
            displayName: s.userName,
            avatarGradient: pickGradient(instanceId),
            totalXP: stats.totalXP,
            weeklyXP: stats.weeklyXP,
            level: stats.level,
            streak: getStudyStreakFromStorage(),
            coursesCompleted: s.completedCourses.length,
            quizAccuracy: stats.quizAccuracy,
            currentTopic: activeCourseTitle,
          }),
        });
      } catch {
        // offline — stay silent, retry next beat
      }

      try {
        const res = await fetch(`/api/presence?exclude=${encodeURIComponent(instanceId)}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.success && Array.isArray(data.peers)) {
            useAppStore.setState({ studyBuddies: data.peers });
          }
        }
      } catch {
        // offline — keep whatever we had
      }
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}
