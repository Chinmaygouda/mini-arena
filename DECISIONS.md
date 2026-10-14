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
3. Shared package contains pure TS unit tests run via Vitest.
