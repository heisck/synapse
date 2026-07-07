'use client';

import { Suspense, lazy, useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, LayoutDashboard, MessageSquare, Upload, ClipboardCheck, User, Search, BookMarked, Sparkles, FileUp, ArrowUp, ArrowDown, ArrowRight, Settings, Keyboard, Timer, Bell, Flame, Target, Lightbulb, Clock, CheckCheck } from 'lucide-react';
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
const Dashboard = lazy(() => import('./Dashboard'));
const TutorView = lazy(() =>
  import('@/components/tutor/TutorView').then((m) => ({ default: m.TutorView }))
);
const UploadView = lazy(() => import('./UploadView'));
const QuizView = lazy(() => import('./QuizView'));
const OnboardingFlow = lazy(() => import('./OnboardingFlow'));
const ProfileView = lazy(() => import('./ProfileView'));
const CourseDetail = lazy(() => import('./CourseDetail'));
const NotesView = lazy(() => import('./NotesView'));
const SettingsView = lazy(() => import('./SettingsView'));
const FocusTimerView = lazy(() => import('./FocusTimerView').then((m) => ({ default: m.FocusTimerView })));

function ViewLoader() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22, mass: 0.8 }}
      className="flex h-full min-h-[60vh] items-center justify-center"
    >
      <div className="glass rounded-2xl p-8 flex flex-col items-center gap-5 max-w-xs w-full">
        {/* Brain icon with pulsing glow */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 8px rgba(16, 185, 129, 0.15)',
              '0 0 28px rgba(16, 185, 129, 0.35)',
              '0 0 8px rgba(16, 185, 129, 0.15)',
            ],
            scale: [1, 1.06, 1],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
        >
          <Brain className="h-8 w-8 text-primary" />
        </motion.div>

        {/* Animated gradient text */}
        <p className="gradient-text-animated text-lg font-semibold">Loading...</p>

        {/* Three bouncing dots */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{
                y: [0, -10, 0],
                opacity: [0.4, 1, 0.4],
                scale: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.18,
              }}
              className="h-2.5 w-2.5 rounded-full bg-primary"
            />
          ))}
        </div>
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
const viewTransitions: Record<string, { initial: object; animate: object; exit: object }> = {
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
  settings: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
};

const defaultTransition = {
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
    { label: 'Quiz Mode', view: 'quiz' as AppView, icon: ClipboardCheck },
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

  const handleSelect = (idx: number) => {
    let i = 0;
    if (!query) {
      if (idx < recentViewItems.length) {
        const viewItem = recentViewItems[idx];
        addRecentView(viewItem.view);
        navigate(viewItem.view);
        setOpen(false);
        setQuery('');
        return;
      }
      i += recentViewItems.length;
    }
    if (!query) {
      if (idx < i + recentCourseItems.length) {
        const courseItem = recentCourseItems[idx - i];
        courseItem.action();
        setOpen(false);
        setQuery('');
        return;
      }
      i += recentCourseItems.length;
    }
    if (!query) {
      if (idx < i + quickActions.length) {
        const actionItem = quickActions[idx - i];
        actionItem.action();
        setOpen(false);
        setQuery('');
        return;
      }
      i += quickActions.length;
    }
    const viewItem = uniqueViewItems[idx - i];
    if (viewItem) {
      addRecentView(viewItem.view);
      navigate(viewItem.view);
      setOpen(false);
      setQuery('');
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

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

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
            onChange={(e) => setQuery(e.target.value)}
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
                      setOpen(false);
                      setQuery('');
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
                      setOpen(false);
                      setQuery('');
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
                      setOpen(false);
                      setQuery('');
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
                      setOpen(false);
                      setQuery('');
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

const shortcutGroups = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['⌘', '1'], description: 'Dashboard' },
      { keys: ['⌘', '2'], description: 'AI Tutor' },
      { keys: ['⌘', '3'], description: 'Upload' },
      { keys: ['⌘', '4'], description: 'Quiz' },
      { keys: ['⌘', '5'], description: 'Notes' },
      { keys: ['⌘', '6'], description: 'Profile' },
      { keys: ['⌘', '7'], description: 'Settings' },
      { keys: ['⌘', '8'], description: 'Focus Timer' },
      { keys: ['⌘', '9'], description: 'Notes' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Search' },
      { keys: ['⌘', ','], description: 'Shortcuts' },
    ],
  },
  {
    title: 'Quiz',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navigate options' },
      { keys: ['Enter'], description: 'Select option' },
      { keys: ['1', '2', '3', '4'], description: 'Select answer option' },
    ],
  },
];

