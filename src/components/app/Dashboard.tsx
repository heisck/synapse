'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/appStore';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { StatsCard } from './StatsCard';
import { CourseCard } from './CourseCard';
import { EmptyState } from './EmptyState';

const topicChips = ['Cell Biology', 'Organic Chemistry', 'Data Structures', 'Physics'];

const recentActivity = [
  { id: '1', type: 'session' as const, text: 'Completed Cell Biology session', time: Date.now() - 2 * 60 * 60 * 1000 },
  { id: '2', type: 'quiz' as const, text: 'Scored 85% on Organic Chemistry quiz', time: Date.now() - 24 * 60 * 60 * 1000 },
  { id: '3', type: 'upload' as const, text: 'Uploaded "Data Structures" slides', time: Date.now() - 48 * 60 * 60 * 1000 },
  { id: '4', type: 'session' as const, text: 'Started Physics tutoring session', time: Date.now() - 72 * 60 * 60 * 1000 },
  { id: '5', type: 'quiz' as const, text: 'Achieved 92% mastery on Linear Algebra', time: Date.now() - 96 * 60 * 60 * 1000 },
  { id: '6', type: 'session' as const, text: 'Reviewed Quantum Mechanics flashcards', time: Date.now() - 120 * 60 * 60 * 1000 },
];

