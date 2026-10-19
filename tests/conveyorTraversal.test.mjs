// tests/conveyorTraversal.test.mjs
// Automated verification for Player Jumping and Conveyor Rail Collision in Warehouse Section 3

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {
  FirstPersonControls,
  PLAYER_RADIUS,
  PLAYER_EYE_H,
  PLAYER_CROUCH_EYE_H,
  STEP_UP_MAX,
} from '../src/player/firstPersonControls.ts';
import { BlueprintMapLoader } from '../src/environment/blueprintMapLoader.ts';

// Mock minimal DOM element for FirstPersonControls constructor in Node
function createMockControls() {
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  const domElement = {
    addEventListener: () => {},
    removeEventListener: () => {},
    requestPointerLock: () => {},
  };
  const controls = new FirstPersonControls(camera, domElement);
  return { camera, controls };
}

test('1. Warehouse Section 3 Blueprint: Conveyor Collision Classification', () => {
  const rawData = JSON.parse(fs.readFileSync('public/maps/warehouse_layout.json', 'utf8'));
  const section3 = rawData.boxes.filter((b) => b.zone === 'section3');
  assert.equal(section3.length, 203, 'Section 3 contains exactly 203 boxes');

  // Decorative side rails: non-colliding
  const sideRails = section3.filter((b) => b.kind === 'conveyor-side-rail');
  assert.equal(sideRails.length, 8, '8 side rails exist');
  for (const rail of sideRails) {
    assert.equal(rail.category, 'DECORATIVE', `${rail.id} must be categorized as DECORATIVE`);
    assert.equal(rail.collision, false, `${rail.id} must have collision disabled`);
  }

  // Walkable conveyor belts
  const belts = section3.filter((b) => b.kind === 'conveyor-belt' || b.kind === 'sorter-branch-belt');
  assert.equal(belts.length, 4, '1 main conveyor belt + 3 branch belts');
  for (const belt of belts) {
    assert.equal(belt.category, 'WALKABLE', `${belt.id} must be categorized as WALKABLE`);
    assert.equal(belt.walkable, true, `${belt.id} must have walkable set to true`);
  }

  // Solid structural frames
  const frames = section3.filter((b) => b.kind === 'conveyor-frame' || b.kind === 'sorter-branch-frame');
  assert.equal(frames.length, 4, '1 main conveyor frame + 3 branch frames');
  for (const frame of frames) {
    assert.equal(frame.category, 'SOLID', `${frame.id} must be categorized as SOLID`);
    assert.notEqual(frame.collision, false, `${frame.id} must remain collidable`);
  }

  // Support legs
  const supports = section3.filter((b) => b.kind === 'conveyor-support');
  assert.equal(supports.length, 32, '32 conveyor support legs');
  for (const support of supports) {
    assert.equal(support.category, 'SUPPORT', `${support.id} must be categorized as SUPPORT`);
    assert.notEqual(support.collision, false, `${support.id} must remain collidable`);
  }

  // Barcode scanner arch posts straddle the conveyor belt (not placed down the center)
  const post1 = section3.find((b) => b.id === 's3-scanner-post-24.5');
  const post2 = section3.find((b) => b.id === 's3-scanner-post-25.5');
  assert.ok(post1 && post2, 'Both scanner posts exist');
  assert.equal(post1.category, 'SUPPORT');
  assert.equal(post2.category, 'SUPPORT');
  // Posts should sit on the south (Z ~ -20.12) and north (Z ~ -18.88) sides of the belt (Z = -19.5)
  assert.ok(post1.center[2] < -19.8, 'Post 1 sits south of belt');
  assert.ok(post2.center[2] > -19.2, 'Post 2 sits north of belt');
  const postClearanceZ = Math.abs(post2.center[2] - post1.center[2]);
  assert.ok(postClearanceZ > 1.1, `Clearance between arch posts must accommodate player: got ${postClearanceZ.toFixed(2)}m`);
});

