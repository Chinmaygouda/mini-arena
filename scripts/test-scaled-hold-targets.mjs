import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';

const l1 = 0.322236;
const l2 = 0.237276;
const maxReach = l1 + l2; // 0.559512

const S_R = new THREE.Vector3(-0.1970, -0.1491, -0.0267);
const S_L = new THREE.Vector3( 0.1970, -0.1491, -0.0267);

const poleR = new THREE.Vector3(-0.45, -0.55, -0.15);
const poleL = new THREE.Vector3( 0.45, -0.55, -0.15);

// Scaled targets using ratio r = 0.902439
const ratio = maxReach / 0.62; // 0.902439

const scaledWeapons = {
  assault_rifle: {
    name: 'Assault Rifle',
    camR: new THREE.Vector3(0.10, -0.255, 0.04 * ratio - 0.30 * ratio),
    camL: new THREE.Vector3(0.04, -0.215, 0.04 * ratio - 0.42 * ratio),
  },
  pistol: {
    name: 'Tactical Pistol',
    camR: new THREE.Vector3(0.03, -0.190, -0.26 - 0.05 * ratio),
    camL: new THREE.Vector3(-0.02, -0.185, -0.26 - 0.06 * ratio),
  },
  smg: {
    name: 'Rapid SMG',
    camR: new THREE.Vector3(0.10, -0.250, -0.10 * ratio - 0.17 * ratio),
    camL: new THREE.Vector3(0.05, -0.210, -0.10 * ratio - 0.28 * ratio),
  },
  shotgun: {
    name: 'Combat Shotgun',
    camR: new THREE.Vector3(0.10, -0.245, 0.06 * ratio - 0.34 * ratio),
    camL: new THREE.Vector3(0.05, -0.205, 0.06 * ratio - 0.44 * ratio),
  },
  sniper: {
    name: 'Precision Sniper',
    camR: new THREE.Vector3(0.10, -0.250, 0.06 * ratio - 0.34 * ratio),
    camL: new THREE.Vector3(0.05, -0.215, 0.06 * ratio - 0.44 * ratio),
  },
};

console.log('=== VERIFYING RATIO-SCALED TARGETS AGAINST ACCEPTANCE CRITERIA ===');
let allPass = true;

for (const [id, w] of Object.entries(scaledWeapons)) {
  const dR = w.camR.distanceTo(S_R);
  const dL = w.camL.distanceTo(S_L);

  const reachR = (dR / maxReach) * 100;
  const reachL = (dL / maxReach) * 100;

  const cosElbowR = (l1 * l1 + l2 * l2 - dR * dR) / (2 * l1 * l2);
  const elbowAngleR = (Math.acos(Math.max(-1, Math.min(1, cosElbowR))) * 180) / Math.PI;

  const cosElbowL = (l1 * l1 + l2 * l2 - dL * dL) / (2 * l1 * l2);
  const elbowAngleL = (Math.acos(Math.max(-1, Math.min(1, cosElbowL))) * 180) / Math.PI;

  // Acceptance tests:
  // 1. reach 55-95%
  // 2. elbow angle 60-150 deg
  const passReachR = reachR >= 55 && reachR <= 95;
  const passReachL = reachL >= 55 && reachL <= 95;
  const passElbowR = elbowAngleR >= 60 && elbowAngleR <= 150;
  const passElbowL = elbowAngleL >= 60 && elbowAngleL <= 150;

  const passWeapon = passReachR && passReachL && passElbowR && passElbowL;
  if (!passWeapon) allPass = false;

  console.log(`\nWeapon: ${w.name} (${id})`);
  console.log(`  Grip R Cam: [${w.camR.toArray().map(v => v.toFixed(4)).join(', ')}]`);
  console.log(`    Dist: ${dR.toFixed(4)}m | Reach: ${reachR.toFixed(1)}% (55-95%) -> ${passReachR ? 'PASS' : 'FAIL'}`);
  console.log(`    Elbow: ${elbowAngleR.toFixed(1)}° (60-150°) -> ${passElbowR ? 'PASS' : 'FAIL'}`);
  console.log(`  Grip L Cam: [${w.camL.toArray().map(v => v.toFixed(4)).join(', ')}]`);
  console.log(`    Dist: ${dL.toFixed(4)}m | Reach: ${reachL.toFixed(1)}% (55-95%) -> ${passReachL ? 'PASS' : 'FAIL'}`);
  console.log(`    Elbow: ${elbowAngleL.toFixed(1)}° (60-150°) -> ${passElbowL ? 'PASS' : 'FAIL'}`);
  console.log(`  Overall Status: ${passWeapon ? 'PASSED ALL CRITERIA' : 'FAILED'}`);
}

console.log(`\n======================================================`);
console.log(`ALL WEAPONS RATIO-SCALED SUITE RESULT: ${allPass ? '100% PASSED' : 'SOME FAILED'}`);
console.log(`======================================================`);
