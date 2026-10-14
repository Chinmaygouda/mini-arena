import { WeaponDef, WeaponId } from './types';
import { getWeaponDef } from './definitions';

export type WeaponActionState =
  | 'idle'
  | 'firing'
  | 'reloading_tactical'
  | 'reloading_empty'
  | 'reloading_shell'
  | 'reloading_shell_start'
  | 'reloading_shell_insert'
  | 'reloading_shell_end'
  | 'cycling_bolt'
  | 'swapping_out'
  | 'swapping_in';

export interface WeaponInventorySlot {
  weaponId: WeaponId;
  ammoInMag: number;
  ammoReserve: number;
  nextReadyTick?: number; // Absolute simulation tick when this slot is next allowed to fire (anti-quickswitch)
}

export const AUTO_SWITCH_DELAY = 0.35; // Delay in seconds before auto-switching empty weapon

export interface WeaponState {
  currentSlot: number;
  slots: WeaponInventorySlot[];
  actionState: WeaponActionState;
  stateTimer: number; // Remaining time in seconds (for continuous / render interpolation)
  stateTicksRemaining: number; // Remaining integer simulation ticks in current action
  ticksIntoState: number; // Integer simulation ticks elapsed since entering current action
  stateStartTick: number; // Simulation tick when current action began
  bufferedFireTicks: number; // Input buffer countdown (e.g. 6-8 ticks)
  pendingWeaponId: WeaponId | null;
  isAds: boolean;
  isSprinting: boolean;
  autoReload: boolean; // Setting to enable/disable auto-reload
  autoSwitch: boolean; // Setting to enable/disable auto-switch
  lastUsedSlot: number; // Slot previously equipped with ammo
  shotCooldownTimer: number; // Shot interval cooldown remaining before auto-reload can trigger
  autoSwitchTimer: number; // Countdown before auto-switch occurs
  isOutOfAmmo: boolean; // Flagged true when all weapons in inventory are empty
  shellCommitDone: boolean; // Tracks whether ammo commit has already been credited in current reload action
  currentSimTick: number; // Current simulation tick counter
}

