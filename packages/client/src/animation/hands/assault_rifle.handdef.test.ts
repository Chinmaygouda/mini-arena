import { describe, expect, it } from 'vitest';
import { createAssaultRifleVisualDef } from '../assaultRifleDef';
import { ASSAULT_RIFLE_HANDDEF, createAssaultRifleRestTargets } from './assault_rifle.handdef';

describe('Assault Rifle hand definition', () => {
 it('keeps real-model and procedural fallback targets separate', () => {
  expect(ASSAULT_RIFLE_HANDDEF.coordinateSpace).toBe('weapon-local');
  expect(ASSAULT_RIFLE_HANDDEF.units).toBe('m');
  expect(ASSAULT_RIFLE_HANDDEF.realModel.asset).toBe('/models/ak47.glb');
  const real=createAssaultRifleRestTargets('realModel'),fallback=createAssaultRifleRestTargets('proceduralFallback');
  expect(real.rightGripRest.pos.toArray()).toEqual([0,-0.065,0.045]);
  expect(fallback.rightGripRest.pos.toArray()).toEqual([0.012,-0.065,0.04]);
  expect(real.rightGripRest.rot.x).not.toBe(fallback.rightGripRest.rot.x);
  expect(real.leftHandguardRest.pos.toArray()).toEqual([-0.042,-0.045,-0.14]);
 });
 it('records the measured arm lengths and residual budget', () => {
  expect(ASSAULT_RIFLE_HANDDEF.measuredRig.upperArmLengthM).toBeCloseTo(0.322236,6);
  expect(ASSAULT_RIFLE_HANDDEF.measuredRig.forearmLengthM).toBeCloseTo(0.237276,6);
  expect(ASSAULT_RIFLE_HANDDEF.measuredRig.maxReachM).toBeCloseTo(0.559512,6);
  expect(ASSAULT_RIFLE_HANDDEF.measuredRig.residualIkBudgetM).toBe(0.02);
 });
 it('uses the centralized data in the procedural fallback clip', () => {
  const def=createAssaultRifleVisualDef(),idle=def.clips.idle.keyframes[0]!,targets=createAssaultRifleRestTargets('proceduralFallback');
  expect(idle.rightHand.pos.distanceTo(targets.rightGripRest.pos)).toBeLessThan(1e-9);
  expect(idle.leftHand.pos.distanceTo(targets.leftHandguardRest.pos)).toBeLessThan(1e-9);
  expect(def.fingerGrips?.right).toBe(ASSAULT_RIFLE_HANDDEF.fingerGrips.right);
  expect(def.fingerGrips?.left).toBe(ASSAULT_RIFLE_HANDDEF.fingerGrips.left);
 });
});
