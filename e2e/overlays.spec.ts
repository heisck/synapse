import { test, expect } from '@playwright/test';
import { gotoApp, trackErrors, assertNoErrors } from './helpers';

test.describe('Keyboard shortcuts dialog', () => {
  test('floating ? button opens a legible dialog that closes on Escape', async ({ page }) => {
    const log = trackErrors(page);
    await gotoApp(page);

    const helpBtn = page.getByRole('button', { name: 'Keyboard shortcuts' });
    await expect(helpBtn).toBeVisible();
    await helpBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Keyboard Shortcuts')).toBeVisible();
    await expect(dialog.getByText('Navigation', { exact: true })).toBeVisible();

    // Legibility: the dialog must not be transparent.
    // Poll: the dialog animates from opacity 0, give the entrance animation time to finish.
    await expect
      .poll(
        async () => dialog.evaluate((el) => parseFloat(getComputedStyle(el).opacity)),
        { timeout: 5000, message: 'shortcuts dialog should settle at full opacity' }
      )
      .toBeGreaterThan(0.9);
    const { textColor, hasSize } = await dialog.evaluate((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { textColor: s.color, hasSize: r.width > 200 && r.height > 200 };
    });
    expect(hasSize).toBe(true);
    expect(textColor).not.toBe('rgba(0, 0, 0, 0)');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5000 });

    assertNoErrors(log, 'keyboard shortcuts dialog');
  });
});

test.describe('Notification bell', () => {
  test('top-right bell opens a legible dropdown that closes on outside click', async ({ page }) => {
    const log = trackErrors(page);
    await gotoApp(page);

    const bell = page.locator('main').getByRole('button', { name: /^Notifications/ });
    await expect(bell).toBeVisible();
    await bell.click();

    const dropdown = page.locator('main').getByRole('heading', { name: 'Notifications' });
    await expect(dropdown).toBeVisible({ timeout: 5000 });

    // Legibility check on the dropdown panel (nearest glass ancestor of the heading).
    // Poll: the panel animates from opacity 0, so give the entrance animation time to finish.
    const panel = dropdown.locator('xpath=ancestor::div[contains(@class, "glass")][1]');
    await expect
      .poll(
        async () => panel.evaluate((el) => parseFloat(getComputedStyle(el).opacity)),
        { timeout: 5000, message: 'bell dropdown should settle at full opacity' }
      )
      .toBeGreaterThan(0.9);
    const bg = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, 'bell dropdown panel must have a non-transparent background').not.toBe(
      'rgba(0, 0, 0, 0)'
    );

    // Outside click closes it.
    await page.mouse.click(400, 500);
    await expect(dropdown).toBeHidden({ timeout: 5000 });

    assertNoErrors(log, 'notification bell');
  });
});
