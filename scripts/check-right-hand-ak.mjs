import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkRightHandAk() {
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

  const upperR = armsScene.getObjectByName('upper_armR');
  const foreR = armsScene.getObjectByName('forearmR');
  const handR = armsScene.getObjectByName('handR');
  const shoulderR = armsScene.getObjectByName('shoulderR');

  const solver = new TwoBoneIKSolver();
  const shoulderWorldR = new THREE.Vector3();
  upperR.getWorldPosition(shoulderWorldR);
  const poleWorldR = new THREE.Vector3(0.35, -0.65, 0.05);
  const elbowPosR = new THREE.Vector3();
  const palmOffsetLocalR = new THREE.Vector3(0.00506, 0.03924, 0.00018);

  // AK-47 right grip rest
  const socketPosR = new THREE.Vector3(0.0, -0.065, 0.045);
  const socketRotR = new THREE.Euler(1.2, 0.2, -0.4);
  const socketQuatR = new THREE.Quaternion().setFromEuler(socketRotR);

  const wristTargetR = socketPosR.clone().sub(palmOffsetLocalR.clone().applyQuaternion(socketQuatR));
  const stretch = solver.solve(shoulderWorldR, wristTargetR, poleWorldR, 0.3222, 0.2373, elbowPosR);
  foreR.position.y = 0.3222 * stretch;
  handR.position.y = 0.2373 * stretch;

  solver.orientBone(upperR, shoulderWorldR, elbowPosR, solver.planeNormal, shoulderR, false);
  solver.orientBone(foreR, elbowPosR, wristTargetR, solver.planeNormal, upperR, false);
  solver.orientWrist(handR, foreR, socketQuatR, 0);

  const RIGHT_HAND_GRIP_QUATS = {
    palm01R: [0.0042, -0.7724, -0.0896, 0.6287],
    f_index01R: [0.7489, 0.0501, -0.011, 0.6607],
    f_index02R: [0.6048, -0.0113, 0.019, 0.7961],
    f_index03R: [0.6166, 0.0001, 0.0055, 0.7873],
    thumb01R: [0.0619, -0.3948, -0.2959, 0.8676],
    thumb02R: [0.5574, 0.0415, 0.0194, 0.829],
    thumb03R: [0.4828, -0.0893, 0.0736, 0.868],
    palm02R: [-0.0338, -0.7304, -0.0702, 0.6786],
    f_middle01R: [0.7354, 0.0168, 0.0029, 0.6774],
    f_middle02R: [0.6254, 0.0111, -0.0029, 0.7802],
    f_middle03R: [0.6215, 0.0043, -0.0018, 0.7834],
    palm03R: [0.0079, 0.6967, -0.0787, 0.713],
    f_ring01R: [0.0189, -0.6785, 0.734, 0.0204],
    f_ring02R: [0.615, -0.0012, 0.0064, 0.7885],
    f_ring03R: [0.6485, 0.0325, -0.0219, 0.7602],
    palm04R: [-0.1256, -0.6614, 0.0393, 0.7384],
    f_pinky01R: [0.7284, -0.0087, 0.0124, 0.685],
    f_pinky02R: [0.6398, 0.0348, -0.0034, 0.7677],
    f_pinky03R: [0.5934, -0.0201, 0.0147, 0.8045],
  };

  for (const [name, q] of Object.entries(RIGHT_HAND_GRIP_QUATS)) {
    const b = armsScene.getObjectByName(name);
    if (b) {
      b.quaternion.set(q[0], q[1], q[2], q[3]);
    }
  }

  armsScene.updateMatrixWorld(true);

  const palmBones = ['palm01R', 'palm02R', 'palm03R', 'palm04R'].map(n => armsScene.getObjectByName(n));
  const palmCenter = new THREE.Vector3();
  palmBones.forEach(b => palmCenter.add(b.getWorldPosition(new THREE.Vector3())));
  palmCenter.multiplyScalar(0.25);

  const boneLengths = {
    thumb03R: 0.0358,
    f_index03R: 0.0238,
    f_middle03R: 0.0300,
    f_ring03R: 0.0319,
    f_pinky03R: 0.0222,
  };

  // Sculpted wrap around pistol grip
  // Index rests alongside trigger
  // Middle, Ring, Pinky wrap around pistol grip
  // Thumb rests on left side of grip
  ['f_middle', 'f_ring', 'f_pinky'].forEach(f => {
    armsScene.getObjectByName(f + '01R').rotation.x = 1.2;
    armsScene.getObjectByName(f + '02R').rotation.x = 1.1;
    armsScene.getObjectByName(f + '03R').rotation.x = 0.9;
  });
  // Trigger finger lightly curled on trigger
  armsScene.getObjectByName('f_index01R').rotation.x = 0.8;
  armsScene.getObjectByName('f_index02R').rotation.x = 0.7;
  armsScene.getObjectByName('f_index03R').rotation.x = 0.5;

  // Thumb wraps around left side of grip
  armsScene.getObjectByName('thumb01R').rotation.set(0.2, -0.4, -0.5);
  armsScene.getObjectByName('thumb02R').rotation.x = 0.8;
  armsScene.getObjectByName('thumb03R').rotation.x = 0.7;

  armsScene.updateMatrixWorld(true);

  console.log(`Right Palm Center: ${distToGun(palmCenter).toFixed(2)} mm (budget <= 12mm)`);
  for (const [boneName, len] of Object.entries(boneLengths)) {
    const b = armsScene.getObjectByName(boneName);
    const tip = new THREE.Vector3(0, len, 0).applyMatrix4(b.matrixWorld);
    console.log(`Right ${boneName}: ${distToGun(tip).toFixed(2)} mm`);
  }
}

checkRightHandAk().catch(console.error);
