'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useSpacedRepetition } from '@/hooks/useSpacedRepetition';
import type { StudyNotification } from '@/types';

const STUDY_TIPS: Array<{ title: string; message: string }> = [
  { title: 'Spaced Repetition Tip', message: 'Review material at increasing intervals to lock it into long-term memory.' },
  { title: 'Active Recall Tip', message: 'Test yourself instead of re-reading. Recalling answers strengthens neural pathways.' },
  { title: 'Pomodoro Technique', message: 'Study in focused 25-minute blocks with 5-minute breaks for sustained concentration.' },
  { title: 'Teach to Learn', message: 'Explaining concepts in your own words reveals gaps in your understanding.' },
  { title: 'Mix Your Practice', message: 'Interleaving different topics in a single session improves retention and transfer.' },
  { title: 'Sleep on It', message: 'Memory consolidation happens during sleep. Aim for 7-9 hours for optimal learning.' },
  { title: 'Use Visual Aids', message: 'Diagrams, mind maps, and charts can help you understand complex relationships.' },
  { title: 'Break It Down', message: 'Chunk large topics into smaller, manageable pieces to avoid cognitive overload.' },
  { title: 'Connect New to Known', message: 'Link new information to things you already know to create stronger memory traces.' },
  { title: 'Stay Consistent', message: 'Short daily study sessions are more effective than occasional long cram sessions.' },
];

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function isDuplicate(
  existing: StudyNotification[],
  type: StudyNotification['type'],
  windowMs: number = DEDUPE_WINDOW_MS,
): boolean {
  const cutoff = Date.now() - windowMs;
  return existing.some(
    (n) => n.type === type && new Date(n.createdAt).getTime() > cutoff,
  );
}

export function useNotifications(): void {
  const { addNotification, notifications, dailyChallenge, studyGoals, studySessions } = useAppStore();
  const { overdueCount } = useSpacedRepetition();
  const generatedRef = useRef(false);

  useEffect(() => {
    if (generatedRef.current) return;
    generatedRef.current = true;

    const toAdd: Array<Omit<StudyNotification, 'id' | 'read' | 'createdAt'>> = [];
    const MAX_NOTIFICATIONS = 5;

    // 1. Streak Alert
    if (!isDuplicate(notifications, 'streak') && dailyChallenge.streak > 0) {
      toAdd.push({
        type: 'streak',
        title: 'Study Streak Active',
        message: `You're on a ${dailyChallenge.streak}-day streak! Keep it going!`,
        actionLabel: 'Take Daily Challenge',
        actionView: 'quiz',
      });
    }

    // 2. Review Due
    if (!isDuplicate(notifications, 'review') && overdueCount > 0) {
      toAdd.push({
        type: 'review',
        title: 'Review Due',
        message: `${overdueCount} concept${overdueCount > 1 ? 's are' : ' is'} due for review. Spaced repetition helps retention.`,
        actionLabel: 'Start Review',
        actionView: 'quiz',
      });
    }

    // 3. Goal Progress
    if (!isDuplicate(notifications, 'goal')) {
      const nearCompleteGoal = studyGoals.find((g) => {
        const pct = g.target > 0 ? (g.currentProgress / g.target) * 100 : 0;
        return pct >= 80 && pct < 100;
      });
      if (nearCompleteGoal) {
        const pct = Math.round(
          (nearCompleteGoal.currentProgress / nearCompleteGoal.target) * 100,
        );
        toAdd.push({
          type: 'goal',
          title: 'Goal Almost Complete',
          message: `Almost there! Your "${nearCompleteGoal.label}" goal is at ${pct}%.`,
          actionLabel: 'View Goals',
          actionView: 'dashboard',
        });
      }
    }

    // 4. Idle Reminder
    if (!isDuplicate(notifications, 'reminder')) {
      let isIdle = false;
      if (studySessions.length > 0) {
        const lastSession = studySessions.reduce(
          (latest, s) => {
            const d = new Date(s.date).getTime();
            return d > latest ? d : latest;
          },
          0,
        );
        const daysSince = (Date.now() - lastSession) / (1000 * 60 * 60 * 24);
        isIdle = daysSince >= 2;
      } else {
        // No sessions at all - could be new user, skip idle reminder
        isIdle = false;
      }
      if (isIdle) {
        toAdd.push({
          type: 'reminder',
          title: 'Time to Study',
          message: "It's been a while. Ready to study?",
          actionLabel: 'Start Session',
          actionView: 'tutor',
        });
      }
    }

    // 5. Study Tip (always add if we have room, deduped by type)
    if (!isDuplicate(notifications, 'tip')) {
      const tip = STUDY_TIPS[Math.floor(Math.random() * STUDY_TIPS.length)];
      toAdd.push({
        type: 'tip',
        title: tip.title,
        message: tip.message,
      });
    }

    // Generate max 5 notifications
    const batch = toAdd.slice(0, MAX_NOTIFICATIONS);
    for (const n of batch) {
      addNotification(n);
    }
  }, [addNotification, notifications, dailyChallenge.streak, overdueCount, studyGoals, studySessions]);
}