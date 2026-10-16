import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkTruePenetration() {
  const loader = new GLTFLoader();
  const akBuf = fs.readFileSync('packages/client/public/models/ak47.glb');
  const akGltf = await new Promise((res, rej) => loader.parse(akBuf.buffer.slice(akBuf.byteOffset, akBuf.byteOffset + akBuf.byteLength), '', res, rej));
  const akScene = akGltf.scene;
  akScene.rotation.y = Math.PI / 2;
  akScene.updateMatrixWorld(true);

  const raycaster = new THREE.Raycaster();
  const rayDir = new THREE.Vector3(0, 1, 0);

  // Check vertex 166
  const pt = new THREE.Vector3(-0.0026, 0.0162, -0.1785);
  raycaster.set(pt, rayDir);
  const hits = raycaster.intersectObjects(akScene.children, true);
  console.log('Raycast from vertex 166 upwards: hits =', hits.length);
  for (const h of hits) {
    console.log('Hit dist:', (h.distance * 1000).toFixed(1), 'mm, normal dot ray:', h.face.normal.dot(rayDir).toFixed(2));
  }
}

checkTruePenetration().catch(console.error);
