'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from 'framer-motion';
import {
  Mail,
  Palette,
  Gauge,
  Eye,
  BookOpen,
  MessageSquare,
  Brain,
  LogOut,
  Settings,
  Lightbulb,
  Target,
  Zap,
  Trophy,
  Star,
  Flame,
  Rocket,
  Compass,
  MessageCircle,
  TrendingUp,
  BarChart3,
  Sparkles,
  Lock,
  Activity,
  Footprints,
  GraduationCap,
  Database,
  Pencil,
  FolderOpen,
  Timer,
  Sunrise,
  CheckCircle2,
  Users,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Share2,
  CalendarDays,
  ChevronDown,
  Copy,
  ExternalLink,
  X,
  CheckCheck as CheckCheckIcon,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/appStore';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { clearSessionStorage } from '@/hooks/useSessionPersistence';
import { useStudyStreak, useTotalStudyTime } from '@/hooks/useStudyTracker';
import { useSpacedRepetition } from '@/hooks/useSpacedRepetition';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { Achievement, StudySession } from '@/types';

/* ── Dynamic Icon Map ── */
const iconMap: Record<string, typeof Eye> = {
  Footprints,
  BookOpen,
  GraduationCap,
  Star,
  Trophy,
  Zap,
  Flame,
  Rocket,
  Brain,
  Database,
  Pencil,
  FolderOpen,
  Timer,
  Sunrise,
};

/* ── Animation Variants ── */
const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

// Helper: draw rounded rectangle on canvas
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const achievementGridStagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const achievementCardVariant = {
  initial: { opacity: 0, scale: 0.85, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } },
};

/* ── Animated Number Component ── */
function AnimatedNumber({ value }: { value: string }) {
  const numericValue = parseInt(value, 10);
  const motionVal = useMotionValue(0);
  const display = useTransform(motionVal, (v) => Math.round(v).toString());
  const spring = useSpring(motionVal, { stiffness: 100, damping: 30, mass: 1 });

  useEffect(() => {
    if (!isNaN(numericValue)) {
      motionVal.set(numericValue);
    }
  }, [numericValue, motionVal]);

  // Subscribe to the spring value for rendering
  const [displayValue, setDisplayValue] = useState('0');
  useEffect(() => {
    const unsubscribe = spring.on('change', (v) => {
      setDisplayValue(Math.round(v).toString());
    });
    return unsubscribe;
  }, [spring]);

  if (isNaN(numericValue)) return <>{value}</>;
  return <>{displayValue}</>;
}

/* ── Static Data ── */
const styleLabels: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  visual: { icon: Eye, label: 'Visual', color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  auditory: { icon: MessageSquare, label: 'Auditory', color: 'bg-teal-500/10 text-teal-700 dark:text-teal-400' },
  reading: { icon: BookOpen, label: 'Reading/Writing', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  kinesthetic: { icon: Zap, label: 'Kinesthetic', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
};

const paceLabels: Record<string, { label: string; desc: string; icon: typeof Gauge }> = {
  slow: { label: 'Slow & Steady', desc: 'Thorough explanations, extra examples', icon: Gauge },
  steady: { label: 'Balanced', desc: 'Moderate pace with periodic reviews', icon: Activity },
  fast: { label: 'Fast Track', desc: 'Concise explanations, quick progression', icon: Rocket },
};

const categoryTabs: Array<{ key: 'all' | Achievement['category']; label: string; icon?: typeof Users }> = [
  { key: 'all', label: 'All' },
  { key: 'study', label: 'Study' },
  { key: 'quiz', label: 'Quiz' },
  { key: 'streak', label: 'Streak' },
  { key: 'mastery', label: 'Mastery' },
  { key: 'social', label: 'Social', icon: Users },
];

const rarityStyles: Record<Achievement['rarity'], { border: string; bg: string; badgeBg: string; badgeText: string; text: string; glow: string }> = {
  common: { border: 'border-gray-500/30', bg: 'bg-gray-500/10', badgeBg: 'bg-gray-500/10', badgeText: 'text-gray-600 dark:text-gray-400', text: 'text-gray-500', glow: '' },
  rare: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', badgeBg: 'bg-emerald-500/10', badgeText: 'text-emerald-600 dark:text-emerald-400', text: 'text-emerald-500', glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]' },
  epic: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', badgeBg: 'bg-blue-500/10', badgeText: 'text-blue-600 dark:text-blue-400', text: 'text-blue-500', glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]' },
  legendary: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', badgeBg: 'bg-purple-500/10', badgeText: 'text-purple-600 dark:text-purple-400', text: 'text-purple-500', glow: 'hover:shadow-[0_0_25px_rgba(168,85,247,0.2)]' },
};

