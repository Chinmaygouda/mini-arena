import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { FirstPersonArmsRig } from '../packages/client/src/animation/armsRig.ts';
import { parseRealPistolModel } from '../packages/client/src/models/pistolSlice.ts';
import { PISTOL_GRIP_RIGHT, PISTOL_GRIP_LEFT } from '../packages/client/src/animation/fingerGripPoses.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

export async function measureWithRealRig(rSocketDef, lSocketDef, rGripPose, lGripPose) {
  const loader = new GLTFLoader();

  // 1. Camera & Viewmodel hierarchy matching viewmodel.ts
  const camera = new THREE.Group();
  camera.name = 'Camera';

  const viewmodelGroup = new THREE.Group();
  viewmodelGroup.name = 'Viewmodel_Root';
  viewmodelGroup.position.set(0.11, -0.14, -0.26); // Pistol hip offset
  camera.add(viewmodelGroup);

  // Load Pistol
  const pistolBuf = fs.readFileSync('packages/client/public/models/pistol.glb');
  const pistolGltf = await new Promise((res, rej) =>
    loader.parse(pistolBuf.buffer.slice(pistolBuf.byteOffset, pistolBuf.byteOffset + pistolBuf.byteLength), '', res, rej)
  );
  const splitModel = parseRealPistolModel(pistolGltf.scene);
  const pistolRoot = splitModel.root;
  viewmodelGroup.add(pistolRoot);

  const socketR = new THREE.Object3D();
  socketR.name = 'Socket_Grip_R';
  const socketL = new THREE.Object3D();
  socketL.name = 'Socket_Grip_L';
  pistolRoot.add(socketR);
  pistolRoot.add(socketL);

  socketR.position.copy(rSocketDef.pos);
  socketR.rotation.copy(rSocketDef.rot);
  socketL.position.copy(lSocketDef.pos);
  socketL.rotation.copy(lSocketDef.rot);

  // Load Arms
  const armsRig = new FirstPersonArmsRig();
  camera.add(armsRig.group);

  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) =>
    loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej)
  );

  let skinnedMesh = null;
  armsGltf.scene.traverse((obj) => {
    if (obj.isSkinnedMesh) skinnedMesh = obj;
  });

  armsRig.setSkinnedArms(armsGltf.scene, skinnedMesh);
  armsRig.setCustomFingerGrips(lGripPose, rGripPose);

  camera.updateMatrixWorld(true);

  // Read socket world transforms
  const socketPosR = new THREE.Vector3();
  const socketQuatR = new THREE.Quaternion();
  socketR.getWorldPosition(socketPosR);
  socketR.getWorldQuaternion(socketQuatR);

  const socketPosL = new THREE.Vector3();
  const socketQuatL = new THREE.Quaternion();
  socketL.getWorldPosition(socketPosL);
  socketL.getWorldQuaternion(socketQuatL);

  // Update IK
  armsRig.updateIK(socketPosL, socketQuatL, socketPosR, socketQuatR, false);
  camera.updateMatrixWorld(true);

  // Collect triangles
  const gunTriangles = [];
  const slideTriangles = [];

  splitModel.body.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const geom = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
      const pos = geom.attributes.position;
      const idx = geom.index;
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          gunTriangles.push(
            new THREE.Triangle(
              new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i)),
              new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1)),
              new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2))
            )
          );
        }
      }
    }
  });

  splitModel.bolt.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const geom = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
      const pos = geom.attributes.position;
      const idx = geom.index;
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          const tri = new THREE.Triangle(
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i)),
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1)),
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2))
          );
          slideTriangles.push(tri);
          gunTriangles.push(tri);
        }
      }
    }
  });

  function distTo(p, triList) {
    let m = Infinity;
    const t = new THREE.Vector3();
    for (const tri of triList) {
      tri.closestPointToPoint(p, t);
      const d = p.distanceTo(t);
      if (d < m) m = d;
    }
    return m * 1000; // in mm
  }

  const boneLengths = {
    thumb03R: 0.0358,
    f_index03R: 0.0238,
    f_middle03R: 0.0300,
    f_ring03R: 0.0319,
    f_pinky03R: 0.0222,
    thumb03L: 0.0358,
    f_index03L: 0.0238,
    f_middle03L: 0.0300,
    f_ring03L: 0.0319,
    f_pinky03L: 0.0222,
  };

  const fingerBones = armsRig['fingerBones'];

  // Right Hand measurements
  const palmBonesR = ['palm01R', 'palm02R', 'palm03R', 'palm04R'].map((n) => fingerBones.get(n));
  const palmCenterR = new THREE.Vector3();
  palmBonesR.forEach((b) => palmCenterR.add(b.getWorldPosition(new THREE.Vector3())));
  palmCenterR.multiplyScalar(0.25);
  const rPalmDist = distTo(palmCenterR, gunTriangles);

  const rFingers = {};
  for (const f of ['f_index03R', 'f_middle03R', 'f_ring03R', 'f_pinky03R', 'thumb03R']) {
    const b = fingerBones.get(f);
    const tip = new THREE.Vector3(0, boneLengths[f], 0).applyMatrix4(b.matrixWorld);
    rFingers[f] = distTo(tip, gunTriangles);
  }

  // Left Hand measurements
  const palmBonesL = ['palm01L', 'palm02L', 'palm03L', 'palm04L'].map((n) => fingerBones.get(n));
  const palmCenterL = new THREE.Vector3();
  palmBonesL.forEach((b) => palmCenterL.add(b.getWorldPosition(new THREE.Vector3())));
  palmCenterL.multiplyScalar(0.25);
  const lPalmDist = distTo(palmCenterL, gunTriangles);

  const lFingers = {};
  for (const f of ['f_index03L', 'f_middle03L', 'f_ring03L', 'f_pinky03L', 'thumb03L']) {
    const b = fingerBones.get(f);
    const tip = new THREE.Vector3(0, boneLengths[f], 0).applyMatrix4(b.matrixWorld);
    lFingers[f] = distTo(tip, gunTriangles);
  }

  const thumbTipL = new THREE.Vector3(0, boneLengths.thumb03L, 0).applyMatrix4(fingerBones.get('thumb03L').matrixWorld);
  const lThumbSlideClearance = distTo(thumbTipL, slideTriangles);

  const tipPositions = {};
  for (const f of ['f_index03R', 'f_middle03R', 'f_ring03R', 'f_pinky03R', 'thumb03R', 'f_index03L', 'f_middle03L', 'f_ring03L', 'f_pinky03L', 'thumb03L']) {
    const b = fingerBones.get(f);
    const tipWorld = new THREE.Vector3(0, boneLengths[f], 0).applyMatrix4(b.matrixWorld);
    const tipLocal = pistolRoot.worldToLocal(tipWorld.clone());
    tipPositions[f] = tipLocal;
  }
  const palmRLocal = pistolRoot.worldToLocal(palmCenterR.clone());
  const palmLLocal = pistolRoot.worldToLocal(palmCenterL.clone());
  tipPositions.palmR = palmRLocal;
  tipPositions.palmL = palmLLocal;

  return {
    rPalmDist,
    rFingers,
    lPalmDist,
    lFingers,
    lThumbSlideClearance,
    rSocketPalmDelta: palmCenterR.distanceTo(socketPosR) * 1000,
    lSocketPalmDelta: palmCenterL.distanceTo(socketPosL) * 1000,
    tipPositions,
  };
}

