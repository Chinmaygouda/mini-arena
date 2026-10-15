import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneAnalyticIK } from './test-arm-chain-solver.mjs';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testHandOrientation() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
  const scene = gltf.scene;

  scene.position.set(0, -1.743155, 0);
  scene.updateMatrixWorld(true);

  const upperR = scene.getObjectByName('upper_armR');
  const foreR = scene.getObjectByName('forearmR');
  const handR = scene.getObjectByName('handR');
  const shoulderR = scene.getObjectByName('shoulderR');

  const solver = new TwoBoneAnalyticIK();

  const shoulderPos = new THREE.Vector3();
  upperR.getWorldPosition(shoulderPos);

  const targetPos = new THREE.Vector3(0.08, -0.15, -0.32);
  const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0.4, 0.1));
  const polePos = new THREE.Vector3(0.35, -0.65, 0.05);

  const elbowPos = new THREE.Vector3();
  solver.solveElbowPosition(shoulderPos, targetPos, polePos, 0.3222, 0.2373, elbowPos);

  solver.orientBoneTo(upperR, shoulderPos, elbowPos, solver.planeNormal, shoulderR, false);
  solver.orientBoneTo(foreR, elbowPos, targetPos, solver.planeNormal, upperR, false);

  // Orient hand to targetQuat
  const qForeWorld = new THREE.Quaternion();
  foreR.getWorldQuaternion(qForeWorld);
  handR.quaternion.copy(qForeWorld).invert().multiply(targetQuat);
  handR.updateMatrixWorld(true);

  const solvedHandQuat = new THREE.Quaternion();
  handR.getWorldQuaternion(solvedHandQuat);

  console.log('Target quat:', targetQuat.toArray().map(v=>v.toFixed(4)));
  console.log('Solved hand world quat:', solvedHandQuat.toArray().map(v=>v.toFixed(4)));
  console.log('Angle diff (rad):', solvedHandQuat.angleTo(targetQuat).toFixed(6));
}

testHandOrientation().catch(console.error);
