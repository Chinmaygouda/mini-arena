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
  const palm = scene.getObjectByName('palm01R');
  const index1 = scene.getObjectByName('f_index01R');
  const index2 = scene.getObjectByName('f_index02R');
  const index3 = scene.getObjectByName('f_index03R');

  console.log('Index1 rest rot:', index1.rotation.toArray().slice(0,3));
  console.log('Index2 rest rot:', index2.rotation.toArray().slice(0,3));

  // Let's test rotating each axis by +1.0 and -1.0 to see which one curls the finger tip towards the palm
  const palmWorld = new THREE.Vector3();
  palm.getWorldPosition(palmWorld);

  const axes = ['x', 'y', 'z'];
  axes.forEach(axis => {
    [-1.0, 1.0].forEach(sign => {
      index1.rotation[axis] += sign;
      index2.rotation[axis] += sign;
      index3.rotation[axis] += sign;
      scene.updateMatrixWorld(true);

      const tipWorld = new THREE.Vector3();
      index3.getWorldPosition(tipWorld);
      const dist = tipWorld.distanceTo(palmWorld);
      console.log(`Axis ${axis} ${sign > 0 ? '+' : '-'}1.0 => dist to palm: ${dist.toFixed(4)} (rest was 0.1430)`);

      // restore
      index1.rotation[axis] -= sign;
      index2.rotation[axis] -= sign;
      index3.rotation[axis] -= sign;
      scene.updateMatrixWorld(true);
    });
  });
});
