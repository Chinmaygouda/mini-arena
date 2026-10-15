import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneAnalyticIK } from './test-arm-chain-solver.mjs';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testGripWithAK() {
  const loader = new GLTFLoader();

  // Load arms
  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) => loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej));
  const armsScene = armsGltf.scene;
  armsScene.position.set(0, -1.743155, 0);

  // Load AK-47
  const akBuf = fs.readFileSync('packages/client/public/models/ak47.glb');
  const akGltf = await new Promise((res, rej) => loader.parse(akBuf.buffer.slice(akBuf.byteOffset, akBuf.byteOffset + akBuf.byteLength), '', res, rej));
  const akScene = akGltf.scene;

  // Typical AK viewmodel position in hip rest
  akScene.position.set(0.18, -0.16, -0.42);
  akScene.rotation.set(0.04, -0.05, 0.02);

  const mainScene = new THREE.Scene();
  mainScene.add(armsScene);
  mainScene.add(akScene);
  mainScene.updateMatrixWorld(true);

  // Apply grab keyframes to fingers
  const grabR = armsGltf.animations.find(a => a.name === 'grab.R');
  const grabL = armsGltf.animations.find(a => a.name === 'grab.L');

  function applyClipAtEnd(clip, targetScene) {
    for (const track of clip.tracks) {
      if (track.name.endsWith('.quaternion') && (track.name.includes('palm') || track.name.includes('f_') || track.name.includes('thumb'))) {
        const boneName = track.name.split('.')[0];
        const bone = targetScene.getObjectByName(boneName);
        if (bone) {
          const lastIdx = track.values.length - 4;
          bone.quaternion.set(
            track.values[lastIdx],
            track.values[lastIdx + 1],
            track.values[lastIdx + 2],
            track.values[lastIdx + 3]
          );
        }
      }
    }
  }

  applyClipAtEnd(grabR, armsScene);
  applyClipAtEnd(grabL, armsScene);
  armsScene.updateMatrixWorld(true);

  console.log('Successfully applied grab grip pose to all finger bones!');
}

testGripWithAK().catch(console.error);
