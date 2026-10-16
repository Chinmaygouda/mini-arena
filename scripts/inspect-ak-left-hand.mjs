import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkLeftHand() {
  const loader = new GLTFLoader();

  // Load AK47
  const akBuf = fs.readFileSync('packages/client/public/models/ak47.glb');
  const akGltf = await new Promise((res, rej) => loader.parse(akBuf.buffer.slice(akBuf.byteOffset, akBuf.byteOffset + akBuf.byteLength), '', res, rej));
  const akScene = akGltf.scene;
  akScene.rotation.y = Math.PI / 2;
  akScene.updateMatrixWorld(true);

  // Collect gun triangles
  const gunTriangles = [];
  akScene.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const geom = obj.geometry.clone();
      geom.applyMatrix4(obj.matrixWorld);
      const pos = geom.attributes.position;
      const idx = geom.index;
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i));
          const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1));
          const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2));
          gunTriangles.push(new THREE.Triangle(a, b, c));
        }
      }
    }
  });

  function distToGunMesh(p) {
    let minDist = Infinity;
    const target = new THREE.Vector3();
    for (let i = 0; i < gunTriangles.length; i++) {
      gunTriangles[i].closestPointToPoint(p, target);
      const d = p.distanceTo(target);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  // Load Arms
  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) => loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej));
  const armsScene = armsGltf.scene;

  // Test socket position
  const socketPos = new THREE.Vector3(-0.02, -0.015, -0.21);
  console.log('Distance from socketPos to gun mesh:', (distToGunMesh(socketPos) * 1000).toFixed(2), 'mm');

  // Let's test different candidate positions around handguard
  for (let x = -0.025; x <= 0.01; x += 0.005) {
    for (let y = -0.03; y <= 0.01; y += 0.005) {
      const testP = new THREE.Vector3(x, y, -0.21);
      const d = distToGunMesh(testP) * 1000;
      if (d < 5) {
        console.log(`Surface point at x=${x.toFixed(3)}, y=${y.toFixed(3)}, z=-0.210 -> dist = ${d.toFixed(2)} mm`);
      }
    }
  }
}

checkLeftHand().catch(console.error);
