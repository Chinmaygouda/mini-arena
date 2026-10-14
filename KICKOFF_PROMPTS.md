# KICKOFF_PROMPTS.md — paste one at a time into your coding agent

Setup (once): create an empty repo folder, put `PLAN.md`, `AGENT_RULES.md` (also copy to `CLAUDE.md`) in the root.

## Prompt 0 — Foundation (Phase 0)
```
You are the coding agent for the project in this folder. First read AGENT_RULES.md and PLAN.md fully, then confirm in 5 lines your understanding of the stack, the phase gates and the verification rule. Then execute ONLY Phase 0 from PLAN.md. Before installing anything, check the latest stable versions of three, vite, typescript, @dimforge/rapier3d-compat, colyseus, @colyseus/sdk, @colyseus/schema, vitest, playwright, @gltf-transform/cli and pin them; record in DECISIONS.md. Create PROGRESS.md, DECISIONS.md, ASSETS.md, BACKLOG.md. Stop at the Phase 0 gate and send the gate report.
```

## Prompt N — Any later phase (replace N)
```
Read AGENT_RULES.md, PROGRESS.md, DECISIONS.md, then the Phase N section of PLAN.md. Confirm Phase N-1's gate is signed off in PROGRESS.md; if not, stop and tell me. Create a task list for Phase N, implement in small verified slices, run `pnpm verify` and a real browser check (WebGPU and ?forceWebGL) after each slice, measure performance against PLAN.md §4, commit per slice. At the end send the Phase gate report and update PROGRESS.md. Do not start Phase N+1.
```

## Prompt — Resume after quota reset
```
Resume work. Read PROGRESS.md handoff section, run `pnpm verify` to confirm the repo is green, fix anything red first, then continue with the "Next 3 steps". Follow AGENT_RULES.md.
```

## Prompt — Phase 3 asset decision (run before animation work)
```
Phase 3 start. Before coding, research and report options for first-person weapon arms + reload animations: (a) author in Blender, (b) CC0/CC-BY packs, (c) purchase, (d) procedural-only fallback. For each: license, quality, effort, cost. Check licenses against current official terms. Recommend one, wait for my choice, then record it in DECISIONS.md.
```

## Prompt — Independent audit (use a fresh session)
```
You are an independent reviewer. Read AGENT_RULES.md and PLAN.md. Audit the repo against the current phase gate: run pnpm verify, run the app in WebGPU and forceWebGL, check shared/ purity (no DOM/Three imports), hot-path allocations, disposal, netcode authority, and licensing log. Report findings by severity with file:line evidence. Do not modify code.
```

## Quota tip
Run one phase per session. Phases 3, 6 and 7 are the heaviest; split them into sub-sessions using the handoff in PROGRESS.md.
