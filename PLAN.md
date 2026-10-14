# PLAN.md — Browser FPS (2v2 TDM, bots + online multiplayer)

Working title: **Mini Arena**. Small-arena tactical shooter, 4 players (2v2), no open world, no battle royale.

## 0. Honest scope statement (read first)
- "High graphics" in a browser = stylized-realistic PBR at 60 FPS on a mid laptop. It is NOT AAA. Visual quality is limited mostly by **art assets**, not code.
- Realistic weapon/reload animation needs authored clips. Free ones are scarce. Plan = **procedural layer (sway, bob, recoil springs) + clip-based reloads/inspect** made or sourced in Blender. See Phase 3.
- One engineer-agent can build this in ~10 gated phases. Each phase must run and be verified before the next starts.

## 1. Locked tech stack (verified by research Oct 2026; agent re-checks versions at install)
| Concern | Choice | Why |
|---|---|---|
| Language/build | TypeScript (strict), Vite, pnpm workspaces | Shared code client+server |
| Renderer | **Three.js** with `three/webgpu` WebGPURenderer, automatic WebGL2 fallback (r171+) | Largest ecosystem; WebGPU is the recommended renderer; support is high but not universal, so fallback is mandatory |
| Shaders | TSL (Three Shading Language) | Works on both backends |
| Post FX | Three built-in node post-processing: bloom, GTAO/SSAO, FXAA/TAA, tonemap | Quality tiers |
| Physics | **Rapier** (`@dimforge/rapier3d-compat`) WASM, KinematicCharacterController, raycast | Fast, deterministic-ish, runs in Node too |
| World raycast | `three-mesh-bvh` (client visuals/decals only; server uses Rapier) | |
| Multiplayer | **Colyseus 0.18+** (server `colyseus`, client `@colyseus/sdk`, `@colyseus/schema`) | Authoritative server, built-in client prediction + lag compensation (ColyStrike FPS demo exists) |
| Transport | WebSocket now; WebTransport only as later optional upgrade | Simplicity |
| Bots | Server-side AI with navmesh: `recast-navigation` (`@recast-navigation/core`, `/three`) | Bots are just server players with synthetic input |
| Animation | Three `AnimationMixer` + own small state machine; glTF clips; IK via `three` SkeletonUtils/ custom 2-bone IK for hands if needed | |
| Asset pipeline | Blender → glTF 2.0 → `@gltf-transform/cli` (meshopt, KTX2/Basis textures, dedupe) | Small, fast loads |
| Particles/VFX | Custom GPU/instanced particles (TSL) or `three.quarks`; decals via DecalGeometry/instanced quads | Muzzle flash, smoke, explosion, impacts |
| Audio | Web Audio (Howler.js or Three PositionalAudio) | 3D positional, pooled |
| UI/HUD | Plain HTML/CSS overlay + canvas minimap (no React in hot path) | Low overhead |
| Tests | Vitest (unit, sim determinism), Playwright (smoke + 4-client bot match) | |
| Debug | stats-gl / Spector, Rapier debug render, `?debug` panel (lil-gui) | |
| Hosting | Static client on Cloudflare Pages/Netlify; Colyseus on a small VPS or Colyseus Cloud | |

Free asset sources (check each license, log in `ASSETS.md`): Poly Haven (CC0 PBR textures/HDRIs), Quaternius & Kenney (CC0 models), Sketchfab (filter CC0/CC-BY), Mixamo (character animation; check current terms), freesound.org (filter CC0), Blender for authoring weapon/arm rigs. NOTE: not all of these were re-verified in this session; agent must confirm licenses before use.

## 2. Architecture
```
/packages
  /shared    deterministic sim: movement step, weapon rules, damage, constants, schemas, map data types (NO DOM/Three imports)
  /server    Colyseus rooms, tick loop, Rapier world, hit validation + lag comp, bots, match state machine
  /client    Three renderer, input, prediction, viewmodel, HUD, audio, menus
  /tools     map bake (navmesh, collision), asset optimize scripts
/assets      source + optimized (LFS)
```
Rules of the architecture: server is authoritative; `shared` step functions run identically on client (prediction) and server; client never decides damage/kills.

Netcode targets: server tick 60 Hz (30 acceptable fallback), state patch 20–30 Hz, remote interpolation ~100 ms, lag-comp rewind max 250 ms, input send each client tick, hitscan validated server-side; grenades are server-simulated projectiles (Rapier) with client visual prediction.