function KeyboardShortcuts() {
  const { navigate } = useAppStore();
  const [open, setOpen] = useState(false);

  // Navigation shortcuts + Cmd+, to open this dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // ? key (Shift+/) without Cmd/Ctrl/Alt opens shortcuts dialog
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // Cmd+, opens shortcuts dialog
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); navigate('dashboard'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); navigate('tutor'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') { e.preventDefault(); navigate('upload'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '4') { e.preventDefault(); navigate('quiz'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '5') { e.preventDefault(); navigate('notes'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '6') { e.preventDefault(); navigate('profile'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '7') { e.preventDefault(); navigate('settings'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '8') { e.preventDefault(); navigate('focus-timer'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '9') { e.preventDefault(); navigate('notes'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <>
      {/* Floating ? button */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full glass pulse-glow border border-border/50 text-sm font-bold text-primary shadow-lg cursor-pointer"
        aria-label="Keyboard shortcuts"
      >
        ?
      </motion.button>

      {/* Shortcuts Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-lg p-0 gap-0 overflow-hidden mesh-gradient">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Keyboard className="h-5 w-5 text-primary" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-5 max-h-[60vh] overflow-y-auto">
            {shortcutGroups.map((group, gi) => (
              <motion.div
                key={group.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: gi * 0.1 }}
                className="space-y-2"
              >
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</h4>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut, si) => (
                    <motion.div
                      key={si}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: gi * 0.1 + si * 0.04 }}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <span className="text-sm text-foreground/80">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, ki) => (
                          <span key={ki} className="flex items-center">
                            {ki > 0 && <span className="text-xs text-muted-foreground/50 mx-0.5">+</span>}
                            <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-border/60 bg-muted/80 px-1.5 font-mono text-[11px] font-medium text-foreground/70 shadow-sm">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
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
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/60 hover:bg-accent/50 transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
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

// Spring transition config for view changes
const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

export function AppShell() {
  const { currentView, navigate } = useAppStore();
  const isFullViewport = fullViewportViews.includes(currentView);
  const [transitioning, setTransitioning] = useState(false);
  const prevViewRef = useRef(currentView);

  // Generate contextual notifications
  useNotifications();

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
      case 'quiz':
        return <QuizView />;
      case 'profile':
        return <ProfileView />;
      case 'course-detail':
        return <CourseDetail />;
      case 'notes':
        return <NotesView />;
      case 'focus-timer':
        return <FocusTimerView />;
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
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
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
            key={`app-${currentView}`}
            variants={viewVariant}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={springTransition}
            className="flex min-h-screen"
          >
            <AppSidebar />
            <main className={`relative flex-1 min-h-screen overflow-y-auto overflow-x-hidden ${currentView === 'tutor' ? '!p-0 !max-w-none' : ''}`}>
              {/* Notification bell - top right */}
              <div className="fixed top-4 right-4 z-40">
                <NotificationBell />
              </div>
              {/* Animated mesh-gradient background */}
              <div
                className="pointer-events-none fixed inset-0 -z-10 opacity-40 dark:opacity-20"
                aria-hidden="true"
              >
                <div
                  className="absolute inset-0 blur-3xl"
                  style={{
                    background: 'linear-gradient(135deg, oklch(0.627 0.194 149.214 / 0.15) 0%, oklch(0.687 0.159 177.89 / 0.1) 25%, oklch(0.565 0.194 149.214 / 0.08) 50%, oklch(0.627 0.194 149.214 / 0.12) 75%, oklch(0.687 0.159 177.89 / 0.15) 100%)',
                    backgroundSize: '400% 400%',
                    animation: 'meshBgShift 20s ease-in-out infinite',
                  }}
                />
              </div>
              {/* Noise texture overlay */}
              <div
                className="pointer-events-none fixed inset-0 -z-[9] opacity-[0.015] dark:opacity-[0.03]"
                aria-hidden="true"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'repeat',
                  backgroundSize: '128px 128px',
                }}
              />
              <TransitionIndicator show={transitioning} />
              <div className={`mx-auto max-w-6xl p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] lg:p-8 ${currentView === 'tutor' ? '!max-w-none !p-0' : ''}`}>
                <Suspense fallback={<ViewLoader />}>
                  <ErrorBoundary onGoDashboard={handleGoDashboard}>
                    {renderView()}
                  </ErrorBoundary>
                </Suspense>
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}