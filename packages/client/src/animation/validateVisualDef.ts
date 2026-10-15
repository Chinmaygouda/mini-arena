import { WeaponVisualDef } from './types';

export interface VisualDefValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a WeaponVisualDef contract before mounting into WeaponAnimator.
 * Asserts required meshes, sockets, clip completeness, duration alignment, and event boundaries.
 */
export function validateWeaponVisualDef(def: WeaponVisualDef): VisualDefValidationResult {
  const errors: string[] = [];

  if (!def.weaponId) {
    errors.push('Missing weaponId');
  }
  if (!def.name) {
    errors.push('Missing name');
  }
  if (!def.bodyMesh) {
    errors.push('Missing bodyMesh');
  }
  if (!def.magMesh) {
    errors.push('Missing magMesh');
  }
  if (!def.boltMesh) {
    errors.push('Missing boltMesh');
  }
  if (!def.muzzleOffset) {
    errors.push('Missing muzzleOffset');
  }
  if (!def.ejectionPortOffset) {
    errors.push('Missing ejectionPortOffset');
  }

  // Validate sockets if provided
  if (def.sockets) {
    if (!def.sockets.muzzle) errors.push('Missing socket: muzzle');
    if (!def.sockets.ejectPort) errors.push('Missing socket: ejectPort');
  }

  // Validate clips
  if (!def.clips) {
    errors.push('Missing clips dictionary');
  } else {
    const requiredBaseClips = ['idle', 'draw', 'inspect', 'fire'] as const;
    for (const clipName of requiredBaseClips) {
      if (!def.clips[clipName]) {
        errors.push(`Missing required clip: ${clipName}`);
      }
    }

    // Magazine weapons require reloadTactical & reloadEmpty; Shotgun requires reloadShellStart/Insert/End
    if (def.weaponId === 'shotgun') {
      if (!def.clips.reloadShellStart) errors.push('Shotgun missing reloadShellStart clip');
      if (!def.clips.reloadShellInsert) errors.push('Shotgun missing reloadShellInsert clip');
      if (!def.clips.reloadShellEnd) errors.push('Shotgun missing reloadShellEnd clip');
    } else {
      if (!def.clips.reloadTactical) errors.push('Missing reloadTactical clip');
      if (!def.clips.reloadEmpty) errors.push('Missing reloadEmpty clip');
    }

    if (def.weaponId === 'sniper' && !def.clips.boltCycle) {
      errors.push('Sniper missing boltCycle clip');
    }

    // Inspect individual clips
    for (const [key, clip] of Object.entries(def.clips)) {
      if (!clip) continue;
      if (clip.duration <= 0) {
        errors.push(`Clip ${key} has non-positive duration: ${clip.duration}`);
      } else {
        const ticks = clip.duration * 60;
        const isStrictInteger = Math.abs(ticks - Math.round(ticks)) < 1e-3;
        const isAllowedHalfTick = key === 'fire' && Math.abs(ticks * 2 - Math.round(ticks * 2)) < 1e-3;
        if (!isStrictInteger && !isAllowedHalfTick) {
          errors.push(`Clip ${key} duration ${clip.duration}s is not integer-tick clean at 60 Hz (${ticks} ticks)`);
        }
      }
      if (!clip.keyframes || clip.keyframes.length === 0) {
        errors.push(`Clip ${key} has no keyframes`);
      } else {
        // Assert first keyframe is at t=0
        if (Math.abs(clip.keyframes[0]!.time) > 1e-4) {
          errors.push(`Clip ${key} first keyframe time is not 0.0 (got ${clip.keyframes[0]!.time})`);
        }
        // Assert monotonic ordering
        for (let i = 1; i < clip.keyframes.length; i++) {
          if (clip.keyframes[i]!.time < clip.keyframes[i - 1]!.time) {
            errors.push(`Clip ${key} keyframes are not in ascending order at index ${i}`);
          }
        }
      }

      // Assert event bounds
      if (clip.events) {
        for (const ev of clip.events) {
          if (ev.timeFraction < 0 || ev.timeFraction > 1.0) {
            errors.push(`Clip ${key} event ${ev.type} has timeFraction out of [0, 1]: ${ev.timeFraction}`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
