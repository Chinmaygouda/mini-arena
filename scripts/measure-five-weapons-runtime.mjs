import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { FirstPersonArmsRig } from '../packages/client/src/animation/armsRig.ts';
import { parseRealAK47Model, createRealAK47VisualDef } from '../packages/client/src/models/realWeaponSlice.ts';
import { parseRealPistolModel, buildPistolVisualDef } from '../packages/client/src/models/pistolSlice.ts';
import { parseRealSmgModel, buildSmgVisualDef } from '../packages/client/src/models/smgSlice.ts';
import { parseRealShotgunModel, buildShotgunVisualDef } from '../packages/client/src/models/shotgunSlice.ts';
import { parseRealSniperModel, buildSniperVisualDef } from '../packages/client/src/models/sniperSlice.ts';
import {
  AK_GRIP_LEFT,
  AK_GRIP_RIGHT,
  PISTOL_GRIP_LEFT,
  PISTOL_GRIP_RIGHT,
  SMG_GRIP_LEFT,
  SMG_GRIP_RIGHT,
  SHOTGUN_GRIP_LEFT,
  SHOTGUN_GRIP_RIGHT,
  SNIPER_GRIP_LEFT,
  SNIPER_GRIP_RIGHT,
} from '../packages/client/src/animation/fingerGripPoses.ts';
import {
  ASSAULT_RIFLE_DEF,
  PISTOL_DEF,
  SMG_DEF,
  SHOTGUN_DEF,
  SNIPER_DEF,
} from '../packages/shared/src/weapons/definitions.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

function pointToTriangleDistSq(p, a, b, c) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  const ap = new THREE.Vector3().subVectors(p, a);

  const d1 = ab.dot(ap);
  const d2 = ac.dot(ap);
  if (d1 <= 0 && d2 <= 0) return ap.lengthSq();

  const bp = new THREE.Vector3().subVectors(p, b);
  const d3 = ab.dot(bp);
  const d4 = ac.dot(bp);
  if (d3 >= 0 && d4 <= d3) return bp.lengthSq();

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return new THREE.Vector3().copy(a).addScaledVector(ab, v).sub(p).lengthSq();
  }

  const cp = new THREE.Vector3().subVectors(p, c);
  const d5 = ab.dot(cp);
  const d6 = ac.dot(cp);
  if (d6 >= 0 && d5 <= d6) return cp.lengthSq();

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return new THREE.Vector3().copy(a).addScaledVector(ac, w).sub(p).lengthSq();
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    const bc = new THREE.Vector3().subVectors(c, b);
    return new THREE.Vector3().copy(b).addScaledVector(bc, w).sub(p).lengthSq();
  }

  const denom = 1.0 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return new THREE.Vector3().copy(a).addScaledVector(ab, v).addScaledVector(ac, w).sub(p).lengthSq();
}

function minDistanceToTriangles(point, triangles) {
  let minDistSq = Infinity;
  for (const [a, b, c] of triangles) {
    const dSq = pointToTriangleDistSq(point, a, b, c);
    if (dSq < minDistSq) minDistSq = dSq;
  }
  return Math.sqrt(minDistSq);
}

