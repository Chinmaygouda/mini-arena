import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function extractQuats() {
  const loader = new GLTFLoader();
  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) => loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej));
  const armsScene = armsGltf.scene;

  // 1. Left Hand
  const leftQuats = {};
  for (const f of ['f_index', 'f_middle', 'f_pinky']) {
    for (const seg of ['01L', '02L', '03L']) {
      const b = armsScene.getObjectByName(f + seg);
      b.rotation.set(-1.0, 0, 0);
      leftQuats[f + seg] = [+b.quaternion.x.toFixed(4), +b.quaternion.y.toFixed(4), +b.quaternion.z.toFixed(4), +b.quaternion.w.toFixed(4)];
    }
  }
  for (const seg of ['01L', '02L', '03L']) {
    const b = armsScene.getObjectByName('f_ring' + seg);
    b.rotation.set(1.1, 0, 0);
    leftQuats['f_ring' + seg] = [+b.quaternion.x.toFixed(4), +b.quaternion.y.toFixed(4), +b.quaternion.z.toFixed(4), +b.quaternion.w.toFixed(4)];
  }
  const t1 = armsScene.getObjectByName('thumb01L');
  const t2 = armsScene.getObjectByName('thumb02L');
  const t3 = armsScene.getObjectByName('thumb03L');
  t1.rotation.set(0.1, 0.35, 0.55);
  t2.rotation.set(-0.85, 0, 0);
  t3.rotation.set(-0.75, 0, 0);
  leftQuats['thumb01L'] = [+t1.quaternion.x.toFixed(4), +t1.quaternion.y.toFixed(4), +t1.quaternion.z.toFixed(4), +t1.quaternion.w.toFixed(4)];
  leftQuats['thumb02L'] = [+t2.quaternion.x.toFixed(4), +t2.quaternion.y.toFixed(4), +t2.quaternion.z.toFixed(4), +t2.quaternion.w.toFixed(4)];
  leftQuats['thumb03L'] = [+t3.quaternion.x.toFixed(4), +t3.quaternion.y.toFixed(4), +t3.quaternion.z.toFixed(4), +t3.quaternion.w.toFixed(4)];

  console.log('AK47_LEFT_HAND_GRIP_QUATS =', JSON.stringify(leftQuats, null, 2));

  // 2. Right Hand
  const rightQuats = {};
  for (const f of ['f_middle', 'f_pinky']) {
    const rx = f === 'f_middle' ? 1.0 : 1.1;
    for (const seg of ['01R', '02R', '03R']) {
      const b = armsScene.getObjectByName(f + seg);
      b.rotation.set(rx, 0, 0);
      rightQuats[f + seg] = [+b.quaternion.x.toFixed(4), +b.quaternion.y.toFixed(4), +b.quaternion.z.toFixed(4), +b.quaternion.w.toFixed(4)];
    }
  }
  for (const seg of ['01R', '02R', '03R']) {
    const b = armsScene.getObjectByName('f_ring' + seg);
    b.rotation.set(-1.0, 0, 0);
    rightQuats['f_ring' + seg] = [+b.quaternion.x.toFixed(4), +b.quaternion.y.toFixed(4), +b.quaternion.z.toFixed(4), +b.quaternion.w.toFixed(4)];
  }
  // Index lightly curled on trigger
  for (const seg of ['01R', '02R', '03R']) {
    const b = armsScene.getObjectByName('f_index' + seg);
    b.rotation.set(0.6, 0, 0);
    rightQuats['f_index' + seg] = [+b.quaternion.x.toFixed(4), +b.quaternion.y.toFixed(4), +b.quaternion.z.toFixed(4), +b.quaternion.w.toFixed(4)];
  }
  // Thumb on right hand
  const rt1 = armsScene.getObjectByName('thumb01R');
  const rt2 = armsScene.getObjectByName('thumb02R');
  const rt3 = armsScene.getObjectByName('thumb03R');
  rt1.rotation.set(0.1, -0.35, -0.55);
  rt2.rotation.set(0.7, 0, 0);
  rt3.rotation.set(0.6, 0, 0);
  rightQuats['thumb01R'] = [+rt1.quaternion.x.toFixed(4), +rt1.quaternion.y.toFixed(4), +rt1.quaternion.z.toFixed(4), +rt1.quaternion.w.toFixed(4)];
  rightQuats['thumb02R'] = [+rt2.quaternion.x.toFixed(4), +rt2.quaternion.y.toFixed(4), +rt2.quaternion.z.toFixed(4), +rt2.quaternion.w.toFixed(4)];
  rightQuats['thumb03R'] = [+rt3.quaternion.x.toFixed(4), +rt3.quaternion.y.toFixed(4), +rt3.quaternion.z.toFixed(4), +rt3.quaternion.w.toFixed(4)];

  console.log('AK47_RIGHT_HAND_GRIP_QUATS =', JSON.stringify(rightQuats, null, 2));
}

extractQuats().catch(console.error);
