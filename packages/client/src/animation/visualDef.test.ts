import { describe, expect, it } from 'vitest';
import { createAssaultRifleVisualDef } from './assaultRifleDef';
import { createPistolVisualDef } from './pistolDef';
import { createSmgVisualDef } from './smgDef';
import { createShotgunVisualDef } from './shotgunDef';
import { createSniperVisualDef } from './sniperDef';
import { validateWeaponVisualDef } from './validateVisualDef';
import { WeaponVisualDef } from './types';

describe('WeaponVisualDef Contract & Asset-Swappable Validator Tests', () => {
  const visualDefs = [
    { id: 'assault_rifle', factory: createAssaultRifleVisualDef },
    { id: 'pistol', factory: createPistolVisualDef },
    { id: 'smg', factory: createSmgVisualDef },
    { id: 'shotgun', factory: createShotgunVisualDef },
    { id: 'sniper', factory: createSniperVisualDef },
  ];

  visualDefs.forEach(({ id, factory }) => {
    it(`validates ${id} WeaponVisualDef satisfies all contract rules`, () => {
      const def = factory();
      const result = validateWeaponVisualDef(def);

      if (!result.valid) {
        console.error(`Validation errors for ${id}:`, result.errors);
      }

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(def.weaponId).toBe(id);
      expect(def.bodyMesh).toBeDefined();
      expect(def.magMesh).toBeDefined();
      expect(def.boltMesh).toBeDefined();
      expect(def.muzzleOffset).toBeDefined();
      expect(def.ejectionPortOffset).toBeDefined();
    });
  });

  it('rejects an incomplete WeaponVisualDef with clear error messages', () => {
    // Malformed def missing clips and meshes
    const badDef = {
      weaponId: 'pistol',
      name: 'Bad Pistol',
    } as unknown as WeaponVisualDef;

    const result = validateWeaponVisualDef(badDef);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors).toContain('Missing bodyMesh');
    expect(result.errors).toContain('Missing magMesh');
    expect(result.errors).toContain('Missing boltMesh');
    expect(result.errors).toContain('Missing clips dictionary');
  });

  it('rejects a reload clip with non-integer tick duration at 60 Hz', () => {
    const validDef = createAssaultRifleVisualDef();
    // Tamper reloadTactical clip with non-integer ticks (e.g. 2.1333s = 127.998 ticks)
    const tamperedDef: WeaponVisualDef = {
      ...validDef,
      clips: {
        ...validDef.clips,
        reloadTactical: {
          ...validDef.clips.reloadTactical,
          duration: 2.1333,
        },
      },
    };

    const result = validateWeaponVisualDef(tamperedDef);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('not integer-tick clean at 60 Hz'))).toBe(true);
  });

  it('allows half-tick duration strictly for fire clip (e.g. 800 RPM SMG = 4.5 ticks)', () => {
    const smgDef = createSmgVisualDef();
    expect(smgDef.clips.fire.duration).toBeCloseTo(0.075, 4); // 4.5 ticks
    const result = validateWeaponVisualDef(smgDef);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
