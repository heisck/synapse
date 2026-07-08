'use client';

import { Suspense, lazy, useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Brain, LayoutDashboard, MessageSquare, Upload, ClipboardCheck, User, Search, BookMarked, Sparkles, FileUp, ArrowUp, ArrowDown, ArrowRight, Settings, Timer, Bell, Flame, Target, Lightbulb, Clock, CheckCheck, Trophy, BookOpen } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { AppSidebar } from './AppSidebar';
import { StoreInitializer } from './StoreInitializer';
import { ErrorBoundary } from './ErrorBoundary';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import type { StudyNotification, AppView } from '@/types';

const LandingPage = lazy(() =>
  import('@/components/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const Dashboard = lazy(() => import('./Dashboard').then((m) => ({ default: m.Dashboard })));
const TutorView = lazy(() =>
  import('@/components/tutor/TutorView').then((m) => ({ default: m.TutorView }))
);
const UploadView = lazy(() => import('./UploadView').then((m) => ({ default: m.UploadView })));
const CoursesView = lazy(() => import('./CoursesView').then((m) => ({ default: m.CoursesView })));
const QuizView = lazy(() => import('./QuizView').then((m) => ({ default: m.QuizView })));
const OnboardingFlow = lazy(() => import('./OnboardingFlow').then((m) => ({ default: m.OnboardingFlow })));
const ProfileView = lazy(() => import('./ProfileView').then((m) => ({ default: m.ProfileView })));
const CourseDetail = lazy(() => import('./CourseDetail').then((m) => ({ default: m.CourseDetail })));
const CardStudyView = lazy(() => import('./CardStudyView').then((m) => ({ default: m.CardStudyView })));
const NotesView = lazy(() => import('./NotesView').then((m) => ({ default: m.NotesView })));
const SettingsView = lazy(() => import('./SettingsView').then((m) => ({ default: m.SettingsView })));
const FocusTimerView = lazy(() => import('./FocusTimerView').then((m) => ({ default: m.FocusTimerView })));
const LeaderboardView = lazy(() => import('./LeaderboardView').then((m) => ({ default: m.LeaderboardView })));

function ViewLoader() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22, mass: 0.8 }}
      className="flex h-full min-h-[60vh] items-center justify-center"
    >
      <div className="flex flex-col items-center gap-4">
        {/* The brain IS the logo — no container box */}
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Brain className="h-10 w-10 text-primary" />
        </motion.div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </motion.div>
  );
}

// Page transition indicator - thin gradient line at top during transitions
function TransitionIndicator({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ scaleX: 0, opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute top-0 left-0 right-0 h-[2px] z-50 origin-left"
        >
          <motion.div
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Unique entrance animations per view
const viewTransitions: Record<string, Variants> = {
  dashboard: {
    initial: { opacity: 0, x: -40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 40 },
  },
  tutor: {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  },
  upload: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.92 },
  },
  courses: {
    initial: { opacity: 0, x: -40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 40 },
  },
  quiz: {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -40 },
  },
  notes: {
    initial: { opacity: 0, x: -40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 40 },
  },
  'focus-timer': {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  profile: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.92 },
  },
  'course-detail': {
    initial: { opacity: 0, y: 20, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.97 },
  },
  'card-study': {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -40 },
  },
  settings: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  leaderboard: {
    initial: { opacity: 0, y: 30, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -30, scale: 0.97 },
  },
};

const defaultTransition: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

