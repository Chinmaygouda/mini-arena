// scripts/simulate-jump-into-box.mjs
import fs from 'fs';
import * as THREE from 'three';
import { FirstPersonControls } from '../src/player/firstPersonControls.ts';

const data = JSON.parse(fs.readFileSync('public/maps/foundry_yard.json', 'utf8'));
const colliders = [];
data.boxes.forEach(box => {
  if (box.kind === 'roof') return;
  const [w, h, d] = box.size;
  const [cx, cy, cz] = box.center;
  colliders.push({
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minY: cy - h / 2,
    maxY: cy + h / 2,
    minZ: cz - d / 2,
    maxZ: cz + d / 2,
    isWalkable: box.kind === 'stair' || box.kind === 'stairs' || box.kind === 'platform'
  });
});

const camera = new THREE.PerspectiveCamera(75, 16/9, 0.1, 1000);
const domEl = { addEventListener: () => {} };
const controls = new FirstPersonControls(camera, domEl);
controls.setBounds({ minX: -50, maxX: 50, minZ: -50, maxZ: 50 });
controls.setColliders(colliders);

// Let's test jumping toward a box:
// Box: wh_c1: center: [ -17, 0.9, -12 ] size: [ 2.4, 1.8, 2.4 ]
// Bounds: minX = -18.2, maxX = -15.8, minY = 0, maxY = 1.8, minZ = -13.2, maxZ = -10.8
// Mezzanine edge is at x = -24.5 to -28, y = 3.2.
// Suppose player jumps from platform/height (e.g. x = -19.5, y = 3.5, z = -12) towards the box wh_c1 (facing +X)
console.log('--- JUMPING TOWARD BOX wh_c1 (top: 1.8m) ---');
controls.setPosition(-19.5, 3.5, -12, 0); // feetY = 1.8, player moving +X toward box
controls.velocity.set(4.0, 2.0, 0); // jumping towards +X
controls.isGrounded = false;

const dt = 1/60;
for (let f = 0; f < 60; f++) {
  controls.update(dt);
  const feetY = controls.position.y - 1.7;
  const insideX = controls.position.x > -18.2 && controls.position.x < -15.8;
  const insideZ = controls.position.z > -13.2 && controls.position.z < -10.8;
  const insideY = feetY < 1.8 && feetY >= 0;

  if (insideX && insideZ && insideY) {
    console.log(`PENETRATION DETECTED at frame ${f}! Player is INSIDE box wh_c1: pos=(${controls.position.x.toFixed(2)}, ${controls.position.y.toFixed(2)}, ${controls.position.z.toFixed(2)}), feetY=${feetY.toFixed(2)}, vel=(${controls.velocity.x.toFixed(2)}, ${controls.velocity.y.toFixed(2)})`);
    break;
  }
  if (f % 10 === 0) {
    console.log(`Frame ${f}: pos=(${controls.position.x.toFixed(2)}, ${controls.position.y.toFixed(2)}, ${controls.position.z.toFixed(2)}), feetY=${feetY.toFixed(2)}, velX=${controls.velocity.x.toFixed(2)}, velY=${controls.velocity.y.toFixed(2)}, grounded=${controls.isGrounded}`);
  }
}
