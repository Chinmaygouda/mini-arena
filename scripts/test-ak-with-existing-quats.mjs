import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

const LEFT_HAND_GRIP_QUATS = {
  palm01L: [0.01, 0.7703, 0.0982, 0.63],
  f_index01L: [0.6802, -0.0462, -0.0224, 0.731],
  f_index02L: [0.5167, 0.0206, -0.008, 0.855],
  f_index03L: [0.4921, 0.0033, -0.0044, 0.87],
  thumb01L: [0.0122, 0.414, 0.3093, 0.856],
  thumb02L: [0.4771, -0.0033, -0.0225, 0.878],
  thumb03L: [0.3923, 0.1114, -0.0314, 0.912],
  palm02L: [-0.033, 0.7301, 0.0713, 0.6788],
  f_middle01L: [0.7192, -0.0114, -0.0127, 0.694],
  f_middle02L: [0.5892, -0.0105, -0.0046, 0.807],
  f_middle03L: [0.5642, -0.0045, -0.0012, 0.825],
  palm03L: [0.0034, -0.6955, 0.0825, 0.7138],
  f_ring01L: [0.6922, 0.0871, -0.1575, 0.699],
  f_ring02L: [0.5841, 0.0049, -0.0043, 0.811],
  f_ring03L: [0.5698, -0.039, -0.0029, 0.82],
  palm04L: [-0.1291, 0.6619, -0.0428, 0.7372],
  f_pinky01L: [0.699, 0.0145, -0.0043, 0.714],
  f_pinky02L: [0.5883, -0.0295, -0.0188, 0.807],
  f_pinky03L: [0.541, 0.0249, 0.0008, 0.84],
};

async function testWithQuats() {
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

  for (const [name, q] of Object.entries(LEFT_HAND_GRIP_QUATS)) {
    const b = armsScene.getObjectByName(name);
    if (b) {
      b.quaternion.set(q[0], q[1], q[2], q[3]);
    }
  }

  armsScene.updateMatrixWorld(true);

  const palmBones = ['palm01L', 'palm02L', 'palm03L', 'palm04L'].map(n => armsScene.getObjectByName(n));
  const palmCenter = new THREE.Vector3();
  palmBones.forEach(b => palmCenter.add(b.getWorldPosition(new THREE.Vector3())));
  palmCenter.multiplyScalar(0.25);
  console.log('Left Palm Center Dist to Gun:', distToGun(palmCenter).toFixed(2), 'mm');

  for (const [boneName, len] of Object.entries(boneLengths)) {
    const b = armsScene.getObjectByName(boneName);
    const tip = new THREE.Vector3(0, len, 0).applyMatrix4(b.matrixWorld);
    console.log(`Tip ${boneName} Dist to Gun: ${distToGun(tip).toFixed(2)} mm`);
  }
}

testWithQuats().catch(console.error);
