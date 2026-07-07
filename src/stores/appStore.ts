import { create } from 'zustand';
import type { AppView, LearnerProfile, MasteryMap, DecisionLoopState, ChatMessage, Course, Slide, Question, UserTip, UserFeedback, Note, Goal, AppSettings, Achievement, StudySession, StudyGoal, StudyNotification, AdaptiveResult } from '@/types';

interface AppState {
  // Navigation
  currentView: AppView;
  previousView: AppView | null;
  navigate: (view: AppView) => void;

  // User
  userName: string;
  userEmail: string;
  userId: string | null;
  setUserId: (id: string) => void;
  setUserInfo: (name: string, email: string) => void;

  // Onboarding
  onboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;

  // Learner Profile
  learnerProfile: LearnerProfile | null;
  setLearnerProfile: (profile: LearnerProfile) => void;

  // Active Session
  activeSessionId: string | null;
  activeCourseId: string | null;
  activeTopic: string | null;
  sessionPhase: string;
  setActiveSession: (sessionId: string, courseId?: string, topic?: string) => void;
  setSessionPhase: (phase: string) => void;
  setActiveTopic: (topic: string) => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;

  // Mastery Map
  masteryMap: MasteryMap;
  updateMastery: (concept: string, level: MasteryMap[string]['level'], evidence: string) => void;

  // Decision Loop
  decisionState: DecisionLoopState;
  updateDecisionState: (updates: Partial<DecisionLoopState>) => void;

  // Courses
  courses: Course[];
  setCourses: (courses: Course[]) => void;
  activeCourse: Course | null;
  setActiveCourse: (course: Course | null) => void;

  // Slides
  activeSlides: Slide[];
  setActiveSlides: (slides: Slide[]) => void;
  currentSlideIndex: number;
  setCurrentSlideIndex: (i: number) => void;
  activeSlideContent: string | null;
  setActiveSlideContent: (content: string | null) => void;

  // Questions
  currentQuestions: Question[];
  setCurrentQuestions: (q: Question[]) => void;
  quizScore: number | null;
  quizTotal: number | null;
  setQuizScore: (score: number, total: number) => void;

  // Tips & Feedback
  tips: UserTip[];
  addTip: (tip: UserTip) => void;
  feedbackItems: UserFeedback[];
  addFeedbackItem: (item: UserFeedback) => void;

  // Onboarding extended
  hardSubjects: string[];
  setHardSubjects: (subjects: string[]) => void;
  bestTeachingStyle: string;
  setBestTeachingStyle: (style: string) => void;
  alwaysConfuses: string;
  setAlwaysConfuses: (text: string) => void;

  // Persona
  activePersona: string;
  setActivePersona: (persona: string) => void;

  // Mood Settings
  moodSettings: { energy: number; formality: number; patience: number; humor: number };
  setMoodSettings: (settings: Partial<{ energy: number; formality: number; patience: number; humor: number }>) => void;

  // Tutoring Mode
  tutorMode: 'text' | 'slide' | 'hybrid';
  setTutorMode: (mode: 'text' | 'slide' | 'hybrid') => void;

  // Notes
  notes: Note[];
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => void;
  deleteNote: (id: string) => void;

  // Recent Views (for search modal)
  recentViews: AppView[];
  addRecentView: (view: AppView) => void;

  // Goals
  goals: Goal[];
  addGoal: (goal: Goal) => void;
  toggleGoalStatus: (id: string) => void;
  deleteGoal: (id: string) => void;
  reorderGoals: (fromIndex: number, toIndex: number) => void;

  // Achievements
  achievements: Achievement[];
  unlockAchievement: (id: string) => void;
  checkAchievements: () => void;

  // Study Sessions
  studySessions: StudySession[];
  addStudySession: (session: StudySession) => void;
  deleteStudySession: (id: string) => void;

