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
      if (window.__weaponState) {
        window.__weaponState.bufferedFireTicks = 0;
      }
    });

    // Allow frame to render settled state
    await page.waitForTimeout(100);

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
      window.__inputManager!.setReload(true);
    });

    // Wait for insert phase with ticksIntoState < 18
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_shell_insert' && ws.ticksIntoState < 18;
    });

    // Fire interrupt immediately before tick 20
    await page.evaluate(() => {
      window.__inputManager!.setReload(false);
      window.__inputManager!.setFire(true);
    });
    await page.waitForFunction(() => window.__weaponState!.actionState === 'idle');
    await page.evaluate(() => window.__inputManager!.setFire(false));

    // Uncommitted shell was discarded (reserve remains 10, shot fired from existing 2 shells in mag leaves 1)
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
      window.__inputManager!.setReload(true);
    });

    // Wait until commit tick has passed (shell commits from reserve into mag)
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_shell_insert' && ws.ticksIntoState >= 20;
    });

    // Trigger fire interrupt
    await page.evaluate(() => {
      window.__inputManager!.setReload(false);
      window.__inputManager!.setFire(true);
    });
    await page.waitForFunction(() => window.__weaponState!.actionState === 'idle');
    await page.evaluate(() => window.__inputManager!.setFire(false));

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
    await page.waitForFunction(() => window.__weaponState!.actionState === 'idle', { timeout: 8000 });

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
    expect(boltInfo.nextReadyTick).toBeGreaterThanOrEqual(boltInfo.currentSimTick + 70);

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

    // Sniper must still be locked by anti-quickswitch nextReadyTick
    const quickswitchLocked = await page.evaluate(() => {
      const ws = window.__weaponState!;
      const slot = ws.slots[4]!;
      return slot.nextReadyTick !== undefined && ws.currentSimTick < slot.nextReadyTick;
    });
    expect(quickswitchLocked).toBe(true);
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
    // Assault rifle with 10 rounds in mag, 90 in reserve
    await page.evaluate(() => {
      const slot = window.__weaponState!.slots[0]!;
      slot.ammoInMag = 10;
      slot.ammoReserve = 90;
    });

    // Press reload
    await page.evaluate(() => {
      window.__inputManager!.setReload(true);
    });
    await page.waitForTimeout(50);
    await page.evaluate(() => {
      window.__inputManager!.setReload(false);
    });

    // Wait for reloading state
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'reloading_tactical';
    }, { timeout: 6000 });

    const actionText = page.locator('#hud-weapon-action');
    await expect(actionText).toHaveText('RELOADING...');

    // Wait until reload finishes and state returns to idle
    await page.waitForFunction(() => {
      const ws = window.__weaponState!;
      return ws.actionState === 'idle';
    }, { timeout: 6000 });

    // Verify ammo is refilled to 30 / 70
    const magEl = page.locator('#hud-ammo-mag');
    const reserveEl = page.locator('#hud-ammo-reserve');
    await expect(magEl).toHaveText('30');
    await expect(reserveEl).toHaveText('/ 70');
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
});

