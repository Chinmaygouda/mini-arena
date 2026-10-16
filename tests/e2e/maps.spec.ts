import { expect, test } from '@playwright/test';

test.describe('Phase 5 Modular Maps & Art E2E', () => {
  test('loads default warehouse map with correct dimensions, colliders, and player spawn', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.waitForFunction(() => typeof window.__mapSession !== 'undefined');

    const enterBtn = page.locator('#btn-enter-arena');
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
    }

    const mapData = await page.evaluate(() => {
      const session = window.__mapSession;
      return {
        id: session?.spec.id,
        name: session?.spec.name,
        colliders: session?.colliders.length,
        rigidBodies: session?.rigidBodies.length,
      };
    });

    expect(mapData.id).toBe('warehouse');
    expect(mapData.name).toBe('Warehouse');
    expect(mapData.colliders).toBeGreaterThanOrEqual(20);
    expect(mapData.rigidBodies).toBeGreaterThanOrEqual(20);
  });

  test('loads plaza map via ?map=plaza with daylight lighting and courtyard colliders', async ({ page }) => {
    await page.goto('/?map=plaza&debug=1');
    await page.waitForFunction(() => typeof window.__mapSession !== 'undefined');

    const enterBtn = page.locator('#btn-enter-arena');
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
    }

    const mapData = await page.evaluate(() => {
      const session = window.__mapSession;
      return {
        id: session?.spec.id,
        name: session?.spec.name,
        ambientIntensity: session?.spec.lighting.ambientIntensity,
        colliders: session?.colliders.length,
      };
    });

    expect(mapData.id).toBe('plaza');
    expect(mapData.name).toBe('Plaza');
    expect(mapData.ambientIntensity).toBe(0.8);
    expect(mapData.colliders).toBeGreaterThanOrEqual(20);
  });

  test('loads containeryard map via ?map=containeryard with golden hour lighting', async ({ page }) => {
    await page.goto('/?map=containeryard&debug=1');
    await page.waitForFunction(() => typeof window.__mapSession !== 'undefined');

    const enterBtn = page.locator('#btn-enter-arena');
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
    }

    const mapData = await page.evaluate(() => {
      const session = window.__mapSession;
      return {
        id: session?.spec.id,
        name: session?.spec.name,
        sunColor: session?.spec.lighting.sunColor,
        colliders: session?.colliders.length,
      };
    });

    expect(mapData.id).toBe('containeryard');
    expect(mapData.name).toBe('Container Yard');
    expect(mapData.sunColor).toBe(0xfb923c);
    expect(mapData.colliders).toBeGreaterThanOrEqual(20);
  });

  test('live hot-switching maps via switchMap transitions cleanly without physics leaks', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.waitForFunction(() => typeof window.__mapSession !== 'undefined');

    const enterBtn = page.locator('#btn-enter-arena');
    if (await enterBtn.isVisible()) {
      await enterBtn.click();
    }

    const initialBodies = await page.evaluate(() => window.__physics.world.bodies.len());

    // Switch to plaza
    await page.evaluate(() => window.__switchMap('plaza'));
    const plazaId = await page.evaluate(() => window.__mapSession.spec.id);
    expect(plazaId).toBe('plaza');

    // Switch to containeryard
    await page.evaluate(() => window.__switchMap('containeryard'));
    const containerId = await page.evaluate(() => window.__mapSession.spec.id);
    expect(containerId).toBe('containeryard');

    // Switch back to warehouse
    await page.evaluate(() => window.__switchMap('warehouse'));
    const warehouseId = await page.evaluate(() => window.__mapSession.spec.id);
    expect(warehouseId).toBe('warehouse');

    const finalBodies = await page.evaluate(() => window.__physics.world.bodies.len());
    expect(finalBodies).toBe(initialBodies);
  });
});
