# PROGRESS

## Current phase: 0 — Foundation   Status: gate review

## Done (with evidence)
- Monorepo initialized with pnpm workspaces, strict TypeScript, and Node v24.14.0 — `git log` commit `c1783b9`
- Pinned library matrix with verified MIT/Apache-2.0 licenses and raw npm view evidence — documented in `DECISIONS.md`
- Pure `packages/shared` package created with `lib: ["ES2022"]` (no DOM) and Vitest determinism unit tests — `pnpm test` (2 passed)
- ESLint flat configuration with strict purity rules blocking DOM, Three.js, and Colyseus imports in `shared` — `pnpm lint` (0 errors)
- `packages/client` dual WebGPU / WebGL2 fallback renderer implemented with `await renderer.init()` and dynamic `window.__renderer` exposure — verified
- Playwright E2E smoke tests covering Chromium and Firefox for both default load and `?forceWebGL` / `?forceWebGL=true` query parameters — `pnpm test:e2e` (6/6 tests passed in 15.7s)
- Unified verification pipeline `pnpm verify` (typecheck + lint + unit test + production build) passing cleanly across all workspace packages — `pnpm verify` (exit code 0)

## In progress
- Phase 0 Gate Review & sign-off

## Next 3 steps (Phase 1)
1. Implement pure player simulation `stepPlayer(state, input, dt)` in `packages/shared`
2. Integrate Rapier 3D kinematic capsule character controller in offline mode
3. Build greybox test arena with fixed-timestep physics loop and interpolated rendering

## Known bugs / risks
- None. WebGL2 fallback operates identically on both Chromium and Firefox.

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
| 2026-10-14 | Blank scene + test cube | Dev Machine (Chromium/Firefox) | 60 | 3 | 24 | Baseline Phase 0 pass |
