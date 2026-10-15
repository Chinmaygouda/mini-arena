import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { TwoBoneIKSolver } from '../packages/client/src/animation/twoBoneIk.ts';

globalThis.self = globalThis;
globalThis.window = globalThis;

function solveChain(
  solver,
  shoulderBone,
  upperArmBone,
  forearmBone,
  handBone,
  restUpperDir,
  restForeDir,
  targetWorldPos,
  targetWorldRot,
  poleHintWorld,
  upperLen,
  foreLen
) {
  // Update matrix world before reading
  shoulderBone.updateMatrixWorld(true);
  
  const shoulderWorld = new THREE.Vector3();
  upperArmBone.getWorldPosition(shoulderWorld);

  const elbowWorld = new THREE.Vector3();
  solver.solve(shoulderWorld, targetWorldPos, poleHintWorld, upperLen, foreLen, elbowWorld);

  // Upper arm orientation
  const upperDirWorld = new THREE.Vector3().subVectors(elbowWorld, shoulderWorld).normalize();
  const shoulderWorldQuat = new THREE.Quaternion();
  shoulderBone.getWorldQuaternion(shoulderWorldQuat);
  const upperDirLocal = upperDirWorld.clone().applyQuaternion(shoulderWorldQuat.clone().invert());
  upperArmBone.quaternion.setFromUnitVectors(restUpperDir, upperDirLocal);
  upperArmBone.updateMatrixWorld(true);

  // Forearm orientation
  const forearmWorld = new THREE.Vector3();
  forearmBone.getWorldPosition(forearmWorld);
  const foreDirWorld = new THREE.Vector3().subVectors(targetWorldPos, forearmWorld).normalize();
  const upperWorldQuat = new THREE.Quaternion();
  upperArmBone.getWorldQuaternion(upperWorldQuat);
  const foreDirLocal = foreDirWorld.clone().applyQuaternion(upperWorldQuat.clone().invert());
  forearmBone.quaternion.setFromUnitVectors(restForeDir, foreDirLocal);
  forearmBone.updateMatrixWorld(true);

  // Hand orientation
  const foreWorldQuat = new THREE.Quaternion();
  forearmBone.getWorldQuaternion(foreWorldQuat);
  const targetWorldQuat = new THREE.Quaternion().setFromEuler(targetWorldRot);
  handBone.quaternion.copy(targetWorldQuat).premultiply(foreWorldQuat.clone().invert());
  handBone.updateMatrixWorld(true);

  const finalHandWorld = new THREE.Vector3();
  handBone.getWorldPosition(finalHandWorld);

  return {
    shoulderWorld,
    elbowWorld,
    finalHandWorld,
    dist: finalHandWorld.distanceTo(targetWorldPos),
  };
}

async function testScene() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const loader = new GLTFLoader();
  loader.parse(arrayBuffer, '', (gltf) => {
    const camera = new THREE.PerspectiveCamera(75, 16/9, 0.1, 100);
    camera.position.set(0, 1.7, 0); // Camera at player eye level

    const viewmodelGroup = new THREE.Group();
    camera.add(viewmodelGroup);
    // Viewmodel offset (hip pos)
    viewmodelGroup.position.set(0.13, -0.16, -0.32);

    const weaponGroup = new THREE.Group();
    viewmodelGroup.add(weaponGroup);

    // Arms rig group attached to camera (anchored at body)
    const armsRigGroup = gltf.scene;
    // Drillimpact rig rest pose has camera bone at Y=1.743155
    armsRigGroup.position.set(0, -1.743155, 0);
    camera.add(armsRigGroup);

    camera.updateMatrixWorld(true);

    const shoulderR = armsRigGroup.getObjectByName('shoulderR');
    const upperR = armsRigGroup.getObjectByName('upper_armR');
    const foreR = armsRigGroup.getObjectByName('forearmR');
    const handR = armsRigGroup.getObjectByName('handR');

    const shoulderL = armsRigGroup.getObjectByName('shoulderL');
    const upperL = armsRigGroup.getObjectByName('upper_armL');
    const foreL = armsRigGroup.getObjectByName('forearmL');
    const handL = armsRigGroup.getObjectByName('handL');

    const restUpperRDir = foreR.position.clone().normalize();
    const restForeRDir = handR.position.clone().normalize();
    const restUpperLDir = foreL.position.clone().normalize();
    const restForeLDir = handL.position.clone().normalize();

    // Sockets in weapon local space
    const gripRSocket = new THREE.Vector3(0.0, -0.065, 0.045);
    const gripLSocket = new THREE.Vector3(-0.02, -0.015, -0.21);

    // World space target positions
    const gripRWorld = gripRSocket.clone().applyMatrix4(weaponGroup.matrixWorld);
    const gripLWorld = gripLSocket.clone().applyMatrix4(weaponGroup.matrixWorld);

    console.log('Camera pos:', camera.position.toArray());
    console.log('Grip R World:', gripRWorld.toArray().map(v=>v.toFixed(4)));
    console.log('Grip L World:', gripLWorld.toArray().map(v=>v.toFixed(4)));

    const solver = new TwoBoneIKSolver();
    // Pole hints in world space (relative to camera)
    const poleRWorld = new THREE.Vector3(0.4, -0.4, -0.2).applyMatrix4(camera.matrixWorld);
    const poleLWorld = new THREE.Vector3(-0.4, -0.4, -0.2).applyMatrix4(camera.matrixWorld);

    const resR = solveChain(
      solver, shoulderR, upperR, foreR, handR,
      restUpperRDir, restForeRDir,
      gripRWorld, new THREE.Euler(-0.35, 0, 0),
      poleRWorld, 0.3222, 0.2373
    );

    const resL = solveChain(
      solver, shoulderL, upperL, foreL, handL,
      restUpperLDir, restForeLDir,
      gripLWorld, new THREE.Euler(0.2, 0.35, -0.45),
      poleLWorld, 0.3222, 0.2373
    );

    console.log('Res R dist to grip:', resR.dist.toFixed(6));
    console.log('Res L dist to grip:', resL.dist.toFixed(6));
  });
}

testScene().catch(console.error);
