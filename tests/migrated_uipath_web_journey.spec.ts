import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Migration Origin: UiPath_Web_Workflow.xaml
 * Title: Migrated UiPath web journey
 * Framework: Playwright + TypeScript
 */

test.describe('Migrated UiPath web journey', () => {
  test('should execute migrated browser journey with auto-waiting and semantic locators', async ({ page }) => {
    const targetUrl = process.env.TARGET_URL || ('file://' + path.resolve(process.cwd(), 'fixtures/sample-web-portal.html'));

    await test.step('Step 1: Navigate to target web page', async () => {
      await page.goto(targetUrl);
      await expect(page).toHaveTitle(/.+/i);
    });

    await test.step('Step 2: Click a navigation item', async () => {
      const element = page.getByRole('link', { name: /home|adventures|services/i }).first();
      await expect(element).toBeVisible();
      await element.click();
    });

    await test.step('Step 3: Trigger a primary action', async () => {
      const element = page.getByRole('link', { name: /explore|start|continue|next/i }).first();
      await expect(element).toBeVisible();
      await element.click();
    });

    await test.step('Final Validations: Verify the application layout and state', async () => {
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
    });
  });
});
