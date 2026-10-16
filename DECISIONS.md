# DECISIONS.md — Architecture & Library Decision Records

This document tracks all library selections, version pinnings, license audits, and architectural decisions for **Mini Arena**.

---

## ADR 001: Pinned Tech Stack & npm Verification (Phase 0)

**Date**: 2026-10-14  
**Status**: Accepted

### Raw npm Verification Output
Verification run on Node v24.14.0 via `npm view <pkg> version license time.modified`:

```json
three => {
  "version": "0.186.1",
  "license": "MIT",
  "time.modified": "2026-09-24T14:42:21.613Z"
}
vite => {
  "version": "8.3.4",
  "license": "MIT",
  "time.modified": "2026-10-08T12:07:04.837Z"
}
typescript => {
  "version": "7.0.2",
  "license": "Apache-2.0",
  "time.modified": "2026-10-13T08:34:00.291Z"
}
@dimforge/rapier3d-compat => {
  "version": "0.21.0",
  "license": "Apache-2.0",
  "time.modified": "2026-09-25T08:46:24.048Z"
}
colyseus => {
  "version": "0.18.9",
  "license": "MIT",
  "time.modified": "2026-09-30T21:47:53.988Z"
}
@colyseus/sdk => {
  "version": "0.18.5",
  "license": "MIT",
  "time.modified": "2026-10-03T19:14:35.797Z"
}
@colyseus/schema => {
  "version": "5.0.39",
  "license": "MIT",
  "time.modified": "2026-10-12T04:16:56.603Z"
}
vitest => {
  "version": "5.0.4",
  "license": "MIT",
  "time.modified": "2026-10-12T09:47:03.124Z"
}
@playwright/test => {
  "version": "1.64.0",
  "license": "Apache-2.0",
  "time.modified": "2026-10-14T05:25:00.966Z"
}
@gltf-transform/cli => {
  "version": "4.5.1",
  "license": "MIT",
  "time.modified": "2026-09-28T12:48:28.544Z"
}
three-mesh-bvh => {
  "version": "0.9.16",
  "license": "MIT",
  "time.modified": "2026-10-08T05:46:08.286Z"
}
stats-gl => {
  "version": "4.2.3",
  "license": "MIT",
  "time.modified": "2026-07-10T10:52:05.382Z"
}
```

### Library Matrix & Installation Phasing

| Package | Pinned Version | License | Installation Phase | Rationale & Alternatives |
|---|---|---|---|---|
| `three` | `0.186.1` | MIT | Phase 0 | Industry-standard web 3D engine; includes `three/webgpu` with WebGL2 fallback. |
| `@types/three` | `^0.186.0` | MIT | Phase 0 | Type definitions for Three.js. |
| `vite` | `8.3.4` | MIT | Phase 0 | High-performance bundler and dev server. Alternative rejected: Webpack (slower, bloated config). |
| `typescript` | `5.8.2` | Apache-2.0 | Phase 0 | Stable TS 5.x pinned. TypeScript 7.0.2 is very newly published; typescript-eslint and @types/three have broader battle-tested stability on 5.8. |
| `eslint` | `^9.20.0` | MIT | Phase 0 | Standard linter with flat config to enforce shared purity rules. |
| `prettier` | `^3.5.0` | MIT | Phase 0 | Standard code formatter. |
| `vitest` | `5.0.4` | MIT | Phase 0 | Native Vite test runner for deterministic unit testing in `shared`. |
| `@playwright/test` | `1.64.0` | Apache-2.0 | Phase 0 | Multi-browser headless automation (Chromium + Firefox) for real WebGPU & WebGL2 verification. |
| `stats-gl` | `4.2.3` | MIT | Phase 0 | Modern GPU/CPU/FPS profiling HUD built for WebGL/WebGPU. |
| `@dimforge/rapier3d-compat` | `0.21.0` | Apache-2.0 | Phase 1 (Deferred) | Physics WASM for client and Node server. Pinned now; will be installed in Phase 1. |
| `three-mesh-bvh` | `0.9.16` | MIT | Phase 2 (Deferred) | BVH accelerated raycasting for decals/visuals. Pinned now; will be installed in Phase 2. |
| `@gltf-transform/cli` | `4.5.1` | MIT | Phase 3/5 (Deferred) | Asset optimization CLI. Pinned now; will be installed in Phase 3/5 tools. |
| `colyseus` | `0.18.9` | MIT | Phase 6 (Deferred) | Multiplayer authoritative server. Pinned now; will be installed in Phase 6. |
| `@colyseus/sdk` | `0.18.5` | MIT | Phase 6 (Deferred) | Client multiplayer SDK. Pinned now; will be installed in Phase 6. |
| `@colyseus/schema` | `5.0.39` | MIT | Phase 6 (Deferred) | Schema synchronization. Pinned now; will be installed in Phase 6. |

---

## ADR 002: Dual Renderer Strategy (`WebGPURenderer` with WebGL2 Fallback)

**Date**: 2026-10-14  
**Status**: Accepted

### Context
`PLAN.md` requires high visual fidelity with WebGPU while strictly mandating an automatic WebGL2 fallback.
Three.js r171+ provides `three/webgpu` `WebGPURenderer` which asynchronously initializes WebGPU when available and seamlessly falls back to WebGL2.

### Decision
1. Initialize the renderer using `import { WebGPURenderer } from 'three/webgpu';`.
2. Inspect URL search parameters: `forceWebGL = url.searchParams.has('forceWebGL') || url.searchParams.get('forceWebGL') === 'true'`.
3. If `forceWebGL` is present, initialize `WebGPURenderer({ forceWebGL: true })`.
4. Always call `await renderer.init()` prior to rendering.
5. Expose `window.__renderer = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2'` to enable automated E2E testing assertions.

---

## ADR 003: Pure Deterministic Simulation in `packages/shared`

**Date**: 2026-10-14  
**Status**: Accepted

### Context
`AGENT_RULES.md` Rule C specifies that `packages/shared` must not import DOM, Three.js, or Colyseus, and must remain completely deterministic.

### Decision
1. `packages/shared/tsconfig.json` specifies `"lib": ["ES2022"]` (omitting `"DOM"`).
2. ESLint rule `no-restricted-imports` explicitly blocks any browser globals, `three`, or `colyseus` in `packages/shared/**`.
3. Added automated negative test `scripts/test-lint-purity.mjs` verifying that violations of Three.js, Colyseus, or DOM globals are caught by ESLint.
4. Integrated `pnpm test:purity` into `pnpm verify`.

---

## ADR 004: Phase 0 Carry-Over Reconciliations & Audit Responses

**Date**: 2026-10-14  
**Status**: Accepted

### 1. Plan Deviations Reconciled
- **Node & pnpm Engines**: Updated root `package.json` to strictly match the plan (`"node": "^24.14.0"`, `"pnpm": "^11.11.0"`). `.nvmrc` is pinned to `v24.14.0`.
- **`exactOptionalPropertyTypes`**: Intentionally omitted. Following user review guidance, `exactOptionalPropertyTypes` causes extensive compatibility friction with third-party types without meaningful safety benefit. Retained `strict: true`, `noUncheckedIndexedAccess: true`, and `noImplicitOverride: true`.
- **Skeletal `packages/server`**: Created early with minimal types to ensure `pnpm -r typecheck` and `pnpm -r build` run cleanly across the workspace without special exclusions.

### 2. TypeScript Pin Re-Verification & Peer Dependency Proof
- `typescript` dist-tags on npm indicate `latest: 7.0.2`.
- However, `npm view typescript-eslint@8.71.2 peerDependencies` declares:
  ```json
  {
    "eslint": "^8.57.0 || ^9.0.0 || ^10.0.0",
    "typescript": ">=4.8.4 <6.1.0"
  }
  ```
- Because `typescript-eslint` strictly caps TypeScript support at `<6.1.0`, upgrading to TypeScript 7.0 breaks ESLint tooling.
- Therefore, TypeScript `5.8.2` is retained and pinned as the latest compatible release within the `<6.1.0` constraint.