test('2. Loader translates Section 3 boxes into colliders with explicit categories and walkable flags', () => {
  const loader = new BlueprintMapLoader();
  const rawData = JSON.parse(fs.readFileSync('public/maps/warehouse_layout.json', 'utf8'));
  const colliders = [];
  const mapGroup = new THREE.Group();
  const lightsGroup = new THREE.Group();
  const getMaterial = () => new THREE.MeshBasicMaterial();

  loader['expandBoxes'](rawData, colliders, mapGroup, getMaterial, 'warehouse');

  // Decorative side rails must NOT generate BoxCollider obstacles
  const railColliders = colliders.filter((c) => c.category === 'DECORATIVE');
  assert.equal(railColliders.length, 0, 'No DECORATIVE colliders should be registered');

  // Conveyor belt colliders must have isWalkable === true and category === WALKABLE
  const beltColliders = colliders.filter((c) => c.category === 'WALKABLE');
  assert.ok(beltColliders.length >= 4, 'Walkable belt colliders registered');
  for (const c of beltColliders) {
    assert.equal(c.isWalkable, true, 'Walkable colliders must have isWalkable: true');
  }

  // Support legs have category SUPPORT
  const supportColliders = colliders.filter((c) => c.category === 'SUPPORT');
  assert.ok(supportColliders.length >= 32, 'Support colliders registered');
});

test('3. Player can jump over low obstacle and land on solid conveyor belt', () => {
  const { controls } = createMockControls();
  controls.setBounds({ minX: 0, maxX: 40, minZ: -40, maxZ: 0 });

  // Main conveyor belt at X=22, Z=-19.5, top Y=1.06m
  // Frame at Y=0.64 to 0.92m
  const conveyorBeltCollider = {
    minX: 12.6,
    maxX: 31.4,
    minY: 0.64,
    maxY: 1.06,
    minZ: -20.06,
    maxZ: -18.94,
    isWalkable: true,
    category: 'WALKABLE',
  };
  controls.setColliders([conveyorBeltCollider]);

  // Position player on floor just south of the conveyor at Z = -18.0, facing North (-Z)
  controls.setPosition(20.0, PLAYER_EYE_H, -18.0, 0); // yaw 0 = facing -Z
  assert.equal(controls.isGrounded, true);
  assert.equal(controls.position.y, PLAYER_EYE_H);

  // Jump forward toward the conveyor (holding KeyW and Space)
  controls.input.forward = true;
  controls.input.jump = true;

  const dt = 1 / 60;
  let maxFeetY = 0;
  let landedOnConveyor = false;
  let landedFeetY = 0;

  for (let frame = 0; frame < 50; frame++) {
    controls.update(dt);
    const feetY = controls.position.y - controls.getEyeHeight();
    if (feetY > maxFeetY) maxFeetY = feetY;

    if (controls.isGrounded && Math.abs(feetY - 1.06) < 0.05) {
      landedOnConveyor = true;
      landedFeetY = feetY;
    }
  }

  // Peak jump height must exceed 1.06m conveyor height
  assert.ok(maxFeetY > 1.06, `Peak jump height must clear 1.06m: got ${maxFeetY.toFixed(2)}m`);

  // Player must have landed and become grounded on the conveyor during the jump
  assert.equal(landedOnConveyor, true, 'Player should have landed and become grounded on the conveyor deck');
  assert.ok(Math.abs(landedFeetY - 1.06) < 0.05, `Landed feet height must match conveyor deck (1.06m), got ${landedFeetY.toFixed(3)}m`);
});