async function run() {
  const loader = new GLTFLoader();

  // Load arms
  const armsBuf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const armsGltf = await new Promise((res, rej) =>
    loader.parse(armsBuf.buffer.slice(armsBuf.byteOffset, armsBuf.byteOffset + armsBuf.byteLength), '', res, rej)
  );

  let skinnedMesh = null;
  armsGltf.scene.traverse((obj) => {
    if (obj.isSkinnedMesh) skinnedMesh = obj;
  });

  const weaponConfigs = [
    {
      id: 'assault_rifle',
      name: 'Assault Rifle',
      glb: 'packages/client/public/models/ak47.glb',
      parser: parseRealAK47Model,
      defBuilder: createRealAK47VisualDef,
      sharedDef: ASSAULT_RIFLE_DEF,
      grips: { left: AK_GRIP_LEFT, right: AK_GRIP_RIGHT },
      hip: new THREE.Vector3(0.13, -0.16, -0.32),
      ads: new THREE.Vector3(0.0, -0.085, -0.22),
    },
    {
      id: 'pistol',
      name: 'Tactical Pistol',
      glb: 'packages/client/public/models/pistol.glb',
      parser: parseRealPistolModel,
      defBuilder: buildPistolVisualDef,
      sharedDef: PISTOL_DEF,
      grips: { left: PISTOL_GRIP_LEFT, right: PISTOL_GRIP_RIGHT },
      hip: new THREE.Vector3(0.12, -0.14, -0.32),
      ads: new THREE.Vector3(0.0, -0.0694, -0.44),
    },
    {
      id: 'smg',
      name: 'Rapid SMG',
      glb: 'packages/client/public/models/smg.glb',
      parser: parseRealSmgModel,
      defBuilder: buildSmgVisualDef,
      sharedDef: SMG_DEF,
      grips: { left: SMG_GRIP_LEFT, right: SMG_GRIP_RIGHT },
      hip: new THREE.Vector3(0.12, -0.15, -0.28),
      ads: new THREE.Vector3(0.0, -0.072, -0.22),
    },
    {
      id: 'shotgun',
      name: 'Combat Shotgun',
      glb: 'packages/client/public/models/shotgun.glb',
      parser: parseRealShotgunModel,
      defBuilder: buildShotgunVisualDef,
      sharedDef: SHOTGUN_DEF,
      grips: { left: SHOTGUN_GRIP_LEFT, right: SHOTGUN_GRIP_RIGHT },
      hip: new THREE.Vector3(0.14, -0.16, -0.32),
      ads: new THREE.Vector3(0.0, -0.062, -0.24),
    },
    {
      id: 'sniper',
      name: 'Precision Sniper',
      glb: 'packages/client/public/models/sniper.glb',
      parser: parseRealSniperModel,
      defBuilder: buildSniperVisualDef,
      sharedDef: SNIPER_DEF,
      grips: { left: SNIPER_GRIP_LEFT, right: SNIPER_GRIP_RIGHT },
      hip: new THREE.Vector3(0.13, -0.16, -0.34),
      ads: new THREE.Vector3(0.0, -0.09, -0.26),
    },
  ];

  const results = {};

  for (const cfg of weaponConfigs) {
    const buf = fs.readFileSync(cfg.glb);
    const gltf = await new Promise((res, rej) =>
      loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej)
    );

    const splitModel = cfg.parser(gltf.scene);
    const visualDef = cfg.defBuilder(splitModel);

    // Camera and viewmodel hierarchy
    const camera = new THREE.PerspectiveCamera(75, 1280 / 720, 0.01, 100);
    camera.position.set(0, 1.6, 12); // Player eye world pos

    const viewmodelGroup = new THREE.Group();
    camera.add(viewmodelGroup);
    viewmodelGroup.position.copy(cfg.hip);

    const weaponRoot = splitModel.root;
    viewmodelGroup.add(weaponRoot);

    const armsRig = new FirstPersonArmsRig();
    camera.add(armsRig.group);
    armsRig.setSkinnedArms(armsGltf.scene, skinnedMesh);
    armsRig.setCustomFingerGrips(cfg.grips.left, cfg.grips.right);

    // Sockets
    const rightRest = visualDef.clips.idle.keyframes[0].rightHand;
    const leftRest = visualDef.clips.idle.keyframes[0].leftHand;

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

    armsRig.updateIK(socketPosL, socketQuatL, socketPosR, socketQuatR, false);
    camera.updateMatrixWorld(true);

    // Collect weapon triangles in world space for distance calculation
    const bodyTriangles = [];
    splitModel.body.traverse((obj) => {
      if (obj.isMesh && obj.geometry) {
        const geom = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
        const pos = geom.attributes.position;
        const idx = geom.index;
        if (idx) {
          for (let i = 0; i < idx.count; i += 3) {
            bodyTriangles.push([
              new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i)),
              new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1)),
              new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2)),
            ]);
          }
        }
      }
    });

    const invWeaponWorld = new THREE.Matrix4().copy(weaponRoot.matrixWorld).invert();
    const invCamWorld = new THREE.Matrix4().copy(camera.matrixWorld).invert();

    // Sockets in camera space
    const socketRCam = socketPosR.clone().applyMatrix4(invCamWorld);
    const socketLCam = socketPosL.clone().applyMatrix4(invCamWorld);

    // Palm and Wrist positions
    const s = armsRig.skinnedArms;
    const wristRWorld = new THREE.Vector3();
    const wristLWorld = new THREE.Vector3();
    s.handR.getWorldPosition(wristRWorld);
    s.handL.getWorldPosition(wristLWorld);

    const wristRCam = wristRWorld.clone().applyMatrix4(invCamWorld);
    const wristLCam = wristLWorld.clone().applyMatrix4(invCamWorld);

    const elbowRWorld = armsRig.rightElbowPos.clone();
    const elbowLWorld = armsRig.leftElbowPos.clone();
    const elbowRCam = elbowRWorld.clone().applyMatrix4(invCamWorld);
    const elbowLCam = elbowLWorld.clone().applyMatrix4(invCamWorld);

    // Fingertips (bone 03)
    const fingerNames = [
      'thumb03R', 'f_index03R', 'f_middle03R', 'f_ring03R', 'f_pinky03R',
      'thumb03L', 'f_index03L', 'f_middle03L', 'f_ring03L', 'f_pinky03L',
    ];

    const fingertips = {};
    for (const fName of fingerNames) {
      const b = armsRig.fingerBones.get(fName);
      if (b) {
        const worldPos = new THREE.Vector3();
        b.getWorldPosition(worldPos);
        const camPos = worldPos.clone().applyMatrix4(invCamWorld);
        const localPos = worldPos.clone().applyMatrix4(invWeaponWorld);
        const distMm = minDistanceToTriangles(worldPos, bodyTriangles) * 1000;
        fingertips[fName] = {
          worldPos: [worldPos.x, worldPos.y, worldPos.z],
          camPos: [camPos.x, camPos.y, camPos.z],
          weaponLocalPos: [localPos.x, localPos.y, localPos.z],
          distToSurfaceMm: distMm,
        };
      }
    }

    // Muzzle & Ejection port
    const muzzleWorld = splitModel.muzzle.clone().applyMatrix4(weaponRoot.matrixWorld);
    const muzzleCam = muzzleWorld.clone().applyMatrix4(invCamWorld);

    const ejectWorld = splitModel.ejectionPort.clone().applyMatrix4(weaponRoot.matrixWorld);
    const ejectCam = ejectWorld.clone().applyMatrix4(invCamWorld);

    // Reach calculation
    const shoulderR = new THREE.Vector3();
    const shoulderL = new THREE.Vector3();
    s.upperArmR.getWorldPosition(shoulderR);
    s.upperArmL.getWorldPosition(shoulderL);

    const dR = shoulderR.distanceTo(wristRWorld);
    const dL = shoulderL.distanceTo(wristLWorld);
    const maxReach = 0.322236 + 0.237276; // 0.559512 m
    const reachRPercent = (dR / maxReach) * 100;
    const reachLPercent = (dL / maxReach) * 100;

    results[cfg.id] = {
      id: cfg.id,
      name: cfg.name,
      rpm: cfg.sharedDef.rpm,
      fireMode: cfg.sharedDef.fireMode,
      magSize: cfg.sharedDef.magSize,
      reserveMax: cfg.sharedDef.reserveMax,
      hipOffset: [cfg.hip.x, cfg.hip.y, cfg.hip.z],
      adsOffset: [cfg.ads.x, cfg.ads.y, cfg.ads.z],
      socketRLocal: [rightRest.pos.x, rightRest.pos.y, rightRest.pos.z],
      socketREuler: [rightRest.rot.x, rightRest.rot.y, rightRest.rot.z],
      socketRCam: [socketRCam.x, socketRCam.y, socketRCam.z],
      socketLLocal: [leftRest.pos.x, leftRest.pos.y, leftRest.pos.z],
      socketLEuler: [leftRest.rot.x, leftRest.rot.y, leftRest.rot.z],
      socketLCam: [socketLCam.x, socketLCam.y, socketLCam.z],
      wristRCam: [wristRCam.x, wristRCam.y, wristRCam.z],
      wristLCam: [wristLCam.x, wristLCam.y, wristLCam.z],
      elbowRCam: [elbowRCam.x, elbowRCam.y, elbowRCam.z],
      elbowLCam: [elbowLCam.x, elbowLCam.y, elbowLCam.z],
      reachRPercent,
      reachLPercent,
      muzzleCam: [muzzleCam.x, muzzleCam.y, muzzleCam.z],
      ejectCam: [ejectCam.x, ejectCam.y, ejectCam.z],
      fingertips,
      reloadSpec: cfg.sharedDef.reloadSpec,
      recoil: {
        patternLength: cfg.sharedDef.recoil.pattern.length,
        basePitch: cfg.sharedDef.recoil.pattern[0].pitch,
        recoverySpeed: cfg.sharedDef.recoil.recoverySpeed,
        resetTime: cfg.sharedDef.recoil.resetTime,
      },
    };
  }

  fs.writeFileSync('five_weapons_runtime_measurements.json', JSON.stringify(results, null, 2));
  console.log('Saved five_weapons_runtime_measurements.json successfully!');
}

run().catch(console.error);
