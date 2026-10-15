import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';
import { validateWeaponVisualDef } from '../animation/validateVisualDef';
import {
  parseRealSniperModel,
  buildSniperVisualDef,
} from './sniperSlice';
import { countObjectTriangles } from './realWeaponSlice';

describe('Real Weapon Model Slice — Precision Sniper Contract Verification', () => {
  it('parses sniper.glb into discrete body, reciprocating bolt handle, and separated magazine matching contract', async () => {
    const g = globalThis as { self?: unknown };
    if (typeof g.self === 'undefined') {
      g.self = globalThis;
    }

    const glbUrl = new URL('../../public/models/sniper.glb', import.meta.url);
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

    const splitModel = parseRealSniperModel(gltf.scene);

    expect(splitModel.body).toBeDefined();
    expect(splitModel.bolt).toBeDefined(); // Dedicated bolt handle
    expect(splitModel.mag).toBeDefined(); // 5-round box magazine

    const bodyTris = countObjectTriangles(splitModel.body);
    const boltTris = splitModel.bolt ? countObjectTriangles(splitModel.bolt) : 0;
    const magTris = splitModel.mag ? countObjectTriangles(splitModel.mag) : 0;
    const totalTris = bodyTris + boltTris + magTris;

    // Measured:
    // awp (1310) + sniperscope_low (404) + snipertendon_low (226) + snipertendon_low001 (226) + snipertrigger_low (20) = 2,186 body tris
    // mag: snipermagazine_low (60 tris)
    // bolt: stem (24) + knob (60) = 84 tris
    // total = 2,186 + 60 + 84 = 2,330 tris
    expect(bodyTris).toBe(2186);
    expect(magTris).toBe(60);
    expect(boltTris).toBe(84);
    expect(totalTris).toBe(2330);

    // Build the visual definition
    const visualDef = buildSniperVisualDef(splitModel);
    expect(visualDef.weaponId).toBe('sniper');
    expect(visualDef.name).toBe('Precision Sniper');

    // Validate visual def contract and clips
    const validationResult = validateWeaponVisualDef(visualDef);
    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toEqual([]);

    expect(visualDef.clips.idle).toBeDefined();
    expect(visualDef.clips.fire).toBeDefined();
    expect(visualDef.clips.draw).toBeDefined();
    expect(visualDef.clips.inspect).toBeDefined();
    expect(visualDef.clips.boltCycle).toBeDefined();
    expect(visualDef.clips.reloadTactical).toBeDefined();
    expect(visualDef.clips.reloadEmpty).toBeDefined();

    expect(visualDef.boltTravelVector).toEqual(new THREE.Vector3(0, 0, 0.07));
  });
});
