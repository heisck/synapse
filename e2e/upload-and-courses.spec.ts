import { test, expect } from '@playwright/test';
import { gotoApp, navTo, trackErrors, assertNoErrors } from './helpers';

test.describe('Upload flow', () => {
  test('drop-zone is clickable and opens the file chooser', async ({ page }) => {
    const log = trackErrors(page);
    await gotoApp(page);
    await navTo(page, 'Upload Slides', /^Upload Slides$/);

    const dropZone = page.locator('main div.border-dashed').first();
    await expect(dropZone).toBeVisible();
    await expect(dropZone).toContainText(/drag & drop/i);

    // Regression check: the interactive drop-zone must not have pointer-events: none.
    const pe = await dropZone.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe, 'drop-zone computed pointer-events must not be none').not.toBe('none');
    const cursor = await dropZone.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');

    // Hidden file input exists and accepts the right types.
    const fileInput = page.locator('main input[type="file"]');
    await expect(fileInput).toHaveCount(1);
    await expect(fileInput).toHaveAttribute('accept', /\.pptx/);
    await expect(fileInput).toHaveAttribute('multiple', '');

    // Clicking the drop-zone must open the native file chooser (click-to-open wiring).
    const chooserPromise = page.waitForEvent('filechooser', { timeout: 10_000 });
    await dropZone.click({ position: { x: 200, y: 140 } });
    const chooser = await chooserPromise;
    expect(chooser.isMultiple()).toBe(true);

    assertNoErrors(log, 'upload flow');
  });
});

test.describe('My Courses', () => {
  test('shows course cards or a sensible empty state whose CTA navigates to upload', async ({
    page,
  }) => {
    const log = trackErrors(page);
    await gotoApp(page);
    await navTo(page, 'My Courses', /^My Courses$/);

    const emptyState = page.locator('main').getByText('No courses yet');
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    if (hasEmpty) {
      const cta = page.locator('main').getByRole('button', { name: /upload slides/i }).first();
      await expect(cta).toBeVisible();
      await cta.click();
      await expect(
        page.locator('main').getByRole('heading', { name: /^Upload Slides$/ })
      ).toBeVisible({ timeout: 15_000 });
    } else {
      // At least one course card should render with an accessible name.
      const headings = page.locator('main').getByRole('heading');
      expect(await headings.count()).toBeGreaterThan(0);
    }

    assertNoErrors(log, 'my courses');
  });
});