## 3. Game design (v1)
- Mode: **TDM 2v2**, first to 25 kills or 8 min. Humans and/or bots fill all 4 slots. Respawn 3 s, 2 s spawn protection, spawn points chosen away from enemies.
- Modes later (optional): Free-for-all 4, Practice (bots only, offline-local via local server in-process).
- Maps (3): small arenas, 2–3 lanes, verticality, ~60×60 m. Working names: *Warehouse*, *Rooftop Yard*, *Desert Compound*. Modular kit, baked lighting where possible.
- Weapons (v1): Pistol, SMG, Assault Rifle, Shotgun, Sniper. Each: damage, falloff, RPM, mag, reserve, reload times (tactical/empty), recoil pattern, spread (move/ADS/crouch), ADS time, headshot multiplier, equip time.
- Grenades: Frag (cook + throw, bounce), Flashbang, Smoke. 2 per life.
- HUD: crosshair (dynamic), health, ammo, grenade count, kill feed, scoreboard (Tab), **minimap** (top-down canvas, rotating, teammates always, enemies when spotted/firing), damage direction indicators, hit markers, match timer/score.
- Movement: walk, sprint, crouch, jump, slide optional (post v1), fall damage none. Stamina none.

## 4. Performance & quality budgets (hard gates)
- 60 FPS at 1080p on Intel Iris Xe-class laptop at "Low"; 60 FPS on discrete GPU at "High".
- Visible tris ≤ 300k (High) / 120k (Low); draw calls ≤ 250; no per-frame allocations in game loop (verify with performance profiler: GC pauses < 2 ms/s average).
- Initial load ≤ 25 MB transferred (map streamed on demand ≤ 15 MB each), time-to-menu ≤ 5 s on broadband.
- Server: 20 rooms × 4 players on 2 vCPU with tick time p99 < 8 ms @60 Hz.
- Input-to-photon locally < 50 ms; shots feel instant (muzzle flash/recoil predicted).
- Quality tiers: Low / Medium / High / Ultra auto-selected, user-overridable.

## 5. Phases (each ends with a GATE: demo + checklist + PROGRESS.md update)

### Phase 0 — Foundation
Deliver: monorepo, strict TS, ESLint/Prettier, Vitest, CI script (`pnpm verify` = typecheck+lint+test+build), blank WebGPU/WebGL2 canvas with FPS counter, `AGENT_RULES.md`, `PROGRESS.md`, `ASSETS.md`, `DECISIONS.md`.
Gate: `pnpm verify` green; app runs on Chrome + Firefox; WebGL2 fallback proven via `?forceWebGL`.

### Phase 1 — Player controller + greybox map (offline)
Deliver: pointer lock, mouse look (raw input, sensitivity setting), WASD, sprint, crouch, jump; Rapier kinematic capsule; fixed-timestep loop with render interpolation; grey-box arena. Movement code lives in `shared` as pure `stepPlayer(state, input, dt)`.
Gate: no jitter at 30/60/144 Hz displays (test by throttling), no wall sticking, slopes/stairs ok, unit tests for step determinism (same inputs → same state).

### Phase 2 — Weapon systems core (data-driven, offline vs dummies)
Deliver: weapon JSON schema + loader, fire modes, hitscan with spread/recoil patterns, ADS, ammo/reload state machine (equip, idle, fire, reload tactical/empty, swap), damage falloff + headshot hitboxes on dummy targets, tracer, hit markers. All rules in `shared`.
Gate: tests for fire-rate accuracy (RPM ±1%), reload state transitions, no ammo desync; each of 5 weapons selectable and tuned.

### Phase 3 — Animation pipeline & viewmodels (the "realistic" phase)
Deliver: first-person arms+weapon rig loader; clip set per weapon: idle, walk, sprint, fire, ADS in/out, reload (tactical/empty), equip, holster, inspect, grenade throw; **procedural layer**: weapon sway, movement bob, recoil springs, ADS blend, landing kick, sprint pose; animation state machine with cross-fades (0.1–0.2 s), animation events (mag out/in sounds, shell eject, muzzle flash) from clip markers; third-person character model with upper/lower body layering and aim offset; ragdoll-lite or death animation.
Asset reality check: decide at start of phase (DECISIONS.md) between (a) author clips in Blender, (b) sourced CC0/CC-BY packs, (c) procedural bone reload fallback. Document licenses.
Gate: 60 FPS with 4 characters; no foot sliding visible; reload cancel/swap mid-reload behaves correctly; slow-motion capture review of each weapon's reload.

