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
