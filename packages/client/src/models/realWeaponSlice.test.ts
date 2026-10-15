import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';
import { validateWeaponVisualDef } from '../animation/validateVisualDef';
import {
  countObjectTriangles,
  createRealAK47VisualDef,
  parseRealAK47Model,
} from './realWeaponSlice';

describe('Real Weapon Model Slice — AK-47 & PSX Arms Contract Verification', () => {
  it('parses ak47.glb into discrete body, separated magazine, and bolt matching contract', async () => {
    // Explicit polyfill for Node test runner
    const g = globalThis as { self?: unknown };
    if (typeof g.self === 'undefined') {
      g.self = globalThis;
    }

    const glbUrl = new URL('../../public/models/ak47.glb', import.meta.url);
    const buffer = fs.readFileSync(glbUrl);

    const loader = new GLTFLoader();
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        '',
        resolve,
        reject,
      );
    });

    expect(gltf.scene).toBeDefined();

    const splitModel = parseRealAK47Model(gltf.scene);

    expect(splitModel.root).toBeDefined();
    expect(splitModel.body).toBeDefined();
    expect(splitModel.mag).toBeDefined();
    expect(splitModel.bolt).toBeDefined();
    // 2,373 triangles from Styloo AK-47 GLB + 12 triangles from modular bolt = 2,385
    expect(splitModel.triangleCount).toBe(2385);
    expect(splitModel.mag.name).toBe('AK47_Real_Mag');
    expect(splitModel.magRestPos.x).toBeCloseTo(0, 2);
    expect(splitModel.magRestPos.z).toBeCloseTo(-0.125, 2);

    const bBox = new THREE.Box3().setFromObject(splitModel.root);
    console.log('AK-47 Root BBox:', bBox.min, bBox.max);
    splitModel.root.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        const mb = new THREE.Box3().setFromObject(c);
        console.log('AK Mesh:', c.name, 'min:', mb.min, 'max:', mb.max);
      }
    });

    // Build the visual definition
    const visualDef = createRealAK47VisualDef(splitModel);
    expect(visualDef.weaponId).toBe('assault_rifle');
    expect(visualDef.name).toBe('AK-47 Assault Rifle');

    // Validate against strict WeaponVisualDef contract rules
    const validation = validateWeaponVisualDef(visualDef);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
    }
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Verify integer tick alignment on all clips matching ASSAULT_RIFLE_DEF
    expect(visualDef.clips.idle.duration * 60).toBe(180);
    expect(visualDef.clips.draw.duration * 60).toBe(12);
    expect(visualDef.clips.inspect.duration * 60).toBe(144);
    expect(visualDef.clips.reloadTactical.duration * 60).toBe(126);
    expect(visualDef.clips.reloadEmpty.duration * 60).toBe(156);
    expect(visualDef.clips.fire.duration * 60).toBe(6);
  });

  it('verifies Drillimpact PSX arms rig contains 1,176 triangles within viewmodel budget', async () => {
    const g = globalThis as { self?: unknown };
    if (typeof g.self === 'undefined') {
      g.self = globalThis;
    }

    const glbUrl = new URL('../../public/models/arms_rig.glb', import.meta.url);
    const buffer = fs.readFileSync(glbUrl);

    const loader = new GLTFLoader();
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        '',
        resolve,
        reject,
      );
    });

    expect(gltf.scene).toBeDefined();
    const armsMesh = gltf.scene.getObjectByName('ArmsMesh') as THREE.SkinnedMesh | undefined;
    expect(armsMesh).toBeDefined();
    expect(armsMesh?.isSkinnedMesh).toBe(true);

    const armsTris = countObjectTriangles(armsMesh!);
    expect(armsTris).toBe(1176);

    // Total viewmodel triangle footprint
    const totalTris = 2373 + 1176;
    expect(totalTris).toBe(3549);
    // PLAN.md viewmodel budget is 10,000 triangles
    expect(totalTris).toBeLessThan(10000);

    console.log('=== ARMS RIG HIERARCHY ===');
    gltf.scene.traverse((c) => {
      if ((c as THREE.Bone).isBone) {
        console.log('Bone:', c.name, 'pos:', c.position);
      }
      if ((c as THREE.SkinnedMesh).isSkinnedMesh) {
        const sm = c as THREE.SkinnedMesh;
        console.log('SkinnedMesh:', sm.name, 'skeleton bones:', sm.skeleton.bones.length);
        console.log('Geometry groups:', sm.geometry.groups);
        console.log('Geometry attributes:', Object.keys(sm.geometry.attributes));
        if (Array.isArray(sm.material)) {
          sm.material.forEach((m, idx) => console.log('Mat[' + idx + ']:', m.name, m.type));
        } else {
          console.log('Mat:', sm.material.name, sm.material.type);
        }
      }
    });
  });
});
