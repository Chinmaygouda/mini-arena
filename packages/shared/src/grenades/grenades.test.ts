import { describe, expect, it } from 'vitest';
import {
  ActiveGrenade,
  ActiveSmokeVolume,
  GRENADE_DEFS,
  HitTarget,
  IGrenadeCollisionWorld,
  Vec3,
  applyDummyDamage,
  applyPlayerDamage,
  calculateFlashBlindness,
  calculateFragBlast,
  createDummyTarget,
  createGrenadeProjectile,
  createInitialPlayerVitals,
  cycleGrenadeType,
  isLineBlockedBySmoke,
  startGrenadeWindUp,
  stepDummyVitals,
  stepGrenadePhysics,
  stepGrenadeWindUp,
  stepPlayerVitals,
} from '../index';

// Mock collision world for tests
class MockWorld implements IGrenadeCollisionWorld {
  public walls: Array<{ normal: Vec3; point: Vec3; thickness: number }> = [];
  public losBlocked = false;

  sphereCast(start: Vec3, dir: Vec3, distance: number, radius: number) {
    for (const wall of this.walls) {
      // Simple planar collision along X axis for testing
      if (wall.normal.x !== 0) {
        const wallX = wall.point.x;
        if (dir.x > 0 && start.x <= wallX && start.x + dir.x * distance + radius >= wallX) {
          const hitDist = Math.max(0, (wallX - radius - start.x) / dir.x);
          return {
            hit: true,
            point: { x: wallX, y: start.y + dir.y * hitDist, z: start.z + dir.z * hitDist },
            normal: { x: -Math.sign(dir.x), y: 0, z: 0 },
            fraction: hitDist / distance,
          };
        }
      }
      // Floor collision along Y axis
      if (wall.normal.y > 0) {
        const floorY = wall.point.y;
        if (dir.y < 0 && start.y >= floorY && start.y + dir.y * distance - radius <= floorY) {
          const hitDist = Math.max(0, (start.y - radius - floorY) / -dir.y);
          return {
            hit: true,
            point: { x: start.x + dir.x * hitDist, y: floorY, z: start.z + dir.z * hitDist },
            normal: { x: 0, y: 1, z: 0 },
            fraction: hitDist / distance,
          };
        }
      }
    }
    return null;
  }

  checkLineOfSight(from: Vec3, to: Vec3): boolean {
    return !this.losBlocked;
  }
}

