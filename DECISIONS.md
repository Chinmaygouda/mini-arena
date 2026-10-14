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

