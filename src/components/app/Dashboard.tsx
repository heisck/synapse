'use client';

import { motion } from 'framer-motion';
import {
  Flame,
  BookOpen,
  Target,
  Zap,
  MessageSquare,
  Upload,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/appStore';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { StatsCard } from './StatsCard';
import { CourseCard } from './CourseCard';
import { EmptyState } from './EmptyState';

const topicChips = ['Cell Biology', 'Organic Chemistry', 'Data Structures', 'Physics'];

const recentActivity = [
  { id: '1', type: 'session' as const, text: 'Completed Cell Biology session', time: '2 hours ago' },
  { id: '2', type: 'quiz' as const, text: 'Scored 85% on Organic Chemistry quiz', time: 'Yesterday' },
  { id: '3', type: 'upload' as const, text: 'Uploaded "Data Structures" slides', time: '2 days ago' },
  { id: '4', type: 'session' as const, text: 'Started Physics tutoring session', time: '3 days ago' },
];

const activityIcons: Record<string, typeof MessageSquare> = {
  session: MessageSquare,
  quiz: Target,
  upload: Upload,
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

export function Dashboard() {
  const { courses, userName, navigate, setActiveTopic, setActiveSession, setActiveCourse, setActiveSlides, setCurrentSlideIndex } =
    useAppStore();

  const handleStartSession = (topic: string) => {
    setActiveTopic(topic);
    setActiveSession(`session-${Date.now()}`);
    navigate('tutor');
  };

  const handleCourseClick = (course: (typeof courses)[number]) => {
    setActiveCourse(course);
    if (course.slides) {
      setActiveSlides(course.slides);
    }
    setCurrentSlideIndex(0);
    navigate('course-detail');
  };

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-8 pt-2 lg:pt-4"
    >
      {/* Welcome Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1 pl-14 lg:pl-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold">
              Welcome back, <span className="gradient-text">{userName || 'Student'}</span>
            </h1>
            <div className="flex items-center gap-1 text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
              <Flame className="h-4 w-4" />
              <span className="text-xs font-bold">3</span>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2 pl-14 lg:pl-0">
          <ThemeToggle />
          <Button onClick={() => handleStartSession('General Study')} size="sm">
            <Sparkles className="h-4 w-4 mr-2" />
            Start Session
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('upload')}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Slides
          </Button>
        </div>
      </motion.div>

      {/* Quick Start Card */}
      <motion.div variants={fadeUp}>
        <div
          className="relative overflow-hidden rounded-xl p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white cursor-pointer group"
          onClick={() => handleStartSession('Today\'s Topic')}
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-emerald-100 text-sm font-medium">Quick Start</p>
              <h2 className="text-xl font-bold">Continue learning with your AI Tutor</h2>
              <p className="text-emerald-100/80 text-sm">
                Pick a topic below or upload new study material to get started
              </p>
              <div className="flex items-center gap-2 pt-1 text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                Start now <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="h-20 w-20 rounded-2xl bg-white/10 flex items-center justify-center animate-float">
                <Zap className="h-10 w-10 text-white/80" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Topic Chips */}
      <motion.div variants={fadeUp} className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Popular Topics</h3>
        <div className="flex flex-wrap gap-2">
          {topicChips.map((topic) => (
            <button
              key={topic}
              onClick={() => handleStartSession(topic)}
              className="rounded-full border border-border bg-background/80 px-4 py-2 text-sm font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
            >
              {topic}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={fadeUp}>
        <div className="glass rounded-xl p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatsCard
              icon={BookOpen}
              label="Active Courses"
              value={courses.length}
              trend="up"
              change="+2 this week"
            />
            <StatsCard
              icon={Target}
              label="Mastery Rate"
              value="78%"
              trend="up"
              change="+5%"
            />
            <StatsCard
              icon={Zap}
              label="Sessions"
              value="24"
              trend="up"
              change="+3 this week"
            />
            <StatsCard
              icon={MessageSquare}
              label="Questions"
              value="156"
              trend="down"
              change="-2 today"
            />
          </div>
        </div>
      </motion.div>

      {/* My Courses */}
      <motion.div variants={fadeUp} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">My Courses</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('upload')}>
            <Upload className="h-4 w-4 mr-1" />
            Add New
          </Button>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Upload your first set of slides to create a course and start learning with your AI tutor."
            actionLabel="Upload Slides"
            onAction={() => navigate('upload')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.slice(0, 6).map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onClick={() => handleCourseClick(course)}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={fadeUp} className="space-y-4 pb-8">
        <h3 className="font-semibold text-lg">Recent Activity</h3>
        <div className="glass rounded-xl divide-y divide-border/50">
          {recentActivity.map((activity) => {
            const Icon = activityIcons[activity.type] ?? Clock;
            return (
              <div
                key={activity.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors rounded-lg"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.text}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}