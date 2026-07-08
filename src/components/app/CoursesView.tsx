'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { BookOpen, Search, X, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';
import { useOpenCourse } from '@/hooks/useOpenCourse';
import { CourseCard } from './CourseCard';
import { EmptyState } from './EmptyState';
import { CATEGORY_CONFIG } from './UploadView';

const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export function CoursesView() {
  const { courses, courseCategories, navigate } = useAppStore();
  const { openCourse } = useOpenCourse();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => {
    const set = new Set<string>();
    courses.forEach((c) => set.add(courseCategories[c.id] || c.subject || 'Other'));
    return ['All', ...Array.from(set).filter(Boolean)];
  }, [courses, courseCategories]);

  const filteredCourses = useMemo(() => {
    let result = courses;
    if (selectedCategory !== 'All') {
      result = result.filter((c) => (courseCategories[c.id] || c.subject || 'Other') === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [courses, courseCategories, selectedCategory, searchQuery]);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6 pt-2 lg:pt-4">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">My Courses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {courses.length} course{courses.length !== 1 ? 's' : ''} in your library
          </p>
        </div>
        <Button onClick={() => navigate('upload')} className="glow-emerald transition-shadow duration-300 shrink-0">
          <Upload className="h-4 w-4 mr-2" />
          Upload Slides
        </Button>
      </motion.div>

      {courses.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search courses by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const isActive = selectedCategory === cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`category-chip shrink-0 ${config?.chipClass || 'category-chip-other'} ${isActive ? 'active' : ''}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {courses.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Upload your first set of slides to create a course and start learning with your AI tutor."
            actionLabel="Upload Slides"
            onAction={() => navigate('upload')}
          />
        </motion.div>
      ) : filteredCourses.length === 0 ? (
        <motion.div variants={fadeUp}>
          <EmptyState
            icon={Search}
            title="No matching courses"
            description="Try a different search term or category filter."
            variant="search"
          />
        </motion.div>
      ) : (
        <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredCourses.map((course) => (
              <motion.div
                key={course.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <CourseCard course={course} onClick={() => openCourse(course)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}
