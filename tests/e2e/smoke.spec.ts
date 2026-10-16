import { test, expect } from '@playwright/test';

test.describe('Mini Arena Phase 0 Smoke Tests', () => {
  test('renders 3D canvas and initializes WebGPU or WebGL2 on default load', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#canvas-container canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    await page.waitForFunction(() => typeof window.__renderer === 'string', { timeout: 15000 });

    // Assert that the active renderer was recorded on window
    const rendererBackend = await page.evaluate(() => window.__renderer);
    expect(['webgpu', 'webgl2']).toContain(rendererBackend);

    // Verify HUD badge is displayed
    const badge = page.locator('#renderer-badge');
    await expect(badge).toBeVisible();
    const badgeText = await badge.innerText();
    expect(badgeText).toMatch(/webgpu|webgl2/i);
  });

  test('strictly falls back to WebGL2 with ?forceWebGL', async ({ page }) => {
    await page.goto('/?forceWebGL');

    const canvas = page.locator('#canvas-container canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    await page.waitForFunction(() => typeof window.__renderer === 'string', { timeout: 15000 });

    const rendererBackend = await page.evaluate(() => window.__renderer);
    expect(rendererBackend).toBe('webgl2');

    const badge = page.locator('#renderer-badge');
    await expect(badge).toContainText('WebGL2');
  });

  test('strictly falls back to WebGL2 with ?forceWebGL=true', async ({ page }) => {
    await page.goto('/?forceWebGL=true');

    const canvas = page.locator('#canvas-container canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    await page.waitForFunction(() => typeof window.__renderer === 'string', { timeout: 15000 });

    const rendererBackend = await page.evaluate(() => window.__renderer);
    expect(rendererBackend).toBe('webgl2');

    const badge = page.locator('#renderer-badge');
    await expect(badge).toContainText('WebGL2');
  });
});
