'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Medal,
  Flame,
  Copy,
  Share2,
  Crown,
  Users,
  TrendingUp,
  Target,
  Star,
  X,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAppStore } from '@/stores/appStore';
import { useCountUp } from '@/hooks/useCountUp';
import { useStudyStreak, useTotalStudyTime } from '@/hooks/useStudyTracker';
import { toast } from 'sonner';
import type { StudyBuddy } from '@/types';

/* ── XP → Level calculator (1-50) ── */
function xpToLevel(totalXP: number): number {
  // Level thresholds: each level requires progressively more XP
  const thresholds = Array.from({ length: 50 }, (_, i) => {
    const level = i + 1;
    return Math.round(100 * Math.pow(1.18, level - 1));
  });
  let accumulated = 0;
  for (let i = 0; i < thresholds.length; i++) {
    accumulated += thresholds[i];
    if (totalXP < accumulated) return i + 1;
  }
  return 50;
}

/* ── Build user's own StudyBuddy entry from store data ── */
function useUserBuddy(): StudyBuddy {
  const { userName, studySessions, completedCourses, adaptiveResults, dailyChallenge } = useAppStore();
  const { current: streak } = useStudyStreak();

  return useMemo(() => {
    // Calculate XP from study sessions (10 XP per minute)
    const sessionXP = studySessions.reduce((sum, s) => sum + s.duration * 10, 0);
    // XP from quiz accuracy
    const totalAdaptive = adaptiveResults.length;
    const correctAdaptive = adaptiveResults.filter((r) => r.correct).length;
    const quizAccuracy = totalAdaptive > 0 ? Math.round((correctAdaptive / totalAdaptive) * 100) : 0;
    const quizXP = Math.round(quizAccuracy * 5);
    // XP from daily challenges
    const challengeXP = (dailyChallenge.totalCompleted || 0) * 50;
    const totalXP = sessionXP + quizXP + challengeXP;
    const level = xpToLevel(totalXP);

    return {
      id: 'user-self',
      name: userName || 'You',
      avatarGradient: 'from-primary to-teal-500',
      totalXP,
      level,
      streak,
      coursesCompleted: completedCourses.length,
      quizAccuracy,
      currentTopic: 'Currently studying',
      isOnline: true,
    };
  }, [userName, studySessions, completedCourses, adaptiveResults, dailyChallenge, streak]);
}

/* ── Simulated weekly XP for buddies (randomly varies from total) ── */
function getWeeklyXP(totalXP: number): number {
  // Simulate 30-60% of total XP as "this week" contribution
  const factor = 0.3 + (Math.abs(Math.sin(totalXP * 0.001)) * 0.3);
  return Math.round(totalXP * factor);
}

/* ── Rank Medal Colors ── */
const rankStyles: Record<number, { bg: string; border: string; icon: typeof Trophy; gradient: string; label: string }> = {
  1: { bg: 'bg-amber-500/10', border: 'border-amber-400/50', icon: Crown, gradient: 'from-amber-400 to-yellow-500', label: '1st' },
  2: { bg: 'bg-slate-400/10', border: 'border-slate-400/50', icon: Medal, gradient: 'from-slate-300 to-slate-500', label: '2nd' },
  3: { bg: 'bg-orange-700/10', border: 'border-orange-600/50', icon: Medal, gradient: 'from-orange-600 to-amber-700', label: '3rd' },
};

/* ── Animated Variants ── */
const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};
const listItem = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 300, damping: 22 } },
};

/* ── Gradient Divider ── */
function GradientDivider() {
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="h-[2px] w-full origin-left overflow-hidden rounded-full"
    >
      <div className="h-full w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-gradient-sweep" />
    </motion.div>
  );
}

