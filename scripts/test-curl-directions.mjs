import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testFingerCurlDirections() {
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
  const armsScene = armsGltf.scene;
  armsScene.position.set(0, -1.743155, 0);

  const upperL = armsScene.getObjectByName('upper_armL');
  const foreL = armsScene.getObjectByName('forearmL');
  const handL = armsScene.getObjectByName('handL');
  const shoulderL = armsScene.getObjectByName('shoulderL');

  const solver = new TwoBoneIKSolver();
  const shoulderWorldL = new THREE.Vector3();
  upperL.getWorldPosition(shoulderWorldL);
  const poleWorldL = new THREE.Vector3(-0.35, -0.65, 0.05);
  const elbowPosL = new THREE.Vector3();
  const palmOffsetLocalL = new THREE.Vector3(-0.00506, 0.03924, 0.00018);

  const socketPos = new THREE.Vector3(-0.010, 0.012, -0.21);
  const socketRot = new THREE.Euler(1.35, -0.1, -1.05);
  const socketQuat = new THREE.Quaternion().setFromEuler(socketRot);

  const wristTargetL = socketPos.clone().sub(palmOffsetLocalL.clone().applyQuaternion(socketQuat));
  const stretch = solver.solve(shoulderWorldL, wristTargetL, poleWorldL, 0.3222, 0.2373, elbowPosL);
  foreL.position.y = 0.3222 * stretch;
  handL.position.y = 0.2373 * stretch;

  solver.orientBone(upperL, shoulderWorldL, elbowPosL, solver.planeNormal, shoulderL, true);
  solver.orientBone(foreL, elbowPosL, wristTargetL, solver.planeNormal, upperL, true);
  solver.orientWrist(handL, foreL, socketQuat, 0);

  armsScene.updateMatrixWorld(true);

  // Test index finger bending around local axes
  const b1 = armsScene.getObjectByName('f_index01L');
  const b2 = armsScene.getObjectByName('f_index02L');
  const b3 = armsScene.getObjectByName('f_index03L');

  const len3 = 0.0238;

  for (const axis of ['x', 'y', 'z']) {
    for (const angle of [-1.2, -0.6, 0, 0.6, 1.2]) {
      b1.rotation.set(0, 0, 0);
      b2.rotation.set(0, 0, 0);
      b3.rotation.set(0, 0, 0);
      b1.rotation[axis] = angle;
      b2.rotation[axis] = angle;
      b3.rotation[axis] = angle;
      armsScene.updateMatrixWorld(true);

      const tip = new THREE.Vector3(0, len3, 0).applyMatrix4(b3.matrixWorld);
      console.log(`Index axis=${axis} angle=${angle.toFixed(1)} -> tip: (${tip.x.toFixed(3)}, ${tip.y.toFixed(3)}, ${tip.z.toFixed(3)}) | dist: ${distToGun(tip).toFixed(1)}mm`);
    }
  }
}

testFingerCurlDirections().catch(console.error);
