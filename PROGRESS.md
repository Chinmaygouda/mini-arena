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

## In progress
- Phase 1 Gate Review & sign-off

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
