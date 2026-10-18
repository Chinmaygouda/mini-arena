// scripts/measure-stair-camera.mjs
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

console.log('=== ASCENDING whSW STAIRS ON FOUNDRY_YARD ===');
controls.setPosition(-26.25, 1.7, -3.9, 0); // facing -Z
controls.input.forward = true;

const dt = 1/60;
let prevCamY = camera.position.y;
let prevPosY = controls.position.y;
let maxCamDeltaYAscent = 0;
let maxBodyDeltaYAscent = 0;

for (let f = 0; f < 80; f++) {
  controls.update(dt);
  const camY = camera.position.y;
  const posY = controls.position.y;

  const dCam = Math.abs(camY - prevCamY);
  const dPos = Math.abs(posY - prevPosY);
  if (f > 1 && dCam > maxCamDeltaYAscent) maxCamDeltaYAscent = dCam;
  if (f > 1 && dPos > maxBodyDeltaYAscent) maxBodyDeltaYAscent = dPos;

  if (f % 5 === 0) {
    console.log(`Ascend Frame ${f}: pos.y=${posY.toFixed(3)} | cam.y=${camY.toFixed(3)} | dCam=${(dCam*100).toFixed(2)}cm | dPos=${(dPos*100).toFixed(2)}cm | grounded=${controls.isGrounded}`);
  }
  prevCamY = camY;
  prevPosY = posY;
  if (controls.position.z <= -9.5) break;
}

console.log(`\nAscent Max 1-frame Body Y step: ${(maxBodyDeltaYAscent*100).toFixed(2)} cm (physical stair tread)`);
console.log(`Ascent Max 1-frame Camera Y change: ${(maxCamDeltaYAscent*100).toFixed(2)} cm (smooth eye exponential curve)`);

console.log('\n=== DESCENDING whSW STAIRS ON FOUNDRY_YARD ===');
controls.yaw = Math.PI; // turn to face +Z
controls.input.forward = true;
let maxCamDeltaYDescent = 0;
let maxBodyDeltaYDescent = 0;
prevCamY = camera.position.y;
prevPosY = controls.position.y;

for (let f = 0; f < 80; f++) {
  controls.update(dt);
  const camY = camera.position.y;
  const posY = controls.position.y;

  const dCam = Math.abs(camY - prevCamY);
  const dPos = Math.abs(posY - prevPosY);
  if (f > 1 && dCam > maxCamDeltaYDescent) maxCamDeltaYDescent = dCam;
  if (f > 1 && dPos > maxBodyDeltaYDescent) maxBodyDeltaYDescent = dPos;

  if (f % 5 === 0) {
    console.log(`Descend Frame ${f}: pos.y=${posY.toFixed(3)} | cam.y=${camY.toFixed(3)} | dCam=${(dCam*100).toFixed(2)}cm | dPos=${(dPos*100).toFixed(2)}cm | grounded=${controls.isGrounded}`);
  }
  prevCamY = camY;
  prevPosY = posY;
  if (controls.position.z >= -3.9) break;
}

console.log(`\nDescent Max 1-frame Body Y step: ${(maxBodyDeltaYDescent*100).toFixed(2)} cm (physical stair tread)`);
console.log(`Descent Max 1-frame Camera Y change: ${(maxCamDeltaYDescent*100).toFixed(2)} cm (smooth eye exponential curve)`);
