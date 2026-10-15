import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new GLTFLoader();
loader.parse(
  arrayBuffer,
  '',
  (gltf) => {
    const scene = gltf.scene;
    let skinnedMesh = null;
    scene.traverse((obj) => {
      if (obj.isSkinnedMesh) skinnedMesh = obj;
    });

    console.log('SkinnedMesh found:', skinnedMesh.name);

    // Let's inspect bone hierarchy
    const root = scene.getObjectByName('root');
    const upperR = scene.getObjectByName('upper_armR');
    const foreR = scene.getObjectByName('forearmR');
    const handR = scene.getObjectByName('handR');

    const upperL = scene.getObjectByName('upper_armL');
    const foreL = scene.getObjectByName('forearmL');
    const handL = scene.getObjectByName('handL');

    console.log('Bones found:', {
      upperR: !!upperR, foreR: !!foreR, handR: !!handR,
      upperL: !!upperL, foreL: !!foreL, handL: !!handL,
    });

    // Let's check rest rotations and parent matrices
    scene.updateMatrixWorld(true);
    const upperRWorld = new THREE.Vector3();
    upperR.getWorldPosition(upperRWorld);
    console.log('upper_armR world pos:', upperRWorld.toArray());

    const foreRWorld = new THREE.Vector3();
    foreR.getWorldPosition(foreRWorld);
    console.log('forearmR world pos:', foreRWorld.toArray());

    const handRWorld = new THREE.Vector3();
    handR.getWorldPosition(handRWorld);
    console.log('handR world pos:', handRWorld.toArray());
  },
  console.error
);
