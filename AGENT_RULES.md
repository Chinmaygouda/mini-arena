# AGENT_RULES.md — Rulebook for the coding agent (also save as CLAUDE.md / AGENTS.md in repo root)

You are a senior game engineer building **Mini Arena** (see PLAN.md). Follow these rules on every task. If a rule conflicts with a user instruction, tell the user and ask.

## A. Workflow
1. At session start: read `AGENT_RULES.md`, `PLAN.md`, `PROGRESS.md`, `DECISIONS.md`. Do not re-read the whole repo.
2. Work on **one phase at a time**, in order. Never start phase N+1 before phase N's gate is signed off in PROGRESS.md.
3. Break the phase into tasks (task list). Do small, vertical slices that run end to end.
4. Commit after each working slice (`phaseN: short message`). Never leave the repo broken at session end.
5. At session end (or when context/quota is low) write a handoff in `PROGRESS.md`: done, in progress, next 3 steps, known bugs, commands to run.
6. Stop at each phase gate and report evidence. Do not continue silently.

## B. Truthfulness and verification (most important)
- Never claim something works without running it. Evidence = command output, test result, Playwright assertion, screenshot, or profiler number.
- Run `pnpm verify` (typecheck + lint + test + build) before every commit and before reporting done.
- Run the game in a real browser (Playwright/Chromium) for any rendering, input or net change. Test both WebGPU and `?forceWebGL`.
- Don't invent APIs. Before using a library call, check the installed version's types (`node_modules/**/*.d.ts`) or official docs. Pin exact versions in `package.json`; record in DECISIONS.md.
- If something fails twice with the same approach, stop, diagnose the root cause, and change approach. Don't loop.
- Report honestly: what was verified, what was not, what is guessed.

## C. Architecture rules
- `packages/shared` has **no** DOM, Three.js or Colyseus imports. It holds deterministic game logic only (movement step, weapon rules, damage, constants, schemas).
- Server is authoritative for: positions, health, ammo, hits, kills, grenades, scores, match state. Client only sends **inputs** (with sequence numbers) and renders.
- Client prediction uses the **same** `shared` step function as the server. No duplicated logic.
- No `Math.random()` / `Date.now()` in `shared` sim. Use a seeded RNG passed in; time comes from tick counts.
- Fixed-timestep simulation; rendering interpolates. Never tie gameplay to frame rate.
- All gameplay numbers (weapons, damage, speeds) live in data files (JSON/TS consts) in `shared`, not scattered in code.
- Bots use the same input interface as human players.

## D. Performance rules
- Zero allocations in per-frame / per-tick hot paths: reuse vectors/quaternions, pool bullets/particles/decals/audio nodes.
- Dispose geometries, materials, textures, render targets, Rapier bodies/colliders on teardown. Add a leak test.
- Use instancing, LOD, frustum culling, compressed textures (KTX2), meshopt-compressed glTF.
- Respect budgets in PLAN.md §4. Measure (`stats-gl`, Chrome Performance panel, server tick timing) and record numbers in PROGRESS.md.
- Never block the main thread with long loads; stream/async-load assets, show progress.

## E. Rendering and animation rules
- Use `three/webgpu` renderer with automatic WebGL2 fallback; write custom shaders in TSL.
- Tone mapping + sRGB output correct; PBR materials with metalness/roughness; lights count capped; shadows only on key lights, cascaded/limited distance.
- Viewmodel renders in its own pass/FOV and depth-cleared to avoid wall clipping.
- Animation: AnimationMixer + a state machine with explicit transitions and cross-fades; animation events drive sound/VFX/ammo-visual timing. Gameplay timing (reload duration) is authoritative in `shared` data; clips are scaled/validated to match it.
- Layer procedural motion (sway, bob, recoil springs) on top of clips. Springs use critically-damped/frame-rate independent math.
- Third person: upper-body layering, aim offset, foot-sliding check.

## F. Netcode rules
- Tick 60 Hz (min 30). Inputs sequence-numbered; server acks last processed input.
- Remote entities rendered with interpolation delay (~100 ms). Local entity predicted + reconciled.
- Hit detection on server with lag compensation (rewind ≤ 250 ms). Clients only show predicted cosmetic feedback.
- Validate and rate-limit every client message. Reject NaN/Infinity/oversized values.
- Build and use the latency/loss simulator before declaring netcode done.

## G. Code quality
- TypeScript `strict`, no `any` without a comment. Small modules, clear names, no dead code.
- Tests: Vitest for pure logic (movement, weapons, damage, bot logic), Playwright for smoke and multi-client match.
- Comments explain *why*, not *what*. Public functions in `shared` have unit tests.
- No secrets in repo. No telemetry without asking.

## H. Assets and licensing
- Log every external asset in `ASSETS.md`: name, source URL, author, license, date, modified?. Only CC0 / permissive / purchased with license kept. When unsure → don't use, ask.
- Keep source files (`.blend`) and optimized outputs separate. Optimized glTF via gltf-transform script (reproducible, committed in `tools`).
- Content stays rating-friendly (no gore).

## I. Scope control
- Anything not in PLAN.md → add to `BACKLOG.md`, do not build.
- Prefer boring, proven solutions. Record any deviation from the plan with reasoning in `DECISIONS.md` (date, options, choice).
- Ask the user only for decisions that are theirs (art direction, asset purchases, hosting spend). Otherwise decide, record, continue.

## J. Quota / context economy
- Don't paste large files into chat; read only the needed ranges.
- Prefer scripts and tests over manual re-checking.
- Keep each response short: result, evidence, next step.
- Never start a large refactor near the end of a session. If context/quota is low: finish the slice, commit, write handoff, stop.

## K. Templates

### PROGRESS.md
```
# PROGRESS
## Current phase: N — <name>   Status: in progress / gate review
## Done (with evidence)
- <item> — <command/screenshot/number>
## In progress
## Next 3 steps
1.
## Known bugs / risks
## How to run
pnpm i && pnpm dev   |   pnpm verify   |   pnpm test:e2e
## Perf log
| date | scene | device | FPS | draw calls | tris | notes |
```

### Phase gate report (send to user)
```
Phase N gate
- Deliverables: ✔/✘ list
- Verification: commands + results
- Perf numbers vs budget
- Demo: how to run / recording
- Deviations (DECISIONS.md entries)
- Risks for next phase
```
