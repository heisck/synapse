import { test, expect } from '@playwright/test';
import { gotoApp, navTo, trackErrors, assertNoErrors, VIEWS, sidebarNav } from './helpers';

test.describe('Landing and onboarding', () => {
  test('landing page renders and CTA starts onboarding', async ({ page }) => {
    const log = trackErrors(page);
    await page.goto('/');

    const cta = page.getByRole('button', { name: /start learning/i }).first();
    await expect(cta).toBeVisible({ timeout: 30_000 });

    await cta.click();
    await expect(
      page.getByRole('heading', { name: /welcome to synapselearn/i })
    ).toBeVisible({ timeout: 15_000 });

    // Quick Start should drop the user straight onto the dashboard shell.
    await page.getByRole('button', { name: /quick start/i }).click();
    await expect(page.locator('aside nav')).toBeVisible({ timeout: 15_000 });

    assertNoErrors(log, 'landing/onboarding');
  });
});

test.describe('Sidebar navigation', () => {
  test('each nav item renders its own view and only that view', async ({ page }) => {
    const log = trackErrors(page);
    await gotoApp(page);

    for (const v of VIEWS) {
      await navTo(page, v.label, v.marker, v.level);

      // The clicked nav item must be the active one.
      const activeItem = sidebarNav(page)
        .getByRole('button', { name: new RegExp(`^${v.label}`) })
        .first();
      await expect(activeItem, `${v.label} should be aria-current after click`).toHaveAttribute(
        'aria-current',
        'page'
      );

      // No OTHER view's unique marker heading may be visible.
      for (const other of VIEWS) {
        if (other.view === v.view) continue;
        const strayCount = await page
          .locator('main')
          .getByRole('heading', { name: other.marker, level: other.level })
          .count();
        expect
          .soft(strayCount, `On "${v.label}" view, marker for "${other.label}" should not render`)
          .toBe(0);
      }
    }

    assertNoErrors(log, 'sidebar navigation');
  });
});
