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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/stores/appStore';
import { useCountUp } from '@/hooks/useCountUp';
import type { Slide } from '@/types';

const MOCK_SLIDES: Slide[] = [
  {
    id: 'slide-1',
    courseId: 'demo',
    title: 'Introduction to Cell Biology',
    content:
      'Cells are the fundamental units of life. All living organisms are composed of one or more cells. The cell theory, developed in the 1830s, states that:\n\n1. All living things are made of cells\n2. Cells are the basic units of structure and function\n3. All cells come from pre-existing cells\n\nThere are two main types of cells: prokaryotic (bacteria, archaea) and eukaryotic (plants, animals, fungi, protists).',
    order: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slide-2',
    courseId: 'demo',
    title: 'Cell Organelles Overview',
    content:
      'Eukaryotic cells contain membrane-bound organelles, each with specialized functions:\n\n• **Nucleus**: Contains DNA, controls cell activities\n• **Mitochondria**: Produces ATP through cellular respiration\n• **Ribosomes**: Synthesize proteins\n• **Endoplasmic Reticulum**: Synthesizes lipids and proteins (Rough ER has ribosomes, Smooth ER does not)\n• **Golgi Apparatus**: Modifies, sorts, and packages proteins\n• **Lysosomes**: Digest cellular waste and pathogens\n• **Chloroplasts** (plants only): Site of photosynthesis',
    order: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slide-3',
    courseId: 'demo',
    title: 'Cell Membrane Structure',
    content:
      'The cell membrane (plasma membrane) is a phospholipid bilayer with embedded proteins. According to the Fluid Mosaic Model:\n\n• **Phospholipids** form a double layer with hydrophilic heads facing outward and hydrophobic tails facing inward\n• **Proteins** are embedded in the membrane (integral) or attached to surfaces (peripheral)\n• **Cholesterol** molecules help maintain membrane fluidity\n• **Carbohydrates** attached to proteins form glycoproteins for cell recognition\n\nThe membrane is selectively permeable, allowing certain molecules to pass while blocking others.',
    order: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'slide-4',
    courseId: 'demo',
    title: 'Cell Division: Mitosis',
    content:
      'Mitosis is the process of cell division that produces two genetically identical daughter cells. The phases are:\n\n**PMAT**\n1. **Prophase**: Chromatin condenses into chromosomes, nuclear envelope breaks down\n2. **Metaphase**: Chromosomes align at the cell equator (metaphase plate)\n3. **Anaphase**: Sister chromatids separate and move to opposite poles\n4. **Telophase**: Nuclear envelopes reform, chromosomes decondense\n\nFollowed by **Cytokinesis**: Cytoplasm divides, completing cell division.',
    order: 4,
    createdAt: new Date().toISOString(),
  },
];

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
  } = useAppStore();

  const slides = activeSlides.length > 0 ? activeSlides : (activeCourse?.slides ?? MOCK_SLIDES);
  const currentSlide = slides[currentSlideIndex] ?? slides[0];
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [readProgress, setReadProgress] = useState(0);
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

  const handleTakeQuiz = () => {
    navigate('quiz');
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
                  <Button size="sm" variant="outline" onClick={handleTakeQuiz}>
                    <ClipboardCheck className="h-4 w-4 mr-2" />
                    Start Quiz
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
              </div>
            </div>
            {/* Mobile action buttons */}
            <div className="flex sm:hidden gap-2 mt-3 flex-wrap">
              <Button size="sm" className="flex-1" onClick={handleStartTutor}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Start Tutor
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={handleTakeQuiz}>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Start Quiz
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
            </div>
          </div>
        </div>
      </motion.div>

      {/* Course Progress Section */}
      <motion.div variants={fadeUp}>
        <div className="glass rounded-xl p-5 space-y-4">
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
                    <motion.button
                      key={slide.id}
                      variants={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSlideSelect(i)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm whitespace-nowrap lg:whitespace-normal transition-all min-w-[160px] lg:min-w-0 ${
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
                      <span className="truncate">{slide.title}</span>
                    </motion.button>
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
              className="glass rounded-xl p-6 space-y-4 glow-emerald"
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
                    onClick={() => setActiveSlideId(activeSlideId === currentSlide.id ? null : currentSlide.id)}
                    className={activeSlideId === currentSlide.id ? 'glow-emerald border-primary/30' : ''}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
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

              {/* Generated questions placeholder */}
              {activeSlideId === currentSlide.id && (
                <motion.div
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="rounded-lg border border-primary/20 bg-primary/5 p-4 overflow-hidden"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <motion.span
                      animate={{ rotate: [0, 15, -15, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Sparkles className="h-4 w-4 text-primary" />
                    </motion.span>
                    <span className="text-sm font-semibold text-primary">Questions Generated</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    5 questions generated for &ldquo;{currentSlide.title}&rdquo;.
                    <Button variant="link" size="sm" className="px-1 h-auto font-medium" onClick={handleTakeQuiz}>
                      Start Quiz →
                    </Button>
                  </p>
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
  );
}

/** Simple markdown bold formatter */
function formatBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}