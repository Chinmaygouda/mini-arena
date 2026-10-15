import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

// Polyfill self and window for GLTFLoader in Node
globalThis.self = globalThis;
globalThis.window = globalThis;

function inspectGlb(filePath) {
  return new Promise((resolve, reject) => {
    const buf = fs.readFileSync(filePath);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const loader = new GLTFLoader();
    loader.parse(
      arrayBuffer,
      '',
      (gltf) => {
        const meshes = [];
        let skinnedMesh = null;
        let totalTris = 0;
        const box = new THREE.Box3();

        gltf.scene.traverse((obj) => {
          if (obj.isMesh || obj.isSkinnedMesh) {
            let tris = 0;
            if (obj.geometry.index) {
              tris = obj.geometry.index.count / 3;
            } else if (obj.geometry.attributes.position) {
              tris = obj.geometry.attributes.position.count / 3;
            }
            totalTris += tris;
            meshes.push({
              name: obj.name,
              type: obj.type,
              tris,
              pos: obj.position.toArray().map(v => v.toFixed(4)),
              rot: [obj.rotation.x.toFixed(4), obj.rotation.y.toFixed(4), obj.rotation.z.toFixed(4)],
              material: Array.isArray(obj.material) ? obj.material.map(m=>m.name) : obj.material?.name,
            });
            box.expandByObject(obj);
          }
          if (obj.isSkinnedMesh) {
            skinnedMesh = obj;
          }
        });

        const bones = [];
        if (skinnedMesh && skinnedMesh.skeleton) {
          skinnedMesh.skeleton.bones.forEach((b, i) => {
            bones.push({
              index: i,
              name: b.name,
              pos: b.position.toArray().map(v => v.toFixed(4)),
              parent: b.parent?.name,
            });
          });
        }

        resolve({
          filePath,
          totalTris,
          boundingBox: {
            min: box.min.toArray().map(v => v.toFixed(4)),
            max: box.max.toArray().map(v => v.toFixed(4)),
            size: box.getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(4)),
          },
          meshes,
          bones,
        });
      },
      reject
    );
  });
}

async function run() {
  const armsInfo = await inspectGlb('packages/client/public/models/arms_rig.glb');
  console.log('=== ARMS RIG ===');
  console.log(`Total Tris: ${armsInfo.totalTris}`);
  console.log('Bounds:', armsInfo.boundingBox);
  console.log('Meshes:', armsInfo.meshes);
  console.log('Bones count:', armsInfo.bones.length);
  console.log('Bones list:');
  armsInfo.bones.forEach(b => console.log(`  [${b.index}] "${b.name}" parent: "${b.parent}" pos: [${b.pos.join(', ')}]`));
}

run().catch(console.error);
