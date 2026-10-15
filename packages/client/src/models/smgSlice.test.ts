import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';
import { validateWeaponVisualDef } from '../animation/validateVisualDef';
import {
  parseRealSmgModel,
  buildSmgVisualDef,
} from './smgSlice';
import { countObjectTriangles } from './realWeaponSlice';

describe('Real Weapon Model Slice — Rapid SMG Contract Verification', () => {
  it('parses smg.glb into discrete body, reciprocating bolt, and separated magazine matching contract', async () => {
    const g = globalThis as { self?: unknown };
    if (typeof g.self === 'undefined') {
      g.self = globalThis;
    }

    const glbUrl = new URL('../../public/models/smg.glb', import.meta.url);
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

    const splitModel = parseRealSmgModel(gltf.scene);

    expect(splitModel.body).toBeDefined();
    expect(splitModel.bolt).toBeDefined(); // Reciprocating bolt handle
    expect(splitModel.mag).toBeDefined(); // Detached magazine

    const bodyTris = countObjectTriangles(splitModel.body);
    const boltTris = splitModel.bolt ? countObjectTriangles(splitModel.bolt) : 0;
    const magTris = splitModel.mag ? countObjectTriangles(splitModel.mag) : 0;
    const totalTris = bodyTris + boltTris + magTris;

    // Measured: mac10 (896) + mac10derriere (534) + mac10rond (222) + mac10trigger (32) + mac10bt (58) + mac10magazine (28) = 1,770 triangles
    expect(totalTris).toBe(1770);
    expect(bodyTris).toBe(1684);
    expect(boltTris).toBe(58);
    expect(magTris).toBe(28);

    // Build the visual definition
    const visualDef = buildSmgVisualDef(splitModel);
    expect(visualDef.weaponId).toBe('smg');
    expect(visualDef.name).toBe('Rapid SMG');

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

    expect(visualDef.boltTravelVector).toEqual(new THREE.Vector3(0, 0, 1));
  });
});
