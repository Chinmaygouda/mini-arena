import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testAllFingersNegativeCurl() {
  const loader = new GLTFLoader();
  const akBuf = fs.readFileSync('packages/client/public/models/ak47.glb');
  const akGltf = await new Promise((res, rej) => loader.parse(akBuf.buffer.slice(akBuf.buffer.byteOffset, akBuf.buffer.byteLength), '', res, rej));
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

  const boneLengths = {
    thumb03L: 0.0358,
    f_index03L: 0.0238,
    f_middle03L: 0.0300,
    f_ring03L: 0.0319,
    f_pinky03L: 0.0222,
  };

  for (let rot = -1.6; rot <= -0.6; rot += 0.2) {
    for (const f of ['f_index', 'f_middle', 'f_ring', 'f_pinky']) {
      for (const seg of ['01L', '02L', '03L']) {
        const b = armsScene.getObjectByName(f + seg);
        b.rotation.set(rot, 0, 0);
      }
    }
    // Thumb
    const t1 = armsScene.getObjectByName('thumb01L');
    const t2 = armsScene.getObjectByName('thumb02L');
    const t3 = armsScene.getObjectByName('thumb03L');
    t1.rotation.set(0.2, 0.4, 0.6);
    t2.rotation.set(rot * 0.7, 0, 0);
    t3.rotation.set(rot * 0.7, 0, 0);

    armsScene.updateMatrixWorld(true);

    const palmBones = ['palm01L', 'palm02L', 'palm03L', 'palm04L'].map(n => armsScene.getObjectByName(n));
    const palmCenter = new THREE.Vector3();
    palmBones.forEach(b => palmCenter.add(b.getWorldPosition(new THREE.Vector3())));
    palmCenter.multiplyScalar(0.25);

    const dThumb = distToGun(new THREE.Vector3(0, boneLengths.thumb03L, 0).applyMatrix4(t3.matrixWorld));
    const dIndex = distToGun(new THREE.Vector3(0, boneLengths.f_index03L, 0).applyMatrix4(armsScene.getObjectByName('f_index03L').matrixWorld));
    const dMid = distToGun(new THREE.Vector3(0, boneLengths.f_middle03L, 0).applyMatrix4(armsScene.getObjectByName('f_middle03L').matrixWorld));
    const dRing = distToGun(new THREE.Vector3(0, boneLengths.f_ring03L, 0).applyMatrix4(armsScene.getObjectByName('f_ring03L').matrixWorld));
    const dPinky = distToGun(new THREE.Vector3(0, boneLengths.f_pinky03L, 0).applyMatrix4(armsScene.getObjectByName('f_pinky03L').matrixWorld));

    console.log(`rot=${rot.toFixed(1)} -> Palm: ${distToGun(palmCenter).toFixed(1)}mm | Thumb: ${dThumb.toFixed(1)}mm, Index: ${dIndex.toFixed(1)}mm, Mid: ${dMid.toFixed(1)}mm, Ring: ${dRing.toFixed(1)}mm, Pinky: ${dPinky.toFixed(1)}mm`);
  }
}

testAllFingersNegativeCurl().catch(console.error);
