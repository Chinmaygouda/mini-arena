import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkVertices() {
  const buf = fs.readFileSync('packages/client/public/models/shotgun.glb');
  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
  const scene = gltf.scene;

  let shotgunMesh = null;
  scene.traverse(c => {
    if (c.name === 'shotgun' && c.isMesh) shotgunMesh = c;
  });

  const posAttr = shotgunMesh.geometry.attributes.position;
  let minX = Infinity, maxX = -Infinity;
  let minYAtMinX = 0, maxYAtMinX = 0;
  let minYAtMaxX = 0, maxYAtMaxX = 0;

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    if (x < -0.25) {
      minYAtMinX = Math.min(minYAtMinX, y);
      maxYAtMinX = Math.max(maxYAtMinX, y);
    }
    if (x > 0.25) {
      minYAtMaxX = Math.min(minYAtMaxX, y);
      maxYAtMaxX = Math.max(maxYAtMaxX, y);
    }
  }

  console.log('Stock end (x < -0.25): Y range is [', minYAtMinX.toFixed(4), ',', maxYAtMinX.toFixed(4), ']');
  console.log('Muzzle end (x > 0.25): Y range is [', minYAtMaxX.toFixed(4), ',', maxYAtMaxX.toFixed(4), ']');
}

checkVertices().catch(console.error);
