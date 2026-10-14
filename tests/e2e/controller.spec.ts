import { test, expect } from '@playwright/test';

test.describe('Mini Arena Phase 1 Controller & Arena E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('#canvas-container canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Wait until physics and player state are initialized on window
    await page.waitForFunction(() => typeof window.__playerState !== 'undefined');
  });

  test('pointer lock prompt appears and handles click', async ({ page }) => {
    const lockPrompt = page.locator('#lock-prompt');
    await expect(lockPrompt).toBeVisible();

    // Click the lock prompt directly
    await lockPrompt.click();

    // Verify look angles can be manipulated
    await page.evaluate(() => {
      window.__inputManager?.setLook(Math.PI / 4, 0.2);
    });

    const lookState = await page.evaluate(() => ({
      yaw: window.__inputManager?.yaw,
      pitch: window.__inputManager?.pitch,
    }));

    expect(lookState.yaw).toBeCloseTo(Math.PI / 4, 2);
    expect(lookState.pitch).toBeCloseTo(0.2, 2);
  });

  test('WASD movement drives position change and HUD updates', async ({ page }) => {
    const initialPos = await page.evaluate(() => ({
      x: window.__playerState!.x,
      y: window.__playerState!.y,
      z: window.__playerState!.z,
    }));

    // Simulate holding 'KeyW' (forward)
    await page.evaluate(() => {
      window.__inputManager?.setKey('KeyW', true);
    });

    // Wait for player to move forward along -Z
    await page.waitForFunction(
      (initZ) => window.__playerState!.z < initZ - 0.5,
      initialPos.z,
      { timeout: 3000 },
    );

    const movedPos = await page.evaluate(() => ({
      x: window.__playerState!.x,
      y: window.__playerState!.y,
      z: window.__playerState!.z,
    }));

    expect(movedPos.z).toBeLessThan(initialPos.z);

    // Release key
    await page.evaluate(() => {
      window.__inputManager?.setKey('KeyW', false);
    });

    // Verify HUD reflects position update
    const hudPosText = await page.locator('#hud-pos').innerText();
    expect(hudPosText).not.toBe('0, 0, 0');
  });

  test('jump impulse lifts player into the air and gravity lands them back', async ({ page }) => {
    // Press Space
    await page.evaluate(() => {
      window.__inputManager?.setKey('Space', true);
    });

    // Wait until jump lifts player into the air
    await page.waitForFunction(() => window.__playerState!.isGrounded === false, {
      timeout: 2000,
    });

    const inAirState = await page.evaluate(() => ({
      y: window.__playerState!.y,
      vy: window.__playerState!.vy,
      isGrounded: window.__playerState!.isGrounded,
    }));

    expect(inAirState.isGrounded).toBe(false);

    // Release Space
    await page.evaluate(() => {
      window.__inputManager?.setKey('Space', false);
    });

    // Wait until gravity brings player back to ground
    await page.waitForFunction(
      () => window.__playerState!.isGrounded === true && Math.abs(window.__playerState!.y) <= 0.2,
      { timeout: 4000 },
    );

    const landedState = await page.evaluate(() => ({
      y: window.__playerState!.y,
      isGrounded: window.__playerState!.isGrounded,
    }));

    expect(landedState.isGrounded).toBe(true);
    expect(Math.abs(landedState.y)).toBeLessThanOrEqual(0.2);
  });

  test('crouch toggles stance and updates HUD indicator', async ({ page }) => {
    await page.evaluate(() => {
      window.__inputManager?.setKey('KeyC', true);
    });

    await page.waitForFunction(() => window.__playerState!.isCrouching === true, {
      timeout: 2000,
    });

    const hudState = await page.locator('#hud-state').innerText();
    expect(hudState).toContain('Crouch');

    // Release crouch
    await page.evaluate(() => {
      window.__inputManager?.setKey('KeyC', false);
    });

    await page.waitForFunction(() => window.__playerState!.isCrouching === false, {
      timeout: 2000,
    });
    const unCrouched = await page.evaluate(() => window.__playerState!.isCrouching);
    expect(unCrouched).toBe(false);
  });

  test('wall collision prevents passing through boundary walls without sticking', async ({
    page,
  }) => {
    // Teleport player near South boundary wall at z = 19.0 (inner wall face at z = 20.0)
    await page.evaluate(() => {
      window.__playerState!.x = 0;
      window.__playerState!.y = 0;
      window.__playerState!.z = 19.0;
      window.__inputManager!.yaw = Math.PI; // Face +Z directly into the wall
      window.__inputManager!.setKey('KeyW', true);
    });

    // Wait until player moves into wall contact
    await page.waitForFunction(() => window.__playerState!.z > 19.2, { timeout: 3000 });

    const wallStuckPos = await page.evaluate(() => ({
      z: window.__playerState!.z,
      vx: window.__playerState!.vx,
      vz: window.__playerState!.vz,
    }));

    // Player should be stopped by the wall at roughly z ~ 19.58 (inner face 20.0 - radius 0.4 - offset 0.02)
    expect(wallStuckPos.z).toBeLessThan(19.8);
    expect(wallStuckPos.z).toBeGreaterThan(19.2);

    // Diagonal movement test (slide test): face 45 degrees into wall and move forward
    await page.evaluate(() => {
      window.__inputManager!.yaw = Math.PI * 0.75; // Angle into wall
      window.__inputManager!.setKey('KeyW', true);
    });

    // Wait for diagonal sliding along X axis
    await page.waitForFunction(() => Math.abs(window.__playerState!.x) > 0.1, { timeout: 3000 });

    const slidingPos = await page.evaluate(() => ({
      x: window.__playerState!.x,
      z: window.__playerState!.z,
    }));

    // Player should have slid along X axis rather than being completely stuck
    expect(Math.abs(slidingPos.x)).toBeGreaterThan(0.1);

    await page.evaluate(() => {
      window.__inputManager!.setKey('KeyW', false);
    });
  });

  test('smoothly climbs stair steps and ramps to central platform', async ({ page }) => {
    // Teleport player at foot of shallow ramp at z = 8.0, y = 0
    await page.evaluate(() => {
      window.__playerState!.x = 0;
      window.__playerState!.y = 0;
      window.__playerState!.z = 8.0;
      window.__inputManager!.yaw = 0; // Face -Z towards ramp and platform
      window.__inputManager!.setKey('KeyW', true);
    });

    // Wait for player to climb up the slope (y increases as player ascends)
    await page.waitForFunction(() => window.__playerState!.y > 0.4, { timeout: 4000 });

    const onPlatformPos = await page.evaluate(() => ({
      x: window.__playerState!.x,
      y: window.__playerState!.y,
      z: window.__playerState!.z,
      isGrounded: window.__playerState!.isGrounded,
    }));

    // Player elevation has successfully climbed the ramp
    expect(onPlatformPos.y).toBeGreaterThan(0.4);
    expect(onPlatformPos.isGrounded).toBe(true);

    await page.evaluate(() => {
      window.__inputManager!.setKey('KeyW', false);
    });
  });
});
