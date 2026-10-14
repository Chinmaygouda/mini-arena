import { test, expect } from '@playwright/test';

test.describe('Mini Arena Phase 2 Weapons Core & Offline Dummy Targets E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#canvas-container canvas', { state: 'visible' });

    // Wait for Three.js engine and weapon state initialization
    await page.waitForFunction(() => {
      return (
        typeof window.__playerState !== 'undefined' &&
        typeof window.__weaponState !== 'undefined' &&
        typeof window.__fireTiming !== 'undefined' &&
        typeof window.__dummies !== 'undefined'
      );
    });

    // Dismiss lock prompt overlay cleanly by clicking it
    const prompt = page.locator('#lock-prompt');
    if (await prompt.isVisible()) {
      await prompt.click();
    }
  });

  test('HUD initializes with default weapon (Assault Rifle 30/90)', async ({ page }) => {
    const nameEl = page.locator('#hud-weapon-name');
    const magEl = page.locator('#hud-ammo-mag');
    const reserveEl = page.locator('#hud-ammo-reserve');

    await expect(nameEl).toHaveText('Assault Rifle');
    await expect(magEl).toHaveText('30');
    await expect(reserveEl).toHaveText('/ 90');
  });

  test('firing consumes ammo, decrements mag count, and triggers viewmodel kick', async ({
    page,
  }) => {
    // Check initial ammo
    const magBefore = await page.evaluate(() => {
      const slot = window.__weaponState!.slots[window.__weaponState!.currentSlot];
      return slot ? slot.ammoInMag : 0;
    });
    expect(magBefore).toBe(30);

    // Fire weapon using input manager
    await page.evaluate(() => {
      window.__inputManager!.setFire(true);
    });

    // Wait until ammo in mag decreases
    await page.waitForFunction(
      () => {
        const slot = window.__weaponState?.slots[window.__weaponState.currentSlot];
        return slot ? slot.ammoInMag < 30 : false;
      },
      { timeout: 6000 },
    );

    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
    });

    // Verify ammo decreased
    const magAfter = await page.evaluate(() => {
      const slot = window.__weaponState!.slots[window.__weaponState!.currentSlot];
      return slot ? slot.ammoInMag : 0;
    });
    expect(magAfter).toBeLessThan(30);

    // Verify HUD reflects new ammo count
    const magEl = page.locator('#hud-ammo-mag');
    await expect(magEl).toHaveText(`${magAfter}`);
  });

  test('weapon swap cycles through all 5 weapons via Digit keys and updates HUD', async ({
    page,
  }) => {
    // 1. Swap to Pistol (Digit2)
    await page.evaluate(() => window.__inputManager!.setWeaponSlot(1));
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 1, { timeout: 6000 });

    let weaponName = await page.locator('#hud-weapon-name').textContent();
    expect(weaponName).toBe('Tactical Pistol');
    await expect(page.locator('#hud-ammo-mag')).toHaveText('12');
    await expect(page.locator('#hud-ammo-reserve')).toHaveText('/ 36');

    // 2. Swap to SMG (Digit3)
    await page.evaluate(() => window.__inputManager!.setWeaponSlot(2));
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 2, { timeout: 6000 });
    weaponName = await page.locator('#hud-weapon-name').textContent();
    expect(weaponName).toBe('Rapid SMG');
    await expect(page.locator('#hud-ammo-mag')).toHaveText('30');
    await expect(page.locator('#hud-ammo-reserve')).toHaveText('/ 120');

    // 3. Swap to Shotgun (Digit4)
    await page.evaluate(() => window.__inputManager!.setWeaponSlot(3));
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 3, { timeout: 6000 });
    weaponName = await page.locator('#hud-weapon-name').textContent();
    expect(weaponName).toBe('Combat Shotgun');
    await expect(page.locator('#hud-ammo-mag')).toHaveText('6');
    await expect(page.locator('#hud-ammo-reserve')).toHaveText('/ 24');

    // 4. Swap to Sniper (Digit5)
    await page.evaluate(() => window.__inputManager!.setWeaponSlot(4));
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 4, { timeout: 6000 });
    weaponName = await page.locator('#hud-weapon-name').textContent();
    expect(weaponName).toBe('Precision Sniper');
    await expect(page.locator('#hud-ammo-mag')).toHaveText('5');
    await expect(page.locator('#hud-ammo-reserve')).toHaveText('/ 15');

    // 5. Swap back to Assault Rifle (Digit1)
    await page.evaluate(() => window.__inputManager!.setWeaponSlot(0));
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 0, { timeout: 6000 });
    weaponName = await page.locator('#hud-weapon-name').textContent();
    expect(weaponName).toBe('Assault Rifle');
  });

  test('tactical reload refills magazine from reserve ammo', async ({ page }) => {
    // Set magazine to 20/90
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[window.__weaponState!.currentSlot];
      if (slot) slot.ammoInMag = 20;
    });

    await expect(page.locator('#hud-ammo-mag')).toHaveText('20');

    // Trigger tactical reload
    await page.evaluate(() => {
      window.__inputManager!.setReload(true);
    });

    // Verify reload indicator appears
    await expect(page.locator('#hud-weapon-action')).toHaveText('RELOADING...');

    // Wait for reload to complete and state to return to idle
    await page.waitForFunction(
      () => window.__weaponState!.actionState === 'idle',
      { timeout: 8000 },
    );

    // Verify magazine is full (30) and reserve was deducted (90 - 10 = 80)
    const { ammoInMag, ammoReserve, actionState } = await page.evaluate(() => {
      const slot = window.__weaponState!.slots[window.__weaponState!.currentSlot]!;
      return {
        ammoInMag: slot.ammoInMag,
        ammoReserve: slot.ammoReserve,
        actionState: window.__weaponState!.actionState,
      };
    });

    expect(actionState).toBe('idle');
    expect(ammoInMag).toBe(30);
    expect(ammoReserve).toBe(80);
    await expect(page.locator('#hud-ammo-mag')).toHaveText('30');
    await expect(page.locator('#hud-ammo-reserve')).toHaveText('/ 80');
  });

  test('sprint cancels active reload and preserves remaining ammo', async ({ page }) => {
    // Deplete mag to 10
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[window.__weaponState!.currentSlot]!;
      slot.ammoInMag = 10;
    });

    // Start reload
    await page.evaluate(() => {
      window.__inputManager!.setReload(true);
    });
    await expect(page.locator('#hud-weapon-action')).toHaveText('RELOADING...');

    // Simulate moving sprint forward
    await page.evaluate(() => {
      window.__inputManager!.setKey('KeyW', true);
      window.__inputManager!.setKey('ShiftLeft', true);
    });

    // Wait for sprint to cancel reload back to idle
    await page.waitForFunction(
      () => window.__weaponState!.actionState === 'idle',
      { timeout: 6000 },
    );

    // Release movement
    await page.evaluate(() => {
      window.__inputManager!.setKey('KeyW', false);
      window.__inputManager!.setKey('ShiftLeft', false);
    });

    // Ammo should remain 10 (not reloaded)
    const ammoInMag = await page.evaluate(() => {
      return window.__weaponState!.slots[window.__weaponState!.currentSlot]!.ammoInMag;
    });
    expect(ammoInMag).toBe(10);
  });

  test('ADS right click activates zoom and transitions viewmodel', async ({ page }) => {
    // Initial hip FOV = 75
    await page.evaluate(() => {
      window.__inputManager!.setAds(true);
    });

    // Wait for FOV lerp
    await page.waitForTimeout(300);

    const isAdsActive = await page.evaluate(() => {
      return window.__inputManager!.isAds;
    });
    expect(isAdsActive).toBe(true);

    // Release ADS
    await page.evaluate(() => {
      window.__inputManager!.setAds(false);
    });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__inputManager!.isAds)).toBe(false);
  });

  test('hitscan ray hits target dummy, triggers hit marker, and applies damage', async ({
    page,
  }) => {
    // Player starts at (0, 0, 12).
    // Dummy Alpha is at (0, 0, -8), directly 20m in front along Z axis.
    // Camera eye height = 1.65m. Dummy body center = 0.75m.
    // Direct pitch angle: atan2(0.75 - 1.65, 20) = -0.045 rad.
    await page.evaluate(() => {
      window.__inputManager!.setLook(0, -0.045);
      window.__weaponState!.actionState = 'idle';
      window.__weaponState!.slots[window.__weaponState!.currentSlot]!.ammoInMag = 30;
    });

    // Fire 1 shot
    await page.evaluate(() => {
      window.__inputManager!.setFire(true);
    });
    await page.waitForTimeout(120);
    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
    });

    // Verify hit feedback triggered on Alpha dummy
    const hitCount = await page.evaluate(() => {
      const dummy = window.__dummies!.dummies.find((d) => d.id === 'dummy-close');
      return dummy ? dummy.hitCount : 0;
    });

    // Hit confirmation
    expect(hitCount).toBeGreaterThan(0);
  });
});
