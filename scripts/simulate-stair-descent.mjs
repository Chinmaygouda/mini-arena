// scripts/simulate-stair-descent.mjs
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

// whSW stairs: from z = -3.5 to z = -10 at x = -26.25.
// Step 1: Start at base of whSW stairs
console.log('--- CLIMBING UP whSW STAIRS ---');
controls.setPosition(-26.25, 1.7, -3.5, 0); // facing -Z
controls.input.forward = true;

const dt = 1/60;
let topReached = false;
for (let f = 0; f < 120; f++) {
  controls.update(dt);
  if (f % 10 === 0 || controls.position.z <= -9.5) {
    console.log(`Frame ${f}: pos=(${controls.position.x.toFixed(2)}, ${controls.position.y.toFixed(2)}, ${controls.position.z.toFixed(2)}), feetY=${(controls.position.y - 1.7).toFixed(2)}, grounded=${controls.isGrounded}, velY=${controls.velocity.y.toFixed(2)}`);
  }
  if (controls.position.z <= -9.8) {
    topReached = true;
    break;
  }
}

console.log('\n--- AT TOP: TURNING AROUND AND WALKING DOWN ---');
// Turn 180 degrees to face +Z
controls.yaw = Math.PI;
controls.input.forward = true;

let blockedOrPushed = false;
let prevZ = controls.position.z;

for (let f = 0; f < 120; f++) {
  const zBefore = controls.position.z;
  controls.update(dt);
  const zAfter = controls.position.z;
  const deltaZ = zAfter - zBefore;

  if (f % 5 === 0 || deltaZ < 0.001) {
    console.log(`Descend Frame ${f}: pos=(${controls.position.x.toFixed(2)}, ${controls.position.y.toFixed(2)}, ${controls.position.z.toFixed(2)}), feetY=${(controls.position.y - 1.7).toFixed(2)}, grounded=${controls.isGrounded}, velY=${controls.velocity.y.toFixed(2)}, deltaZ=${deltaZ.toFixed(4)}`);
  }

  if (deltaZ <= 0.0001 && controls.position.z < -4.0 && f > 10) {
    console.log(`BLOCKED OR PUSHED BACK at frame ${f}! Position: z=${controls.position.z.toFixed(2)}, feetY=${(controls.position.y - 1.7).toFixed(2)}`);
    blockedOrPushed = true;
    break;
  }
}