### 3. E2E Test Behavior & Renderer Audit
- In headless Playwright, both Chromium and Firefox ran under the **WebGL2 (Fallback)** backend because headless shells without hardware GPU access report no WebGPU adapter.
- `smoke.spec.ts` was edited after the first run for two reasons:
  1. CSS `.badge` has `text-transform: uppercase`, rendering DOM text as `"WEBGL2 (FALLBACK)"`. The regex `/WebGPU|WebGL2/` failed on case sensitivity; updated to `/webgpu|webgl2/i`.
  2. Three.js r186 logged `THREE.Clock: This module has been deprecated`. Replaced with `performance.now()` delta timing to eliminate runtime warnings.

---

## ADR 005: Phase 1 Arena Geometry Reconciliations (Ramps, Risers, Slopes & Tunnel Clearance)

**Date**: 2026-10-14  
**Status**: Accepted

### 1. Context & Plan Comparison
`PLAN.md` §3 and the Phase 1 plan specified:
- Walkable slopes to test slope climbing.
- Staircase with ~0.2m risers to test autostep.
- Low-clearance tunnel (height 1.4m) requiring crouching to pass through.
- Slope blocking on inclines exceeding the controller's 45° climb limit.

### 2. Built Arena Implementation & Reconciliation
1. **Ramps & Slopes**:
   - **Walkable Shallow Ramp (North +Z)**: 20° slope ($0.3491\text{ rad}$), run 4.12m, height 1.5m, hypotenuse 4.385m. Fully walkable without jumping or sliding.
   - **Walkable Medium Ramp (South -Z)**: 35° slope ($0.6109\text{ rad}$), run 2.14m, height 1.5m, hypotenuse 2.615m. Fully walkable, validating slope ascension up to 35°.
   - **Steep Blocker Slope (West side of platform, Z = 2.0)**: 55° slope ($0.9599\text{ rad}$), run 1.05m, height 1.5m, hypotenuse 1.831m. Because 55° strictly exceeds the Rapier kinematic character controller's 45° climb limit (`setMaxSlopeClimbAngle(45 * Math.PI / 180)`), player movement is blocked and slides down.
2. **Staircase Risers**:
   - Built with 8 steps ascending to 1.5m elevated platform.
   - Riser height: $1.5 / 8 = 0.1875\text{m}$ (0.19m), with 0.4m tread depth.
   - Strictly matches the plan's ~0.2m riser target. Rapier `autostep(maxHeight = 0.35m, minWidth = 0.2m)` seamlessly autosteps every step without air state or stutter.
3. **Low-Clearance Tunnel**:
   - Span: $X = -10$, spanning $Z = -2.0$ to $+2.0$. Width 4.6m, depth 4.0m, ceiling clearance 1.4m (lintel from $Y = 1.4\text{m}$ to $2.4\text{m}$).
   - Standing capsule (height 1.8m) cannot fit under 1.4m ceiling and is physically blocked at entrance ($Z > 2.0$).
   - Crouching capsule (height 1.2m) passes smoothly under the 1.4m clearance.
   - Low-ceiling uncrouch blocking: Added `canStandUp(currentPos)` to `ICollisionWorld` using Rapier `world.intersectionWithShape(...)`. If a player attempts to uncrouch under the 1.4m ceiling, the query detects vertical obstruction and forces `isCrouching = true` until the player walks clear of the obstacle.

---

## ADR 006: TypeScript Pin Resolution to 6.0.3

**Date**: 2026-10-14  
**Status**: Accepted

### Context
User review observed that `typescript@5.8.2` was not the highest compatible version within the peer dependency range declared by `typescript-eslint@8.71.2` (`>=4.8.4 <6.1.0`).

### Decision & Evidence
1. Polled npm registry for all published TypeScript releases under `<6.1.0`.
2. Found that `typescript@6.0.3` is the latest stable release published under the `<6.1.0` upper bound (Apache-2.0 license).
3. Pinned `typescript: "6.0.3"` across the monorepo root and all workspace packages (`packages/client`, `packages/server`).
4. Ran `pnpm verify`: all packages typecheck cleanly (`tsc --noEmit`), lint cleanly, pass all Vitest tests, and build production artifacts with zero errors.

---

## ADR 007: Accumulator Spiral-of-Death Protection & Frame-Rate Independence

**Date**: 2026-10-14  
**Status**: Accepted

### Context
In fixed-timestep loops, if a browser tab is suspended or suffers large frame delta spikes (e.g. 10s tab switch), an unbounded delta accumulator causes a "spiral of death" where the browser attempts hundreds of simulation ticks in a single frame, locking the main thread.

### Decision
1. Implemented pure `updateAccumulator(state, currentTimeMs, maxFrameDelta = 0.25, maxTicks = 8)` in `packages/shared/src/timestep.ts`.
2. Clamps `frameDelta` to `MAX_FRAME_DELTA = 0.25s` (250 ms).
3. Clamps `ticksToRun` to `MAX_TICKS_PER_FRAME = 8` ticks per render frame.
4. Added microsecond epsilon tolerance (`1e-6s`) to floor divisions to prevent floating-point rounding jitter across fractional framerates.
---

## ADR 008: Phase 3 First-Person Arms, Weapon Models & Animation Pipeline Options

**Date**: 2026-10-14  
**Status**: Proposed (Awaiting User Choice)

### Context & Goals
Phase 3 requires realistic first-person arms, 5 distinct realistic weapon models (Assault Rifle, Tactical Pistol, Rapid SMG, Combat Shotgun, Precision Sniper), realistic reload animations (tactical, empty, and shell-by-shell for shotgun), and procedural motion (sway, bob, recoil springs, ADS alignment).
Per PLAN.md §5 (Phase 3) and AGENTS.md Rule I & H, we must evaluate asset options (author in Blender, CC0/CC-BY packs, purchase, procedural fallback) across license, visual quality, rig compatibility, effort, and cost before writing Phase 3 code.

### Candidate Evaluations

| Option | License | Visual Quality & Realism | Rig Compatibility | Dev Effort | Financial Cost |
|---|---|---|---|---|---|
| **1. Author in Blender** | 100% Custom / Proprietary | Custom tailored, but high risk of amateur/stiff animation without motion capture | 100% custom bone hierarchy; full control | **Very High** (40–80 hours across 5 weapons × 10 clips = 50 animation clips) | $0 |
| **2. Permissive CC0 / CC-BY Packs** | CC0 or CC-BY 4.0 (attribution required) | Mixed. Weapons look good, but cohesive FP arms + full reload animations across 5 weapons are fragmented across disparate authors | **Poor**. Disjointed rigs; different bone counts, axis conventions, and missing mag/bolt bones require extensive retargeting | **High** (20–30 hours retargeting, baking, reconciling rigs) | $0 |
| **3. Commercial FPS Asset Pack (Fab / CGTrader)** | Commercial Game License (royalty-free in compiled game) | **AAA / Photorealistic**. High-detail PBR weapon models, textured tactical FP arms (gloves/sleeves), hand-keyed fluid reloads | **Excellent**. Unified arm rig shared across all weapons; standard bone hierarchy (`root`, `arm_l`, `hand_l`, `weapon_bone`, `mag_bone`, `bolt_bone`, `shell_bone`) | **Low to Moderate** (4–8 hours to optimize to glTF via `gltf-transform` meshopt + KTX2) | ~$30 – $80 (one-time purchase) |
| **4. Procedural Rig Layer + CC0 Static Weapons** | CC0 / Permissive | Realistic static weapon models; realistic recoil/sway springs; but reload animations are limited to procedural bone translation/rotation | **Clean & Simple**. Minimal bone rig (weapon body, magazine, slide, pump); driven by math | **Low to Moderate** (8–12 hours) | $0 |

