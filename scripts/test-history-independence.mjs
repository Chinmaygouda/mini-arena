import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneAnalyticIK } from './test-arm-chain-solver.mjs';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testHistoryIndependence() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
  const scene = gltf.scene;

  const upperR = scene.getObjectByName('upper_armR');
  const foreR = scene.getObjectByName('forearmR');
  const handR = scene.getObjectByName('handR');
  const shoulderR = scene.getObjectByName('shoulderR');

  const solver = new TwoBoneAnalyticIK();

  // Save bind pose
  const bindUpper = { pos: upperR.position.clone(), quat: upperR.quaternion.clone() };
  const bindFore = { pos: foreR.position.clone(), quat: foreR.quaternion.clone() };
  const bindHand = { pos: handR.position.clone(), quat: handR.quaternion.clone() };

  function resetBones() {
    upperR.position.copy(bindUpper.pos);
    upperR.quaternion.copy(bindUpper.quat);
    foreR.position.copy(bindFore.pos);
    foreR.quaternion.copy(bindFore.quat);
    handR.position.copy(bindHand.pos);
    handR.quaternion.copy(bindHand.quat);
    scene.updateMatrixWorld(true);
  }

  const shoulderPos = new THREE.Vector3();
  upperR.getWorldPosition(shoulderPos);

  const targetA = new THREE.Vector3(0.08, -0.15, -0.32);
  const quatA = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, 0.2, -0.4));
  const polePos = new THREE.Vector3(0.35, -0.65, 0.05);

  const elbowPos = new THREE.Vector3();

  // Frame 0: Solve target A
  resetBones();
  solver.solveElbowPosition(shoulderPos, targetA, polePos, 0.3222, 0.2373, elbowPos);
  solver.orientBoneTo(upperR, shoulderPos, elbowPos, solver.planeNormal, shoulderR, false);
  solver.orientBoneTo(foreR, elbowPos, targetA, solver.planeNormal, upperR, false);
  const qFore0 = new THREE.Quaternion();
  foreR.getWorldQuaternion(qFore0);
  handR.quaternion.copy(qFore0).invert().multiply(quatA);

  const baseUpperQuat = upperR.quaternion.clone();
  const baseForeQuat = foreR.quaternion.clone();
  const baseHandQuat = handR.quaternion.clone();

  // Now simulate 300 frames of wild sweeps
  console.log('Simulating 300 frames of extreme sweeps...');
  for (let f = 1; f <= 300; f++) {
    const t = f / 60;
    const sweptTarget = new THREE.Vector3(
      0.08 + Math.sin(t * 7) * 0.15,
      -0.15 + Math.cos(t * 5) * 0.12,
      -0.32 + Math.sin(t * 3) * 0.1,
    );
    const sweptQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      1.2 + Math.sin(t * 4) * 0.4,
      0.2 + Math.cos(t * 6) * 0.3,
      -0.4 + Math.sin(t * 5) * 0.2,
    ));

    resetBones();
    solver.solveElbowPosition(shoulderPos, sweptTarget, polePos, 0.3222, 0.2373, elbowPos);
    solver.orientBoneTo(upperR, shoulderPos, elbowPos, solver.planeNormal, shoulderR, false);
    solver.orientBoneTo(foreR, elbowPos, sweptTarget, solver.planeNormal, upperR, false);
    const qFore = new THREE.Quaternion();
    foreR.getWorldQuaternion(qFore);
    handR.quaternion.copy(qFore).invert().multiply(sweptQuat);
  }

  // Frame 301: Solve target A again!
  resetBones();
  solver.solveElbowPosition(shoulderPos, targetA, polePos, 0.3222, 0.2373, elbowPos);
  solver.orientBoneTo(upperR, shoulderPos, elbowPos, solver.planeNormal, shoulderR, false);
  solver.orientBoneTo(foreR, elbowPos, targetA, solver.planeNormal, upperR, false);
  const qFore301 = new THREE.Quaternion();
  foreR.getWorldQuaternion(qFore301);
  handR.quaternion.copy(qFore301).invert().multiply(quatA);

  const diffUpper = upperR.quaternion.angleTo(baseUpperQuat);
  const diffFore = foreR.quaternion.angleTo(baseForeQuat);
  const diffHand = handR.quaternion.angleTo(baseHandQuat);

  console.log('Bone angle differences after 300 swept frames:');
  console.log('Upper Arm diff (rad):', diffUpper);
  console.log('Forearm diff (rad):', diffFore);
  console.log('Hand diff (rad):', diffHand);

  if (diffUpper > 1e-6 || diffFore > 1e-6 || diffHand > 1e-6) {
    throw new Error('History independence violated!');
  }
  console.log('HISTORY INDEPENDENCE VERIFIED: 0.00000000 rad deviation!');
}

testHistoryIndependence().catch(console.error);
