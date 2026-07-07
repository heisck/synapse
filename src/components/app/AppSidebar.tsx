'use client';

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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { motion } from 'framer-motion';
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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { currentView, navigate, userName } = useAppStore();

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
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view + item.label}
                onClick={() => handleNav(item.view)}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left w-full
                  ${isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-dot"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>

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

  return (
    <>
      {/* Mobile hamburger */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="glass h-10 w-10 rounded-full">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent onNavigate={() => setSidebarOpen(false)} />
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