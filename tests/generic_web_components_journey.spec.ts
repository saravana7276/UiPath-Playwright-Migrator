import { test, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Migration Origin: UiPath_Generic_Web_Workflow.xaml
 * Title: Generic web application journey
 * Framework: Playwright + TypeScript
 */

test.describe('Generic web application journey', () => {
  test('should execute migrated browser journey with semantic locators', async ({ page }) => {
    const targetUrl = process.env.TARGET_URL || ('file://' + path.resolve(process.cwd(), 'fixtures/sample-web-portal.html'));

    await test.step('Step 1: Navigate to application home page', async () => {
      await page.goto(targetUrl);
      await expect(page).toHaveTitle(/.+/i);
    });

    await test.step('Step 2: Verify and click navigation item', async () => {
      const element = page.getByRole('link', { name: /home|adventures|services|support/i }).first();
      await expect(element).toBeVisible();
      await element.click();
    });

    await test.step('Step 3: Validate primary hero action', async () => {
      const element = page.getByRole('link', { name: /explore|start|continue|learn more/i }).first();
      await expect(element).toBeVisible();
      await element.click();
    });

    await test.step('Final Validations: Verify layout and action state', async () => {
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
    });
  });
});
