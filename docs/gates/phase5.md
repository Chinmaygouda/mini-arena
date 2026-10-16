# Phase 5 Gate Report: Maps & Art Pass

**Date**: 2026-10-16  
**Status**: Signed Off / Approved  

## 1. Deliverables & Acceptance Checklist
- [x] **Deterministic Map Specifications in `packages/shared/src/maps/`**:
  - [x] `Warehouse`: 40m × 40m tight indoor industrial layout with central elevated catwalk (y = 2.0m), stairs and ramps, cargo crates, and two distinct flanking lanes (Machinery East, Storage West).
  - [x] `Plaza`: 50m × 50m sunlit Mediterranean courtyard with central stone fountain/monument, classical colonnade arcade, and raised West terrace (y = 1.4m).
  - [x] `Container Yard`: 60m × 40m cargo shipping terminal with multi-tier stacked ISO containers (red, blue, green, yellow), narrow chokepoint alleys, and elevated crane catwalk (y = 3.5m) sniper lane.
  - [x] Symmetrical 4 spawns per map (2 Alpha, 2 Bravo) with team separation $\ge 25\text{ m}$.
  - [x] Surface types assigned per box/ramp (`concrete`, `metal`, `wood`, `stone`) driving visual materials, bullet decals, and footsteps.
- [x] **Automated Map Validation & Floor Reachability** (`validation.ts`):
  - [x] Spawn clearance and non-intersection verification.
  - [x] 2D grid BFS reachability algorithm verifying 100% floor path connectivity between opposing team spawns.
  - [x] Slope angle enforcement ($\le 45^\circ$ passable, $> 45^\circ$ steep blocker).
- [x] **Client MapLoader & PBR Art Pipeline** (`packages/client/src/maps/`):
  - [x] Procedural canvas PBR textures (concrete noise, stone noise, corrugated steel ribs, wood crate planks) requiring $0 extra network requests and keeping transfer size $\ll 25\text{ MB}$.
  - [x] Rapier 3D kinematic colliders generated directly for all static boxes and ramps.
  - [x] Smooth stair ramp physics proxy: Renders visual discrete steps while generating an angled ramp collider for smooth character controller traversal.
  - [x] URL parameter map selection (`?map=warehouse`, `?map=plaza`, `?map=containeryard`).
  - [x] Zero-leak hot-switching (`window.__switchMap(id)`): Disposes Three.js meshes, textures, materials, and removes Rapier bodies/colliders.

## 2. Verification Evidence
- **Vitest Unit Test Suite**:
  - 14 test files passing, 121/121 tests passing.
  - 6 dedicated tests in `packages/shared/src/maps/maps.test.ts` verifying all 3 maps, reachability, bounds, and corrupt map error detection.
- **Playwright E2E Test Suite**:
  - 8/8 tests passing across Chromium and Firefox in `tests/e2e/maps.spec.ts`.
- **10x Consecutive Load/Unload Leak Test**:
  - 31 total map transitions.
  - Initial bodies: 25 $\to$ Final bodies: 25 (**Zero Leaks**).
  - Initial colliders: 26 $\to$ Final colliders: 26 (**Zero Leaks**).
- **First-Person & Top-Down Visual Evidence** (6 screenshots saved in `docs/screenshots/maps/`):
  - `warehouse_firstperson.png` — Industrial catwalk, safety railing, and crate cover
  - `warehouse_topdown.png` — Full warehouse tactical floor plan and lighting
  - `plaza_firstperson.png` — Sunlit courtyard, center fountain monument, and colonnade
  - `plaza_topdown.png` — Full plaza tactical layout and terrace stairs
  - `containeryard_firstperson.png` — Corrugated shipping containers, crane catwalk, and pallets
  - `containeryard_topdown.png` — Full container yard layout and tactical alleys

## 3. Performance Metrics vs Hard Budgets
- **Draw Calls**: **6 to 18 calls/frame** (Hard Budget: $\le 250$).
- **Visible Triangles**: **10,421 triangles** (Hard Budget: $\le 120\text{k}$ Low / $\le 300\text{k}$ High).
- **Map Load Time**: **340ms to 1085ms** (Hard Budget: $\le 5,000\text{ms}$).
- **Frame Rate**: **60.3 FPS average** across all maps on standard laptop GPU.

## 4. Architectural Decisions
- Recorded **ADR 020** in `DECISIONS.md`.
