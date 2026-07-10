'use client';

import { aiFetch } from '@/lib/aiKey';
import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  ArrowLeft,
  Trophy,
  Sparkles,
  AlertTriangle,
  BookOpen,
  GripVertical,
  Flame,
  Zap,
  Shuffle,
  Layers,
  HelpCircle,
  Lightbulb,
  Clock,
  Copy,
  Calendar,
  Bookmark,
  BookmarkCheck,
  Brain,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAppStore } from '@/stores/appStore';
import { useSpacedRepetition } from '@/hooks/useSpacedRepetition';
import { toast } from 'sonner';
import type { Question, AdaptiveResult, LearnerProfile } from '@/types';

import {
  type StudyMode,
  isFuzzyMatch,
  type FillBlankGrade,
  gradeFillBlank,
  formatTimer,
  type DailyChallengeData,
  DAILY_STORAGE_KEY,
  DAILY_QUESTION_COUNT,
  getTodayStr,
  loadDailyChallenge,
  saveDailyChallenge,
  loadDailyStreak,
  updateDailyStreak,
  getTimeUntilMidnight,
  selectDailyQuestions,
  COURSE_QUIZ_GROUPS,
  loadAdaptiveResults,
  saveAdaptiveResults,
  scoreQuestionForAdaptive,
  getAdaptiveReasoning,
} from './quiz/helpers';
import {
  ConfettiParticle,
  CONFETTI_COLORS,
  DAILY_CONFETTI_COLORS,
  DAILY_TIMER_SECONDS,
  getScoreMultiplier,
  getStars,
  Star,
  useAnimatedCounter,
  TYPE_BADGE_GRADIENT,
  ErrorCorrectionInput,
  MatchingInput,
  type ErrorAnalysisResponse,
  ERROR_REPORT_STORAGE_KEY,
  WeaknessReportDialog,
} from './quiz/components';
import { InteractiveFlashcard } from './quiz/InteractiveFlashcard';
import { ExamMode } from './quiz/ExamMode';
import { useBackgroundGeneration } from '@/hooks/useBackgroundGeneration';
import { GraduationCap, Cpu } from 'lucide-react';

