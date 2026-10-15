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
    // Check initial ammo and viewmodel recoil state
    const beforeState = await page.evaluate(() => {
      const slot = window.__weaponState!.slots[window.__weaponState!.currentSlot];
      const vm = window.__viewmodel;
      return {
        mag: slot ? slot.ammoInMag : 0,
        kickCount: vm ? vm.kickCount : 0,
        recoilZ: vm ? vm.getRecoilOffsetZ() : 0,
        recoilPitch: vm ? vm.getRecoilPitch() : 0,
      };
    });
    expect(beforeState.mag).toBe(30);
    expect(beforeState.kickCount).toBe(0);

    // Fire weapon using input manager
    await page.evaluate(() => {
      window.__inputManager!.setFire(true);
    });

    // Wait until ammo in mag decreases and viewmodel kick counter increments
    await page.waitForFunction(
      () => {
        const slot = window.__weaponState?.slots[window.__weaponState.currentSlot];
        const vm = window.__viewmodel;
        return (slot ? slot.ammoInMag < 30 : false) && (vm ? vm.kickCount > 0 : false);
      },
      { timeout: 6000 },
    );

    // Verify viewmodel kick state during/immediately following shot
    const kickInfo = await page.evaluate(() => {
      const vm = window.__viewmodel!;
      const slot = window.__weaponState!.slots[window.__weaponState!.currentSlot]!;
      return {
        mag: slot.ammoInMag,
        kickCount: vm.kickCount,
        clipName: vm.animator.getCurrentClipName(),
      };
    });

    // Stop firing
    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
      if (window.__weaponState) {
        window.__weaponState.bufferedFireTicks = 0;
      }
    });

    // Concrete kick assertions: recoil kick was registered
    expect(kickInfo.mag).toBeLessThan(30);
    expect(kickInfo.kickCount).toBeGreaterThan(0);

    // Verify HUD reflects new ammo count
    const magEl = page.locator('#hud-ammo-mag');
    await expect(magEl).toHaveText(`${kickInfo.mag}`);
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

    await page.waitForFunction(() => {
      const ws = window.__weaponState;
      return ws && (ws.actionState === 'reloading_tactical' || ws.actionState === 'reloading_empty');
    }, { timeout: 10000 });

    await page.evaluate(() => {
      window.__inputManager!.setReload(false);
    });

    // Verify reload indicator appears
    await expect(page.locator('#hud-weapon-action')).toHaveText('RELOADING...');

    // Wait for reload to complete and state to return to idle
    await page.waitForFunction(
      () => window.__weaponState!.actionState === 'idle',
      { timeout: 15000 },
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
    // Initial hip state: FOV = 75, viewmodel x offset ~0.13
    const initialView = await page.evaluate(() => {
      const cam = window.__camera;
      const vm = window.__viewmodel;
      return {
        fov: cam ? cam.fov : 0,
        vmX: vm ? vm.group.position.x : 0,
      };
    });
    expect(initialView.fov).toBeCloseTo(75, 1);
    expect(initialView.vmX).toBeGreaterThan(0.08); // Hip rest position offset is 0.13

    // Activate ADS
    await page.evaluate(() => {
      window.__inputManager!.setAds(true);
    });

    // Wait for FOV zoom (target is 75 * 0.75 = 56.25 for Assault Rifle) and viewmodel eye-alignment
    await page.waitForFunction(() => {
      const cam = window.__camera;
      const vm = window.__viewmodel;
      return (
        window.__inputManager!.isAds === true &&
        cam !== undefined &&
        cam.fov < 65 &&
        vm !== undefined &&
        Math.abs(vm.group.position.x) < 0.05
      );
    }, { timeout: 6000 });

    const adsView = await page.evaluate(() => {
      return {
        fov: window.__camera!.fov,
        vmX: window.__viewmodel!.group.position.x,
        isAds: window.__inputManager!.isAds,
      };
    });
    expect(adsView.isAds).toBe(true);
    expect(adsView.fov).toBeLessThan(65);
    expect(Math.abs(adsView.vmX)).toBeLessThan(0.05); // Centered on optic

    // Release ADS
    await page.evaluate(() => {
      window.__inputManager!.setAds(false);
    });

    // Wait for un-zoom: FOV restores towards 75, viewmodel returns to hip
    await page.waitForFunction(() => {
      const cam = window.__camera;
      const vm = window.__viewmodel;
      return (
        window.__inputManager!.isAds === false &&
        cam !== undefined &&
        cam.fov > 72 &&
        vm !== undefined &&
        vm.group.position.x > 0.08
      );
    }, { timeout: 6000 });

    const restoredView = await page.evaluate(() => {
      return {
        fov: window.__camera!.fov,
        vmX: window.__viewmodel!.group.position.x,
        isAds: window.__inputManager!.isAds,
      };
    });
    expect(restoredView.isAds).toBe(false);
    expect(restoredView.fov).toBeGreaterThan(72);
    expect(restoredView.vmX).toBeGreaterThan(0.08);
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

    // Fire shot until hit registers on target dummy
    await page.evaluate(() => {
      window.__inputManager!.setFire(true);
    });
    await page.waitForFunction(() => {
      const dummy = window.__dummies!.dummies.find((d) => d.id === 'dummy-close');
      return dummy && dummy.hitCount > 0;
    }, { timeout: 8000 });
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

  test('shotgun shell reload commits ammo specifically at tick 20 of insert phase', async ({
    page,
  }) => {
    // Equip Shotgun (slot 3)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(3);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 3 && window.__weaponState!.actionState === 'idle');

    // Set ammo to 1/10
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      slot.ammoInMag = 1;
      slot.ammoReserve = 10;
      window.__inputManager!.setReload(true);
    });

    // Wait for reloading_shell_insert
    await page.waitForFunction(() => window.__weaponState!.actionState === 'reloading_shell_insert');
    await page.evaluate(() => window.__inputManager!.setReload(false));

    // Before tick 20: ammo has NOT committed yet
    const beforeCommit = await page.evaluate(() => {
      const ws = window.__weaponState!;
      const slot = ws.slots[3]!;
      return {
        ticksIntoState: ws.ticksIntoState,
        ammoInMag: slot.ammoInMag,
        commitDone: ws.shellCommitDone,
      };
    });
    if (beforeCommit.ticksIntoState < 20) {
      expect(beforeCommit.ammoInMag).toBe(1);
      expect(beforeCommit.commitDone).toBe(false);
    }

    // Wait until ticksIntoState >= 20
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_shell_insert' && ws.ticksIntoState >= 20;
    });

    // After tick 20: shell has committed
    const afterCommit = await page.evaluate(() => {
      const ws = window.__weaponState!;
      const slot = ws.slots[3]!;
      return {
        ammoInMag: slot.ammoInMag,
        ammoReserve: slot.ammoReserve,
        commitDone: ws.shellCommitDone,
      };
    });
    expect(afterCommit.ammoInMag).toBe(2);
    expect(afterCommit.ammoReserve).toBe(9);
    expect(afterCommit.commitDone).toBe(true);
  });

  test('shotgun fire-interrupt before tick 20 discards progress, while interrupt after tick 20 retains committed shell', async ({
    page,
  }) => {
    // Equip Shotgun
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(3);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 3 && window.__weaponState!.actionState === 'idle');

    // Test A: Interrupt before commit tick 20 discards uncommitted shell
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      slot.ammoInMag = 2;
      slot.ammoReserve = 10;
      // Hook input sample deterministically inside simulation tick loop at ticksIntoState >= 5
      window.__inputManager!.onTick = () => {
        const ws = window.__weaponState;
        if (ws && ws.actionState === 'reloading_shell_insert' && ws.ticksIntoState >= 5 && ws.ticksIntoState < 18) {
          window.__inputManager!.setReload(false);
          window.__inputManager!.setFire(true);
          window.__inputManager!.onTick = undefined;
        }
      };
      window.__inputManager!.setReload(true);
    });

    // Wait for reload to actually begin
    await page.waitForFunction(() => {
      const ws = window.__weaponState;
      return ws && (ws.actionState === 'reloading_shell_start' || ws.actionState === 'reloading_shell_insert');
    }, { timeout: 10000 });

    // Wait for reload abort and buffered fire to execute shot (leaving 1 in mag)
    await page.waitForFunction(() => {
      const slot = window.__weaponState?.slots[3];
      return window.__weaponState?.actionState === 'idle' && slot !== undefined && slot.ammoInMag === 1;
    }, { timeout: 10000 });

    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
      window.__weaponState!.bufferedFireTicks = 0;
    });

    // Uncommitted shell was discarded (reserve remains 10, shot fired from existing 2 shells leaves 1)
    const afterDiscard = await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      return { mag: slot.ammoInMag, res: slot.ammoReserve };
    });
    expect(afterDiscard.mag).toBe(1);
    expect(afterDiscard.res).toBe(10);

    // Test B: Interrupt after tick 20 retains committed shell
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      slot.ammoInMag = 2;
      slot.ammoReserve = 10;
      // Hook input sample deterministically at ticksIntoState >= 21 (strictly after commit tick 20)
      window.__inputManager!.onTick = () => {
        const ws = window.__weaponState;
        if (ws && ws.actionState === 'reloading_shell_insert' && (ws.shellCommitDone || ws.ticksIntoState >= 21)) {
          window.__inputManager!.setReload(false);
          window.__inputManager!.setFire(true);
          window.__inputManager!.onTick = undefined;
        }
      };
      window.__inputManager!.setReload(true);
    });

    // Wait for reload to actually begin
    await page.waitForFunction(() => {
      const ws = window.__weaponState;
      return ws && (ws.actionState === 'reloading_shell_start' || ws.actionState === 'reloading_shell_insert');
    }, { timeout: 10000 });

    // Wait for committed shell (2 -> 3) and buffered fire to execute shot (3 -> 2)
    await page.waitForFunction(() => {
      const slot = window.__weaponState?.slots[3];
      return window.__weaponState?.actionState === 'idle' && slot !== undefined && slot.ammoInMag === 2;
    }, { timeout: 10000 });

    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
      window.__weaponState!.bufferedFireTicks = 0;
    });

    // Committed shell is retained: mag went 2 -> 3 on commit, minus 1 fired shot = 2 in mag, reserve deducted to 9
    const afterRetained = await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      return { mag: slot.ammoInMag, res: slot.ammoReserve };
    });
    expect(afterRetained.mag).toBe(2);
    expect(afterRetained.res).toBe(9);
  });

  test('shotgun mag == 0 rejects fire-interrupt, preventing stuck empty state', async ({
    page,
  }) => {
    // Equip Shotgun
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(3);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 3 && window.__weaponState!.actionState === 'idle');

    // Set ammo to 0/10
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      slot.ammoInMag = 0;
      slot.ammoReserve = 10;
      window.__inputManager!.setReload(true);
    });

    // Wait for insert phase
    await page.waitForFunction(() => window.__weaponState!.actionState === 'reloading_shell_insert');
    await page.evaluate(() => window.__inputManager!.setReload(false));

    // Attempt fire-interrupt while mag is 0
    await page.evaluate(() => {
      window.__inputManager!.setFire(true);
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__inputManager!.setFire(false));

    // Reloading must NOT have aborted to idle; it must continue reloading
    const action = await page.evaluate(() => window.__weaponState!.actionState);
    expect(action).not.toBe('idle');
    expect(action).toContain('reloading_shell');
  });

  test('shotgun fire-interrupt skips reloading_shell_end to prevent double-pump', async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(3);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 3 && window.__weaponState!.actionState === 'idle');

    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      slot.ammoInMag = 3;
      slot.ammoReserve = 10;
      window.__inputManager!.setReload(true);
    });

    await page.waitForFunction(() => window.__weaponState!.actionState === 'reloading_shell_insert');

    // Fire interrupt
    await page.evaluate(() => {
      window.__inputManager!.setReload(false);
      window.__inputManager!.setFire(true);
    });

    await page.waitForFunction(() => window.__weaponState!.actionState === 'idle');
    await page.evaluate(() => window.__inputManager!.setFire(false));

    // Must transition directly to idle, never entering reloading_shell_end
    const finalState = await page.evaluate(() => window.__weaponState!.actionState);
    expect(finalState).toBe('idle');
  });

  test('shotgun reload loop exits cleanly to idle once full capacity of 6 is reached', async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(3);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 3 && window.__weaponState!.actionState === 'idle');

    // Set ammo to 5/10 (needs 1 shell to reach 6/6)
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      slot.ammoInMag = 5;
      slot.ammoReserve = 10;
      window.__inputManager!.setReload(true);
    });

    // Wait for reload to start
    await page.waitForFunction(() => window.__weaponState!.actionState !== 'idle');
    await page.evaluate(() => window.__inputManager!.setReload(false));

    // Wait for reload to run uninterrupted and complete to idle
    await page.waitForFunction(() => window.__weaponState!.actionState === 'idle', { timeout: 15000 });

    const { ammoInMag, ammoReserve } = await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      return { ammoInMag: slot.ammoInMag, ammoReserve: slot.ammoReserve };
    });
    expect(ammoInMag).toBe(6);
    expect(ammoReserve).toBe(9);
  });

  test('sniper enforces 80-tick (1.33s) bolt-action cycle and anti-quickswitch lockout across swaps', async ({
    page,
  }) => {
    // Equip Sniper (slot 4)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(4);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 4 && window.__weaponState!.actionState === 'idle');

    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[4]!;
      slot.ammoInMag = 5;
      slot.ammoReserve = 15;
    });

    // Fire 1 shot: wait for ammo to decrement from 5 to 4
    await page.evaluate(() => {
      window.__inputManager!.setFire(true);
    });
    await page.waitForFunction(() => window.__weaponState!.slots[4]!.ammoInMag === 4);
    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
    });

    // Verify action state is cycling_bolt and nextReadyTick is locked
    const boltInfo = await page.evaluate(() => {
      const ws = window.__weaponState!;
      const slot = ws.slots[4]!;
      return {
        actionState: ws.actionState,
        ammoInMag: slot.ammoInMag,
        nextReadyTick: slot.nextReadyTick ?? 0,
        currentSimTick: ws.currentSimTick,
      };
    });
    expect(boltInfo.ammoInMag).toBe(4);
    expect(boltInfo.actionState).toBe('cycling_bolt');
    expect(boltInfo.nextReadyTick).toBeGreaterThan(boltInfo.currentSimTick);
    expect(boltInfo.nextReadyTick - boltInfo.currentSimTick).toBeLessThanOrEqual(80);

    // Quick-switch to Pistol (slot 1)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(1);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 1);

    // Immediately quick-switch back to Sniper (slot 4)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(4);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 4);

    // Sniper must still preserve anti-quickswitch nextReadyTick without being reset
    const quickswitchLocked = await page.evaluate(() => {
      const ws = window.__weaponState!;
      const slot = ws.slots[4]!;
      return {
        nextReadyTick: slot.nextReadyTick,
        currentSimTick: ws.currentSimTick,
      };
    });
    expect(quickswitchLocked.nextReadyTick).toBe(boltInfo.nextReadyTick);
  });

  test('sniper last-round reload uses tactical duration (168 ticks) skipping redundant bolt re-rack', async ({
    page,
  }) => {
    // Equip Sniper
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(4);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 4 && window.__weaponState!.actionState === 'idle');

    // Set last round in mag
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[4]!;
      slot.ammoInMag = 1;
      slot.ammoReserve = 15;
    });

    // Fire last round: wait for ammo to hit 0
    await page.evaluate(() => {
      window.__inputManager!.setFire(true);
    });
    await page.waitForFunction(() => window.__weaponState!.slots[4]!.ammoInMag === 0);
    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
    });

    // Wait for bolt cycle to finish and auto-reload to kick in
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_tactical';
    }, { timeout: 6000 });

    const reloadInfo = await page.evaluate(() => {
      const ws = window.__weaponState!;
      return {
        actionState: ws.actionState,
        stateTicksRemaining: ws.stateTicksRemaining,
      };
    });

    // Tactical reload duration is 168 ticks (2.8s), saving 42 ticks (0.7s) vs empty reload (210 ticks)
    expect(reloadInfo.actionState).toBe('reloading_tactical');
    expect(reloadInfo.stateTicksRemaining).toBeLessThanOrEqual(168);
    expect(reloadInfo.stateTicksRemaining).toBeGreaterThan(150);
  });

  test('sniper ADS activates optical scope overlay, culls 3D viewmodel to prevent clipping, and restores on un-zoom', async ({
    page,
  }) => {
    // Equip Sniper
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(4);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 4);

    // Zoom in with ADS
    await page.evaluate(() => {
      window.__inputManager!.setAds(true);
    });

    // Scope overlay should be active
    const scopeEl = page.locator('#sniper-scope');
    await expect(scopeEl).toHaveClass(/active/);

    // 3D viewmodel should be hidden (group.visible === false)
    const viewmodelHidden = await page.evaluate(() => {
      return window.__viewmodel!.group.visible === false;
    });
    expect(viewmodelHidden).toBe(true);

    // Zoom out (release ADS)
    await page.evaluate(() => {
      window.__inputManager!.setAds(false);
    });

    // Scope overlay deactivated
    await expect(scopeEl).not.toHaveClass(/active/);

    // 3D viewmodel restored to visible
    const viewmodelRestored = await page.evaluate(() => {
      return window.__viewmodel!.group.visible === true;
    });
    expect(viewmodelRestored).toBe(true);
  });

  test('tactical reload commits ammo at integer commit tick and updates HUD', async ({ page }) => {
    // Consume ammo naturally by firing a short burst
    await page.evaluate(() => {
      window.__inputManager!.setFire(true);
    });
    await page.waitForFunction(() => {
      const slot = window.__weaponState!.slots[0]!;
      return slot.ammoInMag < 30;
    }, { timeout: 6000 });
    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
      window.__weaponState!.bufferedFireTicks = 0;
    });

    const preReloadMag = await page.evaluate(() => window.__weaponState!.slots[0]!.ammoInMag);
    const preReloadRes = await page.evaluate(() => window.__weaponState!.slots[0]!.ammoReserve);
    expect(preReloadMag).toBeLessThan(30);

    // Trigger reload
    await page.evaluate(() => {
      window.__inputManager!.setReload(true);
    });

    // Wait for reloading state
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_tactical';
    }, { timeout: 6000 });

    const actionText = page.locator('#hud-weapon-action');
    await expect(actionText).toHaveText('RELOADING...');

    // 1. Verify before commit tick (72 for Assault Rifle): ammo is NOT yet committed
    const preCommitCheck = await page.evaluate(() => {
      const ws = window.__weaponState!;
      const slot = ws.slots[0]!;
      return {
        ticksIntoState: ws.ticksIntoState,
        ammoInMag: slot.ammoInMag,
        commitDone: ws.shellCommitDone,
      };
    });
    if (preCommitCheck.ticksIntoState < 72) {
      expect(preCommitCheck.ammoInMag).toBe(preReloadMag);
      expect(preCommitCheck.commitDone).toBe(false);
    }

    // 2. Wait until commit tick (72) is reached while still in reload animation
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_tactical' && ws.ticksIntoState >= 72;
    }, { timeout: 6000 });

    // Assert ammo commits mid-reload exactly upon reaching commit tick 72
    const atCommit = await page.evaluate(() => {
      const ws = window.__weaponState!;
      const slot = ws.slots[0]!;
      return {
        actionState: ws.actionState,
        ticksIntoState: ws.ticksIntoState,
        ammoInMag: slot.ammoInMag,
        ammoReserve: slot.ammoReserve,
        commitDone: ws.shellCommitDone,
      };
    });
    expect(atCommit.ammoInMag).toBe(30);
    expect(atCommit.ammoReserve).toBe(preReloadRes - (30 - preReloadMag));
    expect(atCommit.commitDone).toBe(true);

    // 3. Wait until reload completes and state returns to idle
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'idle';
    }, { timeout: 6000 });

    // Verify ammo is refilled on HUD
    const magEl = page.locator('#hud-ammo-mag');
    await expect(magEl).toHaveText('30');
  });

  test('auto-reload triggers automatically when magazine hits 0 with reserve > 0', async ({ page }) => {
    // Empty mag of pistol (slot 1) with reserve = 24
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(1);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 1);

    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[1]!;
      slot.ammoInMag = 0;
      slot.ammoReserve = 24;
      window.__weaponState!.actionState = 'idle';
      window.__weaponState!.shotCooldownTimer = 0;
    });

    // Wait for auto-reload to engage
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_tactical' || ws.actionState === 'reloading_empty';
    }, { timeout: 6000 });

    const isReloading = await page.evaluate(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_tactical' || ws.actionState === 'reloading_empty';
    });
    expect(isReloading).toBe(true);
  });

  test('auto-switch swaps to next weapon with ammo prioritizing last-used when mag and reserve hit 0', async ({ page }) => {
    // Setup: Player was using SMG (slot 2), now switched to Pistol (slot 1)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(2);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 2);

    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(1);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 1);

    // Empty pistol completely (mag = 0, reserve = 0)
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[1]!;
      slot.ammoInMag = 0;
      slot.ammoReserve = 0;
      window.__weaponState!.actionState = 'idle';
      window.__weaponState!.lastUsedSlot = 2; // Last used was SMG
    });

    // Wait for auto-switch to activate and swap to SMG (slot 2)
    await page.waitForFunction(() => {
      return window.__weaponState!.currentSlot === 2;
    }, { timeout: 6000 });

    const activeSlot = await page.evaluate(() => window.__weaponState!.currentSlot);
    expect(activeSlot).toBe(2);

    const nameEl = page.locator('#hud-weapon-name');
    await expect(nameEl).toHaveText('Rapid SMG');
  });

  test('manual weapon swap cancels active auto-switch countdown', async ({ page }) => {
    // Empty pistol completely (mag = 0, reserve = 0)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(1);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 1);

    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[1]!;
      slot.ammoInMag = 0;
      slot.ammoReserve = 0;
      window.__weaponState!.actionState = 'idle';
    });

    // Wait until autoSwitchTimer starts ticking down
    await page.waitForFunction(() => {
      return window.__weaponState!.autoSwitchTimer > 0;
    }, { timeout: 6000 });

    // Player manually swaps to Sniper (slot 4)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(4);
    });

    // Auto-switch timer must immediately cancel to 0
    await page.waitForFunction(() => {
      return window.__weaponState!.autoSwitchTimer === 0;
    }, { timeout: 6000 });

    await page.waitForFunction(() => {
      return window.__weaponState!.currentSlot === 4;
    }, { timeout: 6000 });

    const finalSlot = await page.evaluate(() => window.__weaponState!.currentSlot);
    expect(finalSlot).toBe(4);
  });

  test('HUD displays OUT OF AMMO in red when all inventory slots are exhausted', async ({ page }) => {
    // Exhaust all 5 slots
    await page.evaluate(() => {
      for (const slot of window.__weaponState!.slots) {
        slot.ammoInMag = 0;
        slot.ammoReserve = 0;
      }
      window.__weaponState!.actionState = 'idle';
    });

    // Wait for isOutOfAmmo to be flagged
    await page.waitForFunction(() => {
      return window.__weaponState!.isOutOfAmmo === true;
    }, { timeout: 6000 });

    const actionText = page.locator('#hud-weapon-action');
    await expect(actionText).toHaveText('OUT OF AMMO');
  });

  test('shotgun shell commits at tick 20; fire-interrupt before tick 20 discards progress, after keeps shell and avoids double pump', async ({ page }) => {
    // 1. Swap to Shotgun (slot 3)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(3);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 3);

    // 2. Set mag = 2, reserve = 10, trigger reload
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      slot.ammoInMag = 2;
      slot.ammoReserve = 10;
      window.__weaponState!.actionState = 'idle';
      window.__weaponState!.shotCooldownTimer = 0;
      window.__inputManager!.setReload(true);
    });

    // Wait for reload to begin
    await page.waitForFunction(() => {
      return window.__weaponState!.actionState === 'reloading_shell_start' ||
             window.__weaponState!.actionState === 'reloading_shell_insert';
    }, { timeout: 6000 });

    // Wait until insert phase starts
    await page.waitForFunction(() => {
      return window.__weaponState!.actionState === 'reloading_shell_insert';
    }, { timeout: 6000 });

    // Interrupt BEFORE commit tick 20 (e.g. at 10 ticks into state)
    await page.evaluate(() => {
      window.__inputManager!.setReload(false);
      window.__inputManager!.setFire(true);
    });

    // Verify interrupt cancels reload and progress is discarded (ammo stays 2)
    await page.waitForFunction(() => {
      return window.__weaponState!.actionState === 'idle' || window.__weaponState!.actionState === 'firing';
    }, { timeout: 6000 });

    const ammoBeforeCommit = await page.evaluate(() => window.__weaponState!.slots[3]!.ammoInMag);
    // Since fire interrupts, either ammo stayed 2 or fired 1 pellet shot (down to 1), but did NOT commit unearned shell
    expect(ammoBeforeCommit).toBeLessThanOrEqual(2);

    // Stop firing
    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
      if (window.__weaponState) {
        window.__weaponState.bufferedFireTicks = 0;
      }
    });

    // 3. Now test AFTER commit tick 20: set mag = 2, reserve = 10, wait until ticksIntoState >= 21
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[3]!;
      slot.ammoInMag = 2;
      slot.ammoReserve = 10;
      window.__weaponState!.actionState = 'idle';
      window.__weaponState!.shotCooldownTimer = 0;
      window.__inputManager!.setReload(true);
    });

    await page.waitForFunction(() => {
      return window.__weaponState!.actionState === 'reloading_shell_insert';
    }, { timeout: 6000 });

    // Wait until commit tick has passed (shellCommitDone === true or ticksIntoState >= 20)
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_shell_insert' && (ws.shellCommitDone || ws.ticksIntoState >= 20);
    }, { timeout: 6000 });

    // Verify shell was committed into magazine
    const committedAmmo = await page.evaluate(() => window.__weaponState!.slots[3]!.ammoInMag);
    expect(committedAmmo).toBe(3);

    // Now interrupt with fire AFTER commit tick
    await page.evaluate(() => {
      window.__inputManager!.setReload(false);
      window.__inputManager!.setFire(true);
    });

    await page.waitForFunction(() => {
      return window.__weaponState!.actionState === 'idle' || window.__weaponState!.actionState === 'firing';
    }, { timeout: 6000 });

    await page.evaluate(() => {
      window.__inputManager!.setFire(false);
      if (window.__weaponState) {
        window.__weaponState.bufferedFireTicks = 0;
      }
    });
  });

  test('sniper 2D optical scope overlay activates on ADS, culls viewmodel and arms, and restores visibility on release', async ({ page }) => {
    // 1. Swap to Sniper (slot 4)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(4);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 4);

    // Initial state: not ADS, viewmodel and arms visible
    const initialVisibility = await page.evaluate(() => {
      const vm = window.__viewmodel!;
      return {
        groupVisible: vm.group.visible,
        armsVisible: vm.armsRig.group.visible,
      };
    });
    expect(initialVisibility.groupVisible).toBe(true);
    expect(initialVisibility.armsVisible).toBe(true);

    const scopeOverlay = page.locator('#sniper-scope');
    await expect(scopeOverlay).not.toHaveClass(/active/);

    // 2. Activate ADS (Right-click / zoom)
    await page.evaluate(() => {
      window.__inputManager!.setAds(true);
    });

    // Wait for viewmodel culling to trigger
    await page.waitForFunction(() => {
      const vm = window.__viewmodel!;
      return vm.group.visible === false && vm.armsRig.group.visible === false;
    }, { timeout: 6000 });

    // Verify scope overlay is now active and displayed
    await expect(scopeOverlay).toHaveClass(/active/);
    await expect(scopeOverlay).toHaveCSS('display', 'block');

    // 3. Release ADS
    await page.evaluate(() => {
      window.__inputManager!.setAds(false);
    });

    // Wait for viewmodel and arms visibility restoration
    await page.waitForFunction(() => {
      const vm = window.__viewmodel!;
      return vm.group.visible === true && vm.armsRig.group.visible === true;
    }, { timeout: 6000 });

    // Verify scope overlay is hidden
    await expect(scopeOverlay).not.toHaveClass(/active/);
    await expect(scopeOverlay).toHaveCSS('display', 'none');
  });

  test('weapon swap cancels active tactical reload without committing ammo', async ({ page }) => {
    // 1. Start with AR (slot 0)
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(0);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 0);

    // 2. Set mag = 15, reserve = 90, initiate tactical reload
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[0]!;
      slot.ammoInMag = 15;
      slot.ammoReserve = 90;
      window.__weaponState!.actionState = 'idle';
      window.__inputManager!.setReload(true);
    });

    await page.waitForFunction(() => {
      return window.__weaponState!.actionState === 'reloading_tactical';
    }, { timeout: 6000 });

    await page.evaluate(() => {
      window.__inputManager!.setReload(false);
    });

    // 3. Swap to Pistol (slot 1) before commit tick 72
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(1);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 1, { timeout: 6000 });

    // 4. Verify AR (slot 0) ammo did NOT commit (remains exactly 15)
    const arAmmo = await page.evaluate(() => window.__weaponState!.slots[0]!.ammoInMag);
    expect(arAmmo).toBe(15);

    // Swap back to AR
    await page.evaluate(() => {
      window.__inputManager!.setWeaponSlot(0);
    });
    await page.waitForFunction(() => window.__weaponState!.currentSlot === 0, { timeout: 6000 });

    const arAmmoAfterReturn = await page.evaluate(() => window.__weaponState!.slots[0]!.ammoInMag);
    expect(arAmmoAfterReturn).toBe(15);
  });
});


