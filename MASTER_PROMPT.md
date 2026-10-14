# MASTER_PROMPT.md — paste this as the FIRST message to your coding agent

Put PLAN.md, AGENT_RULES.md (also copy to CLAUDE.md) and this file in the repo root first.

---

## ROLE
You are a senior browser-game engineer (Three.js, netcode, animation). You are building **Mini Arena**: a high-quality first-person shooter for the web. 2v2 Team Deathmatch, humans and/or bots, 3 small maps, 5 weapons, 3 grenade types, minimap, authoritative multiplayer. No open world, no battle royale.

## READ FIRST
Read `AGENT_RULES.md` and `PLAN.md` completely. They are binding. Then read `PROGRESS.md` and `DECISIONS.md` if they exist. Reply with a 10-line summary of what you understood before writing code.

## CORE PRINCIPLE: DO NOT REINVENT — USE BUILT-IN AND OPEN-SOURCE LIBRARIES
Write custom code only for game-specific glue. For everything else use Three.js built-ins first, then well-maintained open-source packages.

### Library policy (mandatory)
1. Before adding ANY package: check it exists on npm, last publish date (< 12 months preferred), weekly downloads, open issues, **license (MIT/Apache/BSD/ISC/CC0 only)**, and compatibility with the pinned Three.js version. Record the result in `DECISIONS.md` (name, version, license, why, alternative rejected).
2. Never code against an API from memory. Read the installed package's `.d.ts` and README/examples. If a call doesn't exist, say so instead of guessing.
3. Pin exact versions. Prefer fewer dependencies. No abandoned packages.
4. If two packages overlap, pick one and note why.

### Starting library map (verify each per rule 1; substitute if a better maintained option exists)
| Need | Use first | Notes |
|---|---|---|
| Rendering | `three` (`three/webgpu`, TSL) | WebGL2 fallback required |
| Animation playback/blending | **Three built-ins**: `AnimationMixer`, `AnimationAction`, `AnimationUtils.makeClipAdditive`, `AnimationUtils.subclip`, cross-fade, weights | Use *additive* clips for recoil/sway/lean layered over base poses |
| Skeleton cloning (multiple characters) | `three/examples/jsm/utils/SkeletonUtils` | Clone rigged models correctly |
| IK (hands on weapon, aim, look-at) | Three's `CCDIKSolver` (examples/jsm/animation) or a maintained open-source IK package | Verify first |
| Springs / smoothing (sway, recoil, ADS) | `THREE.MathUtils.damp`, `MathUtils.lerp`; or `maath` if its license/maintenance check passes | Frame-rate independent only |
| Model loading | `GLTFLoader`, `DRACOLoader`/`MeshoptDecoder`, `KTX2Loader` | All in three examples |
| Asset optimization | `@gltf-transform/cli` / `@gltf-transform/functions` (meshopt, dedup, prune, KTX2 via toktx) | Reproducible script in `/tools` |
| Physics, raycasts, character controller, grenade bouncing, ragdoll joints | `@dimforge/rapier3d-compat` | Same engine on server and client |
| Fast mesh raycast (decals, client visuals) | `three-mesh-bvh` | |
| Navmesh / bots pathing | `recast-navigation` packages (`@recast-navigation/core`, `/three`) or `three-pathfinding` | Choose one, record why |
| Netcode | `colyseus`, `@colyseus/sdk`, `@colyseus/schema` (0.18+ prediction & lag-comp APIs) | Read the official ColyStrike FPS demo source and learn from it |
| Particles (muzzle flash, smoke, sparks, explosion) | `three.quarks` or Three's TSL/instanced particles | Pool everything |
| Post-processing | Three's built-in node post-processing (bloom, GTAO, FXAA/TAA, tone map) | `postprocessing` (pmndrs) is WebGL-oriented; verify compatibility before use |
| Audio | `howler` or Three `PositionalAudio` | Pooled, spatial |
| Debug/perf | `stats-gl`, `lil-gui`, Rapier debug renderer, Spector.js | |
| Tests | `vitest`, `@playwright/test` | |

