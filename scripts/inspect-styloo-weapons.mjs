import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

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
        let totalTris = 0;
        const box = new THREE.Box3();
        const nodes = [];

        gltf.scene.traverse((obj) => {
          let tris = 0;
          if (obj.geometry) {
            if (obj.geometry.index) {
              tris = obj.geometry.index.count / 3;
            } else if (obj.geometry.attributes.position) {
              tris = obj.geometry.attributes.position.count / 3;
            }
            totalTris += tris;
            box.expandByObject(obj);
          }
          const nodeBox = new THREE.Box3();
          if (obj.isMesh) nodeBox.setFromObject(obj);

          nodes.push({
            name: obj.name,
            type: obj.type,
            tris,
            position: obj.position.toArray().map(v => +v.toFixed(4)),
            rotation: [+(obj.rotation.x * 180 / Math.PI).toFixed(1), +(obj.rotation.y * 180 / Math.PI).toFixed(1), +(obj.rotation.z * 180 / Math.PI).toFixed(1)],
            boxMin: obj.isMesh ? nodeBox.min.toArray().map(v => +v.toFixed(4)) : null,
            boxMax: obj.isMesh ? nodeBox.max.toArray().map(v => +v.toFixed(4)) : null,
          });
        });

        resolve({
          file: path.basename(filePath),
          fileSizeBytes: buf.length,
          totalTris,
          boundingBox: {
            min: box.min.toArray().map(v => +v.toFixed(4)),
            max: box.max.toArray().map(v => +v.toFixed(4)),
            size: box.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(4)),
          },
          nodes,
        });
      },
      reject
    );
  });
}

async function run() {
  const glbDir = 'packages/client/public/models/styloo_extracted/Styloo Guns Asset Pack GLTF FBX V1.1/Normal version Color and NormalMap/GLB';
  const emissionGlbDir = 'packages/client/public/models/styloo_extracted/Styloo Guns Asset Pack GLTF FBX V1.1/zEmission version Color only/GLB';
  const files = ['pew.glb', 'mac10.glb', 'shotgun.glb', 'awp.glb', 'ak47.glb'];

  console.log('================================================================');
  console.log(' MEASURED STYLOO PACK WEAPONS INSPECTION ON DISK');
  console.log('================================================================');

  for (const f of files) {
    const fullPath = path.join(glbDir, f);
    if (!fs.existsSync(fullPath)) {
      console.log(`FILE NOT FOUND: ${fullPath}`);
      continue;
    }
    const info = await inspectGlb(fullPath);
    console.log(`\n--- ${info.file} (${info.fileSizeBytes} bytes, ${info.totalTris} tris) ---`);
    console.log(`Bounds: size=[${info.boundingBox.size.join(', ')}] min=[${info.boundingBox.min.join(', ')}] max=[${info.boundingBox.max.join(', ')}]`);
    console.log('Nodes:');
    info.nodes.forEach(n => {
      console.log(`  - [${n.type}] "${n.name}": tris=${n.tris}, pos=[${n.position.join(', ')}], rot=[${n.rotation.join(', ')}]`);
      if (n.boxMin) {
        console.log(`      boxMin=[${n.boxMin.join(', ')}] boxMax=[${n.boxMax.join(', ')}]`);
      }
    });
  }
}

run().catch(console.error);
