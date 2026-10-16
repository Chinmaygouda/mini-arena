import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testAkPlacement() {
  const loader = new GLTFLoader();

  // 1. Load Arms
  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) => loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej));
  const armsScene = armsGltf.scene;
  armsScene.position.set(0, -1.743155, 0);

  // 2. Load AK47
  const akBuf = fs.readFileSync('packages/client/public/models/ak47.glb');
  const akGltf = await new Promise((res, rej) => loader.parse(akBuf.buffer.slice(akBuf.byteOffset, akBuf.byteOffset + akBuf.byteLength), '', res, rej));
  const akScene = akGltf.scene;
  akScene.rotation.y = Math.PI / 2;

  const root = new THREE.Group();
  root.add(armsScene);
  root.add(akScene);

  // Sockets from realWeaponSlice
  const rightGripPos = new THREE.Vector3(0.0, -0.065, 0.045);
  const rightGripRot = new THREE.Euler(1.2, 0.2, -0.4);
  const rightGripQuat = new THREE.Quaternion().setFromEuler(rightGripRot);

  const leftHandguardPos = new THREE.Vector3(-0.02, -0.015, -0.21);
  const leftHandguardRot = new THREE.Euler(1.4, -0.1, -1.1);
  const leftHandguardQuat = new THREE.Quaternion().setFromEuler(leftHandguardRot);

  // Palm offset vectors in hand local space
  const palmOffsetR = new THREE.Vector3(0.00506, 0.03924, 0.00018);
  const palmOffsetL = new THREE.Vector3(-0.00506, 0.03924, 0.00018);

  const wristTargetR = rightGripPos.clone().sub(palmOffsetR.clone().applyQuaternion(rightGripQuat));
  const wristTargetL = leftHandguardPos.clone().sub(palmOffsetL.clone().applyQuaternion(leftHandguardQuat));

  console.log('AK-47 Socket Right Grip:', rightGripPos.toArray());
  console.log('Adjusted Wrist Target R:', wristTargetR.toArray());
  console.log('AK-47 Socket Left Grip: ', leftHandguardPos.toArray());
  console.log('Adjusted Wrist Target L:', wristTargetL.toArray());

  // Test solver reach
  const shoulderR = new THREE.Vector3(-0.0183, 1.4657 + 0.1394, 0.0684).add(armsScene.position);
  const shoulderL = new THREE.Vector3(0.0183, 1.4657 + 0.1394, 0.0684).add(armsScene.position);

  const distR = shoulderR.distanceTo(wristTargetR);
  const distL = shoulderL.distanceTo(wristTargetL);
  console.log(`Shoulder to WristTarget R: ${distR.toFixed(4)}m (Reach = 0.5595m, Reach% = ${(distR/0.5595*100).toFixed(1)}%)`);
  console.log(`Shoulder to WristTarget L: ${distL.toFixed(4)}m (Reach = 0.5595m, Reach% = ${(distL/0.5595*100).toFixed(1)}%)`);
}

testAkPlacement().catch(console.error);
