'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  ClipboardCheck,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  GraduationCap,
  Check,
  CheckCircle2,
  Clock,
  Trophy,
  Target,
  Trash2,
  AlertTriangle,
  Loader2,
  Layers,
  X,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { useCountUp } from '@/hooks/useCountUp';
import type { Slide } from '@/types';


const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const bulletVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' },
  }),
};

// Confetti particle component
function ConfettiParticle({ index }: { index: number }) {
  const colors = ['#10b981', '#14b8a6', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];
  const color = colors[index % colors.length];
  const startX = 50 + (Math.sin(index * 2.4) * 40);
  const startY = -10;
  const endX = startX + (Math.cos(index * 1.7) * 60);
  const endY = 120;
  const rotation = index * 137.5;
  const size = 4 + (index % 3) * 2;

  return (
    <motion.div
      initial={{ x: `${startX}%`, y: `${startY}%`, rotate: 0, opacity: 1, scale: 1 }}
      animate={{
        y: `${endY}%`,
        x: `${endX}%`,
        rotate: rotation + 720,
        opacity: 0,
        scale: 0.3,
      }}
      transition={{
        duration: 1.5 + (index % 4) * 0.3,
        delay: index * 0.05,
        ease: 'easeIn',
      }}
      className="absolute rounded-sm pointer-events-none"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        left: 0,
        top: 0,
      }}
    />
  );
}

