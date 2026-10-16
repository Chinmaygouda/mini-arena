import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function runSweep() {
  const loader = new GLTFLoader();

  const akBuf = fs.readFileSync('packages/client/public/models/ak47.glb');
  const akGltf = await new Promise((res, rej) => loader.parse(akBuf.buffer.slice(akBuf.byteOffset, akBuf.byteOffset + akBuf.byteLength), '', res, rej));
  const akScene = akGltf.scene;
  akScene.rotation.y = Math.PI / 2;
  akScene.updateMatrixWorld(true);

  const gunTriangles = [];
  akScene.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const geom = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
      const pos = geom.attributes.position;
      const idx = geom.index;
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          gunTriangles.push(new THREE.Triangle(
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i)),
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1)),
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2))
          ));
        }
      }
    }
  });

  function distToGun(p) {
    let m = Infinity;
    const t = new THREE.Vector3();
    for (const tri of gunTriangles) {
      tri.closestPointToPoint(p, t);
      const d = p.distanceTo(t);
      if (d < m) m = d;
    }
    return m * 1000;
  }

  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) => loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej));
  const s = armsGltf.scene;
  s.position.set(0, -1.743155, 0);

  const upperL = s.getObjectByName('upper_armL');
  const foreL = s.getObjectByName('forearmL');
  const handL = s.getObjectByName('handL');
  const shoulderL = s.getObjectByName('shoulderL');

  const socketPos = new THREE.Vector3(-0.010, 0.012, -0.21);
  const socketRot = new THREE.Euler(1.35, -0.1, -1.05);
  const socketQuat = new THREE.Quaternion().setFromEuler(socketRot);

  const palmOffset = new THREE.Vector3(-0.00506, 0.03924, 0.00018);
  const wristTarget = socketPos.clone().sub(palmOffset.clone().applyQuaternion(socketQuat));

  const solver = new TwoBoneIKSolver();
  const shoulderPos = new THREE.Vector3();
  upperL.getWorldPosition(shoulderPos);
  const elbowPos = new THREE.Vector3();
  const stretch = solver.solve(shoulderPos, wristTarget, new THREE.Vector3(-0.35, -0.65, 0.05), 0.3222, 0.2373, elbowPos);
  foreL.position.y = 0.3222 * stretch;
  handL.position.y = 0.2373 * stretch;

  solver.orientBone(upperL, shoulderPos, elbowPos, solver.planeNormal, shoulderL, true);
  solver.orientBone(foreL, elbowPos, wristTarget, solver.planeNormal, upperL, true);
  solver.orientWrist(handL, foreL, socketQuat, 0);

  // Curl sweep
  for (let curlX = 0.5; curlX <= 2.2; curlX += 0.2) {
    ['f_index', 'f_middle', 'f_ring', 'f_pinky'].forEach(f => {
      const b1 = s.getObjectByName(f + '01L');
      const b2 = s.getObjectByName(f + '02L');
      const b3 = s.getObjectByName(f + '03L');
      b1.quaternion.setFromEuler(new THREE.Euler(curlX * 0.7, 0, 0));
      b2.quaternion.setFromEuler(new THREE.Euler(curlX * 0.9, 0, 0));
      b3.quaternion.setFromEuler(new THREE.Euler(curlX * 0.6, 0, 0));
    });
    s.updateMatrixWorld(true);
    const dIndex = distToGun(s.getObjectByName('f_index03L').getWorldPosition(new THREE.Vector3()));
    const dMiddle = distToGun(s.getObjectByName('f_middle03L').getWorldPosition(new THREE.Vector3()));
    const dRing = distToGun(s.getObjectByName('f_ring03L').getWorldPosition(new THREE.Vector3()));
    const dPinky = distToGun(s.getObjectByName('f_pinky03L').getWorldPosition(new THREE.Vector3()));
    console.log(`curlX=${curlX.toFixed(1)} -> Index: ${dIndex.toFixed(1)}mm, Middle: ${dMiddle.toFixed(1)}mm, Ring: ${dRing.toFixed(1)}mm, Pinky: ${dPinky.toFixed(1)}mm`);
  }
}

runSweep().catch(console.error);
