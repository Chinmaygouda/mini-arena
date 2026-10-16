import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkAxes() {
  const loader = new GLTFLoader();
  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) => loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej));
  const armsScene = armsGltf.scene;

  const names = ['f_index01L', 'f_index02L', 'f_index03L', 'thumb01L', 'thumb02L', 'thumb03L'];
  for (const n of names) {
    const b = armsScene.getObjectByName(n);
    console.log(n, 'bind pos:', b.position, 'bind rot:', b.rotation, 'bind quat:', b.quaternion);
  }
}

checkAxes().catch(console.error);