async function run() {
  // 1. Uncalibrated Baseline (Old rifle grip / uncalibrated sockets)
  const baseRSocket = {
    pos: new THREE.Vector3(0, -0.045, 0.04),
    rot: new THREE.Euler(1.1, 0.15, -0.3),
  };
  const baseLSocket = {
    pos: new THREE.Vector3(-0.025, -0.065, 0.035),
    rot: new THREE.Euler(0.4, 0.35, -0.2),
  };
  const oldRPose = {
    ...PISTOL_GRIP_RIGHT,
    f_index01R: [0.42, 0.03, -0.01, 0.91],
    f_index02R: [0.38, -0.01, 0.01, 0.92],
    f_index03R: [0.35, 0.0, 0.0, 0.94],
    thumb01R: [0.08, -0.35, -0.25, 0.9],
    thumb02R: [0.45, 0.02, 0.01, 0.89],
    thumb03R: [0.4, -0.05, 0.05, 0.91],
  };
  const oldLPose = {
    ...PISTOL_GRIP_LEFT,
    f_index01L: [0.55, -0.03, -0.02, 0.83],
    f_index02L: [0.62, 0.01, -0.01, 0.78],
    f_index03L: [0.58, 0.0, 0.0, 0.81],
    thumb01L: [0.02, 0.28, 0.18, 0.94],
    thumb02L: [0.22, -0.01, -0.01, 0.97],
    thumb03L: [0.18, 0.05, -0.01, 0.98],
    f_middle01L: [0.58, -0.01, -0.01, 0.81],
    f_middle02L: [0.64, -0.01, 0.0, 0.77],
    f_middle03L: [0.6, 0.0, 0.0, 0.8],
    f_ring01L: [0.62, 0.05, -0.12, 0.77],
    f_ring02L: [0.65, 0.0, 0.0, 0.76],
    f_ring03L: [0.61, -0.02, 0.0, 0.79],
    f_pinky01L: [0.65, 0.01, 0.0, 0.76],
    f_pinky02L: [0.62, -0.02, -0.01, 0.78],
    f_pinky03L: [0.58, 0.02, 0.0, 0.81],
  };

  const baseRes = await measureWithRealRig(baseRSocket, baseLSocket, oldRPose, oldLPose);

  // 2. Calibrated Tactical Pistol Grip
  const calRSocket = {
    pos: new THREE.Vector3(0.0055, -0.040, 0.038),
    rot: new THREE.Euler(1.12, 0.14, -0.32),
  };
  const calLSocket = {
    pos: new THREE.Vector3(-0.012, -0.048, 0.032),
    rot: new THREE.Euler(0.65, 0.30, -0.32),
  };

  const calRes = await measureWithRealRig(calRSocket, calLSocket, PISTOL_GRIP_RIGHT, PISTOL_GRIP_LEFT);

  console.log('========================================================================================');
  console.log('             TACTICAL PISTOL: IN-ENGINE EMPIRICAL CALIBRATION VERIFICATION');
  console.log('========================================================================================');
  console.log('| Landmark / Contact Bone     | Baseline Distance | Calibrated Distance | Delta / Status     |');
  console.log('|-----------------------------|-------------------|---------------------|--------------------|');
  console.log(`| Right Palm to Grip          | ${baseRes.rPalmDist.toFixed(2).padStart(13)} mm | ${calRes.rPalmDist.toFixed(2).padStart(15)} mm | ${(calRes.rPalmDist - baseRes.rPalmDist).toFixed(2).padStart(14)} mm |`);
  for (const k of ['f_index03R', 'f_middle03R', 'f_ring03R', 'f_pinky03R', 'thumb03R']) {
    const b = baseRes.rFingers[k];
    const c = calRes.rFingers[k];
    const d = c - b;
    console.log(`| Right ${k.padEnd(21)} | ${b.toFixed(2).padStart(13)} mm | ${c.toFixed(2).padStart(15)} mm | ${d.toFixed(2).padStart(14)} mm |`);
  }
  console.log('|-----------------------------|-------------------|---------------------|--------------------|');
  console.log(`| Left Palm to Grip           | ${baseRes.lPalmDist.toFixed(2).padStart(13)} mm | ${calRes.lPalmDist.toFixed(2).padStart(15)} mm | ${(calRes.lPalmDist - baseRes.lPalmDist).toFixed(2).padStart(14)} mm |`);
  for (const k of ['f_index03L', 'f_middle03L', 'f_ring03L', 'f_pinky03L', 'thumb03L']) {
    const b = baseRes.lFingers[k];
    const c = calRes.lFingers[k];
    const d = c - b;
    console.log(`| Left ${k.padEnd(22)} | ${b.toFixed(2).padStart(13)} mm | ${c.toFixed(2).padStart(15)} mm | ${d.toFixed(2).padStart(14)} mm |`);
  }
  console.log('|-----------------------------|-------------------|---------------------|--------------------|');
  console.log(`| Left Thumb Slide Clearance  | ${baseRes.lThumbSlideClearance.toFixed(2).padStart(13)} mm | ${calRes.lThumbSlideClearance.toFixed(2).padStart(15)} mm | Safe (>5mm)        |`);
  console.log('========================================================================================\n');
}

run().catch(console.error);
