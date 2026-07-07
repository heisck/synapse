import { Page, expect } from '@playwright/test';

export interface ErrorLog {
  consoleErrors: string[];
  pageErrors: string[];
}

/** Console noise that is environmental, not an app bug. */
const IGNORED_CONSOLE = [
  /Failed to load resource/i, // network-level 404/500 lines (API state, favicons)
  /Download the React DevTools/i,
  /net::ERR_/i,
  /\[Fast Refresh\]/i,
  /preloaded using link preload/i,
];

export function trackErrors(page: Page): ErrorLog {
  const log: ErrorLog = { consoleErrors: [], pageErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    log.consoleErrors.push(text);
  });
  page.on('pageerror', (err) => log.pageErrors.push(String(err)));
  return log;
}

export function assertNoErrors(log: ErrorLog, context: string) {
  const hydration = [...log.consoleErrors, ...log.pageErrors].filter((t) =>
    /cannot be a descendant of|cannot contain a nested|Hydration failed|hydration/i.test(t)
  );
  expect
    .soft(hydration, `${context}: hydration/nesting errors found:\n${hydration.join('\n---\n')}`)
    .toHaveLength(0);
  expect(
    log.pageErrors,
    `${context}: uncaught page errors:\n${log.pageErrors.join('\n---\n')}`
  ).toHaveLength(0);
  expect(
    log.consoleErrors,
    `${context}: console errors:\n${log.consoleErrors.join('\n---\n')}`
  ).toHaveLength(0);
}

/**
 * Each main view with its sidebar label and a marker that uniquely identifies its content.
 * Markers are pinned to a heading LEVEL because dashboard widgets reuse names like
 * "My Courses" / "Focus Timer" / "Spaced Review" at the h3 level.
 */
export const VIEWS: Array<{
  label: string;
  view: string;
  /** Regex matched against headings of `level` inside <main> (undefined = any level). */
  marker: RegExp;
  level?: number;
}> = [
  { label: 'Dashboard', view: 'dashboard', marker: /^Good (morning|afternoon|evening)/, level: 1 },
  { label: 'My Courses', view: 'courses', marker: /^My Courses$/, level: 1 },
  { label: 'Upload Slides', view: 'upload', marker: /^Upload Slides$/, level: 1 },
  { label: 'Tutor', view: 'tutor', marker: /^AI Tutor$/, level: 1 },
  // Quiz renders "No questions available" as an h2 on a fresh DB, mode titles as h1.
  { label: 'Quiz Mode', view: 'quiz', marker: /Quiz Practice|Flashcard Study|Daily Challenge|No questions available/ },
  { label: 'Notes', view: 'notes', marker: /^Notes$/, level: 1 },
  { label: 'Focus Timer', view: 'focus-timer', marker: /^Focus Timer$/, level: 1 },
  { label: 'Profile', view: 'profile', marker: /^Learning Profile$/, level: 2 },
  { label: 'Settings', view: 'settings', marker: /^Settings$/, level: 1 },
  { label: 'Leaderboard', view: 'leaderboard', marker: /^Leaderboard$/, level: 1 },
];

/** Load the app and jump past landing/onboarding straight into the dashboard shell. */
export async function gotoApp(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  // Landing renders first on a fresh load.
  await expect(page.getByRole('button', { name: /start learning/i }).first()).toBeVisible({
    timeout: 30_000,
  });
  // Global keyboard shortcut Ctrl+1 navigates to the dashboard from anywhere.
  await page.keyboard.press('Control+1');
  await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('aside nav')).toBeVisible();
}

export function sidebarNav(page: Page) {
  return page.locator('aside nav');
}

export async function navTo(page: Page, label: string, marker: RegExp, level?: number) {
  // Non-exact: some nav items append badge text (e.g. the Quiz Mode countdown).
  await sidebarNav(page)
    .getByRole('button', { name: new RegExp(`^${label}`) })
    .first()
    .click();
  await expect(
    page.locator('main').getByRole('heading', { name: marker, level }).first()
  ).toBeVisible({ timeout: 15_000 });
  // Let the framer-motion view transition settle.
  await page.waitForTimeout(450);
}