const activityIcons: Record<string, typeof MessageSquare> = {
  session: MessageSquare,
  quiz: Target,
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

const studyTips = [
  'Spaced repetition is 40% more effective than cramming. Review your notes at increasing intervals for better long-term retention.',
  'Try the Feynman Technique: explain a concept in simple terms as if teaching someone new. If you stumble, that\'s where to focus.',
  'Take a 5-minute break every 25 minutes using the Pomodoro technique. Your brain consolidates learning during rest periods.',
  'Active recall beats passive reading. Close your notes and try to write down everything you remember before checking.',
  'Teaching someone else is the fastest way to identify gaps in your own understanding. Find a study partner today.',
];

const weeklyGoals = [
  { label: 'Complete Cell Biology', status: 'done' as const },
  { label: 'Practice Calculus', status: 'in-progress' as const },
  { label: 'Review Notes', status: 'pending' as const },
];

const weeklyActivityData = [
  { day: 'Mon', sessions: 3 },
  { day: 'Tue', sessions: 5 },
  { day: 'Wed', sessions: 2 },
  { day: 'Thu', sessions: 7 },
  { day: 'Fri', sessions: 4 },
  { day: 'Sat', sessions: 6 },
  { day: 'Sun', sessions: 1 },
];

const masteryTrendData = [
  { week: 'Week 1', mastery: 45 },
  { week: 'Week 2', mastery: 52 },
  { week: 'Week 3', mastery: 61 },
  { week: 'Week 4', mastery: 68 },
  { week: 'Week 5', mastery: 74 },
  { week: 'Week 6', mastery: 78 },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

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

// Slide-in activity item
function ActivityItem({ activity, index }: { activity: typeof recentActivity[number]; index: number }) {
  const Icon = activityIcons[activity.type] ?? Clock;
  const timeLabel = formatRelativeTime(activity.time);
  const isRecent = (Date.now() - activity.time) < 24 * 60 * 60 * 1000;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
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

// Study streak helper
function getStudyStreak(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const streakData = localStorage.getItem('synapse-study-streak');
    if (!streakData) return 0;
    const parsed = JSON.parse(streakData) as { lastStudyDate: string; streak: number };
    const lastDate = new Date(parsed.lastStudyDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
    // Allow same-day or yesterday to count
    if (diffDays <= 1) return parsed.streak;
    return 0;
  } catch {
    return 0;
  }
}

function getLastSessionTime(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem('synapse-last-session');
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}

export function Dashboard() {
  const {
    courses,
    userName,
    navigate,
    setActiveTopic,
    setActiveSession,
    setActiveCourse,
    setActiveSlides,
    setCurrentSlideIndex,
  } = useAppStore();

  const [progressValue, setProgressValue] = useState(0);
  const [activeTipIndex, setActiveTipIndex] = useState(() => Math.floor(Math.random() * studyTips.length));
  const [tipDirection, setTipDirection] = useState<'left' | 'right'>('left');
  const [studyStreak] = useState(() => getStudyStreak());
  const [toastShown, setToastShown] = useState(false);

  // Animate progress bar on mount
  useEffect(() => {
    const timer = setTimeout(() => setProgressValue(73), 300);
    return () => clearTimeout(timer);
  }, []);

  // Rotate study tips
  useEffect(() => {
    const interval = setInterval(() => {
      setTipDirection('left');
      setActiveTipIndex((prev) => (prev + 1) % studyTips.length);
    }, 12000);

    return () => clearInterval(interval);
  }, []);

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
          style: {
            border: '1px solid oklch(0.627 0.194 149.214 / 0.3)',
            background: 'oklch(0.995 0.002 155)',
            color: 'oklch(0.185 0.02 155)',
          },
          className: '!border-l-4 !border-l-emerald-500',
        });
        setToastShown(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [toastShown]);

  // Tip navigation
  const nextTip = useCallback(() => {
    setTipDirection('left');
    setActiveTipIndex((prev) => (prev + 1) % studyTips.length);
  }, []);

  const prevTip = useCallback(() => {
    setTipDirection('right');
    setActiveTipIndex((prev) => (prev - 1 + studyTips.length) % studyTips.length);
  }, []);

  const handleStartSession = (topic: string) => {
    setActiveTopic(topic);
    setActiveSession(`session-${Date.now()}`);
    // Record session time
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-last-session', String(Date.now()));
    }
    navigate('tutor');
  };

  const handleCourseClick = (course: (typeof courses)[number]) => {
    setActiveCourse(course);
    if (course.slides) {
      setActiveSlides(course.slides);
    }
    setCurrentSlideIndex(0);
    navigate('course-detail');
  };

  const greeting = getGreeting();
  const displayName = userName || 'Student';
  const showViewAll = courses.length > 3;
  const displayedCourses = courses.slice(0, 3);
  const lastCourse = courses.length > 0 ? courses[0] : null;

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

  // Glow sweep keyframes for quick start card
  const glowSweep = useMemo(() => ({
    initial: { opacity: 0 },
    animate: {
      opacity: [0, 0.6, 0.3, 0.6, 0.3, 0.4, 0],
      transition: { duration: 2.5, ease: 'easeInOut', delay: 0.3 },
    },
  }), []);

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-8 pt-2 lg:pt-4"
    >
      {/* Welcome Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 pl-14 lg:pl-0">
          <div className="flex items-center gap-3 flex-wrap">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
              className="text-2xl lg:text-3xl font-bold"
            >
              {greeting},{' '}
              <motion.span
                initial={{ opacity: 0, backgroundPosition: '200% center' }}
                animate={{ opacity: 1, backgroundPosition: '0% center' }}
                transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                className="gradient-text inline-block bg-[length:200%_auto]"
              >
                {displayName}
              </motion.span>
            </motion.h1>
            {studyStreak > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.8, type: 'spring', stiffness: 400, damping: 20 }}
                className="flex items-center gap-1 text-orange-500 bg-orange-500/10 px-2.5 py-0.5 rounded-full"
              >
                <Flame className="h-4 w-4" />
                <span className="text-xs font-bold">{studyStreak} day streak</span>
              </motion.div>
            )}
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-muted-foreground text-sm"
          >
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center gap-2 pl-14 lg:pl-0"
        >
          <ThemeToggle />
          <Button onClick={() => handleStartSession('General Study')} size="sm">
            <Sparkles className="h-4 w-4 mr-2" />
            Start Session
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('upload')}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Slides
          </Button>
        </motion.div>
      </motion.div>

      <GradientDivider />

      {/* Quick Start Card */}
      <motion.div variants={fadeUp}>
        <div className="relative group">
          {/* Animated glow border sweep on mount */}
          <motion.div
            {...glowSweep}
            className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 blur-sm"
          />
          <div
            className="relative overflow-hidden rounded-xl p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white cursor-pointer"
            onClick={() => handleStartSession("Today's Topic")}
          >
            <div className="absolute inset-0 bg-grid-pattern opacity-10" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-emerald-100 text-sm font-medium">Quick Start</p>
                <h2 className="text-xl font-bold">Continue learning with your AI Tutor</h2>
                <p className="text-emerald-100/80 text-sm">
                  Pick a topic below or upload new study material to get started
                </p>
                <div className="flex items-center gap-2 pt-1 text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                  Start now <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="h-20 w-20 rounded-2xl bg-white/10 flex items-center justify-center animate-float">
                  <Zap className="h-10 w-10 text-white/80" />
                </div>
              </div>
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
                <Button size="sm" variant="outline" className="text-primary border-primary/30 hover:bg-primary/10 text-xs">
                  Resume
                  <ArrowRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </motion.div>
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Topic Chips */}
      <motion.div variants={fadeUp} className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Popular Topics</h3>
        <div className="flex flex-wrap gap-2">
          {topicChips.map((topic) => (
            <button
              key={topic}
              onClick={() => handleStartSession(topic)}
              className="rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
            >
              {topic}
            </button>
          ))}
        </div>
      </motion.div>

      <GradientDivider />

      {/* Stats Row */}
      <motion.div variants={fadeUp}>
        <div className="glass rounded-xl p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard
              icon={BookOpen}
              label="Active Courses"
              value={courses.length}
              trend="up"
              change="+2 this week"
              index={0}
            />
            <StatsCard
              icon={Target}
              label="Mastery Rate"
              value="78%"
              trend="up"
              change="+5%"
              index={1}
            />
            <StatsCard
              icon={Zap}
              label="Sessions"
              value="24"
              trend="up"
              change="+3 this week"
              index={2}
            />
            <StatsCard
              icon={MessageSquare}
              label="Questions"
              value="156"
              trend="down"
              change="-2 today"
              index={3}
            />
          </div>
        </div>
      </motion.div>

      <GradientDivider />

      {/* Learning Progress */}
      <motion.div variants={fadeUp}>
        <div className="glass rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Learning Progress</h3>
            <Badge variant="secondary" className="text-xs">
              This Week
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Weekly completion</span>
              <span className="font-semibold text-primary">{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-3" />
            <p className="text-xs text-muted-foreground">
              5 of 7 goals met this week
            </p>
          </div>

          {/* Goals list */}
          <div className="space-y-3 pt-1">
            {weeklyGoals.map((goal) => (
              <div key={goal.label} className="flex items-center gap-3">
                {goal.status === 'done' && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
                {goal.status === 'in-progress' && (
                  <Loader2 className="h-4 w-4 text-teal-500 shrink-0 animate-spin" />
                )}
                {goal.status === 'pending' && (
                  <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    goal.status === 'done'
                      ? 'text-muted-foreground line-through'
                      : goal.status === 'in-progress'
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground'
                  }`}
                >
                  {goal.label}
                </span>
                {goal.status === 'in-progress' && (
                  <Badge variant="outline" className="text-[10px] ml-auto text-teal-600 border-teal-200 dark:border-teal-800">
                    In Progress
                  </Badge>
                )}
                {goal.status === 'done' && (
                  <span className="text-[10px] text-emerald-600 ml-auto font-medium">Done</span>
                )}
                {goal.status === 'pending' && (
                  <span className="text-[10px] text-muted-foreground ml-auto">Pending</span>
                )}
              </div>
            ))}
          </div>
        </div>
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
            <div className="glass rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3">
                <div className="flex items-center gap-2 text-white">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Weekly Activity</span>
                </div>
                <p className="text-emerald-100/80 text-xs mt-0.5">Study sessions per day this week</p>
              </div>
              <div className="p-4" style={{ minHeight: 220 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyActivityData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'hsl(var(--foreground))',
                      }}
                      cursor={{ fill: 'hsl(var(--accent))', opacity: 0.4 }}
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
              </div>
            </div>
          </motion.div>

          {/* Mastery Trend Line Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          >
            <div className="glass rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-3">
                <div className="flex items-center gap-2 text-white">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-semibold">Mastery Trend</span>
                </div>
                <p className="text-emerald-100/80 text-xs mt-0.5">Overall mastery score over time</p>
              </div>
              <div className="p-4" style={{ minHeight: 220 }}>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={masteryTrendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'hsl(var(--foreground))',
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
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <GradientDivider />

      {/* My Courses */}
      <motion.div variants={fadeUp} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">My Courses</h3>
          <div className="flex items-center gap-2">
            {showViewAll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('courses')}
                className="text-primary hover:text-primary"
              >
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate('upload')}>
              <Upload className="h-4 w-4 mr-1" />
              Add New
            </Button>
          </div>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Upload your first set of slides to create a course and start learning with your AI tutor."
            actionLabel="Upload Slides"
            onAction={() => navigate('upload')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedCourses.map((course, i) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
              >
                <EnhancedCourseCard
                  course={course}
                  onClick={() => handleCourseClick(course)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <GradientDivider />

      {/* Recent Activity */}
      <motion.div variants={fadeUp} className="space-y-4">
        <h3 className="font-semibold text-lg">Recent Activity</h3>
        <div className="glass rounded-xl divide-y divide-border/50 overflow-hidden">
          {recentActivity.map((activity, index) => (
            <ActivityItem key={activity.id} activity={activity} index={index} />
          ))}
        </div>
      </motion.div>

      <GradientDivider />

      {/* Study Tips - Carousel */}
      <motion.div variants={fadeUp}>
        <div className="glass rounded-xl p-5 flex gap-4 items-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <Lightbulb className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Study Tip</h4>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Tip {activeTipIndex + 1} of {studyTips.length}
                </span>
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
                  {studyTips[activeTipIndex]}
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
    </motion.div>
  );
}

// Enhanced Course Card with gradient overlay and animated Open button
function EnhancedCourseCard({ course, onClick }: { course: Parameters<typeof CourseCard>[0]['course']; onClick: () => void }) {
  const slideCount = course._count?.slides ?? course.slides?.length ?? 0;

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group text-left w-full"
    >
      <div className="glass rounded-xl overflow-hidden border border-border/50 transition-shadow hover:shadow-lg hover:shadow-primary/5">
        {/* Thumbnail */}
        <div className="relative h-32 bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-600/10 flex items-center justify-center overflow-hidden">
          <BookOpen className="h-10 w-10 text-primary/40 group-hover:text-primary/60 transition-colors relative z-10" />
          <Badge className="absolute top-3 right-3 text-[10px] z-20" variant="secondary">
            {course.subject}
          </Badge>
          {/* Gradient overlay on hover */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-emerald-900/30 to-transparent"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
          {/* Animated Open button reveal */}
          <motion.div
            className="absolute bottom-3 right-3 z-20"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            whileHover={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-white/90 dark:bg-black/60 text-foreground px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-2 group-hover:translate-y-0">
              Open <ArrowRight className="h-3 w-3" />
            </span>
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
    </motion.button>
  );
}