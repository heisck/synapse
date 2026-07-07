'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Layers, Clock, Bookmark, BookmarkCheck, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/stores/appStore';
import { CATEGORY_CONFIG } from './UploadView';
import type { Course } from '@/types';

interface CourseCardProps {
  course: Course;
  onClick: () => void;
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

export function CourseCard({ course, onClick }: CourseCardProps) {
  const slideCount = course._count?.slides ?? course.slides?.length ?? 0;
  const { courseCategories, bookmarkedCourses, toggleBookmark, removeCourse } = useAppStore();
  const isBookmarked = bookmarkedCourses.includes(course.id);
  const category = courseCategories[course.id] || course.subject;
  const config = CATEGORY_CONFIG[category];
  const stripeColor = config?.stripeColor || 'bg-gray-400';

  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/courses/${course.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete course');
      removeCourse(course.id);
      toast.success(`"${course.title}" deleted.`);
      setShowDeleteConfirm(false);
    } catch {
      toast.error('Failed to delete course. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [course.id, course.title, removeCourse]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  return (
    <>
    <motion.div
      role="button"
      tabIndex={0}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="group text-left w-full cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        className="glass-hover card-shadow rounded-xl overflow-hidden border border-border/50 relative transition-all duration-300"
      >
        {/* Category color stripe on left edge (calm color-coding, no top line) */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 z-20 ${stripeColor}`} />

        {/* Thumbnail */}
        <div className="relative h-32 bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-600/10 flex items-center justify-center overflow-hidden">
          <FileText className="h-10 w-10 text-primary/40 group-hover:text-primary/60 transition-colors relative z-10" />
          <Badge className="absolute top-3 left-3 text-[10px] z-10" variant="secondary">
            {course.subject}
          </Badge>
          {/* Bookmark toggle */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={(e) => { e.stopPropagation(); toggleBookmark(course.id); }}
            className={`absolute top-3 right-3 z-20 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 ${isBookmarked ? 'bg-emerald-500/20 text-emerald-500 glow-badge' : 'bg-background/60 text-muted-foreground hover:text-primary hover:bg-background/80'}`}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this course'}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isBookmarked ? 'bookmarked' : 'not-bookmarked'}
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </motion.div>
            </AnimatePresence>
          </motion.button>

          {/* Delete course */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
            className="absolute top-3 right-14 z-20 h-8 w-8 rounded-full flex items-center justify-center bg-background/60 text-muted-foreground hover:text-destructive hover:bg-background/80 transition-all duration-200"
            aria-label="Delete course"
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>

          {/* Hover gradient overlay with "Open" text */}
          <motion.div
            initial={false}
            className="absolute inset-0 z-10 flex items-center justify-center"
            style={{
              background: 'linear-gradient(to top, rgba(16, 185, 129, 0.4) 0%, transparent 60%)',
            }}
          >
            <motion.span
              initial={{ y: 20, opacity: 0 }}
              whileHover={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="text-white font-semibold text-sm tracking-wide opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 ease-out"
            >
              Open
            </motion.span>
          </motion.div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2.5">
          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {course.description}
          </p>

          {/* Slide count badge + last studied */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              <span>{slideCount} slide{slideCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
              <Clock className="h-3 w-3" />
              <span>{getRelativeTime(course.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete &quot;{course.title}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this course and all {slideCount} of its slides.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}