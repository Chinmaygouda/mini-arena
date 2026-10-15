import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
globalThis.window = globalThis;

async function inspectGlb(name) {
  const filePath = path.join('packages/client/public/models', name);
  const buf = fs.readFileSync(filePath);
  const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      arrayBuffer,
      '',
      (gltf) => {
        let totalTris = 0;
        let meshCount = 0;
        const meshDetails = [];
        gltf.scene.traverse((obj) => {
          if (obj.isMesh) {
            meshCount++;
            let tris = 0;
            if (obj.geometry.index) {
              tris = obj.geometry.index.count / 3;
            } else if (obj.geometry.attributes.position) {
              tris = obj.geometry.attributes.position.count / 3;
            }
            totalTris += tris;
            meshDetails.push({ name: obj.name, tris, type: obj.type });
          }
        });
        resolve({
          name,
          sizeBytes: buf.length,
          sizeKB: +(buf.length / 1024).toFixed(1),
          meshCount,
          totalTris,
          meshDetails,
        });
      },
      reject
    );
  });
}

async function main() {
  const files = ['ak47.glb', 'pistol.glb', 'smg.glb', 'shotgun.glb', 'sniper.glb', 'arms_rig.glb'];
  const results = [];
  for (const f of files) {
    const res = await inspectGlb(f);
    results.push(res);
  }
  console.log('--- EXACT GLB FILE SIZES AND TRIANGLES ---');
  for (const r of results) {
    console.log(`\n${r.name}: ${r.totalTris} tris, ${r.sizeKB} KB (${r.meshCount} meshes)`);
    for (const m of r.meshDetails) {
      console.log(`  - ${m.name} (${m.type}): ${m.tris} tris`);
    }
  }
}

main().catch(console.error);
