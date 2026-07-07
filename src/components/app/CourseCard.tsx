'use client';

import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Course } from '@/types';

interface CourseCardProps {
  course: Course;
  onClick: () => void;
}

export function CourseCard({ course, onClick }: CourseCardProps) {
  const slideCount = course._count?.slides ?? course.slides?.length ?? 0;

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group text-left w-full"
    >
      <div className="glass rounded-xl overflow-hidden border border-border/50 transition-shadow hover:shadow-lg hover:shadow-primary/5">
        {/* Thumbnail */}
        <div className="relative h-32 bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-emerald-600/10 flex items-center justify-center">
          <FileText className="h-10 w-10 text-primary/40 group-hover:text-primary/60 transition-colors" />
          <Badge className="absolute top-3 right-3 text-[10px]" variant="secondary">
            {course.subject}
          </Badge>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {course.description}
          </p>
          <p className="text-xs text-muted-foreground">
            {slideCount} slide{slideCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </motion.button>
  );
}