  // Study Goals
  studyGoals: StudyGoal[];
  addStudyGoal: (goal: Omit<StudyGoal, 'id' | 'currentProgress' | 'createdAt' | 'weekStart'>) => void;
  updateStudyGoal: (id: string, updates: Partial<StudyGoal>) => void;
  deleteStudyGoal: (id: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Daily Challenge
  dailyChallenge: {
    lastCompletedDate: string | null;
    streak: number;
    bestScore: number;
    totalCompleted: number;
    todayResults: { score: number; total: number; timeTaken: number; stars: number } | null;
  };
  setDailyChallenge: (data: Partial<AppState['dailyChallenge']>) => void;
  resetDailyStreak: () => void;

  // Notifications
  notifications: StudyNotification[];
  addNotification: (n: Omit<StudyNotification, 'id' | 'read' | 'createdAt'>) => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;

  // Adaptive Results
  adaptiveResults: AdaptiveResult[];
  addAdaptiveResult: (result: AdaptiveResult) => void;
  clearAdaptiveResults: () => void;

  // Viewed Slides & Course Completion
  viewedSlides: string[];
  markSlideViewed: (slideId: string) => void;
  isSlideViewed: (slideId: string) => boolean;
  completedCourses: string[];
  completeCourse: (courseId: string) => void;

  // Course Categories
  courseCategories: Record<string, string>;
  setCourseCategory: (courseId: string, category: string) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

function defaultAchievements(): Achievement[] {
  return [
    { id: 'first_steps', title: 'First Steps', description: 'Complete your first session', icon: 'Footprints', category: 'study', rarity: 'common', unlockedAt: null, condition: 'complete_1_session', progress: 0, targetValue: 1 },
    { id: 'bookworm', title: 'Bookworm', description: 'Complete 10 sessions', icon: 'BookOpen', category: 'study', rarity: 'rare', unlockedAt: null, condition: 'complete_10_sessions', progress: 0, targetValue: 10 },
    { id: 'scholar', title: 'Scholar', description: 'Complete 50 sessions', icon: 'GraduationCap', category: 'study', rarity: 'epic', unlockedAt: null, condition: 'complete_50_sessions', progress: 0, targetValue: 50 },
    { id: 'perfect_score', title: 'Perfect Score', description: 'Score 100% on any quiz', icon: 'Star', category: 'quiz', rarity: 'epic', unlockedAt: null, condition: 'score_100_quiz', progress: 0, targetValue: 1 },
    { id: 'quiz_master', title: 'Quiz Master', description: 'Complete 20 quizzes', icon: 'Trophy', category: 'quiz', rarity: 'rare', unlockedAt: null, condition: 'complete_20_quizzes', progress: 0, targetValue: 20 },
    { id: 'quick_learner', title: 'Quick Learner', description: 'Score 80%+ on first quiz attempt', icon: 'Zap', category: 'quiz', rarity: 'rare', unlockedAt: null, condition: 'score_80_first_quiz', progress: 0, targetValue: 1 },
    { id: 'streak_starter', title: 'Streak Starter', description: '3 day study streak', icon: 'Flame', category: 'streak', rarity: 'common', unlockedAt: null, condition: 'streak_3', progress: 0, targetValue: 3 },
    { id: 'on_fire', title: 'On Fire', description: '7 day study streak', icon: 'Flame', category: 'streak', rarity: 'rare', unlockedAt: null, condition: 'streak_7', progress: 0, targetValue: 7 },
    { id: 'unstoppable', title: 'Unstoppable', description: '30 day study streak', icon: 'Rocket', category: 'streak', rarity: 'legendary', unlockedAt: null, condition: 'streak_30', progress: 0, targetValue: 30 },
    { id: 'mind_mapper', title: 'Mind Mapper', description: 'Master 10 concepts', icon: 'Brain', category: 'mastery', rarity: 'rare', unlockedAt: null, condition: 'master_10_concepts', progress: 0, targetValue: 10 },
    { id: 'knowledge_base', title: 'Knowledge Base', description: 'Master 50 concepts', icon: 'Database', category: 'mastery', rarity: 'epic', unlockedAt: null, condition: 'master_50_concepts', progress: 0, targetValue: 50 },
    { id: 'note_taker', title: 'Note Taker', description: 'Create your first note', icon: 'Pencil', category: 'study', rarity: 'common', unlockedAt: null, condition: 'create_1_note', progress: 0, targetValue: 1 },
    { id: 'organized', title: 'Organized', description: 'Create 10 notes', icon: 'FolderOpen', category: 'study', rarity: 'rare', unlockedAt: null, condition: 'create_10_notes', progress: 0, targetValue: 10 },
    { id: 'marathon', title: 'Marathon', description: 'Study for 2 hours in one session', icon: 'Timer', category: 'study', rarity: 'epic', unlockedAt: null, condition: 'session_120_min', progress: 0, targetValue: 120 },
    { id: 'early_bird', title: 'Early Bird', description: 'Start a session before 8 AM', icon: 'Sunrise', category: 'streak', rarity: 'common', unlockedAt: null, condition: 'session_before_8am', progress: 0, targetValue: 1 },
  ];
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'landing',
  previousView: null,
  navigate: (view) => set((s) => {
    const filtered = s.recentViews.filter((v) => v !== view);
    const updatedRecent = ['landing', 'onboarding'].includes(view) ? s.recentViews : [view, ...filtered].slice(0, 3);
    return { currentView: view, previousView: s.currentView, recentViews: updatedRecent };
  }),
  userName: '',
  userEmail: '',
  userId: null,
  setUserId: (id) => set({ userId: id }),
  setUserInfo: (name, email) => set({ userName: name, userEmail: email }),
  onboardingComplete: false,
  setOnboardingComplete: (v) => set({ onboardingComplete: v }),
  learnerProfile: null,
  setLearnerProfile: (profile) => set({ learnerProfile: profile, onboardingComplete: true }),
  activeSessionId: null,
  activeCourseId: null,
  activeTopic: null,
  sessionPhase: 'discovery',
  setActiveSession: (sessionId, courseId, topic) => set({ activeSessionId: sessionId, activeCourseId: courseId ?? null, activeTopic: topic ?? null, sessionPhase: topic ? 'starter' : 'discovery', messages: [], masteryMap: {} }),
  setSessionPhase: (phase) => set({ sessionPhase: phase }),
  setActiveTopic: (topic) => set({ activeTopic: topic, sessionPhase: 'starter' }),
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
  masteryMap: {},
  updateMastery: (concept, level, evidence) => set((s) => ({
    masteryMap: {
      ...s.masteryMap,
      [concept]: { level, evidence: [...(s.masteryMap[concept]?.evidence || []), evidence], lastAssessed: Date.now(), attempts: (s.masteryMap[concept]?.attempts || 0) + 1 },
    },
  })),
  decisionState: { confusionScore: 0, masteryState: 'unknown', responseQuality: 5, cognitiveLoad: 'medium', motivation: 'medium' },
  updateDecisionState: (updates) => set((s) => ({ decisionState: { ...s.decisionState, ...updates } })),
  courses: [],
  setCourses: (courses) => set({ courses }),
  activeCourse: null,
  setActiveCourse: (course) => set({ activeCourse: course }),
  activeSlides: [],
  setActiveSlides: (slides) => set({ activeSlides: slides }),
  currentSlideIndex: 0,
  setCurrentSlideIndex: (i) => set({ currentSlideIndex: i }),
  activeSlideContent: null,
  setActiveSlideContent: (content) => set({ activeSlideContent: content }),
  currentQuestions: [],
  setCurrentQuestions: (q) => set({ currentQuestions: q }),
  quizScore: null,
  quizTotal: null,
  setQuizScore: (score, total) => {
    set({ quizScore: score, quizTotal: total });
    // Auto-update 'quiz_score' study goals
    if (total > 0) {
      const state = useAppStore.getState();
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - mondayOffset);
      const weekStartStr = monday.toISOString().split('T')[0];
      const pct = Math.round((score / total) * 100);
      state.studyGoals.forEach((g) => {
        if (g.type === 'quiz_score' && g.weekStart === weekStartStr) {
          useAppStore.getState().updateStudyGoal(g.id, { currentProgress: Math.max(g.currentProgress, pct) });
        }
      });
    }
  },
  tips: [],
  addTip: (tip) => set((s) => ({ tips: [...s.tips, tip] })),
  feedbackItems: [],
  addFeedbackItem: (item) => set((s) => ({ feedbackItems: [...s.feedbackItems, item] })),
  hardSubjects: [],
  setHardSubjects: (subjects) => set({ hardSubjects: subjects }),
  bestTeachingStyle: '',
  setBestTeachingStyle: (style) => set({ bestTeachingStyle: style }),
  alwaysConfuses: '',
  setAlwaysConfuses: (text) => set({ alwaysConfuses: text }),
  activePersona: 'storyteller',
  setActivePersona: (persona) => set({ activePersona: persona }),
  moodSettings: { energy: 50, formality: 50, patience: 70, humor: 30 },
  setMoodSettings: (settings) => set((s) => ({ moodSettings: { ...s.moodSettings, ...settings } })),
  tutorMode: 'hybrid',
  setTutorMode: (mode) => set({ tutorMode: mode }),
  notes: (() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('synapse-notes');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })(),
  addNote: (note) => set((s) => {
    const updated = [note, ...s.notes];
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-notes', JSON.stringify(updated));
    }
    return { notes: updated };
  }),
  updateNote: (id, updates) => set((s) => {
    const updated = s.notes.map((n) =>
      n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    );
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-notes', JSON.stringify(updated));
    }
    return { notes: updated };
  }),
  deleteNote: (id) => set((s) => {
    const updated = s.notes.filter((n) => n.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-notes', JSON.stringify(updated));
    }
    return { notes: updated };
  }),
  goals: (() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('synapse-goals');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })(),
  addGoal: (goal) => set((s) => {
    const updated = [...s.goals, goal];
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-goals', JSON.stringify(updated));
    }
    return { goals: updated };
  }),
  toggleGoalStatus: (id) => set((s) => {
    const cycle: Array<'pending' | 'in-progress' | 'done'> = ['pending', 'in-progress', 'done'];
    const updated = s.goals.map((g) => {
      if (g.id !== id) return g;
      const currentIdx = cycle.indexOf(g.status);
      const nextIdx = (currentIdx + 1) % cycle.length;
      return { ...g, status: cycle[nextIdx] };
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-goals', JSON.stringify(updated));
    }
    return { goals: updated };
  }),
  deleteGoal: (id) => set((s) => {
    const updated = s.goals.filter((g) => g.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-goals', JSON.stringify(updated));
    }
    return { goals: updated };
  }),
  reorderGoals: (fromIndex, toIndex) => set((s) => {
    const arr = [...s.goals];
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-goals', JSON.stringify(arr));
    }
    return { goals: arr };
  }),
  settings: (() => {
    if (typeof window === 'undefined') return {
      theme: 'system',
      compactMode: false,
      defaultPersona: 'storyteller',
      responseSpeed: 'balanced',
      language: 'English',
      defaultSessionDuration: 30,
      autoBreakReminders: true,
      dailyGoalHours: 2,
      sessionReminders: true,
      streakAlerts: true,
    };
    try {
      const stored = localStorage.getItem('synapse-settings');
      if (stored) {
        return { ...{
          theme: 'system',
          compactMode: false,
          defaultPersona: 'storyteller',
          responseSpeed: 'balanced',
          language: 'English',
          defaultSessionDuration: 30,
          autoBreakReminders: true,
          dailyGoalHours: 2,
          sessionReminders: true,
          streakAlerts: true,
        }, ...JSON.parse(stored) };
      }
      return {
        theme: 'system',
        compactMode: false,
        defaultPersona: 'storyteller',
        responseSpeed: 'balanced',
        language: 'English',
        defaultSessionDuration: 30,
        autoBreakReminders: true,
        dailyGoalHours: 2,
        sessionReminders: true,
        streakAlerts: true,
      };
    } catch {
      return {
        theme: 'system',
        compactMode: false,
        defaultPersona: 'storyteller',
        responseSpeed: 'balanced',
        language: 'English',
        defaultSessionDuration: 30,
        autoBreakReminders: true,
        dailyGoalHours: 2,
        sessionReminders: true,
        streakAlerts: true,
      };
    }
  })(),
  updateSettings: (updates) => set((s) => {
    const updated = { ...s.settings, ...updates };
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-settings', JSON.stringify(updated));
    }
    return { settings: updated };
  }),
  recentViews: [],
  addRecentView: (view) => set((s) => {
    const filtered = s.recentViews.filter((v) => v !== view);
    const updated = [view, ...filtered].slice(0, 3);
    return { recentViews: updated };
  }),
  // Achievements
  achievements: (() => {
    if (typeof window === 'undefined') return defaultAchievements();
    try {
      const stored = localStorage.getItem('synapse-achievements');
      if (stored) {
        const parsed = JSON.parse(stored) as Achievement[];
        return parsed.length === 15 ? parsed : defaultAchievements();
      }
      return defaultAchievements();
    } catch {
      return defaultAchievements();
    }
  })(),
  unlockAchievement: (id) => set((s) => {
    const now = new Date().toISOString();
    const updated = s.achievements.map((a) =>
      a.id === id && !a.unlockedAt ? { ...a, unlockedAt: now, progress: 100 } : a
    );
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-achievements', JSON.stringify(updated));
    }
    return { achievements: updated };
  }),
  checkAchievements: () => {
    const state = useAppStore.getState();
    const { studySessions, achievements, masteryMap, notes, quizScore, quizTotal } = state;
    const updates: Array<{ id: string; progress: number; unlockedAt: string | null }> = [];

    const totalSessions = studySessions.length;
    const totalNotes = notes.length;
    const masteredConcepts = Object.values(masteryMap).filter((c) => c.level >= 80).length;

    // Compute current streak from studySessions
    const sessionDates = [...new Set(studySessions.map((s) => new Date(s.date).toISOString().split('T')[0]))].sort().reverse();
    let streak = 0;
    if (sessionDates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const firstDate = sessionDates[0];
      if (firstDate === todayStr || firstDate === yesterdayStr) {
        streak = 1;
        for (let i = 1; i < sessionDates.length; i++) {
          const prev = new Date(sessionDates[i - 1]);
          const curr = new Date(sessionDates[i]);
          const diffDays = Math.floor((prev.getTime() - curr.getTime()) / 86400000);
          if (diffDays === 1) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    const bestSessionDuration = studySessions.reduce((max, s) => Math.max(max, s.duration), 0);
    const earlyBirdSessions = studySessions.filter((s) => {
      const h = new Date(s.date).getHours();
      return h < 8;
    }).length;

    // First Steps - Complete 1 session
    const a1 = achievements.find((a) => a.id === 'first_steps');
    const p1 = Math.min(100, (totalSessions / 1) * 100);
    if (a1 && (totalSessions >= 1 && !a1.unlockedAt)) {
      updates.push({ id: 'first_steps', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a1) {
      updates.push({ id: 'first_steps', progress: p1, unlockedAt: a1.unlockedAt });
    }

    // Bookworm - Complete 10 sessions
    const a2 = achievements.find((a) => a.id === 'bookworm');
    const p2 = Math.min(100, (totalSessions / 10) * 100);
    if (a2 && totalSessions >= 10 && !a2.unlockedAt) {
      updates.push({ id: 'bookworm', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a2) {
      updates.push({ id: 'bookworm', progress: p2, unlockedAt: a2.unlockedAt });
    }

    // Scholar - Complete 50 sessions
    const a3 = achievements.find((a) => a.id === 'scholar');
    const p3 = Math.min(100, (totalSessions / 50) * 100);
    if (a3 && totalSessions >= 50 && !a3.unlockedAt) {
      updates.push({ id: 'scholar', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a3) {
      updates.push({ id: 'scholar', progress: p3, unlockedAt: a3.unlockedAt });
    }

    // Perfect Score - Score 100% on any quiz
    const a4 = achievements.find((a) => a.id === 'perfect_score');
    if (a4 && quizScore !== null && quizTotal !== null && quizScore === quizTotal && !a4.unlockedAt) {
      updates.push({ id: 'perfect_score', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a4 && !a4.unlockedAt) {
      updates.push({ id: 'perfect_score', progress: 0, unlockedAt: null });
    }

    // Quiz Master - Complete 20 quizzes (count sessions with quiz-related topics or quizzes taken)
    const a5 = achievements.find((a) => a.id === 'quiz_master');
    const quizCount = studySessions.filter((s) => s.topic.toLowerCase().includes('quiz')).length;
    const p5 = Math.min(100, (quizCount / 20) * 100);
    if (a5 && quizCount >= 20 && !a5.unlockedAt) {
      updates.push({ id: 'quiz_master', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a5) {
      updates.push({ id: 'quiz_master', progress: p5, unlockedAt: a5.unlockedAt });
    }

    // Quick Learner - Score 80%+ on first quiz attempt
    const a6 = achievements.find((a) => a.id === 'quick_learner');
    if (a6 && quizScore !== null && quizTotal !== null && (quizScore / quizTotal) >= 0.8 && !a6.unlockedAt) {
      updates.push({ id: 'quick_learner', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a6 && !a6.unlockedAt) {
      updates.push({ id: 'quick_learner', progress: 0, unlockedAt: null });
    }

    // Streak Starter - 3 day streak
    const a7 = achievements.find((a) => a.id === 'streak_starter');
    const p7 = Math.min(100, (streak / 3) * 100);
    if (a7 && streak >= 3 && !a7.unlockedAt) {
      updates.push({ id: 'streak_starter', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a7) {
      updates.push({ id: 'streak_starter', progress: p7, unlockedAt: a7.unlockedAt });
    }

    // On Fire - 7 day streak
    const a8 = achievements.find((a) => a.id === 'on_fire');
    const p8 = Math.min(100, (streak / 7) * 100);
    if (a8 && streak >= 7 && !a8.unlockedAt) {
      updates.push({ id: 'on_fire', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a8) {
      updates.push({ id: 'on_fire', progress: p8, unlockedAt: a8.unlockedAt });
    }

    // Unstoppable - 30 day streak
    const a9 = achievements.find((a) => a.id === 'unstoppable');
    const p9 = Math.min(100, (streak / 30) * 100);
    if (a9 && streak >= 30 && !a9.unlockedAt) {
      updates.push({ id: 'unstoppable', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a9) {
      updates.push({ id: 'unstoppable', progress: p9, unlockedAt: a9.unlockedAt });
    }

    // Mind Mapper - Master 10 concepts
    const a10 = achievements.find((a) => a.id === 'mind_mapper');
    const p10 = Math.min(100, (masteredConcepts / 10) * 100);
    if (a10 && masteredConcepts >= 10 && !a10.unlockedAt) {
      updates.push({ id: 'mind_mapper', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a10) {
      updates.push({ id: 'mind_mapper', progress: p10, unlockedAt: a10.unlockedAt });
    }

    // Knowledge Base - Master 50 concepts
    const a11 = achievements.find((a) => a.id === 'knowledge_base');
    const p11 = Math.min(100, (masteredConcepts / 50) * 100);
    if (a11 && masteredConcepts >= 50 && !a11.unlockedAt) {
      updates.push({ id: 'knowledge_base', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a11) {
      updates.push({ id: 'knowledge_base', progress: p11, unlockedAt: a11.unlockedAt });
    }

    // Note Taker - Create first note
    const a12 = achievements.find((a) => a.id === 'note_taker');
    const p12 = Math.min(100, (totalNotes / 1) * 100);
    if (a12 && totalNotes >= 1 && !a12.unlockedAt) {
      updates.push({ id: 'note_taker', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a12) {
      updates.push({ id: 'note_taker', progress: p12, unlockedAt: a12.unlockedAt });
    }

    // Organized - Create 10 notes
    const a13 = achievements.find((a) => a.id === 'organized');
    const p13 = Math.min(100, (totalNotes / 10) * 100);
    if (a13 && totalNotes >= 10 && !a13.unlockedAt) {
      updates.push({ id: 'organized', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a13) {
      updates.push({ id: 'organized', progress: p13, unlockedAt: a13.unlockedAt });
    }

    // Marathon - Study 2 hours (120 min) in one session
    const a14 = achievements.find((a) => a.id === 'marathon');
    const p14 = Math.min(100, (bestSessionDuration / 120) * 100);
    if (a14 && bestSessionDuration >= 120 && !a14.unlockedAt) {
      updates.push({ id: 'marathon', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a14) {
      updates.push({ id: 'marathon', progress: p14, unlockedAt: a14.unlockedAt });
    }

    // Early Bird - Start a session before 8 AM
    const a15 = achievements.find((a) => a.id === 'early_bird');
    const p15 = Math.min(100, (earlyBirdSessions / 1) * 100);
    if (a15 && earlyBirdSessions >= 1 && !a15.unlockedAt) {
      updates.push({ id: 'early_bird', progress: 100, unlockedAt: new Date().toISOString() });
    } else if (a15) {
      updates.push({ id: 'early_bird', progress: p15, unlockedAt: a15.unlockedAt });
    }

    if (updates.length > 0) {
      const newAchievements = achievements.map((a) => {
        const u = updates.find((up) => up.id === a.id);
        return u ? { ...a, progress: u.progress, unlockedAt: u.unlockedAt ?? a.unlockedAt } : a;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('synapse-achievements', JSON.stringify(newAchievements));
      }
      set({ achievements: newAchievements });
    }
  },

  // Study Sessions
  studySessions: (() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('synapse-study-sessions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })(),
  addStudySession: (session) => set((s) => {
    const updated = [session, ...s.studySessions];
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-study-sessions', JSON.stringify(updated));
    }
    // Update streak in localStorage
    if (typeof window !== 'undefined') {
      const today = new Date().toISOString().split('T')[0];
      const streakData = localStorage.getItem('synapse-study-streak');
      let currentStreak = 1;
      if (streakData) {
        try {
          const parsed = JSON.parse(streakData) as { lastStudyDate: string; streak: number };
          const lastDate = parsed.lastStudyDate;
          const last = new Date(lastDate);
          const now = new Date(today);
          const diffDays = Math.floor((now.getTime() - last.getTime()) / 86400000);
          if (diffDays === 0) {
            currentStreak = parsed.streak;
          } else if (diffDays === 1) {
            currentStreak = parsed.streak + 1;
          }
        } catch {
          currentStreak = 1;
        }
      }
      localStorage.setItem('synapse-study-streak', JSON.stringify({ lastStudyDate: today, streak: currentStreak }));
      // Update best streak
      const bestData = localStorage.getItem('synapse-best-streak');
      let bestStreak = 0;
      if (bestData) {
        try { bestStreak = parseInt(bestData, 10); } catch { bestStreak = 0; }
      }
      if (currentStreak > bestStreak) {
        localStorage.setItem('synapse-best-streak', String(currentStreak));
      }
    }
    // Auto-increment 'sessions' study goals
    const state = useAppStore.getState();
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    const weekStartStr = monday.toISOString().split('T')[0];
    state.studyGoals.forEach((g) => {
      if (g.type === 'sessions' && g.weekStart === weekStartStr) {
        useAppStore.getState().updateStudyGoal(g.id, { currentProgress: g.currentProgress + 1 });
      }
      if (g.type === 'hours' && g.weekStart === weekStartStr) {
        useAppStore.getState().updateStudyGoal(g.id, { currentProgress: g.currentProgress + session.duration / 60 });
      }
    });
    // Check achievements after adding a session
    setTimeout(() => useAppStore.getState().checkAchievements(), 100);
    return { studySessions: updated };
  }),
  deleteStudySession: (id) => set((s) => {
    const updated = s.studySessions.filter((session) => session.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-study-sessions', JSON.stringify(updated));
    }
    return { studySessions: updated };
  }),

  // Study Goals
  studyGoals: (() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('synapse-study-goals');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })(),
  addStudyGoal: (goal) => set((s) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - mondayOffset);
    const weekStartStr = monday.toISOString().split('T')[0];
    const newGoal: StudyGoal = {
      ...goal,
      id: `study-goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      currentProgress: 0,
      createdAt: new Date().toISOString(),
      weekStart: weekStartStr,
    };
    const updated = [...s.studyGoals, newGoal];
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-study-goals', JSON.stringify(updated));
    }
    return { studyGoals: updated };
  }),
  updateStudyGoal: (id, updates) => set((s) => {
    const updated = s.studyGoals.map((g) => g.id === id ? { ...g, ...updates } : g);
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-study-goals', JSON.stringify(updated));
    }
    return { studyGoals: updated };
  }),
  deleteStudyGoal: (id) => set((s) => {
    const updated = s.studyGoals.filter((g) => g.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('synapse-study-goals', JSON.stringify(updated));
    }
    return { studyGoals: updated };
  }),

  // Viewed Slides & Course Completion
  viewedSlides: [],
  markSlideViewed: (slideId) => set((s) => {
    if (s.viewedSlides.includes(slideId)) return s;
    const updated = [...s.viewedSlides, slideId];
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('synapse-viewed-slides', JSON.stringify(updated)); } catch { /* ignore */ }
    }
    return { viewedSlides: updated };
  }),
  isSlideViewed: (slideId) => {
    return useAppStore.getState().viewedSlides.includes(slideId);
  },
  completedCourses: [],
  completeCourse: (courseId) => set((s) => {
    if (s.completedCourses.includes(courseId)) return s;
    const updated = [...s.completedCourses, courseId];
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('synapse-completed-courses', JSON.stringify(updated)); } catch { /* ignore */ }
    }
    return { completedCourses: updated };
  }),

  // Course Categories
  courseCategories: (() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem('synapse-course-categories');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  })(),
  setCourseCategory: (courseId, category) => set((s) => {
    const updated = { ...s.courseCategories, [courseId]: category };
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('synapse-course-categories', JSON.stringify(updated)); } catch { /* ignore */ }
    }
    return { courseCategories: updated };
  }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  // Daily Challenge
  dailyChallenge: {
    lastCompletedDate: null,
    streak: 0,
    bestScore: 0,
    totalCompleted: 0,
    todayResults: null,
  },
  setDailyChallenge: (data) => set((s) => ({ dailyChallenge: { ...s.dailyChallenge, ...data } })),
  resetDailyStreak: () => set({ dailyChallenge: { lastCompletedDate: null, streak: 0, bestScore: 0, totalCompleted: 0, todayResults: null } }),

  // Notifications
  notifications: [],
  addNotification: (n) => set((s) => ({
    notifications: [
      {
        ...n,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...s.notifications,
    ].slice(0, 50),
  })),
  markNotificationRead: (id) => set((s) => ({
    notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
  })),
  clearAllNotifications: () => set({ notifications: [] }),

  // Adaptive Results
  adaptiveResults: [],
  addAdaptiveResult: (result) => set((s) => ({
    adaptiveResults: [...s.adaptiveResults, result].slice(-200),
  })),
  clearAdaptiveResults: () => set({ adaptiveResults: [] }),
}));