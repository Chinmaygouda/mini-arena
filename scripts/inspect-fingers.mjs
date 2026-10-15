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

  // Inspect finger bone local rotations and rest poses
  const fingerNames = [
    'f_index01R', 'f_index02R', 'f_index03R',
    'f_middle01R', 'f_middle02R', 'f_middle03R',
    'f_ring01R', 'f_ring02R', 'f_ring03R',
    'f_pinky01R', 'f_pinky02R', 'f_pinky03R',
    'thumb01R', 'thumb02R', 'thumb03R'
  ];

  fingerNames.forEach(name => {
    const b = scene.getObjectByName(name);
    if (!b) return;
    console.log(`Finger "${name}": pos=[${b.position.toArray().map(v=>v.toFixed(4)).join(', ')}] rot=[${b.rotation.toArray().slice(0,3).map(v=>v.toFixed(4)).join(', ')}]`);
  });
});
