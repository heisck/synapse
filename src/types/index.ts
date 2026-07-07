export type AppView =
  | 'landing'
  | 'dashboard'
  | 'tutor'
  | 'upload'
  | 'quiz'
  | 'onboarding'
  | 'profile'
  | 'course-detail'
  | 'notes'
  | 'focus-timer'
  | 'settings';

export interface LearnerProfile {
  learningStyle: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
  pace: 'slow' | 'steady' | 'fast';
  vocabularySensitive: boolean;
  prefersStory: boolean;
  prefersBigPicture: boolean;
  simpleGrammar: boolean;
  jargonTolerance: 'low' | 'medium' | 'high';
  masteryApproach: 'evidence' | 'self-reported';
}

export interface MasteryMap {
  [concept: string]: {
    level: number;
    evidence: string[];
    lastAssessed: number;
    attempts: number;
  };
}

export interface DecisionLoopState {
  confusionScore: number;
  masteryState: 'unknown' | 'emerging' | 'developing' | 'proficient' | 'mastered';
  responseQuality: number;
  cognitiveLoad: 'low' | 'medium' | 'high';
  motivation: 'low' | 'medium' | 'high';
}

export interface ErrorClassification {
  type: 'misconception' | 'partial' | 'vocabulary' | 'careless' | 'gap';
  severity: 'low' | 'medium' | 'high';
  pattern: string;
  remediation: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  thumbnail?: string;
  slides?: Slide[];
  _count?: { slides: number; enrollments: number; sessions: number };
  createdAt: string;
  updatedAt: string;
}

export interface Slide {
  id: string;
  courseId: string;
  title: string;
  content: string;
  order: number;
  createdAt: string;
}

export interface Question {
  id: string;
  courseId?: string;
  slideId?: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank' | 'matching' | 'error_correction';
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  concept?: string;
  matchingPairs?: Array<{ left: string; right: string }>;
  errorText?: string;
}

export interface UserTip {
  id: string;
  content: string;
  category: string;
  createdAt: string;
}

export interface UserFeedback {
  id: string;
  type: 'like' | 'dislike' | 'confused' | 'too_fast' | 'too_slow';
  message?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface Goal {
  id: string;
  text: string;
  status: 'pending' | 'in-progress' | 'done';
  createdAt: string;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  defaultPersona: string;
  responseSpeed: 'concise' | 'balanced' | 'detailed';
  language: string;
  defaultSessionDuration: number;
  autoBreakReminders: boolean;
  dailyGoalHours: number;
  sessionReminders: boolean;
  streakAlerts: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  category: 'study' | 'quiz' | 'streak' | 'social' | 'mastery';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: string | null; // null = locked
  condition: string; // e.g., "complete_5_sessions", "score_100_quiz", "streak_7"
  progress: number; // 0-100
  targetValue: number;
}

export interface StudySession {
  id: string;
  date: string; // ISO date
  duration: number; // minutes
  topic: string;
  messagesCount: number;
  masteryGained: number;
}

export interface StudyGoal {
  id: string;
  type: 'sessions' | 'quiz_score' | 'hours' | 'reviews';
  label: string;
  target: number;
  currentProgress: number;
  createdAt: string;
  weekStart: string; // YYYY-MM-DD of the Monday of the current week
}

export interface StudyNotification {
  id: string;
  type: 'reminder' | 'achievement' | 'streak' | 'goal' | 'review' | 'tip';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionLabel?: string;
  actionView?: AppView;
}

export interface AdaptiveResult {
  concept: string;
  correct: boolean;
  difficulty: string;
  timestamp: number;
}