### Recommendation
- **Primary Recommendation: Option 3 (Commercial Unified Pack)** if the user approves a ~$30–$60 asset purchase budget. This is the only path that reliably delivers true realism, professional finger dexterity, and authentic reload motion across all 5 weapons within budget.
- **Secondary / Zero-Cost Recommendation: Option 4 (Procedural Rig Layer + High-Quality CC0 Models)** if the project has a strict $0 budget. We load realistic PBR gun models and drive tactical reloads, recoil, sway, inspect, and shell insertions via frame-rate independent procedural springs and bone kinematics.

*Note: Per AGENTS.md Rule I, no Phase 3 code will be written until the user selects their preferred asset route.*

---

## ADR 009: Mathematical AABB Occlusion vs Production Rapier Physics Occlusion

**Date**: 2026-10-14  
**Status**: Accepted

### Context
Phase 2 carry-over review asked whether hitscan shots are blocked by walls, and whether wall occlusion is wired into the live game.

### Decision & Architecture Clarification
1. **Mathematical AABB Occlusion (`packages/shared/src/weapons/hitscan.ts`)**:
   - `rayIntersectsAABB(origin, dir, box, maxDistance)` and `testRayWithOcclusion(...)` are pure mathematical implementations using the standard slab method.
   - They have zero dependencies on Three.js, DOM, or WASM physics libraries.
   - **Current Status**: They are currently **unit-tested only** (`weapons.test.ts`), validating that intervening boxes occlude hitscan rays before hitting humanoid targets.
   - They are **NOT wired into client gameplay**: the client offline practice dummies currently query `testRayHitbox` directly because the live arena contains complex non-axis-aligned geometry (55° steep ramps, 20° shallow ramps, 8-riser stairs, tunnel lintels).
2. **Production World Occlusion Strategy (Phase 6)**:
   - Real world occlusion cannot use axis-aligned bounding boxes (AABBs) because competitive arena maps contain angled geometry, stair treads, and compound colliders.
   - In Phase 6 (Authoritative Multiplayer), authoritative world occlusion will be executed via Rapier 3D raycasting (`world.castRayAndGetNormal`) on both the client (for predicted bullet impact sparks/decals) and the server (for authoritative line-of-sight and hit confirmation).

---

## ADR 010: Phase 3 Asset-Swappable Animation Architecture ($0 Target, Two-Bone IK, Split Gun Meshes)

**Date**: 2026-10-14  
**Status**: Accepted (Option 4 selected by User)

### Context
Phase 3 requires an asset-swappable animation system linking weapon definitions to 3D visuals, keyframed clips (idle, draw, inspect, reload tactical/empty, fire), animation events, and first-person arm kinematics under a strict $0 budget (stylized-realistic, no photoreal claims).

### Options Considered
- **Option 1**: Custom Blender authoring (high time investment, difficult vertical slice turnaround).
- **Option 2 / 3**: Paid asset packs (rejected: project budget is $0; optional $1.50 CC-BY pack held in reserve).
- **Option 4**: Procedural + Data-Driven Keyframe Layer with Two-Bone Arm IK and modular split gun meshes (CC0, $0 budget).

### Decision
1. **Option 4 Selected**: Target is stylized-realistic at $0 budget.
2. **Asset Architecture**: Visual definition maps `weaponId` to mesh components (`body`, `mag`, `bolt`), socket offsets (`muzzle`, `ejectionPort`, `magRest`, `boltRest`), clip curves, and timed animation events (`mag_detach`, `mag_drop`, `mag_insert`, `bolt_pull`, `bolt_release`).
3. **Kinematics & Rigs**: Analytical 3D Two-Bone IK solver drives first-person arms (shoulder -> elbow -> wrist/hand) to follow weapon grip and reload keyframe targets with zero heap allocations per frame.
4. **Mesh Separation**: Gun meshes are structured with distinct body, magazine, and bolt nodes to allow physical magazine detaching/dropping and bolt reciprocation.
5. **Vertical Slice**: One weapon (Assault Rifle) implemented first, measured (tris, size, FPS), and reviewed before expanding to remaining weapons.

---

## ADR 011: Phase 3 Modular Weapons, Two-Bone IK Rigging, Contract Validation & Scope Overlay

**Date**: 2026-10-14  
**Status**: Accepted

### Context
Phase 3 requires viewmodels, rigging, and animation definitions across all 5 weapons (Assault Rifle, Tactical Pistol, Rapid SMG, Combat Shotgun, Precision Sniper) under a strict $0 budget, supporting discrete integer-tick simulation synchronization, weapon visual hot-swapping, shell-by-shell reloading with double-pump prevention, bolt cycling with anti-quickswitch persistence, and 2D optical scope overlay.

### Architectural Decisions
1. **Modular 3D Procedural Mesh Hierarchies**:
   - Each weapon model (`pistol.ts`, `smg.ts`, `assaultRifle.ts`, `shotgun.ts`, `sniper.ts`) exports modular components (`body`, `mag`, `bolt`, `pump`, `shell`) and standardized sockets (`gripR`, `gripL`, `muzzle`, `ejectionPort`, `magWell`).
   - Triangle budgets strictly respected: Pistol (96 tris), Shotgun (244 tris), SMG (268 tris), Sniper (390 tris), Assault Rifle (492 tris) — well beneath the 10,000-triangle viewmodel hard budget.
2. **Analytical Two-Bone Arm IK Solver**:
   - Closed-form trigonometric solver (`twoBoneIk.ts`) resolves upper arm, forearm, and wrist transforms for left and right arms to track weapon grips and dynamic reload targets.
   - Zero per-frame memory allocations: reuses pre-allocated scratch vectors and quaternions.
3. **`WeaponVisualDef` Contract Interface & Automated Validator**:
   - `validateWeaponVisualDef(def)` enforces schema integrity across mesh nodes, socket definitions, clip keyframes, duration matching against simulation specs, and event boundaries.
   - Verified via automated unit tests in `visualDef.test.ts`.
4. **Simulation-Animation Synchronization**:
   - Server/shared simulation owns authoritative integer ticks: shotgun 3-phase shell reload (start/insert/end with commit at tick 20), sniper 80-tick bolt cycle, mid-reload commit ticks (tick 72 for AR), and anti-quickswitch `nextReadyTick` tracking across slot changes.
   - Fire interrupts during shotgun reload immediately transition to idle without double-pumping.
   - Input buffering (6 ticks) ensures responsive fire triggers when actions complete.
5. **High-Power Optical 2D Sniper Scope Overlay**:
   - Full-viewport SVG overlay (`#sniper-scope`) with 4.0X magnification (`adsFovMultiplier: 0.25`), radial vignette shading, mil-dots, elevation stadia, and range markings.
   - 3D viewmodel arms and chassis are cleanly culled during sniper ADS to prevent internal clipping.

---

## ADR 012: Shotgun Reload Timing Specification, Integer-Tick Alignment & Double-Pump Elimination

**Date**: 2026-10-15  
**Status**: Accepted

### Context
The initial conceptual spec for the Combat Shotgun proposed a shell reload sequence of:
$0.75\text{s start} + (6 \times 0.55\text{s insert}) + 0.65\text{s end} = 4.70\text{s full reload}$.
However, converting floating-point seconds directly into a 60 Hz discrete fixed-timestep simulation created non-integer tick durations:
- $0.75\text{s} = 45\text{ ticks}$
- $0.55\text{s} = 33.333\dots\text{ ticks}$ (fractional tick, violating integer-tick determinism)
- $0.65\text{s} = 39\text{ ticks}$
Additionally, a 4.70s reload in a fast-paced 2v2 tactical arena created sluggish downtime, and naive implementation caused a redundant "double-pump" where racking the slide during reload_end was immediately followed by racking the slide on the subsequent shot.

### Decision
1. **Discrete Integer-Tick Timing Specification**:
   - `startTicks`: $24\text{ ticks}$ ($0.400\text{s}$) — Bring weapon up and open loading gate.
   - `insertTicks`: $32\text{ ticks}$ ($\approx 0.533\text{s}$) — Fluid shell push into magazine tube ($32\text{ ticks}$ at $60\text{ Hz}$ is cleanly integer-clean).
   - `commitTick`: $20\text{ ticks}$ into each insert ($0.333\text{s}$) — Shell latches into magazine tube; ammo is credited here.
   - `endTicks`: $24\text{ ticks}$ ($0.400\text{s}$) — Close loading gate and rack pump slide.
   - `pumpCloseTick`: $12\text{ ticks}$ into end phase — Loading gate closed; pump cycle begins.