test('4. Player can run along the conveyor belt without falling through', () => {
  const { controls } = createMockControls();
  controls.setBounds({ minX: 0, maxX: 40, minZ: -40, maxZ: 0 });

  const conveyorBeltCollider = {
    minX: 12.6,
    maxX: 31.4,
    minY: 0.64,
    maxY: 1.06,
    minZ: -20.06,
    maxZ: -18.94,
    isWalkable: true,
    category: 'WALKABLE',
  };
  controls.setColliders([conveyorBeltCollider]);

  // Spawn player directly on top of the conveyor at X=14.0, feet at 1.06, eye at 1.06 + 1.70 = 2.76
  controls.setPosition(14.0, 1.06 + PLAYER_EYE_H, -19.5, -Math.PI / 2); // yaw -PI/2 = facing +X

  const dt = 1 / 60;
  controls.update(dt);
  assert.equal(controls.isGrounded, true);

  // Run forward along the conveyor (+X direction) for 60 frames (~1.0s)
  controls.input.forward = true;
  for (let frame = 0; frame < 60; frame++) {
    controls.update(dt);
    const feetY = controls.position.y - controls.getEyeHeight();
    assert.ok(Math.abs(feetY - 1.06) < 0.05, `Feet must remain supported on conveyor (frame ${frame}, feetY=${feetY.toFixed(3)})`);
    assert.equal(controls.isGrounded, true, `Player must stay grounded on conveyor (frame ${frame})`);
  }

  assert.ok(controls.position.x > 17.5, `Player should have advanced along +X: got x=${controls.position.x.toFixed(2)}`);
});

test('5. Traversing between separated support legs (3m clearance gap)', () => {
  const { controls } = createMockControls();
  controls.setBounds({ minX: 0, maxX: 40, minZ: -40, maxZ: 0 });

  // Two legs at X=16 and X=19, both at Z=-20.05, size 0.12x0.8x0.12
  const leg1 = { minX: 15.94, maxX: 16.06, minY: 0, maxY: 0.8, minZ: -20.11, maxZ: -19.99, isWalkable: false, category: 'SUPPORT' };
  const leg2 = { minX: 18.94, maxX: 19.06, minY: 0, maxY: 0.8, minZ: -20.11, maxZ: -19.99, isWalkable: false, category: 'SUPPORT' };
  controls.setColliders([leg1, leg2]);

  // Player walks through the middle at X=17.5 from Z=-21.5 to Z=-18.5 (facing +Z, yaw = Math.PI)
  controls.setPosition(17.5, PLAYER_EYE_H, -21.5, Math.PI);
  controls.input.forward = true;

  const dt = 1 / 60;
  for (let frame = 0; frame < 60; frame++) {
    controls.update(dt);
  }

  assert.ok(controls.position.z > -19.0, `Player must pass through 3m leg opening cleanly: final Z=${controls.position.z.toFixed(2)}`);
  assert.equal(controls.getCollidingCount(), 0, 'No stuck collision with legs');
});

test('6. Solid conveyor frame blocks walking through at floor level', () => {
  const { controls } = createMockControls();
  controls.setBounds({ minX: 0, maxX: 40, minZ: -40, maxZ: 0 });

  // Conveyor frame at Y=0.64 to 0.92, solid deck
  const frameCollider = {
    minX: 12.6,
    maxX: 31.4,
    minY: 0.64,
    maxY: 0.92,
    minZ: -20.06,
    maxZ: -18.94,
    isWalkable: false,
    category: 'SOLID',
  };
  controls.setColliders([frameCollider]);

  // Player at floor level Z=-18.0 walking toward -Z into the frame WITHOUT jumping
  controls.setPosition(20.0, PLAYER_EYE_H, -18.0, 0); // facing -Z
  controls.input.forward = true;

  const dt = 1 / 60;
  for (let frame = 0; frame < 60; frame++) {
    controls.update(dt);
  }

  // Frame starts at Z = -18.94. Player radius is 0.35. Minimum allowed Z without clipping is -18.94 + 0.35 = -18.59.
  assert.ok(controls.position.z >= -18.60, `Conveyor frame must block player walking through: z=${controls.position.z.toFixed(2)}`);
});