/* ── Heatmap Generator (from real study sessions) ── */
function generateHeatmap(sessions: { date: string }[]): { opacity: number }[][] {
  const weeks = 5;
  const days = 7;

  // Count sessions per date string (YYYY-MM-DD)
  const dateCounts: Record<string, number> = {};
  for (const s of sessions) {
    const d = s.date.startsWith('T') ? s.date.split('T')[0] : s.date;
    dateCounts[d] = (dateCounts[d] || 0) + 1;
  }

  // Build a list of the past 35 days (week 0 = this week, week 4 = 4 weeks ago)
  const today = new Date();
  // Find the Monday of the current week
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + mondayOffset);

  // grid[weekIdx][dayIdx]: weekIdx 0=4w ago, 4=this week; dayIdx 0=Mon..6=Sun
  const grid: { opacity: number }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: { opacity: number }[] = [];
    for (let d = 0; d < days; d++) {
      // Date for this cell
      const cellDate = new Date(thisMonday);
      cellDate.setDate(thisMonday.getDate() + (w - weeks + 1) * 7 + d);
      const dateStr = cellDate.toISOString().split('T')[0];
      const count = dateCounts[dateStr] || 0;

      // Intensity: 0=none, 1=1 session, 2=2-3, 3=4+
      let intensity = 0;
      if (count >= 4) intensity = 3;
      else if (count >= 2) intensity = 2;
      else if (count >= 1) intensity = 1;

      const opacityMap = [0, 0.25, 0.5, 0.8];
      week.push({ opacity: opacityMap[intensity] });
    }
    grid.push(week);
  }
  return grid;
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ── Heatmap Cell Component ── */
function HeatmapCell({ opacity, weekIdx, dayIdx }: { opacity: number; weekIdx: number; dayIdx: number }) {
  const [hovered, setHovered] = useState(false);
  const hasActivity = opacity > 0;
  const levelLabel = hasActivity
    ? opacity >= 0.8 ? 'High' : opacity >= 0.5 ? 'Medium' : 'Low'
    : 'No activity';

  return (
    <div className="relative flex-1">
      <motion.div
        className={`aspect-square rounded-sm cursor-default transition-all duration-300 ${
          hasActivity ? 'hover:scale-125 hover:rounded-md' : 'bg-muted/40 dark:bg-muted/20'
        }`}
        style={
          hasActivity
            ? {
                backgroundColor: `oklch(0.627 0.194 149.214 / ${opacity})`,
              }
            : undefined
        }
        whileHover={hasActivity ? { scale: 1.3, zIndex: 10 } : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <AnimatePresence>
        {hovered && hasActivity && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 px-2 py-1 rounded-md bg-popover border border-border shadow-lg text-[10px] font-medium whitespace-nowrap pointer-events-none"
          >
            {levelLabel} activity
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Achievement Card Component ── */
function AchievementCard({ achievement, index }: { achievement: Achievement; index: number }) {
  const isUnlocked = achievement.unlockedAt !== null;
  const IconComp = iconMap[achievement.icon] || Star;
  const rarity = rarityStyles[achievement.rarity];

  return (
    <motion.div
      variants={achievementCardVariant}
      className={`relative rounded-xl border ${rarity.border} overflow-hidden glass-hover transition-shadow duration-300 ${
        rarity.glow
      } ${
        isUnlocked ? rarity.bg : 'bg-muted/30 dark:bg-muted/20 border-border/50'
      }`}
    >
      {/* Shimmer overlay for unlocked */}
      {isUnlocked && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute inset-0 -translate-x-full"
            animate={{ translateX: ['0%', '100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: index * 0.2 }}
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
            }}
          />
        </div>
      )}

      <div className="relative p-3 sm:p-4 space-y-2.5">
        {/* Icon + Rarity Badge */}
        <div className="flex items-start justify-between gap-2">
          <div
            className={`flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl transition-all duration-300 ${
              isUnlocked
                ? `${rarity.bg} ring-2 ${rarity.border}`
                : 'bg-muted/50 dark:bg-muted/30'
            }`}
          >
            {isUnlocked ? (
              <IconComp className={`h-5 w-5 sm:h-6 sm:w-6 ${rarity.text}`} />
            ) : (
              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/30" />
            )}
          </div>
          <Badge
            variant="outline"
            className={`text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider border-0 ${rarity.badgeBg} ${rarity.badgeText} shrink-0`}
          >
            {achievement.rarity}
          </Badge>
        </div>

        {/* Title + Description */}
        <div className="min-w-0 space-y-0.5">
          <h4 className={`text-xs sm:text-sm font-semibold truncate ${isUnlocked ? 'text-foreground' : 'text-muted-foreground/60'}`}>
            {achievement.title}
          </h4>
          <p className={`text-[10px] sm:text-xs leading-relaxed line-clamp-2 ${isUnlocked ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
            {achievement.description}
          </p>
        </div>

        {/* Progress / Unlock Date */}
        {isUnlocked ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1"
          >
            <CheckCircle2 className="h-3 w-3" />
            {format(new Date(achievement.unlockedAt!), 'MMM d, yyyy')}
          </motion.p>
        ) : (
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted/60 dark:bg-muted/40 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-muted-foreground/30 to-muted-foreground/50"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, achievement.progress)}%` }}
                transition={{ duration: 0.6, delay: index * 0.04, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground/50">
              {Math.round(achievement.progress)}% complete
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Component ── */
export function ProfileView() {
  const { userName, userEmail, learnerProfile, hardSubjects, alwaysConfuses, bestTeachingStyle, navigate, setOnboardingComplete, achievements, studySessions, masteryMap, quizScore, quizTotal } = useAppStore();
  const { current: currentStreak, best: bestStreak } = useStudyStreak();
  const totalStudyTime = useTotalStudyTime();
  const { items: srItems, getStudyPlan } = useSpacedRepetition();
  const calendarPlan = getStudyPlan(14);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const totalTrackedItems = srItems.length;
  const nextReviewTime = srItems.length > 0
    ? new Date(Math.min(...srItems.map((item) => item.nextReview)))
    : null;

  const [activeCategory, setActiveCategory] = useState<'all' | Achievement['category']>('all');
  const [studyStatsExpanded, setStudyStatsExpanded] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'SL';

  const heatmap = useMemo(() => generateHeatmap(studySessions), [studySessions]);
  const weekLabels = ['4w ago', '3w ago', '2w ago', 'Last week', 'This week'];

  // Filtered achievements
  const filteredAchievements = useMemo(() => {
    if (activeCategory === 'all') return achievements;
    return achievements.filter((a) => a.category === activeCategory);
  }, [achievements, activeCategory]);

  const unlockedCount = achievements.filter((a) => a.unlockedAt !== null).length;

  // Real stats data
  const statsData = useMemo(() => {
    const hours = Math.floor(totalStudyTime / 60);
    const mins = totalStudyTime % 60;
    const totalMastery = Object.values(useAppStore.getState().masteryMap);
    const avgMastery = totalMastery.length > 0
      ? Math.round(totalMastery.reduce((s, c) => s + c.level, 0) / totalMastery.length)
      : 0;
    const totalMessages = studySessions.reduce((s, ses) => s + ses.messagesCount, 0);
    return [
      { label: 'Total Sessions', value: String(studySessions.length), icon: BookOpen, change: `${hours}h ${mins}m studied` },
      { label: 'Mastery Rate', value: avgMastery > 0 ? `${avgMastery}%` : 'N/A', icon: Target, change: `${totalMastery.length} concepts tracked` },
      { label: 'Messages Sent', value: String(totalMessages), icon: MessageCircle, change: `${studySessions.length} sessions` },
      { label: 'Study Streak', value: currentStreak > 0 ? `${currentStreak} days` : '0 days', icon: Flame, change: bestStreak > 0 ? `Best: ${bestStreak} days` : 'Start studying!' },
    ];
  }, [studySessions, currentStreak, bestStreak, totalStudyTime]);

  // Dynamic skill bars from real data
  const computedSkillBars = useMemo(() => {
    const masteryValues = Object.values(masteryMap);
    const conceptCount = masteryValues.length;

    // Comprehension: average mastery level (0-100, level is 1-5 so multiply by 20)
    const comprehension = masteryValues.length > 0
      ? Math.min(100, Math.round(masteryValues.reduce((s, c) => s + c.level, 0) / masteryValues.length * 20))
      : 0;

    // Problem Solving: quiz performance or fallback to mastery average
    const problemSolving = quizScore !== null && quizTotal !== null && quizTotal > 0
      ? Math.min(100, Math.round((quizScore / quizTotal) * 100))
      : comprehension;

    // Knowledge Base: (concepts learned / 50) * 100
    const knowledgeBase = Math.min(100, Math.round((conceptCount / 50) * 100));

    // Consistency: based on streak (max streak of 14+ = 100)
    const consistency = Math.min(100, Math.round((currentStreak / 14) * 100));

    // Engagement: total study sessions / 20 * 100
    const engagement = Math.min(100, Math.round((studySessions.length / 20) * 100));

    return [
      { name: 'Comprehension', value: comprehension },
      { name: 'Problem Solving', value: problemSolving },
      { name: 'Knowledge Base', value: knowledgeBase },
      { name: 'Consistency', value: consistency },
      { name: 'Engagement', value: engagement },
    ];
  }, [masteryMap, quizScore, quizTotal, currentStreak, studySessions.length]);

  const handleReconfigure = () => {
    setOnboardingComplete(false);
    navigate('onboarding');
  };

  const handleSignOut = () => {
    clearSessionStorage();
    navigate('landing');
  };

  // Export study statistics as image using Canvas API
  const handleExportStatsImage = useCallback(() => {
    const canvas = document.createElement('canvas');
    const width = 600;
    const height = 340;
    canvas.width = width * 2; // 2x for retina
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error('Canvas not supported');
      return;
    }
    ctx.scale(2, 2);

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#059669');
    grad.addColorStop(0.5, '#0d9488');
    grad.addColorStop(1, '#0f766e');
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, width, height, 20);
    ctx.fill();

    // Subtle pattern overlay
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < width; i += 20) {
      for (let j = 0; j < height; j += 20) {
        ctx.fillRect(i, j, 10, 10);
      }
    }

    // Title
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧠 SynapseLearn Study Stats', width / 2, 48);

    // User name
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '15px system-ui, -apple-system, sans-serif';
    ctx.fillText(userName || 'Student', width / 2, 74);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 92);
    ctx.lineTo(width - 60, 92);
    ctx.stroke();

    // Stats data
    const studyHours = Math.floor(totalStudyTime / 60);
    const quizAccuracy = quizTotal && quizTotal > 0 ? Math.round((quizScore! / quizTotal) * 100) : 0;
    const masteryEntries = Object.values(masteryMap);
    const avgMastery = masteryEntries.length > 0
      ? (masteryEntries.reduce((s, c) => s + c.level, 0) / masteryEntries.length).toFixed(1)
      : '0.0';

    const stats = [
      { label: 'Study Hours', value: `${studyHours}h`, icon: '📚' },
      { label: 'Quiz Score', value: `${quizAccuracy}%`, icon: '🎯' },
      { label: 'Streak', value: `${currentStreak} days`, icon: '🔥' },
      { label: 'Mastery', value: `${avgMastery}/5`, icon: '⚡' },
    ];

    const cardW = 110;
    const cardH = 110;
    const gap = 20;
    const totalW = stats.length * cardW + (stats.length - 1) * gap;
    const startX = (width - totalW) / 2;
    const startY = 115;

    stats.forEach((stat, i) => {
      const x = startX + i * (cardW + gap);

      // Card background
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      roundRect(ctx, x, startY, cardW, cardH, 14);
      ctx.fill();

      // Card border
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      roundRect(ctx, x, startY, cardW, cardH, 14);
      ctx.stroke();

      // Icon
      ctx.font = '24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(stat.icon, x + cardW / 2, startY + 38);

      // Value
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.fillText(stat.value, x + cardW / 2, startY + 70);

      // Label
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(stat.label, x + cardW / 2, startY + 92);
    });

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Generated by SynapseLearn · AI-Powered Learning', width / 2, height - 22);

    // Download
    const link = document.createElement('a');
    link.download = `synapselearn-stats-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Stats image exported!');
  }, [userName, totalStudyTime, quizScore, quizTotal, currentStreak, masteryMap]);

  const styleInfo = learnerProfile ? styleLabels[learnerProfile.learningStyle] : null;
  const paceInfo = learnerProfile ? paceLabels[learnerProfile.pace] : null;

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-6 pt-2 lg:pt-4 max-w-3xl mx-auto pl-14 lg:pl-0 pb-8"
    >
      {/* ════════════════════════════════════════════
          1. Profile Header
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl overflow-hidden gradient-border card-shadow">
        {/* Animated gradient header strip */}
        <div className="h-24 sm:h-28 mesh-gradient relative overflow-hidden">
          <motion.div
            className="absolute inset-0"
            animate={{
              background: [
                'radial-gradient(ellipse 80% 50% at 20% 40%, rgba(16,185,129,0.12) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 80% 20%, rgba(20,184,166,0.1) 0%, transparent 50%)',
                'radial-gradient(ellipse 80% 50% at 60% 60%, rgba(16,185,129,0.15) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 30% 30%, rgba(20,184,166,0.12) 0%, transparent 50%)',
                'radial-gradient(ellipse 80% 50% at 20% 40%, rgba(16,185,129,0.12) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 80% 20%, rgba(20,184,166,0.1) 0%, transparent 50%)',
              ],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 grid-pattern opacity-30" />
        </div>
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 -mt-12 relative z-10">
          <div className="flex items-start gap-5">
            {/* Avatar with pulsing glow ring */}
            <div className="relative">
              <motion.div
                className="absolute -inset-1 rounded-full"
                animate={{
                  boxShadow: [
                    '0 0 8px rgba(16,185,129,0.2), 0 0 16px rgba(16,185,129,0.1)',
                    '0 0 16px rgba(16,185,129,0.4), 0 0 32px rgba(16,185,129,0.2)',
                    '0 0 8px rgba(16,185,129,0.2), 0 0 16px rgba(16,185,129,0.1)',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <Avatar className="h-20 w-20 ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-background shrink-0 relative z-10">
                <AvatarFallback className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5 pt-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold gradient-text truncate">
                  {userName || 'Student'}
                </h1>
                <ThemeToggle />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <p className="text-sm truncate">{userEmail || 'student@synapselearn.ai'}</p>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Free Plan
                </Badge>
                {unlockedCount > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-500/20">
                    <Trophy className="h-3 w-3 mr-1" />
                    {unlockedCount} unlocked
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          2. Learning Profile
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8 space-y-5 card-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            <h2 className="text-lg font-semibold gradient-text">Learning Profile</h2>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="ghost" size="sm" onClick={handleReconfigure} className="text-muted-foreground hover:text-foreground transition-colors">
              <Settings className="h-4 w-4 mr-1" />
              Reconfigure
            </Button>
          </motion.div>
        </div>

        {learnerProfile ? (
          <div className="space-y-4">
            {/* Learning Style */}
            <div className="flex items-center gap-3 flex-wrap">
              {styleInfo && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium ${styleInfo.color}`}
                >
                  <styleInfo.icon className="h-4 w-4" />
                  <span className="text-sm">{styleInfo.label} Learner</span>
                </div>
              )}
              {bestTeachingStyle && (
                <Badge variant="outline" className="rounded-xl px-3 py-1.5 text-xs">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Best style: {bestTeachingStyle}
                </Badge>
              )}
              {learnerProfile.masteryApproach && (
                <Badge variant="outline" className="rounded-xl px-3 py-1.5 text-xs">
                  <Target className="h-3 w-3 mr-1" />
                  Mastery: {learnerProfile.masteryApproach}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Pace */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {paceInfo && <paceInfo.icon className="h-4 w-4" />}
                {!paceInfo && <Gauge className="h-4 w-4" />}
                <span>Learning Pace</span>
              </div>
              {paceInfo ? (
                <div>
                  <p className="font-medium text-sm">{paceInfo.label}</p>
                  <p className="text-xs text-muted-foreground">{paceInfo.desc}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not configured</p>
              )}
            </div>

            <Separator />

            {/* Preferences */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Preferences
              </p>
              <div className="flex flex-wrap gap-2">
                {learnerProfile.prefersStory && (
                  <Badge
                    variant="outline"
                    className="rounded-lg border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-xs"
                  >
                    Stories &amp; Analogies
                  </Badge>
                )}
                {learnerProfile.prefersBigPicture && (
                  <Badge
                    variant="outline"
                    className="rounded-lg border-teal-500/20 bg-teal-500/5 text-teal-700 dark:text-teal-400 text-xs"
                  >
                    Big Picture First
                  </Badge>
                )}
                {learnerProfile.vocabularySensitive && (
                  <Badge
                    variant="outline"
                    className="rounded-lg border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs"
                  >
                    Simple Vocabulary
                  </Badge>
                )}
                {learnerProfile.simpleGrammar && (
                  <Badge
                    variant="outline"
                    className="rounded-lg border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-400 text-xs"
                  >
                    Simple Grammar
                  </Badge>
                )}
                {learnerProfile.masteryApproach === 'evidence' && (
                  <Badge
                    variant="outline"
                    className="rounded-lg border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-xs"
                  >
                    Evidence-Based Mastery
                  </Badge>
                )}
                <Badge variant="outline" className="rounded-lg text-xs">
                  Jargon Tolerance: {learnerProfile.jargonTolerance}/10
                </Badge>
              </div>
            </div>

            {/* Hard Subjects & Confusion */}
            {(hardSubjects.length || alwaysConfuses) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Focus Areas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {hardSubjects.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                    {alwaysConfuses && (
                      <Badge variant="secondary" className="text-xs">
                        Confused by: {alwaysConfuses}
                      </Badge>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-10">
            <Palette className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No learning profile configured yet.</p>
            <p className="text-xs text-muted-foreground/70 mb-4">
              Set up your preferences for a personalized learning experience.
            </p>
            <Button variant="outline" size="sm" onClick={handleReconfigure}>
              <Target className="h-4 w-4 mr-2" />
              Configure Learning Profile
            </Button>
          </div>
        )}
      </motion.div>

      {/* ════════════════════════════════════════════
          3. Stats Overview (Real Data)
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp}>
        <h2 className="text-lg font-semibold gradient-text mb-4 flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </motion.div>
          Stats Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statsData.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: idx * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
              className="glass rounded-2xl p-4 sm:p-5 space-y-3 hover:glow-emerald-strong transition-shadow duration-500 card-shadow"
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-500/10">
                  <stat.icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight">
                  <AnimatedNumber value={stat.value} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {stat.change}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          4. Achievements (Enhanced)
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8 space-y-5 card-shadow">
        <div className="space-y-4">
          {/* Header + Progress */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </motion.div>
              <h2 className="text-lg font-semibold gradient-text">Achievements</h2>
            </div>
            <span className="text-sm text-muted-foreground font-medium">
              {unlockedCount}/{achievements.length} unlocked
            </span>
          </div>

          {/* Overall progress bar */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 relative overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: `${achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              >
                <div className="absolute inset-0 shimmer" />
              </motion.div>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {categoryTabs.map((tab) => {
              const count = tab.key === 'all'
                ? achievements.length
                : achievements.filter((a) => a.category === tab.key).length;
              const isActive = activeCategory === tab.key;
              return (
                <motion.button
                  key={tab.key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveCategory(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 glow-emerald'
                      : 'text-muted-foreground hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  {tab.label}
                  <span className="ml-1 text-[10px] opacity-60">({count})</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Achievement Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            variants={achievementGridStagger}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          >
            {filteredAchievements.map((ach, idx) => (
              <AchievementCard key={ach.id} achievement={ach} index={idx} />
            ))}
          </motion.div>
        </AnimatePresence>

        {filteredAchievements.length === 0 && (
          <div className="text-center py-8">
            <Lock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No achievements in this category yet.</p>
          </div>
        )}
      </motion.div>

      {/* ════════════════════════════════════════════
          5. Activity Heatmap
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8 space-y-4 card-shadow">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </motion.div>
          <h2 className="text-lg font-semibold gradient-text">Activity</h2>
        </div>

        {/* Heatmap Grid */}
        {studySessions.length === 0 ? (
          <div className="text-center py-6">
            <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet. Start a study session to see your heatmap!</p>
          </div>
        ) : (
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="min-w-[280px]">
            {/* Day labels */}
            <div className="flex gap-1.5 mb-1.5 pl-8">
              {weekLabels.map((label) => (
                <div
                  key={label}
                  className="flex-1 text-center text-[10px] text-muted-foreground/60"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Rows (days) */}
            {dayLabels.map((day, dayIdx) => (
              <div key={day} className="flex items-center gap-1.5">
                <span className="w-7 text-right text-[10px] text-muted-foreground/60 shrink-0 pr-1">
                  {day}
                </span>
                {heatmap.map((week, weekIdx) => {
                  const cell = week[dayIdx];
                  return (
                    <HeatmapCell
                      key={`${weekIdx}-${dayIdx}`}
                      opacity={cell.opacity}
                      weekIdx={weekIdx}
                      dayIdx={dayIdx}
                    />
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 mt-3">
              <span className="text-[10px] text-muted-foreground/60 mr-1">Less</span>
              {[0.25, 0.5, 0.8].map((op) => (
                <div
                  key={op}
                  className="h-3 w-3 rounded-sm transition-transform hover:scale-125 cursor-default"
                  style={{ backgroundColor: `oklch(0.627 0.194 149.214 / ${op})` }}
                />
              ))}
              <span className="text-[10px] text-muted-foreground/60 ml-1">More</span>
            </div>
          </div>
        </div>
        )}

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{studySessions.length} session{studySessions.length !== 1 ? 's' : ''}</span>{' '}
          total &middot;{' '}
          {currentStreak > 0 ? (
            <>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{currentStreak} day streak</span> active
            </>
          ) : (
            'Start your streak today!'
          )}
        </p>
      </motion.div>

      {/* ════════════════════════════════════════════
          6. Skill Radar (horizontal bars)
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8 space-y-5 card-shadow">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </motion.div>
          <h2 className="text-lg font-semibold gradient-text">Skill Radar</h2>
        </div>
        <div className="space-y-4">
          {computedSkillBars.map((skill, idx) => (
            <div key={skill.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{skill.name}</span>
                <motion.span
                  className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + idx * 0.1 }}
                >
                  {skill.value}%
                </motion.span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted/60 dark:bg-muted/30 overflow-hidden">
                <motion.div
                  className="h-full rounded-full relative overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(90deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89))',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${skill.value}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 + idx * 0.08 }}
                >
                  {/* Shimmer effect while loading */}
                  <motion.div
                    className="absolute inset-0 -translate-x-full"
                    animate={{ translateX: ['-100%', '100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: idx * 0.3 }}
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                    }}
                  />
                </motion.div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          Upcoming Reviews (2-week calendar)
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8 space-y-5 card-shadow">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </motion.div>
          <h2 className="text-lg font-semibold gradient-text">Upcoming Reviews</h2>
        </div>

        {/* 2-week calendar grid */}
        <div className="space-y-1">
          <div className="grid grid-cols-[40px_repeat(14,1fr)] gap-1">
            {/* Header row with date numbers */}
            <div /> {/* Empty corner cell */}
            {calendarPlan.slice(0, 14).map((day, i) => {
              const date = new Date(day.date);
              const isToday = i === 0;
              return (
                <div key={day.date} className="text-center">
                  <span className={`text-[9px] font-medium ${isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/60'}`}>
                    {format(date, 'd')}
                  </span>
                </div>
              );
            })}

            {/* Day label rows (Mon-Sun) — each shows 14 columns across 2 weeks */}
            {dayLabels.map((label, rowIdx) => (
              <>
                <div key={label} className="flex items-center text-[10px] text-muted-foreground/60 font-medium pr-1">
                  {label}
                </div>
                {calendarPlan.slice(0, 14).map((day, colIdx) => {
                  const date = new Date(day.date);
                  const dayOfWeek = date.getDay();
                  // Map rowIdx (0-6) to JS day (0=Sun, 1=Mon, ...)
                  // We use Mon=0, Tue=1, ..., Sun=6
                  const mappedDay = (dayOfWeek + 6) % 7;
                  const isThisRow = mappedDay === rowIdx;
                  const count = isThisRow ? day.count : -1;

                  return (
                    <motion.div
                      key={`${rowIdx}-${colIdx}`}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: rowIdx * 0.04 + colIdx * 0.02 }}
                      className={`h-6 rounded-sm transition-all ${
                        count < 0
                          ? 'bg-transparent'
                          : count === 0
                            ? 'bg-muted/30'
                            : count <= 2
                              ? 'bg-emerald-500/40'
                              : 'bg-emerald-500/80'
                      }`}
                      title={count >= 0 ? `${count} review${count !== 1 ? 's' : ''}` : ''}
                    />
                  );
                })}
              </>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-muted/30" />
              <span className="text-[10px] text-muted-foreground">None</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-emerald-500/40" />
              <span className="text-[10px] text-muted-foreground">1-2</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-emerald-500/80" />
              <span className="text-[10px] text-muted-foreground">3+</span>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex items-center justify-between text-sm border-t border-border/50 pt-3">
          <span className="text-muted-foreground">
            Total items tracked: <span className="font-semibold text-foreground">{totalTrackedItems}</span>
          </span>
          {nextReviewTime && (
            <span className="text-muted-foreground">
              Next review: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatDistanceToNow(nextReviewTime, { addSuffix: true })}</span>
            </span>
          )}
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          7. Study Statistics
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl card-shadow overflow-hidden">
        <button
          onClick={() => setStudyStatsExpanded((v) => !v)}
          className="w-full flex items-center justify-between p-6 sm:p-8 text-left hover:bg-muted/20 transition-colors"
          aria-expanded={studyStatsExpanded}
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            <h2 className="text-lg font-semibold gradient-text">Study Statistics</h2>
            {Object.keys(masteryMap).length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                {Object.keys(masteryMap).length} concept{Object.keys(masteryMap).length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <motion.div
            animate={{ rotate: studyStatsExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </button>

        <AnimatePresence>
          {studyStatsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-8">
                {/* ── 7a. Subject Mastery Breakdown ── */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Subject Mastery Breakdown</h3>
                  {Object.keys(masteryMap).length === 0 ? (
                    <div className="text-center py-6">
                      <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No mastery data yet. Start studying to track your progress!</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                      {(() => {
                        const entries = Object.entries(masteryMap)
                          .map(([name, data]) => ({ name, ...data }))
                          .sort((a, b) => a.level - b.level);
                        return entries.map((concept, idx) => {
                          const pct = (concept.level / 5) * 100;
                          const masteryColor =
                            concept.level <= 2
                              ? 'bg-amber-500'
                              : concept.level === 3
                                ? 'bg-emerald-500'
                                : 'bg-teal-500';
                          const glowClass =
                            concept.level >= 4
                              ? 'shadow-[0_0_8px_oklch(0.687_0.159_177.89/0.5)]'
                              : '';
                          return (
                            <motion.div
                              key={concept.name}
                              initial={{ opacity: 0, x: -16 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                delay: idx * 0.06,
                                type: 'spring',
                                stiffness: 350,
                                damping: 22,
                              }}
                              className="space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium truncate">{concept.name}</span>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 shrink-0"
                                  >
                                    {concept.attempts} attempt{concept.attempts !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {concept.lastAssessed > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatDistanceToNow(new Date(concept.lastAssessed), { addSuffix: true })}
                                    </span>
                                  )}
                                  <span className={`text-xs font-semibold tabular-nums ${concept.level <= 2 ? 'text-amber-600 dark:text-amber-400' : concept.level === 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-600 dark:text-teal-400'}`}>
                                    {concept.level}/5
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 w-full rounded-full bg-muted/60 dark:bg-muted/30 overflow-hidden">
                                <motion.div
                                  className={`h-full rounded-full ${masteryColor} ${glowClass}`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{
                                    duration: 0.8,
                                    ease: 'easeOut',
                                    delay: idx * 0.06 + 0.15,
                                  }}
                                />
                              </div>
                              {concept.level < 3 && (
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => navigate('tutor')}
                                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                                >
                                  Start Reviewing
                                </motion.button>
                              )}
                            </motion.div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── 7b. Study Patterns Analysis ── */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Study Patterns Analysis</h3>
                  {studySessions.length === 0 ? (
                    <div className="text-center py-6">
                      <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Most Productive Day */}
                      {(() => {
                        const dayActivity: Record<string, number> = {};
                        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                        studySessions.forEach((s: StudySession) => {
                          const day = dayNames[new Date(s.date).getDay()];
                          dayActivity[day] = (dayActivity[day] || 0) + s.duration;
                        });
                        const sorted = Object.entries(dayActivity).sort((a, b) => b[1] - a[1]);
                        const topDay = sorted[0];
                        const maxMinutes = topDay ? topDay[1] : 1;
                        return (
                          <div className="rounded-xl glass border border-border/40 p-4 space-y-3">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Flame className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">Most Productive Day</span>
                            </div>
                            <p className="text-sm font-bold text-foreground">{topDay ? topDay[0] : 'N/A'}</p>
                            <div className="space-y-1.5">
                              {sorted.slice(0, 5).map(([day, mins]) => (
                                <div key={day} className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-8 truncate">{day.slice(0, 3)}</span>
                                  <div className="flex-1 h-1.5 rounded-full bg-muted/60 dark:bg-muted/30 overflow-hidden">
                                    <motion.div
                                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(mins / maxMinutes) * 100}%` }}
                                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">{mins}m</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Session Duration Stats */}
                      <div className="rounded-xl glass border border-border/40 p-4 space-y-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Timer className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">Session Stats</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Average Duration</span>
                            <span className="font-semibold font-mono tabular-nums">
                              {(() => {
                                const avg = Math.round(studySessions.reduce((s: number, ses: StudySession) => s + ses.duration, 0) / studySessions.length);
                                return `${avg} min`;
                              })()}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Study Time</span>
                            <span className="font-semibold font-mono tabular-nums">
                              {Math.floor(totalStudyTime / 60)}h {totalStudyTime % 60}m
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Best Streak</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                              {bestStreak} days
                            </span>
                          </div>
                          {quizTotal > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Quiz Accuracy</span>
                              <span className={`font-semibold font-mono tabular-nums ${quizScore / quizTotal >= 0.7 ? 'text-emerald-600 dark:text-emerald-400' : quizScore / quizTotal >= 0.4 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                                {Math.round((quizScore / quizTotal) * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── 7c. Learning Velocity ── */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Learning Velocity</h3>
                  {(() => {
                    const now = Date.now();
                    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
                    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
                    const masteryEntries = Object.values(masteryMap);

                    const recentMastery = masteryEntries
                      .filter((e) => e.lastAssessed >= oneWeekAgo)
                      .reduce((s, e) => s + e.level, 0);
                    const priorMastery = masteryEntries
                      .filter((e) => e.lastAssessed >= twoWeeksAgo && e.lastAssessed < oneWeekAgo)
                      .reduce((s, e) => s + e.level, 0);

                    const velocityPerWeek = recentMastery;
                    const priorVelocity = priorMastery;

                    let status: 'Accelerating' | 'Steady' | 'Needs Attention';
                    let statusColor: string;
                    let StatusIcon: typeof ArrowUp;

                    if (velocityPerWeek > priorVelocity && velocityPerWeek > 0) {
                      status = 'Accelerating';
                      statusColor = 'text-emerald-600 dark:text-emerald-400';
                      StatusIcon = ArrowUp;
                    } else if (velocityPerWeek > 0 || priorVelocity > 0) {
                      status = 'Steady';
                      statusColor = 'text-amber-600 dark:text-amber-400';
                      StatusIcon = ArrowRight;
                    } else {
                      status = 'Needs Attention';
                      statusColor = 'text-red-500 dark:text-red-400';
                      StatusIcon = ArrowDown;
                    }

                    return (
                      <div className="flex items-center gap-4 rounded-xl glass border border-border/40 p-4">
                        <motion.div
                          animate={{
                            y: status === 'Accelerating' ? [0, -4, 0] : status === 'Needs Attention' ? [0, 4, 0] : [0, 0],
                          }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          className={statusColor}
                        >
                          <StatusIcon className="h-6 w-6" />
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${statusColor}`}>{status}</p>
                          <p className="text-xs text-muted-foreground">
                            {velocityPerWeek} mastery level{velocityPerWeek !== 1 ? 's' : ''} gained this week
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold font-mono tabular-nums text-foreground">{velocityPerWeek}</p>
                          <p className="text-[10px] text-muted-foreground">levels/week</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <Separator />

                {/* ── 7d. Share Stats ── */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Share your learning progress with others</p>
                  <div className="flex items-center gap-2">
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300 hover:border-emerald-500/40 transition-all"
                        onClick={handleExportStatsImage}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export Image
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300 hover:border-emerald-500/40 transition-all"
                        onClick={() => setShareModalOpen(true)}
                      >
                        <Share2 className="h-3.5 w-3.5 mr-1.5" />
                        Share Stats
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ════════════════════════════════════════════
          8. Action Buttons
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-3 pt-2">
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button
            variant="outline"
            className="border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300 hover:border-emerald-500/40 transition-all"
            onClick={handleReconfigure}
          >
            <Settings className="h-4 w-4 mr-2" />
            Reconfigure Learning Profile
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/40 transition-all"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </motion.div>
      </motion.div>

      {/* Profile Share Stats Modal */}
      <ProfileShareModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        studySessions={studySessions}
        masteryMap={masteryMap}
        currentStreak={currentStreak}
        totalStudyTime={totalStudyTime}
        quizScore={quizScore}
        quizTotal={quizTotal}
      />
    </motion.div>
  );
}

// Profile Share Stats Modal with ASCII art card
function ProfileShareModal({
  open,
  onClose,
  studySessions,
  masteryMap,
  currentStreak,
  totalStudyTime,
  quizScore,
  quizTotal,
}: {
  open: boolean;
  onClose: () => void;
  studySessions: StudySession[];
  masteryMap: Record<string, { level: number }>;
  currentStreak: number;
  totalStudyTime: number;
  quizScore: number | null;
  quizTotal: number | null;
}) {
  const totalMastery = Object.values(masteryMap);
  const avgMastery = totalMastery.length > 0
    ? (totalMastery.reduce((s, c) => s + c.level, 0) / totalMastery.length).toFixed(1)
    : '0';
  const quizAccuracy = quizTotal && quizTotal > 0 ? Math.round((quizScore! / quizTotal) * 100) : 0;
  const totalXP = studySessions.reduce((sum, s) => sum + s.duration * 10, 0) + quizAccuracy * 5;
  const level = Math.max(1, Math.min(50, Math.floor(Math.sqrt(totalXP / 100)) + 1));
  const hours = Math.floor(totalStudyTime / 60);

  const statsText = useMemo(() => {
    return [
      '╔══════════════════════════════════════╗',
      '║      🧠 SynapseLearn Stats 🧠        ║',
      '╠══════════════════════════════════════╣',
      `║  📊 Level:    ${String(level).padEnd(24)}║`,
      `║  ⭐ XP:       ${String(totalXP.toLocaleString()).padEnd(24)}║`,
      `║  🔥 Streak:   ${String(`${currentStreak} days`).padEnd(24)}║`,
      `║  📚 Sessions: ${String(studySessions.length.toString()).padEnd(24)}║`,
      `║  🎯 Mastery:  ${String(`${avgMastery}/5 avg`).padEnd(24)}║`,
      `║  📝 Accuracy: ${String(`${quizAccuracy}%`).padEnd(24)}║`,
      `║  ⏱️ Study:    ${String(`${hours}+ hours`).padEnd(24)}║`,
      '╠══════════════════════════════════════╣',
      '║   Join me on SynapseLearn! 🚀       ║',
      '╚══════════════════════════════════════╝',
    ].join('\n');
  }, [level, totalXP, currentStreak, studySessions.length, avgMastery, quizAccuracy, hours]);

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
    const tweetText = `🧠 SynapseLearn Stats:\nLevel ${level} | ${totalXP.toLocaleString()} XP | ${currentStreak}-day streak | ${quizAccuracy}% quiz accuracy\n\nJoin me on SynapseLearn! 🚀`;
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