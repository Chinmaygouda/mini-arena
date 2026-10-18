// scripts/walker-verification-suite.mjs
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { FirstPersonControls } from '../src/player/firstPersonControls.ts';

function createControls() {
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1000);
  const domEl = { addEventListener: () => {} };
  return new FirstPersonControls(camera, domEl);
}

// ─── 3a. Validate the Walker with a Deliberately Broken Collider ──────────────
export function testBrokenColliderValidation() {
  const controls = createControls();
  controls.setBounds({ minX: -20, maxX: 20, minZ: -20, maxZ: 20 });

  // Deliberately broken collider: a 2m visual box at (0, 1, 0) with size [2, 2, 2],
  // but with a broken/offset collider shifted by 1m in X or with wrong half-extent
  // so that walking directly at (0, 0, 0) penetrates into the visual box footprint.
  const visualBox = { minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -1, maxZ: 1 };
  // Broken collider: shifted by 1.5m to the right, leaving the actual visual box uncollided on the left!
  const brokenCollider = { minX: 0.5, maxX: 2.5, minY: 0, maxY: 2, minZ: -1, maxZ: 1 };

  controls.setColliders([brokenCollider]);
  controls.setPosition(-3, 1.7, 0, -Math.PI / 2); // At (-3, 0), facing +X toward visual box
  controls.input.forward = true;

  const dt = 1 / 60;
  let detected = false;
  let penetrationFrame = -1;
  let penetratedPos = null;

  for (let f = 0; f < 60; f++) {
    controls.update(dt);
    const feetY = controls.position.y - 1.7;
    // Check if player center is inside the visual box footprint
    const inVisualX = controls.position.x > visualBox.minX && controls.position.x < visualBox.maxX;
    const inVisualZ = controls.position.z > visualBox.minZ && controls.position.z < visualBox.maxZ;
    const inVisualY = feetY < visualBox.maxY && (feetY + 1.7) > visualBox.minY;

    if (inVisualX && inVisualZ && inVisualY) {
      detected = true;
      penetrationFrame = f;
      penetratedPos = { x: controls.position.x, y: controls.position.y, z: controls.position.z, feetY };
      break;
    }
  }

  return {
    validationPassed: detected,
    penetrationFrame,
    penetratedPos,
    visualBox,
    brokenCollider
  };
}

// Run 3a
console.log('=== 3a: VALIDATING WALKER WITH DELIBERATELY BROKEN COLLIDER ===');
const brokenTest = testBrokenColliderValidation();
console.log(JSON.stringify(brokenTest, null, 2));
