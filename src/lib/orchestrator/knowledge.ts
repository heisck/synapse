/**
 * System Knowledge Pack (UNIFIED-PLAN task 34, req D27).
 *
 * The orchestrator's map of the application: every page, feature, and workflow
 * it can route the learner through, plus the tool directives it may emit.
 * Loaded at orchestrator init (imported by /api/orchestrate) and injected into
 * routing prompts so a fresh model call always knows what this app can do.
 *
 * Keep entries SHORT — this rides inside prompts. When views are added or
 * renamed, update here; the full-audit phase (task 46) greps view names
 * against this file so drift is caught.
 */

export interface KnowledgeEntry {
  id: string;
  kind: 'page' | 'feature' | 'workflow';
  description: string;
}

export const APP_KNOWLEDGE: KnowledgeEntry[] = [
  // Pages (navigate targets)
  { id: 'dashboard', kind: 'page', description: 'Home: stats, streak, resume course, daily challenge, quick actions.' },
  { id: 'courses', kind: 'page', description: 'My Courses: every uploaded course; open one to study or take a quiz.' },
  { id: 'tutor', kind: 'page', description: 'Tutor Mode: chat with the AI tutor beside the course slides (text/slide/hybrid/cards layouts).' },
  { id: 'quiz', kind: 'page', description: 'Quiz Practice: question practice, flashcards, daily challenge, spaced review, fullscreen exam mode.' },
  { id: 'upload', kind: 'page', description: 'Upload Slides: PDF/PPTX/DOCX/ODP/ODT/EPUB/HTML/TXT/MD/RTF/CSV/images; builds courses + structured document.' },
  { id: 'notes', kind: 'page', description: 'Notes: saved notes, AI responses saved as notes.' },
  { id: 'focus-timer', kind: 'page', description: 'Focus: pomodoro-style focus sessions and focus statistics.' },
  { id: 'profile', kind: 'page', description: 'Profile: learning statistics, achievements, share progress.' },
  { id: 'leaderboard', kind: 'page', description: 'Leaderboard: opt-in anonymous ranking of learners.' },
  { id: 'settings', kind: 'page', description: 'Settings: OpenRouter API key (AI Access), BYO storage, appearance, personas, study preferences.' },

  // Features the orchestrator can lean on
  { id: 'question-bank', kind: 'feature', description: 'Per-course/per-slide question bank filled silently in the background; exam pulls unused questions first.' },
  { id: 'inline-quiz', kind: 'feature', description: 'Tutor chat can embed an interactive quiz/flashcard card (```quiz fenced JSON); mode "exam" auto-opens the quiz page.' },
  { id: 'slide-advance-coach', kind: 'feature', description: 'Code-driven suggestion to advance to the next slide after enough time/interaction.' },
  { id: 'break-timer', kind: 'feature', description: 'Break suggested after ~45 min connected; fullscreen countdown that survives restarts.' },
  { id: 'structured-doc', kind: 'feature', description: 'Every upload is normalized: pages classified (title/objectives/summary/references/learning), compact teaching-only sequence, stable block IDs.' },
  { id: 'alus', kind: 'feature', description: 'Atomic Learning Units per learning page (definition/explanation/example/formula/practice) via /api/alu.' },
  { id: 'personas', kind: 'feature', description: 'Tutor voices: professor, coach, friend, storyteller, relator — plus mood sliders.' },

  // Workflows (multi-step paths the orchestrator may propose)
  { id: 'upload-then-study', kind: 'workflow', description: 'Upload material → course created → Start Tutor (study) or Take Quiz (practice).' },
  { id: 'study-then-quiz', kind: 'workflow', description: 'Study a slide in Tutor → bank fills in background → "test me" → exam-mode quiz on that slide.' },
  { id: 'review-weak-areas', kind: 'workflow', description: 'Spaced review tab surfaces overdue concepts; quiz results feed mastery tracking.' },
];

/** Compact one-line-per-entry block for routing prompts. */
export function knowledgeBlock(kinds: Array<KnowledgeEntry['kind']> = ['page', 'feature', 'workflow']): string {
  return APP_KNOWLEDGE.filter((e) => kinds.includes(e.kind))
    .map((e) => `- [${e.kind}] ${e.id}: ${e.description}`)
    .join('\n');
}