### Phase 4 — Grenades & VFX
Deliver: frag/flash/smoke with cook timer, arc preview (optional), Rapier bouncing, fuse, explosion (damage falloff, LOS check), flash effect (screen whiteout + audio ringing, direction/LOS-based), smoke volume blocking visibility (visual + bot LOS), muzzle flash, shell casings (pooled), impact decals/sparks per material, blood-free hit effects (keep rating-friendly), screen shake, camera effects.
Gate: pooled objects, no GC spikes; explosion damage test cases (cover blocks damage).

### Phase 5 — Maps & art pass
Deliver: modular kit, 3 maps with spawns, cover, collision meshes (simplified), navmesh bake via `tools`, PBR materials (KTX2), HDRI/lighting, baked AO/lightmaps where feasible, post FX with quality tiers, loading screen, asset compression pipeline.
Gate: budgets in §4 met per map; no light leaks; navmesh covers all playable areas (automated reachability test between all spawns).

### Phase 6 — Authoritative multiplayer
Deliver: Colyseus room (`MatchRoom`), join by room code + quick match, schema state, input protocol with sequence numbers, server fixed tick runs `shared` movement + Rapier, client prediction + reconciliation (Colyseus 0.18 predict APIs; fall back to custom if unsuitable — record in DECISIONS.md), remote interpolation, server hitscan with lag compensation, server-simulated grenades, rate limiting and input validation, reconnect, `simulateLatency` test harness (0/50/100/200 ms, 5% loss).
Gate: 4 headless clients (Playwright/Node) play a full match; at 100 ms RTT local player has no visible rubber-banding; kills only registered by server; desync counter = 0 in 10-min soak.

### Phase 7 — Modes, bots, minimap, HUD, match flow
Deliver: TDM state machine (warmup → live → overtime → results), team assignment, scoreboard, kill feed, minimap, spawn logic, bots (navmesh pathing, vision cone + memory, cover-seeking, aim with human-like error/reaction time, difficulty levels, weapon choice, grenade use) controlled via same input interface as humans; fill empty slots with bots; menus (play, settings, loadout), settings (sensitivity, FOV, keybinds, graphics, audio).
Gate: 2 humans + 2 bots and 4 bots full matches complete without stuck bots (soak 30 matches); bot difficulty feels distinct.

### Phase 8 — Audio & polish
Deliver: spatial audio, per-surface footsteps, weapon sounds with distance/indoor reverb, hit/kill sounds, music minimal, accessibility (colorblind team colors, subtitles for key cues), mobile/gamepad explicitly out of scope unless requested, quality-tier auto-detect.
Gate: audio pooling without clicks; no audio leak on room leave.

### Phase 9 — Hardening & release
Deliver: profiling pass vs budgets, memory-leak test (10 matches, heap stable), basic anti-cheat (server authority, speed/fire-rate sanity, input validation), error reporting, CSP/headers, deployment scripts (client static + server), load test (20 rooms), README, license + credits screen.
Gate: all budgets pass; `pnpm verify` + e2e green on CI; cold-start playtest by a human.

## 6. Verification rule (applies to every phase)
Definition of Done = (1) code written, (2) `pnpm verify` green, (3) feature actually run in a browser and observed (screenshot/recording or Playwright assertion), (4) perf measured against budget, (5) PROGRESS.md updated with evidence, (6) no TODO left silently. "Looks right" without running ≠ done.

## 7. Top risks and mitigations
| Risk | Mitigation |
|---|---|
| Animation quality (no good free assets) | Procedural layer first; decide asset route at Phase 3 start; budget for purchased/commissioned pack |
| Desync / rubber-banding | Single shared `stepPlayer`; sequence-numbered inputs; latency harness from day 1 of Phase 6 |
| WebGPU variability across devices | Always keep WebGL2 fallback; test both every phase |
| Perf on low-end laptops | Budgets as gates; quality tiers; instancing; LODs; pooled VFX |
| Scope creep | Out of scope list below; new ideas go to BACKLOG.md |
| Library API drift | Pin versions; read installed `.d.ts`; never code from memory |

## 8. Out of scope (v1)
Battle royale, open world, mobile controls, voice chat, accounts/matchmaking ranking, in-app purchases, vehicles, destruction, custom map editor.
