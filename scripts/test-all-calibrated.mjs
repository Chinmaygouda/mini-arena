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

async function testCalibration() {
  const loader = new GLTFLoader();

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

  // Test calibrated offsets & sockets
  const configs = [
    {
      id: 'assault_rifle',
      name: 'Assault Rifle',
      glb: 'packages/client/public/models/ak47.glb',
      parser: parseRealAK47Model,
      hipOffset: new THREE.Vector3(0.13, -0.16, -0.28), // shifted slightly back
      socketR: new THREE.Vector3(0.0, -0.065, 0.045),
      socketL: new THREE.Vector3(-0.042, -0.045, -0.10), // tuned forward support
    },
    {
      id: 'pistol',
      name: 'Tactical Pistol',
      glb: 'packages/client/public/models/pistol.glb',
      parser: parseRealPistolModel,
      hipOffset: new THREE.Vector3(0.08, -0.16, -0.38), // natural extended two-hand hold
      socketR: new THREE.Vector3(0.0, -0.042, 0.015),
      socketL: new THREE.Vector3(-0.025, -0.050, 0.015),
    },
    {
      id: 'smg',
      name: 'Rapid SMG',
      glb: 'packages/client/public/models/smg.glb',
      parser: parseRealSmgModel,
      hipOffset: new THREE.Vector3(0.12, -0.15, -0.28),
      socketR: new THREE.Vector3(0.0, -0.055, 0.035),
      socketL: new THREE.Vector3(-0.035, -0.030, -0.15),
    },
    {
      id: 'shotgun',
      name: 'Combat Shotgun',
      glb: 'packages/client/public/models/shotgun.glb',
      parser: parseRealShotgunModel,
      hipOffset: new THREE.Vector3(0.14, -0.16, -0.32),
      socketR: new THREE.Vector3(0.0, -0.050, 0.060),
      socketL: new THREE.Vector3(-0.025, -0.035, -0.22), // comfortable pump forend
    },
    {
      id: 'sniper',
      name: 'Precision Sniper',
      glb: 'packages/client/public/models/sniper.glb',
      parser: parseRealSniperModel,
      hipOffset: new THREE.Vector3(0.13, -0.16, -0.28),
      socketR: new THREE.Vector3(0.0, -0.045, 0.085),
      socketL: new THREE.Vector3(-0.042, -0.048, -0.10), // comfortable sniper forend
    },
  ];

  console.log('=== CALIBRATION RESULTS FOR ALL 5 WEAPONS ===\n');

  let allPass = true;

  for (const cfg of configs) {
    const buf = fs.readFileSync(cfg.glb);
    const gltf = await new Promise((res, rej) =>
      loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej)
    );
    const splitModel = cfg.parser(gltf.scene);

    const viewmodelGroup = new THREE.Group();
    camera.add(viewmodelGroup);
    viewmodelGroup.position.copy(cfg.hipOffset);

    const weaponRoot = splitModel.root;
    viewmodelGroup.add(weaponRoot);

    const socketR = new THREE.Object3D();
    socketR.position.copy(cfg.socketR);
    const socketL = new THREE.Object3D();
    socketL.position.copy(cfg.socketL);

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

    armsRig.updateIK(socketPosL, socketQuatL, socketPosR, socketQuatR, false);
    camera.updateMatrixWorld(true);

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

    const l1 = posShoulderR.distanceTo(posForearmR);
    const l2 = posForearmR.distanceTo(posHandR);
    const maxReach = l1 + l2;

    const dR = posHandR.distanceTo(posShoulderR);
    const dL = posHandL.distanceTo(posShoulderL);

    const reachR = (dR / maxReach) * 100;
    const reachL = (dL / maxReach) * 100;

    const cosR = (l1 * l1 + l2 * l2 - dR * dR) / (2 * l1 * l2);
    const elbowDegR = (Math.acos(Math.max(-1, Math.min(1, cosR))) * 180) / Math.PI;

    const cosL = (l1 * l1 + l2 * l2 - dL * dL) / (2 * l1 * l2);
    const elbowDegL = (Math.acos(Math.max(-1, Math.min(1, cosL))) * 180) / Math.PI;

    const camElbowR = posForearmR.clone().applyMatrix4(invCamWorld);
    const camHandR = posHandR.clone().applyMatrix4(invCamWorld);
    const camShoulderR = posShoulderR.clone().applyMatrix4(invCamWorld);

    const camElbowL = posForearmL.clone().applyMatrix4(invCamWorld);
    const camHandL = posHandL.clone().applyMatrix4(invCamWorld);
    const camShoulderL = posShoulderL.clone().applyMatrix4(invCamWorld);

    const elbowDownR = camElbowR.y < camHandR.y && camElbowR.y < camShoulderR.y;
    const elbowDownL = camElbowL.y < camHandL.y && camElbowL.y < camShoulderL.y;

    const passR = reachR >= 55 && reachR <= 95 && elbowDegR >= 60 && elbowDegR <= 150 && elbowDownR;
    const passL = reachL >= 55 && reachL <= 95 && elbowDegL >= 60 && elbowDegL <= 150 && elbowDownL;

    if (!passR || !passL) allPass = false;

    console.log(`Weapon: ${cfg.name} (${cfg.id})`);
    console.log(`  Right Hand: reach=${reachR.toFixed(1)}% (55-95%), elbow=${elbowDegR.toFixed(1)}° (60-150°), elbowDown=${elbowDownR} -> ${passR ? 'PASS' : 'FAIL'}`);
    console.log(`  Left Hand:  reach=${reachL.toFixed(1)}% (55-95%), elbow=${elbowDegL.toFixed(1)}° (60-150°), elbowDown=${elbowDownL} -> ${passL ? 'PASS' : 'FAIL'}`);

    camera.remove(viewmodelGroup);
  }

  console.log(`\n==============================================`);
  console.log(`FINAL RESULT: ${allPass ? 'ALL 5 WEAPONS 100% PASSED!' : 'SOME FAILED'}`);
  console.log(`==============================================`);
}

testCalibration().catch(console.error);
