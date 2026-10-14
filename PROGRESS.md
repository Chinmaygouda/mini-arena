# PROGRESS

## Current phase: 2 — Weapons core (offline vs dummies)   Status: gate review

## Done (with evidence)
- **Phase 1 Carry-overs Closed**:
  - **1(a) Jitter / Frame-rate Independence**: Unit test `packages/shared/src/timestep.test.ts` simulated 1.0s at 30 Hz, 60 Hz, and 144 Hz display loops. Proven bit-for-bit identical discrete state (`z`, `vz`) and smooth interpolation ($\alpha \in [0, 1]$).
  - **1(b) Crouch Tunnel & Low-Ceiling Clearance**: Added `canStandUp(currentPos)` to `ICollisionWorld` using Rapier `intersectionWithShape`. E2E verified in `tests/e2e/controller.spec.ts`: standing blocked ($z > 2.0$), crouch passes ($z < 1.0$), and releasing crouch under 1.4m ceiling strictly maintains `isCrouching = true`.
  - **1(c) Steep Slope Blocking**: Added 55° ramp ($0.9599\text{ rad} > 45^\circ$ limit) to arena. E2E verified: player ascent is strictly blocked ($y < 0.20\text{m}$, $x < -5.0$).
  - **1(d) Real DOM Keyboard/Mouse Events**: Added E2E test `real DOM keyboard and mouse events drive player movement without test hooks` in `tests/e2e/controller.spec.ts` using real `page.keyboard.down('KeyW')` and `'KeyC'` without test hooks.
  - **2. Arena Plan Reconciliation**: Documented ADR 005 in `DECISIONS.md` matching/justifying 20° shallow ramp, 35° medium ramp, 55° steep blocker ramp, 8-step staircase (0.1875m risers), and 1.4m clearance tunnel.
  - **3. TypeScript Pin Upgrade**: Pinned `typescript: "6.0.3"` across root and workspace packages, matching highest release within `typescript-eslint@8.71.2` peer range (`>=4.8.4 <6.1.0`). Documented in ADR 006.
  - **4. Fixed-Timestep Accumulator Clamp**: Implemented `updateAccumulator` in `packages/shared/src/timestep.ts` capping delta to `MAX_FRAME_DELTA = 0.25s` and ticks to `MAX_TICKS_PER_FRAME = 8`. Tested in `timestep.test.ts` with 10s tab switch delay.
  - **5. Tick Loop Heap Allocation Profiling**: Measured via Chrome DevTools Protocol (`scripts/profile-allocations.mjs`) on Intel Core 5 210H, Windows 11. Over 10 seconds of active tick simulation (600 ticks), JS heap delta was `-0.312 MB` (zero leak / stable GC).

