// tests/damageFalloff.test.mjs
// Unit tests for weapon range limits and damage falloff curves.
// Executed via `node --experimental-strip-types --test tests/damageFalloff.test.mjs`

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamageFalloff, WEAPON_REGISTRY } from '../src/weapons/weaponTypes.ts';

test('Shotgun: range limits and pellet damage falloff curve', () => {
  const def = WEAPON_REGISTRY.shotgun;
  assert.equal(def.fullDamageRange, 6);
  assert.equal(def.falloffEndRange, 22);
  assert.equal(def.minDamageMultiplier, 0.15);
  assert.equal(def.maxRange, 25);
  assert.equal(def.damage, 14);
  assert.equal(def.critMultiplier, 1.75);

  // 1. Distance 0m (Point blank)
  const d0 = calculateDamageFalloff(0, def.damage, def, false, def.critMultiplier);
  assert.equal(d0.inRange, true);
  assert.equal(d0.multiplier, 1.0);
  assert.equal(d0.damage, 14);

  // 2. Full damage range (6m)
  const dFull = calculateDamageFalloff(6, def.damage, def, false, def.critMultiplier);
  assert.equal(dFull.inRange, true);
  assert.equal(dFull.multiplier, 1.0);
  assert.equal(dFull.damage, 14);

  // 3. Mid falloff (14m = midpoint between 6m and 22m)
  // t = (14 - 6) / (22 - 6) = 8 / 16 = 0.5
  // multiplier = 1.0 - 0.5 * (1.0 - 0.15) = 0.575
  // damage = Math.round(14 * 0.575) = Math.round(8.05) = 8
  const dMid = calculateDamageFalloff(14, def.damage, def, false, def.critMultiplier);
  assert.equal(dMid.inRange, true);
  assert.equal(Math.abs(dMid.multiplier - 0.575) < 1e-6, true);
  assert.equal(dMid.damage, 8);

  // 4. Falloff end range (22m)
  // multiplier = 0.15
  // damage = Math.round(14 * 0.15) = Math.round(2.1) = 2
  const dEnd = calculateDamageFalloff(22, def.damage, def, false, def.critMultiplier);
  assert.equal(dEnd.inRange, true);
  assert.equal(Math.abs(dEnd.multiplier - 0.15) < 1e-6, true);
  assert.equal(dEnd.damage, 2);

  // 5. Max range (25m)
  // multiplier = 0.15
  // damage = 2
  const dMax = calculateDamageFalloff(25, def.damage, def, false, def.critMultiplier);
  assert.equal(dMax.inRange, true);
  assert.equal(Math.abs(dMax.multiplier - 0.15) < 1e-6, true);
  assert.equal(dMax.damage, 2);

  // 6. Beyond max range (26m = 25m + 1m)
  const dOut = calculateDamageFalloff(26, def.damage, def, false, def.critMultiplier);
  assert.equal(dOut.inRange, false);
  assert.equal(dOut.multiplier, 0);
  assert.equal(dOut.damage, 0);

  // Headshots at 5m and falloff end (22m)
  // 5m: full damage * crit = Math.round(14 * 1.75 * 1.0) = Math.round(24.5) = 25
  const head5 = calculateDamageFalloff(5, def.damage, def, true, def.critMultiplier);
  assert.equal(head5.damage, 25);
  // 22m: Math.round(14 * 1.75 * 0.15) = Math.round(3.675) = 4
  const head22 = calculateDamageFalloff(22, def.damage, def, true, def.critMultiplier);
  assert.equal(head22.damage, 4);
});

