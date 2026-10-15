import fs from 'node:fs';
import * as THREE from '../packages/client/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../packages/client/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;

const buf = fs.readFileSync('packages/client/public/models/sniper.glb');
const loader = new GLTFLoader();
loader.parse(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  '',
  (gltf) => {
    const nodes = [];
    let totalTris = 0;
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        const tris = child.geometry.index
          ? child.geometry.index.count / 3
          : child.geometry.attributes.position.count / 3;
        const box = new THREE.Box3().setFromObject(child);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        nodes.push({
          name: child.name,
          tris,
          parent: child.parent?.name ?? 'root',
          center: center.toArray().map(v => +v.toFixed(4)),
          size: size.toArray().map(v => +v.toFixed(4)),
          min: box.min.toArray().map(v => +v.toFixed(4)),
          max: box.max.toArray().map(v => +v.toFixed(4)),
        });
        totalTris += tris;
      }
    });
    console.log('Sniper GLB Nodes:');
    console.log(JSON.stringify(nodes, null, 2));
    console.log('Total triangles:', totalTris);
  },
  (err) => console.error('Parse error:', err),
);
