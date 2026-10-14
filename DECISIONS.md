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