export function CourseDetail() {
  const {
    activeCourse,
    activeSlides,
    currentSlideIndex,
    setCurrentSlideIndex,
    navigate,
    setActiveTopic,
    setActiveSession,
    viewedSlides,
    markSlideViewed,
    completedCourses,
    completeCourse,
    quizScore,
    quizTotal,
    studySessions,
    setActiveSlides,
    removeCourse,
    setCurrentQuestions,
  } = useAppStore();

  const [showDeleteCourseConfirm, setShowDeleteCourseConfirm] = useState(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [isPreparingQuiz, setIsPreparingQuiz] = useState(false);
  const [slideQuestionCounts, setSlideQuestionCounts] = useState<Record<string, number>>({});
  const [generatingSlideId, setGeneratingSlideId] = useState<string | null>(null);

  const handleGenerateSlideQuestions = async (slide: Slide) => {
    // Toggle the panel closed if it's already showing results for this slide
    if (activeSlideId === slide.id) {
      setActiveSlideId(null);
      return;
    }

    setActiveSlideId(slide.id);
    if (slideQuestionCounts[slide.id] !== undefined) return; // already generated

    setGeneratingSlideId(slide.id);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slideId: slide.id, courseId: activeCourse?.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate questions.' }));
        throw new Error(err.error || 'Failed to generate questions.');
      }
      const data = await res.json();
      setSlideQuestionCounts((prev) => ({ ...prev, [slide.id]: data.questions.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate questions. Please try again.');
      setActiveSlideId(null);
    } finally {
      setGeneratingSlideId(null);
    }
  };

  const handleDeleteCourse = async () => {
    if (!activeCourse) return;
    setIsDeletingCourse(true);
    try {
      const res = await fetch(`/api/courses/${activeCourse.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete course');
      removeCourse(activeCourse.id);
      toast.success(`"${activeCourse.title}" deleted.`);
      setShowDeleteCourseConfirm(false);
      navigate('courses');
    } catch {
      toast.error('Failed to delete course. Please try again.');
    } finally {
      setIsDeletingCourse(false);
    }
  };

  // Only ever show the user's real slides — never demo placeholders
  const slides = activeSlides.length > 0 ? activeSlides : (activeCourse?.slides ?? []);
  const currentSlide = slides[currentSlideIndex] ?? slides[0];
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [readProgress, setReadProgress] = useState(0);
  const [slideToDelete, setSlideToDelete] = useState<Slide | null>(null);
  const [isDeletingSlide, setIsDeletingSlide] = useState(false);
  // Full-screen slide viewer opened from the thumbnail strip
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleDeleteSlide = useCallback(async () => {
    if (!slideToDelete) return;
    setIsDeletingSlide(true);
    try {
      const res = await fetch(`/api/slides/${slideToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete slide');
      const remaining = slides.filter((s) => s.id !== slideToDelete.id);
      setActiveSlides(remaining);
      if (currentSlideIndex >= remaining.length) {
        setCurrentSlideIndex(Math.max(0, remaining.length - 1));
      }
      toast.success('Slide deleted.');
      setSlideToDelete(null);
    } catch {
      toast.error('Failed to delete slide. Please try again.');
    } finally {
      setIsDeletingSlide(false);
    }
  }, [slideToDelete, slides, setActiveSlides, currentSlideIndex, setCurrentSlideIndex]);
  const [slideDirection, setSlideDirection] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Course progress computation
  const courseProgress = useMemo(() => {
    const courseSlideIds = slides.map((s) => s.id);
    const viewedCount = courseSlideIds.filter((id) => viewedSlides.includes(id)).length;
    const pct = slides.length > 0 ? Math.round((viewedCount / slides.length) * 100) : 0;
    return { viewedCount, total: slides.length, pct };
  }, [slides, viewedSlides]);

  const isCourseCompleted = activeCourse ? completedCourses.includes(activeCourse.id) : false;

  // Stats computation
  const quizzesTaken = useMemo(() => {
    if (!activeCourse) return 0;
    return studySessions.filter((s) =>
      s.topic.toLowerCase().includes('quiz') &&
      s.topic.toLowerCase().includes(activeCourse.title.toLowerCase())
    ).length;
  }, [studySessions, activeCourse]);

  const avgScore = useMemo(() => {
    if (quizScore === null || quizTotal === null) return 0;
    return quizTotal > 0 ? Math.round((quizScore / quizTotal) * 100) : 0;
  }, [quizScore, quizTotal]);

  const timeSpent = useMemo(() => {
    if (!activeCourse) return 0;
    return studySessions
      .filter((s) => s.topic.toLowerCase().includes(activeCourse.title.toLowerCase()))
      .reduce((sum, s) => sum + s.duration, 0);
  }, [studySessions, activeCourse]);

  // Animated counter values
  const animatedViewed = useCountUp(courseProgress.viewedCount, { duration: 800 });
  const animatedQuizzes = useCountUp(quizzesTaken, { duration: 800 });
  const animatedScore = useCountUp(avgScore, { duration: 800 });
  const animatedTime = useCountUp(timeSpent, { duration: 800 });

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowRight' && lightboxIndex < slides.length - 1) setLightboxIndex(lightboxIndex + 1);
      else if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, slides.length]);

  // Keep the main panel in sync with the slide opened in the lightbox
  useEffect(() => {
    if (lightboxIndex !== null && lightboxIndex !== currentSlideIndex) {
      setCurrentSlideIndex(lightboxIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex]);

  // Mark current slide as viewed when navigating to it
  useEffect(() => {
    if (currentSlide) {
      markSlideViewed(currentSlide.id);
    }
  }, [currentSlide, markSlideViewed]);

  // Reading progress indicator
  useEffect(() => {
    const handleScroll = () => {
      const el = document.getElementById('slide-content-scroll');
      if (!el) return;
      const scrollable = el.scrollHeight - el.clientHeight;
      if (scrollable <= 0) {
        setReadProgress(100);
        return;
      }
      setReadProgress(Math.min(100, (el.scrollTop / scrollable) * 100));
    };
    const el = document.getElementById('slide-content-scroll');
    if (el) el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el?.removeEventListener('scroll', handleScroll);
  }, [currentSlideIndex]);

  const handleSlideSelect = (index: number) => {
    setSlideDirection(index > currentSlideIndex ? 1 : -1);
    setCurrentSlideIndex(index);
  };

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      setSlideDirection(-1);
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      setSlideDirection(1);
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handleStartTutor = () => {
    setActiveSession(`session-${Date.now()}`, activeCourse?.id, activeCourse?.title ?? 'Study Session');
    navigate('tutor');
  };

  const handleTakeQuiz = async () => {
    if (!activeCourse) {
      navigate('quiz');
      return;
    }

    setIsPreparingQuiz(true);
    try {
      const existingRes = await fetch(`/api/questions?courseId=${activeCourse.id}`);
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        if (existingData.questions?.length > 0) {
          setCurrentQuestions(existingData.questions);
          navigate('quiz');
          return;
        }
      }

      // No questions generated for this course yet — generate them now
      const genRes = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: activeCourse.id }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({ error: 'Failed to generate quiz questions.' }));
        throw new Error(err.error || 'Failed to generate quiz questions.');
      }
      const genData = await genRes.json();
      setCurrentQuestions(genData.questions);
      navigate('quiz');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare quiz. Please try again.');
    } finally {
      setIsPreparingQuiz(false);
    }
  };

  const handleStudyCards = () => {
    navigate('card-study');
  };

  const handleMarkComplete = useCallback(() => {
    if (!activeCourse || isCourseCompleted) return;
    // Mark all slides as viewed
    slides.forEach((s) => markSlideViewed(s.id));
    completeCourse(activeCourse.id);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  }, [activeCourse, isCourseCompleted, slides, markSlideViewed, completeCourse]);

  const isSlideViewed = useCallback((slideId: string) => {
    return viewedSlides.includes(slideId);
  }, [viewedSlides]);

  return (
    <>
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="space-y-4 pt-2 lg:pt-4 pl-14 lg:pl-0"
    >
      {/* Gradient Header Banner */}
      <motion.div
        variants={fadeUp}
        className="rounded-xl overflow-hidden relative"
      >
        <div className="mesh-gradient gradient-border rounded-xl p-5">
          <div className="relative z-10">
            {/* Breadcrumb navigation */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3" aria-label="Breadcrumb">
              <button onClick={() => navigate('dashboard')} className="hover:text-foreground transition-colors font-medium slide-up-fade stagger-1">Dashboard</button>
              <ChevronRight className="h-3 w-3 shrink-0 slide-up-fade stagger-2" />
              <span className="text-foreground truncate max-w-[200px] sm:max-w-none slide-up-fade stagger-3">{activeCourse?.title ?? 'Course Detail'}</span>
            </nav>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('dashboard')}
                aria-label="Back to dashboard"
                className="hover:bg-primary/10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary shrink-0" />
                  <h1 className="text-xl font-bold truncate gradient-text">{activeCourse?.title ?? 'Course Detail'}</h1>
                  {isCourseCompleted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                    </motion.div>
                  )}
                </div>
                {activeCourse?.description && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{activeCourse.description}</p>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="sm" onClick={handleStartTutor} className="glow-emerald">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Start Tutor
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="card-hover-lift">
                  <Button size="sm" variant="outline" onClick={handleTakeQuiz} disabled={isPreparingQuiz}>
                    {isPreparingQuiz ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                    )}
                    {isPreparingQuiz ? 'Preparing…' : 'Start Quiz'}
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="card-hover-lift">
                  <Button size="sm" variant="outline" onClick={handleStudyCards}>
                    <Layers className="h-4 w-4 mr-2" />
                    Card Mode
                  </Button>
                </motion.div>
                {!isCourseCompleted && (
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMarkComplete}
                      className="border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Trophy className="h-4 w-4 mr-2" />
                      Mark Complete
                    </Button>
                  </motion.div>
                )}
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDeleteCourseConfirm(true)}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    aria-label="Delete course"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </div>
            {/* Mobile action buttons */}
            <div className="flex sm:hidden gap-2 mt-3 flex-wrap">
              <Button size="sm" className="flex-1" onClick={handleStartTutor}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Start Tutor
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={handleTakeQuiz} disabled={isPreparingQuiz}>
                {isPreparingQuiz ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                )}
                {isPreparingQuiz ? 'Preparing…' : 'Start Quiz'}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={handleStudyCards}>
                <Layers className="h-4 w-4 mr-2" />
                Card Mode
              </Button>
              {!isCourseCompleted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMarkComplete}
                  className="flex-1 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeleteCourseConfirm(true)}
                className="border-destructive/30 text-destructive"
                aria-label="Delete course"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Course Progress Section */}
      <motion.div variants={fadeUp}>
        <div className="glass rounded-xl p-5 space-y-4 glass-card-3d inset-glow">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Course Progress</h3>
            <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
              {courseProgress.pct}%
            </span>
          </div>

          {/* Animated progress bar */}
          <div className="h-3 w-full rounded-full bg-muted/50 overflow-hidden glow-pulse">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89))' }}
              initial={{ width: 0 }}
              animate={{ width: `${courseProgress.pct}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', type: 'spring', stiffness: 200, damping: 25 }}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="glass rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium">Slides Completed</span>
              </div>
              <span className="text-lg font-bold gradient-text">{animatedViewed}</span>
              <span className="text-xs text-muted-foreground">/{courseProgress.total}</span>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium">Quizzes Taken</span>
              </div>
              <span className="text-lg font-bold gradient-text">{animatedQuizzes}</span>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium">Avg Score</span>
              </div>
              <span className="text-lg font-bold gradient-text">{animatedScore}%</span>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium">Time Spent</span>
              </div>
              <span className="text-lg font-bold gradient-text">{animatedTime}</span>
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Confetti overlay */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
          >
            {Array.from({ length: 30 }).map((_, i) => (
              <ConfettiParticle key={i} index={i} />
            ))}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass rounded-xl p-6 text-center shadow-lg"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
              >
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
              </motion.div>
              <p className="font-bold text-lg gradient-text">Course Completed!</p>
              <p className="text-sm text-muted-foreground mt-1">Congratulations on finishing this course.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reading progress bar */}
      <motion.div variants={fadeUp} className="relative">
        <div className="h-1 w-full rounded-full bg-muted/50 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, oklch(0.627 0.194 149.214), oklch(0.687 0.159 177.89))' }}
            animate={{ width: `${readProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </motion.div>

      {/* Slide gallery strip — click a card to open it full-screen */}
      {slides.length > 0 && (
        <motion.div variants={fadeUp} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-muted-foreground">Browse slides</h3>
            <span className="text-xs text-muted-foreground">{slides.length} slides</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => { handleSlideSelect(i); setLightboxIndex(i); }}
                className={`group snap-start shrink-0 w-52 text-left rounded-xl border p-4 transition-colors ${
                  i === currentSlideIndex
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/60 bg-background/40 hover:border-primary/25'
                }`}
                aria-label={`Open slide ${i + 1}: ${slide.title}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <Maximize2 className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors" />
                </div>
                <p className="text-xs font-medium leading-snug line-clamp-2 min-h-[2rem]">{slide.title}</p>
                <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed line-clamp-3">
                  {slide.content.replace(/[#*`>•-]/g, ' ').replace(/\s+/g, ' ').trim()}
                </p>
                {isSlideViewed(slide.id) && (
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <Check className="h-2.5 w-2.5" /> viewed
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Full-screen slide viewer */}
      <AnimatePresence>
        {lightboxIndex !== null && slides[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setLightboxIndex(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Slide viewer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-background border border-border shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {String(lightboxIndex + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
                  </p>
                  <h2 className="text-lg font-semibold truncate">{slides[lightboxIndex].title}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors"
                  aria-label="Close slide viewer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{slides[lightboxIndex].content}</p>
              </div>
              <div className="flex items-center justify-between px-6 py-3 border-t border-border/60">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={lightboxIndex === 0}
                  onClick={() => { const n = lightboxIndex - 1; handleSlideSelect(n); setLightboxIndex(n); }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={lightboxIndex >= slides.length - 1}
                  onClick={() => { const n = lightboxIndex + 1; handleSlideSelect(n); setLightboxIndex(n); }}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content area: two panels */}
      <motion.div variants={fadeUp} className="flex flex-col lg:flex-row gap-4 min-h-[60vh] glass rounded-2xl p-2 lg:p-3">
        {/* Left panel: mini-map / table of contents */}
        <div className="lg:w-72 shrink-0">
          <div className="glass rounded-xl p-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Slides
              </h3>
              <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                {currentSlideIndex + 1}/{slides.length}
              </span>
            </div>
            {/* Mini progress dots */}
            <div className="flex items-center gap-1 mb-3">
              {slides.map((slide, i) => (
                <motion.div
                  key={slide.id}
                  whileHover={{ scale: 1.5 }}
                  onClick={() => handleSlideSelect(i)}
                  className={`cursor-pointer rounded-full transition-all ${
                    i === currentSlideIndex
                      ? 'h-2 w-6 bg-primary shadow-sm shadow-primary/30'
                      : isSlideViewed(slide.id)
                        ? 'h-2 w-2 bg-emerald-500/60'
                        : 'h-2 w-2 bg-muted hover:bg-primary/40'
                  }`}
                />
              ))}
            </div>
            <ScrollArea className="max-h-80 lg:max-h-[65vh]">
              <motion.div
                className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0"
                variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
                initial="initial"
                animate="animate"
              >
                {slides.map((slide, i) => {
                  const viewed = isSlideViewed(slide.id);
                  return (
                    <motion.div
                      key={slide.id}
                      role="button"
                      tabIndex={0}
                      variants={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSlideSelect(i)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSlideSelect(i); }}
                      className={`group/slide flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm whitespace-nowrap lg:whitespace-normal transition-all min-w-[160px] lg:min-w-0 cursor-pointer ${
                        i === currentSlideIndex
                          ? 'bg-gradient-to-r from-primary/10 to-secondary/5 text-primary font-medium shadow-sm border border-primary/10'
                          : viewed
                            ? 'text-foreground glass'
                            : 'text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold transition-colors ${
                        i === currentSlideIndex
                          ? 'bg-primary text-primary-foreground'
                          : viewed
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {viewed && i !== currentSlideIndex ? (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                            <Check className="h-3.5 w-3.5" />
                          </motion.span>
                        ) : i === currentSlideIndex ? (
                          i + 1
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="truncate flex-1">{slide.title}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSlideToDelete(slide); }}
                        className="shrink-0 h-6 w-6 rounded flex items-center justify-center text-muted-foreground/50 opacity-0 group-hover/slide:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                        aria-label={`Delete ${slide.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </motion.div>
            </ScrollArea>
          </div>
        </div>

        {/* Right panel: slide content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait" custom={slideDirection}>
          {currentSlide ? (
            <motion.div
              key={currentSlide.id}
              custom={slideDirection}
              initial={{ opacity: 0, x: slideDirection * 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: slideDirection * -40, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 250, damping: 25 }}
              className="glass rounded-xl p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <motion.div initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring' }}>
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                    </motion.div>
                    <h2 className="text-lg font-semibold leading-snug">{currentSlide.title}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">Slide {currentSlide.order} of {slides.length}</p>
                </div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerateSlideQuestions(currentSlide)}
                    disabled={generatingSlideId === currentSlide.id}
                    className={activeSlideId === currentSlide.id ? 'glow-emerald border-primary/30' : ''}
                  >
                    {generatingSlideId === currentSlide.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    Generate Questions
                  </Button>
                </motion.div>
              </div>

              <Separator />

              {/* Slide content with animated bullet points */}
              <div id="slide-content-scroll" className="prose prose-sm dark:prose-invert max-w-none max-h-[50vh] overflow-y-auto pr-2">
                {currentSlide.content.split('\n').map((line, i) => {
                  if (!line.trim()) return <br key={i} />;
                  if (line.startsWith('• ') || line.startsWith('- ')) {
                    return (
                      <motion.div
                        key={i}
                        custom={i}
                        variants={bulletVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex gap-2 ml-2 py-0.5"
                      >
                        <motion.span
                          className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.06 + 0.1, type: 'spring', stiffness: 400 }}
                        />
                        <span dangerouslySetInnerHTML={{ __html: formatBold(line.slice(2)) }} />
                      </motion.div>
                    );
                  }
                  if (/^\d+\.\s/.test(line)) {
                    return (
                      <motion.div
                        key={i}
                        custom={i}
                        variants={bulletVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex gap-2 ml-2 py-0.5"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold mt-0.5">
                          {line.match(/^(\d+)\./)?.[1]}
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: formatBold(line.replace(/^\d+\.\s/, '')) }} />
                      </motion.div>
                    );
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return (
                      <motion.h3
                        key={i}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="font-semibold text-sm mt-3 mb-1 gradient-text"
                      >
                        {line.replace(/\*\*/g, '')}
                      </motion.h3>
                    );
                  }
                  return (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatBold(line) }}
                    />
                  );
                })}
              </div>

              {/* Slide navigation */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={currentSlideIndex === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {slides.map((slide, i) => (
                    <button
                      key={slide.id}
                      onClick={() => handleSlideSelect(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentSlideIndex ? 'w-4 bg-primary' : 'w-1.5 bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={handleNext}
                  disabled={currentSlideIndex === slides.length - 1}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Generated questions summary */}
              {activeSlideId === currentSlide.id && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="rounded-lg border border-primary/20 bg-primary/5 p-4 overflow-hidden"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <motion.span
                      animate={generatingSlideId === currentSlide.id ? { rotate: 360 } : { rotate: [0, 15, -15, 0] }}
                      transition={generatingSlideId === currentSlide.id ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                    >
                      {generatingSlideId === currentSlide.id ? (
                        <Loader2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-primary" />
                      )}
                    </motion.span>
                    <span className="text-sm font-semibold text-primary">
                      {generatingSlideId === currentSlide.id ? 'Generating Questions…' : 'Questions Generated'}
                    </span>
                  </div>
                  {generatingSlideId !== currentSlide.id && (
                    <p className="text-sm text-muted-foreground">
                      {slideQuestionCounts[currentSlide.id] ?? 0} question{slideQuestionCounts[currentSlide.id] === 1 ? '' : 's'} generated for &ldquo;{currentSlide.title}&rdquo;.
                      <Button variant="link" size="sm" className="px-1 h-auto font-medium" onClick={handleTakeQuiz} disabled={isPreparingQuiz}>
                        Start Quiz →
                      </Button>
                    </p>
                  )}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="glass rounded-xl flex items-center justify-center h-64">
              <div className="text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">Select a slide to view its content</p>
              </div>
            </div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>

    <AlertDialog open={!!slideToDelete} onOpenChange={(open) => { if (!open) setSlideToDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete &quot;{slideToDelete?.title}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this slide. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingSlide}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDeleteSlide(); }}
            disabled={isDeletingSlide}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeletingSlide ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={showDeleteCourseConfirm} onOpenChange={setShowDeleteCourseConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete &quot;{activeCourse?.title}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this course and all {slides.length} of its slides.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeletingCourse}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDeleteCourse(); }}
            disabled={isDeletingCourse}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeletingCourse ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

/** Simple markdown bold formatter */
function formatBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}