test('SMG: range limits and damage falloff curve', () => {
  const def = WEAPON_REGISTRY.smg;
  assert.equal(def.fullDamageRange, 12);
  assert.equal(def.falloffEndRange, 35);
  assert.equal(def.minDamageMultiplier, 0.4);
  assert.equal(def.maxRange, 40);
  assert.equal(def.damage, 19);
  assert.equal(def.critMultiplier, 1.7);

  // 0m
  const d0 = calculateDamageFalloff(0, def.damage, def, false, def.critMultiplier);
  assert.equal(d0.inRange, true);
  assert.equal(d0.multiplier, 1.0);
  assert.equal(d0.damage, 19);

  // 12m (full)
  const dFull = calculateDamageFalloff(12, def.damage, def, false, def.critMultiplier);
  assert.equal(dFull.damage, 19);

  // Mid falloff (23.5m)
  // t = (23.5 - 12) / (35 - 12) = 11.5 / 23 = 0.5
  // multiplier = 1.0 - 0.5 * (1.0 - 0.4) = 0.7
  // damage = Math.round(19 * 0.7) = Math.round(13.3) = 13
  const dMid = calculateDamageFalloff(23.5, def.damage, def, false, def.critMultiplier);
  assert.equal(Math.abs(dMid.multiplier - 0.7) < 1e-6, true);
  assert.equal(dMid.damage, 13);

  // 35m (falloff end)
  // multiplier = 0.4, damage = Math.round(19 * 0.4) = Math.round(7.6) = 8
  const dEnd = calculateDamageFalloff(35, def.damage, def, false, def.critMultiplier);
  assert.equal(Math.abs(dEnd.multiplier - 0.4) < 1e-6, true);
  assert.equal(dEnd.damage, 8);

  // 40m (max range)
  const dMax = calculateDamageFalloff(40, def.damage, def, false, def.critMultiplier);
  assert.equal(dMax.inRange, true);
  assert.equal(dMax.damage, 8);

  // 41m (max range + 1m)
  const dOut = calculateDamageFalloff(41, def.damage, def, false, def.critMultiplier);
  assert.equal(dOut.inRange, false);
  assert.equal(dOut.damage, 0);

  // Headshots at 5m and 35m
  // 5m: Math.round(19 * 1.7 * 1.0) = Math.round(32.3) = 32
  const head5 = calculateDamageFalloff(5, def.damage, def, true, def.critMultiplier);
  assert.equal(head5.damage, 32);
  // 35m: Math.round(19 * 1.7 * 0.4) = Math.round(12.92) = 13
  const head35 = calculateDamageFalloff(35, def.damage, def, true, def.critMultiplier);
  assert.equal(head35.damage, 13);
});

test('Pistol: range limits and damage falloff curve', () => {
  const def = WEAPON_REGISTRY.pistol;
  assert.equal(def.fullDamageRange, 15);
  assert.equal(def.falloffEndRange, 40);
  assert.equal(def.minDamageMultiplier, 0.5);
  assert.equal(def.maxRange, 50);
  assert.equal(def.damage, 26);
  assert.equal(def.critMultiplier, 2.0);

  // 0m
  const d0 = calculateDamageFalloff(0, def.damage, def, false, def.critMultiplier);
  assert.equal(d0.damage, 26);

  // 15m (full)
  const dFull = calculateDamageFalloff(15, def.damage, def, false, def.critMultiplier);
  assert.equal(dFull.damage, 26);

  // Mid falloff (27.5m)
  // t = (27.5 - 15) / (40 - 15) = 12.5 / 25 = 0.5
  // multiplier = 1.0 - 0.5 * 0.5 = 0.75
  // damage = Math.round(26 * 0.75) = Math.round(19.5) = 20
  const dMid = calculateDamageFalloff(27.5, def.damage, def, false, def.critMultiplier);
  assert.equal(Math.abs(dMid.multiplier - 0.75) < 1e-6, true);
  assert.equal(dMid.damage, 20);

  // 40m (falloff end)
  // multiplier = 0.5, damage = Math.round(26 * 0.5) = 13
  const dEnd = calculateDamageFalloff(40, def.damage, def, false, def.critMultiplier);
  assert.equal(Math.abs(dEnd.multiplier - 0.5) < 1e-6, true);
  assert.equal(dEnd.damage, 13);

  // 50m (max range)
  const dMax = calculateDamageFalloff(50, def.damage, def, false, def.critMultiplier);
  assert.equal(dMax.inRange, true);
  assert.equal(dMax.damage, 13);

  // 51m (max range + 1m)
  const dOut = calculateDamageFalloff(51, def.damage, def, false, def.critMultiplier);
  assert.equal(dOut.inRange, false);
  assert.equal(dOut.damage, 0);

  // Headshots at 5m and 40m
  // 5m: Math.round(26 * 2.0 * 1.0) = 52
  const head5 = calculateDamageFalloff(5, def.damage, def, true, def.critMultiplier);
  assert.equal(head5.damage, 52);
  // 40m: Math.round(26 * 2.0 * 0.5) = 26
  const head40 = calculateDamageFalloff(40, def.damage, def, true, def.critMultiplier);
  assert.equal(head40.damage, 26);
});

