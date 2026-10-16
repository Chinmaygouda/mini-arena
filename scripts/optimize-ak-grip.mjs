import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function optimizeGrip() {
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

  const boneLengths = {
    thumb03L: 0.0358,
    f_index03L: 0.0238,
    f_middle03L: 0.0300,
    f_ring03L: 0.0319,
    f_pinky03L: 0.0222,
  };

  const solver = new TwoBoneIKSolver();
  const shoulderWorldL = new THREE.Vector3();
  upperL.getWorldPosition(shoulderWorldL);
  const poleWorldL = new THREE.Vector3(-0.35, -0.65, 0.05);
  const elbowPosL = new THREE.Vector3();
  const palmOffsetLocalL = new THREE.Vector3(-0.00506, 0.03924, 0.00018);

  function evaluate(socketPos, socketRot, curls) {
    const socketQuat = new THREE.Quaternion().setFromEuler(socketRot);
    const wristTargetL = socketPos.clone().sub(palmOffsetLocalL.clone().applyQuaternion(socketQuat));
    const stretch = solver.solve(shoulderWorldL, wristTargetL, poleWorldL, 0.3222, 0.2373, elbowPosL);
    foreL.position.y = 0.3222 * stretch;
    handL.position.y = 0.2373 * stretch;

    solver.orientBone(upperL, shoulderWorldL, elbowPosL, solver.planeNormal, shoulderL, true);
    solver.orientBone(foreL, elbowPosL, wristTargetL, solver.planeNormal, upperL, true);
    solver.orientWrist(handL, foreL, socketQuat, 0);

    for (const [name, [rx, ry, rz]] of Object.entries(curls)) {
      const b = armsScene.getObjectByName(name);
      if (b) {
        b.rotation.set(rx, ry, rz);
      }
    }
    armsScene.updateMatrixWorld(true);

    const palmBones = ['palm01L', 'palm02L', 'palm03L', 'palm04L'].map(n => armsScene.getObjectByName(n));
    const palmCenter = new THREE.Vector3();
    palmBones.forEach(b => palmCenter.add(b.getWorldPosition(new THREE.Vector3())));
    palmCenter.multiplyScalar(0.25);
    const palmDist = distToGun(palmCenter);

    const tips = {};
    for (const [boneName, len] of Object.entries(boneLengths)) {
      const b = armsScene.getObjectByName(boneName);
      const tip = new THREE.Vector3(0, len, 0).applyMatrix4(b.matrixWorld);
      tips[boneName] = distToGun(tip);
    }

    return { palmDist, tips, stretch };
  }

  // Baseline test
  const curPos = new THREE.Vector3(-0.010, 0.012, -0.21);
  const curRot = new THREE.Euler(1.35, -0.1, -1.05);
  
  // Sweep wrist rotation and finger curls
  let best = null;
  let bestScore = Infinity;

  for (let rotZ = -1.3; rotZ <= -0.7; rotZ += 0.1) {
    for (let rotX = 1.1; rotX <= 1.5; rotX += 0.1) {
      for (let rotY = -0.3; rotY <= 0.1; rotY += 0.1) {
        const testRot = new THREE.Euler(rotX, rotY, rotZ);
        // Individual curls per finger
        for (let cAll = 1.2; cAll <= 2.2; cAll += 0.2) {
          const curls = {
            f_index01L: [cAll * 0.9, 0, 0],
            f_index02L: [cAll * 0.9, 0, 0],
            f_index03L: [cAll * 0.8, 0, 0],
            f_middle01L: [cAll * 0.85, 0, 0],
            f_middle02L: [cAll * 0.85, 0, 0],
            f_middle03L: [cAll * 0.8, 0, 0],
            f_ring01L: [cAll * 0.7, 0, 0],
            f_ring02L: [cAll * 0.7, 0, 0],
            f_ring03L: [cAll * 0.65, 0, 0],
            f_pinky01L: [cAll * 0.8, 0, 0],
            f_pinky02L: [cAll * 0.8, 0, 0],
            f_pinky03L: [cAll * 0.7, 0, 0],
            thumb01L: [0.3, 0.4, 0.6],
            thumb02L: [cAll * 0.6, 0, 0],
            thumb03L: [cAll * 0.5, 0, 0],
          };
          const res = evaluate(curPos, testRot, curls);
          if (res.palmDist <= 12) {
            const maxTip = Math.max(...Object.values(res.tips));
            const meanTip = Object.values(res.tips).reduce((a, b) => a + b, 0) / 5;
            const score = res.palmDist * 2 + maxTip * 3 + meanTip;
            if (score < bestScore) {
              bestScore = score;
              best = { rotX, rotY, rotZ, cAll, res };
            }
          }
        }
      }
    }
  }

  console.log('BEST RESULT:');
  console.log(JSON.stringify(best, null, 2));
}

optimizeGrip().catch(console.error);