2. **Total Durations**:
   - Full empty-to-full reload ($6\text{ shells}$): $24 + (6 \times 32) + 24 = 240\text{ ticks} = 4.000\text{ seconds}$ (reduced from $4.70\text{s}$).
   - Interrupted reload on last shell commit: $24 + (5 \times 32) + 20 = 204\text{ ticks} = 3.400\text{ seconds}$.
3. **Double-Pump Elimination**:
   - When the player presses fire during shell reloading, if $ammoInMag > 0$, the state machine immediately aborts `reloading_shell_insert` or `reloading_shell_start` directly to `'idle'`, skipping the `reloading_shell_end` phase.
   - This eliminates the redundant double-pump artifact, allowing the player to fire immediately on the next tick without duplicate racking animations.
   - If $ammoInMag == 0$, fire interrupt is rejected to prevent firing an empty weapon.
4. **Verification**:
   - Enforced by automated unit tests in `packages/shared/src/weapons/weapons.test.ts` and clip duration verification in `packages/client/src/animation/validateVisualDef.ts`.

---

## ADR 013: Strict Adherence to PLAN.md Phase Sequencing & Third-Person Architecture Scope

**Date**: 2026-10-15  
**Status**: Accepted

### Context
In previous session reporting, a proposal labeled Phase 4 as "Audio & Hit Feedback". However, `PLAN.md` §5 explicitly defines the architectural phase sequence:
- **Phase 3**: Animation pipeline & viewmodels
- **Phase 4**: Grenades & VFX (frags, flashbangs, smokes, Rapier bouncing physics, pooled particle sparks/smoke, impact decals)
- **Phase 5**: Maps & art pass
- **Phase 6**: Authoritative multiplayer (Colyseus, state sync, lag compensation)
- **Phase 7**: Modes, bots, minimap, HUD, match flow
- **Phase 8**: Audio & polish (spatial Web Audio, footsteps, weapon reports, hit/kill sounds)

Prematurely shifting audio into Phase 4 violates `PLAN.md` phase gates and dependencies (audio spatialization depends on physical map geometry and full grenade detonation timing from Phase 4 & 5).

Furthermore, `PLAN.md` Phase 3 includes third-person character deliverables: upper/lower body layering, aim offset, death animation, foot-sliding check, and 4 characters at 60 FPS.

### Decisions
1. **Phase Ordering Reversion**:
   - The project strictly reverts to `PLAN.md`: **Phase 4 is Grenades & VFX**. Audio is deferred to **Phase 8 (Audio & Polish)** as planned.
   - Any hit feedback in Phase 4 is strictly visual VFX (bullet impact sparks, dust, bloodless rating-friendly impact flashes, screen shake).
2. **Third-Person Humanoid Scope & Boundary**:
   - **Implemented in Phase 3**:
     - Third-person humanoid character representation with separated torso, head, and articulated limbs for target dummies and combatants.
     - Upper/lower body layering: lower body drives cyclical locomotion animation while upper body applies pitch `aimOffset` to track look angles.
     - Directional death animation / collapse: when a character's health drops to 0, it smoothly transitions into a falling collapse onto the ground plane.
     - Foot-sliding check: stride animation rate synchronized with ground velocity ($\omega = v / r$).
     - 4-character 60 FPS benchmark: local first-person viewmodel + 3 animated third-person combatants running concurrently in the live arena.
   - **Deferred to Phase 6 & Phase 7**:
     - Remote entity state serialization, packet compression, jitter buffering, and remote interpolation delay (~100 ms) are deferred to **Phase 6 (Authoritative Multiplayer)** where Colyseus rooms and schemas are constructed.
     - Bot pathfinding, sight cones, and behavioral decision trees driving third-person inputs are deferred to **Phase 7 (Modes & Bots)** where Recast navmesh is integrated.




---

## ADR 014: Rigid Hand-to-Gun Attachment Architecture & Analytical Two-Bone IK Solver

**Date**: 2026-10-15  
**Status**: Accepted

### Context
Prior viewmodel hand attachments suffered from visible kinematic failures during fast mouse sweeps and reload sequences:
1. **Twist Compounding & History Dependence**: The IK solver started each frame from the previous frame's solved orientation rather than resetting to the bind pose, causing roll twist to accumulate across rapid mouse sweeps.
2. **Elbow Sky-Flipping**: Absence of downward/lateral pole targets and use of unconstrained unit-vector rotations caused the solver to place elbows pointing straight upward into the sky.
3. **Claw Hands**: The SkinnedMesh rest pose had open splayed hands, and wrist IK alone left fingers uncurled.
4. **Stale Transform Evaluation Order**: animator.update() was invoked before viewmodel recoil springs and ADS positions updated group.matrixWorld, causing hands to solve to stale 1-frame-old world positions.

### Decisions
1. **Analytical Two-Bone Closed-Form IK Solver (TwoBoneIKSolver)**:
   - Replaced iterative/CCD approaches with a high-performance, deterministic two-bone analytic solver using the law of cosines.
   - Evaluates elbow position directly via law of cosines:
     $$c^2 = l_1^2 + l_2^2 - 2 l_1 l_2 cos(eta)$$
   - Enforces a dedicated low and outward pole target vector ($X = pm 0.35, Y = -0.65, Z = 0.05$ in viewmodel group space), ensuring elbows bend downward and outward naturally.
   - Constructs orthonormal orientation basis matrices where $+Y$ aligns with bone direction and $+Z$ aligns with the bend plane normal, guaranteeing exact bend direction with zero roll-twist ambiguity.
   - Hard sanity clamp ensures the elbow position never flips above the shoulder.
2. **Weapon-Local Sockets**:
   - Each WeaponVisualDef defines weapon-local sockets: grip_R (trigger hand), grip_L (foregrip / pump / mag well), plus orientation offsets.
   - Sockets are instantiated as child Object3Ds of weaponGroup. Because sockets are direct scene-graph children of the weapon, they automatically inherit weapon sway, bob, procedural recoil kick, ADS alignment, and reload transforms without lag or frame-delay drift.
3. **Pristine Per-Frame Execution Pipeline**:
   - Execution order is strictly enforced every frame:
     1. resetToBindPose(): Restores all 52 bones of the arms rig to pristine author bind pose transforms, preventing any historical twist accumulation.
     2. applyFingerGrips(): Applies natural cylindrical grasp quaternions from author grab.R and grab.L keyframes to all 20 finger bones (eliminating claws).
     3. Apply weapon root positioning (sway, procedural recoil spring, ADS lerp).
     4. group.updateMatrixWorld(true): Forces fresh world matrix propagation across the entire hierarchy.
     5. updateIK(): Reads world transforms from socketL and socketR and solves analytical IK for arms.
     6. Render.
4. **Zero Per-Frame Allocation Guarantee**:
   - All scratch vectors (dir, poleDir, planeNormal, bendDir, elbowPos), quaternions, and basis matrices are preallocated as solver instance properties. Zero bytes of heap memory are allocated in the 60 FPS per-frame hot path.
5. **Reload Sockets**:
   - During tactical and empty reloads, support hands follow socket-space waypoints (e.g. foregrip -> mag well -> foregrip for rifles; foregrip -> loading port -> pump slide for shotguns).

### Verification
- **Fast Mouse Sweep Test (300 frames @ 60 Hz across +/-75 deg yaw and +/-60 deg pitch)**:
  - Max Right Wrist-to-Socket Distance: 0.0055 cm (Budget: < 1.0 cm).
  - Max Left Wrist-to-Socket Distance: 0.0036 cm (Budget: < 1.0 cm).
  - Elbow Sky-Flip Violations: 0.
  - Has NaN/Inf: false.
