import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new GLTFLoader();
loader.parse(
  arrayBuffer,
  '',
  (gltf) => {
    let skinnedMesh = null;
    gltf.scene.traverse((obj) => {
      if (obj.isSkinnedMesh) skinnedMesh = obj;
    });

    gltf.scene.updateMatrixWorld(true);

    const cameraBone = gltf.scene.getObjectByName('camera');
    const camWorld = new THREE.Vector3();
    if (cameraBone) {
      cameraBone.getWorldPosition(camWorld);
      console.log('Camera world pos:', camWorld.toArray());
    }

    const bonesToInspect = [
      'shoulderR', 'upper_armR', 'forearmR', 'handR', 'handIKR',
      'shoulderL', 'upper_armL', 'forearmL', 'handL', 'handIKL'
    ];

    console.log('\nBone World Positions and Relative to Camera:');
    bonesToInspect.forEach(name => {
      const b = gltf.scene.getObjectByName(name);
      if (!b) return;
      const wPos = new THREE.Vector3();
      b.getWorldPosition(wPos);
      const relCam = wPos.clone().sub(camWorld);
      console.log(`- "${name}": world=[${wPos.toArray().map(v=>v.toFixed(4)).join(', ')}] relCam=[${relCam.toArray().map(v=>v.toFixed(4)).join(', ')}]`);
    });
  },
  console.error
);