// ---------- Main QuizView ----------
export function QuizView() {
  const { navigate, currentQuestions, activeCourse, updateMastery, adaptiveResults, addAdaptiveResult, masteryMap, courses, setCurrentQuestions, setActiveCourse } = useAppStore();

  const allQuestions = currentQuestions;

  const [studyMode, setStudyMode] = useState<StudyMode>('quiz');
  // Exam mode overlay + background generation (per-course context)
  const [examOpen, setExamOpen] = useState(false);
  // Course picker in the empty state: reuse existing questions for a course,
  // or generate them from its slides — never force a re-upload
  const [preparingCourseId, setPreparingCourseId] = useState<string | null>(null);
  const handlePracticeCourse = useCallback(async (course: (typeof courses)[number]) => {
    setPreparingCourseId(course.id);
    try {
      const existingRes = await fetch(`/api/questions?courseId=${course.id}`);
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        if (existingData.questions?.length > 0) {
          setActiveCourse(course);
          setCurrentQuestions(existingData.questions);
          return;
        }
      }
      const genRes = await aiFetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({ error: 'Failed to generate questions.' }));
        throw new Error(err.error || 'Failed to generate questions.');
      }
      const genData = await genRes.json();
      setActiveCourse(course);
      setCurrentQuestions(genData.questions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prepare quiz. Please try again.');
    } finally {
      setPreparingCourseId(null);
    }
  }, [courses, setActiveCourse, setCurrentQuestions]);
  const [adaptiveOn, setAdaptiveOn] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const bgCourseId = selectedCourse !== 'all' ? selectedCourse : activeCourse?.id ?? null;
  const bgGen = useBackgroundGeneration(bgCourseId);
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('synapse-bookmarked-questions');
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [showQuestionMap, setShowQuestionMap] = useState(false);
  const [showBonusPopup, setShowBonusPopup] = useState(false);
  const [hintsUsed, setHintsUsed] = useState<Record<string, boolean>>({});
  const [fillBlankValues, setFillBlankValues] = useState<Record<string, string>>({});
  const [fillBlankGrades, setFillBlankGrades] = useState<Record<string, FillBlankGrade>>({});
  const [weaknessReportOpen, setWeaknessReportOpen] = useState(false);
  const [weaknessReportLoading, setWeaknessReportLoading] = useState(false);
  const [weaknessReport, setWeaknessReport] = useState<ErrorAnalysisResponse | null>(null);
  const [lastReportExists] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !!localStorage.getItem(ERROR_REPORT_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  // Spaced Repetition
  const { dueItems, reviewItem, overdueCount } = useSpacedRepetition();
  const [reviewShowResults, setReviewShowResults] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Adaptive difficulty: compute adaptive questions and reasoning
  const dueConcepts = useMemo(() => new Set(dueItems.map((item) => item.questionId)), [dueItems]);

  const { adaptiveQuestions, adaptiveReasoning } = useMemo(() => {
    if (!adaptiveOn || studyMode !== 'quiz') {
      return { adaptiveQuestions: null as Question[] | null, adaptiveReasoning: '' };
    }

    // Load additional adaptive results from localStorage for richer history
    const localStorageResults = loadAdaptiveResults();
    const allAdaptiveResults = [...localStorageResults, ...adaptiveResults];

    const pool = selectedCourse === 'all' ? allQuestions : allQuestions.filter((q) => q.courseId === selectedCourse);

    const scored = pool
      .filter((q) => q.concept)
      .map((q) => scoreQuestionForAdaptive({
        question: q,
        masteryMap,
        adaptiveResults: allAdaptiveResults,
        dueConcepts,
      }))
      .sort((a, b) => b.score - a.score);

    const top10 = scored.slice(0, 10).map((s) => s.question);
    const reasoning = getAdaptiveReasoning(scored);

    return { adaptiveQuestions: top10, adaptiveReasoning: reasoning };
  }, [adaptiveOn, studyMode, selectedCourse, allQuestions, masteryMap, adaptiveResults, dueConcepts]);

  // Review questions: match dueItems to actual questions by concept
  const reviewQuestions = useMemo<Question[]>(() => {
    const dueConcepts = new Set(dueItems.map((item) => item.questionId));
    return allQuestions.filter((q) => q.concept && dueConcepts.has(q.concept));
  }, [dueItems, allQuestions]);

  const reviewCurrentQ = reviewQuestions[currentIndex];
  const reviewProgress = reviewQuestions.length > 0
    ? (reviewedCount / reviewQuestions.length) * 100
    : 0;

  // Listen for start-spaced-review custom event
  useEffect(() => {
    const handler = () => setStudyMode('review');
    window.addEventListener('start-spaced-review', handler);
    return () => window.removeEventListener('start-spaced-review', handler);
  }, []);

  // Daily Challenge state
  const { dailyChallenge: storeDailyChallenge, setDailyChallenge: setStoreDailyChallenge } = useAppStore();
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeData | null>(null);
  const [dailyStreak, setDailyStreak] = useState({ current: 0, best: 0, lastDate: '' });
  const [dailyTimeLeft, setDailyTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [dailyShowResults, setDailyShowResults] = useState(false);
  const [dailyShareCopied, setDailyShareCopied] = useState(false);
  const [dailyTimerLeft, setDailyTimerLeft] = useState(DAILY_TIMER_SECONDS);
  const [dailyTimerActive, setDailyTimerActive] = useState(false);

  const handleViewLastReport = useCallback(() => {
    try {
      const stored = localStorage.getItem(ERROR_REPORT_STORAGE_KEY);
      if (stored) {
        const data: ErrorAnalysisResponse = JSON.parse(stored);
        setWeaknessReport(data);
        setWeaknessReportOpen(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleStartReviewFromReport = useCallback((topic: string) => {
    const { setActiveTopic, navigate: nav } = useAppStore.getState();
    setActiveTopic(topic);
    nav('tutor');
  }, []);

  const isCorrect = useCallback(
    (q: Question, userAnswer: string): boolean => {
      const ua = userAnswer.trim().toLowerCase();
      const ca = q.answer.trim().toLowerCase();
      if (q.type === 'short_answer' || q.type === 'error_correction') {
        return isFuzzyMatch(userAnswer, q.answer, 3);
      }
      if (q.type === 'fill_blank') {
        return userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
      }
      return ua === ca;
    },
    [],
  );

  const dailyQuestions = useMemo<Question[]>(() => {
    if (dailyChallenge?.questions) {
      return dailyChallenge.questions
        .map((id) => allQuestions.find((q) => q.id === id))
        .filter((q): q is Question => !!q);
    }
    return [];
  }, [dailyChallenge, allQuestions]);
  const dailyCurrentQ = dailyQuestions[currentIndex];
  const dailyProgress = dailyQuestions.length > 0
    ? ((currentIndex + 1) / dailyQuestions.length) * 100
    : 0;
  const dailyScore = useMemo(() => {
    return dailyQuestions.filter((q) => answered[q.id] && isCorrect(q, answers[q.id] || '')).length;
  }, [dailyQuestions, answered, answers, isCorrect]);
  const dailyCircumference = 2 * Math.PI * 62;
  const dailyScorePercent = dailyQuestions.length > 0 ? dailyScore / dailyQuestions.length : 0;
  const dailyStrokeDashoffset = dailyCircumference * (1 - dailyScorePercent);
  const dailyAnimatedScore = useAnimatedCounter(dailyShowResults ? dailyScore : 0, 1500);
  const dailyMultiplier = getScoreMultiplier(dailyStreak.current);
  const dailyStars = getStars(dailyScore, dailyQuestions.length);
  const dailyTimerCircumference = 2 * Math.PI * 28;
  const dailyTimerPercent = dailyTimerLeft / DAILY_TIMER_SECONDS;
  const dailyTimerStroke = dailyTimerCircumference * (1 - dailyTimerPercent);

  // Validate streak from store on mount
  useEffect(() => {
    const dc = storeDailyChallenge;
    if (!dc.lastCompletedDate) return;
    const today = getTodayStr();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (dc.lastCompletedDate !== today && dc.lastCompletedDate !== yesterdayStr) {
      setStoreDailyChallenge({ streak: 0 });
    }
  }, []);

  // Load daily challenge data on mount and when mode changes. Genuinely
  // reads/writes localStorage and depends on wall-clock "today" — not
  // something derivable from props/state during render.
  useEffect(() => {
    if (studyMode !== 'daily') return;
    const today = getTodayStr();
    const saved = loadDailyChallenge();
    const streakData = loadDailyStreak();
    // Use store streak as source of truth if available
    const effectiveStreak = storeDailyChallenge.streak > 0 ? { current: storeDailyChallenge.streak, best: Math.max(storeDailyChallenge.streak, streakData.best), lastDate: storeDailyChallenge.lastCompletedDate || streakData.lastDate } : streakData;

    /* eslint-disable react-hooks/set-state-in-effect -- genuine external
       sync (localStorage) + wall-clock date check, not render-derivable */
    if (saved && saved.date === today) {
      setDailyChallenge(saved);
      setDailyStreak(effectiveStreak);
      if (saved.completed) {
        setDailyShowResults(true);
        setDailyTimerActive(false);
      }
    } else {
      // New day, new challenge
      const selected = selectDailyQuestions(allQuestions);
      const newChallenge: DailyChallengeData = {
        date: today,
        completed: false,
        score: 0,
        total: DAILY_QUESTION_COUNT,
        questions: selected.map((q) => q.id),
      };
      saveDailyChallenge(newChallenge);
      setDailyChallenge(newChallenge);
      setDailyStreak(effectiveStreak);
      setDailyShowResults(false);
      setDailyTimerLeft(DAILY_TIMER_SECONDS);
      setDailyTimerActive(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [studyMode, allQuestions, storeDailyChallenge.streak, storeDailyChallenge.lastCompletedDate]);

  // Update daily countdown timer — real wall-clock sync (time until
  // midnight), recomputed on mode change and every second thereafter.
  useEffect(() => {
    if (studyMode !== 'daily') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDailyTimeLeft(getTimeUntilMidnight());
    const interval = setInterval(() => {
      setDailyTimeLeft(getTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(interval);
  }, [studyMode]);

  // Daily challenge 3-minute countdown timer
  useEffect(() => {
    if (studyMode !== 'daily' || !dailyTimerActive || dailyShowResults) return;
    if (dailyTimerLeft <= 0) {
      /* eslint-disable react-hooks/set-state-in-effect -- auto-completing
         the challenge on timeout genuinely persists to localStorage/store,
         it isn't just mirroring props into state */
      // Time's up — auto-complete challenge
      const finalScore = dailyQuestions.filter((q) => answered[q.id] && isCorrect(q, answers[q.id] || '')).length;
      const updatedStreak = updateDailyStreak();
      setDailyStreak(updatedStreak);
      const completedData: DailyChallengeData = {
        date: getTodayStr(),
        completed: true,
        score: finalScore,
        total: dailyQuestions.length,
        questions: dailyQuestions.map((q) => q.id),
      };
      saveDailyChallenge(completedData);
      setDailyChallenge(completedData);
      setDailyShowResults(true);
      setDailyTimerActive(false);
      const stars = getStars(finalScore, dailyQuestions.length);
      setStoreDailyChallenge({
        lastCompletedDate: getTodayStr(),
        streak: updatedStreak.current,
        bestScore: Math.max(storeDailyChallenge.bestScore, finalScore),
        totalCompleted: storeDailyChallenge.totalCompleted + 1,
        todayResults: { score: finalScore, total: dailyQuestions.length, timeTaken: DAILY_TIMER_SECONDS, stars },
      });
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    const timeout = setTimeout(() => setDailyTimerLeft((s) => s - 1), 1000);
    return () => clearTimeout(timeout);
  }, [studyMode, dailyTimerActive, dailyShowResults, dailyTimerLeft, dailyQuestions, answered, answers, isCorrect, storeDailyChallenge.bestScore, storeDailyChallenge.totalCompleted, setStoreDailyChallenge]);

  const [timerStarted, setTimerStarted] = useState(false);

  const handleDailyAnswer = useCallback(
    (answer: string) => {
      if (!dailyCurrentQ || answered[dailyCurrentQ.id]) return;

      if (!timerStarted) setTimerStarted(true);
      if (!dailyTimerActive) setDailyTimerActive(true);

      const newAnswers = { ...answers, [dailyCurrentQ.id]: answer };
      const newAnswered = { ...answered, [dailyCurrentQ.id]: true };
      setAnswers(newAnswers);
      setAnswered(newAnswered);
      setShowExplanation(true);

      if (isCorrect(dailyCurrentQ, answer)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);
        if (newStreak >= 3) {
          setShowStreakPopup(true);
          setTimeout(() => setShowStreakPopup(false), 1200);
        }
      } else {
        setStreak(0);
      }
    },
    [answered, answers, dailyCurrentQ, isCorrect, streak, bestStreak, timerStarted, dailyTimerActive],
  );

  const handleDailyNext = useCallback(() => {
    setShowExplanation(false);
    if (currentIndex < dailyQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Challenge complete — save results
      const finalScore = dailyQuestions.filter((q) => answered[q.id] && isCorrect(q, answers[q.id] || '')).length;
      const updatedStreak = updateDailyStreak();
      setDailyStreak(updatedStreak);
      const stars = getStars(finalScore, dailyQuestions.length);

      const completedData: DailyChallengeData = {
        date: getTodayStr(),
        completed: true,
        score: finalScore,
        total: dailyQuestions.length,
        questions: dailyQuestions.map((q) => q.id),
      };
      saveDailyChallenge(completedData);
      setDailyChallenge(completedData);
      setDailyShowResults(true);
      setDailyTimerActive(false);

      // Update Zustand store
      const timeTaken = DAILY_TIMER_SECONDS - dailyTimerLeft;
      setStoreDailyChallenge({
        lastCompletedDate: getTodayStr(),
        streak: updatedStreak.current,
        bestScore: Math.max(storeDailyChallenge.bestScore, finalScore),
        totalCompleted: storeDailyChallenge.totalCompleted + 1,
        todayResults: { score: finalScore, total: dailyQuestions.length, timeTaken, stars },
      });
    }
  }, [currentIndex, dailyQuestions, answered, answers, isCorrect, dailyTimerLeft, storeDailyChallenge.bestScore, storeDailyChallenge.totalCompleted, setStoreDailyChallenge]);

  const handleDailyShare = useCallback(async () => {
    const text = `SynapseLearn Daily Challenge - ${dailyScore}/${dailyQuestions.length} - ${dailyStreak.current} day streak`;
    try {
      await navigator.clipboard.writeText(text);
      setDailyShareCopied(true);
      setTimeout(() => setDailyShareCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [dailyScore, dailyQuestions.length, dailyStreak.current]);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Flashcard state (interaction state lives inside InteractiveFlashcard)
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [stillLearningCards, setStillLearningCards] = useState<Set<string>>(new Set());
  const [difficultCards, setDifficultCards] = useState<Set<string>>(new Set());
  const [flashcardReviewed, setFlashcardReviewed] = useState<Set<string>>(new Set());
  const [showFlashcardSummary, setShowFlashcardSummary] = useState(false);

  // Bookmark persistence — save side only; loaded lazily at declaration above.
  useEffect(() => {
    try {
      localStorage.setItem('synapse-bookmarked-questions', JSON.stringify([...bookmarkedQuestions]));
    } catch { /* ignore */ }
  }, [bookmarkedQuestions]);

  const toggleBookmark = useCallback((questionId: string) => {
    setBookmarkedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  // Timer effect
  useEffect(() => {
    if (!timerStarted || showResults) return;
    const interval = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStarted, showResults]);

  const flashcardQuestions = useMemo(() => {
    if (selectedCourse === 'all') return allQuestions;
    return allQuestions.filter((q) => q.courseId === selectedCourse);
  }, [allQuestions, selectedCourse]);

  const flashcardProgress = flashcardQuestions.length > 0
    ? (flashcardReviewed.size / flashcardQuestions.length) * 100
    : 0;

  const handleFlashcardPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleFlashcardNext = useCallback(() => {
    if (currentIndex < flashcardQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, flashcardQuestions.length]);

  // Keyboard shortcuts for flashcard mode
  useEffect(() => {
    if (studyMode !== 'flashcard' || showFlashcardSummary) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          handleFlashcardPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleFlashcardNext();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [studyMode, showFlashcardSummary, handleFlashcardPrev, handleFlashcardNext]);

  // Filter questions by selected course and bookmarked
  const questions = useMemo(() => {
    if (adaptiveOn && studyMode === 'quiz' && adaptiveQuestions) {
      return adaptiveQuestions;
    }
    let filtered = selectedCourse === 'all' ? allQuestions : allQuestions.filter((q) => q.courseId === selectedCourse);
    if (showBookmarked) {
      filtered = filtered.filter((q) => bookmarkedQuestions.has(q.id));
    }
    return filtered;
  }, [allQuestions, selectedCourse, showBookmarked, bookmarkedQuestions, adaptiveOn, studyMode, adaptiveQuestions]);

  // Difficulty distribution
  const difficultyCounts = useMemo(() => {
    if (studyMode === 'daily') return { easy: 0, medium: 0, hard: 0 };
    const targetQuestions = studyMode === 'quiz' ? questions : flashcardQuestions;
    return {
      easy: targetQuestions.filter((q) => q.difficulty === 'easy').length,
      medium: targetQuestions.filter((q) => q.difficulty === 'medium').length,
      hard: targetQuestions.filter((q) => q.difficulty === 'hard').length,
    };
  }, [studyMode, questions, flashcardQuestions]);

  const handleShuffle = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const handleFlashcardMark = useCallback((type: 'known' | 'learning') => {
    if (!flashcardQuestions[currentIndex]) return;
    const id = flashcardQuestions[currentIndex].id;
    const newReviewed = new Set(flashcardReviewed);
    newReviewed.add(id);
    setFlashcardReviewed(newReviewed);

    if (type === 'known') {
      setKnownCards((prev) => new Set(prev).add(id));
      setStillLearningCards((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setStillLearningCards((prev) => new Set(prev).add(id));
      setKnownCards((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }

    // Mark as difficult adds to review queue
    if (type === 'learning' && !difficultCards.has(id)) {
      setDifficultCards((prev) => new Set(prev).add(id));
    }

    if (currentIndex < flashcardQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowFlashcardSummary(true);
    }
  }, [currentIndex, flashcardQuestions, flashcardReviewed]);

  const handleFlashcardReset = useCallback(() => {
    setCurrentIndex(0);
    setKnownCards(new Set());
    setStillLearningCards(new Set());
    setDifficultCards(new Set());
    setFlashcardReviewed(new Set());
    setShowFlashcardSummary(false);
  }, []);

  const handleMarkDifficult = useCallback(() => {
    if (!flashcardQuestions[currentIndex]) return;
    const id = flashcardQuestions[currentIndex].id;
    setDifficultCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast('Removed from review queue');
      } else {
        next.add(id);
        toast('Marked as difficult — added to review queue', {
          icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
        });
      }
      return next;
    });
  }, [currentIndex, flashcardQuestions]);

  const handleCourseChange = (courseId: string) => {
    setSelectedCourse(courseId);
    setCurrentIndex(0);
    setAnswers({});
    setAnswered({});
    setShowExplanation(false);
    setShowResults(false);
    setStreak(0);
    setBestStreak(0);
    setKnownCards(new Set());
    setStillLearningCards(new Set());
    setDifficultCards(new Set());
    setFlashcardReviewed(new Set());
    setShowFlashcardSummary(false);
    setTimerStarted(false);
    setTimerSeconds(0);
    setHintsUsed({});
    setFillBlankValues({});
    setFillBlankGrades({});
  };

  const handleModeChange = (mode: StudyMode) => {
    setStudyMode(mode);
    setCurrentIndex(0);
    setAnswers({});
    setAnswered({});
    setShowExplanation(false);
    setShowResults(false);
    setStreak(0);
    setBestStreak(0);
    setKnownCards(new Set());
    setStillLearningCards(new Set());
    setDifficultCards(new Set());
    setFlashcardReviewed(new Set());
    setShowFlashcardSummary(false);
    setTimerStarted(false);
    setTimerSeconds(0);
    setDailyShowResults(false);
    setDailyShareCopied(false);
    setReviewShowResults(false);
    setReviewedCount(0);
    setDailyTimerLeft(DAILY_TIMER_SECONDS);
    setDailyTimerActive(false);
    setHintsUsed({});
    setFillBlankValues({});
    setFillBlankGrades({});
  };

  const currentQ = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  // Compute wrong answers for error analysis
  const wrongAnswers = useMemo(() => {
    return questions
      .filter((q) => answered[q.id] && !isCorrect(q, answers[q.id] || ''))
      .map((q) => ({
        question: q.question,
        userAnswer: answers[q.id] || '',
        correctAnswer: q.answer,
        concept: q.concept || 'General',
      }));
  }, [questions, answered, answers, isCorrect]);

  const handleAnalyzeMistakes = useCallback(async () => {
    if (wrongAnswers.length === 0) return;
    setWeaknessReportLoading(true);
    setWeaknessReportOpen(true);
    setWeaknessReport(null);
    try {
      const { learnerProfile } = useAppStore.getState();
      const res = await aiFetch('/api/error-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wrongAnswers,
          learnerProfile: learnerProfile || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to analyze errors');
      }
      const data: ErrorAnalysisResponse = await res.json();
      setWeaknessReport(data);
      // Persist to localStorage
      try {
        localStorage.setItem(ERROR_REPORT_STORAGE_KEY, JSON.stringify(data));
      } catch {
        // ignore storage errors
      }
    } catch {
      toast.error('Failed to analyze mistakes. Please try again.');
      setWeaknessReportOpen(false);
    } finally {
      setWeaknessReportLoading(false);
    }
  }, [wrongAnswers]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!currentQ || answered[currentQ.id]) return;

      // Start timer on first answer
      if (!timerStarted) setTimerStarted(true);

      const newAnswers = { ...answers, [currentQ.id]: answer };
      const newAnswered = { ...answered, [currentQ.id]: true };
      setAnswers(newAnswers);
      setAnswered(newAnswered);
      setShowExplanation(true);

      // Grade fill_blank with Levenshtein tolerance
      if (currentQ.type === 'fill_blank') {
        const grade = gradeFillBlank(answer, currentQ.answer, hintsUsed[currentQ.id] || false);
        setFillBlankGrades((prev) => ({ ...prev, [currentQ.id]: grade }));
      }

      if (isCorrect(currentQ, answer)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) setBestStreak(newStreak);
        if (newStreak >= 3) {
          setShowStreakPopup(true);
          setTimeout(() => setShowStreakPopup(false), 1200);
        }
        // Streak milestone toasts
        if (newStreak > 0 && newStreak % 3 === 0 && newStreak % 5 !== 0) {
          toast.success(`🔥 Hot streak! ${newStreak} in a row!`);
        }
        if (newStreak > 0 && newStreak % 5 === 0) {
          toast.success(`🔥🔥 AMAZING! ${newStreak} in a row! Bonus points earned!`, {
            description: `Score multiplier: ${getScoreMultiplier(newStreak)}x`,
            duration: 4000,
          });
          setShowBonusPopup(true);
          setTimeout(() => setShowBonusPopup(false), 2500);
        }
      } else {
        setStreak(0);
      }

      // Track adaptive result
      if (adaptiveOn && studyMode === 'quiz' && currentQ.concept) {
        const result: AdaptiveResult = {
          concept: currentQ.concept,
          correct: isCorrect(currentQ, answer),
          difficulty: currentQ.difficulty,
          timestamp: Date.now(),
        };
        addAdaptiveResult(result);
        saveAdaptiveResults([...adaptiveResults, result].slice(-200));
      }
    },
    [answered, answers, currentQ, isCorrect, streak, bestStreak, timerStarted, adaptiveOn, studyMode, adaptiveResults, addAdaptiveResult, hintsUsed],
  );

  // Review mode answer handler
  const handleReviewAnswer = useCallback(
    (answer: string) => {
      if (!reviewCurrentQ || answered[reviewCurrentQ.id]) return;

      const newAnswers = { ...answers, [reviewCurrentQ.id]: answer };
      const newAnswered = { ...answered, [reviewCurrentQ.id]: true };
      setAnswers(newAnswers);
      setAnswered(newAnswered);
      setShowExplanation(true);

      const correct = isCorrect(reviewCurrentQ, answer);
      const quality = correct ? 5 : 0;

      // Update spaced repetition
      if (reviewCurrentQ.concept) {
        reviewItem(reviewCurrentQ.concept, quality);
      }

      // Update mastery in app store
      if (reviewCurrentQ.concept) {
        const newLevel = correct ? 5 : 1;
        updateMastery(
          reviewCurrentQ.concept,
          newLevel,
          `Spaced review: ${correct ? 'correct' : 'incorrect'}`,
        );
      }

      // Show confetti on correct
      if (correct) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
      }

      // Track reviewed count
      setReviewedCount((prev) => prev + 1);
    },
    [reviewCurrentQ, answered, answers, isCorrect, reviewItem, updateMastery],
  );

  const handleNext = () => {
    setShowExplanation(false);
    if (studyMode === 'review') {
      if (currentIndex < reviewQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setReviewShowResults(true);
      }
    } else if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowResults(true);
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setAnswers({});
    setAnswered({});
    setShowExplanation(false);
    setShowResults(false);
    setShowConfetti(false);
    setStreak(0);
    setBestStreak(0);
    setTimerStarted(false);
    setTimerSeconds(0);
    setShowBookmarked(false);
    setHintsUsed({});
    setFillBlankValues({});
    setFillBlankGrades({});
  };

  const score = useMemo(() => {
    return questions.reduce((total, q) => {
      if (!answered[q.id]) return total;
      const userAnswer = answers[q.id] || '';
      if (q.type === 'fill_blank') {
        const grade = fillBlankGrades[q.id];
        if (grade) return total + grade.points;
        return total + (isCorrect(q, userAnswer) ? 1 : 0);
      }
      return total + (isCorrect(q, userAnswer) ? 1 : 0);
    }, 0);
  }, [questions, answered, answers, isCorrect, fillBlankGrades]);
  const animatedScore = useAnimatedCounter(showResults ? score : 0, 1500);

  const circumference = 2 * Math.PI * 62;
  const scorePercent = questions.length > 0 ? score / questions.length : 0;
  const strokeDashoffset = circumference * (1 - scorePercent);

  const difficultyTotal = difficultyCounts.easy + difficultyCounts.medium + difficultyCounts.hard;

  // ---------- Empty State ----------
  if (studyMode !== 'daily' && studyMode !== 'review' && questions.length === 0 && flashcardQuestions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[70vh] gap-6"
      >
        <div className="glass rounded-2xl p-8 text-center space-y-4 max-w-md w-full">
          <BookOpen className="h-16 w-16 text-primary/30 mx-auto" />
          <h2 className="text-xl font-bold">{courses.length > 0 ? 'Pick a course to practice' : 'No questions available'}</h2>
          <p className="text-muted-foreground text-sm">
            {courses.length > 0
              ? 'Generate a quiz straight from one of your courses — no need to upload the slides again.'
              : 'Upload some study materials to start practicing.'}
          </p>
          {courses.length > 0 && (
            <div className="space-y-2 text-left max-h-64 overflow-y-auto pr-1">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handlePracticeCourse(course)}
                  disabled={preparingCourseId !== null}
                  className="w-full flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <BookOpen className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 truncate font-medium">{course.title}</span>
                  {preparingCourseId === course.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <Button variant={courses.length > 0 ? 'outline' : 'default'} onClick={() => navigate('upload')}>
              <BookOpen className="h-4 w-4 mr-2" />
              Upload Slides
            </Button>
            <Button variant="outline" onClick={() => navigate('dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ---------- Results Screen ----------
  if (showResults) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="flex flex-col items-center justify-center min-h-[70vh] gap-6"
      >
        {/* Confetti burst for high scores */}
        <AnimatePresence>
          {scorePercent >= 0.8 && (
            <div className="fixed inset-0 pointer-events-none z-50">
              {Array.from({ length: 32 }).map((_, i) => (
                <ConfettiParticle
                  key={`result-${i}`}
                  delay={i * 0.04}
                  color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
        <div className="glass rounded-2xl p-8 text-center space-y-6 max-w-md w-full glow-emerald-strong">
          {/* Animated grade badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.2 }}
            className="mx-auto"
          >
            <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold shadow-lg ${
              scorePercent >= 0.9
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-amber-400/30'
                : scorePercent >= 0.7
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-emerald-400/30'
                  : scorePercent >= 0.5
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-cyan-400/30'
                    : 'bg-gradient-to-r from-orange-400 to-red-400 text-white shadow-orange-400/30'
            }`}>
              {scorePercent >= 0.9 ? <Trophy className="h-4 w-4" /> : scorePercent >= 0.7 ? <Zap className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
              {scorePercent >= 0.9 ? 'Outstanding' : scorePercent >= 0.7 ? 'Well Done' : scorePercent >= 0.5 ? 'Good Try' : 'Keep Going'}
            </div>
          </motion.div>
          <div className="relative inline-flex">
            <svg width="160" height="160" className="-rotate-90">
              <circle
                cx="80"
                cy="80"
                r="62"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-muted/20"
              />
              <motion.circle
                cx="80"
                cy="80"
                r="62"
                fill="none"
                stroke="url(#scoreGrad)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className="text-4xl font-bold gradient-text"
                key={animatedScore}
              >
                {score % 1 === 0 ? animatedScore : score.toFixed(1)}<span className="text-lg font-normal text-muted-foreground">/{questions.length}</span>
              </motion.span>
              <span className="text-xs text-muted-foreground mt-1 text-gradient-emerald font-medium">
                {Math.round(scorePercent * 100)}% correct
              </span>
            </div>
          </div>
          {/* Best streak */}
          {bestStreak >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex items-center justify-center gap-1.5 text-sm"
            >
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-muted-foreground">Best streak: <span className="font-bold text-foreground">{bestStreak} in a row</span></span>
            </motion.div>
          )}

          <div>
            <h2 className="text-2xl font-bold">
              {scorePercent >= 0.8
                ? 'Excellent!'
                : scorePercent >= 0.6
                  ? 'Good effort!'
                  : 'Keep practicing!'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              You answered {score} out of {questions.length} questions correctly
            </p>
          </div>

          {/* Per-question breakdown */}
          <div className="space-y-2 text-left">
            <h3 className="text-sm font-semibold">Question Breakdown</h3>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {questions.map((q, i) => {
                let wasCorrect = answered[q.id] && isCorrect(q, answers[q.id] || '');
                let wasClose = false;
                if (q.type === 'fill_blank' && answered[q.id] && fillBlankGrades[q.id]) {
                  const grade = fillBlankGrades[q.id];
                  wasCorrect = grade.status === 'correct';
                  wasClose = grade.status === 'close';
                }
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${wasCorrect ? 'bg-emerald-500/5' : wasClose ? 'bg-amber-500/5' : 'bg-destructive/5'}`}
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, delay: i * 0.05 }}
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${wasCorrect ? 'bg-emerald-500 text-white' : wasClose ? 'bg-amber-500 text-white' : 'bg-destructive/20 text-destructive'}`}
                    >
                      {wasCorrect ? <CheckCircle2 className="h-3 w-3" /> : wasClose ? <span className="text-[10px] font-bold">~</span> : <XCircle className="h-3 w-3" />}
                    </motion.span>
                    <span className="flex-1 truncate">{q.question.slice(0, 60)}{q.question.length > 60 ? '...' : ''}</span>
                    <span className={`text-[9px] px-1.5 py-0 rounded-full font-medium border ${TYPE_BADGE_GRADIENT[q.type] || 'bg-muted text-muted-foreground border-border'}`}>
                      {q.type.replace('_', ' ')}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            {wrongAnswers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Button
                  onClick={handleAnalyzeMistakes}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Analyze My Mistakes
                </Button>
              </motion.div>
            )}
            {wrongAnswers.length === 0 && lastReportExists && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Button
                  onClick={handleViewLastReport}
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  View Last Report
                </Button>
              </motion.div>
            )}
            {wrongAnswers.length > 0 && lastReportExists && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Button
                  onClick={handleViewLastReport}
                  variant="outline"
                  size="sm"
                >
                  View Last Report
                </Button>
              </motion.div>
            )}
            <Button onClick={handleRetry} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            {bookmarkedQuestions.size > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  onClick={() => { setShowResults(false); setShowBookmarked(true); setCurrentIndex(0); setAnswers({}); setAnswered({}); setStreak(0); setBestStreak(0); setTimerStarted(false); setTimerSeconds(0); }}
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  <BookmarkCheck className="h-4 w-4 mr-2" />
                  Review Bookmarked ({bookmarkedQuestions.size})
                </Button>
              </motion.div>
            )}
            <Button onClick={() => navigate('dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        <WeaknessReportDialog
          open={weaknessReportOpen}
          onOpenChange={setWeaknessReportOpen}
          report={weaknessReport}
          loading={weaknessReportLoading}
          onStartReview={handleStartReviewFromReport}
        />
      </motion.div>
    );
  }

  // ---------- Flashcard Summary ----------
  if (studyMode === 'flashcard' && showFlashcardSummary) {
    const knownCount = knownCards.size;
    const learningCount = stillLearningCards.size;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="flex flex-col items-center justify-center min-h-[70vh] gap-6"
      >
        <div className="glass rounded-2xl p-8 text-center space-y-6 max-w-md w-full">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.2 }}
            className="mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold shadow-lg bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-emerald-400/30">
              <Layers className="h-4 w-4" />
              Study Complete
            </div>
          </motion.div>

          <div>
            <h2 className="text-2xl font-bold">
              {knownCount === flashcardQuestions.length
                ? 'Perfect recall!'
                : knownCount >= flashcardQuestions.length * 0.7
                  ? 'Great progress!'
                  : 'Keep practicing!'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              You knew <span className="font-bold text-emerald-600 dark:text-emerald-400">{knownCount}</span> out of <span className="font-bold">{flashcardQuestions.length}</span> cards
            </p>
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{knownCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Known</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{learningCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Still Learning</div>
            </div>
          </div>

          {learningCount > 0 && (
            <div className="text-left space-y-2">
              <h3 className="text-sm font-semibold">Cards to review</h3>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {flashcardQuestions
                  .filter((q) => stillLearningCards.has(q.id))
                  .map((q) => (
                    <div key={q.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-amber-500/5 border border-amber-500/10">
                      <Lightbulb className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="flex-1 truncate">{q.question.slice(0, 60)}{q.question.length > 60 ? '...' : ''}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Button onClick={handleFlashcardReset} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Study Again
            </Button>
            <Button onClick={() => navigate('dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ---------- Question Screen ----------
  return (
    <div className="">
      <div className="relative">
        {/* Progress bar at the very top of quiz view */}
        {studyMode === 'quiz' && questions.length > 0 && (
          <div
            className="quiz-top-progress"
            style={{ '--quiz-progress': `${(Object.keys(answered).length / questions.length) * 100}%` } as React.CSSProperties}
          />
        )}
        {/* Streak popup */}
        <AnimatePresence>
          {showStreakPopup && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="fixed top-1/4 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            >
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30">
                <motion.span
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.4, repeat: 2 }}
                >
                  <Flame className="h-5 w-5" />
                </motion.span>
                {streak} in a row!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bonus streak popup (every 5) */}
        <AnimatePresence>
          {showBonusPopup && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.5, rotate: -5 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, y: -30, scale: 0.6, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            >
              <div className="relative flex flex-col items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 text-white shadow-2xl shadow-orange-500/40">
                <motion.div
                  animate={{ scale: [1, 1.4, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.8, repeat: 2 }}
                  className="text-3xl"
                >
                  🔥
                </motion.div>
                <div className="text-center">
                  <div className="text-lg font-black leading-tight">{streak} STREAK!</div>
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm font-bold mt-0.5"
                  >
                    +{getScoreMultiplier(streak)}x Bonus!
                  </motion.div>
                </div>
                {/* Sparkle particles */}
                <motion.div
                  className="absolute -top-2 -right-2 h-3 w-3 rounded-full bg-yellow-300"
                  animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.8, repeat: 2, delay: 0.1 }}
                />
                <motion.div
                  className="absolute -bottom-1 -left-3 h-2 w-2 rounded-full bg-white"
                  animate={{ scale: [0, 2, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.7, repeat: 2, delay: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confetti */}
        <AnimatePresence>
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-50">
              {Array.from({ length: 16 }).map((_, i) => (
                <ConfettiParticle
                  key={i}
                  delay={i * 0.03}
                  color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Exam mode: fullscreen locked overlay */}
        {examOpen && (
          <ExamMode
            courseId={bgCourseId}
            courseTitle={
              selectedCourse !== 'all'
                ? courses.find((c) => c.id === selectedCourse)?.title ?? activeCourse?.title ?? 'Exam'
                : activeCourse?.title ?? 'All questions'
            }
            initialPool={questions}
            onExit={() => setExamOpen(false)}
          />
        )}

        {/* Animated header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl p-5 mesh-gradient gradient-border relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-y-3 mb-3">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <h1 className="text-xl font-bold gradient-text">{studyMode === 'quiz' ? 'Quiz Practice' : studyMode === 'flashcard' ? 'Flashcard Study' : studyMode === 'review' ? 'Spaced Review' : 'Daily Challenge'}</h1>
                {/* Adaptive toggle */}
                <button
                  onClick={() => {
                    setAdaptiveOn((prev) => !prev);
                    setCurrentIndex(0);
                    setAnswers({});
                    setAnswered({});
                    setShowExplanation(false);
                    setShowResults(false);
                    setStreak(0);
                    setBestStreak(0);
                    setTimerStarted(false);
                    setTimerSeconds(0);
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all border ${
                    adaptiveOn
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  }`}
                  title={adaptiveOn ? 'Disable adaptive difficulty' : 'Enable adaptive difficulty'}
                >
                  <Brain className="w-3.5 h-3.5" />
                  Adaptive
                </button>
                {/* Background generation toggle — builds the question cache section by section */}
                {bgCourseId && (
                  <button
                    onClick={() => bgGen.setEnabled(!bgGen.enabled)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all border ${
                      bgGen.enabled
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-700 dark:text-cyan-400'
                        : 'text-muted-foreground hover:text-foreground border-transparent'
                    }`}
                    title={
                      bgGen.enabled
                        ? bgGen.paused
                          ? 'Background generation paused while the tutor is teaching'
                          : 'Generating questions in the background — click to stop'
                        : 'Generate questions in the background so quizzes start instantly'
                    }
                  >
                    {bgGen.running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
                    Auto-gen
                    {bgGen.enabled && bgGen.sectionsTotal != null && (
                      <span className="tabular-nums">{bgGen.sectionsDone}/{bgGen.sectionsTotal}</span>
                    )}
                  </button>
                )}
                {/* Exam mode */}
                <button
                  onClick={() => setExamOpen(true)}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all border border-transparent text-muted-foreground hover:text-foreground"
                  title="Timed exam: set a duration and question count"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Exam
                </button>
                {/* Mode toggle — full-width evenly spaced on phones, inline on larger screens */}
                <div className="flex w-full sm:w-auto items-center rounded-lg border border-border bg-background/50 p-0.5">
                  <button
                    onClick={() => handleModeChange('quiz')}
                    className={`flex flex-1 sm:flex-initial items-center justify-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      studyMode === 'quiz'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Quiz
                  </button>
                  <button
                    onClick={() => handleModeChange('flashcard')}
                    className={`flex flex-1 sm:flex-initial items-center justify-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      studyMode === 'flashcard'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Flashcard
                  </button>
                  <button
                    onClick={() => handleModeChange('daily')}
                    className={`flex flex-1 sm:flex-initial items-center justify-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      studyMode === 'daily'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Daily
                  </button>
                  <button
                    onClick={() => handleModeChange('review')}
                    className={`relative flex flex-1 sm:flex-initial items-center justify-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      studyMode === 'review'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Brain className="w-3.5 h-3.5" />
                    Review
                    {overdueCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white px-1">
                        {overdueCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Adaptive badge */}
                {adaptiveOn && studyMode === 'quiz' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1"
                  >
                    <Brain className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Adaptive</span>
                  </motion.div>
                )}
                {/* Timer display (quiz mode only) */}
                {studyMode === 'quiz' && timerStarted && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="quiz-timer-ring"
                    aria-live="polite"
                  >
                    <svg width="36" height="36" viewBox="0 0 36 36">
                      <circle
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className={`text-muted/20`}
                      />
                      <motion.circle
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke={timerSeconds < 30 && !showResults ? '#ef4444' : '#10b981'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 15}
                        initial={false}
                        animate={{
                          strokeDashoffset: showResults
                            ? 2 * Math.PI * 15
                            : 2 * Math.PI * 15 * (1 - (timerSeconds % 60) / 60),
                        }}
                        transition={{ duration: 1, ease: 'linear' }}
                        style={{ opacity: timerStarted && !showResults ? 0.7 : 0.3 }}
                      />
                    </svg>
                    <span className={`absolute text-[10px] font-mono font-medium ${
                      timerSeconds < 30 && !showResults ? 'text-red-500' : 'text-muted-foreground'
                    }`}>{formatTimer(timerSeconds)}</span>
                  </motion.div>
                )}
                {studyMode === 'quiz' && streak >= 2 && (
                  <motion.div
                    key={streak}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20"
                  >
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{streak} streak</span>
                  </motion.div>
                )}
                {/* Question Map button (quiz mode) */}
                {studyMode === 'quiz' && questions.length > 1 && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuestionMap(true)}
                      className="h-8 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      Map
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
            {/* Course filter tabs (not shown in daily mode) */}
            {studyMode !== 'daily' && studyMode !== 'review' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {COURSE_QUIZ_GROUPS.map((group) => (
              <button
                key={group.id}
                onClick={() => { handleCourseChange(group.id); if (showBookmarked) setShowBookmarked(false); }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCourse === group.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                }`}
              >
                <group.icon className="h-3.5 w-3.5" />
                {group.label}
                <span className={`ml-0.5 text-[10px] ${selectedCourse === group.id ? 'bg-white/20 px-1 rounded' : 'text-muted-foreground'}`}>
                  {group.id === 'all'
                    ? allQuestions.length
                    : allQuestions.filter((q) => q.courseId === group.id).length}
                </span>
              </button>
            ))}
            {/* Bookmarked filter chip */}
            {bookmarkedQuestions.size > 0 && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { setShowBookmarked(!showBookmarked); if (showBookmarked) setCurrentIndex(0); else setCurrentIndex(0); }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all ${
                  showBookmarked
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 glass shadow-sm'
                    : 'border border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/30 glass-hover'
                }`}
              >
                <BookmarkCheck className="h-3.5 w-3.5" />
                Bookmarked
                <span className={`ml-0.5 text-[10px] ${showBookmarked ? 'bg-emerald-500/20 px-1 rounded' : 'text-muted-foreground'}`}>
                  {bookmarkedQuestions.size}
                </span>
              </motion.button>
            )}
          </div>
            )}
            {/* Adaptive reasoning */}
            {adaptiveOn && studyMode === 'quiz' && adaptiveReasoning && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] text-muted-foreground mt-1.5 truncate max-w-full"
              >
                {adaptiveReasoning}
              </motion.p>
            )}
          {studyMode !== 'daily' && studyMode !== 'review' && difficultyTotal > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 flex h-1.5 rounded-full overflow-hidden bg-muted/40">
                {difficultyCounts.easy > 0 && (
                  <motion.div
                    className="bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(difficultyCounts.easy / difficultyTotal) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                )}
                {difficultyCounts.medium > 0 && (
                  <motion.div
                    className="bg-amber-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(difficultyCounts.medium / difficultyTotal) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                  />
                )}
                {difficultyCounts.hard > 0 && (
                  <motion.div
                    className="bg-rose-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(difficultyCounts.hard / difficultyTotal) * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                {difficultyCounts.easy > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                    {difficultyCounts.easy} Easy
                  </span>
                )}
                {difficultyCounts.medium > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                    {difficultyCounts.medium} Med
                  </span>
                )}
                {difficultyCounts.hard > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />
                    {difficultyCounts.hard} Hard
                  </span>
                )}
              </div>
            </div>
          )}
          {studyMode !== 'daily' && studyMode !== 'review' && (
          <div className="flex items-center justify-between mb-2 mt-1">
            <span className="text-sm font-medium">
              {studyMode === 'quiz'
                ? `Question ${currentIndex + 1} of ${questions.length}`
                : `Card ${currentIndex + 1} of ${flashcardQuestions.length}`}
            </span>
            <div className="flex items-center gap-2">
              {studyMode === 'quiz' && (
                <>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                    currentQ?.difficulty === 'easy'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                      : currentQ?.difficulty === 'medium'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                        : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                  }`}>
                    {currentQ?.difficulty}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TYPE_BADGE_GRADIENT[currentQ?.type || ''] || 'bg-muted text-muted-foreground border-border'}`}>
                    {currentQ?.type.replace('_', ' ')}
                  </span>
                </>
              )}
              {studyMode === 'flashcard' && (
                <span className="text-xs text-muted-foreground">
                  {flashcardReviewed.size} of {flashcardQuestions.length} reviewed
                </span>
              )}
            </div>
          </div>
          )}
          {/* Custom gradient progress bar (not shown in daily/review mode) */}
          {studyMode !== 'daily' && studyMode !== 'review' && (
          <div className="relative h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, oklch(0.627 0.194 149.214) 0%, oklch(0.687 0.159 177.89) 50%, oklch(0.565 0.194 149.214) 100%)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${studyMode === 'quiz' ? progress : flashcardProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 text-[9px] font-bold text-white drop-shadow-sm"
              animate={{ left: `${Math.max(studyMode === 'quiz' ? progress : flashcardProgress, 5)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {Math.round(studyMode === 'quiz' ? progress : flashcardProgress)}%
            </motion.div>
          </div>
          )}
          </div>
        </motion.div>

        {/* Daily Challenge Hero Banner */}
        {studyMode === 'daily' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className={`glass-accent-top rounded-2xl p-6 animated-border relative overflow-hidden ${dailyStreak.current > 3 ? 'ring-2 ring-orange-500/30' : ''}`}>
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold gradient-text-animated">Daily Challenge</h2>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                      </div>
                      {dailyStreak.current > 0 && (
                        <motion.div
                          initial={{ scale: 0.9 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-1.5 font-semibold"
                          style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                        >
                          <motion.div
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <Flame className="h-4 w-4" style={{ color: '#f97316' }} />
                          </motion.div>
                          <span>{dailyStreak.current} day streak!</span>
                        </motion.div>
                      )}
                      {dailyMultiplier > 1 && (
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-600 dark:text-amber-400"
                        >
                          <Zap className="h-3 w-3" />
                          {dailyMultiplier}x multiplier
                        </motion.div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Circular SVG Timer */}
                    {!dailyShowResults && (
                      <div className="relative" aria-live="polite">
                        <svg width="64" height="64" className="-rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="text-muted/20"
                          />
                          <motion.circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="none"
                            stroke="url(#dailyTimerGrad)"
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={dailyTimerCircumference}
                            initial={false}
                            animate={{ strokeDashoffset: dailyTimerStroke }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                          <defs>
                            <linearGradient id="dailyTimerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#10b981" />
                              <stop offset="100%" stopColor="#14b8a6" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-xs font-mono font-bold ${dailyTimerLeft <= 30 ? 'text-destructive' : 'text-foreground'}`}>
                            {formatTimer(dailyTimerLeft)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Resets in</span>
                      </div>
                      <div className="font-mono text-lg font-bold tabular-nums">
                        {String(dailyTimeLeft.hours).padStart(2, '0')}:{String(dailyTimeLeft.minutes).padStart(2, '0')}:{String(dailyTimeLeft.seconds).padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Daily progress bar */}
                {!dailyShowResults && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Question {Math.min(currentIndex + 1, dailyQuestions.length)} of {dailyQuestions.length}</span>
                      <span>{dailyScore} correct</span>
                    </div>
                    <div className="relative h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${dailyProgress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Daily Challenge Results Screen */}
        {studyMode === 'daily' && dailyShowResults && dailyChallenge?.completed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="flex flex-col items-center justify-center min-h-[50vh] gap-6"
          >
            {/* Confetti burst (30 particles always on completion) */}
            <AnimatePresence>
              <div className="fixed inset-0 pointer-events-none z-50">
                {Array.from({ length: 30 }).map((_, i) => (
                  <ConfettiParticle
                    key={`daily-confetti-${i}`}
                    delay={i * 0.04}
                    color={DAILY_CONFETTI_COLORS[i % DAILY_CONFETTI_COLORS.length]}
                  />
                ))}
              </div>
            </AnimatePresence>
            <div className="glass rounded-2xl p-8 text-center space-y-6 max-w-md w-full glow-emerald-strong">
              {/* "Challenge Complete!" badge */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.1 }}
                className="mx-auto"
              >
                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold shadow-lg bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-amber-400/30">
                  <Trophy className="h-4 w-4" />
                  Challenge Complete!
                </div>
              </motion.div>

              {/* Animated circular progress */}
              <div className="relative inline-flex">
                <svg width="160" height="160" className="-rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="62"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-muted/20"
                  />
                  <motion.circle
                    cx="80"
                    cy="80"
                    r="62"
                    fill="none"
                    stroke="url(#dailyScoreGrad)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={dailyCircumference}
                    initial={{ strokeDashoffset: dailyCircumference }}
                    animate={{ strokeDashoffset: dailyStrokeDashoffset }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                  <defs>
                    <linearGradient id="dailyScoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="50%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-4xl font-bold gradient-text"
                    key={dailyAnimatedScore}
                  >
                    {dailyAnimatedScore}<span className="text-lg font-normal text-muted-foreground">/{dailyChallenge.total}</span>
                  </motion.span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {Math.round(dailyScorePercent * 100)}% correct
                  </span>
                </div>
              </div>

              {/* Star rating */}
              <div className="flex items-center justify-center gap-2">
                <Star filled={dailyStars >= 1} delay={0.3} />
                <Star filled={dailyStars >= 2} delay={0.5} />
                <Star filled={dailyStars >= 3} delay={0.7} />
              </div>

              {/* Streak display with animated flame */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="flex items-center justify-center gap-2"
              >
                <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Flame className="h-5 w-5 text-orange-500" />
                  </motion.div>
                  <span className="font-bold text-orange-600 dark:text-orange-400">{dailyStreak.current} day streak</span>
                </div>
              </motion.div>

              {dailyStreak.best > 1 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 }}
                  className="text-xs text-muted-foreground"
                >
                  Best streak: {dailyStreak.best} days
                </motion.p>
              )}

              {/* Result message */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="text-center"
              >
                <h2 className="text-xl font-bold">
                  {dailyChallenge.score === dailyChallenge.total
                    ? 'Perfect Score!'
                    : dailyScorePercent >= 0.6
                      ? 'Great work!'
                      : 'Keep practicing!'}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {dailyMultiplier > 1 ? `Score multiplied by ${dailyMultiplier}x from your streak! ` : ''}
                  Come back tomorrow for a new challenge!
                </p>
              </motion.div>

              {/* Tomorrow's Challenge teaser */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 }}
                className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Tomorrow's Challenge</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {String(dailyTimeLeft.hours).padStart(2, '0')}:{String(dailyTimeLeft.minutes).padStart(2, '0')}:{String(dailyTimeLeft.seconds).padStart(2, '0')}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      animate={{ width: `${((24 * 60 - (dailyTimeLeft.hours * 60 + dailyTimeLeft.minutes)) / (24 * 60)) * 100}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">New questions at midnight</span>
                </div>
              </motion.div>

              {/* Per-question breakdown */}
              <div className="space-y-2 text-left">
                <h3 className="text-sm font-semibold">Question Breakdown</h3>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {dailyQuestions.map((q, i) => {
                    const wasCorrect = answered[q.id] && isCorrect(q, answers[q.id] || '');
                    return (
                      <motion.div
                        key={q.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 + 0.3 }}
                        className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${wasCorrect ? 'bg-emerald-500/5' : 'bg-destructive/5'}`}
                      >
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, delay: i * 0.05 + 0.3 }}
                          className={`flex h-5 w-5 items-center justify-center rounded-full ${wasCorrect ? 'bg-emerald-500 text-white' : 'bg-destructive/20 text-destructive'}`}
                        >
                          {wasCorrect ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        </motion.span>
                        <span className="flex-1 truncate">{q.question.slice(0, 60)}{q.question.length > 60 ? '...' : ''}</span>
                        <span className={`text-[9px] px-1.5 py-0 rounded-full font-medium border ${TYPE_BADGE_GRADIENT[q.type] || 'bg-muted text-muted-foreground border-border'}`}>
                          {q.type.replace('_', ' ')}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button onClick={handleDailyShare} variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  {dailyShareCopied ? 'Copied!' : 'Share Results'}
                </Button>
                <Button onClick={() => navigate('dashboard')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Daily Challenge Question Card */}
        {studyMode === 'daily' && !dailyShowResults && dailyCurrentQ && (
        <AnimatePresence mode="wait">
          {dailyCurrentQ && (
            <motion.div
              key={dailyCurrentQ.id}
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`glass rounded-xl p-6 space-y-6 glow-emerald ${dailyStreak.current > 3 ? 'ring-2 ring-orange-500/40' : ''}`}
            >
              {/* Concept tag */}
              {dailyCurrentQ.concept && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  <Badge variant="secondary" className="text-xs bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/10">
                    {dailyCurrentQ.concept}
                  </Badge>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                    dailyCurrentQ.difficulty === 'easy'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                      : dailyCurrentQ.difficulty === 'medium'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                        : 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20'
                  }`}>
                    {dailyCurrentQ.difficulty}
                  </span>
                </motion.div>
              )}

              {/* Question text */}
              <h2 className="text-lg font-semibold leading-relaxed">{dailyCurrentQ.question}</h2>

              {/* Question type renderers — reuse the same pattern as quiz mode */}
              {dailyCurrentQ.type === 'multiple_choice' && dailyCurrentQ.options && (
                <div className="grid gap-2">
                  {dailyCurrentQ.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isAnswered = answered[dailyCurrentQ.id];
                    const isSelected = answers[dailyCurrentQ.id] === opt;
                    const isCorrectOpt = opt === dailyCurrentQ.answer;

                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAnswered ? { scale: 1.01, y: -1 } : {}}
                        whileTap={!isAnswered ? { scale: 0.99 } : {}}
                        onClick={() => !isAnswered && handleDailyAnswer(opt)}
                        disabled={isAnswered}
                        aria-label={`Option ${letter}: ${opt}`}
                        className={`relative flex items-center gap-3 rounded-lg border p-4 text-left text-sm transition-all ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500/60 bg-emerald-500/8 shadow-sm shadow-emerald-500/10'
                              : isSelected
                                ? 'border-destructive/60 bg-destructive/8'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                          isAnswered && isCorrectOpt
                            ? 'bg-emerald-500 text-white'
                            : isAnswered && isSelected
                              ? 'bg-destructive text-white'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {isAnswered && isCorrectOpt ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isAnswered && isSelected ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            letter
                          )}
                        </span>
                        <span className={isAnswered && isCorrectOpt ? 'text-emerald-700 dark:text-emerald-300' : ''}>{opt}</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {dailyCurrentQ.type === 'true_false' && (
                <div className="flex gap-3">
                  {['True', 'False'].map((opt) => {
                    const isAnswered = answered[dailyCurrentQ.id];
                    const isSelected = answers[dailyCurrentQ.id] === opt;
                    const isCorrectOpt = opt === dailyCurrentQ.answer;

                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAnswered ? { scale: 1.03, y: -2 } : {}}
                        whileTap={!isAnswered ? { scale: 0.97 } : {}}
                        onClick={() => !isAnswered && handleDailyAnswer(opt)}
                        disabled={isAnswered}
                        aria-label={`Answer: ${opt}`}
                        className={`flex-1 rounded-lg border p-4 text-center font-semibold transition-all ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500/60 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10'
                              : isSelected
                                ? 'border-destructive/60 bg-destructive/8 text-destructive'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        {isAnswered && isCorrectOpt && <CheckCircle2 className="h-5 w-5 inline mr-1.5" />}
                        {isAnswered && isSelected && !isCorrectOpt && <XCircle className="h-5 w-5 inline mr-1.5" />}
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {dailyCurrentQ.type === 'short_answer' && !answered[dailyCurrentQ.id] && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your answer..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        handleDailyAnswer((e.target as HTMLInputElement).value);
                      }
                    }}
                    id="daily-short-answer-input"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('daily-short-answer-input') as HTMLInputElement;
                      if (input?.value.trim()) handleDailyAnswer(input.value);
                    }}
                  >
                    Submit
                  </Button>
                </div>
              )}

              {dailyCurrentQ.type === 'short_answer' && answered[dailyCurrentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your answer:</p>
                  <p className="font-medium">{answers[dailyCurrentQ.id]}</p>
                </div>
              )}

              {dailyCurrentQ.type === 'fill_blank' && !answered[dailyCurrentQ.id] && (
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Fill in the blank..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        handleDailyAnswer((e.target as HTMLInputElement).value);
                      }
                    }}
                    id="daily-fill-blank-input"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('daily-fill-blank-input') as HTMLInputElement;
                      if (input?.value.trim()) handleDailyAnswer(input.value);
                    }}
                  >
                    Submit
                  </Button>
                </div>
              )}

              {dailyCurrentQ.type === 'fill_blank' && answered[dailyCurrentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your answer:</p>
                  <p className="font-medium">{answers[dailyCurrentQ.id]}</p>
                </div>
              )}

              {dailyCurrentQ.type === 'matching' && dailyCurrentQ.matchingPairs && !answered[dailyCurrentQ.id] && (
                <MatchingInput
                  pairs={dailyCurrentQ.matchingPairs}
                  onAnswer={(answer) => handleDailyAnswer(answer)}
                />
              )}

              {dailyCurrentQ.type === 'error_correction' && dailyCurrentQ.errorText && !answered[dailyCurrentQ.id] && (
                <ErrorCorrectionInput
                  errorText={dailyCurrentQ.errorText}
                  onAnswer={(answer) => handleDailyAnswer(answer)}
                />
              )}

              {dailyCurrentQ.type === 'error_correction' && answered[dailyCurrentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your correction:</p>
                  <p className="font-medium">{answers[dailyCurrentQ.id] || '(empty)'}</p>
                </div>
              )}

              {/* Explanation */}
              <AnimatePresence>
                {showExplanation && dailyCurrentQ.explanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-primary">Explanation</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {dailyCurrentQ.explanation}
                      </p>
                      {dailyCurrentQ.type === 'short_answer' || dailyCurrentQ.type === 'error_correction' || dailyCurrentQ.type === 'fill_blank' ? (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">Expected answer: </span>
                          <span className="text-xs font-medium">{dailyCurrentQ.answer}</span>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="text-muted-foreground"
                >
                  Previous
                </Button>
                {answered[dailyCurrentQ.id] && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Button onClick={handleDailyNext}>
                      {currentIndex < dailyQuestions.length - 1 ? (
                        <>
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      ) : (
                        <>
                          Finish Challenge <Trophy className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}

        {/* Daily challenge question navigator dots */}
        {studyMode === 'daily' && !dailyShowResults && dailyQuestions.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
            {dailyQuestions.map((q, i) => (
              <motion.button
                key={q.id}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setCurrentIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === currentIndex
                    ? 'bg-primary w-7 shadow-sm shadow-primary/30'
                    : answered[q.id]
                      ? isCorrect(q, answers[q.id] || '')
                        ? 'bg-emerald-500 w-2.5'
                        : 'bg-destructive/60 w-2.5'
                      : 'bg-muted hover:bg-primary/40 w-2.5'
                }`}
                aria-label={`Go to question ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Review Mode Progress Banner */}
        {studyMode === 'review' && !reviewShowResults && reviewQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-4 p-3 rounded-lg glass"
          >
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">
                {reviewedCount}/{reviewQuestions.length} reviews complete
              </span>
            </div>
            <div className="relative h-2 w-32 rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${reviewProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )}

        {/* Review Mode Empty State */}
        {studyMode === 'review' && !reviewShowResults && reviewQuestions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[40vh] gap-4"
          >
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Brain className="h-8 w-8 text-emerald-500/60" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold">No reviews due</h2>
              <p className="text-sm text-muted-foreground">Complete quizzes to unlock spaced repetition reviews</p>
            </div>
            <Button variant="outline" onClick={() => handleModeChange('quiz')}>
              <HelpCircle className="h-4 w-4 mr-2" />
              Start a Quiz
            </Button>
          </motion.div>
        )}

        {/* Review Mode Question Card */}
        {studyMode === 'review' && !reviewShowResults && reviewCurrentQ && (
          <AnimatePresence mode="wait">
            <motion.div
              key={reviewCurrentQ.id}
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass rounded-xl p-6 space-y-6 glow-emerald"
            >
              {/* Concept tag */}
              {reviewCurrentQ.concept && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/10">
                    {reviewCurrentQ.concept}
                  </Badge>
                </div>
              )}

              <h2 className="text-lg font-semibold leading-relaxed">{reviewCurrentQ.question}</h2>

              {/* Multiple choice */}
              {reviewCurrentQ.type === 'multiple_choice' && reviewCurrentQ.options && (
                <div className="grid gap-2">
                  {reviewCurrentQ.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isAns = answered[reviewCurrentQ.id];
                    const isSel = answers[reviewCurrentQ.id] === opt;
                    const isCor = opt === reviewCurrentQ.answer;
                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAns ? { scale: 1.01, y: -1 } : {}}
                        whileTap={!isAns ? { scale: 0.99 } : {}}
                        onClick={() => !isAns && handleReviewAnswer(opt)}
                        disabled={isAns}
                        aria-label={`Option ${letter}: ${opt}`}
                        className={`relative flex items-center gap-3 rounded-lg border p-4 text-left text-sm transition-all ${
                          isAns
                            ? isCor
                              ? 'border-emerald-500/60 bg-emerald-500/8 shadow-sm shadow-emerald-500/10'
                              : isSel
                                ? 'border-destructive/60 bg-destructive/8'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                          isAns && isCor ? 'bg-emerald-500 text-white' : isAns && isSel ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'
                        }`}>
                          {isAns && isCor ? <CheckCircle2 className="h-4 w-4" /> : isAns && isSel ? <XCircle className="h-4 w-4" /> : letter}
                        </span>
                        <span className={isAns && isCor ? 'text-emerald-700 dark:text-emerald-300' : ''}>{opt}</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* True/False */}
              {reviewCurrentQ.type === 'true_false' && (
                <div className="flex gap-3">
                  {['True', 'False'].map((opt) => {
                    const isAns = answered[reviewCurrentQ.id];
                    const isSel = answers[reviewCurrentQ.id] === opt;
                    const isCor = opt === reviewCurrentQ.answer;
                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAns ? { scale: 1.03, y: -2 } : {}}
                        whileTap={!isAns ? { scale: 0.97 } : {}}
                        onClick={() => !isAns && handleReviewAnswer(opt)}
                        disabled={isAns}
                        aria-label={`Answer: ${opt}`}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-lg border p-4 text-sm font-medium transition-all ${
                          isAns
                            ? isCor ? 'border-emerald-500/60 bg-emerald-500/8' : isSel ? 'border-destructive/60 bg-destructive/8' : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                        }`}
                      >
                        {isAns && isCor ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : isAns && isSel ? <XCircle className="h-5 w-5 text-destructive" /> : null}
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Short answer / Fill blank / Error correction */}
              {(reviewCurrentQ.type === 'short_answer' || reviewCurrentQ.type === 'fill_blank' || reviewCurrentQ.type === 'error_correction') && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder={reviewCurrentQ.type === 'fill_blank' ? 'Type the missing term...' : 'Type your answer...'}
                      value={answers[reviewCurrentQ.id] || ''}
                      onChange={(e) => {
                        if (!answered[reviewCurrentQ.id]) {
                          setAnswers((prev) => ({ ...prev, [reviewCurrentQ.id]: e.target.value }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && answers[reviewCurrentQ.id]?.trim() && !answered[reviewCurrentQ.id]) {
                          handleReviewAnswer(answers[reviewCurrentQ.id].trim());
                        }
                      }}
                      disabled={answered[reviewCurrentQ.id]}
                      className="flex-1"
                    />
                    {!answered[reviewCurrentQ.id] && (
                      <Button
                        onClick={() => answers[reviewCurrentQ.id]?.trim() && handleReviewAnswer(answers[reviewCurrentQ.id].trim())}
                        disabled={!answers[reviewCurrentQ.id]?.trim()}
                        size="sm"
                      >
                        Submit
                      </Button>
                    )}
                  </div>
                  {answered[reviewCurrentQ.id] && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-sm ${isCorrect(reviewCurrentQ, answers[reviewCurrentQ.id]) ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                    >
                      {isCorrect(reviewCurrentQ, answers[reviewCurrentQ.id])
                        ? '✓ Correct!'
                        : `✗ Incorrect. Answer: ${reviewCurrentQ.answer}`}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Explanation */}
              <AnimatePresence>
                {showExplanation && reviewCurrentQ.explanation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-4"
                  >
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      <span className="font-semibold">Explanation: </span>
                      {reviewCurrentQ.explanation}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Next button */}
              {answered[reviewCurrentQ.id] && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <Button onClick={handleNext} size="sm">
                    {currentIndex < reviewQuestions.length - 1 ? (
                      <>Next <ChevronRight className="h-4 w-4 ml-1" /></>
                    ) : (
                      <>Finish <Trophy className="h-4 w-4 ml-1" /></>
                    )}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Review Mode Results Screen */}
        {studyMode === 'review' && reviewShowResults && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="flex flex-col items-center justify-center min-h-[50vh] gap-6"
          >
            {/* Confetti */}
            <AnimatePresence>
              {reviewedCount === reviewQuestions.length && (
                <div className="fixed inset-0 pointer-events-none z-50">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <ConfettiParticle
                      key={`review-confetti-${i}`}
                      delay={i * 0.03}
                      color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
            <div className="glass rounded-2xl p-8 text-center space-y-6 max-w-md w-full glow-emerald-strong">
              <div className="relative inline-flex">
                <svg width="140" height="140" className="-rotate-90">
                  <circle cx="70" cy="70" r="54" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
                  <motion.circle
                    cx="70" cy="70" r="54" fill="none" stroke="oklch(0.627 0.194 149.214)"
                    strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 54}
                    initial={{ strokeDashoffset: 2 * Math.PI * 54 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 54 * (1 - (reviewQuestions.length > 0 ? reviewedCount / reviewQuestions.length : 0)) }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    className="text-3xl font-bold gradient-text"
                    key={reviewedCount}
                  >
                    {reviewedCount}<span className="text-base font-normal text-muted-foreground">/{reviewQuestions.length}</span>
                  </motion.span>
                  <span className="text-xs text-muted-foreground mt-1">reviews done</span>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2 className="text-xl font-bold">
                  {reviewedCount === reviewQuestions.length
                    ? 'Review Complete!'
                    : 'Reviews Updated'}
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {reviewedCount === reviewQuestions.length
                    ? 'All due items have been reviewed. Great work staying on top of your learning!'
                    : 'Your review schedule has been updated.'}
                </p>
              </motion.div>

              {/* Per-question breakdown */}
              <div className="space-y-2 text-left">
                <h3 className="text-sm font-semibold">Review Breakdown</h3>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {reviewQuestions.map((q, i) => {
                    const wasCorrect = answered[q.id] && isCorrect(q, answers[q.id] || '');
                    return (
                      <motion.div
                        key={q.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 + 0.3 }}
                        className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ${wasCorrect ? 'bg-emerald-500/5' : 'bg-destructive/5'}`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${wasCorrect ? 'bg-emerald-500 text-white' : 'bg-destructive/20 text-destructive'}`}>
                          {wasCorrect ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        </span>
                        <span className="flex-1 truncate">{q.concept || q.question.slice(0, 50)}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => handleModeChange('quiz')}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Back to Quiz
                </Button>
                <Button onClick={() => { handleModeChange('review'); }}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Review Again
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Review mode question navigator dots */}
        {studyMode === 'review' && !reviewShowResults && reviewQuestions.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
            {reviewQuestions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === currentIndex
                    ? 'bg-emerald-500 w-7 shadow-sm shadow-emerald-500/30'
                    : answered[q.id]
                      ? isCorrect(q, answers[q.id] || '')
                        ? 'bg-emerald-500 w-2.5'
                        : 'bg-destructive/60 w-2.5'
                      : 'bg-muted hover:bg-emerald-500/40 w-2.5'
                }`}
                aria-label={`Go to review question ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Quiz question card */}
        {studyMode === 'quiz' && (
        <div role="group" aria-label="Quiz questions">
        <AnimatePresence mode="wait">
          {currentQ && (
            <motion.div
              key={currentQ.id}
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="glass rounded-xl p-6 space-y-6 glow-emerald gradient-border relative overflow-hidden"
            >
              {/* Concept tag + bookmark */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentQ.concept && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <Badge variant="secondary" className="text-xs bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/10">
                        {currentQ.concept}
                      </Badge>
                    </motion.div>
                  )}
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => toggleBookmark(currentQ.id)}
                  className="opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted/50"
                  aria-label={bookmarkedQuestions.has(currentQ.id) ? 'Remove bookmark' : 'Bookmark question'}
                >
                  <AnimatePresence mode="wait">
                    {bookmarkedQuestions.has(currentQ.id) ? (
                      <motion.span
                        key="bookmarked"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="flex items-center justify-center"
                      >
                        <BookmarkCheck className="h-4.5 w-4.5 text-emerald-500 glow-emerald" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="not-bookmarked"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="flex items-center justify-center"
                      >
                        <Bookmark className="h-4.5 w-4.5 text-muted-foreground" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>

              {/* Question text */}
              <h2 className="text-lg font-semibold leading-relaxed">{currentQ.question}</h2>

              {/* Question type renderer */}
              {currentQ.type === 'multiple_choice' && currentQ.options && (
                <div className="grid gap-2">
                  {currentQ.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isAnswered = answered[currentQ.id];
                    const isSelected = answers[currentQ.id] === opt;
                    const isCorrectOpt = opt === currentQ.answer;

                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAnswered ? { scale: 1.01, y: -1 } : {}}
                        whileTap={!isAnswered ? { scale: 0.99 } : {}}
                        onClick={() => !isAnswered && handleAnswer(opt)}
                        disabled={isAnswered}
                        aria-label={`Option ${letter}: ${opt}`}
                        className={`relative flex items-center gap-3 rounded-lg border p-4 text-left text-sm transition-all hover-lift ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500/60 bg-emerald-500/8 shadow-sm shadow-emerald-500/10'
                              : isSelected
                                ? 'border-destructive/60 bg-destructive/8'
                                : 'border-border opacity-60'
                            : isSelected
                              ? 'border-primary/60 bg-primary/5 quiz-answer-pulse'
                              : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        <motion.span
                          initial={false}
                          animate={
                            isAnswered && isCorrectOpt
                              ? { scale: [1, 1.2, 1] }
                              : isAnswered && isSelected
                                ? { x: [0, -3, 3, -3, 3, 0] }
                                : {}
                          }
                          transition={{ duration: 0.4 }}
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                            isAnswered && isCorrectOpt
                              ? 'bg-emerald-500 text-white'
                              : isAnswered && isSelected
                                ? 'bg-destructive text-white'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isAnswered && isCorrectOpt ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </motion.div>
                          ) : isAnswered && isSelected ? (
                            <motion.div
                              initial={{ scale: 0, rotate: 90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 300 }}
                            >
                              <XCircle className="h-4 w-4" />
                            </motion.div>
                          ) : (
                            letter
                          )}
                        </motion.span>
                        <span className={isAnswered && isCorrectOpt ? 'text-emerald-700 dark:text-emerald-300' : ''}>{opt}</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === 'true_false' && (
                <div className="flex gap-3">
                  {['True', 'False'].map((opt) => {
                    const isAnswered = answered[currentQ.id];
                    const isSelected = answers[currentQ.id] === opt;
                    const isCorrectOpt = opt === currentQ.answer;

                    return (
                      <motion.button
                        key={opt}
                        whileHover={!isAnswered ? { scale: 1.03, y: -2 } : {}}
                        whileTap={!isAnswered ? { scale: 0.97 } : {}}
                        onClick={() => !isAnswered && handleAnswer(opt)}
                        disabled={isAnswered}
                        aria-label={`Answer: ${opt}`}
                        className={`flex-1 rounded-lg border p-4 text-center font-semibold transition-all ${
                          isAnswered
                            ? isCorrectOpt
                              ? 'border-emerald-500/60 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 shadow-sm shadow-emerald-500/10'
                              : isSelected
                                ? 'border-destructive/60 bg-destructive/8 text-destructive'
                                : 'border-border opacity-60'
                            : 'border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm hover:shadow-primary/5 cursor-pointer'
                        }`}
                      >
                        <AnimatePresence mode="wait">
                          {isAnswered && isCorrectOpt ? (
                            <motion.span
                              key="check"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="inline-flex"
                            >
                              <CheckCircle2 className="h-5 w-5 inline mr-1.5" />
                            </motion.span>
                          ) : isAnswered && isSelected ? (
                            <motion.span
                              key="x"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              className="inline-flex"
                            >
                              <XCircle className="h-5 w-5 inline mr-1.5" />
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                        {opt}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {currentQ.type === 'short_answer' && !answered[currentQ.id] && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Type your answer..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        handleAnswer((e.target as HTMLInputElement).value);
                      }
                    }}
                    id="short-answer-input"
                  />
                  <Button
                    onClick={() => {
                      const input = document.getElementById('short-answer-input') as HTMLInputElement;
                      if (input?.value.trim()) handleAnswer(input.value);
                    }}
                  >
                    Submit
                  </Button>
                </div>
              )}

              {currentQ.type === 'short_answer' && answered[currentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your answer:</p>
                  <p className="font-medium">{answers[currentQ.id]}</p>
                </div>
              )}

              {currentQ.type === 'fill_blank' && !answered[currentQ.id] && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Fill in the blank..."
                      value={fillBlankValues[currentQ.id] || ''}
                      onChange={(e) => setFillBlankValues((prev) => ({ ...prev, [currentQ.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                          handleAnswer((e.target as HTMLInputElement).value);
                        }
                      }}
                      className={hintsUsed[currentQ.id] ? 'border-blue-500 focus-visible:ring-blue-500' : ''}
                    />
                    <Button
                      onClick={() => {
                        const val = fillBlankValues[currentQ.id] || '';
                        if (val.trim()) handleAnswer(val);
                      }}
                      disabled={!fillBlankValues[currentQ.id]?.trim()}
                    >
                      Submit
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {(fillBlankValues[currentQ.id] || '').length} characters
                    </span>
                    {!hintsUsed[currentQ.id] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
                        onClick={() => {
                          const firstLetter = currentQ.answer[0] || '';
                          setHintsUsed((prev) => ({ ...prev, [currentQ.id]: true }));
                          setFillBlankValues((prev) => ({
                            ...prev,
                            [currentQ.id]: (prev[currentQ.id] || '') + firstLetter,
                          }));
                          toast.info(`Hint: First letter "${firstLetter}" revealed! (−25% points)`, { duration: 3000 });
                        }}
                      >
                        <Lightbulb className="h-3.5 w-3.5 mr-1" />
                        Hint
                      </Button>
                    )}
                    {hintsUsed[currentQ.id] && (
                      <span className="text-xs text-blue-500 flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" />
                        Hint used (−25%)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {currentQ.type === 'fill_blank' && answered[currentQ.id] && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-lg border p-4 text-sm space-y-2 ${
                      fillBlankGrades[currentQ.id]?.status === 'correct'
                        ? 'border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                        : fillBlankGrades[currentQ.id]?.status === 'close'
                          ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                          : 'border-red-500/50 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                    }`}
                  >
                    <p className="text-muted-foreground">Your answer:</p>
                    <p className="font-medium">{answers[currentQ.id]}</p>
                    {fillBlankGrades[currentQ.id]?.status === 'correct' && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Correct! Full points
                      </motion.div>
                    )}
                    {fillBlankGrades[currentQ.id]?.status === 'close' && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-amber-600 dark:text-amber-400 text-xs font-medium"
                      >
                        {fillBlankGrades[currentQ.id].message} ({Math.round(fillBlankGrades[currentQ.id].points * 100)}% points)
                      </motion.div>
                    )}
                    {fillBlankGrades[currentQ.id]?.status === 'wrong' && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-600 dark:text-red-400 text-xs font-medium"
                      >
                        Correct answer: <span className="font-bold">{currentQ.answer}</span>
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {currentQ.type === 'matching' && currentQ.matchingPairs && !answered[currentQ.id] && (
                <MatchingInput
                  pairs={currentQ.matchingPairs}
                  onAnswer={(answer) => handleAnswer(answer)}
                />
              )}

              {currentQ.type === 'error_correction' && currentQ.errorText && !answered[currentQ.id] && (
                <ErrorCorrectionInput
                  errorText={currentQ.errorText}
                  onAnswer={(answer) => handleAnswer(answer)}
                />
              )}

              {currentQ.type === 'error_correction' && answered[currentQ.id] && (
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <p className="text-muted-foreground">Your correction:</p>
                  <p className="font-medium">{answers[currentQ.id] || '(empty)'}</p>
                </div>
              )}

              {/* Explanation */}
              <AnimatePresence>
                {showExplanation && currentQ.explanation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-primary">Explanation</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {currentQ.explanation}
                      </p>
                      {currentQ.type === 'short_answer' || currentQ.type === 'error_correction' || currentQ.type === 'fill_blank' ? (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">Expected answer: </span>
                          <span className="text-xs font-medium">{currentQ.answer}</span>
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="text-muted-foreground"
                >
                  Previous
                </Button>
                {answered[currentQ.id] && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Button onClick={handleNext}>
                      {currentIndex < questions.length - 1 ? (
                        <>
                          Next <ChevronRight className="h-4 w-4 ml-1" />
                        </>
                      ) : (
                        <>
                          See Results <Trophy className="h-4 w-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
        )}

        {/* Flashcard Mode - 3D Flip with Swipe */}
        {studyMode === 'flashcard' && flashcardQuestions[currentIndex] && (
          <div className="space-y-6">
            <InteractiveFlashcard
              key={flashcardQuestions[currentIndex].id}
              question={flashcardQuestions[currentIndex]}
              index={currentIndex}
              total={flashcardQuestions.length}
              isDifficult={difficultCards.has(flashcardQuestions[currentIndex].id)}
              onMark={handleFlashcardMark}
              onToggleDifficult={handleMarkDifficult}
            />

            {/* Flashcard navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFlashcardPrev}
                disabled={currentIndex === 0}
                className="text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const shuffled = [...flashcardQuestions].sort(() => Math.random() - 0.5);
                    setCurrentQuestions(shuffled);
                    setCurrentIndex(0);
                  }}
                  className="text-muted-foreground"
                >
                  <Shuffle className="h-4 w-4 mr-1" />
                  Shuffle
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFlashcardReset}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFlashcardNext}
                disabled={currentIndex === flashcardQuestions.length - 1}
                className="text-muted-foreground"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Flashcard progress dots */}
            {flashcardQuestions.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {flashcardQuestions.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(i)}
                    className={`h-2.5 rounded-full transition-all ${
                      i === currentIndex
                        ? 'bg-primary w-7 shadow-sm shadow-primary/30'
                        : knownCards.has(q.id)
                          ? 'bg-emerald-500 w-2.5'
                          : stillLearningCards.has(q.id)
                            ? 'bg-amber-500 w-2.5'
                            : flashcardReviewed.has(q.id)
                              ? 'bg-muted w-2.5'
                              : 'bg-muted/60 hover:bg-primary/40 w-2.5'
                    }`}
                    aria-label={`Go to card ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Question navigator dots (quiz mode only) */}
        {studyMode === 'quiz' && questions.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-6 flex-wrap">
            {questions.map((q, i) => (
              <motion.button
                key={q.id}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setCurrentIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === currentIndex
                    ? 'bg-primary w-7 shadow-sm shadow-primary/30'
                    : answered[q.id]
                      ? isCorrect(q, answers[q.id] || '')
                        ? 'bg-emerald-500 w-2.5'
                        : 'bg-destructive/60 w-2.5'
                      : 'bg-muted hover:bg-primary/40 w-2.5'
                }`}
                aria-label={`Go to question ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Question Map Dialog */}
        <Dialog open={showQuestionMap} onOpenChange={setShowQuestionMap}>
          <DialogContent className="max-w-md p-0">
            <DialogHeader className="px-6 pt-6 pb-3">
              <DialogTitle className="flex items-center gap-2 text-base">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Question Map
              </DialogTitle>
              <DialogDescription className="text-xs">
                Click a question to navigate. Color indicates your answer status.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-6">
              {/* Legend */}
              <div className="flex items-center gap-4 mb-4 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-emerald-500" />
                  Correct
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-amber-500" />
                  Close
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-red-500" />
                  Wrong
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-muted-foreground/30" />
                  Unanswered
                </div>
              </div>
              {/* Grid */}
              <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
                {questions.map((q, i) => {
                  const isCurrent = i === currentIndex;
                  const isAnswered = answered[q.id];
                  let statusColor = 'bg-muted/50 text-muted-foreground border-border';
                  let statusIcon: ReactNode = null;
                  if (isAnswered) {
                    if (q.type === 'fill_blank' && fillBlankGrades[q.id]) {
                      const grade = fillBlankGrades[q.id];
                      if (grade.status === 'correct') {
                        statusColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                        statusIcon = <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
                      } else if (grade.status === 'close') {
                        statusColor = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
                        statusIcon = <span className="text-[10px] font-bold text-amber-500">~</span>;
                      } else {
                        statusColor = 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30';
                        statusIcon = <XCircle className="h-3 w-3 text-red-500" />;
                      }
                    } else if (isCorrect(q, answers[q.id] || '')) {
                      statusColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
                      statusIcon = <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
                    } else {
                      statusColor = 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30';
                      statusIcon = <XCircle className="h-3 w-3 text-red-500" />;
                    }
                  }
                  return (
                    <motion.button
                      key={q.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setCurrentIndex(i);
                        setShowQuestionMap(false);
                      }}
                      className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg border p-2 text-xs font-medium transition-all ${statusColor} ${
                        isCurrent ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                      }`}
                    >
                      <span className="font-bold text-sm leading-none">{i + 1}</span>
                      {statusIcon}
                    </motion.button>
                  );
                })}
              </div>
              {/* Summary stats */}
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
                <span>{Object.keys(answered).length}/{questions.length} answered</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {questions.filter((q) => {
                    if (q.type === 'fill_blank' && fillBlankGrades[q.id]) return fillBlankGrades[q.id].status === 'correct';
                    return answered[q.id] && isCorrect(q, answers[q.id] || '');
                  }).length} correct
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}