- **History Independence**: Max bone orientation deviation after returning to start pose: 0.0000 rad (< 1e-7).
- **Browser Visual Verification**: 8 real-Chrome screenshots captured for AK-47 and 8 screenshots for Combat Shotgun.

---

## ADR 015: Fully Rigid Viewmodel Rigging, Weapon-Local Arm Keyframing & Zero-IK Reload Architecture

**Date**: 2026-10-16  
**Status**: Accepted

### Context
Phase 3 viewmodel rigging required strict adherence to authentic game animation principles:
1. **Bone Rigidity**: Bone scaling (`mesh.scale.set(1,1,1)`) must remain strictly $(1,1,1)$ with zero bone elongation and zero elbow joint separation across all motion states. Original bind pose lengths ($0.322236\text{ m}$ upper arm, $0.237276\text{ m}$ forearm) must be preserved within $\le 0.1\text{ mm}$.
2. **Authoring Hands in Weapon-Local Space**: Arms and weapons must function as a single keyframed system. Hands are authored in weapon-local socket space, with runtime analytical IK serving only as a small residual corrector ($\le 2.0\text{ cm}$) during procedural recoil, sway, and weapon transitions.
3. **Zero IK During Reload Keyframes**: During active reload animations (`isReloading = true`), analytical IK is disabled for the left arm to prevent joint flipping, receiver penetration, or artificial locking. The left arm kinematically traces author magazine grasp, shell insertion, and bolt re-rack keyframes along the shoulder-to-wrist vector.
4. **First-Person View Visibility**: The left hand must remain prominently visible in first-person hip view across all 5 weapons without obstructing iron sights or optical scopes in ADS.

### Decisions
1. **Strict Bind-Pose Bone Length Invariant**:
   - Skinned mesh scale is locked to $(1,1,1)$ every frame.
   - Elbow and wrist joint positions in `updateSkinnedIK` enforce exact Euclidean segment lengths ($L_1 = 0.322236\text{ m}$, $L_2 = 0.237276\text{ m}$) via unit-vector projection from parent joints.
2. **Weapon-Local Socket Offsets**:
   - `draw` and `holster` keyframes are anchored to each weapon's rest sockets (`leftHandguardRest`, `leftSupportRest`, `leftForegripRest`, `leftPumpRest`, `leftForendRest`, `rightGripRest`) rather than world-space offsets, keeping target reach within natural human anatomical limits ($< 0.559\text{ m}$).
3. **Zero-IK Reload Flagging**:
   - `WeaponAnimator` exposes `isReloading = true` when playing `reloadTactical`, `reloadEmpty`, `reloadShellStart`, `reloadShellInsert`, or `reloadShellEnd`.
   - `armsRig.updateSkinnedIK()` leaves the left arm in pure authored keyframe space during reload ticks, eliminating receiver clipping and elbow inversion.
4. **Precision Sculpted Finger Grips**:
   - All 5 weapons use distinct, tailored finger grip quaternion tables in `packages/client/src/animation/fingerGripPoses.ts` (`AK_GRIP_*`, `PISTOL_GRIP_*`, `SMG_GRIP_*`, `SHOTGUN_GRIP_*`, `SNIPER_GRIP_*`, `MAGAZINE_GRASP_LEFT`, `BOLT_HOOK_RIGHT`), eliminating open-claw hands.

### Verification
- **Automated Motion Test Suite (`scripts/test-phase3-motion.mjs`)**:
  - Sampled 120–300 frames across 8 motion conditions (`sway`, `recoil`, `sprint`, `crouch`, `jump_landing`, `weapon_swap`, `inspect`, `full_auto`):
    - Upper Arm Length Error: $\le 0.0003\text{ mm}$ (budget $\le 0.1\text{ mm}$)
    - Forearm Length Error: $\le 0.0001\text{ mm}$ (budget $\le 0.1\text{ mm}$)
    - Bone Scale Deviation: $1.1921 \times 10^{-7}$ (budget $\le 1 \times 10^{-5}$)
    - Elbow Joint Separation: $0\text{ mm}$ (budget $0\text{ mm}$)
    - Max Residual Palm-Socket IK: $0.9066\text{ cm}$ (budget $\le 2.0\text{ cm}$)
    - NaN / Inf checks: clean (`false`).
- **Playwright Multi-Browser E2E Suite**: 70/70 passing across Chromium and Firefox.
- **Evidence Screenshots**: 25 first-person screenshots (5 weapons $\times$ 5 poses) captured with synchronized HUD action state text in `docs/screenshots/phase3/`.

---

## ADR 016: Tactical Pistol Visual Defect Correction & ADS Bore-Sight Alignment

**Date**: 2026-10-16  
**Status**: Accepted

### Context
During Phase 3 visual acceptance review, the first-person view of the Tactical Pistol exhibited severe visual defects:
1. Fingers appeared disproportionately large and formed bloated, oversized blocks obscuring the pistol slide and frame.
2. In ADS view, the player looked over the top of the slide, and the optical bore-sight was misaligned by $24.4\text{ mm}$ below the center of the screen.

### Root Cause Analysis
1. **Pitch Inversion (Primary Defect)**: In `pistolDef.ts` and `pistolSlice.ts`, socket rotations were defined with positive Euler X angles (`rightGripRest: Euler(1.12, 0.14, -0.32)` and `leftSupportRest: Euler(0.65, 0.30, -0.32)`). Because Euler X was $+1.12\text{ rad}$ ($+64^\circ$) instead of negative ($-\pi/2 \approx -1.74\text{ rad}$ in `'YXZ'`), the hand bone hierarchy was rotated upside down in pitch:
   - Pinky knuckles were pitched upward to $Y = +24.9\text{ mm}$ (higher than the rear sight notch at $Y = +20.69\text{ mm}$).
   - The knuckles were thrust directly toward the camera lens at $Z \approx -20\text{ cm}$, creating severe perspective foreshortening that made the fingers appear as giant, bloated blocks.
2. **Z-Socket Dislocation**: The pistol grip backstrap sits between $Z = +60\text{ mm}$ and $+116\text{ mm}$. The original socket had $Z = +0.038\text{ m}$ ($38\text{ mm}$), placing the hand forward into the trigger guard.
3. **ADS Bore-Sight Misalignment**: In `viewmodel.ts`, `weaponOffsets.pistol.ads` was $(0.0, -0.045, -0.28)$. The rear sight notch and front sight post sit at $Y = +0.0206\text{ m}$. Setting $Y = -0.045$ placed the sightline $24.4\text{ mm}$ below the optical center.

### Decisions
1. **Calibrated Sockets in `pistolDef.ts` and `pistolSlice.ts`**:
   - `rightGripRest`: `pos: Vector3(0.012, -0.040, 0.082)`, `rot: Euler(-1.74, 0.08, -0.12, 'YXZ')`.
   - `leftSupportRest`: `pos: Vector3(-0.014, -0.044, 0.076)`, `rot: Euler(-1.68, -0.10, 0.12, 'YXZ')`.
2. **Calibrated Viewmodel Offsets in `viewmodel.ts`**:
   - `weaponOffsets.pistol.hip`: `Vector3(0.12, -0.14, -0.32)` (lowered ready position with clean framing).
   - `weaponOffsets.pistol.ads`: `Vector3(0.0, -0.0206, -0.34)` (dead-center iron sight alignment with front dot and rear notch at $(0.0000, \pm 0.0001)$ optical axis).
3. **Dedicated In-Engine Verification Harness**:
   - `scripts/capture-pistol-screenshots.mjs` updated to verify 7 specific conditions: hip framing, ADS bore alignment, right hand high beavertail / indexed finger contact, left palm / support finger contact with $18.93\text{ mm}$ slide clearance, tactical reload mid-stroke, post-reload return to hip pose, and empty reload slide lock & release.

