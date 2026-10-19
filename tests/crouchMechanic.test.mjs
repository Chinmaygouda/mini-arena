// tests/crouchMechanic.test.mjs
// Comprehensive automated test suite for the FPS Crouch Mechanic:
// Tests stance transitions, collider height changes, crouch speeds, swept wall collision,
// low clearance pass-through, overhead clearance safeguards, jump suppression, and rapid input stability.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  FirstPersonControls,
  PLAYER_EYE_H,
  PLAYER_CROUCH_EYE_H,
  PLAYER_HEAD_M,
  PLAYER_RADIUS,
  PLAYER_WALK_SPEED,
  PLAYER_SPRINT_SPEED,
  PLAYER_CROUCH_SPEED,
} from '../src/player/firstPersonControls.ts';
import { WeaponManager } from '../src/weapons/weaponManager.ts';

function createMockControls() {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  const domElement = {
    addEventListener: () => {},
    removeEventListener: () => {},
    requestPointerLock: () => {},
  };
  const controls = new FirstPersonControls(camera, domElement);
  controls.setBounds({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
  controls.setColliders([]);
  controls.setPosition(0, PLAYER_EYE_H, 0);
  return { controls, camera };
}

test('1. Stance transition: Pressing C smoothly lowers eye height and collider to crouched dimensions', () => {
  const { controls } = createMockControls();

  assert.equal(controls.isCrouching, false);
  assert.equal(controls.getEyeHeight(), PLAYER_EYE_H);
  assert.equal(controls.getEffectiveColliderHeight(), PLAYER_EYE_H + PLAYER_HEAD_M); // 1.85m

  // Simulate pressing C
  controls.input.crouch = true;

  // Step simulation for 0.3s (18 frames at 60fps)
  const dt = 1 / 60;
  for (let i = 0; i < 18; i++) {
    controls.update(dt);
  }

  assert.equal(controls.isCrouching, true);
  assert.ok(Math.abs(controls.getEyeHeight() - PLAYER_CROUCH_EYE_H) < 0.02, `Expected eyeHeight ~1.0m, got ${controls.getEyeHeight()}`);
  assert.ok(
    Math.abs(controls.getEffectiveColliderHeight() - (PLAYER_CROUCH_EYE_H + PLAYER_HEAD_M)) < 0.02,
    `Expected collider height ~1.15m, got ${controls.getEffectiveColliderHeight()}`
  );

  // Feet must stay planted on floor at y = 0
  const feetY = controls.position.y - controls.getEyeHeight();
  assert.ok(Math.abs(feetY) < 0.001, `Feet Y must remain at 0, got ${feetY}`);
});

test('2. Locomotion while crouched: move at 2.4 m/s and sprint is strictly disallowed', () => {
  const { controls } = createMockControls();

  controls.input.crouch = true;
  controls.input.forward = true;
  controls.input.sprint = true; // Attempt to sprint while crouched

  const dt = 1 / 60;
  // Step for 1 second
  for (let i = 0; i < 60; i++) {
    controls.update(dt);
  }

  assert.equal(controls.isCrouching, true);
  assert.equal(controls.isSprinting, false, 'Sprinting must be disabled while crouched');
  assert.ok(
    Math.abs(controls.getHorizontalSpeed() - PLAYER_CROUCH_SPEED) < 0.1,
    `Speed must be crouch speed ~2.4 m/s, got ${controls.getHorizontalSpeed()}`
  );
});

test('3. Wall collision: Player cannot pass through solid walls while crouching', () => {
  const { controls } = createMockControls();

  // Solid wall at X = 2.0 (from Y=0 to Y=4.0, thickness 0.5)
  controls.setColliders([
    { minX: 1.75, maxX: 2.25, minY: 0, maxY: 4.0, minZ: -5, maxZ: 5 },
  ]);
  controls.setPosition(0, PLAYER_EYE_H, 0);

  controls.input.crouch = true;
  controls.input.right = true; // Move towards X = 2.0

  const dt = 1 / 60;
  for (let i = 0; i < 60; i++) {
    controls.update(dt);
  }

  // Player radius is 0.35, wall minX is 1.75 -> player must be stopped at X <= 1.40
  assert.ok(controls.position.x <= 1.4001, `Player must be blocked before wall at x=1.4, got ${controls.position.x}`);
});

test('4. Low clearance pass-through: Crouched player can walk under 1.4m beam that blocks standing player', () => {
  const { controls } = createMockControls();

  // Overhead beam spanning X: [1.8 .. 2.2], Y: [1.4 .. 2.5]
  // Standing player (height 1.85m) hits beam at Y=1.4m.
  // Crouched player (height 1.15m) has clearance under Y=1.4m!
  controls.setColliders([
    { minX: 1.8, maxX: 2.2, minY: 1.4, maxY: 2.5, minZ: -5, maxZ: 5 },
  ]);

  // Phase A: Standing player tries to walk through beam
  controls.setPosition(0, PLAYER_EYE_H, 0);
  controls.input.right = true; // move towards +X
  const dt = 1 / 60;
  for (let i = 0; i < 60; i++) {
    controls.update(dt);
  }
  assert.ok(controls.position.x <= 1.45, `Standing player must be blocked by low beam, got x=${controls.position.x}`);

  // Phase B: Crouched player walks under the beam
  controls.setPosition(0, PLAYER_EYE_H, 0);
  controls.input.crouch = true;
  controls.input.right = true;
  for (let i = 0; i < 120; i++) {
    controls.update(dt);
  }
  assert.ok(controls.position.x > 2.5, `Crouched player must walk through underneath beam, got x=${controls.position.x}`);
});

test('5. Overhead clearance safeguard: Player cannot stand up when under a low obstacle', () => {
  const { controls } = createMockControls();

  // Low obstacle overhead at X: [-2 .. 2], Y: [1.4 .. 2.5], Z: [-2 .. 2]
  controls.setColliders([
    { minX: -2, maxX: 2, minY: 1.4, maxY: 2.5, minZ: -2, maxZ: 2 },
  ]);

  // Player starts crouched directly underneath the obstacle
  controls.setPosition(0, PLAYER_CROUCH_EYE_H, 0);
  controls.input.crouch = true;
  controls.update(1 / 60);

  assert.equal(controls.hasOverheadObstruction(), true, 'hasOverheadObstruction must detect overhead beam');

  // Player releases C (wants to stand up)
  controls.input.crouch = false;

  // Update for 30 frames
  const dt = 1 / 60;
  for (let i = 0; i < 30; i++) {
    controls.update(dt);
  }

  // Must remain crouched because overhead clearance is blocked!
  assert.equal(controls.isOverheadBlocked, true, 'isOverheadBlocked must be true');
  assert.equal(controls.isCrouching, true, 'Player must remain crouched while under low obstacle');
  assert.ok(controls.getEyeHeight() <= 1.05, `Eye height must not expand into obstacle, got ${controls.getEyeHeight()}`);
});

test('6. Uncrouch clearance restoration: Player automatically stands up once clear of overhead obstacle', () => {
  const { controls } = createMockControls();

  // Low obstacle overhead at X: [-2 .. 2], Y: [1.4 .. 2.5], Z: [-2 .. 2]
  controls.setColliders([
    { minX: -2, maxX: 2, minY: 1.4, maxY: 2.5, minZ: -2, maxZ: 2 },
  ]);

  // Player starts standing, then crouches underneath the obstacle
  controls.setPosition(0, PLAYER_EYE_H, 0);
  controls.input.crouch = true;
  const dt = 1 / 60;
  for (let i = 0; i < 30; i++) {
    controls.update(dt);
  }
  assert.equal(controls.isCrouching, true, 'Player crouched');

  // Player releases C while still under the obstacle
  controls.input.crouch = false;
  controls.update(dt);
  assert.equal(controls.isOverheadBlocked, true, 'Blocked overhead');
  assert.equal(controls.isCrouching, true, 'Player must remain crouched while under obstacle');

  // Now walk out from under the obstacle along +X
  controls.input.right = true;
  for (let i = 0; i < 120; i++) {
    controls.update(dt);
  }

  // Once at X > 2.5 (out from under beam), overhead clearance is open!
  assert.ok(controls.position.x > 2.35, `Player moved out, x=${controls.position.x}`);
  assert.equal(controls.isOverheadBlocked, false, 'Overhead is now clear');
  assert.equal(controls.isCrouching, false, 'Player safely returned to standing stance');
  assert.ok(Math.abs(controls.getEyeHeight() - PLAYER_EYE_H) < 0.05, `Eye height returned to ~1.7m, got ${controls.getEyeHeight()}`);
});

test('7. Jump behavior: Jump is suppressed under low ceiling, but uncrouches in open areas', () => {
  const { controls } = createMockControls();

  // Case A: Under low ceiling
  controls.setColliders([
    { minX: -2, maxX: 2, minY: 1.4, maxY: 2.5, minZ: -2, maxZ: 2 },
  ]);
  controls.setPosition(0, PLAYER_EYE_H, 0);
  controls.input.crouch = true;
  const dt = 1 / 60;
  for (let i = 0; i < 20; i++) {
    controls.update(dt);
  }

  // Press jump while obstructed
  controls.input.jump = true;
  controls.update(dt);

  assert.equal(controls.velocity.y, 0, 'Jump velocity must be suppressed under low ceiling');
  assert.equal(controls.isGrounded, true);

  // Case B: In open area with clearance
  controls.setColliders([]);
  controls.input.jump = true;
  controls.update(dt);

  assert.ok(controls.velocity.y > 4.5, `Jump velocity must activate in open area (got ${controls.velocity.y})`);
  assert.equal(controls.isGrounded, false);
});

test('8. Rapid input stability: Rapidly alternating C 60 times does not cause camera jumps or desync', () => {
  const { controls } = createMockControls();

  const dt = 1 / 60;
  for (let i = 0; i < 60; i++) {
    controls.input.crouch = (i % 2 === 0);
    controls.update(dt);

    assert.ok(!Number.isNaN(controls.position.x), 'Position X must be a valid number');
    assert.ok(!Number.isNaN(controls.position.y), 'Position Y must be a valid number');
    assert.ok(!Number.isNaN(controls.position.z), 'Position Z must be a valid number');
    assert.ok(controls.getEyeHeight() >= PLAYER_CROUCH_EYE_H - 0.01 && controls.getEyeHeight() <= PLAYER_EYE_H + 0.01);
  }
});

test('9. Weapon alignment: Viewmodel camera position matches crouched eye height', () => {
  const { controls, camera } = createMockControls();

  controls.setPosition(5.0, PLAYER_EYE_H, -3.0);
  controls.input.crouch = true;

  const dt = 1 / 60;
  for (let i = 0; i < 30; i++) {
    controls.update(dt);
  }

  // Camera world Y should match crouched position Y
  assert.ok(Math.abs(camera.position.y - controls.position.y) < 0.02, `Camera Y (${camera.position.y}) must match crouched Y (${controls.position.y})`);
  assert.ok(camera.position.y < 1.05, `Camera Y must be at crouched eye height (<1.05m), got ${camera.position.y}`);
});
