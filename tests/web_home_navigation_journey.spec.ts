import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Migration Origin: UiPath_Web_Workflow.xaml
 * Title: Web home navigation journey
 * Framework: Playwright + TypeScript
 */

test.describe('Web home navigation journey', () => {
  test('should execute migrated browser journey with semantic locators', async ({ page }) => {
    const targetUrl = process.env.TARGET_URL || ('file://' + path.resolve(process.cwd(), 'fixtures/sample-web-portal.html'));

    await test.step('Step 1: Navigate to target web page', async () => {
      await page.goto(targetUrl);
      await expect(page).toHaveTitle(/.+/i);
    });

    await test.step('Step 2: Click a navigation item', async () => {
      const element = page.getByRole('link', { name: /home|adventures|services|support/i }).first();
      await expect(element).toBeVisible();
      await element.click();
    });

    await test.step('Step 3: Verify content and layout state', async () => {
      await expect(page.locator('main')).toBeVisible();
    });

    await test.step('Final Validations: Verify layout and content state', async () => {
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
    });
  });
});
