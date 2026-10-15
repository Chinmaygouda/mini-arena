import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkClips() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));

  const grabR = gltf.animations.find(a => a.name === 'grab.R');
  const grabL = gltf.animations.find(a => a.name === 'grab.L');

  console.log('--- grab.R ---');
  console.log('Duration:', grabR.duration);
  console.log('Tracks count:', grabR.tracks.length);
  grabR.tracks.slice(0, 10).forEach(t => console.log(' ', t.name, t.times.length, 'keyframes'));

  console.log('\n--- grab.L ---');
  console.log('Duration:', grabL.duration);
  console.log('Tracks count:', grabL.tracks.length);
  grabL.tracks.slice(0, 10).forEach(t => console.log(' ', t.name, t.times.length, 'keyframes'));
}

checkClips().catch(console.error);
