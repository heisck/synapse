'use client';

import { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { AppSidebar } from './AppSidebar';
import { StoreInitializer } from './StoreInitializer';

const LandingPage = lazy(() =>
  import('@/components/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const Dashboard = lazy(() => import('./Dashboard'));
const TutorView = lazy(() => import('./TutorView'));
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
  return null;
}

function KeyboardShortcuts() {
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
            <main className="flex-1 min-h-screen overflow-y-auto">
              <div className="mx-auto max-w-6xl p-4 lg:p-8">
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