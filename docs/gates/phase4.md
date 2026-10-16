# Phase 4 Gate Report: Grenades & Combat VFX

**Date**: 2026-10-16  
**Status**: Signed Off / Approved  

## 1. Deliverables & Acceptance Checklist
- [x] **Shared Deterministic Grenade Simulation** (`packages/shared/src/grenades/`):
  - [x] M67 Frag Grenade: 150-tick fuse (2.5s), 18 m/s throw, 2G gravity, CCD sphere-cast reflection, quadratic damage (120 point-blank to 15 at 7.0m), 75% self-damage factor.
  - [x] M84 Stun Grenade: 100-tick fuse (1.667s), 16.0m blast radius, line-of-sight check + view angle decay, up to 240 ticks (4.0s) whiteout.
  - [x] M18 Smoke Grenade: 120-tick fuse (2.0s), 5.5m spherical radius, 600 ticks (10.0s) duration, continuous ray-sphere LOS occlusion query (`isLineBlockedBySmoke`).
  - [x] Inventory cycling (T key), 12-tick windup, throw cancellation on sprint/weapon swap, release on G key.
- [x] **Instanced Decal System** (`packages/client/src/vfx/decalManager.ts`):
  - [x] Ring buffers for 128 bullet holes (0.08m) and 32 explosion blast scorch marks (4.5m).
  - [x] Depth bias and `polygonOffset: true` (`factor: -1, units: -1`) preventing coplanar Z-fighting.
  - [x] Zero per-frame allocations during spawning and FIFO recycling.
- [x] **Pooled Combat VFX System** (`packages/client/src/vfx/combatVfxManager.ts`):
  - [x] 32 pooled brass shell casings with tumbling rotation and surface bounce physics.
  - [x] Surface-specific impact particle emitters (metal sparks, concrete dust, wood splinters).
  - [x] Screen shake (trauma^2) with harmonic multi-frequency decay.
- [x] **Grenade Client VFX & Physics Bridge** (`packages/client/src/vfx/`):
  - [x] Pooled 3D grenade meshes (frag, flash, smoke).
  - [x] Expanding fireball and shockwave ring meshes on detonation.
  - [x] Flashbang whiteout overlay with exponential perceptual decay.
  - [x] Instanced billowing smoke cloud (48 expanding puffs with soft alpha fade).
  - [x] `RapierGrenadeWorldAdapter` filtering out player body capsule to prevent self-intersection.
- [x] **Target Dummy & Vitals Integration**:
  - [x] Offline dummy target damage handling, respawn cycle (180 ticks), and spawn protection (90 ticks).

## 2. Verification Evidence
- **Vitest Unit Test Suite**:
  - 13 test files passing, 115/115 tests passing.
  - 11 dedicated tests in `packages/shared/src/grenades/grenades.test.ts` verifying:
    - Fuse countdown and detonation triggering
    - 1,000-run bit-identical bounce determinism
    - Continuous collision detection (CCD) thin-wall tunneling immunity
    - Quadratic blast damage falloff with distance
    - Line-of-sight raycast occlusion for blast and flash
    - View angle decay for flashbang whiteout
    - Smoke ray-sphere volume occlusion
    - Inventory cycling, windup, and sprint cancellation
- **Playwright E2E Test Suite**:
  - 6/6 tests passing across Chromium and Firefox in `tests/e2e/grenades.spec.ts`.
- **Memory, Recycling & Leak Verification**:
  - Decal pool exhaustion test: PASSED (128 decals FIFO-recycled without memory growth).
  - Shell pool exhaustion test: PASSED (32 casings FIFO-recycled without memory growth).
  - Teardown & disposal test: PASSED (1,000 iterations spawn/dispose returns cleanly with 0 leaked Three.js / Rapier objects).
- **First-Person Visual Evidence** (12 screenshots saved in `docs/screenshots/phase4/`):
  - `throw_inflight.png` — In-flight grenade model and trajectory
  - `grenade_bounce.png` — Bounce collision and orientation
  - `frag_blast_decal.png` — Explosion fireball VFX and scorch decal on ground
  - `flash_front_whiteout.png` — Direct line-of-sight flashbang whiteout (alpha 0.63)
  - `flash_behind.png` — Turned-away flashbang reduced blinding (alpha < 0.20)
  - `smoke_blocking_dummy.png` — Billowing smoke cloud obscuring dummy target
  - `muzzle_shells_ak47.png` — AK-47 muzzle flash and brass shell casing ejection
  - `muzzle_shells_pistol.png` — Tactical pistol muzzle flash and casing ejection
  - `muzzle_shells_smg.png` — SMG rapid casing ejection
  - `muzzle_shells_shotgun.png` — Shotgun red hull ejection
  - `muzzle_shells_sniper.png` — Sniper large brass casing ejection
  - `decals_surfaces.png` — Bullet hole decals on multiple arena surfaces

## 3. Performance Metrics vs Budget
- **Avg FPS**: **60.00 FPS** (Budget: $\ge 60$ FPS)
- **1% Low FPS**: **59.52 FPS** (Budget: $\ge 50$ FPS)
- **Median Frame Time**: **16.70 ms**
- **Hot-Path Allocations**: **0 bytes** per frame / tick (100% pooled objects and ring buffers).

## 4. Architectural Decisions
- Recorded **ADR 019** in `DECISIONS.md`.