test('AK-47: range limits and damage falloff curve', () => {
  const def = WEAPON_REGISTRY.ak47;
  assert.equal(def.fullDamageRange, 30);
  assert.equal(def.falloffEndRange, 70);
  assert.equal(def.minDamageMultiplier, 0.6);
  assert.equal(def.maxRange, 100);
  assert.equal(def.damage, 38);
  assert.equal(def.critMultiplier, 2.4);

  // 0m
  const d0 = calculateDamageFalloff(0, def.damage, def, false, def.critMultiplier);
  assert.equal(d0.damage, 38);

  // 30m (full)
  const dFull = calculateDamageFalloff(30, def.damage, def, false, def.critMultiplier);
  assert.equal(dFull.damage, 38);

  // Mid falloff (50m)
  // t = (50 - 30) / (70 - 30) = 20 / 40 = 0.5
  // multiplier = 1.0 - 0.5 * (1.0 - 0.6) = 0.8
  // damage = Math.round(38 * 0.8) = Math.round(30.4) = 30
  const dMid = calculateDamageFalloff(50, def.damage, def, false, def.critMultiplier);
  assert.equal(Math.abs(dMid.multiplier - 0.8) < 1e-6, true);
  assert.equal(dMid.damage, 30);

  // 70m (falloff end)
  // multiplier = 0.6, damage = Math.round(38 * 0.6) = Math.round(22.8) = 23
  const dEnd = calculateDamageFalloff(70, def.damage, def, false, def.critMultiplier);
  assert.equal(Math.abs(dEnd.multiplier - 0.6) < 1e-6, true);
  assert.equal(dEnd.damage, 23);

  // 100m (max range)
  const dMax = calculateDamageFalloff(100, def.damage, def, false, def.critMultiplier);
  assert.equal(dMax.inRange, true);
  assert.equal(dMax.damage, 23);

  // 101m (max range + 1m)
  const dOut = calculateDamageFalloff(101, def.damage, def, false, def.critMultiplier);
  assert.equal(dOut.inRange, false);
  assert.equal(dOut.damage, 0);

  // Headshots at 5m and 70m
  // 5m: Math.round(38 * 2.4 * 1.0) = Math.round(91.2) = 91
  const head5 = calculateDamageFalloff(5, def.damage, def, true, def.critMultiplier);
  assert.equal(head5.damage, 91);
  // 70m: Math.round(38 * 2.4 * 0.6) = Math.round(54.72) = 55
  const head70 = calculateDamageFalloff(70, def.damage, def, true, def.critMultiplier);
  assert.equal(head70.damage, 55);
});

test('Sniper: high range pinpoint ballistics with zero falloff', () => {
  const def = WEAPON_REGISTRY.sniper;
  assert.equal(def.fullDamageRange, 300);
  assert.equal(def.falloffEndRange, 300);
  assert.equal(def.minDamageMultiplier, 1.0);
  assert.equal(def.maxRange, 300);
  assert.equal(def.damage, 135);
  assert.equal(def.critMultiplier, 2.5);

  // 0m
  const d0 = calculateDamageFalloff(0, def.damage, def, false, def.critMultiplier);
  assert.equal(d0.damage, 135);
  assert.equal(d0.multiplier, 1.0);

  // 150m
  const d150 = calculateDamageFalloff(150, def.damage, def, false, def.critMultiplier);
  assert.equal(d150.damage, 135);
  assert.equal(d150.multiplier, 1.0);

  // 300m (max range)
  const dMax = calculateDamageFalloff(300, def.damage, def, false, def.critMultiplier);
  assert.equal(dMax.inRange, true);
  assert.equal(dMax.damage, 135);
  assert.equal(dMax.multiplier, 1.0);

  // 301m (beyond max range)
  const dOut = calculateDamageFalloff(301, def.damage, def, false, def.critMultiplier);
  assert.equal(dOut.inRange, false);
  assert.equal(dOut.damage, 0);

  // Headshot at 5m and 300m
  // 5m: Math.round(135 * 2.5) = Math.round(337.5) = 338
  const head5 = calculateDamageFalloff(5, def.damage, def, true, def.critMultiplier);
  assert.equal(head5.damage, 338);
  const head300 = calculateDamageFalloff(300, def.damage, def, true, def.critMultiplier);
  assert.equal(head300.damage, 338);
});