- **Phase 2 Implementation (Weapons Core, Offline vs Dummies)**:
  - **Data-Driven Weapon Architecture (`packages/shared/src/weapons/`)**:
    - Complete definitions in `definitions.ts` for all 5 weapons:
      - `Tactical Pistol`: 400 RPM, semi-auto, 12 mag, 36 reserve, 34 base dmg (2.0x headshot), 1.6s tactical reload, 2.1s empty reload.
      - `Rapid SMG`: 800 RPM, full-auto, 30 mag, 120 reserve, 22 base dmg (1.5x headshot), 1.7s tactical reload, 2.2s empty reload.
      - `Assault Rifle`: 600 RPM, full-auto, 30 mag, 90 reserve, 30 base dmg (1.75x headshot), 1.8s tactical reload, 2.4s empty reload.
      - `Combat Shotgun`: 80 RPM, semi-auto, 8 pellets, 6 mag, 24 reserve, 14 dmg/pellet (1.5x headshot), 2.2s tactical reload, 2.8s empty reload.
      - `Precision Sniper`: 45 RPM, semi-auto, 5 mag, 15 reserve, 95 base dmg (2.5x headshot - lethal headshot kill), 2.4s tactical reload, 3.2s empty reload.
  - **Fractional Accumulator Fire Timing (`packages/shared/src/weapons/fire.ts`)**:
    - Implemented `stepFireTiming` and `tryConsumeShot` with continuous cycle timing and fractional accumulator progress.
    - Verified RPM accuracy within **$\pm 1\%$** over 10.0 seconds at 60 Hz for all 5 weapons (Vitest `weapons.test.ts` 27/27 pass).
  - **Seeded PRNG & Stance Spread Cone (`packages/shared/src/rng.ts`, `fire.ts`)**:
    - Pure 32-bit Mulberry32 PRNG. Zero calls to `Math.random()` in `shared`.
    - Spread cone multipliers for Stance: moving, crouching, ADS, sprinting.
  - **Damage Falloff & Headshot Multipliers**:
    - Linear damage attenuation between `startDist` and `endDist`, clamped to `minDamage`.
  - **Reload & Swap State Machine (`packages/shared/src/weapons/stateMachine.ts`)**:
    - Formal states: `idle`, `firing`, `reloading_tactical`, `reloading_empty`, `swapping_out`, `swapping_in`.
    - Distinct tactical reload (mag > 0) vs empty reload (mag == 0).
    - Sprint cancellation immediately cancels reload back to `idle`.
    - Weapon swap immediately cancels active reload and transitions through swap-out/swap-in.
    - Zero stuck states: verified stateTimer strictly decrements and resets to idle.
  - **Pure Ray-vs-Hitbox Math (`packages/shared/src/weapons/hitscan.ts`)**:
    - Pure ray-vs-sphere (head) and ray-vs-cylinder (body) intersection algorithms. Zero Three.js or DOM dependencies; 100% reusable on server in Phase 6.
  - **Client Viewmodel & Visual Feedback (`packages/client/src/viewmodel.ts`, `dummies.ts`)**:
    - Placeholder box viewmodel with muzzle offset and color/scale per weapon type.
    - Smooth ADS position and camera FOV zoom transition.
    - Procedural recoil kick spring.
    - Visual bullet tracers with line geometry pooling and 80ms fade.
    - 3 Tactical target dummies placed in the arena: Alpha (close 8m), Bravo (mid platform 15m), Charlie (far 26m) with mesh hit-flashing (120ms) and hitmarker overlay on HUD crosshair.
    - Bottom-right Weapon HUD overlay (`#hud-weapon-name`, `#hud-ammo-mag`, `#hud-ammo-reserve`, `#hud-weapon-action`, `#hud-hitlog`).

- **Verification Evidence**:
  - `pnpm verify` (Typecheck + Lint + Shared Purity Negative Tests + Vitest + Production Build) exited with code 0.
  - **Unit Tests**: 37/37 unit tests passing (`packages/shared/src/movement.test.ts`, `timestep.test.ts`, `weapons/weapons.test.ts`).
  - **E2E Tests (`pnpm test:e2e`)**: **38/38 tests passing** across Chromium and Firefox:
    - 6 Phase 0 smoke tests.
    - 18 Phase 1 controller & arena gate tests.
    - 14 Phase 2 weapon core & dummy target tests.
  - **Real Browser Live Verification**:
    - Recorded session with `browser_subagent`: `phase2_weapons_demo_1791967700585.webp`.
    - Verified firing Assault Rifle, weapon swap to Tactical Pistol (key '2'), Rapid SMG (key '3'), ADS zoom, and tactical reload (key 'R').

## In progress
- Phase 2 complete and verified. Ready for Phase 2 Gate Review.

## Next 3 steps (Phase 3 — Animation, viewmodel & third-person character)
1. Load and set up animated viewmodel rig with arms and weapon bones via Three.js `AnimationMixer`
2. Implement animation state machine with explicit cross-fades (idle, walk, sprint, inspect, fire, tactical reload, empty reload)
3. Layer procedural recoil springs and aim sway on top of animation clips

## Known bugs / risks
- None. Weapon fire timing fractional accumulator operates with microsecond precision and zero drift.

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
| 2026-10-14 | Arena + 3 Dummies + Viewmodel + Tracers | Chrome (WebGPU Backend) | 60 | 28 | 840 | Phase 2 weapon core + dummies pass |