### Verification
- **Sight Picture Alignment**: Rear notch at $(0.0000, +0.0001, -0.2585)$, front sight post at $(0.0000, -0.0001, -0.4257)$ — aligned to $< 0.1\text{ mm}$.
- **Empirical Clearance**: Left thumb slide clearance is $18.93\text{ mm}$ ($> 5.0\text{ mm}$ requirement); maximum finger joint height is $-3.89\text{ mm}$ ($> 8.8\text{ mm}$ below slide rail at $+5.0\text{ mm}$).
- **Rigid Motion Suite (`scripts/test-phase3-motion.mjs`)**: 8/8 tests passed with 100% rigidity and 0 mm elbow separation.
- **Verification Suite**: `pnpm verify` (0 lint/typecheck errors, 104 vitest passed, bundle built) and `pnpm test:e2e` (70/70 Playwright tests passed across Chromium and Firefox).

---

## ADR 017: Tactical Pistol Forearm Silhouette Separation, Slide Geometry World Baking, and Headless 60 FPS Profiling

**Date**: 2026-10-16  
**Status**: Accepted

### Context
During Phase 3 gate review for the Tactical Pistol, review identified that the ADS screenshot exhibited a bulky, overlapping forearm/hand silhouette around the weapon, and the diagnostic overlay appeared to display ~3 FPS. Acceptance was paused to diagnose and resolve the true underlying causes.

### Root Cause Analysis
1. **IK Pole Target Polarity Inversion in `armsRig.ts`**:
   - In the Drillimpact arms skeleton coordinate frame, `shoulderR` is at $X = -0.197\text{ m}$ (negative X) and `shoulderL` is at $X = +0.197\text{ m}$ (positive X).
   - In `FirstPersonArmsRig.updateIK`, `poleWorldR` had positive X ($+0.35$) and `poleWorldL` had negative X ($-0.35$).
   - This pulled both elbows inwards across the player's chest towards each other, collapsing the inter-elbow separation down to $189\text{ mm}$ and causing the forearm sleeve meshes to converge into an unnatural, bulky volume directly beneath the pistol.
2. **Slide Mesh Geometry Unparenting Displacement in `pistolSlice.ts`**:
   - In raw `pistol.glb`, the slide (`pewhaut`) was a child of `pew` with local offset $(-0.0114, 0.0336, 0.0002)$.
   - When detaching the slide to enable reciprocating cycling, `slide.parent.remove(slide)` was called *before* baking the parent transform.
   - When recentered and placed at `slideRestPos`, the slide geometry was displaced downwards by $48.7\text{ mm}$ right into the polymer grip and hands, making the slide indistinguishable from the frame and forcing the hands to intersect with the reciprocating slide.
3. **Left Hand Socket Proximity**:
   - In `pistolDef.ts` and `pistolSlice.ts`, `leftSupportRest` had $X = -0.014\text{ m}$ (only $14\text{ mm}$ from center), cramping the left wrist within $15.9\text{ mm}$ of the right wrist.
4. **ADS Reach Distance**:
   - `weaponOffsets.pistol.ads` at $Z = -0.34\text{ m}$ held the pistol $22\text{ cm}$ from the camera lens, cramping elbows upwards.
5. **Apparent ~3 FPS Overlay Diagnosis**:
   - Default Playwright headless Chromium throttles background and occluded windows, reducing timer resolutions and throttling `requestAnimationFrame` down to $\sim 2.94\text{ FPS}$ (339.77 ms frame time).
   - Benchmarking with `--enable-gpu --use-gl=angle --use-angle=d3d11 --ignore-gpu-blocklist --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --no-sandbox` measured **60.08 FPS** (16.64 ms frame time, 0 errors).
   - Real headed Google Chrome (`chrome.exe`) measured **59.89 FPS** (16.70 ms frame time, 0 errors). There was zero simulation or rendering bottleneck in the engine.

### Decisions
1. **Corrected Pole Target Polarity in `armsRig.ts`**:
   - `poleWorldR.set(-0.45, -0.55, -0.15)` and `poleWorldL.set(0.45, -0.55, -0.15)`.
   - Inter-elbow separation expanded from $189\text{ mm}$ to $280\text{ mm}$, opening a clean visual gap between the forearms.
2. **Baked Parent Transforms in `pistolSlice.ts`**:
   - Baked `slide.matrixWorld` into `slideGeom` before unparenting, restoring the slide to its intended height ($Y \in [0.0342, 0.0694]$) on top of the polymer frame rails.
   - Rear notch and front post now sit crisply at $Y = 0.0694\text{ m}$.
3. **Calibrated Left Hand Socket & ADS Offset**:
   - `leftSupportRest`: `pos: Vector3(-0.032, -0.050, 0.075)`, `rot: Euler(-1.64, -0.16, 0.20, 'YXZ')`.
   - Wrist separation widened to $34.3\text{ mm}$, and arm-to-arm sleeve distance is strictly $\ge 3.86\text{ mm}$ (zero penetration).
   - `weaponOffsets.pistol.ads`: `Vector3(0.0, -0.0694, -0.44)` aligning iron sights dead-center with natural 44 cm isosceles arms reach.
4. **Rigorous Vertex-to-Triangle Contact Measurement Script**:
   - Implemented `scripts/measure-exact-geometry-contacts.mjs` computing point-to-triangle 3D Euclidean distances against the skinned mesh triangles:
     - Right Palm: $0.02\text{ mm}$
     - Right Index / Trigger: $1.05\text{ mm}$
     - Right Middle Wrap: $0.71\text{ mm}$
     - Right Thumb Frame Flat: $0.62\text{ mm}$
     - Left Palm Support: $0.73\text{ mm}$
     - Left Index Support: $0.02\text{ mm}$
     - Left Thumb Slide Clearance: $34.37\text{ mm}$ (Safe $> 5.0\text{ mm}$)
     - Right Thumb Slide Clearance: $23.99\text{ mm}$ (Safe $> 5.0\text{ mm}$)
     - Arm Sleeve Mesh Clearance: $3.86\text{ mm}$ (ZERO PENETRATION / CLEAR).

### Verification
- `pnpm verify`: 0 errors, 104 unit tests passed, production bundle built cleanly in 601ms.
- `scripts/test-phase3-motion.mjs`: 8/8 rigid motion tests passed with zero joint separation and bone length error $\le 0.0003\text{ mm}$.
- `pnpm test:e2e`: 70/70 Playwright tests passed across Chromium and Firefox.
- All 7 screenshots in `artifacts/` captured with `60 FPS` and `< 1.2 ms CPU` frame time on the diagnostic overlay.

---

## ADR 018: Reconciliation of Target Hold Poses with Empirical GLB Rig Measurements (Ratio-Scaled Targets, Zero Bone Stretch)

**Date**: 2026-10-16  
**Status**: Accepted

### Context
`HOLD_POSES.md` and `hold_poses.json` proposed conceptual hold pose targets companion to `weapon_hold_poses_collage.png`. The proposed targets assumed idealized bone lengths ($l_1 = 0.32\text{ m}, l_2 = 0.30\text{ m}$, total reach $0.62\text{ m}$) and a narrow shoulder span ($320\text{ mm}$). Per `HOLD_POSES.md` § Required reconciliation, the actual rig dimensions must be measured directly from `arms_rig.glb`, target positions scaled by the exact reach ratio $r$, bones strictly prevented from stretching, and final calibrated numbers recorded.

### Empirical GLB Rig Measurements

1. **Drillimpact Rig Dimensions (`packages/client/public/models/arms_rig.glb`)**:
   - Upper arm length ($l_1$, shoulder to elbow): **$0.322236\text{ m}$** ($322.24\text{ mm}$)
   - Forearm + wrist length ($l_2$, elbow to wrist): **$0.237276\text{ m}$** ($237.28\text{ mm}$)
   - Total maximum reach ($l_1 + l_2$): **$0.559512\text{ m}$** ($559.51\text{ mm}$)
   - Right Shoulder ($S_R$ in camera space): $[-0.1970, -0.1491, -0.0267]\text{ m}$
   - Left Shoulder ($S_L$ in camera space): $[+0.1970, -0.1491, -0.0267]\text{ m}$
   - Shoulder Span: **$0.3940\text{ m}$** ($394.0\text{ mm}$)
   - IK Outward Pole Targets (camera space): $P_R = [-0.45, -0.55, -0.15]\text{ m}$, $P_L = [+0.45, -0.55, -0.15]\text{ m}$
   - Palm Offset Compensation: $\mathbf{o}_{\text{palm}, R} = (+0.00506, +0.03924, +0.00018)\text{ m}$, $\mathbf{o}_{\text{palm}, L} = (-0.00506, +0.03924, +0.00018)\text{ m}$

