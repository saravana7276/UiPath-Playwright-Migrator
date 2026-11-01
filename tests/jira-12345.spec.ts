import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Migration Source: Jira [JIRA-12345]
 * Legacy UiPath Origin: UiPath_Web_Navigation_Journey.xaml
 * Summary: Migrate a generic UiPath web journey to Playwright TypeScript
 * Framework: Playwright + TypeScript
 */

test.describe('JIRA-12345: Migrate UiPath web journey to Playwright TypeScript', () => {
  test('should execute migrated browser journey with semantic locators', async ({ page }) => {
    const targetUrl = process.env.TARGET_URL || ('file://' + path.resolve(process.cwd(), 'fixtures/sample-web-portal.html'));

    await test.step('Step 1: Navigate to application home page', async () => {
      await page.goto(targetUrl);
      await expect(page).toHaveTitle(/.+/i);
    });

    await test.step('Step 2: Verify and click a navigation item', async () => {
      const element = page.getByRole('link', { name: /home|adventures|services/i }).first();
      await expect(element).toBeVisible();
      await element.click();
    });

    await test.step('Step 3: Validate primary action button', async () => {
      const element = page.getByRole('link', { name: /explore|start|continue|next/i }).first();
      await expect(element).toBeVisible();
    });

    await test.step('Final Validations: Verify page layout and key states', async () => {
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
    });
  });
});
