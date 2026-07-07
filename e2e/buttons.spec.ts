import { test, expect, Page } from '@playwright/test';
import { gotoApp, navTo, trackErrors, assertNoErrors, VIEWS } from './helpers';

interface ButtonAudit {
  name: string;
  className: string;
  height: number;
  textLines: number;
  lineHeight: number;
  fontSize: number;
  pointerEvents: string;
  disabled: boolean;
  multiLineByDesign: boolean;
}

/** Audit every visible button on the current view: accessible name, label wrap, pointer-events. */
async function auditVisibleButtons(page: Page): Promise<ButtonAudit[]> {
  return page.evaluate(() => {
    // Count distinct rendered line boxes of the element's text content.
    function textLineCount(el: Element): number {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1);
      range.detach();
      const tops: number[] = [];
      for (const r of rects) {
        if (!tops.some((t) => Math.abs(t - r.top) < r.height * 0.6)) tops.push(r.top);
      }
      return tops.length;
    }

    const results: ButtonAudit[] = [];
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], a[href]')
    );
    for (const btn of buttons) {
      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(btn);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0)
        continue;

      const name = (
        btn.getAttribute('aria-label') ||
        btn.textContent ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();

      const fontSize = parseFloat(style.fontSize);
      const lineHeight =
        style.lineHeight === 'normal' ? fontSize * 1.5 : parseFloat(style.lineHeight);

      // Buttons that intentionally stack multiple text blocks (cards acting as buttons)
      // are excluded from the single-line wrap check.
      const blockChildren = Array.from(btn.children).filter((c) => {
        const d = getComputedStyle(c).display;
        return d === 'block' || d === 'flex' || d === 'grid';
      });
      const multiLineByDesign =
        blockChildren.length > 1 ||
        btn.querySelector('p, h1, h2, h3, h4') !== null ||
        // Card-style buttons that stack their content vertically on purpose.
        style.flexDirection === 'column';

      results.push({
        name,
        className: typeof btn.className === 'string' ? btn.className.slice(0, 80) : '',
        height: rect.height,
        textLines: btn.textContent?.trim() ? textLineCount(btn) : 0,
        lineHeight,
        fontSize,
        pointerEvents: style.pointerEvents,
        disabled: (btn as HTMLButtonElement).disabled === true,
        multiLineByDesign,
      });
    }
    return results;
  });
}

/** Interactive elements must never nest inside each other (hydration + a11y bug). */
async function findNestedInteractive(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const offenders: string[] = [];
    const sel = 'button button, button a[href], a[href] button, a[href] a[href], button [role="button"]';
    document.querySelectorAll(sel).forEach((el) => {
      const parent = el.closest(
        el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' ? 'a[href], button' : 'button, a[href]'
      );
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60);
      const parentLabel = (parent?.getAttribute('aria-label') || parent?.textContent || '')
        .trim()
        .slice(0, 60);
      offenders.push(`<${el.tagName.toLowerCase()}> "${label}" nested inside "${parentLabel}"`);
    });
    return offenders;
  });
}

test.describe('Button audit across all views', () => {
  test('every visible button has an accessible name, no wrapped labels, no pointer-events traps, no nested interactives', async ({
    page,
  }) => {
    const log = trackErrors(page);
    await gotoApp(page);

    const problems: string[] = [];

    for (const v of VIEWS) {
      await navTo(page, v.label, v.marker, v.level);

      const audits = await auditVisibleButtons(page);
      for (const a of audits) {
        if (!a.name) {
          problems.push(`[${v.label}] button with no accessible name (class="${a.className}")`);
        }
        if (!a.multiLineByDesign && a.textLines > 1) {
          problems.push(
            `[${v.label}] "${a.name}" label wraps to ${a.textLines} lines (height ${a.height.toFixed(0)}px, class="${a.className}")`
          );
        }
        // Disabled shadcn buttons intentionally get disabled:pointer-events-none.
        if (a.pointerEvents === 'none' && !a.disabled) {
          problems.push(
            `[${v.label}] "${a.name}" has pointer-events: none — unclickable (class="${a.className}")`
          );
        }
      }

      const nested = await findNestedInteractive(page);
      for (const n of nested) {
        problems.push(`[${v.label}] NESTED INTERACTIVE: ${n}`);
      }
    }

    expect(problems, `Button audit failures:\n${problems.join('\n')}`).toHaveLength(0);
    assertNoErrors(log, 'button audit');
  });
});

test.describe('Button click sweep', () => {
  for (const v of VIEWS) {
    test(`clicking visible buttons on "${v.label}" throws no page errors`, async ({ page }) => {
      const log = trackErrors(page);
      await gotoApp(page);
      await navTo(page, v.label, v.marker, v.level);

      const unclickable: string[] = [];
      const MAX_BUTTONS = 40;
      const buttons = page.locator('main button:visible');
      const total = Math.min(await buttons.count(), MAX_BUTTONS);

      for (let i = 0; i < total; i++) {
        // Re-query each iteration; clicking can re-render the view.
        const current = page.locator('main button:visible');
        if ((await current.count()) <= i) break;
        const btn = current.nth(i);
        const name = ((await btn.getAttribute('aria-label')) || (await btn.textContent()) || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60);

        // Skip destructive actions so the sweep does not wipe app state.
        if (/delete|remove|clear|reset|sign out|log ?out/i.test(name)) continue;
        if (await btn.isDisabled().catch(() => true)) continue;

        try {
          await btn.click({ timeout: 2500 });
        } catch {
          // Many elements sit inside infinite framer-motion animations, so Playwright's
          // stability check can time out on perfectly clickable buttons. Re-resolve and
          // fall back to a force click (still dispatches the handler); only report if
          // the button still exists and even the force click fails.
          try {
            const retry = page.locator('main button:visible').nth(i);
            if ((await page.locator('main button:visible').count()) > i) {
              await retry.click({ timeout: 2000, force: true });
            }
            // If the button vanished, its click already re-rendered the UI — not a bug.
          } catch {
            unclickable.push(`[${v.label}] could not click "${name}" (detached or hidden)`);
          }
        }

        // Close any dialog/overlay the click opened.
        await page.keyboard.press('Escape');

        // If the click navigated away, come back. Some buttons leave the app shell
        // entirely (e.g. restart onboarding), so recover via a full reload if needed.
        const stillHere = await page
          .locator('main')
          .getByRole('heading', { name: v.marker, level: v.level })
          .first()
          .isVisible()
          .catch(() => false);
        if (!stillHere) {
          const sidebarVisible = await page
            .locator('aside nav')
            .isVisible()
            .catch(() => false);
          if (!sidebarVisible) {
            await gotoApp(page);
          }
          await navTo(page, v.label, v.marker, v.level);
        }
      }

      // Unclickable buttons are reported softly; page errors fail hard.
      expect.soft(unclickable, unclickable.join('\n')).toHaveLength(0);
      assertNoErrors(log, `click sweep on ${v.label}`);
    });
  }
});
