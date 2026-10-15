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

  function curlFinger(prefix, side, curl1, curl2, curl3) {
    const f1 = scene.getObjectByName(`f_${prefix}01${side}`);
    const f2 = scene.getObjectByName(`f_${prefix}02${side}`);
    const f3 = scene.getObjectByName(`f_${prefix}03${side}`);
    if (f1) f1.rotation.x += curl1;
    if (f2) f2.rotation.x += curl2;
    if (f3) f3.rotation.x += curl3;
  }

  function curlThumb(side, c1, c2, c3) {
    const t1 = scene.getObjectByName(`thumb01${side}`);
    const t2 = scene.getObjectByName(`thumb02${side}`);
    const t3 = scene.getObjectByName(`thumb03${side}`);
    if (t1) { t1.rotation.z += c1; t1.rotation.y += c1 * 0.5; }
    if (t2) t2.rotation.x += c2;
    if (t3) t3.rotation.x += c3;
  }

  // Curl right hand into pistol grip
  ['index', 'middle', 'ring', 'pinky'].forEach(f => {
    curlFinger(f, 'R', 1.0, 1.2, 0.8);
  });
  curlThumb('R', 0.8, 0.6, 0.6);

  // Curl left hand around handguard
  ['index', 'middle', 'ring', 'pinky'].forEach(f => {
    curlFinger(f, 'L', 0.8, 1.0, 0.7);
  });
  curlThumb('L', -0.6, 0.6, 0.6);

  console.log('Successfully applied natural finger curl poses!');
});
