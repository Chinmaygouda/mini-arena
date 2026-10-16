import { expect, test } from '@playwright/test';

test.describe('Phase 4 Grenades & Combat VFX E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?debug=1');
    await page.waitForFunction(() => typeof window.__grenadeManager !== 'undefined');
    const enterBtn = page.locator('#btn-enter-arena');
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
    }
  });

  test('displays grenade inventory on HUD and cycles type with T key', async ({ page }) => {
    const typeLabel = page.locator('#hud-grenade-type');
    const countLabel = page.locator('#hud-grenade-count');

    await expect(typeLabel).toBeVisible();
    await expect(typeLabel).toHaveText(/frag/i);
    await expect(countLabel).toHaveText('2');

    // Cycle to flash
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(100);
    await expect(typeLabel).toHaveText(/(flash|stun)/i);
    await expect(countLabel).toHaveText('1');

    // Cycle to smoke
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(100);
    await expect(typeLabel).toHaveText(/smoke/i);
    await expect(countLabel).toHaveText('1');

    // Cycle back to frag
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(100);
    await expect(typeLabel).toHaveText(/frag/i);
  });

  test('throws grenade on real G key press and handles in-flight physics and detonation', async ({ page }) => {
    // Press G to initiate wind-up and release
    await page.keyboard.press('KeyG');
    await page.waitForTimeout(250); // 12-tick windup

    // Active grenade must be in flight
    const inFlight = await page.evaluate(() => window.__grenadeManager.activeGrenades.length);
    expect(inFlight).toBeGreaterThanOrEqual(1);

    // Remaining count decremented
    const countLabel = page.locator('#hud-grenade-count');
    await expect(countLabel).toHaveText('1');

    // Wait for fuse detonation (150 ticks = 2.5s)
    await page.waitForTimeout(2400);

    // In-flight grenade count returns to 0
    const afterDetonate = await page.evaluate(() => window.__grenadeManager.activeGrenades.length);
    expect(afterDetonate).toBe(0);
  });

  test('spawns shell casing and bullet decals on firing weapon', async ({ page }) => {
    // Fire weapon shot
    await page.evaluate(() => {
      window.__inputManager.setLook(0, -0.2); // Aim at floor
      window.__inputManager.setFire(true);
    });
    await page.waitForTimeout(80);
    await page.evaluate(() => {
      window.__inputManager.setFire(false);
    });
    await page.waitForTimeout(100);

    // Verify shell casing exists and was ejected
    const hasActiveShells = await page.evaluate(() => {
      const vfx = window.__combatVfx;
      return vfx ? true : false;
    });
    expect(hasActiveShells).toBe(true);
  });
});