test('7. Crouch-walking under overhead barcode scanner arch while on conveyor', () => {
  const { controls } = createMockControls();
  controls.setBounds({ minX: 0, maxX: 40, minZ: -40, maxZ: 0 });

  // Conveyor belt at Y=1.06m
  const belt = { minX: 20, maxX: 30, minY: 0.64, maxY: 1.06, minZ: -20.06, maxZ: -18.94, isWalkable: true, category: 'WALKABLE' };
  // Arch top at X=25, center Y=2.55, size Y=0.14 -> underside minY = 2.48m
  const archTop = { minX: 24.4, maxX: 25.6, minY: 2.48, maxY: 2.62, minZ: -20.2, maxZ: -18.8, isWalkable: false, category: 'SOLID' };
  // Arch posts at Z=-20.12 and Z=-18.88 (straddling the belt)
  const postSouth = { minX: 24.94, maxX: 25.06, minY: 1.06, maxY: 2.55, minZ: -20.18, maxZ: -20.06, isWalkable: false, category: 'SUPPORT' };
  const postNorth = { minX: 24.94, maxX: 25.06, minY: 1.06, maxY: 2.55, minZ: -18.94, maxZ: -18.82, isWalkable: false, category: 'SUPPORT' };

  controls.setColliders([belt, archTop, postSouth, postNorth]);

  // Position player standing on conveyor at X=23.5, Z=-19.5, facing +X (yaw = -Math.PI / 2)
  controls.setPosition(23.5, 1.06 + PLAYER_EYE_H, -19.5, -Math.PI / 2);
  controls.update(1 / 60);

  // Case A: Standing player runs into arch -> blocked because head (1.06 + 1.85 = 2.91m) > 2.48m
  controls.input.forward = true;
  for (let frame = 0; frame < 30; frame++) {
    controls.update(1 / 60);
  }
  // Arch top starts at X=24.4. Standing player must be blocked before penetrating X=24.4
  assert.ok(controls.position.x < 24.2, `Standing player must be blocked by low arch: x=${controls.position.x.toFixed(2)}`);

  // Case B: Player crouches -> height drops to 1.15m (head at 1.06 + 1.15 = 2.21m < 2.48m)
  controls.input.crouch = true;
  for (let frame = 0; frame < 80; frame++) {
    controls.update(1 / 60);
  }

  // Crouching player passes cleanly under the arch!
  assert.ok(controls.position.x > 26.0, `Crouching player must pass under arch: x=${controls.position.x.toFixed(2)}`);
  assert.equal(controls.isGrounded, true, 'Player remains grounded on conveyor');
});

test('8. Forward and diagonal jumps preserve horizontal momentum', () => {
  const { controls } = createMockControls();
  controls.setBounds({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });

  // Low rail at Z = -2.0, top Y = 0.5m
  const rail = { minX: -5, maxX: 5, minY: 0, maxY: 0.5, minZ: -2.1, maxZ: -1.9, isWalkable: true, category: 'SOLID' };
  controls.setColliders([rail]);

  // Jump diagonally (KeyW + KeyD) starting from Z = 0
  controls.setPosition(0, PLAYER_EYE_H, 0, 0); // facing -Z
  controls.input.forward = true;
  controls.input.right = true;
  controls.input.jump = true;

  const dt = 1 / 60;
  for (let frame = 0; frame < 60; frame++) {
    controls.update(dt);
  }

  // Player must have crossed past the rail (Z < -2.1) and moved right (+X > 1.0)
  assert.ok(controls.position.z < -2.5, `Player jumped forward across rail: z=${controls.position.z.toFixed(2)}`);
  assert.ok(controls.position.x > 1.0, `Player maintained diagonal momentum: x=${controls.position.x.toFixed(2)}`);
  assert.equal(controls.isGrounded, true, 'Player landed cleanly on other side');
});
