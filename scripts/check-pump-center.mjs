import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { parseRealShotgunModel } from '../packages/client/src/models/shotgunSlice.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkPumpCenter() {
  const buf = fs.readFileSync('packages/client/public/models/shotgun.glb');
  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej));
  const model = parseRealShotgunModel(gltf.scene);

  const pumpBox = new THREE.Box3().setFromObject(model.bolt);
  const pumpCenter = new THREE.Vector3();
  pumpBox.getCenter(pumpCenter);

  console.log('Pump slide world box in weapon root space:');
  console.log('min:', pumpBox.min.toArray().map(v=>v.toFixed(4)));
  console.log('max:', pumpBox.max.toArray().map(v=>v.toFixed(4)));
  console.log('center:', pumpCenter.toArray().map(v=>v.toFixed(4)));
}

checkPumpCenter().catch(console.error);
