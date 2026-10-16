import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { parseRealSniperModel } from '../packages/client/src/models/sniperSlice.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkSniper() {
  const loader = new GLTFLoader();
  const buf = fs.readFileSync('packages/client/public/models/sniper.glb');
  const gltf = await new Promise((res, rej) =>
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej)
  );

  const split = parseRealSniperModel(gltf.scene);
  const box = new THREE.Box3().setFromObject(split.root);
  console.log('Sniper Root Box Min:', box.min.toArray());
  console.log('Sniper Root Box Max:', box.max.toArray());
  const size = new THREE.Vector3();
  box.getSize(size);
  console.log('Sniper Root Size:', size.toArray());

  // Check where the trigger/grip is on the sniper model
  // Bounding box Z is [min.z, max.z].
  // In Three.js:
  // Forward is -Z, backward (butt) is +Z.
  console.log(`Butt Z is at ${box.max.z.toFixed(4)} m, Muzzle Z is at ${box.min.z.toFixed(4)} m`);
}

checkSniper().catch(console.error);
