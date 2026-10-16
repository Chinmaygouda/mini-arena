import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testHandMesh() {
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

  const boneLengths = {
    thumb03L: 0.0358,
    f_index03L: 0.0238,
    f_middle03L: 0.0300,
    f_ring03L: 0.0319,
    f_pinky03L: 0.0222,
  };

  // Apply finger grips
  function curl(name, rx, ry = 0, rz = 0) {
    const b = armsScene.getObjectByName(name);
    if (b) {
      b.rotation.x = rx;
      b.rotation.y = ry;
      b.rotation.z = rz;
    }
  }

  // Curl 4 fingers under and up around the right side of handguard
  for (let rotX = 0.5; rotX <= 1.8; rotX += 0.2) {
    ['f_index', 'f_middle', 'f_ring', 'f_pinky'].forEach(f => {
      curl(f + '01L', rotX, 0, 0);
      curl(f + '02L', rotX * 0.9, 0, 0);
      curl(f + '03L', rotX * 0.8, 0, 0);
    });

    // Thumb over top
    curl('thumb01L', 0.2, 0.4, 0.5);
    curl('thumb02L', rotX * 0.7, 0, 0);
    curl('thumb03L', rotX * 0.6, 0, 0);

    armsScene.updateMatrixWorld(true);

    const dThumb = distToGun(new THREE.Vector3(0, boneLengths.thumb03L, 0).applyMatrix4(armsScene.getObjectByName('thumb03L').matrixWorld));
    const dIndex = distToGun(new THREE.Vector3(0, boneLengths.f_index03L, 0).applyMatrix4(armsScene.getObjectByName('f_index03L').matrixWorld));
    const dMid = distToGun(new THREE.Vector3(0, boneLengths.f_middle03L, 0).applyMatrix4(armsScene.getObjectByName('f_middle03L').matrixWorld));
    const dRing = distToGun(new THREE.Vector3(0, boneLengths.f_ring03L, 0).applyMatrix4(armsScene.getObjectByName('f_ring03L').matrixWorld));
    const dPinky = distToGun(new THREE.Vector3(0, boneLengths.f_pinky03L, 0).applyMatrix4(armsScene.getObjectByName('f_pinky03L').matrixWorld));

    console.log(`rotX=${rotX.toFixed(1)} -> Thumb: ${dThumb.toFixed(1)}mm, Index: ${dIndex.toFixed(1)}mm, Mid: ${dMid.toFixed(1)}mm, Ring: ${dRing.toFixed(1)}mm, Pinky: ${dPinky.toFixed(1)}mm`);
  }
}

testHandMesh().catch(console.error);
