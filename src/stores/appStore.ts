import { create } from 'zustand';
import type { AppView, LearnerProfile, MasteryMap, DecisionLoopState, ChatMessage, Course, Slide, Question, UserTip, UserFeedback, Note, Goal, AppSettings } from '@/types';

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

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
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
  setQuizScore: (score, total) => set({ quizScore: score, quizTotal: total }),
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
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
}));