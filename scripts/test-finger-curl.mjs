import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new GLTFLoader();
loader.parse(arrayBuffer, '', (gltf) => {
  const scene = gltf.scene;

  // Let's test rotating f_index01R around X or Z
  const b = scene.getObjectByName('f_index01R');
  const tip = scene.getObjectByName('f_index03R');
  
  scene.updateMatrixWorld(true);
  const p0 = new THREE.Vector3();
  tip.getWorldPosition(p0);

  // Curl by -1.0 radian around X
  b.rotation.x -= 1.0;
  scene.updateMatrixWorld(true);
  const p1 = new THREE.Vector3();
  tip.getWorldPosition(p1);

  console.log('Original tip world pos:', p0.toArray());
  console.log('Curled tip world pos:  ', p1.toArray());
  console.log('Delta:', p1.clone().sub(p0).toArray());
});
