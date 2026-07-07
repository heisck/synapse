'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Flame,
  Bell,
  Star,
  Users,
  X,
  CheckCheck,
  Trash2,
  BookOpen,
  Target,
  Lightbulb,
  Clock,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type NotificationFilter = 'all' | 'unread' | 'achievements' | 'study' | 'social';

interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FILTER_TABS: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'study', label: 'Study' },
  { key: 'social', label: 'Social' },
];

const NOTIFICATION_TYPE_MAP: Record<string, { icon: typeof Trophy; color: string }> = {
  achievement: { icon: Trophy, color: 'text-amber-500' },
  streak: { icon: Flame, color: 'text-orange-500' },
  reminder: { icon: Bell, color: 'text-sky-500' },
  milestone: { icon: Star, color: 'text-emerald-500' },
  social: { icon: Users, color: 'text-pink-500' },
  goal: { icon: Target, color: 'text-violet-500' },
  review: { icon: BookOpen, color: 'text-teal-500' },
  tip: { icon: Lightbulb, color: 'text-yellow-500' },
};

const CATEGORY_MAP: Record<NotificationFilter, string[]> = {
  all: [],
  unread: [],
  achievements: ['achievement', 'milestone'],
  study: ['streak', 'reminder', 'goal', 'review', 'tip'],
  social: ['social'],
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-400',
};

function getPriorityColor(priority?: string): string {
  return PRIORITY_COLORS[priority || 'low'] || PRIORITY_COLORS.low;
}

export function NotificationCenter({ open, onOpenChange }: NotificationCenterProps) {
  const { notifications, markNotificationRead, markAllNotificationsRead, clearNotification, clearAllNotifications, navigate } = useAppStore();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollFade, setShowScrollFade] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    const categories = CATEGORY_MAP[activeFilter];
    return notifications.filter((n) => {
      if (activeFilter === 'unread') return !n.read;
      if (categories.length > 0) return categories.includes(n.type);
      return true;
    });
  }, [notifications, activeFilter]);

  const handleNotificationClick = useCallback((n: typeof notifications[0]) => {
    if (!n.read) markNotificationRead(n.id);
    if (n.actionView) {
      navigate(n.actionView);
      onOpenChange(false);
    }
  }, [markNotificationRead, navigate, onOpenChange]);

  const handleDismiss = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    clearNotification(id);
  }, [clearNotification]);

  const handleMarkAllRead = useCallback(() => {
    markAllNotificationsRead();
  }, [markAllNotificationsRead]);

  // Scroll fade effect
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowScrollFade(scrollHeight > clientHeight && scrollTop < scrollHeight - clientHeight - 20);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const emptyStateMessages: Record<NotificationFilter, { icon: typeof Bell; message: string }> = {
    all: { icon: Bell, message: 'No notifications yet. Keep studying!' },
    unread: { icon: CheckCheck, message: 'All caught up! No unread notifications.' },
    achievements: { icon: Trophy, message: 'No achievements unlocked yet. Keep going!' },
    study: { icon: BookOpen, message: 'No study notifications at the moment.' },
    social: { icon: Users, message: 'No social notifications yet.' },
  };

  const emptyState = emptyStateMessages[activeFilter];
  const EmptyIcon = emptyState.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="p-5 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notifications
              </DialogTitle>
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="w-3 h-3" />
                <span className="hidden sm:inline">Mark All Read</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-red-500 gap-1"
                onClick={clearAllNotifications}
                disabled={notifications.length === 0}
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Clear All</span>
              </Button>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Stay up to date with your learning progress
          </DialogDescription>
        </DialogHeader>

        {/* Filter Tabs */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5 overflow-x-auto">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  'relative px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors',
                  activeFilter === tab.key
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {activeFilter === tab.key && (
                  <motion.div
                    layoutId="notif-filter-indicator"
                    className="absolute inset-0 rounded-md bg-background shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Notification List */}
        <ScrollArea className="flex-1 px-5" ref={scrollRef}>
          <div className="py-2 relative">
            {filteredNotifications.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {filteredNotifications.map((notification) => {
                  const typeInfo = NOTIFICATION_TYPE_MAP[notification.type] || { icon: Bell, color: 'text-muted-foreground' };
                  const TypeIcon = typeInfo.icon;
                  const priorityColor = getPriorityColor(notification.priority);

                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 50, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className={cn(
                        'group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-accent/50',
                        !notification.read && 'bg-primary/[0.03]',
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {/* Priority dot + Icon */}
                      <div className="relative shrink-0 mt-0.5">
                        <div className={cn(
                          'h-8 w-8 rounded-lg flex items-center justify-center',
                          notification.read
                            ? 'bg-muted/50'
                            : 'bg-primary/10',
                        )}>
                          <TypeIcon className={cn('w-4 h-4', typeInfo.color, notification.read && 'opacity-50')} />
                        </div>
                        {!notification.read && (
                          <span className={cn(
                            'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                            priorityColor,
                          )} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className={cn(
                            'text-sm truncate',
                            notification.read ? 'font-medium text-muted-foreground' : 'font-semibold text-foreground',
                          )}>
                            {notification.title}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                          {notification.priority === 'high' && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-200 dark:border-red-900/50 text-red-500">
                              High
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {notification.actionView && (
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <button
                          onClick={(e) => handleDismiss(e, notification.id)}
                          className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
                          aria-label="Dismiss notification"
                        >
                          <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-16 text-muted-foreground"
              >
                <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <EmptyIcon className="w-6 h-6 opacity-40" />
                </div>
                <p className="text-sm text-center">{emptyState.message}</p>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        {/* Scroll Fade Effect */}
        <AnimatePresence>
          {showScrollFade && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none z-10"
            />
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
