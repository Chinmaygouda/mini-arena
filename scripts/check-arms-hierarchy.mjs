import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkHierarchy() {
  const loader = new GLTFLoader();
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const gltf = await new Promise((res, rej) =>
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej)
  );

  const rig = gltf.scene;
  rig.traverse((obj) => {
    console.log(`${obj.type}: ${obj.name} | pos: [${obj.position.toArray().map(v => v.toFixed(4))}] | rot: [${obj.rotation.toArray().slice(0,3).map(v => v.toFixed(4))}] | scale: [${obj.scale.toArray().map(v => v.toFixed(4))}]`);
  });
}

checkHierarchy().catch(console.error);
