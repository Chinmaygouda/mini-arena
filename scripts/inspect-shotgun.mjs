import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function inspectShotgun() {
  const buf = fs.readFileSync('packages/client/public/models/shotgun.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();

  const gltf = await new Promise((res, rej) => loader.parse(arrayBuffer, '', res, rej));
  const scene = gltf.scene;

  console.log('--- SHOTGUN NODES ---');
  scene.traverse(c => {
    if (c.isMesh) {
      const box = new THREE.Box3().setFromObject(c);
      console.log(`Mesh: ${c.name}, box min: ${box.min.toArray().map(v=>v.toFixed(4))}, max: ${box.max.toArray().map(v=>v.toFixed(4))}`);
    }
  });
}

inspectShotgun().catch(console.error);
