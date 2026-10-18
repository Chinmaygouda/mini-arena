// tests/reloadChoreography.test.mjs
// Rigorous verification of weapon-specific reload choreographies,
// kinematic subgroups (hands, magazines, shells, slide, bolt, pump),
// empty vs tactical handling, shell-by-shell incremental accounting,
// and mid-reload interruption.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WeaponManager } from '../src/weapons/weaponManager.ts';
import { sound } from '../src/audio/soundManager.ts';
import { WEAPON_REGISTRY } from '../src/weapons/weaponTypes.ts';

function createTestWeaponManager() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  return new WeaponManager(scene, camera);
}

function stepTime(wm, seconds, dt = 1 / 60) {
  let elapsed = 0;
  while (elapsed < seconds) {
    const step = Math.min(dt, seconds - elapsed);
    wm.update(step, { x: 0, y: 0 }, false, false);
    elapsed += step;
  }
}

test('Pistol Empty Reload: workspace tilt, mag along slant, slide lock/release, full recovery', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('pistol');
  const def = WEAPON_REGISTRY.pistol;
  const pistol = wm.pistol;

  wm.setAmmo(0);
  wm.startReload();
  assert.equal(wm.state.isReloading, true);

  // Phase 1: Support hand drops toward pouch, slide locked back
  stepTime(wm, def.reloadDuration * 0.30);
  assert.ok(pistol.slideGroup.position.z > 0.035, 'Slide must be locked back during empty reload');
  assert.ok(pistol.magazineGroup.position.y < -0.075, 'Magazine must drop along slant');
  assert.ok(pistol.leftArmGroup.position.y < -0.10, 'Support arm must drop to pouch');

  // Phase 2: Mag insertion and slide release
  stepTime(wm, def.reloadDuration * 0.50); // around progress = 0.80
  assert.equal(pistol.slideGroup.position.z, 0, 'Slide must return to battery after slide release');

  // Complete reload
  stepTime(wm, def.reloadDuration * 0.30);
  assert.equal(wm.state.isReloading, false);
  assert.equal(wm.state.ammoInClip, def.magCapacity);
  assert.equal(pistol.slideGroup.position.z, 0);
  assert.equal(pistol.leftArmGroup.position.x, 0);
  assert.equal(pistol.leftArmGroup.position.y, 0);
  assert.equal(pistol.leftArmGroup.position.z, 0);
});

test('Pistol Tactical Reload: slide remains in battery, no slide release action', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('pistol');
  const def = WEAPON_REGISTRY.pistol;
  const pistol = wm.pistol;

  wm.setAmmo(7);
  wm.startReload();

  // Slide must never lock back during tactical reload
  stepTime(wm, def.reloadDuration * 0.30);
  assert.equal(pistol.slideGroup.position.z, 0, 'Slide must stay in battery during tactical reload');

  stepTime(wm, def.reloadDuration * 0.50);
  assert.equal(pistol.slideGroup.position.z, 0);

  stepTime(wm, def.reloadDuration * 0.30);
  assert.equal(wm.state.isReloading, false);
  assert.equal(wm.state.ammoInClip, def.magCapacity);
});

test('SMG Empty Reload: foregrip release, stick mag strip, bolt cycle, foregrip re-grasp', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('smg');
  const def = WEAPON_REGISTRY.smg;
  const smg = wm.smg;

  wm.setAmmo(0);
  wm.startReload();
  assert.equal(wm.state.isReloading, true);

  // Support hand moves back from foregrip to magwell
  stepTime(wm, def.reloadDuration * 0.15);
  assert.ok(smg.leftArmGroup.position.z > 0.05, 'Left arm must move back toward magwell');

  // Pulling empty stick mag downward
  stepTime(wm, def.reloadDuration * 0.20); // ~0.35
  assert.ok(smg.magazineGroup.position.y < -0.15, 'Stick mag must travel down magwell axis');

  // Bolt racks on empty reload (~0.70)
  stepTime(wm, def.reloadDuration * 0.35); // ~0.70
  assert.ok(smg.boltCarrierGroup.position.z > -0.02, 'Bolt carrier must rack back during empty SMG reload');

  // Completion
  stepTime(wm, def.reloadDuration * 0.40);
  assert.equal(wm.state.isReloading, false);
  assert.equal(wm.state.ammoInClip, def.magCapacity);
  assert.equal(smg.boltCarrierGroup.position.z, -0.02, 'Bolt carrier must return to battery');
  assert.equal(smg.leftArmGroup.position.x, 0, 'Left arm must return to foregrip');
  assert.equal(smg.leftArmGroup.position.y, 0);
  assert.equal(smg.leftArmGroup.position.z, 0);
});

