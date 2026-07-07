'use client';

import { Suspense, lazy, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, LayoutDashboard, MessageSquare, Upload, ClipboardCheck, User, Search } from 'lucide-react';
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
  const { navigate } = useAppStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

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

  const searchItems = [
    { label: 'Dashboard', view: 'dashboard' as AppView, icon: LayoutDashboard },
    { label: 'AI Tutor', view: 'tutor' as AppView, icon: MessageSquare },
    { label: 'Upload Slides', view: 'upload' as AppView, icon: Upload },
    { label: 'Quiz Mode', view: 'quiz' as AppView, icon: ClipboardCheck },
    { label: 'Profile', view: 'profile' as AppView, icon: User },
  ];

  const filtered = query
    ? searchItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : searchItems;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            autoFocus
            placeholder="Search views..."
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            ESC
          </kbd>
        </div>
        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        )}
        <div className="max-h-[300px] overflow-y-auto px-1 pb-1">
          {filtered.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                onClick={() => {
                  navigate(item.view);
                  setOpen(false);
                  setQuery('');
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </button>
            );
          })}
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
      if ((e.metaKey || e.ctrlKey) && e.key === '5') { e.preventDefault(); navigate('profile'); }
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