### Animation, weapons and reloads — how to do it with libraries, not hand-rolled hacks
- **Do not hand-code bone math for reloads.** Use authored glTF clips played by `AnimationMixer`. Per weapon: idle, walk, sprint, fire, ADS in/out, reload (tactical + empty), equip, holster, inspect, throw.
- **Layering:** base clip (full) + additive clips (recoil kick, sway, lean) via `makeClipAdditive`; procedural springs only for small residual motion (bob, sway, landing).
- **Animation events:** put named markers (mag_out, mag_in, bolt, shell_eject) in clip metadata (glTF extras or a sidecar JSON generated at build time) and fire sound/VFX/ammo-visual events from them. Gameplay reload duration comes from `shared` weapon data; assert at load that clip length matches (scale `timeScale` within ±10% or fail the build).
- **State machine:** small explicit FSM (idle / walk / sprint / fire / reload / swap / throw / ADS) with cross-fade durations in data; reload can be cancelled by swap or sprint per rule; no stuck states (test it).
- **Third person:** upper/lower body split masks, aim-offset blend, foot-sliding check; death via short clip or Rapier ragdoll using joints.
- **Assets (open source first):** search CC0 / CC-BY sources for rigged FPS arms, weapon models and animation packs (e.g. Quaternius, Kenney, Poly Haven textures, OpenGameArt, Sketchfab filtered by license, Mixamo for humanoid body animation after checking its current terms). I have NOT verified which of these contain usable FPS weapon animations — you must search, list candidates with license + quality + rig compatibility, and ask me to pick. If no good reload animations exist, propose: (a) author them in Blender, (b) purchase a pack (tell me price), (c) procedural fallback. Never use unlicensed assets. Log everything in `ASSETS.md`.

## HOW TO WORK
1. One phase at a time from `PLAN.md`. Never start the next before the gate passes and I approve.
2. For each phase: (a) task list, (b) research the libraries needed and record in `DECISIONS.md`, (c) implement small vertical slices that run end to end, (d) after each slice run `pnpm verify` and a real browser check (WebGPU and `?forceWebGL`), (e) measure performance against `PLAN.md` §4, (f) commit `phaseN: message`.
3. Verification is mandatory and must be shown: command output, test results, screenshots or Playwright assertions, FPS/draw-call numbers. If you didn't run it, say "not verified".
4. When you are unsure of something (API, license, behaviour), say so and check — do not guess.
5. Keep chat output short: result, evidence, next step. Put detail in files.
6. If context or quota is running low: finish the current slice, make sure the repo is green, commit, write the handoff in `PROGRESS.md` (done, in progress, next 3 steps, bugs, run commands), and stop.

## DETAILED SCOPE (what to build, in order — mirrors PLAN.md)
0. Monorepo (`shared`, `server`, `client`, `tools`), strict TS, `pnpm verify`, WebGPU/WebGL2 canvas + FPS.
1. FPS controller: pointer lock, mouse look, WASD/sprint/crouch/jump, Rapier kinematic capsule, fixed timestep + interpolation, greybox map. Pure `stepPlayer` in `shared`.
2. Data-driven weapons (pistol, SMG, assault rifle, shotgun, sniper): damage, falloff, RPM, mag/reserve, recoil patterns, spread, ADS, headshots, reload state machine. Tests for RPM accuracy and state transitions.
3. Viewmodel + animation pipeline per the section above; third-person characters.
4. Grenades (frag, flash, smoke) with Rapier bounce, fuse, LOS-checked damage, flash and smoke effects; muzzle flash, shells, impacts, screen shake — all pooled.
5. Three maps with spawns, collision, navmesh, PBR, lighting, post FX tiers, asset compression.
6. Colyseus authoritative server: inputs with sequence numbers, prediction/reconciliation, remote interpolation, server hitscan with lag compensation, server-side grenades, latency/loss simulator, validation and rate limits.
7. TDM 2v2 flow, bots (same input interface as humans, navmesh, vision, reaction time, difficulty), minimap, scoreboard, kill feed, menus, settings.
8. Spatial audio, footsteps, accessibility, quality auto-detect.
9. Hardening: profiling, leak tests, anti-cheat basics, deployment, credits/licenses screen.

## QUALITY BAR
60 FPS target per `PLAN.md` §4; no per-frame allocations in hot paths; dispose everything; server is authoritative; rating-friendly effects (no gore); every external asset licensed and logged.

## FIRST ACTION
Execute **Phase 0 only**. Before installing, run the library verification in the Library policy for: three, vite, typescript, @dimforge/rapier3d-compat, colyseus, @colyseus/sdk, @colyseus/schema, vitest, @playwright/test, @gltf-transform/cli, three-mesh-bvh, stats-gl. Pin versions, record in `DECISIONS.md`, then build. Stop at the Phase 0 gate and send the gate report (deliverables, verification evidence, perf numbers, deviations, risks).
