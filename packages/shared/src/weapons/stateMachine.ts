import { WeaponDef, WeaponId } from './types';
import { getWeaponDef } from './definitions';

export type WeaponActionState =
  | 'idle'
  | 'firing'
  | 'reloading_tactical'
  | 'reloading_empty'
  | 'reloading_shell'
  | 'swapping_out'
  | 'swapping_in';

export interface WeaponInventorySlot {
  weaponId: WeaponId;
  ammoInMag: number;
  ammoReserve: number;
}

export const AUTO_SWITCH_DELAY = 0.35; // Delay in seconds before auto-switching empty weapon

export interface WeaponState {
  currentSlot: number;
  slots: WeaponInventorySlot[];
  actionState: WeaponActionState;
  stateTimer: number; // Remaining time in current state (reload / swap)
  pendingWeaponId: WeaponId | null;
  isAds: boolean;
  isSprinting: boolean;
  autoReload: boolean; // Setting to enable/disable auto-reload
  autoSwitch: boolean; // Setting to enable/disable auto-switch
  lastUsedSlot: number; // Slot previously equipped with ammo
  shotCooldownTimer: number; // Shot interval cooldown remaining before auto-reload can trigger
  autoSwitchTimer: number; // Countdown before auto-switch occurs
  isOutOfAmmo: boolean; // Flagged true when all weapons in inventory are empty
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
    isSprinting: false,
    autoReload: true,
    autoSwitch: true,
    lastUsedSlot: 0,
    shotCooldownTimer: 0,
    autoSwitchTimer: 0,
    isOutOfAmmo: false,
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

