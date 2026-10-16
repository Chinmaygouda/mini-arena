import { Vec3, WeaponId } from '@mini-arena/shared';

export type SurfaceType = 'concrete' | 'metal' | 'wood' | 'flesh';

export interface CombatVfxEvent {
  type: 'muzzle_flash' | 'tracer' | 'shell_eject' | 'impact' | 'decal';
  weaponId?: WeaponId;
  origin?: Vec3;
  target?: Vec3;
  normal?: Vec3;
  surface?: SurfaceType;
}

export interface AudioHookEvent {
  name: string;
  pos?: Vec3;
  volume?: number;
}
