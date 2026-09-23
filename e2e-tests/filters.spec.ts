import { test, expect } from '@playwright/test';

test.describe('Game Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('games-grid')).toBeVisible();
  });

  test('should display filter controls with categories and publishers', async ({ page }) => {
    await test.step('Verify filter groups are visible', async () => {
      await expect(page.getByTestId('game-filters')).toBeVisible();
      await expect(page.getByTestId('category-filter-group')).toBeVisible();
      await expect(page.getByTestId('publisher-filter-group')).toBeVisible();
    });

    await test.step('Verify at least one checkbox is rendered per group', async () => {
      const categoryCheckboxes = page.getByTestId('category-filter-group').getByRole('checkbox');
      const publisherCheckboxes = page.getByTestId('publisher-filter-group').getByRole('checkbox');
      expect(await categoryCheckboxes.count()).toBeGreaterThan(0);
      expect(await publisherCheckboxes.count()).toBeGreaterThan(0);
    });
  });

  test('should filter the games grid by a single category', async ({ page }) => {
    const totalCount = await page.getByTestId('game-card').count();
    const firstCategoryCheckbox = page.getByTestId('category-filter-group').getByRole('checkbox').first();
    const categoryId = await firstCategoryCheckbox.getAttribute('data-filter-id');

    await test.step('Check a single category filter', async () => {
      await firstCategoryCheckbox.check();
    });

    await test.step('Verify only matching cards remain visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).not.toHaveCount(totalCount);
      const count = await visibleCards.count();
      for (let i = 0; i < count; i++) {
        await expect(visibleCards.nth(i)).toHaveAttribute('data-category-id', categoryId ?? '');
      }
    });
  });

  test('should filter the games grid by a single publisher', async ({ page }) => {
    const totalCount = await page.getByTestId('game-card').count();
    const firstPublisherCheckbox = page.getByTestId('publisher-filter-group').getByRole('checkbox').first();
    const publisherId = await firstPublisherCheckbox.getAttribute('data-filter-id');

    await test.step('Check a single publisher filter', async () => {
      await firstPublisherCheckbox.check();
    });

    await test.step('Verify only matching cards remain visible', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).not.toHaveCount(totalCount);
      const count = await visibleCards.count();
      for (let i = 0; i < count; i++) {
        await expect(visibleCards.nth(i)).toHaveAttribute('data-publisher-id', publisherId ?? '');
      }
    });
  });

  test('should combine category and publisher filters with AND logic', async ({ page }) => {
    const firstCategoryCheckbox = page.getByTestId('category-filter-group').getByRole('checkbox').first();
    const firstPublisherCheckbox = page.getByTestId('publisher-filter-group').getByRole('checkbox').first();
    const categoryId = await firstCategoryCheckbox.getAttribute('data-filter-id');
    const publisherId = await firstPublisherCheckbox.getAttribute('data-filter-id');

    await test.step('Check one category and one publisher filter', async () => {
      await firstCategoryCheckbox.check();
      await firstPublisherCheckbox.check();
    });

    await test.step('Verify visible cards match both filters', async () => {
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      const count = await visibleCards.count();
      for (let i = 0; i < count; i++) {
        await expect(visibleCards.nth(i)).toHaveAttribute('data-category-id', categoryId ?? '');
        await expect(visibleCards.nth(i)).toHaveAttribute('data-publisher-id', publisherId ?? '');
      }
    });
  });

  test('should show a no-matches message when filters exclude every game', async ({ page }) => {
    const nonMatchingCombo = await test.step('Find a category/publisher combination with no games', async () => {
      return page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="game-card"]'));
        const existingPairs = new Set(cards.map((card) => `${card.dataset.categoryId}:${card.dataset.publisherId}`));
        const categoryIds = Array.from(
          new Set(cards.map((card) => card.dataset.categoryId).filter((id): id is string => Boolean(id))),
        );
        const publisherIds = Array.from(
          new Set(cards.map((card) => card.dataset.publisherId).filter((id): id is string => Boolean(id))),
        );
        for (const categoryId of categoryIds) {
          for (const publisherId of publisherIds) {
            if (!existingPairs.has(`${categoryId}:${publisherId}`)) {
              return { categoryId, publisherId };
            }
          }
        }
        return null;
      });
    });

    // Every combination of seeded category and publisher already has a matching game.
    test.skip(nonMatchingCombo === null, 'No non-matching category/publisher combination exists in the seed data');

    await test.step('Check the non-matching category and publisher filters', async () => {
      await page
        .locator(`input.filter-checkbox[data-filter-type="category"][data-filter-id="${nonMatchingCombo?.categoryId}"]`)
        .check();
      await page
        .locator(`input.filter-checkbox[data-filter-type="publisher"][data-filter-id="${nonMatchingCombo?.publisherId}"]`)
        .check();
    });

    await test.step('Verify the no-matches empty state is shown', async () => {
      await expect(page.getByTestId('no-filter-matches')).toBeVisible();
      const visibleCards = page.locator('[data-testid="game-card"]:visible');
      await expect(visibleCards).toHaveCount(0);
    });
  });

  test('should restore all games when filters are cleared', async ({ page }) => {
    const totalCount = await page.getByTestId('game-card').count();

    await test.step('Apply a category filter', async () => {
      await page.getByTestId('category-filter-group').getByRole('checkbox').first().check();
      await expect(page.locator('[data-testid="game-card"]:visible')).not.toHaveCount(totalCount);
    });

    await test.step('Click clear filters', async () => {
      await page.getByTestId('clear-filters-button').click();
    });

    await test.step('Verify all games are visible again and checkboxes are unchecked', async () => {
      await expect(page.locator('[data-testid="game-card"]:visible')).toHaveCount(totalCount);
      await expect(page.getByTestId('category-filter-group').getByRole('checkbox').first()).not.toBeChecked();
    });
  });

  test('should support keyboard interaction with filter checkboxes', async ({ page }) => {
    const firstCategoryCheckbox = page.getByTestId('category-filter-group').getByRole('checkbox').first();

    await test.step('Focus the checkbox and toggle it with the keyboard', async () => {
      await firstCategoryCheckbox.focus();
      await expect(firstCategoryCheckbox).toBeFocused();
      await page.keyboard.press('Space');
      await expect(firstCategoryCheckbox).toBeChecked();
    });

    await test.step('Toggle it off again with the keyboard', async () => {
      await page.keyboard.press('Space');
      await expect(firstCategoryCheckbox).not.toBeChecked();
    });
  });

  test('should have a visible focus indicator on filter checkboxes', async ({ page }) => {
    const firstCategoryCheckbox = page.getByTestId('category-filter-group').getByRole('checkbox').first();
    await firstCategoryCheckbox.focus();

    const hasVisibleFocus = await firstCategoryCheckbox.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return (styles.outline !== 'none' && styles.outlineWidth !== '0px') || styles.boxShadow !== 'none';
    });

    expect(hasVisibleFocus).toBeTruthy();
  });
});