2. **Reconciliation Reach Scale Ratio**:
   $$r = \frac{\text{Actual Reach}}{\text{Proposed Reach}} = \frac{0.559512\text{ m}}{0.620000\text{ m}} \approx \mathbf{0.902439}$$

3. **Weapon Model Bounding Dimensions (from GLBs)**:
   - **Assault Rifle (AK-47)**: $0.119\text{ m} \times 0.287\text{ m} \times 0.880\text{ m}$
   - **Tactical Pistol**: $0.052\text{ m} \times 0.169\text{ m} \times 0.234\text{ m}$
   - **Rapid SMG**: $0.068\text{ m} \times 0.235\text{ m} \times 0.518\text{ m}$
   - **Combat Shotgun**: $0.054\text{ m} \times 0.157\text{ m} \times 0.942\text{ m}$
   - **Precision Sniper**: $0.098\text{ m} \times 0.260\text{ m} \times 1.206\text{ m}$

### Calibrated First-Person Hold Configurations

| Weapon | Hip Offset (m) | ADS Offset (m) | Right Grip Socket (Gun-Local) | Left Support Socket (Gun-Local) |
|---|---|---|---|---|
| **Assault Rifle** (`assault_rifle`) | $(0.13, -0.16, -0.28)$ | $(0.0, -0.085, -0.22)$ | $(0.0, -0.065, +0.045)$ | $(-0.042, -0.045, -0.140)$ |
| **Tactical Pistol** (`pistol`) | $(0.06, -0.16, -0.42)$ | $(0.0, -0.0694, -0.44)$ | $(+0.012, -0.040, +0.082)$ | $(-0.032, -0.050, +0.075)$ |
| **Rapid SMG** (`smg`) | $(0.12, -0.15, -0.28)$ | $(0.0, -0.072, -0.22)$ | $(0.0, -0.055, +0.035)$ | $(-0.035, -0.030, -0.150)$ |
| **Combat Shotgun** (`shotgun`) | $(0.14, -0.16, -0.32)$ | $(0.0, -0.062, -0.24)$ | $(0.0, -0.050, +0.060)$ | $(-0.025, -0.035, -0.220)$ |
| **Precision Sniper** (`sniper`) | $(0.13, -0.16, -0.28)$ | $(0.0, -0.090, -0.26)$ | $(0.0, -0.045, +0.085)$ | $(-0.042, -0.048, -0.100)$ |

### Acceptance Test Suite Verification Results (`scripts/test-hold-poses-acceptance.mjs`)

| Weapon | Wrist Camera R (m) | Wrist Camera L (m) | Reach R (55-95%) | Reach L (55-95%) | Elbow R (60-150°) | Elbow L (60-150°) | Elbow Downward | Forearm Twist | Palm Dist (mm) | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| **Assault Rifle** | $[0.1105, -0.2366, -0.2657]$ | $[0.0818, -0.2389, -0.4256]$ | **71.3%** | **75.9%** | **89.7°** | **97.6°** | True | $0.0^\circ$ | $0.00$ | **PASS** |
| **Tactical Pistol** | $[0.0654, -0.1937, -0.2995]$ | $[0.0347, -0.2075, -0.3061]$ | **68.1%** | **58.7%** | **84.4°** | **70.0°** | True | $0.0^\circ$ | $0.00$ | **PASS** |
| **Rapid SMG** | $[0.1020, -0.2321, -0.2858]$ | $[0.0734, -0.2333, -0.3783]$ | **72.3%** | **68.3%** | **91.2°** | **84.7°** | True | $0.0^\circ$ | $0.00$ | **PASS** |
| **Combat Shotgun** | $[0.1204, -0.2208, -0.2705]$ | $[0.0934, -0.2467, -0.4764]$ | **72.7%** | **84.3%** | **91.9°** | **114.0°** | True | $0.0^\circ$ | $0.00$ | **PASS** |
| **Precision Sniper** | $[0.1137, -0.2233, -0.2261]$ | $[0.0834, -0.2468, -0.3864]$ | **67.3%** | **69.6%** | **83.1°** | **86.9°** | True | $0.0^\circ$ | $0.00$ | **PASS** |

### Dynamic Motion States Verification (8 States + 5s Full-Auto)

Across all 8 dynamic motion states plus continuous 5s full-auto firing:
- **Max Upper Arm Length Error**: $0.0003\text{ mm}$ (Budget: $\le 0.1\text{ mm}$) — **Strict Zero Stretch**
- **Max Forearm Length Error**: $0.0001\text{ mm}$ (Budget: $\le 0.1\text{ mm}$) — **Strict Zero Stretch**
- **Max Bone Scale Error**: $1.192\times 10^{-7}$ (Budget: $\le 10^{-5}$) — **Strict Rigid Uniform Scale**
- **Elbow Separation**: $0.00\text{ mm}$ (Rigid hierarchical parent-child joint)
- **Elbow Flip**: None (elbows strictly remain below shoulder across all states)
- **NaN / Infinity**: Zero occurrences across 1,000+ continuous evaluated simulation frames
- **History Independence**: Maximum bone quaternion angular deviation across 300 erratic disturbance frames is **$0.0000\times 10^{-8}\text{ rad}$** (Budget: $< 10^{-6}\text{ rad}$) — **Strictly History Independent**
- **First-Person Visual Evidence**: Screenshots captured for all 5 weapons in `docs/screenshots/hold_pose_<weapon>.png` confirming natural grip alignment, sleeve clearance, and camera sightlines.

---

## ADR 019: Phase 4 Deterministic Grenade Simulation, Instanced Decals & Pooled Combat VFX

**Date**: 2026-10-16  
**Status**: Accepted

### Context
Phase 4 requires a complete grenade system (Frag, Flash, Smoke) and combat visual effects (bullet impact decals, blast scorches, brass shell casing ejections, and screen trauma) adhering strictly to:
1. **Rule C (Architecture)**: Deterministic simulation in `packages/shared`, decoupled from DOM/Three.js/Rapier, driven by integer ticks.
2. **Rule D (Performance)**: Zero heap allocations in per-tick and per-frame hot paths, fixed ring buffer pools for decals and casing meshes.
3. **Rule B (Truthfulness & Verification)**: Verified under Playwright E2E and Vitest unit tests, with WebGL/WebGPU cross-browser rendering tests and visual screenshots in `docs/screenshots/phase4/`.

### Architectural Decisions

1. **Deterministic Shared Grenade Simulation (`packages/shared/src/grenades`)**:
   - `GrenadeSimState` tracks in-flight grenades and billowing smoke clouds.
   - Continuous collision detection (CCD) step: Subdivides trajectory when velocity $\times \Delta t$ exceeds grenade radius, testing collisions via `IGrenadeCollisionWorld.castSphere`.
   - On surface impact, velocity is reflected along contact normal:
     $$\mathbf{v}_{\text{reflected}} = \mathbf{v}_{\text{incident}} - (1 + e)(\mathbf{v}_{\text{incident}} \cdot \hat{\mathbf{n}})\hat{\mathbf{n}}$$
     with tangential friction $f$ applied to perpendicular components. Resting state triggers when velocity drops below $0.4\text{ m/s}$.
   - Determinism: Uses seedable integer-tick updates without `Math.random()` or DOM timestamps. Verified identical across 1,000 independent bounce trajectories.

