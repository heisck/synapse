'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import {
  Brain,
  LayoutDashboard,
  FileUp,
  BookOpen,
  MessageSquare,
  ClipboardCheck,
  User,
  Menu,
  BookMarked,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppView } from '@/types';

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  view: AppView;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
  { icon: FileUp, label: 'Upload Slides', view: 'upload' },
  { icon: BookOpen, label: 'My Courses', view: 'dashboard' },
  { icon: MessageSquare, label: 'Tutor', view: 'tutor' },
  { icon: ClipboardCheck, label: 'Quiz Mode', view: 'quiz' },
  { icon: BookMarked, label: 'Notes', view: 'notes' },
  { icon: User, label: 'Profile', view: 'profile' },
];

const viewLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  tutor: 'Tutor',
  upload: 'Upload',
  quiz: 'Quiz',
  profile: 'Profile',
  notes: 'Notes',
  'course-detail': 'Course Detail',
};

const viewIcons: Record<string, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  tutor: MessageSquare,
  upload: FileUp,
  quiz: ClipboardCheck,
  profile: User,
  notes: BookMarked,
  'course-detail': BookOpen,
};

function SidebarContent({ onNavigate, isMobile = false }: { onNavigate?: () => void; isMobile?: boolean }) {
  const { currentView, navigate, userName, recentViews } = useAppStore();

  const handleNav = (view: AppView) => {
    navigate(view);
    onNavigate?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Brain className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold tracking-tight">SynapseLearn</span>
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1" role="navigation" aria-label="Main navigation">
          {navItems.map((item, index) => {
            const isActive = currentView === item.view;
            return (
              <motion.button
                key={item.view + item.label}
                onClick={() => handleNav(item.view)}
                initial={isMobile ? { opacity: 0, x: -16 } : false}
                animate={isMobile ? { opacity: 1, x: 0 } : false}
                transition={{ delay: 0.05 + index * 0.04, duration: 0.3, ease: 'easeOut' }}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left w-full
                  ${isActive
                    ? isMobile
                      ? 'text-primary-foreground'
                      : 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && isMobile && (
                  <motion.div
                    layoutId="mobile-sidebar-active"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary to-teal-500 opacity-90"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                {isActive && !isMobile && (
                  <motion.div
                    layoutId="sidebar-active-dot"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <item.icon className={`h-4 w-4 shrink-0 ${isActive && isMobile ? 'text-primary-foreground relative z-10' : ''}`} />
                <span className={isActive && isMobile ? 'relative z-10' : ''}>{item.label}</span>
              </motion.button>
            );
          })}
        </nav>
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

      {/* User area */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {userName ? userName.slice(0, 2).toUpperCase() : 'SL'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName || 'Student'}</p>
            <p className="text-xs text-muted-foreground">Free Plan</p>
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
  );
}

export function AppSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  // Check for session inactivity for pulse indicator
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
    <>
      {/* Mobile hamburger */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="glass h-10 w-10 rounded-full relative">
              <Menu className="h-5 w-5" />
              {/* Pulse indicator for unread notifications / reminders */}
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
            className="w-72 p-0 backdrop-blur-xl bg-background/80"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} isMobile />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col h-screen sticky top-0 border-r border-border bg-sidebar">
        <SidebarContent />
      </aside>
    </>
  );
}