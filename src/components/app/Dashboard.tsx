'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Flame,
  BookOpen,
  Target,
  Zap,
  MessageSquare,
  Upload,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  Lightbulb,
  Keyboard,
  TrendingUp,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  Play,
  Pause,
  Plus,
  ChevronUp,
  ChevronDown,
  Trash2,
  Download,
  Brain,
  Timer,
  Award,
  Hash,
  X,
  RefreshCw,
  RotateCcw,
  ClipboardCheck,
  Check,
  Layers,
  FlaskConical,
  Calculator,
  Code,
  Languages,
  Landmark,
  Palette,
  Briefcase,
  FolderOpen,
  Users,
  Share2,
  Copy,
  CheckCheck as CheckCheckIcon,
  ExternalLink,
  Search,
  Trophy,
  ArrowUpDown,
  Bookmark,
  AlertTriangle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAppStore } from '@/stores/appStore';
import { CATEGORY_CONFIG, COURSE_CATEGORIES } from './UploadView';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { StatsCard } from './StatsCard';
import { CourseCard } from './CourseCard';
import { EmptyState } from './EmptyState';
import { useStudyStreak, useTotalStudyTime } from '@/hooks/useStudyTracker';
import { useOpenCourse } from '@/hooks/useOpenCourse';
import { useSpacedRepetition } from '@/hooks/useSpacedRepetition';
import { useCountUp } from '@/hooks/useCountUp';
import type { StudyGoal } from '@/types';

// Recent activity is derived entirely from the user's real data
// (study sessions, notes, quiz answers, daily challenge, achievements, uploads).
interface DashboardActivity {
  id: string;
  type: 'session' | 'quiz' | 'note' | 'challenge' | 'achievement' | 'upload';
  text: string;
  time: number;
}

const activityIcons: Record<DashboardActivity['type'], typeof MessageSquare> = {
  session: MessageSquare,
  quiz: Target,
  note: BookOpen,
  challenge: Zap,
  achievement: Award,
  upload: Upload,
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// Evidence-based study techniques — editorial content, not user data.
// User-authored tips from the store are mixed in at render time.
const baseStudyTips = [
  'Spaced repetition is 40% more effective than cramming. Review your notes at increasing intervals for better long-term retention.',
  'Try the Feynman Technique: explain a concept in simple terms as if teaching someone new. If you stumble, that\'s where to focus.',
  'Take a 5-minute break every 25 minutes using the Pomodoro technique. Your brain consolidates learning during rest periods.',
  'Active recall beats passive reading. Close your notes and try to write down everything you remember before checking.',
  'Teaching someone else is the fastest way to identify gaps in your own understanding. Find a study partner today.',
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const fadeUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// Typewriter text component for greeting animation
function TypewriterText({ text, speed = 40, className = '' }: { text: string; speed?: number; className?: string }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The parent keys this component by `text`, so a text/speed change
    // remounts a fresh instance instead of needing to reset state here.
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        setDone(true);
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className={className}>
      {displayed}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.4, repeat: Infinity, repeatType: 'reverse' }}
          className="inline-block w-[2px] h-[0.85em] bg-primary ml-0.5 align-middle rounded-full"
        />
      )}
    </span>
  );
}

// Animated gradient divider component
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

// Animated floating particles behind Quick Start card
function QuickStartParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-emerald-400/40"
          style={{
            left: `${20 + i * 22}%`,
            top: `${15 + (i % 2) * 55}%`,
          }}
          animate={{
            y: [0, -18, 0],
            x: [0, (i % 2 === 0 ? 8 : -8), 0],
            opacity: [0.2, 0.7, 0.2],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 3.5 + i * 0.8,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Circular SVG progress ring with emerald gradient
function GoalProgressRing({ percentage, size = 64, strokeWidth = 5 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const isComplete = clampedPct >= 100;
  const countUpValue = useCountUp(Math.round(clampedPct), { duration: 1000 });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`goalRing-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#goalRing-${size})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (clampedPct / 100) * circumference }}
          transition={{ duration: 1.2, ease: 'easeOut', type: 'spring', stiffness: 300, damping: 25 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {isComplete ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="glow-emerald-strong"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </motion.div>
        ) : (
          <span className="text-[10px] font-bold text-primary">
            {countUpValue}%
          </span>
        )}
      </div>
      {isComplete && (
        <motion.div
          className="absolute inset-0 rounded-full"
          initial={{ boxShadow: '0 0 0 0 rgba(16,185,129,0.4)' }}
          animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0.4)', '0 0 0 6px rgba(16,185,129,0)', '0 0 0 0 rgba(16,185,129,0.4)'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}

// Goal type config
const GOAL_TYPE_CONFIG: Record<StudyGoal['type'], { icon: typeof Target; label: string; unit: string; defaultValue: number }> = {
  sessions: { icon: MessageSquare, label: 'Study Sessions', unit: 'sessions', defaultValue: 5 },
  quiz_score: { icon: Award, label: 'Quiz Score Target', unit: '%', defaultValue: 80 },
  hours: { icon: Clock, label: 'Study Hours', unit: 'hrs', defaultValue: 10 },
  reviews: { icon: Brain, label: 'Questions to Review', unit: 'questions', defaultValue: 20 },
};

// Hover tilt wrapper for StatsCards
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    ref.current.style.transform = `perspective(600px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (ref.current) {
      ref.current.style.transform = 'perspective(600px) rotateY(0deg) rotateX(0deg)';
    }
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.2s ease-out' }}
    >
      {children}
    </div>
  );
}

// Slide-in activity item with timeline dot
function ActivityItem({ activity, index, total }: { activity: DashboardActivity; index: number; total: number }) {
  const Icon = activityIcons[activity.type] ?? Clock;
  const timeLabel = formatRelativeTime(activity.time);
  const isRecent = (Date.now() - activity.time) < 24 * 60 * 60 * 1000;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors relative"
    >
      {/* Timeline connector dot */}
      <div className="absolute left-[7px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent last:hidden pointer-events-none" style={{ display: index < total - 1 ? 'block' : 'none' }} />
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 z-10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{activity.text}</p>
        <p className="text-xs text-muted-foreground">{timeLabel}</p>
      </div>
      {isRecent && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.08 + 0.2, type: 'spring', stiffness: 400, damping: 20 }}
        >
          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
            New
          </Badge>
        </motion.div>
      )}
    </motion.div>
  );
}