function SearchModal() {
  const { navigate, recentViews, courses, addRecentView, setActiveTopic, setActiveSession } = useAppStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const searchItems = [
    { label: 'Dashboard', view: 'dashboard' as AppView, icon: LayoutDashboard },
    { label: 'AI Tutor', view: 'tutor' as AppView, icon: MessageSquare },
    { label: 'Upload Slides', view: 'upload' as AppView, icon: Upload },
    { label: 'My Courses', view: 'courses' as AppView, icon: BookOpen },
    { label: 'Quiz Mode', view: 'quiz' as AppView, icon: ClipboardCheck },
    { label: 'Leaderboard', view: 'leaderboard' as AppView, icon: Trophy },
    { label: 'Notes', view: 'notes' as AppView, icon: BookMarked },
    { label: 'Focus Timer', view: 'focus-timer' as AppView, icon: Timer },
    { label: 'Profile', view: 'profile' as AppView, icon: User },
    { label: 'Settings', view: 'settings' as AppView, icon: Settings },
  ];

  const recentViewItems = recentViews
    .map((view) => searchItems.find((item) => item.view === view))
    .filter((item): item is typeof searchItems[number] => !!item);

  const recentCourseItems = courses.slice(0, 3).map((c) => ({
    id: c.id,
    label: c.title,
    icon: LayoutDashboard,
    action: () => {
      navigate('course-detail');
    },
  }));

  const quickActions = [
    {
      label: 'New Session',
      icon: Sparkles,
      action: () => {
        setActiveTopic('General Study');
        setActiveSession(`session-${Date.now()}`);
        navigate('tutor');
      },
    },
    {
      label: 'Upload Slides',
      icon: FileUp,
      action: () => { navigate('upload'); },
    },
    {
      label: 'Take Quiz',
      icon: ClipboardCheck,
      action: () => { navigate('quiz'); },
    },
  ];

  const filtered = query
    ? searchItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : searchItems;

  // Deduplicate views that already appeared in recent
  const seenViews = new Set(recentViewItems.map((r) => r.view));
  const uniqueViewItems = query ? filtered : filtered.filter((f) => !seenViews.has(f.view));
  const totalNavigable = (query ? 0 : recentViewItems.length) + (query ? 0 : recentCourseItems.length) + (query ? 0 : quickActions.length) + uniqueViewItems.length;

  // Closing (from any path) always resets query + activeIndex together, so
  // there's one place that does it instead of an effect reacting after the
  // fact to `open` flipping false.
  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const handleSelect = (idx: number) => {
    let i = 0;
    if (!query) {
      if (idx < recentViewItems.length) {
        const viewItem = recentViewItems[idx];
        addRecentView(viewItem.view);
        navigate(viewItem.view);
        closeSearch();
        return;
      }
      i += recentViewItems.length;
    }
    if (!query) {
      if (idx < i + recentCourseItems.length) {
        const courseItem = recentCourseItems[idx - i];
        courseItem.action();
        closeSearch();
        return;
      }
      i += recentCourseItems.length;
    }
    if (!query) {
      if (idx < i + quickActions.length) {
        const actionItem = quickActions[idx - i];
        actionItem.action();
        closeSearch();
        return;
      }
      i += quickActions.length;
    }
    const viewItem = uniqueViewItems[idx - i];
    if (viewItem) {
      addRecentView(viewItem.view);
      navigate(viewItem.view);
      closeSearch();
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % totalNavigable);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + totalNavigable) % totalNavigable);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(activeIndex);
    }
  };

  let currentFlatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            autoFocus
            placeholder="Search views, courses, actions..."
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            ESC
          </kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto px-1 pb-1">
          {/* No results */}
          {filtered.length === 0 && (!query || (query && recentViewItems.length === 0)) && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results found.
            </div>
          )}

          {/* Recent Views */}
          {!query && recentViewItems.length > 0 && (
            <div className="pt-2">
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent
              </div>
              {recentViewItems.map((item) => {
                const Icon = item.icon;
                const idx = currentFlatIndex++;
                return (
                  <button
                    key={`recent-${item.view}`}
                    onClick={() => {
                      addRecentView(item.view);
                      navigate(item.view);
                      closeSearch();
                    }}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors text-left ${activeIndex === idx ? 'bg-accent' : 'hover:bg-accent'}`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">Recent</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Recent Courses */}
          {!query && recentCourseItems.length > 0 && (
            <div className="pt-2">
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Courses
              </div>
              {recentCourseItems.map((item) => {
                const idx = currentFlatIndex++;
                return (
                  <button
                    key={`course-${item.id}`}
                    onClick={() => {
                      item.action();
                      closeSearch();
                    }}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors text-left ${activeIndex === idx ? 'bg-accent' : 'hover:bg-accent'}`}
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">Recent</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick Actions */}
          {!query && (
            <div className="pt-2">
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </div>
              {quickActions.map((action) => {
                const Icon = action.icon;
                const idx = currentFlatIndex++;
                return (
                  <button
                    key={`action-${action.label}`}
                    onClick={() => {
                      action.action();
                      closeSearch();
                    }}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors text-left ${activeIndex === idx ? 'bg-accent' : 'hover:bg-accent'}`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{action.label}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}

          {/* All Views */}
          {(query || true) && (
            <div className="pt-2">
              {!query && (
                <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  All Views
                </div>
              )}
              {uniqueViewItems.map((item) => {
                const Icon = item.icon;
                const idx = currentFlatIndex++;
                return (
                  <button
                    key={item.view}
                    onClick={() => {
                      addRecentView(item.view);
                      navigate(item.view);
                      closeSearch();
                    }}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors text-left ${activeIndex === idx ? 'bg-accent' : 'hover:bg-accent'}`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="font-mono bg-muted/60 px-1 py-0.5 rounded border border-border/50">
              <ArrowUp className="h-2.5 w-2.5 inline" />
              <ArrowDown className="h-2.5 w-2.5 inline" />
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono bg-muted/60 px-1 py-0.5 rounded border border-border/50">Enter</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="font-mono bg-muted/60 px-1 py-0.5 rounded border border-border/50">Esc</kbd>
            Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Silent global keyboard shortcuts (Cmd+1..8 navigation, Cmd+N/U/Q/D quick
// actions). No discoverability UI — keyboard shortcuts assume a keyboard,
// which pairs with a desktop workflow; there's nothing to show on phones
// or via a floating dialog that just gets in the way.
function KeyboardShortcuts() {
  const { navigate, setActiveTopic, setActiveSession } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Navigation shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); navigate('dashboard'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); navigate('tutor'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') { e.preventDefault(); navigate('upload'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '4') { e.preventDefault(); navigate('quiz'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '5') { e.preventDefault(); navigate('notes'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '6') { e.preventDefault(); navigate('profile'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '7') { e.preventDefault(); navigate('settings'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '8') { e.preventDefault(); navigate('focus-timer'); }

      // Quick Actions
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setActiveTopic('General Study');
        setActiveSession(`session-${Date.now()}`);
        navigate('tutor');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'u') { e.preventDefault(); navigate('upload'); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); navigate('quiz'); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); navigate('dashboard'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, setActiveTopic, setActiveSession]);

  return null;
}

// ---------- Notification Bell ----------
function getNotificationIcon(type: StudyNotification['type']) {
  switch (type) {
    case 'streak': return Flame;
    case 'achievement': return Target;
    case 'goal': return Target;
    case 'review': return Clock;
    case 'tip': return Lightbulb;
    default: return Bell;
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function NotificationBell() {
  const { notifications, markNotificationRead, clearAllNotifications, navigate, currentView } = useAppStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNotificationClick = (notif: StudyNotification) => {
    markNotificationRead(notif.id);
    if (notif.actionView) {
      navigate(notif.actionView);
      setOpen(false);
    }
  };

  // Only show bell when not on landing or onboarding
  if (currentView === 'landing' || currentView === 'onboarding') return null;

  return (
    <div ref={dropdownRef} className="relative">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/95 hover:bg-accent/50 transition-colors backdrop-blur-md"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-4 w-4 text-foreground/80" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key={unreadCount}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute right-0 top-12 z-50 w-80 sm:w-96 glass rounded-xl border border-border/60 shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                notifications.slice(0, 20).map((notif, idx) => {
                  const Icon = getNotificationIcon(notif.type);
                  return (
                    <motion.button
                      key={notif.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.2 }}
                      onClick={() => handleNotificationClick(notif)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent/30 transition-colors border-b border-border/20 last:border-b-0 ${
                        !notif.read ? 'border-l-2 border-l-emerald-500' : ''
                      }`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
                        !notif.read ? 'bg-emerald-500/10' : 'bg-muted/50'
                      }`}>
                        <Icon className={`h-4 w-4 ${!notif.read ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notif.title}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground/60">{formatRelativeTime(notif.createdAt)}</span>
                          {notif.actionLabel && (
                            <span className="text-[10px] font-medium text-primary">{notif.actionLabel}</span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {unreadCount > 0 && (
              <div className="border-t border-border/40 px-4 py-2.5">
                <button
                  onClick={() => {
                    notifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id));
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors w-full justify-center"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all as read
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const fullViewportViews: Array<string> = ['landing', 'onboarding'];

// Transition config for view changes - use tween for reliable animations
const viewTransitionConfig = { type: 'tween', duration: 0.3, ease: 'easeInOut' } as const;

export function AppShell() {
  const { currentView, navigate } = useAppStore();
  const compactMode = useAppStore((s) => s.settings.compactMode);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const isFullViewport = fullViewportViews.includes(currentView);
  const [transitioning, setTransitioning] = useState(false);
  const prevViewRef = useRef(currentView);

  // Generate contextual notifications
  useNotifications();

  // Compact mode: sync the root class here (always mounted) so the setting
  // applies on every view, not just while the settings page is open
  useEffect(() => {
    document.documentElement.classList.toggle('compact', compactMode);
  }, [compactMode]);

  // Detect view changes to trigger transition indicator
  useEffect(() => {
    if (prevViewRef.current !== currentView) {
      prevViewRef.current = currentView;
      const timer = setTimeout(() => setTransitioning(false), 400);
      // Use a microtask to avoid synchronous setState in effect
      const raf = requestAnimationFrame(() => setTransitioning(true));
      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(raf);
      };
    }
  }, [currentView]);

  const handleGoDashboard = () => navigate('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return <LandingPage />;
      case 'onboarding':
        return <OnboardingFlow />;
      case 'dashboard':
        return <Dashboard />;
      case 'tutor':
        return <TutorView />;
      case 'upload':
        return <UploadView />;
      case 'courses':
        return <CoursesView />;
      case 'quiz':
        return <QuizView />;
      case 'profile':
        return <ProfileView />;
      case 'course-detail':
        return <CourseDetail />;
      case 'card-study':
        return <CardStudyView />;
      case 'notes':
        return <NotesView />;
      case 'focus-timer':
        return <FocusTimerView />;
      case 'leaderboard':
        return <LeaderboardView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  const viewVariant = viewTransitions[currentView] || defaultTransition;

  return (
    <>
      <StoreInitializer />
      <SearchModal />
      <KeyboardShortcuts />

      <AnimatePresence mode="wait">
        {isFullViewport ? (
          <motion.div
            key={currentView}
            variants={viewVariant}
            initial={currentView === 'landing' ? false : 'initial'}
            animate="animate"
            exit="exit"
            transition={viewTransitionConfig}
            className="min-h-screen mesh-gradient"
          >
            <TransitionIndicator show={transitioning} />
            <Suspense fallback={<ViewLoader />}>
              <ErrorBoundary onGoDashboard={handleGoDashboard}>
                {renderView()}
              </ErrorBoundary>
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key="app-shell"
            variants={defaultTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={viewTransitionConfig}
            className="flex h-dvh overflow-hidden"
          >
            <AppSidebar />
            <main className={`relative flex-1 h-dvh min-w-0 overflow-y-auto overflow-x-hidden ${currentView === 'tutor' ? '!p-0 !max-w-none' : ''}`}>
              {/* Animated mesh-gradient background */}
              <div
                className="pointer-events-none fixed inset-0 -z-10 opacity-40 dark:opacity-20 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="absolute blur-3xl"
                  style={{
                    top: '-15%',
                    left: '-15%',
                    right: '-15%',
                    bottom: '-15%',
                    background: 'linear-gradient(135deg, oklch(0.627 0.194 149.214 / 0.15) 0%, oklch(0.687 0.159 177.89 / 0.1) 25%, oklch(0.565 0.194 149.214 / 0.08) 50%, oklch(0.627 0.194 149.214 / 0.12) 75%, oklch(0.687 0.159 177.89 / 0.15) 100%)',
                    animation: 'meshBgShift 20s ease-in-out infinite',
                    willChange: 'transform',
                  }}
                />
              </div>
              {/* Noise texture overlay */}
              <div
                className="pointer-events-none fixed inset-0 -z-[9] opacity-[0.015] dark:opacity-[0.03]"
                aria-hidden="true"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '128px 128px',
                }}
              />
              <TransitionIndicator show={transitioning} />
              {/* Content cap grows when the sidebar is collapsed so the
                  freed-up width actually gets used instead of leaving a gap */}
              <div className={`mx-auto ${sidebarCollapsed ? 'max-w-[1600px]' : 'max-w-6xl'} p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] lg:p-8 ${currentView === 'tutor' ? '!max-w-none !p-0' : ''}`}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentView}
                    variants={viewVariant}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={viewTransitionConfig}
                  >
                    <Suspense fallback={<ViewLoader />}>
                      <ErrorBoundary onGoDashboard={handleGoDashboard}>
                        {renderView()}
                      </ErrorBoundary>
                    </Suspense>
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}