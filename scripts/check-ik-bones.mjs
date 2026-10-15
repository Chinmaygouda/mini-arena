import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkIKBones() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
  const scene = gltf.scene;

  const handIKR = scene.getObjectByName('handIKR');
  const elbowIKR = scene.getObjectByName('elbowIKR');
  const handR = scene.getObjectByName('handR');
  const forearmR = scene.getObjectByName('forearmR');

  console.log('handIKR:', handIKR.position.toArray());
  console.log('elbowIKR:', elbowIKR.position.toArray());
  console.log('Are there animations in GLTF?', gltf.animations.map(a => a.name));
}

checkIKBones().catch(console.error);