2. **Detonation & Gameplay Effects**:
   - **Frag**: Quadratic damage falloff from 120 at point-blank to 15 at $7.0\text{ m}$, verifying line-of-sight via raycast from detonation origin to target torso.
   - **Flash**: Line-of-sight raycast plus view orientation dot product decay ($\theta = \arccos(\hat{\mathbf{d}} \cdot \hat{\mathbf{f}})$); applies up to 240 ticks (4.0s) blindness overlay.
   - **Smoke**: Spawns $5.5\text{ m}$ spherical occlusion cloud lasting 600 ticks (10.0s). `isLineBlockedBySmoke(p1, p2)` queries ray-sphere intersection for bullet LOS checks.

3. **Physics Bridge (`RapierGrenadeWorldAdapter`)**:
   - Translates `IGrenadeCollisionWorld` queries to Rapier 3D `world.castShape` and `world.castRay`.
   - Filters out `physics.playerBody` collider to avoid self-intersection when throwing from the eye position inside the player's 1.8m capsule.

4. **Zero-Allocation Instanced Rendering & Particle Pools**:
   - **DecalManager**: Instanced meshes with ring buffers for 128 bullet holes (0.08m) and 32 explosion blast scorch marks (4.5m). Uses `polygonOffset: true` (`factor: -1, units: -1`) to prevent Z-fighting on coplanar geometry. FIFO index cycling guarantees strictly zero runtime allocations.
   - **CombatVfxManager**: 32 pooled shell casing meshes with realistic tumbling kinematics, bouncing off floor colliders, and fading after 4 seconds. Instanced particle bursts for metal sparks, concrete dust, and wood splinters.
   - **Screen Shake (Camera Trauma)**: Non-linear trauma decay ($\text{shake} = \text{trauma}^2$) driven by multi-frequency sinusoidal harmonics (24 Hz, 32 Hz, 40 Hz) for realistic concussive punch without nausea.

### Acceptance & Verification Results
- **Vitest Unit Tests**: 11 unit tests in `packages/shared/src/grenades/grenades.test.ts` (115/115 test suite passing).
- **Playwright E2E**: 6/6 tests passing across Chromium and Firefox in `tests/e2e/grenades.spec.ts`.
- **Evidence**: 12 screenshots captured in `docs/screenshots/phase4/` validating throw arc, bounce, scorch decals, flash whiteout, smoke occlusion, and shell casing ejections.

---

## ADR 020: Phase 5 Modular Arena Maps (Warehouse, Plaza, Container Yard) & PBR Art Pipeline

**Date**: 2026-10-16  
**Status**: Accepted

### Context
Phase 5 requires three diverse competitive arena maps (Warehouse, Plaza, Container Yard) supporting 4-player tactical combat (2v2 TDM), verified collision proxy geometry in Rapier 3D, PBR materials, lighting presets, zero-leak hot-switching, and automated map validation.

### Architectural Decisions

1. **Deterministic Map Specifications in `packages/shared/src/maps/`**:
   - `Warehouse`: 40m × 40m tight indoor industrial layout with central elevated catwalk, cargo crate clusters, and two flanking lanes.
   - `Plaza`: 50m × 50m daylight Mediterranean courtyard featuring a central stone fountain/monument, classical perimeter colonnade, and raised West terrace.
   - `Container Yard`: 60m × 40m cargo terminal with multi-tier stacked shipping containers, narrow chokepoint alleys, and elevated crane catwalk sniper lane.
   - Symmetrical 4 team spawns per map (2 Alpha, 2 Bravo) with min spawn distance $\ge 25\text{ m}$.
   - Surface types (`concrete`, `metal`, `wood`, `stone`) driving both visual materials, bullet impact VFX, and footstep sound effects.

2. **Automated Validation & 2D Grid Reachability (`validation.ts`)**:
   - Validates spawn count ($\ge 4$), team distribution, perimeter wall clearance ($\ge 1\text{ m}$), and collision non-intersection.
   - 2D grid BFS flood fill verifying unobstructed floor connectivity between opposing team spawns, preventing player traps and impassable barriers.

3. **Client `MapLoader` & Procedural PBR Textures (`packages/client/src/maps/`)**:
   - Zero-external-network PBR materials using procedural canvas normal and noise textures (concrete, stone, corrugated steel, crate wood planks) keeping client bundle strictly under the 25 MB budget.
   - Rapier kinematic colliders generated for all static boxes and ramps.
   - Smooth stair ramp physics proxy: Renders individual visual steps while generating a single clean angled ramp collider, preventing jagged kinematic character controller collisions.
   - Lifecycle management (`unloadCurrentMap`): Disposes Three.js geometries, procedural textures, materials, and removes Rapier colliders and rigid bodies without leaks.

### Acceptance & Verification Results
- **Vitest Unit Tests**: 6/6 tests passing in `packages/shared/src/maps/maps.test.ts`.
- **Playwright E2E**: 8/8 tests passing in `tests/e2e/maps.spec.ts` across Chromium and Firefox.
- **Draw Calls**: **6 to 18 calls/frame** (Budget: $\le 250$).
- **Triangles**: **10,421 triangles** (Budget: $\le 120\text{k}$ Low / $\le 300\text{k}$ High).
- **Load Time**: 340ms to 1085ms (Budget: $\le 5,000\text{ms}$).
- **10x Load/Unload Leak Test**: PASSED (31 map transitions; initial bodies 25 == final bodies 25, initial colliders 26 == final colliders 26).
- **Visual Evidence**: 6 screenshots captured in `docs/screenshots/maps/` (first-person and top-down tactical overview for all 3 maps).





---

## ADR 021: Development-only Assault Rifle Hand Lab integration

**Date:** 2026-10-16  
**Status:** Verified and Accepted (Feature branch `phase3/assault-rifle-handlab-integration`)

### Context & Implementation
The standalone Hand Lab prototype used proxy hand geometries and a distinct local coordinate frame, so its proxy transforms could not be directly copied into the production engine. Instead:
1. Production AK-47 (`ak47.glb`) grip sockets and sculpted finger grasp poses (`arms_rig.glb`) were centralized in `packages/client/src/animation/hands/assault_rifle.handdef.ts`.
2. The Hand Lab overlay in `packages/client/src/debug/HandLabOverlay.ts` attaches directly to the production Three.js viewmodel (`WeaponViewmodel`), rendering through the active WebGL2 / WebGPU rendering pipeline.
3. The editor is gated behind `import.meta.env.DEV` and accessible via `http://localhost:5173/?handlab=1&forceWebGL=1`.
4. Event propagation (`pointerdown`/`mousedown`) is intercepted to prevent pointer lock disruption on the canvas.
5. All animation clip events and shared reload state machine calls are faithfully synchronized without duplicating ammo logic.

### Empirical Measurements & Verification
- **Bone Rig Lengths (Empirical from GLB):** Upper arm = $322.236\text{ mm}$, Forearm = $237.276\text{ mm}$ (Total span = $559.512\text{ mm}$).
- **Residual IK Wrist Error:** Right = $0.0002\text{ mm}$, Left = $0.0002\text{ mm}$ (budget $\le 10.0\text{ mm}$).
- **Reach & Elbow Angles:** Right Reach = 71.4% (Elbow 89.8°), Left Reach = 76.0% (Elbow 97.7°). Elbow downward vector: PASS.
- **Finite Transforms:** Zero NaN or Infinity across all simulation states.
- **Motion Rigidity & History Independence:** Quaternion angle deviation $4.2147 \times 10^{-8}\text{ rad}$ across full mouse sweeps.
- **Automated Test Results:**
  - `pnpm verify`: 100% passed (typecheck 0 errors, lint 0 errors, purity 5/5, vitest 124/124 tests, build clean in 416ms).
  - `pnpm test:e2e`: 84/84 tests passed across Chromium and Firefox.
- **Captured Visual Evidence:** 10 production screenshots (`01_hip.png` through `10_sprint_lower.png`) and `assault_rifle_handlab.webm` saved in `docs/hand_system/captures/assault_rifle/`.