/* ── Buddy Avatar with gradient initials ── */
function BuddyAvatar({ name, gradient, size = 'md' }: { name: string; gradient: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm';

  return (
    <Avatar className={`${sizeClass} shrink-0`}>
      <AvatarFallback className={`bg-gradient-to-br ${gradient} text-white font-bold shadow-sm`}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

/* ── Share Stats Modal ── */
function ShareStatsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const userBuddy = useUserBuddy();
  const totalStudyMinutes = useTotalStudyTime();
  const hours = Math.floor(totalStudyMinutes / 60);

  const statsText = useMemo(() => {
    const card = [
      '╔══════════════════════════════════════╗',
      '║      🧠 SynapseLearn Stats 🧠        ║',
      '╠══════════════════════════════════════╣',
      `║  📊 Level:    ${String(userBuddy.level).padEnd(24)}║`,
      `║  ⭐ XP:       ${String(userBuddy.totalXP.toLocaleString()).padEnd(24)}║`,
      `║  🔥 Streak:   ${String(`${userBuddy.streak} days`).padEnd(24)}║`,
      `║  📚 Courses:  ${String(userBuddy.coursesCompleted.toString()).padEnd(24)}║`,
      `║  🎯 Accuracy: ${String(`${userBuddy.quizAccuracy}%`).padEnd(24)}║`,
      `║  ⏱️ Study:    ${String(`${hours}+ hours`).padEnd(24)}║`,
      '╠══════════════════════════════════════╣',
      '║   Join me on SynapseLearn! 🚀       ║',
      '╚══════════════════════════════════════╝',
    ].join('\n');
    return card;
  }, [userBuddy, hours]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(statsText);
      toast.success('Stats copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleTwitter = () => {
    const tweetText = `🧠 SynapseLearn Stats:\nLevel ${userBuddy.level} | ${userBuddy.totalXP.toLocaleString()} XP | ${userBuddy.streak}-day streak | ${userBuddy.quizAccuracy}% quiz accuracy\n\nJoin me on SynapseLearn! 🚀`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.success('Opening Twitter share dialog...');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="glass rounded-2xl p-6 w-full max-w-md border border-border/50"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg gradient-text">Share Your Stats</h3>
              <motion.button
                whileHover={{ rotate: 90, scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-4 overflow-x-auto">
              <pre className="text-xs font-mono text-foreground/80 whitespace-pre leading-relaxed">
                {statsText}
              </pre>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCopy} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </Button>
              <Button variant="outline" onClick={handleTwitter} className="flex-1">
                <ExternalLink className="h-4 w-4 mr-2" />
                Share on Twitter
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Leaderboard Entry Row ── */
function LeaderboardRow({
  rank,
  buddy,
  isCurrentUser,
  weeklyXP,
}: {
  rank: number;
  buddy: StudyBuddy;
  isCurrentUser: boolean;
  weeklyXP: number;
}) {
  const displayXP = useCountUp(weeklyXP);
  const style = rankStyles[rank];
  const RankIcon = style?.icon || null;

  return (
    <motion.div
      variants={listItem}
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`
        relative flex items-center gap-3 sm:gap-4 rounded-xl p-3 sm:p-4 transition-all
        ${isCurrentUser
          ? 'glass border-2 border-primary/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] bg-primary/5'
          : 'hover:bg-accent/30 border border-transparent'}
      `}
    >
      {/* Rank Number / Medal */}
      <div className="w-8 sm:w-10 shrink-0 flex items-center justify-center">
        {style ? (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: rank * 0.05 }}
            className={`
              flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full
              bg-gradient-to-br ${style.gradient} text-white font-bold text-sm shadow-md
            `}
          >
            {rank === 1 ? <Crown className="h-4 w-4 sm:h-5 sm:w-5" /> : <Medal className="h-4 w-4 sm:h-5 sm:w-5" />}
          </motion.div>
        ) : (
          <span className="text-sm font-semibold text-muted-foreground w-full text-center">
            #{rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <div className="relative">
        <BuddyAvatar name={buddy.name} gradient={buddy.avatarGradient} />
        {buddy.isOnline && (
          <motion.span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background"
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(16, 185, 129, 0.4)',
                '0 0 0 4px rgba(16, 185, 129, 0)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{buddy.name}</span>
          {isCurrentUser && (
            <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5 shrink-0">
              You
            </Badge>
          )}
          {buddy.streak >= 7 && (
            <span className="flex items-center gap-0.5 text-[10px] text-orange-500 shrink-0">
              <Flame className="h-3 w-3" />
              {buddy.streak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>Lv.{buddy.level}</span>
          <span className="text-border">·</span>
          <span>{buddy.coursesCompleted} courses</span>
          <span className="text-border hidden sm:inline">·</span>
          <span className="hidden sm:inline">{buddy.quizAccuracy}% accuracy</span>
        </div>
      </div>

      {/* XP */}
      <div className="text-right shrink-0">
        <div className={`font-bold text-sm ${style ? `bg-gradient-to-r ${style.gradient} bg-clip-text text-transparent` : 'text-foreground'}`}>
          {displayXP}
        </div>
        <div className="text-[10px] text-muted-foreground">XP</div>
      </div>
    </motion.div>
  );
}

/* ── Top 3 Podium ── */
function TopPodium({ entries }: { entries: Array<{ rank: number; buddy: StudyBuddy; isCurrentUser: boolean; weeklyXP: number }> }) {
  const [first, second, third] = entries;

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-4 mb-6 pt-4">
      {/* 2nd Place */}
      {second && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 25 }}
          className="flex flex-col items-center"
        >
          <div className="relative mb-2">
            <BuddyAvatar name={second.buddy.name} gradient={second.buddy.avatarGradient} size="lg" />
            {second.buddy.isOnline && (
              <motion.span
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background"
                animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0.4)', '0 0 0 5px rgba(16,185,129,0)'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </div>
          <span className="text-xs font-semibold truncate max-w-[80px]">{second.buddy.name}</span>
          <div className="flex items-center gap-1 mt-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-white">
              <Medal className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-muted-foreground">{second.weeklyXP.toLocaleString()}</span>
          </div>
          <motion.div
            className="mt-2 w-20 sm:w-24 rounded-t-xl bg-gradient-to-t from-slate-400/20 to-slate-300/10 border border-b-0 border-slate-400/30"
            initial={{ height: 0 }}
            animate={{ height: 80 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="flex items-center justify-center h-full pb-2">
              <span className="text-2xl font-black text-slate-400/60">2</span>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 1st Place */}
      {first && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 25 }}
          className="flex flex-col items-center"
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="relative mb-2"
          >
            <motion.div
              animate={{ boxShadow: ['0 0 15px rgba(245,158,11,0.2)', '0 0 30px rgba(245,158,11,0.4)', '0 0 15px rgba(245,158,11,0.2)'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -inset-1 rounded-full"
            />
            <BuddyAvatar name={first.buddy.name} gradient={first.buddy.avatarGradient} size="lg" />
            {first.buddy.isOnline && (
              <motion.span
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background"
                animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0.4)', '0 0 0 5px rgba(16,185,129,0)'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <motion.div
              className="absolute -top-3 left-1/2 -translate-x-1/2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 500, damping: 20 }}
            >
              <Crown className="h-5 w-5 text-amber-500 drop-shadow-md" />
            </motion.div>
          </motion.div>
          <span className="text-sm font-bold truncate max-w-[90px]">{first.buddy.name}</span>
          <div className="flex items-center gap-1 mt-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-lg shadow-amber-500/30">
              <Crown className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{first.weeklyXP.toLocaleString()}</span>
          </div>
          <motion.div
            className="mt-2 w-24 sm:w-28 rounded-t-xl bg-gradient-to-t from-amber-400/20 to-amber-300/10 border border-b-0 border-amber-400/30"
            initial={{ height: 0 }}
            animate={{ height: 120 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="flex items-center justify-center h-full pb-2">
              <span className="text-3xl font-black text-amber-400/70">1</span>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 3rd Place */}
      {third && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
          className="flex flex-col items-center"
        >
          <div className="relative mb-2">
            <BuddyAvatar name={third.buddy.name} gradient={third.buddy.avatarGradient} size="lg" />
            {third.buddy.isOnline && (
              <motion.span
                className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background"
                animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0.4)', '0 0 0 5px rgba(16,185,129,0)'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </div>
          <span className="text-xs font-semibold truncate max-w-[80px]">{third.buddy.name}</span>
          <div className="flex items-center gap-1 mt-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-600 to-amber-700 text-white">
              <Medal className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold text-muted-foreground">{third.weeklyXP.toLocaleString()}</span>
          </div>
          <motion.div
            className="mt-2 w-20 sm:w-24 rounded-t-xl bg-gradient-to-t from-orange-600/20 to-orange-500/10 border border-b-0 border-orange-600/30"
            initial={{ height: 0 }}
            animate={{ height: 60 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div className="flex items-center justify-center h-full pb-2">
              <span className="text-2xl font-black text-orange-500/60">3</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

/* ── Main LeaderboardView ── */
export function LeaderboardView() {
  const { studyBuddies, leaderboardPeriod, setLeaderboardPeriod, userName } = useAppStore();
  const userBuddy = useUserBuddy();
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Combine user + buddies and sort
  const rankedEntries = useMemo(() => {
    const all: Array<{ buddy: StudyBuddy; isCurrentUser: boolean; weeklyXP: number; allTimeXP: number }> = [];

    // Add user
    all.push({
      buddy: userBuddy,
      isCurrentUser: true,
      weeklyXP: getWeeklyXP(userBuddy.totalXP),
      allTimeXP: userBuddy.totalXP,
    });

    // Add buddies with simulated weekly XP
    studyBuddies.forEach((b) => {
      all.push({
        buddy: b,
        isCurrentUser: false,
        weeklyXP: getWeeklyXP(b.totalXP),
        allTimeXP: b.totalXP,
      });
    });

    // Sort by appropriate XP
    const sorted = [...all].sort((a, b) => {
      if (leaderboardPeriod === 'weekly') return b.weeklyXP - a.weeklyXP;
      if (leaderboardPeriod === 'category') {
        // Group by topic category and rank within
        return b.buddy.quizAccuracy - a.buddy.quizAccuracy;
      }
      return b.allTimeXP - a.allTimeXP;
    });

    return sorted.map((entry, idx) => ({
      rank: idx + 1,
      ...entry,
    }));
  }, [studyBuddies, userBuddy, leaderboardPeriod]);

  const userRank = rankedEntries.find((e) => e.isCurrentUser)?.rank ?? rankedEntries.length;
  const userEntry = rankedEntries.find((e) => e.isCurrentUser);
  const userCountUpRank = useCountUp(userRank);

  const top3 = rankedEntries.slice(0, 3);
  const rest = rankedEntries.slice(3);

  const tabs: Array<{ key: 'weekly' | 'allTime' | 'category'; label: string; icon: typeof Trophy }> = [
    { key: 'weekly', label: 'Weekly', icon: TrendingUp },
    { key: 'allTime', label: 'All-Time', icon: Trophy },
    { key: 'category', label: 'By Category', icon: Target },
  ];

  const handleShareStats = async () => {
    setShareModalOpen(true);
  };

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6 pt-2 lg:pt-4"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 pl-14 lg:pl-0">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className="text-2xl lg:text-3xl font-bold"
          >
            <span className="gradient-text-animated">Leaderboard</span>
          </motion.h1>
          <p className="text-muted-foreground text-sm">Compete with fellow learners and climb the ranks</p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 pl-14 lg:pl-0"
        >
          <Button variant="outline" size="sm" onClick={handleShareStats} className="neon-border magnetic-hover">
            <Share2 className="h-4 w-4 mr-2" />
            Share My Stats
          </Button>
        </motion.div>
      </motion.div>

      <GradientDivider />

      {/* Period Tabs */}
      <motion.div variants={fadeUp}>
        <div className="glass rounded-xl p-1.5 inline-flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = leaderboardPeriod === tab.key;
            return (
              <motion.button
                key={tab.key}
                onClick={() => setLeaderboardPeriod(tab.key)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  relative flex items-center gap-1.5 rounded-lg px-3 sm:px-4 py-2 text-sm font-medium transition-colors
                  ${isActive ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="leaderboard-tab-active"
                    className="absolute inset-0 rounded-lg bg-primary"
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* User Rank Card */}
      {userEntry && (
        <motion.div
          variants={fadeUp}
          className="glass rounded-xl p-4 border-2 border-primary/20 shadow-[0_0_25px_rgba(16,185,129,0.1)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-lg font-black gradient-text">#{userCountUpRank}</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Your Ranking</p>
                <p className="text-xs text-muted-foreground">
                  {leaderboardPeriod === 'weekly' ? 'This week' : leaderboardPeriod === 'allTime' ? 'All time' : 'By accuracy'}
                  {' · '}
                  {userEntry.weeklyXP.toLocaleString()} XP
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Level</p>
                <p className="text-lg font-bold gradient-text">{userBuddy.level}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total XP</p>
                <p className="text-lg font-bold">{userBuddy.totalXP.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Top 3 Podium */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-4 sm:p-6 neon-border">
        <div className="flex items-center gap-2 mb-2">
          <Star className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold text-sm">Top Learners</h3>
          <Badge variant="secondary" className="text-[10px]">{rankedEntries.length} learners</Badge>
        </div>
        <TopPodium entries={top3} />
      </motion.div>

      {/* Full Rankings List */}
      <motion.div variants={stagger} className="space-y-2">
        <AnimatePresence>
          {rest.map((entry) => (
            <LeaderboardRow
              key={entry.buddy.id}
              rank={entry.rank}
              buddy={entry.buddy}
              isCurrentUser={entry.isCurrentUser}
              weeklyXP={leaderboardPeriod === 'allTime' ? entry.allTimeXP : entry.weeklyXP}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* Footer hint */}
      <motion.div variants={fadeUp} className="flex items-center justify-center gap-1.5 pb-8">
        <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground/50">
          Rankings update based on your study activity
        </p>
      </motion.div>

      {/* Share Modal */}
      <ShareStatsModal open={shareModalOpen} onClose={() => setShareModalOpen(false)} />
    </motion.div>
  );
}

export default LeaderboardView;