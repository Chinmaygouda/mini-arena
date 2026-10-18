// src/weapons/fireScheduler.ts
// Pure fire timing scheduler with deterministic simulation clock in seconds.
// Guarantees exact RPM cadence, rising-edge semi-auto, cycle-respecting pump/bolt,
// at most 2 catch-up shots per frame, and hard assertions against runaway consumption.

export interface FireSchedulerState {
  simTime: number;             // Monotonic simulation clock in seconds
  nextShotTime: number;        // Timestamp when next shot is allowed (seconds)
  triggerHeld: boolean;        // Whether the trigger (LMB) is currently held
  triggerJustPressed: boolean; // Rising-edge: true only on the frame the trigger went down
  ammoInClip: number;          // Ammo remaining in clip
  isReloading: boolean;        // True while reload animation/timer is active
  isSwapping: boolean;         // True while weapon switch animation is active
  isSprinting: boolean;        // True while sprinting
  fireMode: 'auto' | 'semi';   // Firing mode
  fireInterval: number;        // Seconds per shot: 60 / RPM
  cycleTime?: number;          // Pump/bolt cycle time in seconds (defaults to fireInterval)
}

export interface StepSchedulerResult {
  shotsFired: number;
}

export const CATCH_UP_CAP = 2;

let hasLoggedFireError = false;

export function resetSchedulerErrorLog() {
  hasLoggedFireError = false;
}

/**
 * Step the fire scheduler by dt seconds.
 * Pure function: mutates state in place and calls onFire() for each validated shot.
 * Robustness guarantee: exceptions in onFire can never stall the scheduler, loop, or burst-drain ammo.
 */
export function stepFireScheduler(
  state: FireSchedulerState,
  dt: number,
  onFire: () => void
): StepSchedulerResult {
  state.simTime += dt;
  const initialAmmo = state.ammoInClip;
  let shotsFired = 0;

  const canFire =
    state.triggerHeld &&
    !state.isReloading &&
    !state.isSwapping &&
    !state.isSprinting &&
    state.ammoInClip > 0;

  if (canFire) {
    if (state.fireMode === 'auto') {
      // Automatic weapons: fire up to CATCH_UP_CAP shots if time >= nextShotTime
      while (state.simTime >= state.nextShotTime && shotsFired < CATCH_UP_CAP && state.ammoInClip > 0) {
        shotsFired++;
        state.nextShotTime += state.fireInterval;
        const prevAmmo = state.ammoInClip;
        try {
          onFire();
        } catch (err) {
          if (!hasLoggedFireError) {
            console.error('[FireScheduler] Error during shot execution:', err);
            hasLoggedFireError = true;
          }
          break; // Never loop on exception
        } finally {
          // Guarantee ammo is decremented exactly once even if onFire threw before decrementing
          if (state.ammoInClip === prevAmmo && state.ammoInClip > 0) {
            state.ammoInClip -= 1;
          }
        }
      }

      // If time still exceeds nextShotTime (e.g. after a huge pause or frame spike),
      // clamp nextShotTime to simTime so accumulated time never snowballs into subsequent frames.
      if (state.simTime > state.nextShotTime + state.fireInterval) {
        state.nextShotTime = state.simTime;
      }
    } else {
      // Semi-automatic weapons: fire once per trigger press (rising edge only)
      const cycle = state.cycleTime || state.fireInterval;
      if (state.triggerJustPressed && state.simTime >= state.nextShotTime && state.ammoInClip > 0) {
        shotsFired = 1;
        state.nextShotTime = state.simTime + cycle;
        const prevAmmo = state.ammoInClip;
        try {
          onFire();
        } catch (err) {
          if (!hasLoggedFireError) {
            console.error('[FireScheduler] Error during semi-auto shot execution:', err);
            hasLoggedFireError = true;
          }
        } finally {
          if (state.ammoInClip === prevAmmo && state.ammoInClip > 0) {
            state.ammoInClip -= 1;
          }
        }
      }
    }
  }

  // Clear rising-edge trigger flag after evaluation
  state.triggerJustPressed = false;

  // HARD ASSERTION: Ammo cannot drop by more than the catch-up cap (2) in one frame
  const ammoDropped = initialAmmo - state.ammoInClip;
  if (ammoDropped > CATCH_UP_CAP) {
    throw new Error(
      `[FireScheduler] HARD ASSERTION FAILED: Ammo dropped by ${ammoDropped} in a single frame (cap is ${CATCH_UP_CAP})`
    );
  }

  return { shotsFired };
}

/**
 * Call when the player presses the trigger (LMB down).
 */
export function onTriggerPress(state: FireSchedulerState): void {
  if (!state.triggerHeld) {
    state.triggerJustPressed = true;
  }
  state.triggerHeld = true;
  // If we haven't fired recently, we can fire immediately
  if (state.nextShotTime < state.simTime) {
    state.nextShotTime = state.simTime;
  }
}

/**
 * Call when the player releases the trigger (LMB up).
 */
export function onTriggerRelease(state: FireSchedulerState): void {
  state.triggerHeld = false;
  state.triggerJustPressed = false;
  // Reset nextShotTime so stale debt never carries over
  if (state.nextShotTime < state.simTime) {
    state.nextShotTime = state.simTime;
  }
}

/**
 * Call when switching / equipping a weapon.
 */
export function onWeaponEquip(state: FireSchedulerState): void {
  state.nextShotTime = state.simTime;
  state.triggerJustPressed = false;
}
