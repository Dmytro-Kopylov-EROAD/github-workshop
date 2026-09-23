// Verifies the persistent high-contrast preference and its accessible control.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const storageKey = 'tailspin-high-contrast';

test.describe('High contrast mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('toggles the contrast presentation and exposes its state', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'High contrast' });

    await test.step('Verify the default preference is off', async () => {
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('contrast-status')).toHaveText('Off');
      await expect(page.locator('html')).not.toHaveClass(/high-contrast/);
    });

    await test.step('Enable high contrast mode', async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('contrast-status')).toHaveText('On');
      await expect(page.locator('html')).toHaveClass(/high-contrast/);
      await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('true');
    });
  });

  test('persists the preference across reloads and navigation', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'High contrast' });

    await test.step('Enable the preference and reload', async () => {
      await toggle.click();
      await page.reload();
      await expect(page.locator('html')).toHaveClass(/high-contrast/);
      await expect(page.getByRole('button', { name: 'High contrast' })).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('Navigate to another page', async () => {
      await page.getByTestId('menu-toggle').click();
      await page.getByTestId('nav-about').click();
      await expect(page).toHaveURL('/about');
      await expect(page.locator('html')).toHaveClass(/high-contrast/);
      await expect(page.getByRole('button', { name: 'High contrast' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test('supports keyboard operation and disabling the stored preference', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'High contrast' });

    await test.step('Toggle on with the keyboard', async () => {
      await toggle.focus();
      await expect(toggle).toBeFocused();
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('Toggle off with the keyboard', async () => {
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('html')).not.toHaveClass(/high-contrast/);
      await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('false');
    });
  });

  test('provides keyboard access to the main content and contrast control', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    const toggle = page.getByRole('button', { name: 'High contrast' });

    await test.step('Use the skip link to focus the main landmark', async () => {
      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main')).toBeFocused();
    });

    await test.step('Verify the contrast control meets the minimum touch target', async () => {
      const box = await toggle.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    });
  });

  test('applies a saved preference before page content is inspected', async ({ page }) => {
    await page.evaluate((key) => localStorage.setItem(key, 'true'), storageKey);
    await page.goto('/game/1');

    await expect(page.locator('html')).toHaveClass(/high-contrast/);
    await expect(page.getByRole('button', { name: 'High contrast' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('game-details')).toBeVisible();
  });

  test('has no WCAG 2.1 AA violations on site pages while enabled', async ({ page }) => {
    await page.getByRole('button', { name: 'High contrast' }).click();

    for (const path of ['/', '/about', '/game/1', '/missing-page']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveClass(/high-contrast/);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(accessibilityScanResults.violations, `Accessibility violations found on ${path}`).toEqual([]);
    }
  });
});
