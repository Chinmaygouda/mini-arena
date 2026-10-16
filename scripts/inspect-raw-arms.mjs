import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function testArmsOrientation() {
  const loader = new GLTFLoader();
  const buf = fs.readFileSync('packages/client/public/models/arms_rig.glb');
  const gltf = await new Promise((res, rej) =>
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej)
  );

  const rig = gltf.scene;
  console.log('Rig scene children:', rig.children.map(c => c.name));

  const cameraBone = rig.getObjectByName('camera');
  console.log('Camera bone pos:', cameraBone?.position);

  const upperArmR = rig.getObjectByName('upper_armR');
  const upperArmL = rig.getObjectByName('upper_armL');

  console.log('upper_armR local pos:', upperArmR?.position);
  console.log('upper_armL local pos:', upperArmL?.position);

  rig.updateMatrixWorld(true);

  const posR = new THREE.Vector3();
  const posL = new THREE.Vector3();
  upperArmR.getWorldPosition(posR);
  upperArmL.getWorldPosition(posL);

  console.log('upper_armR world pos:', posR);
  console.log('upper_armL world pos:', posL);
}

testArmsOrientation().catch(console.error);
