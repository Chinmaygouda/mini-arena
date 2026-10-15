import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkBendingAxis() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
  const scene = gltf.scene;

  const foreR = scene.getObjectByName('forearmR');
  const handR = scene.getObjectByName('handR');

  scene.updateMatrixWorld(true);
  const baseHandPos = new THREE.Vector3();
  handR.getWorldPosition(baseHandPos);

  console.log('Base hand world pos:', baseHandPos.toArray().map(v=>v.toFixed(4)));

  // Try rotating forearm around local X
  foreR.rotation.x += 0.5;
  scene.updateMatrixWorld(true);
  const handX = new THREE.Vector3();
  handR.getWorldPosition(handX);
  console.log('Hand pos after forearm.rotation.x += 0.5:', handX.toArray().map(v=>v.toFixed(4)), 'delta:', handX.sub(baseHandPos).toArray().map(v=>v.toFixed(4)));

  // Reset and try Z
  foreR.rotation.x -= 0.5;
  foreR.rotation.z += 0.5;
  scene.updateMatrixWorld(true);
  const handZ = new THREE.Vector3();
  handR.getWorldPosition(handZ);
  console.log('Hand pos after forearm.rotation.z += 0.5:', handZ.toArray().map(v=>v.toFixed(4)), 'delta:', handZ.sub(baseHandPos).toArray().map(v=>v.toFixed(4)));
}

checkBendingAxis().catch(console.error);