describe('Grenade System', () => {
  it('enforces exact fuse tick countdowns for frag, flash, and smoke', () => {
    const world = new MockWorld();

    // 1. Frag fuse: 150 ticks (2.5s)
    const frag = createGrenadeProjectile(1, 'frag', 'player-1', { x: 0, y: 1.6, z: 0 }, 0, 0);
    expect(frag.fuseRemaining).toBe(GRENADE_DEFS.frag.fuseTicks); // 150
    for (let t = 0; t < 149; t++) {
      const res = stepGrenadePhysics(frag, world);
      expect(res.detonated).toBe(false);
      expect(frag.fuseRemaining).toBe(149 - t);
    }
    const finalFragRes = stepGrenadePhysics(frag, world);
    expect(finalFragRes.detonated).toBe(true);
    expect(frag.fuseRemaining).toBe(0);

    // 2. Flash fuse: 100 ticks (1.667s)
    const flash = createGrenadeProjectile(2, 'flash', 'player-1', { x: 0, y: 1.6, z: 0 }, 0, 0);
    expect(flash.fuseRemaining).toBe(100);
    for (let t = 0; t < 99; t++) {
      const res = stepGrenadePhysics(flash, world);
      expect(res.detonated).toBe(false);
    }
    expect(stepGrenadePhysics(flash, world).detonated).toBe(true);

    // 3. Smoke fuse: 120 ticks (2.0s)
    const smoke = createGrenadeProjectile(3, 'smoke', 'player-1', { x: 0, y: 1.6, z: 0 }, 0, 0);
    expect(smoke.fuseRemaining).toBe(120);
    for (let t = 0; t < 119; t++) {
      const res = stepGrenadePhysics(smoke, world);
      expect(res.detonated).toBe(false);
    }
    expect(stepGrenadePhysics(smoke, world).detonated).toBe(true);
  });

  it('guarantees 1000-run bounce determinism without bit drift', () => {
    const world = new MockWorld();
    world.walls.push({ normal: { x: 0, y: 1, z: 0 }, point: { x: 0, y: 0, z: 0 }, thickness: 1 });
    world.walls.push({ normal: { x: 1, y: 0, z: 0 }, point: { x: 5, y: 0, z: 0 }, thickness: 0.1 });

    let baselineX = 0;
    let baselineY = 0;
    let baselineZ = 0;

    for (let run = 0; run < 1000; run++) {
      const nade = createGrenadeProjectile(run, 'frag', 'p1', { x: 0, y: 1.5, z: 0 }, 0, 0.1);
      // Step 60 ticks
      for (let t = 0; t < 60; t++) {
        stepGrenadePhysics(nade, world);
      }

      if (run === 0) {
        baselineX = nade.pos.x;
        baselineY = nade.pos.y;
        baselineZ = nade.pos.z;
      } else {
        expect(nade.pos.x).toBe(baselineX);
        expect(nade.pos.y).toBe(baselineY);
        expect(nade.pos.z).toBe(baselineZ);
      }
    }
  });

  it('prevents wall tunneling at max speed (18 m/s) against thin walls', () => {
    const world = new MockWorld();
    // 0.05m thin wall placed at x = 0.5m
    world.walls.push({ normal: { x: 1, y: 0, z: 0 }, point: { x: 0.5, y: 0, z: 0 }, thickness: 0.05 });

    // Projectile moving at 18 m/s towards wall (displacement in 1 tick = 0.3m)
    const nade: ActiveGrenade = {
      id: 99,
      type: 'frag',
      throwerId: 'p1',
      pos: { x: 0.35, y: 1.0, z: 0 },
      vel: { x: 18.0, y: 0, z: 0 },
      fuseRemaining: 150,
      isAtRest: false,
      bounces: 0,
    };

    const res = stepGrenadePhysics(nade, world, 1 / 60);
    expect(res.bounced).toBe(true);
    expect(nade.bounces).toBe(1);
    // Must remain on the correct side of the wall (< 0.5m)
    expect(nade.pos.x).toBeLessThan(0.5);
    // Velocity reflected
    expect(nade.vel.x).toBeLessThan(0);
  });

  it('calculates frag blast falloff table and handles self-damage', () => {
    const world = new MockWorld();
    const blastPos: Vec3 = { x: 0, y: 0, z: 0 };
    const targets: HitTarget[] = [
      { id: 't0', pos: { x: 0, y: -0.9, z: 0 } }, // torso at y=0 -> 0m point blank
      { id: 't1', pos: { x: 3.5, y: -0.9, z: 0 } }, // 3.5m distance to torso
      { id: 't2', pos: { x: 7.0, y: -0.9, z: 0 } }, // 7.0m blast radius edge
      { id: 't3', pos: { x: 8.0, y: -0.9, z: 0 } }, // 8.0m out of range
      { id: 'thrower', pos: { x: 0, y: -0.9, z: 0 } }, // thrower point blank
    ];

    const results = calculateFragBlast(blastPos, 'thrower', targets, world);

    const r0 = results.find((r) => r.targetId === 't0')!;
    expect(r0.damage).toBe(120); // max damage

    const r1 = results.find((r) => r.targetId === 't1')!;
    expect(r1.damage).toBe(68); // ~68 mid-range falloff

    const r2 = results.find((r) => r.targetId === 't2')!;
    expect(r2.damage).toBe(15); // min damage at perimeter

    const r3 = results.find((r) => r.targetId === 't3');
    expect(r3).toBeUndefined(); // Out of range

    const rThrower = results.find((r) => r.targetId === 'thrower')!;
    expect(rThrower.damage).toBe(90); // 120 * 0.75 self damage factor
  });

  it('blocks frag blast damage when target is occluded by solid cover', () => {
    const world = new MockWorld();
    world.losBlocked = true; // Wall occludes line of sight

    const targets: HitTarget[] = [{ id: 'hidden_dummy', pos: { x: 2, y: 0, z: 0 } }];
    const results = calculateFragBlast({ x: 0, y: 0, z: 0 }, 'p1', targets, world);

    expect(results).toHaveLength(1);
    expect(results[0]?.damage).toBe(0);
    expect(results[0]?.hasLineOfSight).toBe(false);
  });

  it('calculates flashbang blindness based on distance, view angle and cover', () => {
    const world = new MockWorld();
    const blastPos: Vec3 = { x: 0, y: 1.5, z: 5 };

    // 1. Directly facing (< 45 deg)
    const facingPlayer = {
      id: 'p_facing',
      eyePos: { x: 0, y: 1.5, z: 0 },
      lookDir: { x: 0, y: 0, z: 1 }, // looking directly at blast (+Z)
    };
    const facingRes = calculateFlashBlindness(blastPos, facingPlayer, world);
    expect(facingRes.hasLineOfSight).toBe(true);
    expect(facingRes.blindFraction).toBeGreaterThan(0.65);
    expect(facingRes.durationTicks).toBeGreaterThan(160);

    // 2. Looking away (> 90 deg)
    const turnedPlayer = {
      id: 'p_turned',
      eyePos: { x: 0, y: 1.5, z: 0 },
      lookDir: { x: 0, y: 0, z: -1 }, // looking opposite direction (-Z)
    };
    const turnedRes = calculateFlashBlindness(blastPos, turnedPlayer, world);
    expect(turnedRes.angleDeg).toBeCloseTo(180, 1);
    // Concussive disorientation is capped at 25% max intensity
    expect(turnedRes.blindFraction).toBeLessThanOrEqual(0.25);
    expect(turnedRes.durationTicks).toBeLessThanOrEqual(60);

    // 3. Occluded behind wall
    world.losBlocked = true;
    const occludedRes = calculateFlashBlindness(blastPos, facingPlayer, world);
    expect(occludedRes.hasLineOfSight).toBe(false);
    expect(occludedRes.blindFraction).toBe(0);
    expect(occludedRes.durationTicks).toBe(0);
  });

  it('checks smoke volume line-of-sight occlusion', () => {
    const smokeVolumes: ActiveSmokeVolume[] = [
      {
        id: 1,
        center: { x: 0, y: 1, z: 5 },
        radius: 5.5,
        durationRemaining: 600,
      },
    ];

    // Ray passing directly through smoke center
    const blockedRay = isLineBlockedBySmoke({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 10 }, smokeVolumes);
    expect(blockedRay).toBe(true);

    // Ray passing far outside smoke radius (x = 10m)
    const clearRay = isLineBlockedBySmoke({ x: 10, y: 1, z: 0 }, { x: 10, y: 1, z: 10 }, smokeVolumes);
    expect(clearRay).toBe(false);

    // Expired smoke cloud does not block
    smokeVolumes[0]!.durationRemaining = 0;
    const expiredRay = isLineBlockedBySmoke({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 10 }, smokeVolumes);
    expect(expiredRay).toBe(false);
  });

  it('manages grenade inventory cycling, cooldown, and throw cancelation', () => {
    const inventory = {
      counts: { frag: 2, flash: 1, smoke: 1 },
      selectedType: 'frag' as const,
      cooldownRemaining: 0,
    };

    // Cycle forward: frag -> flash -> smoke -> frag
    expect(cycleGrenadeType(inventory)).toBe('flash');
    expect(cycleGrenadeType(inventory)).toBe('smoke');
    expect(cycleGrenadeType(inventory)).toBe('frag');

    // Skip empty type
    inventory.counts.flash = 0;
    expect(cycleGrenadeType(inventory)).toBe('smoke');

    // Start windup (12 ticks)
    const windUp = startGrenadeWindUp(inventory);
    expect(windUp).not.toBeNull();
    expect(windUp!.isWindingUp).toBe(true);
    expect(windUp!.windUpTicksRemaining).toBe(12);

    // Cancel by sprinting
    const cancelRes = stepGrenadeWindUp(windUp!, true, false);
    expect(cancelRes.cancelled).toBe(true);
    expect(windUp!.isWindingUp).toBe(false);

    // Successful windup to release
    const windUp2 = startGrenadeWindUp(inventory)!;
    for (let i = 0; i < 11; i++) {
      const stepRes = stepGrenadeWindUp(windUp2, false, false);
      expect(stepRes.released).toBe(false);
      expect(stepRes.cancelled).toBe(false);
    }
    const releaseRes = stepGrenadeWindUp(windUp2, false, false);
    expect(releaseRes.released).toBe(true);
  });
});

