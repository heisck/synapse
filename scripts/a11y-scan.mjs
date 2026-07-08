// One-off accessibility scan: drives the real app with Playwright (same
// helpers as e2e/) and runs axe-core on every main view. Bypasses webhint's
// broken puppeteer-connector integration entirely.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = (await import('node:module')).createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const VIEWS = [
  { label: 'Dashboard', marker: /^Good (morning|afternoon|evening)/, level: 1 },
  { label: 'My Courses', marker: /^My Courses$/, level: 1 },
  { label: 'Upload Slides', marker: /^Upload Slides$/, level: 1 },
  { label: 'Tutor', marker: /^AI Tutor$/, level: 1 },
  { label: 'Quiz Mode', marker: /Quiz Practice|Flashcard Study|Daily Challenge|No questions available/ },
  { label: 'Notes', marker: /^Notes$/, level: 1 },
  { label: 'Focus Timer', marker: /^Focus Timer$/, level: 1 },
  { label: 'Profile', marker: /^Learning Profile$/, level: 2 },
  { label: 'Settings', marker: /^Settings$/, level: 1 },
  { label: 'Leaderboard', marker: /^Leaderboard$/, level: 1 },
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function gotoApp(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: /start learning/i }).first().waitFor({ timeout: 30_000 });
  await page.keyboard.press('Control+1');
  await page.locator('main').waitFor({ timeout: 20_000 });
  await page.locator('aside nav').waitFor({ timeout: 20_000 });
}

async function navTo(page, label, marker, level) {
  await page.locator('aside nav').getByRole('button', { name: new RegExp(`^${label}`) }).first().click();
  await page.locator('main').getByRole('heading', { name: marker, level }).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(450);
}

async function runAxe(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const result = await axe.run(document, {
      resultTypes: ['violations'],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, failureSummary: n.failureSummary })),
    }));
  });
}

const report = {};

const browser = await chromium.launch();
const page = await browser.newPage();

console.log(`Scanning ${BASE_URL} ...`);
await gotoApp(page);
report['Dashboard'] = await runAxe(page);
console.log(`Dashboard: ${report['Dashboard'].length} violation groups`);

for (const v of VIEWS.slice(1)) {
  try {
    await navTo(page, v.label, v.marker, v.level);
    report[v.label] = await runAxe(page);
    console.log(`${v.label}: ${report[v.label].length} violation groups`);
  } catch (e) {
    report[v.label] = [{ id: 'nav-error', impact: 'n/a', help: String(e), nodes: [] }];
    console.log(`${v.label}: FAILED TO NAVIGATE — ${e.message.split('\n')[0]}`);
  }
}

await browser.close();

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'a11y-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`\nFull report written to ${outPath}`);
