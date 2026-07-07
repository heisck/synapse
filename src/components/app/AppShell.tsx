'use client';

import { Suspense, lazy, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, LayoutDashboard, MessageSquare, Upload, ClipboardCheck, User, Search, BookMarked, Sparkles, FileUp, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { AppSidebar } from './AppSidebar';
import { StoreInitializer } from './StoreInitializer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { AppView } from '@/types';

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

function ViewLoader() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

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
    { label: 'Profile', view: 'profile' as AppView, icon: User },
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
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
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

function KeyboardShortcuts() {
  const { navigate } = useAppStore();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); navigate('dashboard'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); navigate('tutor'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') { e.preventDefault(); navigate('upload'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '4') { e.preventDefault(); navigate('quiz'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '5') { e.preventDefault(); navigate('notes'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '6') { e.preventDefault(); navigate('profile'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
  return null;
}

const fullViewportViews: Array<string> = ['landing', 'onboarding'];

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

export function AppShell() {
  const { currentView } = useAppStore();
  const isFullViewport = fullViewportViews.includes(currentView);

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
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <StoreInitializer />
      <SearchModal />
      <KeyboardShortcuts />

      <AnimatePresence mode="wait">
        {isFullViewport ? (
          <motion.div
            key={currentView}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="min-h-screen mesh-gradient"
          >
            <Suspense fallback={<ViewLoader />}>
              {renderView()}
            </Suspense>
          </motion.div>
        ) : (
          <motion.div
            key={`app-${currentView}`}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex min-h-screen"
          >
            <AppSidebar />
            <main className={`flex-1 min-h-screen overflow-y-auto ${currentView === 'tutor' ? '!p-0 !max-w-none' : ''}`}>
              <div className={`mx-auto max-w-6xl p-4 lg:p-8 ${currentView === 'tutor' ? '!max-w-none !p-0' : ''}`}>
                <Suspense fallback={<ViewLoader />}>
                  {renderView()}
                </Suspense>
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}