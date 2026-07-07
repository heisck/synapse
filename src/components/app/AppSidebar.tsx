'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  Brain,
  LayoutDashboard,
  FileUp,
  BookOpen,
  MessageSquare,
  ClipboardCheck,
  Trophy,
  User,
  Menu,
  BookMarked,
  History,
  Settings,
  X,
  Flame,
  Timer,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { AppView } from '@/types';

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  view: AppView;
  shortcut: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard', shortcut: '\u23181' },
  { icon: FileUp, label: 'Upload Slides', view: 'upload', shortcut: '\u23183' },
  { icon: BookOpen, label: 'My Courses', view: 'upload', shortcut: '' },
  { icon: MessageSquare, label: 'Tutor', view: 'tutor', shortcut: '\u23182' },
  { icon: ClipboardCheck, label: 'Quiz Mode', view: 'quiz', shortcut: '\u23184' },
  { icon: Trophy, label: 'Leaderboard', view: 'leaderboard', shortcut: '' },
  { icon: BookMarked, label: 'Notes', view: 'notes', shortcut: '\u23185' },
  { icon: Timer, label: 'Focus Timer', view: 'focus-timer', shortcut: '\u23188' },
  { icon: User, label: 'Profile', view: 'profile', shortcut: '\u23186' },
  { icon: Settings, label: 'Settings', view: 'settings', shortcut: '\u23187' },
];

const viewLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  tutor: 'Tutor',
  upload: 'Upload',
  quiz: 'Quiz',
  leaderboard: 'Leaderboard',
  profile: 'Profile',
  notes: 'Notes',
  settings: 'Settings',
  'course-detail': 'Course Detail',
};

const viewIcons: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  tutor: MessageSquare,
  upload: FileUp,
  quiz: ClipboardCheck,
  leaderboard: Trophy,
  profile: User,
  notes: BookMarked,
  settings: Settings,
  'course-detail': BookOpen,
};

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
    if (diffDays <= 1) return parsed.streak;
    return 0;
  } catch {
    return 0;
  }
}

function useDailyChallengeCountdown() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}

