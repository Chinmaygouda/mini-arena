import { WeaponDef, WeaponId } from './types';
import { getWeaponDef } from './definitions';

export type WeaponActionState =
  | 'idle'
  | 'firing'
  | 'reloading_tactical'
  | 'reloading_empty'
  | 'swapping_out'
  | 'swapping_in';

export interface WeaponInventorySlot {
  weaponId: WeaponId;
  ammoInMag: number;
  ammoReserve: number;
}

export interface WeaponState {
  currentSlot: number;
  slots: WeaponInventorySlot[];
  actionState: WeaponActionState;
  stateTimer: number; // Remaining time in current state (reload / swap)
  pendingWeaponId: WeaponId | null;
  isAds: boolean;
}

export function createDefaultWeaponState(): WeaponState {
  return {
    currentSlot: 0,
    slots: [
      { weaponId: 'assault_rifle', ammoInMag: 30, ammoReserve: 90 },
      { weaponId: 'pistol', ammoInMag: 12, ammoReserve: 36 },
      { weaponId: 'smg', ammoInMag: 30, ammoReserve: 120 },
      { weaponId: 'shotgun', ammoInMag: 6, ammoReserve: 24 },
      { weaponId: 'sniper', ammoInMag: 5, ammoReserve: 15 },
    ],
    actionState: 'idle',
    stateTimer: 0,
    pendingWeaponId: null,
    isAds: false,
  };
}

export function getCurrentSlot(state: WeaponState): WeaponInventorySlot {
  const slot = state.slots[state.currentSlot];
  if (!slot) {
    throw new Error(`Invalid weapon slot: ${state.currentSlot}`);
  }
  return slot;
}

export function getCurrentWeaponDef(state: WeaponState): WeaponDef {
  return getWeaponDef(getCurrentSlot(state).weaponId);
}

/**
 * Triggers a reload attempt on the current weapon.
 * Returns true if reload started, false if refused (full mag, no reserve, or busy).
 */
export function triggerReload(state: WeaponState): boolean {
  if (state.actionState !== 'idle' && state.actionState !== 'firing') {
    return false;
  }

  const slot = getCurrentSlot(state);
  const def = getWeaponDef(slot.weaponId);

  // Already full magazine or no reserve ammo left
  if (slot.ammoInMag >= def.magSize || slot.ammoReserve <= 0) {
    return false;
  }

  if (slot.ammoInMag > 0) {
    state.actionState = 'reloading_tactical';
    state.stateTimer = def.reloadTimeTactical;
  } else {
    state.actionState = 'reloading_empty';
    state.stateTimer = def.reloadTimeEmpty;
  }

  // Reload cancels ADS
  state.isAds = false;
  return true;
}

/**
 * Triggers weapon swap to a new weapon id.
 * Cancels active reload immediately.
 */
export function triggerSwap(state: WeaponState, targetWeaponId: WeaponId): boolean {
  const current = getCurrentSlot(state);
  if (current.weaponId === targetWeaponId) {
    return false;
  }

  const targetIndex = state.slots.findIndex((s) => s.weaponId === targetWeaponId);
  if (targetIndex === -1) {
    return false;
  }

  const currentDef = getWeaponDef(current.weaponId);

  state.actionState = 'swapping_out';
  state.stateTimer = currentDef.swapTime / 2;
  state.pendingWeaponId = targetWeaponId;
  state.isAds = false;
  return true;
}

/**
 * Triggers weapon swap using slot index (0..4).
 */
export function triggerSwapBySlot(state: WeaponState, slotIndex: number): boolean {
  const targetSlot = state.slots[slotIndex];
  if (!targetSlot) {
    return false;
  }
  return triggerSwap(state, targetSlot.weaponId);
}

/**
 * Cancels reload if player initiates a sprint.
 */
export function cancelReloadOnSprint(state: WeaponState): boolean {
  if (state.actionState === 'reloading_tactical' || state.actionState === 'reloading_empty') {
    state.actionState = 'idle';
    state.stateTimer = 0;
    return true;
  }
  return false;
}

/**
 * Steps the reload / swap state machine by dt.
 * Guarantees NO stuck states: stateTimer always decrements and transitions to idle on completion.
 */
export function stepWeaponStateMachine(state: WeaponState, dt: number): void {
  if (state.stateTimer > 0) {
    state.stateTimer -= dt;
  }

  if (state.stateTimer <= 0) {
    switch (state.actionState) {
      case 'reloading_tactical':
      case 'reloading_empty': {
        // Complete the reload
        const slot = getCurrentSlot(state);
        const def = getWeaponDef(slot.weaponId);
        const needed = def.magSize - slot.ammoInMag;
        const toAdd = Math.min(needed, slot.ammoReserve);

        slot.ammoInMag += toAdd;
        slot.ammoReserve -= toAdd;

        state.actionState = 'idle';
        state.stateTimer = 0;
        break;
      }

      case 'swapping_out': {
        if (state.pendingWeaponId) {
          const targetIndex = state.slots.findIndex((s) => s.weaponId === state.pendingWeaponId);
          if (targetIndex !== -1) {
            state.currentSlot = targetIndex;
          }
          const newDef = getWeaponDef(state.pendingWeaponId);
          state.actionState = 'swapping_in';
          state.stateTimer = newDef.swapTime / 2;
          state.pendingWeaponId = null;
        } else {
          state.actionState = 'idle';
          state.stateTimer = 0;
        }
        break;
      }

      case 'swapping_in': {
        state.actionState = 'idle';
        state.stateTimer = 0;
        break;
      }

      case 'firing': {
        state.actionState = 'idle';
        state.stateTimer = 0;
        break;
      }

      case 'idle':
      default:
        state.actionState = 'idle';
        state.stateTimer = 0;
        break;
    }
  }
}