export function createDefaultWeaponState(): WeaponState {
  return {
    currentSlot: 0,
    slots: [
      { weaponId: 'assault_rifle', ammoInMag: 30, ammoReserve: 90, nextReadyTick: 0 },
      { weaponId: 'pistol', ammoInMag: 12, ammoReserve: 36, nextReadyTick: 0 },
      { weaponId: 'smg', ammoInMag: 30, ammoReserve: 120, nextReadyTick: 0 },
      { weaponId: 'shotgun', ammoInMag: 6, ammoReserve: 24, nextReadyTick: 0 },
      { weaponId: 'sniper', ammoInMag: 5, ammoReserve: 15, nextReadyTick: 0 },
    ],
    actionState: 'idle',
    stateTimer: 0,
    stateTicksRemaining: 0,
    ticksIntoState: 0,
    stateStartTick: 0,
    bufferedFireTicks: 0,
    pendingWeaponId: null,
    isAds: false,
    isSprinting: false,
    autoReload: true,
    autoSwitch: true,
    lastUsedSlot: 0,
    shotCooldownTimer: 0,
    autoSwitchTimer: 0,
    isOutOfAmmo: false,
    shellCommitDone: false,
    currentSimTick: 0,
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
 * Checks whether the active weapon is completely ready to fire.
 * Enforces action state idle, ammo > 0, not sprinting, and anti-quickswitch nextReadyTick.
 */
export function isWeaponReadyToFire(state: WeaponState): boolean {
  if (state.actionState !== 'idle') return false;
  if (state.isSprinting) return false;
  const slot = getCurrentSlot(state);
  if (slot.ammoInMag <= 0) return false;
  if (slot.nextReadyTick !== undefined && state.currentSimTick < slot.nextReadyTick) {
    return false;
  }
  return true;
}

/**
 * Buffers a fire input for up to maxBufferTicks (default 6 ticks = 100ms at 60 Hz).
 */
export function bufferFireInput(state: WeaponState, maxBufferTicks = 6): void {
  state.bufferedFireTicks = Math.max(state.bufferedFireTicks, maxBufferTicks);
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
    state.actionState = 'reloading_shell_start';
    const startTicks = def.reloadSpec.shell?.startTicks ?? 24;
    state.stateTicksRemaining = startTicks;
    state.stateTimer = startTicks / 60;
    state.ticksIntoState = 0;
    state.stateStartTick = state.currentSimTick;
    state.shellCommitDone = false;
  } else if (slot.ammoInMag > 0) {
    state.actionState = 'reloading_tactical';
    const reloadTicks = def.reloadSpec.magazine?.tacticalReloadTicks ?? Math.round(def.reloadTimeTactical * 60);
    state.stateTicksRemaining = reloadTicks;
    state.stateTimer = reloadTicks / 60;
    state.ticksIntoState = 0;
    state.stateStartTick = state.currentSimTick;
    state.shellCommitDone = false;
  } else {
    state.actionState = 'reloading_empty';
    const reloadTicks = def.reloadSpec.magazine?.emptyReloadTicks ?? Math.round(def.reloadTimeEmpty * 60);
    state.stateTicksRemaining = reloadTicks;
    state.stateTimer = reloadTicks / 60;
    state.ticksIntoState = 0;
    state.stateStartTick = state.currentSimTick;
    state.shellCommitDone = false;
  }

  // Reload cancels ADS
  state.isAds = false;
  return true;
}

/**
 * Notifies the state machine that a shot was fired, updating slot nextReadyTick and bolt cycle.
 */
export function recordShotFired(state: WeaponState, cooldownSeconds?: number): void {
  const slot = getCurrentSlot(state);
  const def = getCurrentWeaponDef(state);
  const cooldown = cooldownSeconds ?? (60 / def.rpm);
  state.shotCooldownTimer = cooldown;
  const cooldownTicks = Math.round(cooldown * 60);

  slot.nextReadyTick = state.currentSimTick + cooldownTicks;

  // Bolt-action weapon cycle (e.g. Precision Sniper 80 ticks = 1.333s)
  if (def.boltCycleTicks && def.boltCycleTicks > 0) {
    slot.nextReadyTick = Math.max(slot.nextReadyTick, state.currentSimTick + def.boltCycleTicks);
    // Cycle bolt (both when ammo remains and on last-round before auto-reload)
    state.actionState = 'cycling_bolt';
    state.stateTicksRemaining = def.boltCycleTicks;
    state.stateTimer = def.boltCycleTicks / 60;
    state.ticksIntoState = 0;
    state.stateStartTick = state.currentSimTick;
    state.isAds = false;
  }
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
 * Skips the reload_shell_end phase to prevent double-pump action with firing clip.
 * If magazine has 0 shells, fire interrupt is rejected.
 */
export function cancelReloadOnFire(state: WeaponState): boolean {
  const isShellReload =
    state.actionState === 'reloading_shell' ||
    state.actionState === 'reloading_shell_start' ||
    state.actionState === 'reloading_shell_insert' ||
    state.actionState === 'reloading_shell_end';

  if (!isShellReload) {
    return false;
  }

  const slot = getCurrentSlot(state);
  // Mag 0 rejects fire interrupt
  if (slot.ammoInMag <= 0) {
    return false;
  }

  // Interrupt skips shell_end to prevent double-pump, transitions directly to idle
  state.actionState = 'idle';
  state.stateTimer = 0;
  state.stateTicksRemaining = 0;
  state.ticksIntoState = 0;
  state.shellCommitDone = false;
  return true;
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
  const outTicks = Math.max(1, Math.round(currentDef.swapTicks / 2));
  state.stateTicksRemaining = outTicks;
  state.stateTimer = outTicks / 60;
  state.ticksIntoState = 0;
  state.stateStartTick = state.currentSimTick;
  state.pendingWeaponId = targetWeaponId;
  state.isAds = false;
  state.shellCommitDone = false;
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
 * Respects pre-commit progress loss (ammo not granted) and post-commit retention.
 */
export function cancelReloadOnSprint(state: WeaponState): boolean {
  state.isSprinting = true;
  const isReloading =
    state.actionState === 'reloading_tactical' ||
    state.actionState === 'reloading_empty' ||
    state.actionState === 'reloading_shell' ||
    state.actionState === 'reloading_shell_start' ||
    state.actionState === 'reloading_shell_insert' ||
    state.actionState === 'reloading_shell_end';

  if (isReloading) {
    state.actionState = 'idle';
    state.stateTimer = 0;
    state.stateTicksRemaining = 0;
    state.ticksIntoState = 0;
    state.shellCommitDone = false;
    return true;
  }
  return false;
}

/**
 * Steps the reload / swap state machine by dt.
 * Handles integer tick simulation, commit ticks, shotgun 3-phase reload,
 * bolt-cycling, auto-reload, and auto-switch deterministically.
 */
export function stepWeaponStateMachine(state: WeaponState, dt: number, tickCount?: number): void {
  if (tickCount !== undefined) {
    state.currentSimTick = tickCount;
  } else {
    state.currentSimTick++;
  }

  if (state.bufferedFireTicks > 0) {
    state.bufferedFireTicks--;
  }
  if (state.stateTimer > 0) {
    state.stateTimer = Math.max(0, state.stateTimer - dt);
  }
  if (state.shotCooldownTimer > 0) {
    state.shotCooldownTimer = Math.max(0, state.shotCooldownTimer - dt);
  }

  state.ticksIntoState++;
  if (state.stateTicksRemaining > 0) {
    state.stateTicksRemaining--;
  }

  // --- In-flight commit tick checks ---
  if (state.actionState === 'reloading_tactical' && !state.shellCommitDone) {
    const def = getCurrentWeaponDef(state);
    const commitTick = def.reloadSpec.magazine?.tacticalCommitTick ?? Math.round(def.reloadTimeTactical * 30);
    if (state.ticksIntoState >= commitTick) {
      const slot = getCurrentSlot(state);
      const needed = def.magSize - slot.ammoInMag;
      const toAdd = Math.min(needed, slot.ammoReserve);
      slot.ammoInMag += toAdd;
      slot.ammoReserve -= toAdd;
      state.shellCommitDone = true;
    }
  } else if (state.actionState === 'reloading_empty' && !state.shellCommitDone) {
    const def = getCurrentWeaponDef(state);
    const commitTick = def.reloadSpec.magazine?.emptyCommitTick ?? Math.round(def.reloadTimeEmpty * 30);
    if (state.ticksIntoState >= commitTick) {
      const slot = getCurrentSlot(state);
      const needed = def.magSize - slot.ammoInMag;
      const toAdd = Math.min(needed, slot.ammoReserve);
      slot.ammoInMag += toAdd;
      slot.ammoReserve -= toAdd;
      state.shellCommitDone = true;
    }
  } else if (state.actionState === 'reloading_shell_insert' && !state.shellCommitDone) {
    const def = getCurrentWeaponDef(state);
    const commitTick = def.reloadSpec.shell?.commitTick ?? 20;
    if (state.ticksIntoState >= commitTick) {
      const slot = getCurrentSlot(state);
      if (slot.ammoInMag < def.magSize && slot.ammoReserve > 0) {
        slot.ammoInMag += 1;
        slot.ammoReserve -= 1;
      }
      state.shellCommitDone = true;
    }
  }

  // --- State Expiration Transitions ---
  if (state.stateTicksRemaining <= 0 || state.stateTimer <= 0) {
    switch (state.actionState) {
      case 'reloading_tactical':
      case 'reloading_empty': {
        // Fallback commit if stepping with large dt
        if (!state.shellCommitDone) {
          const slot = getCurrentSlot(state);
          const def = getWeaponDef(slot.weaponId);
          const needed = def.magSize - slot.ammoInMag;
          const toAdd = Math.min(needed, slot.ammoReserve);
          slot.ammoInMag += toAdd;
          slot.ammoReserve -= toAdd;
        }
        state.actionState = 'idle';
        state.stateTimer = 0;
        state.stateTicksRemaining = 0;
        state.ticksIntoState = 0;
        state.shellCommitDone = false;
        break;
      }

      case 'reloading_shell_start': {
        const def = getCurrentWeaponDef(state);
        const insertTicks = def.reloadSpec.shell?.insertTicks ?? 32;
        state.actionState = 'reloading_shell_insert';
        state.stateTicksRemaining = insertTicks;
        state.stateTimer = insertTicks / 60;
        state.ticksIntoState = 0;
        state.stateStartTick = state.currentSimTick;
        state.shellCommitDone = false;
        break;
      }

      case 'reloading_shell_insert': {
        if (!state.shellCommitDone) {
          const slot = getCurrentSlot(state);
          const def = getWeaponDef(slot.weaponId);
          if (slot.ammoInMag < def.magSize && slot.ammoReserve > 0) {
            slot.ammoInMag += 1;
            slot.ammoReserve -= 1;
          }
          state.shellCommitDone = true;
        }

        const slot = getCurrentSlot(state);
        const def = getWeaponDef(slot.weaponId);

        // Reserve checked per iteration; continue insert if more shells needed and available
        if (slot.ammoInMag < def.magSize && slot.ammoReserve > 0) {
          const insertTicks = def.reloadSpec.shell?.insertTicks ?? 32;
          state.actionState = 'reloading_shell_insert';
          state.stateTicksRemaining = insertTicks;
          state.stateTimer = insertTicks / 60;
          state.ticksIntoState = 0;
          state.stateStartTick = state.currentSimTick;
          state.shellCommitDone = false;
        } else {
          // Finished insertions: transition to end phase
          const endTicks = def.reloadSpec.shell?.endTicks ?? 24;
          state.actionState = 'reloading_shell_end';
          state.stateTicksRemaining = endTicks;
          state.stateTimer = endTicks / 60;
          state.ticksIntoState = 0;
          state.stateStartTick = state.currentSimTick;
          state.shellCommitDone = false;
        }
        break;
      }

      case 'reloading_shell_end': {
        state.actionState = 'idle';
        state.stateTimer = 0;
        state.stateTicksRemaining = 0;
        state.ticksIntoState = 0;
        state.shellCommitDone = false;
        break;
      }

      case 'reloading_shell': {
        // Legacy shell reload backward compatibility
        const slot = getCurrentSlot(state);
        const def = getWeaponDef(slot.weaponId);
        if (slot.ammoInMag < def.magSize && slot.ammoReserve > 0) {
          slot.ammoInMag += 1;
          slot.ammoReserve -= 1;
        }

        if (slot.ammoInMag < def.magSize && slot.ammoReserve > 0) {
          state.actionState = 'reloading_shell';
          state.stateTimer = def.shellReloadTime ?? def.reloadTimeTactical;
          state.stateTicksRemaining = Math.round(state.stateTimer * 60);
          state.ticksIntoState = 0;
        } else {
          state.actionState = 'idle';
          state.stateTimer = 0;
          state.stateTicksRemaining = 0;
          state.ticksIntoState = 0;
        }
        break;
      }

      case 'cycling_bolt': {
        state.actionState = 'idle';
        state.stateTimer = 0;
        state.stateTicksRemaining = 0;
        state.ticksIntoState = 0;
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
          const inTicks = Math.max(1, Math.round(newDef.swapTicks / 2));
          state.actionState = 'swapping_in';
          state.stateTicksRemaining = inTicks;
          state.stateTimer = inTicks / 60;
          state.ticksIntoState = 0;
          state.stateStartTick = state.currentSimTick;
          state.pendingWeaponId = null;
        } else {
          state.actionState = 'idle';
          state.stateTimer = 0;
          state.stateTicksRemaining = 0;
          state.ticksIntoState = 0;
        }
        break;
      }

      case 'swapping_in': {
        state.actionState = 'idle';
        state.stateTimer = 0;
        state.stateTicksRemaining = 0;
        state.ticksIntoState = 0;
        break;
      }

      case 'firing': {
        state.actionState = 'idle';
        state.stateTimer = 0;
        state.stateTicksRemaining = 0;
        state.ticksIntoState = 0;
        break;
      }

      case 'idle':
      default:
        state.actionState = 'idle';
        state.stateTimer = 0;
        state.stateTicksRemaining = 0;
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
