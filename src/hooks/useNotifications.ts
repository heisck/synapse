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

function isDuplicateByKey(
  existing: StudyNotification[],
  key: string,
  windowMs: number = DEDUPE_WINDOW_MS,
): boolean {
  const cutoff = Date.now() - windowMs;
  return existing.some(
    (n) => n.title.includes(key) && new Date(n.createdAt).getTime() > cutoff,
  );
}

export function useNotifications(): void {
  const { addNotification, notifications, dailyChallenge, studyGoals, studySessions, achievements, quizScore, quizTotal, completedCourses, courses, settings } = useAppStore();
  const { overdueCount } = useSpacedRepetition();
  const generatedRef = useRef(false);

  useEffect(() => {
    if (generatedRef.current) return;
    generatedRef.current = true;

    const toAdd: Array<Omit<StudyNotification, 'id' | 'read' | 'createdAt'>> = [];
    const MAX_NOTIFICATIONS = 8;

    // 1. Streak Alert with milestone notifications (respects settings.streakAlerts)
    if (settings.streakAlerts && !isDuplicate(notifications, 'streak') && dailyChallenge.streak > 0) {
      toAdd.push({
        type: 'streak',
        title: 'Study Streak Active',
        message: `You're on a ${dailyChallenge.streak}-day streak! Keep it going!`,
        actionLabel: 'Take Daily Challenge',
        actionView: 'quiz',
        priority: dailyChallenge.streak >= 7 ? 'high' : 'medium',
      });
    }

    // Streak milestone notifications
    const streak = dailyChallenge.streak;
    const streakMilestones = [
      { days: 3, title: '3-Day Streak Milestone', message: 'Three days in a row! Your consistency is building.' },
      { days: 7, title: '7-Day Streak Milestone', message: 'A full week streak! You are developing a strong learning habit.' },
      { days: 14, title: '14-Day Streak Milestone', message: 'Two weeks of daily study! Your dedication is remarkable.' },
      { days: 30, title: '30-Day Streak Milestone', message: 'A full month streak! You are an unstoppable learner.' },
    ];
    for (const milestone of streakMilestones) {
      if (settings.streakAlerts && streak >= milestone.days && !isDuplicateByKey(notifications, `${milestone.days}-Day`)) {
        toAdd.push({
          type: 'milestone',
          title: milestone.title,
          message: milestone.message,
          priority: milestone.days >= 30 ? 'high' : 'medium',
        });
      }
    }

    // 2. Review Due
    if (!isDuplicate(notifications, 'review') && overdueCount > 0) {
      toAdd.push({
        type: 'review',
        title: 'Review Due',
        message: `${overdueCount} concept${overdueCount > 1 ? 's are' : ' is'} due for review. Spaced repetition helps retention.`,
        actionLabel: 'Start Review',
        actionView: 'quiz',
        priority: overdueCount > 5 ? 'high' : 'medium',
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
          priority: 'low',
        });
      }
    }

    // 4. Idle Reminder (respects settings.sessionReminders)
    if (settings.sessionReminders && !isDuplicate(notifications, 'reminder')) {
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
        isIdle = false;
      }
      if (isIdle) {
        toAdd.push({
          type: 'reminder',
          title: 'Time to Study',
          message: "It's been a while. Ready to study?",
          actionLabel: 'Start Session',
          actionView: 'tutor',
          priority: 'medium',
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
        priority: 'low',
      });
    }

    // 6. Course completion milestone
    if (completedCourses.length > 0 && !isDuplicate(notifications, 'milestone', 7 * DEDUPE_WINDOW_MS)) {
      const latestCompleted = completedCourses[completedCourses.length - 1];
      const course = courses.find((c) => c.id === latestCompleted);
      if (course) {
        toAdd.push({
          type: 'milestone',
          title: 'Course Completed!',
          message: `Congratulations! You completed "${course.title}".`,
          priority: 'high',
          actionLabel: 'View Courses',
          actionView: 'upload',
        });
      }
    }

    // 7. Quiz score above 90%
    if (quizScore !== null && quizTotal !== null && quizTotal > 0) {
      const pct = (quizScore / quizTotal) * 100;
      if (pct >= 90 && !isDuplicateByKey(notifications, 'Quiz Score')) {
        toAdd.push({
          type: 'achievement',
          title: 'Excellent Quiz Score!',
          message: `You scored ${quizScore}/${quizTotal} (${Math.round(pct)}%) on your latest quiz. Outstanding performance!`,
          priority: 'high',
          actionView: 'quiz',
        });
      }
    }

    // 8. Achievement unlock notifications
    const recentUnlocks = achievements.filter(
      (a) => a.unlockedAt && new Date(a.unlockedAt).getTime() > Date.now() - DEDUPE_WINDOW_MS,
    );
    for (const achievement of recentUnlocks) {
      if (!isDuplicateByKey(notifications, achievement.title)) {
        toAdd.push({
          type: 'achievement',
          title: `Achievement Unlocked: ${achievement.title}`,
          message: achievement.description,
          priority: achievement.rarity === 'legendary' || achievement.rarity === 'epic' ? 'high' : 'medium',
        });
      }
    }

    // Generate max notifications
    const batch = toAdd.slice(0, MAX_NOTIFICATIONS);
    for (const n of batch) {
      addNotification(n);
    }
  }, [addNotification, notifications, dailyChallenge.streak, overdueCount, studyGoals, studySessions, achievements, quizScore, quizTotal, completedCourses, courses, settings.streakAlerts, settings.sessionReminders]);
}
