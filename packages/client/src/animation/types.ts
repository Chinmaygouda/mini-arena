import * as THREE from 'three';
import { WeaponId } from '@mini-arena/shared';

export type AnimationEventType =
  | 'mag_detach'
  | 'mag_drop'
  | 'mag_insert'
  | 'bolt_pull'
  | 'bolt_release'
  | 'shell_insert'
  | 'fire_recoil'
  | 'draw_equip'
  | 'inspect_tilt';

export interface TimedAnimationEvent {
  timeFraction: number; // 0.0 to 1.0 of clip duration
  type: AnimationEventType;
  payload?: string;
}

export interface HandTarget {
  pos: THREE.Vector3;
  rot: THREE.Euler;
}

export interface WeaponKeyframe {
  time: number; // Normalized 0.0 to 1.0 within clip
  leftHand: HandTarget;
  rightHand: HandTarget;
  magOffset: THREE.Vector3;
  magRot?: THREE.Euler;
  magAttached: boolean;
  boltOffset: THREE.Vector3;
  weaponPosOffset: THREE.Vector3;
  weaponRotOffset: THREE.Euler;
}

export interface KeyframeClip {
  name: string;
  duration: number; // Duration in seconds (scaled to match shared gameplay rules)
  keyframes: WeaponKeyframe[];
  events: TimedAnimationEvent[];
}

export interface WeaponVisualDef {
  weaponId: WeaponId;
  name: string;
  bodyMesh: THREE.Group;
  magMesh: THREE.Mesh;
  boltMesh: THREE.Mesh;
  muzzleOffset: THREE.Vector3;
  ejectionPortOffset: THREE.Vector3;
  magRestPos: THREE.Vector3;
  magDropVelocity: THREE.Vector3;
  boltRestPos: THREE.Vector3;
  boltTravelVector: THREE.Vector3;
  sockets?: {
    gripR?: THREE.Vector3;
    gripRRot?: THREE.Euler;
    gripL?: THREE.Vector3;
    gripLRot?: THREE.Euler;
    muzzle?: THREE.Vector3;
    ejectPort?: THREE.Vector3;
    magWell?: THREE.Vector3;
    loadingPort?: THREE.Vector3;
  };
  fingerGrips?: {
    left?: Record<string, [number, number, number, number]>;
    right?: Record<string, [number, number, number, number]>;
  };
  clips: {
    idle: KeyframeClip;
    draw: KeyframeClip;
    inspect: KeyframeClip;
    reloadTactical: KeyframeClip;
    reloadEmpty: KeyframeClip;
    fire: KeyframeClip;
    walk?: KeyframeClip;
    sprint?: KeyframeClip;
    holster?: KeyframeClip;
    ads?: KeyframeClip;
    reloadShellStart?: KeyframeClip;
    reloadShellInsert?: KeyframeClip;
    reloadShellEnd?: KeyframeClip;
    boltCycle?: KeyframeClip;
  };
}

export type WeaponClipName = keyof WeaponVisualDef['clips'];
