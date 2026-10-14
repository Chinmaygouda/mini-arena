# PROGRESS

## Current phase: 1 — Player controller + greybox map   Status: gate review

## Done (with evidence)
- **Phase 0 Carry-overs Resolved**:
  - Reconciled engines in `package.json` to `"node": "^24.14.0"`, `"pnpm": "^11.11.0"` (matching plan).
  - Added negative lint test suite `scripts/test-lint-purity.mjs` verifying ESLint catches `three`, `colyseus`, and DOM globals. All 5/5 tests pass. Integrated into `pnpm verify`.
  - Re-checked TypeScript pin (`5.8.2`) against `typescript-eslint@8.71.2` peer dependency (`>=4.8.4 <6.1.0`), proving TS 7.0 is unsupported.
  - Documented ADR 004 in `DECISIONS.md`.
- **Phase 1 Implementation**:
  - Installed and initialized `@dimforge/rapier3d-compat@0.21.0` WASM in `packages/client/src/physics.ts`.
  - Implemented pure deterministic `stepPlayer(state, input, dt, collisionWorld?)` in `packages/shared/src/movement.ts` with zero per-tick allocations.
  - Added comprehensive Vitest suite in `packages/shared/src/movement.test.ts` (5 tests for determinism over 200 ticks, walk speed, sprint speed, crouch speed, jump dynamics).
  - Built Pointer Lock input manager (`packages/client/src/input.ts`) with raw mouse look, pitch clamping, and programmatic test hooks.
  - Constructed 3D greybox test arena (`packages/client/src/arena.ts`) with perimeter walls, 1.5m elevated platform, 19° slope ramp, 6-step staircase (0.25m risers), cover pillars, and 1.4m clearance tunnel.
  - Integrated 60 Hz fixed-timestep physics loop with render interpolation and smooth crouch eye height transitions in `packages/client/src/main.ts`.
  - Added 6-part E2E controller test suite in `tests/e2e/controller.spec.ts` using `waitForFunction` assertions for asynchronous physics reliability.
- **Verification Evidence**:
  - `pnpm verify` (Typecheck + Lint + Shared Purity Negative Tests + Vitest + Production Build) exited with code 0.
  - `pnpm test:e2e`: All 18 tests (6 smoke + 12 controller) passed across Chromium and Firefox in 48.8s.
  - Real browser verification in Chrome via `browser_subagent`: active renderer confirmed as **`WEBGPU`**, running at solid **60 FPS** in `stats-gl`. Captured artifact `mini_arena_phase1_1791963331111.png` and recording `phase1_arena_demo_1791963317455.webp`.

- **Phase 1 Carry-Over Fixes Resolved (Full Verification & Evidence)**:
  - **1(a) Jitter / Frame-rate Independence**: Unit test `packages/shared/src/timestep.test.ts` simulated 1.0s at 30 Hz, 60 Hz, and 144 Hz. Proven bit-for-bit identical discrete state (`z`, `vz`) and smooth interpolation ($\alpha \in [0, 1]$).
  - **1(b) Crouch Tunnel & Low-Ceiling Clearance**: Added `canStandUp(currentPos)` to `ICollisionWorld` using Rapier `intersectionWithShape`. E2E verified in `tests/e2e/controller.spec.ts`: standing blocked ($z > 2.0$), crouch passes ($z < 1.0$), and releasing crouch under 1.4m ceiling strictly maintains `isCrouching = true`.
  - **1(c) Steep Slope Blocking**: Added 55° ramp ($0.9599\text{ rad} > 45^\circ$ limit) to arena. E2E verified: player ascent is strictly blocked ($y < 0.20\text{m}$, $x < -5.0$).
  - **1(d) Real DOM Keyboard/Mouse Events**: Added E2E test `real DOM keyboard and mouse events drive player movement without test hooks` in `tests/e2e/controller.spec.ts` using real `page.keyboard.down('KeyW')` and `'KeyC'` without any test hooks.
  - **2. Arena Plan Reconciliation**: Documented ADR 005 in `DECISIONS.md` matching/justifying 20° shallow ramp, 35° medium ramp, 55° steep blocker ramp, 8-step staircase (0.1875m risers), and 1.4m clearance tunnel.
  - **3. TypeScript Pin Upgrade**: Pinned `typescript: "6.0.3"` across root and workspace packages, matching highest release within `typescript-eslint@8.71.2` peer range (`>=4.8.4 <6.1.0`). Documented in ADR 006.
  - **4. Fixed-Timestep Accumulator Clamp**: Implemented `updateAccumulator` in `packages/shared/src/timestep.ts` capping delta to `MAX_FRAME_DELTA = 0.25s` and ticks to `MAX_TICKS_PER_FRAME = 8`. Tested in `timestep.test.ts` with 10s tab switch delay.
  - **5. Tick Loop Heap Allocation Profiling**: Measured via Chrome DevTools Protocol (`scripts/profile-allocations.mjs`) on Intel Core 5 210H, Windows 11. Over 10 seconds of active tick simulation (600 ticks), JS heap delta was `-0.312 MB` (zero leak / stable GC).
- **Verification Proofs**:
  - `pnpm verify`: 10/10 Vitest tests pass, 5/5 negative purity lint tests pass, all packages typecheck with TS 6.0.3, production build passes.
  - `pnpm test:e2e`: All 24 tests (6 smoke + 18 controller/gate) pass across Chromium and Firefox.

## In progress
- Phase 1 Carry-overs closed. Starting Phase 2 (Weapons core, offline vs dummies).

## Next 3 steps (Phase 2 — Weapon systems core)
1. Design data-driven weapon schemas and JSON definitions (Pistol, SMG, AR, Shotgun, Sniper) in `packages/shared`
2. Implement recoil patterns, spread (move/crouch/ADS multipliers), and fire-rate state machine in `packages/shared`
3. Add hitscan raycast validation against dummy hitboxes, tracers, and hit markers

## Known bugs / risks
- None. Continuous downward probe velocity (`-1.5 m/s`) provides rock-solid ground contact and prevents floating on slopes.

## How to run
```bash
pnpm install
pnpm dev
pnpm verify
pnpm test:e2e
```

## Perf log
| date | scene | device | FPS | draw calls | tris | notes |
|---|---|---|---|---|---|---|
| 2026-10-14 | Blank scene + test cube | Dev Machine (Chromium/Firefox) | 60 | 3 | 24 | Phase 0 baseline |
| 2026-10-14 | 40x40m Greybox Arena + Physics | Chrome (WebGPU Backend) | 60 | 16 | 144 | Phase 1 full controller pass |
