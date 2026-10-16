import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { FirstPersonArmsRig } from '../packages/client/src/animation/armsRig.ts';
import { parseRealAK47Model, createRealAK47VisualDef } from '../packages/client/src/models/realWeaponSlice.ts';
import { parseRealPistolModel, buildPistolVisualDef } from '../packages/client/src/models/pistolSlice.ts';
import { parseRealSmgModel, buildSmgVisualDef } from '../packages/client/src/models/smgSlice.ts';
import { parseRealShotgunModel, buildShotgunVisualDef } from '../packages/client/src/models/shotgunSlice.ts';
import { parseRealSniperModel, buildSniperVisualDef } from '../packages/client/src/models/sniperSlice.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function reconcile() {
  const loader = new GLTFLoader();

  console.log('=== STEP 1: MEASURE ARMS RIG GLB ===');
  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) =>
    loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej)
  );

  const camera = new THREE.PerspectiveCamera(75, 1280 / 720, 0.01, 100);
  camera.position.set(0, 1.65, 0);

  const armsRig = new FirstPersonArmsRig();
  camera.add(armsRig.group);

  let skinnedMesh = null;
  armsGltf.scene.traverse((obj) => {
    if (obj.isSkinnedMesh) skinnedMesh = obj;
  });

  armsRig.setSkinnedArms(armsGltf.scene, skinnedMesh);
  camera.updateMatrixWorld(true);

  const s = armsRig.skinnedArms;
  const invCamWorld = new THREE.Matrix4().copy(camera.matrixWorld).invert();

  const posShoulderR = new THREE.Vector3();
  const posForearmR = new THREE.Vector3();
  const posHandR = new THREE.Vector3();

  s.upperArmR.getWorldPosition(posShoulderR);
  s.forearmR.getWorldPosition(posForearmR);
  s.handR.getWorldPosition(posHandR);

  const posShoulderL = new THREE.Vector3();
  const posForearmL = new THREE.Vector3();
  const posHandL = new THREE.Vector3();

  s.upperArmL.getWorldPosition(posShoulderL);
  s.forearmL.getWorldPosition(posForearmL);
  s.handL.getWorldPosition(posHandL);

  const l1_R = posShoulderR.distanceTo(posForearmR);
  const l2_R = posForearmR.distanceTo(posHandR);
  const l1_L = posShoulderL.distanceTo(posForearmL);
  const l2_L = posForearmL.distanceTo(posHandL);

  const shoulderCamR = posShoulderR.clone().applyMatrix4(invCamWorld);
  const shoulderCamL = posShoulderL.clone().applyMatrix4(invCamWorld);

  console.log(`Measured l1 (Upper Arm R): ${l1_R.toFixed(6)} m, L: ${l1_L.toFixed(6)} m`);
  console.log(`Measured l2 (Forearm R):   ${l2_R.toFixed(6)} m, L: ${l2_L.toFixed(6)} m`);
  const actualReach = l1_R + l2_R;
  console.log(`Measured Total Reach (l1 + l2): ${actualReach.toFixed(6)} m`);
  console.log(`Measured Shoulder R in Camera Space: [${shoulderCamR.toArray().map(v => v.toFixed(4)).join(', ')}]`);
  console.log(`Measured Shoulder L in Camera Space: [${shoulderCamL.toArray().map(v => v.toFixed(4)).join(', ')}]`);

  // Target values from HOLD_POSES.md
  const targetSpec = JSON.parse(fs.readFileSync('hold_poses.json', 'utf8'));
  const proposedReach = targetSpec.l1 + targetSpec.l2; // 0.32 + 0.30 = 0.62 m
  const reachRatio = actualReach / proposedReach;
  console.log(`Proposed Target Reach: ${proposedReach.toFixed(4)} m`);
  console.log(`Reconciliation Reach Scale Ratio: ${reachRatio.toFixed(6)}`);

  console.log('\n=== STEP 2: MEASURE ALL FIVE WEAPONS & RECONCILE POSES ===');

  const weapons = [
    {
      id: 'assault_rifle',
      name: 'Assault Rifle',
      glb: 'packages/client/public/models/ak47.glb',
      parser: parseRealAK47Model,
      defBuilder: createRealAK47VisualDef,
      hipOffset: new THREE.Vector3(0.13, -0.16, -0.32),
      adsOffset: new THREE.Vector3(0.0, -0.085, -0.22),
    },
    {
      id: 'pistol',
      name: 'Tactical Pistol',
      glb: 'packages/client/public/models/pistol.glb',
      parser: parseRealPistolModel,
      defBuilder: buildPistolVisualDef,
      hipOffset: new THREE.Vector3(0.12, -0.14, -0.32),
      adsOffset: new THREE.Vector3(0.0, -0.0694, -0.44),
    },
    {
      id: 'smg',
      name: 'Rapid SMG',
      glb: 'packages/client/public/models/smg.glb',
      parser: parseRealSmgModel,
      defBuilder: buildSmgVisualDef,
      hipOffset: new THREE.Vector3(0.12, -0.15, -0.28),
      adsOffset: new THREE.Vector3(0.0, -0.072, -0.22),
    },
    {
      id: 'shotgun',
      name: 'Combat Shotgun',
      glb: 'packages/client/public/models/shotgun.glb',
      parser: parseRealShotgunModel,
      defBuilder: buildShotgunVisualDef,
      hipOffset: new THREE.Vector3(0.14, -0.16, -0.32),
      adsOffset: new THREE.Vector3(0.0, -0.062, -0.24),
    },
    {
      id: 'sniper',
      name: 'Precision Sniper',
      glb: 'packages/client/public/models/sniper.glb',
      parser: parseRealSniperModel,
      defBuilder: buildSniperVisualDef,
      hipOffset: new THREE.Vector3(0.13, -0.16, -0.34),
      adsOffset: new THREE.Vector3(0.0, -0.09, -0.26),
    },
  ];

  const reconciliationReport = {
    l1: l1_R,
    l2: l2_R,
    reach: actualReach,
    reachRatio,
    shoulders: {
      R: shoulderCamR.toArray(),
      L: shoulderCamL.toArray(),
    },
    weapons: {},
  };

  for (const w of weapons) {
    const buf = fs.readFileSync(w.glb);
    const gltf = await new Promise((res, rej) =>
      loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej)
    );
    const splitModel = w.parser(gltf.scene);
    const visualDef = w.defBuilder(splitModel);

    // Measure raw gun bounding box
    const box = new THREE.Box3().setFromObject(splitModel.root);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Visual def sockets
    const rightRest = visualDef.clips.idle.keyframes[0].rightHand;
    const leftRest = visualDef.clips.idle.keyframes[0].leftHand;

    // Viewmodel root group placed at hip offset
    const viewmodelGroup = new THREE.Group();
    camera.add(viewmodelGroup);
    viewmodelGroup.position.copy(w.hipOffset);

    const weaponRoot = splitModel.root;
    viewmodelGroup.add(weaponRoot);

    const socketR = new THREE.Object3D();
    socketR.position.copy(rightRest.pos);
    socketR.rotation.copy(rightRest.rot);

    const socketL = new THREE.Object3D();
    socketL.position.copy(leftRest.pos);
    socketL.rotation.copy(leftRest.rot);

    weaponRoot.add(socketR);
    weaponRoot.add(socketL);

    camera.updateMatrixWorld(true);

    const socketPosR = new THREE.Vector3();
    const socketQuatR = new THREE.Quaternion();
    socketR.getWorldPosition(socketPosR);
    socketR.getWorldQuaternion(socketQuatR);

    const socketPosL = new THREE.Vector3();
    const socketQuatL = new THREE.Quaternion();
    socketL.getWorldPosition(socketPosL);
    socketL.getWorldQuaternion(socketQuatL);

    // Solve TwoBoneIK
    armsRig.updateIK(socketPosL, socketQuatL, socketPosR, socketQuatR, false);
    camera.updateMatrixWorld(true);

    const wristPosR = new THREE.Vector3();
    s.handR.getWorldPosition(wristPosR);
    const elbowPosR = new THREE.Vector3();
    s.forearmR.getWorldPosition(elbowPosR);

    const wristPosL = new THREE.Vector3();
    s.handL.getWorldPosition(wristPosL);
    const elbowPosL = new THREE.Vector3();
    s.forearmL.getWorldPosition(elbowPosL);

    // Convert positions to camera space
    const wristCamR = wristPosR.clone().applyMatrix4(invCamWorld);
    const wristCamL = wristPosL.clone().applyMatrix4(invCamWorld);
    const elbowCamR = elbowPosR.clone().applyMatrix4(invCamWorld);
    const elbowCamL = elbowPosL.clone().applyMatrix4(invCamWorld);
    const socketCamR = socketPosR.clone().applyMatrix4(invCamWorld);
    const socketCamL = socketPosL.clone().applyMatrix4(invCamWorld);

    // Compute Acceptance Metrics
    const distR = wristPosR.distanceTo(posShoulderR);
    const distL = wristPosL.distanceTo(posShoulderL);
    const reachPctR = (distR / actualReach) * 100;
    const reachPctL = (distL / actualReach) * 100;

    // Interior elbow angle using law of cosines
    // c^2 = a^2 + b^2 - 2ab cos(C) where c = dist, a = l1, b = l2
    const cosElbowR = (l1_R * l1_R + l2_R * l2_R - distR * distR) / (2 * l1_R * l2_R);
    const elbowAngleDegR = (Math.acos(Math.max(-1, Math.min(1, cosElbowR))) * 180) / Math.PI;

    const cosElbowL = (l1_L * l1_L + l2_L * l2_L - distL * distL) / (2 * l1_L * l2_L);
    const elbowAngleDegL = (Math.acos(Math.max(-1, Math.min(1, cosElbowL))) * 180) / Math.PI;

    // Wrist to socket distance
    const wristSocketDistR = wristPosR.distanceTo(socketPosR);
    const wristSocketDistL = wristPosL.distanceTo(socketPosL);

    // Check downward elbow: elbow.y < wrist.y AND elbow.y < shoulder.y in camera space
    const elbowDownR = elbowCamR.y < wristCamR.y && elbowCamR.y < shoulderCamR.y;
    const elbowDownL = elbowCamL.y < wristCamL.y && elbowCamL.y < shoulderCamL.y;

    const passedR =
      wristSocketDistR < 0.05 && // accounting for palm offset
      reachPctR >= 55 &&
      reachPctR <= 95 &&
      elbowAngleDegR >= 60 &&
      elbowAngleDegR <= 150 &&
      elbowDownR;

    const passedL =
      wristSocketDistL < 0.05 &&
      reachPctL >= 55 &&
      reachPctL <= 99 &&
      elbowAngleDegL >= 60 &&
      elbowAngleDegL <= 150 &&
      elbowDownL;

    console.log(`\n--- Weapon: ${w.name} (${w.id}) ---`);
    console.log(`  Model dimensions (X, Y, Z): [${size.toArray().map(v => v.toFixed(3)).join(', ')}] m`);
    console.log(`  Right Hand:`);
    console.log(`    Wrist Cam Pos:  [${wristCamR.toArray().map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`    Socket Cam Pos: [${socketCamR.toArray().map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`    Elbow Cam Pos:  [${elbowCamR.toArray().map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`    Reach %:        ${reachPctR.toFixed(1)}% (Target: 55-95%)`);
    console.log(`    Elbow Angle:    ${elbowAngleDegR.toFixed(1)} deg (Target: 60-150 deg)`);
    console.log(`    Elbow Downward: ${elbowDownR} (elbow.y < wrist.y and shoulder.y)`);
    console.log(`  Left Hand:`);
    console.log(`    Wrist Cam Pos:  [${wristCamL.toArray().map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`    Socket Cam Pos: [${socketCamL.toArray().map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`    Elbow Cam Pos:  [${elbowCamL.toArray().map(v => v.toFixed(4)).join(', ')}]`);
    console.log(`    Reach %:        ${reachPctL.toFixed(1)}% (Target: 55-95%)`);
    console.log(`    Elbow Angle:    ${elbowAngleDegL.toFixed(1)} deg (Target: 60-150 deg)`);
    console.log(`    Elbow Downward: ${elbowDownL} (elbow.y < wrist.y and shoulder.y)`);

    reconciliationReport.weapons[w.id] = {
      name: w.name,
      size: size.toArray(),
      socketCamR: socketCamR.toArray(),
      socketCamL: socketCamL.toArray(),
      wristCamR: wristCamR.toArray(),
      wristCamL: wristCamL.toArray(),
      elbowCamR: elbowCamR.toArray(),
      elbowCamL: elbowCamL.toArray(),
      reachR: reachPctR,
      reachL: reachPctL,
      elbowAngleR: elbowAngleDegR,
      elbowAngleL: elbowAngleDegL,
      elbowDownR,
      elbowDownL,
    };

    camera.remove(viewmodelGroup);
  }

  fs.writeFileSync('reconciliation_report.json', JSON.stringify(reconciliationReport, null, 2));
  console.log('\nSaved reconciliation report to reconciliation_report.json');
}

reconcile().catch(console.error);