test('SMG Tactical Reload: bolt remains in battery, smooth return to foregrip', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('smg');
  const def = WEAPON_REGISTRY.smg;
  const smg = wm.smg;

  wm.setAmmo(15);
  wm.startReload();

  stepTime(wm, def.reloadDuration * 0.70);
  assert.equal(smg.boltCarrierGroup.position.z, -0.02, 'Bolt must remain in battery during tactical reload');

  stepTime(wm, def.reloadDuration * 0.40);
  assert.equal(wm.state.isReloading, false);
  assert.equal(wm.state.ammoInClip, def.magCapacity);
  assert.equal(smg.leftArmGroup.position.z, 0);
});

test('Shotgun Empty Reload: 4 shell stages, incremental ammo commits, pump cycle', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('shotgun');
  const def = WEAPON_REGISTRY.shotgun;
  const shotgun = wm.shotgun;

  wm.setAmmo(0);
  wm.startReload();
  assert.equal(wm.state.isReloading, true);

  // Stage 0 commit (0.24) -> 2 shells committed
  stepTime(wm, def.reloadDuration * 0.26);
  assert.equal(wm.state.ammoInClip, 2, 'Stage 0 must commit 2 shells');

  // Stage 1 commit (0.40) -> 4 shells committed
  stepTime(wm, def.reloadDuration * 0.16);
  assert.equal(wm.state.ammoInClip, 4, 'Stage 1 must commit 2 shells (total 4)');

  // Stage 2 commit (0.56) -> 6 shells committed
  stepTime(wm, def.reloadDuration * 0.16);
  assert.equal(wm.state.ammoInClip, 6, 'Stage 2 must commit 2 shells (total 6)');

  // Stage 3 commit (0.72) -> 8 shells committed (capacity reached)
  stepTime(wm, def.reloadDuration * 0.16);
  assert.equal(wm.state.ammoInClip, 8, 'Stage 3 must commit 2 shells (total 8 = full)');

  // Stage 4+ : hand returns to pump and pump racks
  stepTime(wm, def.reloadDuration * 0.15); // ~0.89 (pump back)
  assert.ok(shotgun.pumpGroup.position.z > -0.26, 'Pump must rack back during empty reload');

  // Completion
  stepTime(wm, def.reloadDuration * 0.20);
  assert.equal(wm.state.isReloading, false);
  assert.equal(wm.state.ammoInClip, 8);
  assert.equal(shotgun.pumpGroup.position.z, -0.26, 'Pump must return forward in battery');
  assert.equal(shotgun.shellGroup.visible, false, 'Shell must be hidden after reload');
});

test('Shotgun Tactical Reload: stops early when tube is full, no pump cycle', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('shotgun');
  const def = WEAPON_REGISTRY.shotgun;
  const shotgun = wm.shotgun;

  wm.setAmmo(6);
  wm.startReload();

  // Stage 0 commits 2 shells at 0.24 -> clip becomes 8 (full!)
  stepTime(wm, def.reloadDuration * 0.30);
  assert.equal(wm.state.ammoInClip, 8, 'Should commit 2 shells to reach full capacity');

  // Advances early to pump return without cycling stages 1, 2, 3
  stepTime(wm, def.reloadDuration * 0.60);
  assert.equal(wm.state.isReloading, false);
  assert.equal(wm.state.ammoInClip, 8);
  assert.equal(shotgun.pumpGroup.position.z, -0.26, 'Tactical reload must not cycle pump');
});

