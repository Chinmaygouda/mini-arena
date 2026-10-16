import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function measureAkFingers() {
  const loader = new GLTFLoader();

  // 1. Load AK47
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

  // 2. Load Arms
  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) => loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej));
  const armsScene = armsGltf.scene;
  armsScene.position.set(0, -1.743155, 0);

  const upperL = armsScene.getObjectByName('upper_armL');
  const foreL = armsScene.getObjectByName('forearmL');
  const handL = armsScene.getObjectByName('handL');
  const shoulderL = armsScene.getObjectByName('shoulderL');

  // New socket on handguard surface
  const socketLPos = new THREE.Vector3(-0.010, 0.012, -0.21);
  const socketLRot = new THREE.Euler(1.35, -0.1, -1.05);
  const socketLQuat = new THREE.Quaternion().setFromEuler(socketLRot);

  const palmOffsetLocalL = new THREE.Vector3(-0.00506, 0.03924, 0.00018);
  const wristTargetL = socketLPos.clone().sub(palmOffsetLocalL.clone().applyQuaternion(socketLQuat));

  const solver = new TwoBoneIKSolver();
  const shoulderWorldL = new THREE.Vector3();
  upperL.getWorldPosition(shoulderWorldL);
  const poleWorldL = new THREE.Vector3(-0.35, -0.65, 0.05);
  const elbowPosL = new THREE.Vector3();

  const stretch = solver.solve(shoulderWorldL, wristTargetL, poleWorldL, 0.3222, 0.2373, elbowPosL);
  foreL.position.y = 0.3222 * stretch;
  handL.position.y = 0.2373 * stretch;

  solver.orientBone(upperL, shoulderWorldL, elbowPosL, solver.planeNormal, shoulderL, true);
  solver.orientBone(foreL, elbowPosL, wristTargetL, solver.planeNormal, upperL, true);
  solver.orientWrist(handL, foreL, socketLQuat, 0);

  function curl(name, rx, ry = 0, rz = 0) {
    const b = armsScene.getObjectByName(name);
    if (b) {
      b.rotation.x += rx;
      b.rotation.y += ry;
      b.rotation.z += rz;
    }
  }

  // 1. Curl fingers under and around the handguard
  ['f_index', 'f_middle', 'f_ring', 'f_pinky'].forEach(f => {
    curl(f + '01L', 1.0, 0, 0);
    curl(f + '02L', 1.2, 0, 0);
    curl(f + '03L', 0.9, 0, 0);
  });

  // 2. Wrap thumb across the top rail
  const t1 = armsScene.getObjectByName('thumb01L');
  if (t1) {
    t1.rotation.z += 0.5;
    t1.rotation.y -= 0.3;
    t1.rotation.x += 0.4;
  }
  curl('thumb02L', 0.8, 0, 0);
  curl('thumb03L', 0.8, 0, 0);

  armsScene.updateMatrixWorld(true);

  // Palm center
  const palmBones = ['palm01L', 'palm02L', 'palm03L', 'palm04L'].map(n => armsScene.getObjectByName(n));
  const palmCenter = new THREE.Vector3();
  palmBones.forEach(b => palmCenter.add(b.getWorldPosition(new THREE.Vector3())));
  palmCenter.multiplyScalar(0.25);
  console.log('Left Palm Center Dist to Gun:', distToGun(palmCenter).toFixed(2), 'mm (Budget <= 12mm)');

  const tips = ['thumb03L', 'f_index03L', 'f_middle03L', 'f_ring03L', 'f_pinky03L'];
  tips.forEach(t => {
    const b = armsScene.getObjectByName(t);
    const p = b.getWorldPosition(new THREE.Vector3());
    console.log(`Tip ${t} Dist to Gun: ${distToGun(p).toFixed(2)} mm`);
  });
}

measureAkFingers().catch(console.error);
