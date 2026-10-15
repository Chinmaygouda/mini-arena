import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';
import { validateWeaponVisualDef } from '../animation/validateVisualDef';
import {
  parseRealShotgunModel,
  buildShotgunVisualDef,
} from './shotgunSlice';
import { countObjectTriangles } from './realWeaponSlice';

describe('Real Weapon Model Slice — Combat Shotgun Contract Verification', () => {
  it('parses shotgun.glb into discrete body, reciprocating pump slide, and shell matching contract', async () => {
    const g = globalThis as { self?: unknown };
    if (typeof g.self === 'undefined') {
      g.self = globalThis;
    }

    const glbUrl = new URL('../../public/models/shotgun.glb', import.meta.url);
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

    const splitModel = parseRealShotgunModel(gltf.scene);

    expect(splitModel.body).toBeDefined();
    expect(splitModel.bolt).toBeDefined(); // Reciprocating pump slide
    expect(splitModel.mag).toBeDefined(); // 12-gauge shell

    const bodyTris = countObjectTriangles(splitModel.body);
    const pumpTris = splitModel.bolt ? countObjectTriangles(splitModel.bolt) : 0;
    const magTris = splitModel.mag ? countObjectTriangles(splitModel.mag) : 0;
    const totalTris = bodyTris + pumpTris + magTris;

    // Measured: shotgun (1664) + shotguntrigger (92) + shotgunpomp (224) + magShell (32) = 2,012 triangles
    // CylinderGeometry(r, r, h, 8) = 8 radialSegments → 8×2 body + 8 top + 8 bottom = 32 tris
    expect(bodyTris).toBe(1756); // 1664 + 92
    expect(pumpTris).toBe(224);
    expect(magTris).toBe(32); // 8-segment cylinder shell (32 tris)
    expect(totalTris).toBe(2012);

    // Build the visual definition
    const visualDef = buildShotgunVisualDef(splitModel);
    expect(visualDef.weaponId).toBe('shotgun');
    expect(visualDef.name).toBe('Combat Shotgun');

    // Validate visual def contract and clips
    const validationResult = validateWeaponVisualDef(visualDef);
    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toEqual([]);

    expect(visualDef.clips.idle).toBeDefined();
    expect(visualDef.clips.fire).toBeDefined();
    expect(visualDef.clips.draw).toBeDefined();
    expect(visualDef.clips.inspect).toBeDefined();
    expect(visualDef.clips.reloadShellStart).toBeDefined();
    expect(visualDef.clips.reloadShellInsert).toBeDefined();
    expect(visualDef.clips.reloadShellEnd).toBeDefined();

    expect(visualDef.boltTravelVector).toEqual(new THREE.Vector3(0, 0, 1));
  });
});
