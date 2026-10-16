import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testAllFingersPerfectWrap() {
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

  const solver = new TwoBoneIKSolver();
  const shoulderWorldL = new THREE.Vector3();
  upperL.getWorldPosition(shoulderWorldL);
  const poleWorldL = new THREE.Vector3(-0.35, -0.65, 0.05);
  const elbowPosL = new THREE.Vector3();
  const palmOffsetLocalL = new THREE.Vector3(-0.00506, 0.03924, 0.00018);

  const socketPos = new THREE.Vector3(-0.011, 0.012, -0.21);
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

  // 1. Index, Middle, Pinky: negative X
  for (const f of ['f_index', 'f_middle', 'f_pinky']) {
    for (const seg of ['01L', '02L', '03L']) {
      const b = armsScene.getObjectByName(f + seg);
      b.rotation.set(-1.0, 0, 0);
    }
  }

  // 2. Ring: positive X (since flipped in rig)
  for (const seg of ['01L', '02L', '03L']) {
    const b = armsScene.getObjectByName('f_ring' + seg);
    b.rotation.set(1.1, 0, 0);
  }

  // 3. Thumb
  const t1 = armsScene.getObjectByName('thumb01L');
  const t2 = armsScene.getObjectByName('thumb02L');
  const t3 = armsScene.getObjectByName('thumb03L');
  t1.rotation.set(0.1, 0.35, 0.55);
  t2.rotation.set(-0.85, 0, 0);
  t3.rotation.set(-0.75, 0, 0);

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

  console.log(`Palm Center: ${distToGun(palmCenter).toFixed(2)} mm (budget <= 12mm)`);
  console.log(`Thumb:  ${dThumb.toFixed(2)} mm (budget <= 8mm)`);
  console.log(`Index:  ${dIndex.toFixed(2)} mm (budget <= 8mm)`);
  console.log(`Middle: ${dMid.toFixed(2)} mm (budget <= 8mm)`);
  console.log(`Ring:   ${dRing.toFixed(2)} mm (budget <= 8mm)`);
  console.log(`Pinky:  ${dPinky.toFixed(2)} mm (budget <= 8mm)`);

  // Check skinned mesh vertices
  let deepPenetrations = 0;
  armsScene.traverse((obj) => {
    if (obj.isSkinnedMesh) {
      const pos = obj.geometry.attributes.position;
      const skinIndex = obj.geometry.attributes.skinIndex;
      const skinWeight = obj.geometry.attributes.skinWeight;
      const bones = obj.skeleton.bones;
      const boneInverses = obj.skeleton.boneInverses;

      const vertex = new THREE.Vector3();
      const skinned = new THREE.Vector3();
      const temp = new THREE.Vector3();

      for (let i = 0; i < pos.count; i++) {
        skinned.set(0, 0, 0);
        vertex.fromBufferAttribute(pos, i);

        // Check if vertex belongs to left hand/fingers
        let isLeftHand = false;
        for (let j = 0; j < 4; j++) {
          const bIdx = skinIndex.getComponent(i, j);
          const weight = skinWeight.getComponent(i, j);
          if (weight > 0.01) {
            const bName = bones[bIdx].name;
            if (bName.endsWith('L') && (bName.includes('hand') || bName.includes('palm') || bName.includes('f_') || bName.includes('thumb'))) {
              isLeftHand = true;
            }
            temp.copy(vertex).applyMatrix4(boneInverses[bIdx]).applyMatrix4(bones[bIdx].matrixWorld);
            skinned.addScaledVector(temp, weight);
          }
        }

        if (isLeftHand) {
          // Check if point is inside gun bounding volume
          // AK-47 handguard is approximately around x: [-0.02, 0.02], y: [-0.01, 0.03], z: [-0.30, -0.15]
          if (Math.abs(skinned.x) < 0.018 && skinned.y > -0.012 && skinned.y < 0.035 && skinned.z > -0.28 && skinned.z < -0.16) {
            // Check distance to closest surface triangle
            const d = distToGun(skinned);
            // If inside gun mesh by more than 3mm:
            // Handguard center axis is at x=0, y=0.010, z
            const rToAxis = Math.hypot(skinned.x, skinned.y - 0.010);
            if (rToAxis < 0.012) { // 12mm from central axis is deep inside handguard body
              deepPenetrations++;
              console.log(`Vertex ${i} at (${skinned.x.toFixed(4)}, ${skinned.y.toFixed(4)}, ${skinned.z.toFixed(4)}) rToAxis: ${(rToAxis * 1000).toFixed(2)}mm, distToGun: ${(distToGun(skinned)).toFixed(2)}mm`);
            }
          }
        }
      }
    }
  });

  console.log(`Hand vertices inside gun mesh deeper than 3mm: ${deepPenetrations} (budget = 0)`);
}

testAllFingersPerfectWrap().catch(console.error);
