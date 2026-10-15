import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';
import { validateWeaponVisualDef } from '../animation/validateVisualDef';
import {
  parseRealPistolModel,
  buildPistolVisualDef,
} from './pistolSlice';
import { countObjectTriangles } from './realWeaponSlice';

describe('Real Weapon Model Slice — Tactical Pistol Contract Verification', () => {
  it('parses pistol.glb into discrete body, reciprocating slide, and separated magazine matching contract', async () => {
    const g = globalThis as { self?: unknown };
    if (typeof g.self === 'undefined') {
      g.self = globalThis;
    }

    const glbUrl = new URL('../../public/models/pistol.glb', import.meta.url);
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

    const splitModel = parseRealPistolModel(gltf.scene);

    expect(splitModel.body).toBeDefined();
    expect(splitModel.bolt).toBeDefined(); // Reciprocating slide
    expect(splitModel.mag).toBeDefined(); // Detached magazine

    const bodyTris = countObjectTriangles(splitModel.body);
    const slideTris = splitModel.bolt ? countObjectTriangles(splitModel.bolt) : 0;
    const magTris = splitModel.mag ? countObjectTriangles(splitModel.mag) : 0;
    const totalTris = bodyTris + slideTris + magTris;

    // Measured: pew (640) + pewtrigger (40) + pewhaut (952) + pewmagazine (92) = 1,724 triangles
    expect(totalTris).toBe(1724);
    expect(bodyTris).toBe(680);
    expect(slideTris).toBe(952);
    expect(magTris).toBe(92);

    // Build the visual definition
    const visualDef = buildPistolVisualDef(splitModel);
    expect(visualDef.weaponId).toBe('pistol');
    expect(visualDef.name).toBe('Tactical Pistol');

    // Validate visual def contract and clips
    const validationResult = validateWeaponVisualDef(visualDef);
    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toEqual([]);

    expect(visualDef.clips.idle).toBeDefined();
    expect(visualDef.clips.fire).toBeDefined();
    expect(visualDef.clips.draw).toBeDefined();
    expect(visualDef.clips.inspect).toBeDefined();
    expect(visualDef.clips.reloadTactical).toBeDefined();
    expect(visualDef.clips.reloadEmpty).toBeDefined();

    // Verify slide travel is along Z axis
    expect(visualDef.boltTravelVector).toEqual(new THREE.Vector3(0, 0, 1));
  });
});
