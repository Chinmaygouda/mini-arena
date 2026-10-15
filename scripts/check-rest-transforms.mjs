import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function checkRestPose() {
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
  const scene = gltf.scene;

  const upperR = scene.getObjectByName('upper_armR');
  const foreR = scene.getObjectByName('forearmR');
  const handR = scene.getObjectByName('handR');

  const upperL = scene.getObjectByName('upper_armL');
  const foreL = scene.getObjectByName('forearmL');
  const handL = scene.getObjectByName('handL');

  console.log('--- REST LOCAL TRANSFORMS ---');
  console.log('upper_armR pos:', upperR.position.toArray(), 'quat:', upperR.quaternion.toArray());
  console.log('forearmR pos:', foreR.position.toArray(), 'quat:', foreR.quaternion.toArray());
  console.log('handR pos:', handR.position.toArray(), 'quat:', handR.quaternion.toArray());

  console.log('\nupper_armL pos:', upperL.position.toArray(), 'quat:', upperL.quaternion.toArray());
  console.log('forearmL pos:', foreL.position.toArray(), 'quat:', foreL.quaternion.toArray());
  console.log('handL pos:', handL.position.toArray(), 'quat:', handL.quaternion.toArray());

  // Check world positions in rest pose
  scene.updateMatrixWorld(true);
  const wUpperR = new THREE.Vector3();
  const wForeR = new THREE.Vector3();
  const wHandR = new THREE.Vector3();
  upperR.getWorldPosition(wUpperR);
  foreR.getWorldPosition(wForeR);
  handR.getWorldPosition(wHandR);

  console.log('\n--- REST WORLD POSITIONS ---');
  console.log('upper_armR world pos:', wUpperR.toArray().map(v=>v.toFixed(4)));
  console.log('forearmR world pos:', wForeR.toArray().map(v=>v.toFixed(4)));
  console.log('handR world pos:', wHandR.toArray().map(v=>v.toFixed(4)));

  const upperDirR = new THREE.Vector3().subVectors(wForeR, wUpperR).normalize();
  const foreDirR = new THREE.Vector3().subVectors(wHandR, wForeR).normalize();
  console.log('upper_armR world vector to forearm:', upperDirR.toArray().map(v=>v.toFixed(4)));
  console.log('forearmR world vector to hand:', foreDirR.toArray().map(v=>v.toFixed(4)));
}

checkRestPose().catch(console.error);