  if (def.reloadType === 'shell_by_shell') {
    state.actionState = 'reloading_shell';
    state.stateTimer = slot.ammoInMag === 0
      ? def.reloadTimeEmpty
      : (def.shellReloadTime ?? def.reloadTimeTactical);
  } else if (slot.ammoInMag > 0) {
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
 * Notifies the state machine that a shot was fired, starting the shot cooldown before auto-reload.
 */
export function recordShotFired(state: WeaponState, cooldownSeconds?: number): void {
  const def = getCurrentWeaponDef(state);
  state.shotCooldownTimer = cooldownSeconds ?? (60 / def.rpm);
}

/**
 * Updates sprinting state and cancels active reload if sprinting.
 */
export function setSprinting(state: WeaponState, isSprinting: boolean): void {
  state.isSprinting = isSprinting;
  if (isSprinting) {
    cancelReloadOnSprint(state);
  }
}

/**
 * Finds the next weapon in inventory with available ammo.
 * Prioritizes last-used slot first, then checks in slot order (0..4).
 * Returns -1 if all weapons are completely empty.
 */
export function findNextWeaponWithAmmo(state: WeaponState): number {
  // 1. Prioritize last-used slot if different from current and has ammo
  if (
    state.lastUsedSlot >= 0 &&
    state.lastUsedSlot < state.slots.length &&
    state.lastUsedSlot !== state.currentSlot
  ) {
    const lastSlot = state.slots[state.lastUsedSlot];
    if (lastSlot && (lastSlot.ammoInMag > 0 || lastSlot.ammoReserve > 0)) {
      return state.lastUsedSlot;
    }
  }

  // 2. Check next slots in cyclical slot order (0..4)
  for (let i = 1; i < state.slots.length; i++) {
    const nextIndex = (state.currentSlot + i) % state.slots.length;
    const slot = state.slots[nextIndex];
    if (slot && (slot.ammoInMag > 0 || slot.ammoReserve > 0)) {
      return nextIndex;
    }
  }

  return -1;
}

/**
 * For shell-by-shell weapons (shotgun), pressing fire interrupts reload if ammo > 0.
 */
export function cancelReloadOnFire(state: WeaponState): boolean {
  if (state.actionState === 'reloading_shell') {
    const slot = getCurrentSlot(state);
    if (slot.ammoInMag > 0) {
      state.actionState = 'idle';
      state.stateTimer = 0;
      return true;
    }
  }
  return false;
}

/**
 * Triggers weapon swap to a new weapon id.
 * Cancels active reload and pending auto-switch countdown immediately.
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

  // Manual or automatic swap cancels pending auto-switch countdown
  state.autoSwitchTimer = 0;

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
  state.isSprinting = true;
  if (
    state.actionState === 'reloading_tactical' ||
    state.actionState === 'reloading_empty' ||
    state.actionState === 'reloading_shell'
  ) {
    state.actionState = 'idle';
    state.stateTimer = 0;
    return true;
  }
  return false;
}

/**
 * Steps the reload / swap state machine by dt.
 * Guarantees NO stuck states: stateTimer always decrements and transitions to idle on completion.
 * Handles auto-reload and auto-switch transitions deterministically.
 */
export function stepWeaponStateMachine(state: WeaponState, dt: number): void {
  if (state.stateTimer > 0) {
    state.stateTimer = Math.max(0, state.stateTimer - dt);
  }
  if (state.shotCooldownTimer > 0) {
    state.shotCooldownTimer = Math.max(0, state.shotCooldownTimer - dt);
  }

  if (state.stateTimer <= 0) {
    switch (state.actionState) {
      case 'reloading_tactical':
      case 'reloading_empty': {
        // Complete magazine reload
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

      case 'reloading_shell': {
        // Add 1 shell to magazine
        const slot = getCurrentSlot(state);
        const def = getWeaponDef(slot.weaponId);

        if (slot.ammoInMag < def.magSize && slot.ammoReserve > 0) {
          slot.ammoInMag += 1;
          slot.ammoReserve -= 1;
        }

        // Continue next shell or finish
        if (slot.ammoInMag < def.magSize && slot.ammoReserve > 0) {
          state.actionState = 'reloading_shell';
          state.stateTimer = def.shellReloadTime ?? def.reloadTimeTactical;
        } else {
          state.actionState = 'idle';
          state.stateTimer = 0;
        }
        break;
      }

      case 'swapping_out': {
        if (state.pendingWeaponId) {
          const targetIndex = state.slots.findIndex((s) => s.weaponId === state.pendingWeaponId);
          if (targetIndex !== -1) {
            state.lastUsedSlot = state.currentSlot;
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

  // --- Auto-Reload and Auto-Switch logic when idle ---
  if (state.actionState === 'idle') {
    const currentSlot = getCurrentSlot(state);
    const anyWeaponHasAmmo = state.slots.some((s) => s.ammoInMag > 0 || s.ammoReserve > 0);

    if (!anyWeaponHasAmmo) {
      state.isOutOfAmmo = true;
      state.autoSwitchTimer = 0;
      return;
    }

    state.isOutOfAmmo = false;

    // (1) AUTO-RELOAD: mag == 0 and reserve > 0, after shot cooldown, not sprinting
    if (
      state.autoReload &&
      !state.isSprinting &&
      currentSlot.ammoInMag === 0 &&
      currentSlot.ammoReserve > 0 &&
      state.shotCooldownTimer <= 0
    ) {
      triggerReload(state);
      return;
    }

    // (2) AUTO-SWITCH: mag == 0 and reserve == 0, switch to next weapon with ammo after delay
    if (
      state.autoSwitch &&
      currentSlot.ammoInMag === 0 &&
      currentSlot.ammoReserve === 0
    ) {
      if (state.autoSwitchTimer <= 0) {
        state.autoSwitchTimer = AUTO_SWITCH_DELAY;
      }
      state.autoSwitchTimer = Math.max(0, state.autoSwitchTimer - dt);
      if (state.autoSwitchTimer <= 0) {
        state.autoSwitchTimer = 0;
        const targetSlot = findNextWeaponWithAmmo(state);
        if (targetSlot !== -1 && targetSlot !== state.currentSlot) {
          triggerSwapBySlot(state, targetSlot);
        }
      }
    } else {
      state.autoSwitchTimer = 0;
    }
  }
}