// Study streak helper - kept for backward compat but Dashboard uses hook
function getLastSessionTime(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem('synapse-last-session');
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

// --- Study Plan Types ---
interface StudyPlanSession {
  topic: string;
  duration: number;
  type: 'learn' | 'practice' | 'review' | 'quiz';
  description: string;
  resources: string[];
}

interface StudyPlanDay {
  day: string;
  title: string;
  sessions: StudyPlanSession[];
}

interface StudyPlanData {
  plan: {
    overview: string;
    totalHours: number;
    days: StudyPlanDay[];
    milestones: string[];
    tips: string[];
  };
}

const SESSION_TYPE_CONFIG: Record<string, { icon: typeof BookOpen; color: string; bg: string }> = {
  learn: { icon: BookOpen, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  practice: { icon: Target, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  review: { icon: RefreshCw, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  quiz: { icon: ClipboardCheck, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
};

// Compact study-buddies indicator for the greeting header: an icon with the
// live online count (from the presence backend). Clicking opens the
// leaderboard where the full peer list lives.
function StudyBuddiesChip() {
  const { studyBuddies, navigate } = useAppStore();
  const onlineCount = studyBuddies.filter((b) => b.isOnline).length;
  return (
    <button
      type="button"
      onClick={() => navigate('leaderboard')}
      className="flex items-center gap-1.5 h-8 px-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
      aria-label={`${onlineCount} study ${onlineCount === 1 ? 'buddy' : 'buddies'} online — view leaderboard`}
      title="Study buddies online"
    >
      <Users className="h-4 w-4" />
      <span className="text-xs font-semibold tabular-nums">{onlineCount}</span>
      {onlineCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
    </button>
  );
}

// Study Buddies Online Mini Widget — shows REAL peers from the presence
// backend (usePresence polls /api/presence and writes into the store).
// Clicking a buddy expands an honest detail panel; no fake invites.
// (No longer rendered on the dashboard — replaced by StudyBuddiesChip.)
function StudyBuddiesOnlineWidget() {
  const { studyBuddies, navigate } = useAppStore();
  const onlineBuddies = studyBuddies.filter((b) => b.isOnline).slice(0, 4);
  const [expandedBuddyId, setExpandedBuddyId] = useState<string | null>(null);
  const expandedBuddy = onlineBuddies.find((b) => b.id === expandedBuddyId) ?? null;

  const handleBuddyClick = (id: string) => {
    setExpandedBuddyId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Study Buddies Online</h3>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
          >
            {onlineBuddies.length}
          </motion.span>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('leaderboard')}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View all
          <ArrowRight className="h-3 w-3" />
        </motion.button>
      </div>

      {onlineBuddies.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex items-center gap-3 rounded-xl border border-dashed border-border/50 bg-accent/20 px-4 py-5"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-5 w-5 text-primary/70" />
            <motion.span
              className="absolute inset-0 rounded-full border border-primary/20"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">No other learners online right now</p>
            <p className="text-xs text-muted-foreground">They&apos;ll appear here when they connect.</p>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AnimatePresence>
              {onlineBuddies.map((buddy, i) => (
                <motion.button
                  key={buddy.id}
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.08, type: 'spring', stiffness: 300, damping: 22 }}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleBuddyClick(buddy.id)}
                  aria-expanded={expandedBuddyId === buddy.id}
                  className={`group flex flex-col items-center gap-2 p-3 rounded-xl bg-accent/30 hover:bg-accent/60 border transition-all ${
                    expandedBuddyId === buddy.id
                      ? 'border-primary/40 bg-accent/60'
                      : 'border-border/30 hover:border-primary/20'
                  }`}
                >
                  {/* Avatar with pulsing online dot */}
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={`bg-gradient-to-br ${buddy.avatarGradient} text-white text-xs font-bold`}>
                        {buddy.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <motion.span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background"
                      animate={{
                        boxShadow: [
                          '0 0 0 0 rgba(16, 185, 129, 0.5)',
                          '0 0 0 5px rgba(16, 185, 129, 0)',
                        ],
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                    />
                  </div>
                  {/* Details (topic, streak, level, accuracy) live in the
                      expanded row below — the tile stays minimal */}
                  <p className="text-xs font-medium truncate text-center min-w-0 w-full">{buddy.name.split(' ')[0]}</p>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {/* Expandable detail row — real presence data only */}
          <AnimatePresence>
            {expandedBuddy && (
              <motion.div
                key={expandedBuddy.id}
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className={`bg-gradient-to-br ${expandedBuddy.avatarGradient} text-white text-xs font-bold`}>
                      {expandedBuddy.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{expandedBuddy.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Studying {expandedBuddy.currentTopic}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-primary">
                      <Sparkles className="h-3 w-3" />
                      Lv {expandedBuddy.level}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-400">
                      <Flame className="h-3 w-3" />
                      {expandedBuddy.streak}d
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-teal-600 dark:text-teal-400">
                      <Target className="h-3 w-3" />
                      {expandedBuddy.quizAccuracy}%
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedBuddyId(null)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-accent transition-colors"
                    aria-label="Close buddy details"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// Dashboard Share Stats Modal
function DashboardShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userName, studySessions, completedCourses, adaptiveResults, dailyChallenge } = useAppStore();
  const { current: streak } = useStudyStreak();
  const totalStudyMinutes = useTotalStudyTime();
  const hours = Math.floor(totalStudyMinutes / 60);

  const totalAdaptive = adaptiveResults.length;
  const correctAdaptive = adaptiveResults.filter((r) => r.correct).length;
  const quizAccuracy = totalAdaptive > 0 ? Math.round((correctAdaptive / totalAdaptive) * 100) : 0;
  const totalXP = studySessions.reduce((sum, s) => sum + s.duration * 10, 0) + Math.round(quizAccuracy * 5) + (dailyChallenge.totalCompleted || 0) * 50;

  const level = Math.max(1, Math.min(50, Math.floor(Math.sqrt(totalXP / 100)) + 1));

  const statsText = useMemo(() => {
    const card = [
      '╔══════════════════════════════════════╗',
      '║      🧠 SynapseLearn Stats 🧠        ║',
      '╠══════════════════════════════════════╣',
      `║  📊 Level:    ${String(level).padEnd(24)}║`,
      `║  ⭐ XP:       ${String(totalXP.toLocaleString()).padEnd(24)}║`,
      `║  🔥 Streak:   ${String(`${streak} days`).padEnd(24)}║`,
      `║  📚 Courses:  ${String(completedCourses.length.toString()).padEnd(24)}║`,
      `║  🎯 Accuracy: ${String(`${quizAccuracy}%`).padEnd(24)}║`,
      `║  ⏱️ Study:    ${String(`${hours}+ hours`).padEnd(24)}║`,
      '╠══════════════════════════════════════╣',
      '║   Join me on SynapseLearn! 🚀       ║',
      '╚══════════════════════════════════════╝',
    ].join('\n');
    return card;
  }, [level, totalXP, streak, completedCourses.length, quizAccuracy, hours]);

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(statsText);
      setCopied(true);
      toast.success('Stats copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleTwitter = () => {
    const tweetText = `🧠 SynapseLearn Stats:\nLevel ${level} | ${totalXP.toLocaleString()} XP | ${streak}-day streak | ${quizAccuracy}% quiz accuracy\n\nJoin me on SynapseLearn! 🚀`;
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
                {copied ? <CheckCheckIcon className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
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

// Brain loading animation with orbiting dots
function BrainLoader() {
  return (
    <div className="relative w-24 h-24 mx-auto my-6">
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Brain className="h-10 w-10 text-primary/60" />
      </motion.div>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute h-2.5 w-2.5 rounded-full bg-primary"
          style={{
            top: '50%',
            left: '50%',
          }}
          animate={{
            x: [
              Math.cos((i * Math.PI * 2) / 4) * 38,
              Math.cos(((i + 1) * Math.PI * 2) / 4) * 38,
            ],
            y: [
              Math.sin((i * Math.PI * 2) / 4) * 38,
              Math.sin(((i + 1) * Math.PI * 2) / 4) * 38,
            ],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.5,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

// Study Plan Widget Component
function StudyPlanWidget({ courses }: { courses: { id: string; title: string; subject: string }[] }) {
  // Lazy-initialized straight from localStorage — avoids an extra render (and
  // the earlier effect-based approach synchronously setting state on mount).
  const [plan, setPlan] = useState<StudyPlanData | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('synapse-study-plan');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [checkedMilestones, setCheckedMilestones] = useState<Set<string>>(new Set());

  // Dialog state
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');

  // The command dial's "Generate Plan" action opens this dialog from outside
  useEffect(() => {
    const openDialog = () => setDialogOpen(true);
    window.addEventListener('open-study-plan-dialog', openDialog);
    return () => window.removeEventListener('open-study-plan-dialog', openDialog);
  }, []);
  const [hoursPerWeek, setHoursPerWeek] = useState([10]);
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [goals, setGoals] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState('');
  const [pace, setPace] = useState('moderate');
  const [style, setStyle] = useState('balanced');

  const courseTopics = useMemo(() => {
    return courses.map((c) => c.title);
  }, [courses]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : prev.length < 5 ? [...prev, topic] : prev
    );
  };

  const addCustomTopic = () => {
    const trimmed = customTopic.trim();
    if (trimmed && !selectedTopics.includes(trimmed) && selectedTopics.length < 5) {
      setSelectedTopics((prev) => [...prev, trimmed]);
      setCustomTopic('');
    }
  };

  const addGoal = () => {
    const trimmed = goalInput.trim();
    if (trimmed && goals.length < 3) {
      setGoals((prev) => [...prev, trimmed]);
      setGoalInput('');
    }
  };

  const handleGenerate = async () => {
    if (selectedTopics.length === 0) {
      toast.error('Please select at least one topic');
      return;
    }

    setLoading(true);
    setDialogOpen(false);

    try {
      const res = await fetch('/api/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: selectedTopics,
          hoursPerWeek: hoursPerWeek[0],
          level,
          goals,
          preferences: { pace, style },
        }),
      });

      const data = await res.json();
      if (data.plan) {
        setPlan(data);
        setExpandedDay(data.plan.days[0]?.day ?? null);
        setCheckedMilestones(new Set());
        try { localStorage.setItem('synapse-study-plan', JSON.stringify(data)); } catch { /* ignore */ }
        toast.success('Study plan generated successfully');
      } else {
        toast.error(data.error || 'Failed to generate study plan');
      }
    } catch {
      toast.error('Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMilestone = (milestone: string) => {
    setCheckedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestone)) {
        next.delete(milestone);
      } else {
        next.add(milestone);
      }
      return next;
    });
  };

  const handleRegenerate = () => {
    setDialogOpen(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">Generating Your Study Plan</h3>
        </div>
        <BrainLoader />
        <p className="text-sm text-muted-foreground text-center">
          AI is crafting a personalized plan for you...
        </p>
      </div>
    );
  }

  // Plan display
  if (plan) {
    return (
      <div className="glass rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Your Study Plan</h3>
            <Badge variant="secondary" className="text-xs">
              {plan.plan.totalHours} hrs/week
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleRegenerate}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Regenerate
            </Button>
          </div>
        </div>

        {/* Overview */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-sm text-muted-foreground leading-relaxed"
        >
          {plan.plan.overview}
        </motion.p>

        {/* 7-day timeline */}
        <div className="space-y-2">
          {plan.plan.days.map((day, dayIdx) => {
            const isExpanded = expandedDay === day.day;
            const totalMinutes = day.sessions.reduce((s, sess) => s + sess.duration, 0);
            return (
              <motion.div
                key={day.day}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: dayIdx * 0.06, ease: 'easeOut' }}
                className="rounded-lg border border-border/50 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                  className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {day.day.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{day.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {day.sessions.length} session{day.sessions.length !== 1 ? 's' : ''} -- {totalMinutes} min
                      </p>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-2">
                        {day.sessions.map((session, sessIdx) => {
                          const typeConfig = SESSION_TYPE_CONFIG[session.type] || SESSION_TYPE_CONFIG.learn;
                          const TypeIcon = typeConfig.icon;
                          return (
                            <motion.div
                              key={sessIdx}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: sessIdx * 0.08, duration: 0.3, ease: 'easeOut' }}
                              className="glass rounded-lg p-3 space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${typeConfig.bg}`}>
                                    <TypeIcon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
                                  </div>
                                  <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                                    {session.topic}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">{session.duration} min</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{session.description}</p>
                              {session.resources.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {session.resources.map((r, ri) => (
                                    <span key={ri} className="text-[10px] text-primary/70 bg-primary/5 px-1.5 py-0.5 rounded">
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Milestones checklist */}
        {plan.plan.milestones.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Milestones</p>
            <div className="space-y-1.5">
              {plan.plan.milestones.map((milestone, idx) => {
                const checked = checkedMilestones.has(milestone);
                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08, duration: 0.3 }}
                    onClick={() => toggleMilestone(milestone)}
                    className="flex items-center gap-2.5 w-full text-left p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      checked
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-muted-foreground/30'
                    }`}>
                      {checked && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                          <Check className="h-3 w-3" />
                        </motion.span>
                      )}
                    </div>
                    <span className={`text-sm ${checked ? 'line-through text-muted-foreground' : ''}`}>{milestone}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tips */}
        {plan.plan.tips.length > 0 && (
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Study Tips</p>
            </div>
            <ul className="space-y-1">
              {plan.plan.tips.map((tip, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">--</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // No saved plan: no visible card — the command dial's "Generate Plan"
  // opens this dialog directly, so the dashboard doesn't carry a duplicate CTA
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Generate Study Plan
          </DialogTitle>
          <DialogDescription>
            Configure your preferences and let AI create a personalized weekly study schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Topics selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Topics (select up to 5)</Label>
            <div className="flex flex-wrap gap-2">
              {courseTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                    selectedTopics.includes(topic)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a custom topic..."
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTopic(); } }}
                className="text-sm h-8"
                disabled={selectedTopics.length >= 5}
              />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={addCustomTopic} disabled={selectedTopics.length >= 5 || !customTopic.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {selectedTopics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTopics.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs gap-1 pr-1">
                    {t}
                    <button onClick={() => toggleTopic(t)} className="ml-0.5 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Hours per week slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Hours per week</Label>
              <span className="text-sm font-bold text-primary">{hoursPerWeek[0]} hrs</span>
            </div>
            <Slider
              value={hoursPerWeek}
              onValueChange={setHoursPerWeek}
              min={1}
              max={20}
              step={1}
              className="w-full"
            />
          </div>

          {/* Difficulty level */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Difficulty Level</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['beginner', 'intermediate', 'advanced'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition-all border capitalize ${
                    level === l
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Goals */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Goals (optional, max 3)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Pass the exam next month"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGoal(); } }}
                className="text-sm h-8"
                disabled={goals.length >= 3}
              />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={addGoal} disabled={goals.length >= 3 || !goalInput.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {goals.length > 0 && (
              <div className="space-y-1">
                {goals.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Target className="h-3 w-3 text-primary shrink-0" />
                    <span className="flex-1">{g}</span>
                    <button onClick={() => setGoals((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preferences */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pace</Label>
              <div className="flex gap-1">
                {['relaxed', 'moderate', 'intensive'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPace(p)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all border capitalize ${
                      pace === p
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:border-primary/50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Style</Label>
              <div className="flex gap-1">
                {['visual', 'balanced', 'reading'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all border capitalize ${
                      style === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:border-primary/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={selectedTopics.length === 0} className="glow-emerald">
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Dashboard() {
  const {
    courses,
    userName,
    navigate,
    setActiveTopic,
    setActiveSession,
    goals,
    addGoal,
    toggleGoalStatus,
    deleteGoal,
    reorderGoals,
    studySessions,
    masteryMap,
    activeSessionId,
    onboardingComplete,
    notes,
    quizScore,
    adaptiveResults,
    achievements,
    tips: userTips,
    dailyChallenge: storeDailyChallenge,
    studyGoals,
    addStudyGoal,
    updateStudyGoal,
    deleteStudyGoal: removeStudyGoal,
    completedCourses,
    bookmarkedCourses,
    toggleBookmark,
  } = useAppStore();

  const { openCourse } = useOpenCourse();
  const { current: currentStreak, best: bestStreak } = useStudyStreak();
  const totalStudyTimeMinutes = useTotalStudyTime();
  const { overdueCount, getStudyPlan } = useSpacedRepetition();
  const studyPlan = getStudyPlan(7);

  // Animated number counters for stats
  const animatedCourses = useCountUp(courses.length, { duration: 1200, delay: 400 });
  const animatedStreak = useCountUp(currentStreak, { duration: 1200, delay: 600 });
  const animatedSessions = useCountUp(studySessions.length, { duration: 1200, delay: 800 });

  // Study tips carousel: editorial techniques + the user's own saved tips
  const studyTips = useMemo(() => {
    const authored = userTips
      .map((t) => t.content?.trim())
      .filter((c): c is string => Boolean(c));
    return [...baseStudyTips, ...authored];
  }, [userTips]);

  const [progressValue, setProgressValue] = useState(0);
  const [activeTipIndex, setActiveTipIndex] = useState(() => Math.floor(Math.random() * baseStudyTips.length));
  const [tipDirection, setTipDirection] = useState<'left' | 'right'>('left');
  const [toastShown, setToastShown] = useState(false);
  const [newGoalText, setNewGoalText] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);

  // Weak areas state
  const ERROR_REPORT_STORAGE_KEY = 'synapse-error-report';
  const [weakAreasReport] = useState<{
    weakAreas: Array<{ concept: string; masteryEstimate: number; errorType: string }>;
    studyPriority: string[];
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(ERROR_REPORT_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  });
  const [weakAreasDialogOpen, setWeakAreasDialogOpen] = useState(false);
  const [weakAreasDialogReport, setWeakAreasDialogReport] = useState<Record<string, unknown> | null>(null);

  // Study goals state
  const [showAddGoalDialog, setShowAddGoalDialog] = useState(false);
  const [selectedGoalType, setSelectedGoalType] = useState<StudyGoal['type']>('sessions');
  const [goalTargetInput, setGoalTargetInput] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalTarget, setEditingGoalTarget] = useState('');

  // Weekly reset: clear study goals progress if a new week has started
  useEffect(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    const currentWeekStart = monday.toISOString().split('T')[0];

    studyGoals.forEach((g) => {
      if (g.weekStart !== currentWeekStart) {
        updateStudyGoal(g.id, { currentProgress: 0, weekStart: currentWeekStart });
      }
    });
  }, [studyGoals, updateStudyGoal]);

  // Compute goal completion percentage
  const goalCompletionPct = useMemo(() => {
    if (goals.length === 0) return 0;
    const done = goals.filter((g) => g.status === 'done').length;
    return Math.round((done / goals.length) * 100);
  }, [goals]);

  // Animate progress bar on mount
  useEffect(() => {
    const timer = setTimeout(() => setProgressValue(goalCompletionPct), 300);
    return () => clearTimeout(timer);
  }, [goalCompletionPct]);

  // Rotate study tips
  useEffect(() => {
    const interval = setInterval(() => {
      setTipDirection('left');
      setActiveTipIndex((prev) => (prev + 1) % studyTips.length);
    }, 12000);

    return () => clearInterval(interval);
  }, [studyTips.length]);

  // Session reminder toast
  useEffect(() => {
    if (toastShown) return;
    const lastSession = getLastSessionTime();
    if (lastSession === null) return;
    const hoursSince = (Date.now() - lastSession) / 3600000;
    if (hoursSince > 24) {
      const timer = setTimeout(() => {
        toast('Welcome back! Ready for your next study session?', {
          description: 'Your knowledge is waiting. Pick up where you left off.',
          icon: <Sparkles className="h-4 w-4 text-emerald-500" />,
          duration: 5000,
          // Theme-provided colors: hard-coding a light background here made
          // the text unreadable in dark mode
          className: '!border-l-4 !border-l-emerald-500',
        });
        setToastShown(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [toastShown]);

  // Compute overall weekly study goals progress
  const weeklyGoalPct = useMemo(() => {
    if (studyGoals.length === 0) return 0;
    const total = studyGoals.reduce((sum, g) => {
      const pct = g.target > 0 ? Math.min((g.currentProgress / g.target) * 100, 100) : 0;
      return sum + pct;
    }, 0);
    return Math.round(total / studyGoals.length);
  }, [studyGoals]);

  // Goal type config
  const goalTypeConfig = useMemo(() => GOAL_TYPE_CONFIG, []);

  const handleAddStudyGoal = () => {
    const target = parseInt(goalTargetInput, 10);
    if (isNaN(target) || target <= 0) {
      toast.error('Please enter a valid target number');
      return;
    }
    const config = goalTypeConfig[selectedGoalType];
    addStudyGoal({ type: selectedGoalType, label: config.label, target });
    setShowAddGoalDialog(false);
    setGoalTargetInput('');
    toast('Weekly study goal added');
  };

  const handleEditGoalTarget = (goal: StudyGoal) => {
    setEditingGoalId(goal.id);
    setEditingGoalTarget(String(goal.target));
  };

  const handleSaveGoalTarget = (id: string) => {
    const target = parseInt(editingGoalTarget, 10);
    if (isNaN(target) || target <= 0) {
      toast.error('Please enter a valid target number');
      return;
    }
    updateStudyGoal(id, { target });
    setEditingGoalId(null);
    setEditingGoalTarget('');
    toast('Goal target updated');
  };

  // Tip navigation
  const nextTip = useCallback(() => {
    setTipDirection('left');
    setActiveTipIndex((prev) => (prev + 1) % studyTips.length);
  }, [studyTips.length]);

  const prevTip = useCallback(() => {
    setTipDirection('right');
    setActiveTipIndex((prev) => (prev - 1 + studyTips.length) % studyTips.length);
  }, [studyTips.length]);

  const handleStartSession = (topic: string) => {
    setActiveTopic(topic);
    setActiveSession(`session-${Date.now()}`);
    // Record session time
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-last-session', String(Date.now()));
    }
    navigate('tutor');
  };

  const handleCourseClick = (course: (typeof courses)[number]) => openCourse(course);

  const handleAddGoal = () => {
    const trimmed = newGoalText.trim();
    if (!trimmed) return;
    addGoal({
      id: `goal-${Date.now()}`,
      text: trimmed,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    setNewGoalText('');
    toast('Goal added');
  };

  const handleGoalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddGoal();
    }
  };

  const handleDeleteGoal = (id: string) => {
    deleteGoal(id);
    toast('Goal removed');
  };

  const handleExportStudyData = () => {
    if (studySessions.length === 0) {
      toast.info('No study data to export yet');
      return;
    }
    const headers = ['Date', 'Topic', 'Duration (min)', 'Messages', 'Mastery Gained'];
    const rows = studySessions.map((s) => [
      format(new Date(s.date), 'yyyy-MM-dd'),
      `"${(s.topic || '').replace(/"/g, '""')}"`,
      String(s.duration),
      String(s.messagesCount),
      String(s.masteryGained),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synapselearn-study-data-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${studySessions.length} study sessions`);
  };

  const handleMoveGoal = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= goals.length) return;
    reorderGoals(index, targetIndex);
  };

  // Compute real chart data from studySessions
  const { weeklyActivityData, hasWeeklyData, masteryTrendData, hasMasteryData } = useMemo(() => {
    // Weekly activity: group by day of current week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    const weekSessions = studySessions.filter((s) => {
      const d = new Date(s.date);
      return d >= monday && d < sunday;
    });

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const realWeekly = dayNames.map((day, idx) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + idx);
      const dayStr = dayDate.toISOString().split('T')[0];
      const count = weekSessions.filter((s) => new Date(s.date).toISOString().split('T')[0] === dayStr).length;
      return { day, sessions: count };
    });
    const hasWeeklyData = realWeekly.some((d) => d.sessions > 0);

    // Mastery trend: group mastery entries by week (using lastAssessed timestamp)
    const masteryEntries = Object.values(masteryMap);
    let realMastery: { week: string; mastery: number }[] = [];
    if (masteryEntries.length > 0) {
      const weekMap = new Map<string, number[]>();
      masteryEntries.forEach((entry) => {
        if (entry.lastAssessed > 0) {
          const d = new Date(entry.lastAssessed);
          // Get week start (Monday)
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(d);
          weekStart.setDate(diff);
          weekStart.setHours(0, 0, 0, 0);
          const key = weekStart.toISOString().split('T')[0];
          if (!weekMap.has(key)) weekMap.set(key, []);
          weekMap.get(key)!.push(entry.level);
        }
      });
      const sortedWeeks = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      realMastery = sortedWeeks.map(([_, levels], idx) => ({
        week: `Wk ${idx + 1}`,
        mastery: Math.round(levels.reduce((s, l) => s + l, 0) / levels.length),
      }));
      // Take last 8 weeks
      if (realMastery.length > 8) {
        realMastery = realMastery.slice(-8);
      }
    }
    const hasMasteryData = realMastery.length >= 2;

    // Never substitute fabricated data — empty charts render an honest empty state.
    return {
      weeklyActivityData: realWeekly,
      hasWeeklyData,
      masteryTrendData: realMastery,
      hasMasteryData,
    };
  }, [studySessions, masteryMap]);

  // Format total study time
  const formattedStudyTime = useMemo(() => {
    const hours = Math.floor(totalStudyTimeMinutes / 60);
    const mins = totalStudyTimeMinutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  }, [totalStudyTimeMinutes]);

  const greeting = getGreeting();
  // First name only; empty when the user hasn't told us their name yet
  const firstName = (userName || '').trim().split(/\s+/)[0] || '';
  const { courseCategories } = useAppStore();

  // Your Topics: derived from the user's own data — weakest mastery concepts
  // first (most useful to revisit), then course titles/subjects/categories.
  const topicChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: string[] = [];
    const push = (raw: string | undefined | null) => {
      const t = (raw || '').trim();
      if (!t) return;
      const key = t.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      chips.push(t);
    };

    // Weakest concepts from the mastery map first
    Object.entries(masteryMap)
      .sort((a, b) => a[1].level - b[1].level)
      .forEach(([concept]) => push(concept));

    // Then the user's courses: title, assigned category, subject
    courses.forEach((c) => {
      push(c.title);
      push(courseCategories[c.id]);
      push(c.subject);
    });

    return chips.slice(0, 6);
  }, [masteryMap, courses, courseCategories]);

  // Recent Activity: merged from everything the app actually recorded
  const recentActivity = useMemo<DashboardActivity[]>(() => {
    const items: DashboardActivity[] = [];

    studySessions.forEach((s) => {
      const t = new Date(s.date).getTime();
      if (Number.isNaN(t)) return;
      items.push({
        id: `session-${s.id}`,
        type: 'session',
        text: `Studied ${s.topic || 'a topic'} for ${s.duration} min`,
        time: t,
      });
    });

    notes.forEach((n) => {
      const t = new Date(n.createdAt).getTime();
      if (Number.isNaN(t)) return;
      items.push({
        id: `note-${n.id}`,
        type: 'note',
        text: `Created note "${n.title || 'Untitled'}"`,
        time: t,
      });
    });

    adaptiveResults.forEach((r, i) => {
      if (!r.timestamp) return;
      items.push({
        id: `adaptive-${r.timestamp}-${i}`,
        type: 'quiz',
        text: `${r.correct ? 'Answered correctly' : 'Missed a question'} on ${r.concept}`,
        time: r.timestamp,
      });
    });

    if (storeDailyChallenge.lastCompletedDate) {
      const t = new Date(storeDailyChallenge.lastCompletedDate).getTime();
      if (!Number.isNaN(t)) {
        const res = storeDailyChallenge.todayResults;
        items.push({
          id: `challenge-${storeDailyChallenge.lastCompletedDate}`,
          type: 'challenge',
          text: res
            ? `Completed the daily challenge (${res.score}/${res.total})`
            : 'Completed the daily challenge',
          time: t,
        });
      }
    }

    achievements.forEach((a) => {
      if (!a.unlockedAt) return;
      const t = new Date(a.unlockedAt).getTime();
      if (Number.isNaN(t)) return;
      items.push({
        id: `achievement-${a.id}`,
        type: 'achievement',
        text: `Unlocked "${a.title}" achievement`,
        time: t,
      });
    });

    courses.forEach((c) => {
      const t = new Date(c.createdAt).getTime();
      if (Number.isNaN(t)) return;
      items.push({
        id: `upload-${c.id}`,
        type: 'upload',
        text: `Uploaded "${c.title}"`,
        time: t,
      });
    });

    return items.sort((a, b) => b.time - a.time).slice(0, 6);
  }, [studySessions, notes, adaptiveResults, storeDailyChallenge, achievements, courses]);

  // Category filter state
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseStatusFilter, setCourseStatusFilter] = useState<'all' | 'in-progress' | 'completed'>('all');
  const [courseSortMode, setCourseSortMode] = useState<'name' | 'date' | 'progress'>('date');

  // Compute used categories from courses and store
  const usedCategories = useMemo(() => {
    const cats = new Set<string>();
    courses.forEach((c) => {
      const cat = courseCategories[c.id] || c.subject;
      if (cat) cats.add(cat);
    });
    return COURSE_CATEGORIES.filter((cat) => cats.has(cat));
  }, [courses, courseCategories]);

  // Compute category stats for breakdown bar
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; questions: number }> = {};
    courses.forEach((c) => {
      const cat = courseCategories[c.id] || c.subject || 'Other';
      const slideCount = c._count?.slides ?? c.slides?.length ?? 0;
      if (!stats[cat]) stats[cat] = { count: 0, questions: slideCount };
      else { stats[cat].count++; stats[cat].questions += slideCount; }
    });
    return stats;
  }, [courses, courseCategories]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    let result = courses;

    // Search by title
    if (courseSearchQuery.trim()) {
      const q = courseSearchQuery.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }

    // Category filter
    if (selectedCategoryFilter !== 'All') {
      result = result.filter((c) => {
        const cat = courseCategories[c.id] || c.subject;
        return cat === selectedCategoryFilter;
      });
    }

    // Status filter
    if (courseStatusFilter === 'completed') {
      result = result.filter((c) => completedCourses.includes(c.id));
    } else if (courseStatusFilter === 'in-progress') {
      result = result.filter((c) => !completedCourses.includes(c.id));
    }

    // Sort
    const sorted = [...result];
    switch (courseSortMode) {
      case 'name':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'date':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'progress': {
        sorted.sort((a, b) => {
          const aSlideCount = a._count?.slides ?? a.slides?.length ?? 0;
          const bSlideCount = b._count?.slides ?? b.slides?.length ?? 0;
          const aDone = completedCourses.includes(a.id) ? 1 : 0;
          const bDone = completedCourses.includes(b.id) ? 1 : 0;
          if (bDone !== aDone) return bDone - aDone;
          return bSlideCount - aSlideCount;
        });
        break;
      }
    }

    return sorted;
  }, [courses, courseCategories, selectedCategoryFilter, courseSearchQuery, courseStatusFilter, courseSortMode, completedCourses]);

  const showViewAll = filteredCourses.length > 3;
  const displayedCourses = filteredCourses.slice(0, 3);
  const lastCourse = filteredCourses.length > 0 ? filteredCourses[0] : null;

  // Tip slide variants
  const tipVariants = {
    enter: (dir: 'left' | 'right') => ({
      x: dir === 'left' ? 40 : -40,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: 'left' | 'right') => ({
      x: dir === 'left' ? -40 : 40,
      opacity: 0,
    }),
  };

  const today = new Date().toISOString().split('T')[0];
  const dailyChallengeDone = storeDailyChallenge.lastCompletedDate === today;
  const commandActions = [
    {
      label: activeSessionId ? 'Continue' : 'Start Now',
      title: activeSessionId ? 'Resume your session' : 'Start a focused session',
      description: activeSessionId
        ? 'Pick up where you left off with your AI tutor.'
        : 'Open a fresh tutor session around today\'s topic.',
      icon: PlayCircle,
      onClick: () => handleStartSession(activeSessionId ? 'Continue Session' : "Today's Topic"),
    },
    {
      label: 'Start Challenge',
      title: dailyChallengeDone ? 'Challenge complete' : 'Daily challenge',
      description: dailyChallengeDone
        ? `You scored ${storeDailyChallenge.todayResults?.score || 0} points today.`
        : 'Take five timed questions and keep your streak moving.',
      icon: Target,
      onClick: () => navigate('quiz'),
    },
    {
      label: 'Generate Plan',
      title: 'Build a weekly plan',
      description: 'Generate a study plan from your courses, topics, and goals.',
      icon: Sparkles,
      onClick: () => {
        // Scroll to the plan when one exists; otherwise open the generate dialog
        const planEl = document.getElementById('dashboard-study-plan');
        if (planEl) planEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.dispatchEvent(new CustomEvent('open-study-plan-dialog'));
      },
    },
    {
      label: 'Resume',
      title: lastCourse ? `Resume ${lastCourse.title}` : 'Resume learning',
      description: lastCourse?.description || 'Return to your most recent course when one is available.',
      icon: BookOpen,
      onClick: () => {
        if (lastCourse) handleCourseClick(lastCourse);
        else navigate('courses');
      },
    },
    {
      label: 'Focus Timer',
      title: 'Start a focus block',
      description: 'Use a timed session to keep attention tight and measurable.',
      icon: Timer,
      onClick: () => navigate('focus-timer'),
    },
    {
      label: 'Day Goal',
      title: dailyChallengeDone ? 'Today is done' : 'Finish today strong',
      description: dailyChallengeDone
        ? 'Your daily challenge is complete. Keep the rhythm tomorrow.'
        : 'Use the daily challenge as today\'s minimum win.',
      icon: CheckCircle2,
      onClick: () => navigate('quiz'),
    },
  ];
  const activeCommand = commandActions[activeCommandIndex] || commandActions[0];

  const handleCommandWheel = (event: React.WheelEvent<HTMLElement>) => {
    event.preventDefault();
    const direction = event.deltaY > 0 || event.deltaX > 0 ? 1 : -1;
    setActiveCommandIndex((prev) => (prev + direction + commandActions.length) % commandActions.length);
  };

  return (
    <div className="relative">
      {/* Decorative animated mesh gradient background */}
      <div className="dashboard-mesh-bg" />
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-8 pt-2 lg:pt-4"
    >
      {/* Greeting — bare, no card wrapper */}
      <motion.div variants={fadeUp}>
        <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                className="text-2xl lg:text-3xl font-bold"
              >
                <TypewriterText key={firstName ? `${greeting}, ` : greeting} text={firstName ? `${greeting}, ` : greeting} speed={40} />
                {firstName && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: `${greeting}, `.length * 0.04 + 0.15, duration: 0.4, ease: 'easeOut' }}
                    className="gradient-text shimmer inline-block"
                  >
                    {firstName}
                  </motion.span>
                )}
              </motion.h1>
              {currentStreak > 0 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.8, type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex items-center gap-1 text-orange-500 bg-orange-500/10 px-2.5 py-0.5 rounded-full"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Flame className="h-4 w-4" />
                  </motion.div>
                  <span className="text-xs font-bold">{currentStreak} day streak</span>
                </motion.div>
              )}
            </div>
            {/* Animated gradient bar below Study Streak */}
            {currentStreak > 0 && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.2, delay: 1, ease: 'easeOut' }}
                className="h-[2px] w-full max-w-[120px] rounded-full origin-left mt-1"
                style={{
                  background: 'linear-gradient(90deg, #f59e0b, #ef4444, #fbbf24, #f59e0b)',
                  backgroundSize: '300% 100%',
                  animation: 'gradient-shift 3s ease infinite',
                }}
              />
            )}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-muted-foreground text-sm"
            >
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </motion.p>
          </div>

          {/* One slim pill holds every header action — no loose separate buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex w-full justify-evenly sm:w-auto sm:justify-normal items-center gap-0.5 rounded-full border border-border/60 p-1 shrink-0"
          >
            <StudyBuddiesChip />
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShareModalOpen(true)} aria-label="Share stats" title="Share stats">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExportStudyData} aria-label="Export study data" title="Export data">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5" onClick={() => navigate('upload')} aria-label="Upload slides">
              <Upload className="h-4 w-4" />
              <span className="text-xs font-medium">Upload slides</span>
            </Button>
          </motion.div>
        </div>
      </motion.div>

      <GradientDivider />

      {/* Command dial — left pane shows the selected action's name/description,
          right side is a coverflow-style wheel scrolled or swiped through
          Start Now / Start Challenge / Generate Plan / Resume / Focus Timer /
          Week Goal / Day Goal. Selecting an item centers it; the centered
          item is what actually runs. */}
      <motion.div variants={fadeUp} className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCommand.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="font-bold text-xl lg:text-2xl truncate">{activeCommand.title}</h2>
              <p className="text-muted-foreground text-sm lg:text-base line-clamp-1">{activeCommand.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          className="relative h-24 w-[260px] sm:w-[320px] shrink-0"
          style={{ perspective: 600 }}
          onWheel={handleCommandWheel}
          role="listbox"
          aria-label="Quick actions"
          aria-activedescendant={`command-${activeCommandIndex}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              setActiveCommandIndex((prev) => (prev + 1) % commandActions.length);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setActiveCommandIndex((prev) => (prev - 1 + commandActions.length) % commandActions.length);
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              activeCommand.onClick();
            }
          }}
          onPanEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 32) {
              const dir = info.offset.x < 0 ? 1 : -1;
              setActiveCommandIndex((prev) => (prev + dir + commandActions.length) % commandActions.length);
            }
          }}
        >
          {commandActions.map((action, i) => {
            let offset = i - activeCommandIndex;
            const n = commandActions.length;
            if (offset > n / 2) offset -= n;
            if (offset < -n / 2) offset += n;
            const abs = Math.abs(offset);
            if (abs > 2) return null;
            const isActive = offset === 0;
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                id={`command-${i}`}
                role="option"
                aria-selected={isActive}
                aria-label={action.title}
                type="button"
                onClick={() => (isActive ? activeCommand.onClick() : setActiveCommandIndex(i))}
                initial={false}
                animate={{
                  x: offset * 60,
                  scale: 1 - abs * 0.2,
                  rotateY: offset * -22,
                  opacity: 1 - abs * 0.4,
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                style={{ zIndex: 10 - abs, transformStyle: 'preserve-3d' }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 cursor-pointer"
              >
                <span
                  className={`flex items-center justify-center rounded-full transition-all ${
                    isActive
                      ? 'h-14 w-14 bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : 'h-11 w-11 bg-muted/70 text-muted-foreground'
                  }`}
                >
                  <Icon className={isActive ? 'h-5 w-5' : 'h-4 w-4'} />
                </span>
                <span className={`whitespace-nowrap text-sm font-semibold text-foreground ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                  {action.label}
                </span>
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Learning Path Progress */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
      >
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Learning Path</h3>
            </div>
            <Badge variant="secondary" className="text-xs">
              {(() => {
                const milestones = [
                  onboardingComplete,
                  studySessions.length >= 1,
                  quizScore !== null,
                  notes.length >= 1,
                  currentStreak >= 3,
                ];
                const completed = milestones.filter(Boolean).length;
                return `${completed}/5 milestones`;
              })()}
            </Badge>
          </div>

          {/* Horizontal Timeline */}
          <div className="relative overflow-x-auto pb-2">
            <div className="flex items-start min-w-[480px] sm:min-w-0 justify-between gap-0">
              {[
                { label: 'Get Started', icon: PlayCircle, done: onboardingComplete },
                { label: 'First Session', icon: MessageSquare, done: studySessions.length >= 1 },
                { label: 'Quiz Taker', icon: Target, done: quizScore !== null },
                { label: 'Note Keeper', icon: BookOpen, done: notes.length >= 1 },
                { label: 'Streak Master', icon: Flame, done: currentStreak >= 3 },
              ].map((milestone, idx, arr) => {
                const isFirstDone = idx === 0
                  ? milestone.done
                  : arr.slice(0, idx).every((m) => m.done);
                const isCurrent = isFirstDone && !milestone.done;
                const isLocked = !isFirstDone;
                const isDone = milestone.done;
                const Icon = milestone.icon;

                return (
                  <div key={milestone.label} className="flex items-start flex-1 last:flex-none">
                    {/* Node + Label */}
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: idx * 0.1 }}
                      className="flex flex-col items-center gap-2"
                    >
                      {/* Circle node */}
                      <div className="relative">
                        {isDone && (
                          <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 glow-emerald-strong"
                          >
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </motion.div>
                        )}
                        {isCurrent && (
                          <motion.div
                            animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0.4)', '0 0 0 10px rgba(16,185,129,0)', '0 0 0 0 rgba(16,185,129,0.4)'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/10"
                          >
                            <Icon className="h-5 w-5 text-emerald-500" />
                          </motion.div>
                        )}
                        {isLocked && (
                          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-muted-foreground/25 bg-muted/30">
                            <Icon className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <span className={`text-xs font-medium text-center leading-tight max-w-[72px] ${isDone ? 'text-emerald-600 dark:text-emerald-400' : isCurrent ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                        {milestone.label}
                      </span>
                    </motion.div>

                    {/* Connector line (not after last item) */}
                    {idx < arr.length - 1 && (
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.5, delay: idx * 0.1 + 0.15 }}
                        className="flex-1 flex items-center mt-[18px] -mx-1 origin-left"
                      >
                        <div
                          className={`h-[2px] w-full rounded-full ${
                            milestone.done
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                              : 'bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/15'
                          }`}
                        />
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Continue Learning Section */}
      {lastCourse && (
        <motion.div variants={fadeUp}>
          <div className="glass rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-0">
              <div className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Continue Learning</h3>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              onClick={() => handleCourseClick(lastCourse)}
              className="w-full text-left p-4 pt-2 flex items-center gap-4 group"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-teal-500/10">
                <BookOpen className="h-6 w-6 text-primary/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{lastCourse.title}</p>
                <p className="text-xs text-muted-foreground truncate">{lastCourse.description}</p>
              </div>
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="shrink-0"
              >
                {/* Visually a button, but the whole row above is already the clickable
                    element — a real nested <button> here is invalid HTML. */}
                <span className={`${buttonVariants({ size: 'sm', variant: 'outline' })} text-primary border-primary/30 group-hover:bg-primary/10 text-xs pointer-events-none`}>
                  Resume
                  <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </motion.div>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Spaced Review + Recent Activity share a row on large screens */}
      <div className="grid gap-4 lg:grid-cols-2 items-stretch">
      {/* Spaced Review Card */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.2 }}
      >
        <div className="glass mesh-gradient gradient-border rounded-xl p-6 card-shadow relative overflow-hidden h-full">
          <div className="relative z-10 flex h-full flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Brain className="h-5 w-5 text-primary" />
                </motion.div>
                <h3 className="font-semibold text-sm">Spaced Review</h3>
              </div>
              {overdueCount > 0 && (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs">
                  {overdueCount} due
                </Badge>
              )}
            </div>

            {overdueCount === 0 ? (
              <div className="flex items-center gap-3 py-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 glow-emerald-strong"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
                <div>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All caught up! 🎉</p>
                  <p className="text-xs text-muted-foreground">No reviews due right now</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{overdueCount} concept{overdueCount !== 1 ? 's' : ''}</span> due for review
                </p>
                <Button
                  size="sm"
                  className="pulse-glow"
                  onClick={() => {
                    navigate('quiz');
                    window.dispatchEvent(new CustomEvent('start-spaced-review'));
                  }}
                >
                  <Brain className="h-4 w-4 mr-1.5" />
                  Start Review
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Mini 7-day study plan — vertical bars like the Weekly Focus
                Time chart on the focus page, anchored to the card bottom */}
            <div className="space-y-2 pt-1 mt-auto">
              <p className="text-xs text-muted-foreground font-medium">7-Day Plan</p>
              <div className="grid grid-cols-7 gap-1.5 items-end h-24">
                {studyPlan.map((day, i) => {
                  const maxCount = Math.max(...studyPlan.map((d) => d.count), 1);
                  const heightPct = day.count > 0 ? Math.max(20, (day.count / maxCount) * 100) : 0;
                  const dayLabel = ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i];
                  return (
                    <div key={day.date} className="flex flex-col items-center justify-end gap-1 h-full">
                      {day.count > 0 ? (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${heightPct}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.05 }}
                          className="w-full rounded-t-md bg-gradient-to-t from-teal-500 to-emerald-400 flex items-start justify-center pt-0.5 min-h-[18px]"
                        >
                          <span className="text-[10px] font-semibold text-white leading-none pt-0.5">{day.count}</span>
                        </motion.div>
                      ) : (
                        <div className="w-full h-1 rounded-full bg-muted/40" />
                      )}
                      <span className="text-[10px] text-muted-foreground/60">{dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recent Activity — derived from real sessions, notes, quizzes, challenges, achievements, and uploads */}
      <motion.div variants={fadeUp} className="flex h-full flex-col gap-4">
        <h3 className="font-semibold text-lg">Recent Activity</h3>
        <div className="glass rounded-xl divide-y divide-border/50 overflow-hidden flex-1">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <ActivityItem key={activity.id} activity={activity} index={index} total={recentActivity.length} />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center"
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"
              >
                <Clock className="h-6 w-6 text-primary/70" />
              </motion.div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Your activity will show up here as you study</p>
                <p className="text-xs text-muted-foreground">Sessions, notes, quizzes, and achievements all leave a trail.</p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
      </div>

      <GradientDivider />

      {/* Stats Row — tiles stand on their own, no wrapping card */}
      <motion.div variants={fadeUp}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: BookOpen, label: 'Active Courses', value: animatedCourses, trend: 'up' as const, change: studySessions.length > 0 ? `${studySessions.length} sessions` : 'No sessions yet', idx: 0 },
              { icon: Flame, label: 'Study Streak', value: `${animatedStreak}d`, trend: currentStreak > 0 ? 'up' as const : 'down' as const, change: bestStreak > 0 ? `Best: ${bestStreak} days` : 'Start studying!', idx: 1 },
              { icon: Clock, label: 'Study Time', value: totalStudyTimeMinutes > 0 ? formattedStudyTime : '0m', trend: 'up' as const, change: totalStudyTimeMinutes > 0 ? 'Keep going!' : 'Start a session', idx: 2 },
              { icon: MessageSquare, label: 'Total Sessions', value: animatedSessions, trend: studySessions.length > 0 ? 'up' as const : 'down' as const, change: studySessions.length > 0 ? `${studySessions.reduce((s, ses) => s + ses.messagesCount, 0)} messages` : 'No messages', idx: 3 },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                className="rounded-xl"
              >
                <TiltCard className="w-full">
                <StatsCard
                  icon={stat.icon}
                  label={stat.label}
                  value={stat.value}
                  trend={stat.trend}
                  change={stat.change}
                  index={stat.idx}
                />
                </TiltCard>
              </motion.div>
            ))}
          </div>
      </motion.div>

      {/* Bookmarked Courses - horizontal scrollable pills */}
      {bookmarkedCourses.length > 0 && (() => {
        const bookmarked = courses.filter(c => bookmarkedCourses.includes(c.id));
        if (bookmarked.length === 0) return null;
        return (
          <motion.div variants={fadeUp} initial="initial" animate="animate">
            <div className="glass rounded-xl p-4 space-y-3 inset-glow">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Bookmarked Courses</h3>
                <Badge variant="secondary" className="text-[10px]">{bookmarked.length}</Badge>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <AnimatePresence mode="popLayout">
                  {bookmarked.map((course) => (
                    <motion.div
                      key={course.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-full bg-primary/10 border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors magnetic-hover"
                      onClick={() => handleCourseClick(course)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open bookmarked course: ${course.title}`}
                    >
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs font-medium text-primary max-w-[120px] truncate">{course.title}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmark(course.id); }}
                        className="ml-1 h-4 w-4 rounded-full flex items-center justify-center hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remove bookmark"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        );
      })()}

      <GradientDivider />

      {/* Your Study Plan - AI Generated */}
      <motion.div id="dashboard-study-plan" variants={fadeUp} className="scroll-mt-24">
        <StudyPlanWidget courses={courses} />
      </motion.div>

      {/* Weekly Study Goals */}
      <motion.div id="dashboard-weekly-goals" variants={fadeUp} className="scroll-mt-24">
        <div className="glass mesh-gradient gradient-border rounded-xl p-6 card-shadow relative overflow-hidden">
          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-sm">Weekly Study Goals</h3>
              </div>
              <div className="flex items-center gap-2">
                {studyGoals.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {weeklyGoalPct}% overall
                  </Badge>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                  setSelectedGoalType('sessions');
                  setGoalTargetInput(String(GOAL_TYPE_CONFIG.sessions.defaultValue));
                  setShowAddGoalDialog(true);
                }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Goal
                </Button>
              </div>
            </div>

            {/* Overall progress bar */}
            {studyGoals.length > 0 && (
              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${weeklyGoalPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Weekly progress
                </p>
              </div>
            )}

            {/* Goals list */}
            <div className="space-y-3 max-h-80 overflow-y-auto">
              <AnimatePresence initial={false}>
                {studyGoals.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-6"
                  >
                    <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No weekly goals set</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Track sessions, quiz scores, hours, and more</p>
                  </motion.div>
                )}
                {studyGoals.map((goal) => {
                  const config = GOAL_TYPE_CONFIG[goal.type];
                  const Icon = config.icon;
                  const pct = goal.target > 0 ? Math.min((goal.currentProgress / goal.target) * 100, 100) : 0;
                  const displayCurrent = goal.type === 'hours'
                    ? goal.currentProgress.toFixed(1)
                    : Math.floor(goal.currentProgress);
                  const isEditing = editingGoalId === goal.id;

                  return (
                    <motion.div
                      key={goal.id}
                      layout
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 40, scale: 0.9 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className="group flex items-center gap-4 p-3 rounded-xl bg-background/40 hover:bg-accent/30 transition-colors"
                    >
                      {/* Progress Ring */}
                      <GoalProgressRing percentage={pct} size={56} strokeWidth={4} />

                      {/* Goal Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-sm font-medium truncate">{config.label}</span>
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="number"
                              value={editingGoalTarget}
                              onChange={(e) => setEditingGoalTarget(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveGoalTarget(goal.id);
                                if (e.key === 'Escape') setEditingGoalId(null);
                              }}
                              className="h-7 w-20 text-xs"
                              min={1}
                              autoFocus
                            />
                            <span className="text-xs text-muted-foreground">{config.unit}</span>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => handleSaveGoalTarget(goal.id)}>Save</Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditGoalTarget(goal)}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5 text-left"
                            title="Click to edit target"
                          >
                            {displayCurrent} / {goal.target} {config.unit}
                          </button>
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => { removeStudyGoal(goal.id); toast('Study goal removed'); }}
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-all shrink-0"
                        aria-label="Delete study goal"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Add Goal Dialog */}
          <AnimatePresence>
            {showAddGoalDialog && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm rounded-xl flex items-center justify-center p-6"
                onClick={() => setShowAddGoalDialog(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 10 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="glass rounded-xl p-6 w-full max-w-sm space-y-4 gradient-border glow-emerald"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Add Weekly Goal</h4>
                    <button onClick={() => setShowAddGoalDialog(false)} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(GOAL_TYPE_CONFIG) as [StudyGoal['type'], typeof GOAL_TYPE_CONFIG[StudyGoal['type']]][]).map(([type, cfg]) => {
                      const TypeIcon = cfg.icon;
                      return (
                        <motion.button
                          key={type}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => {
                            setSelectedGoalType(type);
                            setGoalTargetInput(String(cfg.defaultValue));
                          }}
                          className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all ${
                            selectedGoalType === type
                              ? 'border-primary bg-primary/10 text-primary glow-emerald'
                              : 'border-border hover:border-primary/30 hover:bg-accent/50'
                          }`}
                        >
                          <TypeIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate text-xs font-medium">{cfg.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Target ({GOAL_TYPE_CONFIG[selectedGoalType].unit})
                    </label>
                    <Input
                      type="number"
                      value={goalTargetInput}
                      onChange={(e) => setGoalTargetInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddStudyGoal();
                      }}
                      min={1}
                      placeholder={`Enter ${GOAL_TYPE_CONFIG[selectedGoalType].unit}...`}
                      autoFocus
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAddGoalDialog(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleAddStudyGoal} className="glow-emerald">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Goal
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Weekly Review Summary */}
      <motion.div variants={fadeUp}>
        <WeeklyReviewSummary />
      </motion.div>

      {/* Quick Review Cards */}
      <motion.div variants={fadeUp}>
        <QuickReviewCards />
      </motion.div>

      {/* Learning Analytics */}
      <motion.div variants={fadeUp} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Learning Analytics</h3>
          <Badge variant="secondary" className="text-xs">
            <BarChart3 className="h-3 w-3 mr-1" />
            Insights
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Weekly Activity Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          >
            <div className="glass card-shadow rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3">
                <div className="flex items-center gap-2 text-white">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Weekly Activity</span>
                </div>
                <p className="text-emerald-100/80 text-xs mt-0.5">Study sessions per day this week</p>
              </div>
              <div className="p-4" style={{ minHeight: 220 }}>
                {!hasWeeklyData ? (
                  <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"
                    >
                      <BarChart3 className="h-6 w-6 text-primary/70" />
                    </motion.div>
                    <p className="text-sm text-muted-foreground max-w-[240px]">
                      No sessions logged this week yet — your daily activity will chart here as you study.
                    </p>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyActivityData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'var(--foreground)',
                      }}
                      cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
                    />
                    <Bar
                      dataKey="sessions"
                      fill="url(#barGradient)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#14b8a6" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>

          {/* Mastery Trend Line Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          >
            <div className="glass card-shadow rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-3">
                <div className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-semibold">Mastery Trend</span>
                </div>
                <p className="text-emerald-100/80 text-xs mt-0.5">Overall mastery score over time</p>
              </div>
              <div className="p-4" style={{ minHeight: 220 }}>
                {!hasMasteryData ? (
                  <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"
                    >
                      <TrendingUp className="h-6 w-6 text-primary/70" />
                    </motion.div>
                    <p className="text-sm text-muted-foreground max-w-[240px]">
                      Your mastery trend appears after a couple of weeks of tutoring and quizzes.
                    </p>
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={masteryTrendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'var(--foreground)',
                      }}
                      formatter={(value: number) => [`${value}%`, 'Mastery']}
                    />
                    <Line
                      type="monotone"
                      dataKey="mastery"
                      stroke="url(#lineGradient)"
                      strokeWidth={2.5}
                      dot={{ fill: '#10b981', strokeWidth: 2, stroke: '#fff', r: 4 }}
                      activeDot={{ r: 6, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 }}
                    />
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#14b8a6" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Weak Areas - visible when error report exists and quiz results exist */}
      {weakAreasReport && weakAreasReport.weakAreas && weakAreasReport.weakAreas.length > 0 && quizScore !== null && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Weak Areas</h3>
              <Badge variant="secondary" className="text-xs">
                <Brain className="h-3 w-3 mr-1" />
                AI Insights
              </Badge>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.35 }}
            className="glass card-shadow rounded-xl p-4 space-y-3"
          >
            <div className="space-y-2">
              {weakAreasReport.weakAreas.slice(0, 3).map((wa, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 350, damping: 20 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{wa.concept}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          wa.masteryEstimate <= 2
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {wa.masteryEstimate <= 2 ? 'high' : 'medium'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(wa.masteryEstimate / 5) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.5 + i * 0.1 }}
                          className={`h-full rounded-full ${
                            wa.masteryEstimate <= 2
                              ? 'bg-gradient-to-r from-red-500 to-orange-500'
                              : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{wa.masteryEstimate}/5</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full mt-1"
              onClick={() => {
                setWeakAreasDialogReport(weakAreasReport as unknown as Record<string, unknown>);
                setWeakAreasDialogOpen(true);
              }}
            >
              View Full Report
              <ArrowRight className="h-3.5 w-3.5 ml-2" />
            </Button>
          </motion.div>

          {/* Full report dialog */}
          <Dialog open={weakAreasDialogOpen} onOpenChange={setWeakAreasDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  Weakness Analysis Report
                </DialogTitle>
                <DialogDescription>
                  AI-powered analysis of your incorrect answers
                </DialogDescription>
              </DialogHeader>
              {weakAreasDialogReport && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="glass rounded-xl p-4">
                    <h4 className="text-sm font-semibold mb-2">Overall Assessment</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {(weakAreasDialogReport as Record<string, string>).summary || 'No summary available.'}
                    </p>
                  </div>

                  {/* Study Priority */}
                  {Array.isArray((weakAreasDialogReport as Record<string, string[]>).studyPriority) && (
                    <div className="glass rounded-lg p-3 space-y-2">
                      <h4 className="text-sm font-semibold">Study Priority</h4>
                      {(weakAreasDialogReport as Record<string, string[]>).studyPriority!.slice(0, 3).map((topic, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold">
                            {i + 1}
                          </div>
                          <span className="text-sm">{topic}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Encouragement */}
                  {(weakAreasDialogReport as Record<string, string>).encouragement && (
                    <div className="text-center pt-2 pb-1">
                      <p className="text-sm font-medium gradient-text">
                        {(weakAreasDialogReport as Record<string, string>).encouragement}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setWeakAreasDialogOpen(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>
      )}

      <GradientDivider />

      {/* Study Tips - Carousel */}
      <motion.div variants={fadeUp}>
        <div className="glass rounded-xl p-5 flex gap-4 items-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              <Lightbulb className="h-5 w-5 text-amber-500" />
            </motion.div>
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Study Tip</h4>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Tip {(activeTipIndex % studyTips.length) + 1} of {studyTips.length}
                </span>
                {activeTipIndex % studyTips.length >= baseStudyTips.length && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Your tip
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevTip}
                  className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
                  aria-label="Previous tip"
                >
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  onClick={nextTip}
                  className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
                  aria-label="Next tip"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="relative overflow-hidden">
              <AnimatePresence initial={false} custom={tipDirection} mode="wait">
                <motion.p
                  key={activeTipIndex}
                  custom={tipDirection}
                  variants={tipVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="text-sm text-muted-foreground leading-relaxed pr-1"
                >
                  {studyTips[activeTipIndex % studyTips.length]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Keyboard Shortcut Hint */}
      <motion.div variants={fadeUp} className="flex items-center justify-center gap-1.5 pb-8">
        <Keyboard className="h-3.5 w-3.5 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground/50">
          Press <kbd className="font-mono text-[11px] bg-muted/80 px-1.5 py-0.5 rounded border border-border/50">⌘K</kbd> to search &bull; <kbd className="font-mono text-[11px] bg-muted/80 px-1.5 py-0.5 rounded border border-border/50">⌘1-5</kbd> to navigate
        </p>
      </motion.div>

      {/* Share Stats Modal */}
      <DashboardShareModal open={shareModalOpen} onClose={() => setShareModalOpen(false)} />
    </motion.div>
    </div>
  );
}

// Quick Pomodoro Timer Widget for Dashboard
function EnhancedCourseCard({ course, onClick }: { course: Parameters<typeof CourseCard>[0]['course']; onClick: () => void }) {
  const slideCount = course._count?.slides ?? course.slides?.length ?? 0;
  const removeCourse = useAppStore((s) => s.removeCourse);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/courses/${course.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete course');
      removeCourse(course.id);
      toast.success(`"${course.title}" deleted.`);
      setShowDeleteConfirm(false);
    } catch {
      toast.error('Failed to delete course. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
    <motion.div
      role="button"
      tabIndex={0}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="group text-left w-full cursor-pointer"
    >
      <div className="glass rounded-xl overflow-hidden border border-border/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:glow-emerald card-hover-shadow-lift">
        {/* Thumbnail */}
        <div className="relative h-32 bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-600/10 flex items-center justify-center overflow-hidden">
          <BookOpen className="h-10 w-10 text-primary/40 group-hover:text-primary/60 transition-colors relative z-10" />
          <Badge className="absolute top-3 right-3 text-[10px] z-20" variant="secondary">
            {course.subject}
          </Badge>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
            className="absolute top-3 left-3 z-20 h-7 w-7 rounded-full flex items-center justify-center bg-background/60 text-muted-foreground hover:text-destructive hover:bg-background/80 transition-all"
            aria-label="Delete course"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {/* Gradient overlay that slides up from bottom on hover */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-primary/60 via-primary/20 to-transparent z-10"
            initial={{ opacity: 0, y: '100%' }}
            whileHover={{ opacity: 1, y: '0%' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center z-20">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                Continue <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </motion.div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {course.description}
          </p>
          <p className="text-xs text-muted-foreground">
            {slideCount} slide{slideCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </motion.div>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete &quot;{course.title}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this course and all {slideCount} of its slides.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

/** Weekly Review Summary - shows key metrics from the past week */
function WeeklyReviewSummary() {
  const { studySessions, quizScore, quizTotal, notes, masteryMap } = useAppStore();

  const weeklyData = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const weekSessions = studySessions.filter((s) => new Date(s.date) >= weekAgo);
    const totalMinutes = weekSessions.reduce((sum, s) => sum + s.duration, 0);
    const avgSessionLength = weekSessions.length > 0 ? Math.round(totalMinutes / weekSessions.length) : 0;
    const weekNotesCount = notes.filter((n) => new Date(n.updatedAt) >= weekAgo).length;

    const concepts = Object.values(masteryMap);
    const avgMastery = concepts.length > 0 ? Math.round(concepts.reduce((sum, c) => sum + ((c as Record<string, unknown>).level as number || 0), 0) / concepts.length) : 0;

    const dayActivity: Record<string, number> = {};
    weekSessions.forEach((s) => {
      const day = new Date(s.date).toLocaleDateString('en', { weekday: 'short' });
      dayActivity[day] = (dayActivity[day] || 0) + s.duration;
    });
    const mostProductiveDay = Object.entries(dayActivity).sort((a, b) => b[1] - a[1])[0];

    return {
      totalSessions: weekSessions.length,
      totalMinutes,
      avgSessionLength,
      weekNotes: weekNotesCount,
      avgMastery,
      mostProductiveDay: mostProductiveDay ? mostProductiveDay[0] : 'N/A',
    };
  }, [studySessions, notes, masteryMap]);

  const hasData = weeklyData.totalSessions > 0 || weeklyData.weekNotes > 0;

  return (
    <div className="glass card-shadow rounded-xl p-5 glass-card-shine card-hover-shadow-lift relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-20 pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Weekly Review</h3>
              <p className="text-[10px] text-muted-foreground">Last 7 days summary</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {hasData ? 'Active' : 'No data'}
          </Badge>
        </div>

        {hasData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary tabular-nums">{weeklyData.totalSessions}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sessions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary tabular-nums">{weeklyData.totalMinutes > 60 ? `${Math.round(weeklyData.totalMinutes / 60)}h` : `${weeklyData.totalMinutes}m`}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Study Time</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary tabular-nums">{weeklyData.avgMastery}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Avg Mastery</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary tabular-nums">{weeklyData.weekNotes}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Notes</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">Start studying to see your weekly review</p>
          </div>
        )}

        {hasData && (
          <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>
              {weeklyData.avgSessionLength > 0 ? `Avg session: ${weeklyData.avgSessionLength} min` : 'No sessions yet'}
              {weeklyData.mostProductiveDay !== 'N/A' ? ` · Most productive: ${weeklyData.mostProductiveDay}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Quick Review Cards — shows concepts to review based on mastery data */
function QuickReviewCards() {
  const { masteryMap, navigate } = useAppStore();

  // Compute weak concepts from mastery map
  const weakConcepts = (() => {
    const entries = Object.entries(masteryMap)
      .map(([concept, data]) => ({
        concept,
        level: (data as Record<string, unknown>).level as number || 0,
        attempts: (data as Record<string, unknown>).attempts as number || 0,
      }))
      .filter((c) => c.level < 60 && c.attempts > 0)
      .sort((a, b) => a.level - b.level);

    return entries.slice(0, 4);
  })();

  if (weakConcepts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <Target className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Needs Review</h3>
          <p className="text-[10px] text-muted-foreground">Concepts with low mastery</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {weakConcepts.map((c, i) => (
          <motion.div
            key={c.concept}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02 }}
            className="glass rounded-xl p-3 cursor-pointer card-hover-shadow-lift"
            onClick={() => navigate('tutor')}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">{c.concept}</span>
              <span className={`text-[10px] font-bold tabular-nums ${c.level < 30 ? 'text-red-500' : c.level < 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {c.level}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${c.level}%` }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                style={{ background: c.level < 30 ? '#ef4444' : c.level < 50 ? '#f59e0b' : '#10b981' }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {c.attempts} attempt{c.attempts !== 1 ? 's' : ''} · Click to review
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
