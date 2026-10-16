import { describe, expect, it } from 'vitest';
import { ALL_MAPS, getMapSpec, WAREHOUSE_MAP, PLAZA_MAP, CONTAINERYARD_MAP } from './index';
import { validateMapSpec } from './validation';

describe('Phase 5 Modular Maps & Specifications', () => {
  it('loads all 3 production maps via ALL_MAPS and getMapSpec', () => {
    expect(Object.keys(ALL_MAPS)).toEqual(['warehouse', 'plaza', 'containeryard']);
    expect(getMapSpec('warehouse')).toBe(WAREHOUSE_MAP);
    expect(getMapSpec('plaza')).toBe(PLAZA_MAP);
    expect(getMapSpec('containeryard')).toBe(CONTAINERYARD_MAP);
    expect(getMapSpec('unknown')).toBe(WAREHOUSE_MAP); // default fallback
  });

  it('validates WAREHOUSE_MAP: 4 spawns, bounds clearance, slope limits, and floor reachability', () => {
    const res = validateMapSpec(WAREHOUSE_MAP);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
    expect(res.metrics.spawnCount).toBe(4);
    expect(res.metrics.alphaSpawns).toBe(2);
    expect(res.metrics.bravoSpawns).toBe(2);
    expect(res.metrics.minSpawnDistance).toBeGreaterThanOrEqual(25.0);
    expect(res.metrics.isReachable).toBe(true);
    expect(res.metrics.rampCount).toBeGreaterThanOrEqual(2);
  });

  it('validates PLAZA_MAP: 4 spawns, bounds clearance, fountain cover, and floor reachability', () => {
    const res = validateMapSpec(PLAZA_MAP);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
    expect(res.metrics.spawnCount).toBe(4);
    expect(res.metrics.alphaSpawns).toBe(2);
    expect(res.metrics.bravoSpawns).toBe(2);
    expect(res.metrics.minSpawnDistance).toBeGreaterThanOrEqual(30.0);
    expect(res.metrics.isReachable).toBe(true);
  });

  it('validates CONTAINERYARD_MAP: 4 spawns, bounds clearance, container corridors, and floor reachability', () => {
    const res = validateMapSpec(CONTAINERYARD_MAP);
    expect(res.errors).toEqual([]);
    expect(res.valid).toBe(true);
    expect(res.metrics.spawnCount).toBe(4);
    expect(res.metrics.alphaSpawns).toBe(2);
    expect(res.metrics.bravoSpawns).toBe(2);
    expect(res.metrics.minSpawnDistance).toBeGreaterThanOrEqual(40.0);
    expect(res.metrics.isReachable).toBe(true);
  });

  it('detects and flags invalid map with spawn placed inside solid obstacle', () => {
    const corruptMap = JSON.parse(JSON.stringify(WAREHOUSE_MAP));
    corruptMap.spawns[0].pos = { x: -11, y: 0, z: 2 }; // directly inside crate-w-tall!
    const res = validateMapSpec(corruptMap);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes('collides with obstacle box'))).toBe(true);
  });

  it('detects and flags map with partitioned floor unreachable between teams', () => {
    const walledMap = JSON.parse(JSON.stringify(WAREHOUSE_MAP));
    // Build solid wall sealing Z = 0 across entire width
    walledMap.boxes.push({
      id: 'impassable-barrier',
      pos: { x: 0, y: 1.0, z: 0 },
      size: { x: 42, y: 3.0, z: 1.0 },
      materialKey: 'wall_brick',
      surfaceType: 'concrete',
    });
    const res = validateMapSpec(walledMap);
    expect(res.valid).toBe(false);
    expect(res.metrics.isReachable).toBe(false);
  });
});