function GlassNavTooltip({ children, label, shortcut }: { children: React.ReactNode; label: string; shortcut: string }) {
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="text-xs">
        <span className="font-medium">{label}</span>
        {shortcut && (
          <>
            <span className="mx-1.5 text-muted-foreground">·</span>
            <kbd className="font-mono text-[11px] bg-muted/80 px-1.5 py-0.5 rounded border border-border/50">
              {shortcut}
            </kbd>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarContent({ onNavigate, isMobile = false }: { onNavigate?: () => void; isMobile?: boolean }) {
  const { currentView, navigate, userName, recentViews, notes, courses, completedCourses, dailyChallenge } = useAppStore();
  const [studyStreak] = useState(() => getStudyStreak());
  const countdown = useDailyChallengeCountdown();
  const isChallengeCompletedToday = dailyChallenge?.lastCompletedDate === new Date().toISOString().split('T')[0];

  // Compute overall study progress
  const overallProgress = useMemo(() => {
    if (courses.length === 0) return 0;
    const completed = courses.filter((c) => completedCourses.includes(c.id)).length;
    return Math.round((completed / courses.length) * 100);
  }, [courses, completedCourses]);

  const handleNav = useCallback((view: AppView) => {
    navigate(view);
    onNavigate?.();
  }, [navigate, onNavigate]);

  const notesCount = notes.length;

  return (
    <div className="flex h-full flex-col relative">
      {/* Animated gradient line at the very top of the sidebar */}
      <div className="sidebar-top-gradient-line" />
      {/* Left gradient line (desktop only) */}
      {!isMobile && (
        <motion.div
          className="gradient-line-vertical absolute left-0 top-0 bottom-0 z-10"
          layout
        />
      )}

      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground pulse-glow">
          <Brain className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight gradient-text">SynapseLearn</span>
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <LayoutGroup>
          <nav className="flex flex-col gap-1" role="navigation" aria-label="Main navigation">
            {navItems.map((item, index) => {
              const isActive = currentView === item.view;
              return (
                <GlassNavTooltip key={item.view + item.label} label={item.label} shortcut={item.shortcut}>
                  <motion.button
                    onClick={() => handleNav(item.view)}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.06 + index * 0.05,
                      type: 'spring',
                      stiffness: 250,
                      damping: 25,
                    }}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left w-full shimmer-slow
                      ${isActive
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'
                      }`}
                    aria-current={isActive ? 'page' : undefined}
                    whileHover={{ scale: 1.02, x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    transitionHover={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    {/* Active indicator - desktop: gradient pill with left glow bar */}
                    {isActive && !isMobile && (
                      <>
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/8 to-transparent backdrop-blur-sm border border-primary/15"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                        <motion.div
                          layoutId="sidebar-glow-bar"
                          className="sidebar-active-glow-bar"
                          initial={{ opacity: 0, scaleY: 0.5 }}
                          animate={{ opacity: 1, scaleY: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        />
                      </>
                    )}
                    {/* Active indicator - mobile: full gradient background */}
                    {isActive && isMobile && (
                      <motion.div
                        layoutId="mobile-sidebar-active"
                        className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-teal-500 opacity-90"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <motion.div
                      className="shrink-0 relative z-10"
                      whileTap={{ y: -2, scale: 1.15 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <item.icon className={`h-4 w-4 ${isActive && isMobile ? 'text-primary-foreground' : ''}`} />
                    </motion.div>
                    <span className={`relative z-10 ${isActive && !isMobile ? 'text-primary font-semibold' : ''}`}>{item.label}</span>
                    {/* Notification dot on Notes */}
                    {item.label === 'Notes' && notesCount > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground"
                      >
                        {notesCount}
                      </motion.span>
                    )}
                    {/* Daily challenge countdown badge on Quiz */}
                    {item.label === 'Quiz Mode' && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className={`relative z-10 ml-auto flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isChallengeCompletedToday
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {countdown}
                      </motion.span>
                    )}
                    {/* Animated gradient line at bottom of active item */}
                    {isActive && (
                      <motion.div
                        layoutId="active-nav-gradient-line"
                        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </motion.button>
                </GlassNavTooltip>
              );
            })}
          </nav>
        </LayoutGroup>
      </ScrollArea>

      {/* Recently visited - mobile only */}
      {isMobile && recentViews.length > 0 && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <Separator />
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Recently Visited</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {recentViews.map((view) => {
                  const Icon = viewIcons[view] ?? LayoutDashboard;
                  const label = viewLabels[view] ?? view;
                  return (
                    <button
                      key={view}
                      onClick={() => handleNav(view as AppView)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      <Separator />

      {/* Overall Study Progress Bar */}
      {courses.length > 0 && (
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Overall Progress</span>
            <span className="text-[10px] text-muted-foreground">{overallProgress}%</span>
          </div>
          <div className="sidebar-progress-bar">
            <motion.div
              className="sidebar-progress-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* User area with glass card effect */}
      <div className="px-3 py-3">
        <div className="rounded-xl bg-background/40 dark:bg-background/20 border border-border/30 p-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {userName ? userName.slice(0, 2).toUpperCase() : 'SL'}
                </AvatarFallback>
              </Avatar>
              {/* Animated online status indicator */}
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
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{userName || 'Student'}</p>
                {studyStreak > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                  </motion.div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {studyStreak > 0 ? `${studyStreak} day streak` : 'Free Plan'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border bg-muted/50 px-1 font-mono text-[9px] font-medium text-muted-foreground lg:flex">
                K
              </kbd>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  const [hasReminder] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const lastSession = localStorage.getItem('synapse-last-session');
      if (lastSession) {
        const hoursSince = (Date.now() - parseInt(lastSession, 10)) / 3600000;
        return hoursSince > 24;
      }
    } catch {
      // ignore
    }
    return false;
  });

  return (
    <TooltipProvider>
      {/* Mobile hamburger */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="glass h-10 w-10 rounded-full relative">
              <Menu className="h-5 w-5" />
              {hasReminder && (
                <motion.span
                  className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background"
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [1, 0.7, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 p-0 backdrop-blur-2xl bg-background/80 border-border/30"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {/* Animated X close button */}
            <motion.button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </motion.button>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} isMobile />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar - glass morphism */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col h-screen sticky top-0 glass-sidebar">
        <SidebarContent />
      </aside>
    </TooltipProvider>
  );
}