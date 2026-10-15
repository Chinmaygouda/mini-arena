import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkFingerKeyframes() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
  const grabR = gltf.animations.find(a => a.name === 'grab.R');

  console.log('--- grab.R finger tracks at last keyframe ---');
  for (const track of grabR.tracks) {
    if (track.name.includes('f_') || track.name.includes('thumb') || track.name.includes('palm')) {
      if (track.name.endsWith('.quaternion')) {
        const lastIdx = track.values.length - 4;
        const q = [track.values[lastIdx], track.values[lastIdx+1], track.values[lastIdx+2], track.values[lastIdx+3]];
        console.log(`  ${track.name}: [${q.map(v => v.toFixed(4)).join(', ')}]`);
      }
    }
  }
}

checkFingerKeyframes().catch(console.error);
