import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneAnalyticIK } from './test-arm-chain-solver.mjs';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function debugShoulder() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
  const scene = gltf.scene;

  const upperR = scene.getObjectByName('upper_armR');
  const foreR = scene.getObjectByName('forearmR');
  const handR = scene.getObjectByName('handR');
  const shoulderR = scene.getObjectByName('shoulderR');

  scene.updateMatrixWorld(true);

  const q1 = new THREE.Quaternion();
  shoulderR.getWorldQuaternion(q1);

  // Rotate upperR
  upperR.rotation.x += 1.0;
  scene.updateMatrixWorld(true);

  const q2 = new THREE.Quaternion();
  shoulderR.getWorldQuaternion(q2);

  console.log('shoulderR world quat before upperR rotation:', q1.toArray());
  console.log('shoulderR world quat after upperR rotation:', q2.toArray());
  console.log('shoulderR diff:', q1.angleTo(q2));

  // Reset upperR
  upperR.rotation.x -= 1.0;
  scene.updateMatrixWorld(true);

  const q3 = new THREE.Quaternion();
  shoulderR.getWorldQuaternion(q3);
  console.log('shoulderR world quat after reset:', q3.toArray());
  console.log('shoulderR diff from start:', q1.angleTo(q3));
}

debugShoulder().catch(console.error);
