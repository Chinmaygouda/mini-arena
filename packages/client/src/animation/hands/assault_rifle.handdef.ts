import * as THREE from 'three';
import { AK_GRIP_LEFT, AK_GRIP_RIGHT } from '../fingerGripPoses';

export type HoldTuple = readonly [number, number, number];
interface HoldPose { position: HoldTuple; rotation: HoldTuple; }
interface HoldProfile { gripR: HoldPose; gripL: HoldPose; }

/** Existing production Assault Rifle hold targets, centralized in weapon-local metres. */
export const ASSAULT_RIFLE_HANDDEF = {
  schemaVersion: 1,
  weaponId: 'assault_rifle' as const,
  coordinateSpace: 'weapon-local' as const,
  units: 'm' as const,
  realModel: {
    asset: '/models/ak47.glb',
    gripR: { position: [0, -0.065, 0.045] as const, rotation: [1.2, 0.2, -0.4] as const },
    gripL: { position: [-0.042, -0.045, -0.14] as const, rotation: [0.2, 0.4, -0.3] as const },
  } satisfies HoldProfile & { asset: string },
  proceduralFallback: {
    asset: 'procedural fallback',
    gripR: { position: [0.012, -0.065, 0.04] as const, rotation: [-0.35, 0, 0] as const },
    gripL: { position: [-0.042, -0.045, -0.14] as const, rotation: [0.2, 0.4, -0.3] as const },
  } satisfies HoldProfile & { asset: string },
  measuredRig: { upperArmLengthM: 0.322236, forearmLengthM: 0.237276, maxReachM: 0.559512, residualIkBudgetM: 0.02 },
  fingerGrips: { right: AK_GRIP_RIGHT, left: AK_GRIP_LEFT },
} as const;

export type AssaultRifleHoldProfile = 'realModel' | 'proceduralFallback';
export function createAssaultRifleRestTargets(profile: AssaultRifleHoldProfile = 'realModel') {
  const data = ASSAULT_RIFLE_HANDDEF[profile];
  return {
    rightGripRest: {
      pos: new THREE.Vector3(...data.gripR.position),
      rot: new THREE.Euler(...data.gripR.rotation, 'XYZ'),
    },
    leftHandguardRest: {
      pos: new THREE.Vector3(...data.gripL.position),
      rot: new THREE.Euler(...data.gripL.rotation, 'XYZ'),
    },
  };
}
