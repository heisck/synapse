'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/appStore';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

/* ── Animation Variants ── */
const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

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

const statsData = [
  { label: 'Total Sessions', value: '24', icon: BookOpen, change: '+3 this week' },
  { label: 'Mastery Rate', value: '78%', icon: Target, change: '+5% from last month' },
  { label: 'Questions Answered', value: '156', icon: MessageCircle, change: '+12 this week' },
  { label: 'Study Streak', value: '3 days', icon: Flame, change: 'Keep it up!' },
];

const achievements = [
  { name: 'First Session', icon: Sparkles, unlocked: true },
  { name: 'Quiz Master', icon: Trophy, unlocked: true },
  { name: '7-Day Streak', icon: Flame, unlocked: false },
  { name: 'Quick Learner', icon: Zap, unlocked: true },
  { name: 'Course Explorer', icon: Compass, unlocked: false },
  { name: 'Feedback Hero', icon: Star, unlocked: true },
];

const skillBars = [
  { name: 'Critical Thinking', value: 85 },
  { name: 'Problem Solving', value: 72 },
  { name: 'Memory', value: 68 },
  { name: 'Analysis', value: 90 },
  { name: 'Creativity', value: 65 },
];

/* ── Heatmap Generator ── */
function generateHeatmap(): { opacity: number }[][] {
  const weeks = 5;
  const days = 7;
  const grid: { opacity: number }[][] = [];
  // Seed for consistent random look
  const seed = [3, 0, 2, 0, 1, 3, 0, 1, 0, 0, 2, 0, 0, 1, 4, 0, 0, 3, 1, 0, 0, 2, 0, 0, 1, 0, 3, 0, 1, 2, 0, 0, 1, 0, 0];
  let idx = 0;
  for (let w = 0; w < weeks; w++) {
    const week: { opacity: number }[] = [];
    for (let d = 0; d < days; d++) {
      const level = seed[idx] ?? 0;
      const opacityMap = [0, 0.1, 0.3, 0.6, 1];
      week.push({ opacity: opacityMap[level] });
      idx++;
    }
    grid.push(week);
  }
  return grid;
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/* ── Component ── */
export function ProfileView() {
  const { userName, userEmail, learnerProfile, hardSubjects, alwaysConfuses, bestTeachingStyle, navigate, setOnboardingComplete } = useAppStore();

  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'SL';

  const heatmap = useMemo(() => generateHeatmap(), []);
  const weekLabels = ['4w ago', '3w ago', '2w ago', 'Last week', 'This week'];

  const handleReconfigure = () => {
    setOnboardingComplete(false);
    navigate('onboarding');
  };

  const handleSignOut = () => {
    navigate('landing');
  };

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
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <Avatar className="h-20 w-20 ring-2 ring-emerald-500/20 ring-offset-2 ring-offset-background shrink-0">
            <AvatarFallback className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-1.5">
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
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Joined recently
              </Badge>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          2. Learning Profile
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-semibold gradient-text">Learning Profile</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReconfigure} className="text-muted-foreground">
            <Settings className="h-4 w-4 mr-1" />
            Reconfigure
          </Button>
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
          3. Stats Overview
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp}>
        <h2 className="text-lg font-semibold gradient-text mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Stats Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statsData.map((stat) => (
            <div
              key={stat.label}
              className="glass rounded-2xl p-4 sm:p-5 space-y-3 hover:glow-emerald transition-shadow duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-500/10">
                  <stat.icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {stat.change}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          4. Achievements
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-lg font-semibold gradient-text">Achievements</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {achievements.filter((a) => a.unlocked).length}/{achievements.length} unlocked
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 sm:gap-5">
          {achievements.map((ach) => {
            const IconComp = ach.icon;
            return (
              <div key={ach.name} className="flex flex-col items-center gap-2 text-center">
                <div
                  className={`flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full transition-all duration-300 ${
                    ach.unlocked
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30'
                      : 'bg-muted/50 text-muted-foreground/30'
                  }`}
                >
                  {ach.unlocked ? (
                    <IconComp className="h-6 w-6 sm:h-7 sm:w-7" />
                  ) : (
                    <Lock className="h-5 w-5 sm:h-6 sm:w-6" />
                  )}
                </div>
                <span
                  className={`text-[11px] sm:text-xs font-medium leading-tight ${
                    ach.unlocked ? 'text-foreground' : 'text-muted-foreground/50'
                  }`}
                >
                  {ach.name}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          5. Activity Heatmap
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-lg font-semibold gradient-text">Activity</h2>
        </div>

        {/* Heatmap Grid */}
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
                  const hasActivity = cell.opacity > 0;
                  return (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      className={`flex-1 aspect-square rounded-sm transition-colors duration-200 cursor-default ${
                        hasActivity
                          ? ''
                          : 'bg-muted/40 dark:bg-muted/20'
                      }`}
                      style={
                        hasActivity
                          ? {
                              backgroundColor: `oklch(0.627 0.194 149.214 / ${cell.opacity})`,
                            }
                          : undefined
                      }
                      title={
                        hasActivity
                          ? `${cell.opacity === 1 ? 'High' : cell.opacity >= 0.6 ? 'Medium' : cell.opacity >= 0.3 ? 'Low' : 'Minimal'} activity`
                          : 'No activity'
                      }
                    />
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 mt-3">
              <span className="text-[10px] text-muted-foreground/60 mr-1">Less</span>
              {[0.1, 0.3, 0.6, 1].map((op) => (
                <div
                  key={op}
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: `oklch(0.627 0.194 149.214 / ${op})` }}
                />
              ))}
              <span className="text-[10px] text-muted-foreground/60 ml-1">More</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">4 sessions</span> this
          week &middot; Keep your streak alive!
        </p>
      </motion.div>

      {/* ════════════════════════════════════════════
          6. Skill Radar (horizontal bars)
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="glass rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-lg font-semibold gradient-text">Skill Radar</h2>
        </div>
        <div className="space-y-4">
          {skillBars.map((skill) => (
            <div key={skill.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{skill.name}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                  {skill.value}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted/60 dark:bg-muted/30 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89))',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${skill.value}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ════════════════════════════════════════════
          7. Action Buttons
      ════════════════════════════════════════════ */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-3 pt-2">
        <Button
          variant="outline"
          className="border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300"
          onClick={handleReconfigure}
        >
          <Settings className="h-4 w-4 mr-2" />
          Reconfigure Learning Profile
        </Button>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </motion.div>
    </motion.div>
  );
}