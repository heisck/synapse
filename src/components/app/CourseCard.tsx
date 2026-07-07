'use client';

import { motion } from 'framer-motion';
import { FileText, Layers, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Course } from '@/types';

interface CourseCardProps {
  course: Course;
  onClick: () => void;
}

const categoryColors: Record<string, string> = {
  mathematics: 'from-rose-500 to-pink-500',
  math: 'from-rose-500 to-pink-500',
  science: 'from-sky-500 to-blue-500',
  physics: 'from-sky-500 to-blue-500',
  chemistry: 'from-violet-500 to-purple-500',
  biology: 'from-lime-500 to-green-500',
  history: 'from-amber-500 to-yellow-500',
  english: 'from-orange-500 to-red-500',
  literature: 'from-orange-500 to-red-500',
  computer: 'from-cyan-500 to-teal-500',
  programming: 'from-cyan-500 to-teal-500',
  cs: 'from-cyan-500 to-teal-500',
};

function getCategoryColor(subject: string): string {
  const lower = subject.toLowerCase();
  for (const [key, color] of Object.entries(categoryColors)) {
    if (lower.includes(key)) return color;
  }
  return 'from-primary to-emerald-400';
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
  const categoryGradient = getCategoryColor(course.subject);

  return (
    <motion.button
      whileHover={{
        scale: 1.02,
        y: -6,
        transition: { type: 'spring', stiffness: 300, damping: 20 },
      }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group text-left w-full"
    >
      <div className="glass-hover card-shadow rounded-xl overflow-hidden border border-border/50 relative">
        {/* Category color top bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${categoryGradient}`} />

        {/* Thumbnail */}
        <div className="relative h-32 bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-600/10 flex items-center justify-center overflow-hidden">
          <FileText className="h-10 w-10 text-primary/40 group-hover:text-primary/60 transition-colors relative z-10" />
          <Badge className="absolute top-3 right-3 text-[10px] z-10" variant="secondary">
            {course.subject}
          </Badge>

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
    </motion.button>
  );
}