describe('Player Vitals System', () => {
  it('protects player during initial spawn protection (1.5s = 90 ticks)', () => {
    const vitals = createInitialPlayerVitals('p1');
    expect(vitals.health).toBe(100);
    expect(vitals.spawnProtectionTicksRemaining).toBe(90);

    // Damage is absorbed
    const dmg = applyPlayerDamage(
      vitals,
      'enemy',
      50,
      'bullet',
      'body',
      { x: 0, y: 1, z: 5 },
      { x: 0, y: 1, z: 0 },
      1,
    );
    expect(dmg).toBeNull();
    expect(vitals.health).toBe(100);

    // Tick down 90 ticks
    for (let t = 0; t < 90; t++) {
      stepPlayerVitals(vitals);
    }
    expect(vitals.spawnProtectionTicksRemaining).toBe(0);

    // Now damage applies
    const realDmg = applyPlayerDamage(
      vitals,
      'enemy',
      40,
      'bullet',
      'body',
      { x: 0, y: 1, z: 5 },
      { x: 0, y: 1, z: 0 },
      91,
    );
    expect(realDmg).not.toBeNull();
    expect(realDmg!.damage).toBe(40);
    expect(vitals.health).toBe(60);
  });

  it('triggers death and handles 3.0s (180 ticks) respawn cycle', () => {
    const vitals = createInitialPlayerVitals('p1');
    vitals.spawnProtectionTicksRemaining = 0;

    // Fatal damage
    const fatal = applyPlayerDamage(
      vitals,
      'enemy',
      120,
      'blast',
      'blast',
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 0 },
      10,
    );
    expect(fatal!.isFatal).toBe(true);
    expect(vitals.isAlive).toBe(false);
    expect(vitals.health).toBe(0);
    expect(vitals.deaths).toBe(1);
    expect(vitals.respawnTicksRemaining).toBe(180);

    // Step 179 ticks -> still dead
    for (let t = 0; t < 179; t++) {
      const step = stepPlayerVitals(vitals);
      expect(step.respawned).toBe(false);
    }

    // Step 180th tick -> respawns
    const finalStep = stepPlayerVitals(vitals);
    expect(finalStep.respawned).toBe(true);
    expect(vitals.isAlive).toBe(true);
    expect(vitals.health).toBe(100);
    expect(vitals.spawnProtectionTicksRemaining).toBe(90);
  });

  it('damages dummy targets and manages dummy respawn', () => {
    const dummy = createDummyTarget('dummy_1', { x: 5, y: 0, z: 5 });
    expect(dummy.health).toBe(100);
    expect(dummy.isAlive).toBe(true);

    const hit = applyDummyDamage(dummy, 45);
    expect(hit.damageDealt).toBe(45);
    expect(hit.killed).toBe(false);
    expect(dummy.health).toBe(55);

    const fatalHit = applyDummyDamage(dummy, 60);
    expect(fatalHit.killed).toBe(true);
    expect(dummy.isAlive).toBe(false);
    expect(dummy.health).toBe(0);

    // Respawn after 120 ticks
    for (let t = 0; t < 119; t++) {
      expect(stepDummyVitals(dummy).respawned).toBe(false);
    }
    expect(stepDummyVitals(dummy).respawned).toBe(true);
    expect(dummy.isAlive).toBe(true);
    expect(dummy.health).toBe(100);
  });
});