test('Shotgun Low Reserve: stops when reserve is exhausted', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('shotgun');
  const def = WEAPON_REGISTRY.shotgun;

  // Set clip = 0, reserve = 1
  wm.ammoCounts.shotgun.clip = 0;
  wm.ammoCounts.shotgun.reserve = 1;
  wm.state.ammoInClip = 0;
  wm.state.reserveAmmo = 1;

  wm.startReload();

  // Commits 1 shell (reserve exhausted)
  stepTime(wm, def.reloadDuration * 0.30);
  assert.equal(wm.state.ammoInClip, 1);
  assert.equal(wm.state.reserveAmmo, 0);

  // Finishes and chambers that 1 shell
  stepTime(wm, def.reloadDuration * 0.60);
  assert.equal(wm.state.isReloading, false);
  assert.equal(wm.state.ammoInClip, 1);
  assert.equal(wm.state.reserveAmmo, 0);
});

test('Shotgun Mid-Reload Interruption by Firing: commits shells loaded so far, fires immediately', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('shotgun');
  const def = WEAPON_REGISTRY.shotgun;
  const shotgun = wm.shotgun;

  wm.setAmmo(0);
  wm.startReload();
  assert.equal(wm.state.isReloading, true);

  // Advance past stage 0 commit (0.24) -> clip becomes 2
  stepTime(wm, def.reloadDuration * 0.32);
  assert.equal(wm.state.ammoInClip, 2, 'Must have committed 2 shells');
  assert.equal(wm.state.isReloading, true);

  // Player interrupts reload by pulling trigger
  wm.setTrigger(true);

  // Must immediately cancel reload state and fire the loaded shell
  assert.equal(wm.state.isReloading, false, 'Reload must be cancelled immediately on fire');
  assert.equal(shotgun.shellGroup.visible, false, 'Shell must be hidden');
  assert.equal(shotgun.leftHandGroup.position.x, 0, 'Left hand must return to pump');
  assert.equal(shotgun.leftHandGroup.position.y, 0);
  assert.equal(shotgun.leftHandGroup.position.z, 0);

  // Update one frame to process the scheduled shot
  wm.update(0.016, { x: 0, y: 0 }, false, false);
  assert.equal(wm.state.ammoInClip, 1, 'Shot must fire immediately, consuming 1 shell (2 -> 1)');
});

test('Subgroups reset cleanly on weapon swap during reload', () => {
  const wm = createTestWeaponManager();
  wm.switchWeapon('pistol');
  wm.setAmmo(0);
  wm.startReload();

  // Step halfway into reload
  stepTime(wm, 1.0);
  assert.equal(wm.state.isReloading, true);

  // Swap to SMG mid-reload
  wm.switchWeapon('smg');
  assert.equal(wm.state.isReloading, false);
  assert.equal(wm.pistol.leftArmGroup.position.x, 0);
  assert.equal(wm.pistol.leftArmGroup.position.y, 0);
  assert.equal(wm.pistol.leftArmGroup.position.z, 0);
  assert.equal(wm.pistol.slideGroup.position.z, 0);

  // Swap to Shotgun and start reload
  wm.switchWeapon('shotgun');
  wm.setAmmo(0);
  wm.startReload();
  stepTime(wm, 0.5);

  // Swap back to pistol
  wm.switchWeapon('pistol');
  assert.equal(wm.state.isReloading, false);
  assert.equal(wm.shotgun.shellGroup.visible, false);
  assert.equal(wm.shotgun.pumpGroup.position.z, -0.26);
  assert.equal(wm.shotgun.leftHandGroup.position.x, 0);
  assert.equal(wm.shotgun.leftHandGroup.position.y, 0);
  assert.equal(wm.shotgun.leftHandGroup.position.z, 0);
});
