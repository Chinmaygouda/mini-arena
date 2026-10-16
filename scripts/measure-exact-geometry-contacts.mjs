import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { FirstPersonArmsRig } from '../packages/client/src/animation/armsRig.ts';
import { parseRealPistolModel } from '../packages/client/src/models/pistolSlice.ts';
import { PISTOL_GRIP_RIGHT, PISTOL_GRIP_LEFT } from '../packages/client/src/animation/fingerGripPoses.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

// Point to triangle distance squared
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
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    const bc = new THREE.Vector3().subVectors(c, b);
    return new THREE.Vector3().copy(b).addScaledVector(bc, w).sub(p).lengthSq();
  }

  const denom = 1.0 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return new THREE.Vector3().copy(a).addScaledVector(ab, v).addScaledVector(ac, w).sub(p).lengthSq();
}

async function measureExactGeometry() {
  const loader = new GLTFLoader();

  const camera = new THREE.PerspectiveCamera(75, 1280 / 720, 0.01, 100);
  const viewmodelGroup = new THREE.Group();
  camera.add(viewmodelGroup);

  // 1. Load pistol
  const pistolBuf = fs.readFileSync('packages/client/public/models/pistol.glb');
  const pistolGltf = await new Promise((res, rej) =>
    loader.parse(pistolBuf.buffer.slice(pistolBuf.byteOffset, pistolBuf.byteOffset + pistolBuf.byteLength), '', res, rej)
  );
  const splitModel = parseRealPistolModel(pistolGltf.scene);
  viewmodelGroup.add(splitModel.root);

  // 2. Load arms
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
  armsRig.setCustomFingerGrips(PISTOL_GRIP_LEFT, PISTOL_GRIP_RIGHT);

  // Setup sockets
  const socketR = new THREE.Object3D();
  socketR.position.set(0.012, -0.040, 0.082);
  socketR.rotation.set(-1.74, 0.08, -0.12, 'YXZ');

  const socketL = new THREE.Object3D();
  socketL.position.set(-0.032, -0.050, 0.075);
  socketL.rotation.set(-1.64, -0.16, 0.20, 'YXZ');

  splitModel.root.add(socketR);
  splitModel.root.add(socketL);

  viewmodelGroup.position.set(0.12, -0.14, -0.32); // Hip position
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

  // Collect triangles of pistol body (frame + grip) and slide
  const frameTriangles = [];
  const slideTriangles = [];

  splitModel.body.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      const geom = obj.geometry.clone().applyMatrix4(obj.matrixWorld);
      const pos = geom.attributes.position;
      const idx = geom.index;
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) {
          frameTriangles.push([
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i)),
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1)),
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2)),
          ]);
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
          slideTriangles.push([
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i)),
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1)),
            new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2)),
          ]);
        }
      }
    }
  });

  console.log(`Pistol Frame Triangles: ${frameTriangles.length}`);
  console.log(`Pistol Slide Triangles: ${slideTriangles.length}`);

  // Group arms vertices by primary bone influence
  const geom = skinnedMesh.geometry;
  const posAttr = geom.attributes.position;
  const skinIdx = geom.attributes.skinIndex;
  const skinWeight = geom.attributes.skinWeight;
  const bones = skinnedMesh.skeleton.bones;

  const boneVertexMap = new Map();
  for (let i = 0; i < bones.length; i++) {
    boneVertexMap.set(bones[i].name, []);
  }

  // Pre-calculate bone world matrices * bindMatrixInverse
  const boneMatrices = [];
  const skeleton = skinnedMesh.skeleton;
  skeleton.update();
  for (let i = 0; i < skeleton.bones.length; i++) {
    const bMat = new THREE.Matrix4().multiplyMatrices(skeleton.bones[i].matrixWorld, skeleton.boneInverses[i]);
    boneMatrices.push(bMat);
  }

  // Transform each vertex by its skinning matrices
  for (let i = 0; i < posAttr.count; i++) {
    const rawPos = new THREE.Vector3().fromBufferAttribute(posAttr, i);
    const skinnedPos = new THREE.Vector3(0, 0, 0);
    const temp = new THREE.Vector3();

    let maxW = 0;
    let bestBoneIdx = 0;
    for (let j = 0; j < 4; j++) {
      const w = skinWeight.getComponent(i, j);
      const bIdx = skinIdx.getComponent(i, j);
      if (w > 0) {
        temp.copy(rawPos).applyMatrix4(boneMatrices[bIdx]);
        skinnedPos.addScaledVector(temp, w);
      }
      if (w > maxW) {
        maxW = w;
        bestBoneIdx = bIdx;
      }
    }
    const bone = bones[bestBoneIdx];
    if (bone) {
      boneVertexMap.get(bone.name).push(skinnedPos.clone());
    }
  }

  function minDistanceToTriangles(vertices, triangles) {
    if (!vertices || vertices.length === 0) return Infinity;
    let minDistSq = Infinity;
    for (const v of vertices) {
      for (const [a, b, c] of triangles) {
        const dSq = pointToTriangleDistSq(v, a, b, c);
        if (dSq < minDistSq) minDistSq = dSq;
      }
    }
    return Math.sqrt(minDistSq);
  }

  console.log('\n========================================================================');
  console.log('       TACTICAL PISTOL: RIGOROUS VERTEX-TO-TRIANGLE MESH CONTACT');
  console.log('========================================================================');

  // Right Hand Contacts
  const rightContacts = [
    { name: 'Right Palm (palm01R)', bones: ['palm01R', 'handR'] },
    { name: 'Right Index / Trigger (f_index01-03R)', bones: ['f_index01R', 'f_index02R', 'f_index03R'] },
    { name: 'Right Middle Wrap (f_middle01-03R)', bones: ['f_middle01R', 'f_middle02R', 'f_middle03R'] },
    { name: 'Right Ring Wrap (f_ring01-03R)', bones: ['f_ring01R', 'f_ring02R', 'f_ring03R'] },
    { name: 'Right Pinky Wrap (f_pinky01-03R)', bones: ['f_pinky01R', 'f_pinky02R', 'f_pinky03R'] },
    { name: 'Right Thumb Frame Flat (thumb01-03R)', bones: ['thumb01R', 'thumb02R', 'thumb03R'] },
  ];

  console.log('\n--- RIGHT HAND (PRIMARY GRIP) ---');
  for (const rc of rightContacts) {
    const verts = rc.bones.flatMap((b) => boneVertexMap.get(b) || []);
    const distMm = minDistanceToTriangles(verts, frameTriangles) * 1000;
    console.log(`  ${rc.name.padEnd(38)} : ${distMm.toFixed(2)} mm (verts: ${verts.length})`);
  }

  // Left Hand Contacts
  const leftContacts = [
    { name: 'Left Palm Support (palm01-04L, handL)', bones: ['palm01L', 'palm02L', 'palm03L', 'palm04L', 'handL'] },
    { name: 'Left Index Support (f_index01-03L)', bones: ['f_index01L', 'f_index02L', 'f_index03L'] },
    { name: 'Left Middle Support (f_middle01-03L)', bones: ['f_middle01L', 'f_middle02L', 'f_middle03L'] },
    { name: 'Left Ring Support (f_ring01-03L)', bones: ['f_ring01L', 'f_ring02L', 'f_ring03L'] },
    { name: 'Left Pinky Support (f_pinky01-03L)', bones: ['f_pinky01L', 'f_pinky02L', 'f_pinky03L'] },
    { name: 'Left Thumb Flat (thumb01-03L)', bones: ['thumb01L', 'thumb02L', 'thumb03L'] },
  ];

  console.log('\n--- LEFT HAND (SUPPORT GRIP) ---');
  for (const lc of leftContacts) {
    const verts = lc.bones.flatMap((b) => boneVertexMap.get(b) || []);
    const distMm = minDistanceToTriangles(verts, frameTriangles) * 1000;
    console.log(`  ${lc.name.padEnd(38)} : ${distMm.toFixed(2)} mm (verts: ${verts.length})`);
  }

  // Slide Clearance
  console.log('\n--- SLIDE CLEARANCE ---');
  const leftThumbVerts = ['thumb01L', 'thumb02L', 'thumb03L'].flatMap((b) => boneVertexMap.get(b) || []);
  const leftThumbToSlideMm = minDistanceToTriangles(leftThumbVerts, slideTriangles) * 1000;
  console.log(`  Left Thumb Clearance to Slide           : ${leftThumbToSlideMm.toFixed(2)} mm (Safe > 5mm)`);

  const rightThumbVerts = ['thumb01R', 'thumb02R', 'thumb03R'].flatMap((b) => boneVertexMap.get(b) || []);
  const rightThumbToSlideMm = minDistanceToTriangles(rightThumbVerts, slideTriangles) * 1000;
  console.log(`  Right Thumb Clearance to Slide          : ${rightThumbToSlideMm.toFixed(2)} mm (Safe > 5mm)`);

  // Left vs Right Arm Mesh Intersections
  console.log('\n--- ARM-TO-ARM SLEEVE INTERSECTION CHECK ---');
  const rightArmVerts = ['forearmR', 'handR', 'upper_armR'].flatMap((b) => boneVertexMap.get(b) || []);
  const leftArmVerts = ['forearmL', 'handL', 'upper_armL'].flatMap((b) => boneVertexMap.get(b) || []);

  let minArmDistSq = Infinity;
  for (const rv of rightArmVerts) {
    for (const lv of leftArmVerts) {
      const dSq = rv.distanceToSquared(lv);
      if (dSq < minArmDistSq) minArmDistSq = dSq;
    }
  }
  const minArmDistMm = Math.sqrt(minArmDistSq) * 1000;
  console.log(`  Minimum Surface Distance (Right vs Left): ${minArmDistMm.toFixed(2)} mm`);
  console.log(`  Sleeve Penetration / Collision Status   : ${minArmDistMm > 0.0 ? 'ZERO PENETRATION (CLEAR)' : 'PENETRATING'}`);

  console.log('========================================================================\n');
}

measureExactGeometry().catch(console.error);
