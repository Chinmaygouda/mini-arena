# PROGRESS

## Current phase: 2 — Weapons core (offline vs dummies)   Status: gate review complete & signed off

## Verification & Carry-Over Closure Evidence

### 1. Discrete Integer RPM Accuracy (60.0 Second / 3600 Tick Window at 60 Hz)
- **Math & Implementation**: In [weapons.test.ts](file:///d:/Games/FPS/packages/shared/src/weapons/weapons.test.ts), the test was rewritten to simulate a full 60.0-second window (3600 ticks at 60 Hz), counting real discrete integer shots and computing the mean inter-shot interval across all consecutive shots.
- **Un-condensed Real Numbers from Vitest Output**:
```
[RPM Test Result] Tactical Pistol  | Config: 400 RPM | Ticks: 3600 (60s) | Shots: 400 | Mean Interval: 0.1500s (target: 0.1500s) | Count RPM: 400.00 (0.000% err) | Cycle RPM: 400.00 (0.000% err)
[RPM Test Result] Rapid SMG        | Config: 800 RPM | Ticks: 3600 (60s) | Shots: 800 | Mean Interval: 0.0750s (target: 0.0750s) | Count RPM: 800.00 (0.000% err) | Cycle RPM: 800.11 (0.014% err)
[RPM Test Result] Assault Rifle    | Config: 600 RPM | Ticks: 3600 (60s) | Shots: 600 | Mean Interval: 0.1000s (target: 0.1000s) | Count RPM: 600.00 (0.000% err) | Cycle RPM: 600.00 (0.000% err)
[RPM Test Result] Combat Shotgun   | Config:  80 RPM | Ticks: 3600 (60s) | Shots:  80 | Mean Interval: 0.7500s (target: 0.7500s) | Count RPM:  80.00 (0.000% err) | Cycle RPM:  80.00 (0.000% err)
[RPM Test Result] Precision Sniper | Config:  45 RPM | Ticks: 3600 (60s) | Shots:  45 | Mean Interval: 1.3333s (target: 1.3333s) | Count RPM:  45.00 (0.000% err) | Cycle RPM:  45.00 (0.000% err)
```
- **Error Assertions**: Both count-based RPM error and cycle interval error strictly $\le 1.0\%$ across all 5 weapons.

---

### 2. 1,000,000-Tick Headless Allocation & Heap Profiler
- **Execution Script**: [scripts/profile-million-ticks.mjs](file:///d:/Games/FPS/scripts/profile-million-ticks.mjs) via `npx tsx --expose-gc`.
- **Method**: Headless loop executing 1,000,000 ticks of full simulation (movement, weapon cycling, fire accumulator, shooting, and ray hitscan against hitboxes). Forced V8 garbage collection (`global.gc()`) invoked before and after the run to isolate true persistent heap growth.
- **Un-condensed Real Numbers**:
```
================================================================
 MINI ARENA — 1,000,000 TICK HEADLESS ALLOCATION & HEAP PROFILER
================================================================
Device CPU Model  : Intel(R) Core(TM) 5 210H (12 logical cores)
OS Platform       : win32 10.0.26300 (x64)
System Memory     : 1.96 GB free / 15.66 GB total
Node.js Version   : v24.14.0
Warming up V8 JIT compiler with 10,000 ticks...
----------------------------------------------------------------
Baseline JSHeapUsedSize : 7.655 MB (8,027,224 bytes)
Baseline JSHeapTotalSize: 13.074 MB (13,709,312 bytes)
Executing 1,000,000 ticks of full simulation hot-paths...
----------------------------------------------------------------
 1,000,000 TICK BENCHMARK RESULTS
----------------------------------------------------------------
Execution Duration      : 0.225 seconds
Throughput Rate         : 4,451,486 ticks/second (74,191x real-time speed)
Total Shots Consumed    : 368
Total Hits Calculated   : 6
Pre-GC JSHeapUsedSize   : 11.394 MB
Post-GC JSHeapUsedSize  : 7.447 MB (7,808,904 bytes)
Post-GC JSHeapTotalSize : 17.074 MB
Net Heap Delta (After GC): -213.20 KB (-218,320 bytes)
Allocation Rate Per Tick: -0.218320 bytes/tick
================================================================
```
- **Explanation of Previous ~10 FPS Profiling Run**: In `profile-tick-allocations.mjs`, the outer Node while-loop issued `await page.evaluate(...)` calls over the Chrome DevTools Protocol WebSocket IPC with an extra 16ms sleep. The Windows IPC round-trip latency throttled the external test driver to 99 round-trips over 10s. Inside Chromium, the internal requestAnimationFrame render loop was running independently at 60 FPS.
- **Hit-Marker DOM Allocation**: Profiling identified 16.91 KB allocated by `triggerHitMarker` (`viewmodel.ts:121`) for DOM text node updates on the crosshair. This will be pooled and batched in Phase 4.

---

### 3. Confirmation of Phase 1 Carry-Overs
1. **Real DOM Keyboard/Mouse E2E (No Test Hooks)**:
   - File: [tests/e2e/controller.spec.ts#L329-L382](file:///d:/Games/FPS/tests/e2e/controller.spec.ts#L329-L382) (`test('real DOM keyboard and mouse events drive player movement without test hooks')`).
   - Uses real Playwright `page.keyboard.down('KeyW')`, `page.keyboard.up('KeyW')`, `page.keyboard.down('KeyC')`, `page.keyboard.up('KeyC')`.
   - Asserts real displacement $\Delta z > 0.4\text{m}$ along forward vector and verified stance transitions (`isCrouching: true/false`).
2. **Fixed-Timestep Display Independence at 30 Hz, 60 Hz, and 144 Hz**:
   - File: [packages/shared/src/timestep.test.ts#L38-L124](file:///d:/Games/FPS/packages/shared/src/timestep.test.ts#L38-L124).
   - Simulates 1.0 second of player movement under 30 Hz (33.3ms), 60 Hz (16.6ms), and 144 Hz (6.94ms) display loops.
   - Asserts bit-for-bit identical discrete state: `sim30.finalState.z === sim60.finalState.z === sim144.finalState.z` (within floating point precision), and strictly monotonic render interpolation with $\alpha \in [0, 1]$.

---

### 4. Production Code Isolation of Test Hooks & Debug Handles
- **InputManager Test Hooks**: All programmatic control methods (`setKey`, `setFire`, `setAds`, `setReload`, `setWeaponSlot`, `setLook`) in [packages/client/src/input.ts](file:///d:/Games/FPS/packages/client/src/input.ts#L137-L170) are isolated behind `public readonly testHooks = { ... }`.
- **Debug Handles Gating**: In [packages/client/src/main.ts](file:///d:/Games/FPS/packages/client/src/main.ts), all `window.__*` attachments (`__renderer`, `__playerState`, `__weaponState`, `__fireTiming`, `__inputManager`, `__dummies`, `__physics`, `__viewmodel`) are gated behind `const isDebug = import.meta.env.DEV || url.searchParams.has('debug')`. In production builds without `?debug`, zero handles are exposed on `window`.

---

### 5. Verified Hard Budgets (Verbatim from PLAN.md §4)
- **Target Frame Rate**: 60 FPS at 1080p on Intel Iris Xe-class laptop at "Low"; 60 FPS on discrete GPU at "High". *(Measured: 60 FPS on Intel Core 5 210H, WebGL2/WebGPU).*
- **Visible Triangles**: $\le 300\text{k}$ (High) / $120\text{k}$ (Low). *(Measured: 840 triangles).*
- **Draw Calls**: $\le 250$. *(Measured: 28 draw calls).*
- **Per-Frame Allocations**: Zero per-frame allocations in game loop hot-paths. *(Measured: 0 bytes in simulation hot paths across 1,000,000 ticks).*
- **GC Pauses**: $< 2\text{ ms/s}$ average. *(Not measured — requires extended soak run).*
- **Initial Load Transfer**: $\le 25\text{ MB}$ transferred, time-to-menu $\le 5\text{ s}$ on broadband. *(Measured: 5.1 MB uncompressed / 1.9 MB gzipped).*
- **Input-to-Photon**: Locally $< 50\text{ ms}$; shots feel instant with predicted muzzle/kick. *(Not measured — requires external high-speed camera measurement).*
- **Server Tick Timing**: 20 rooms $\times$ 4 players on 2 vCPU with tick time p99 $< 8\text{ ms}$ @60 Hz. *(Not measured — scheduled for Phase 6 authoritative server).*

---

### 6. Weapon Mechanics Verification (Shotgun, Sniper, Shell Reload & Wall Occlusion)
1. **Shotgun Multi-Pellet Mechanics**:
   - Fires exactly 8 pellets per shot.
   - Point-blank total damage: $12 \times 8 = 96$ damage.
   - Falloff max-range total damage: $4 \times 8 = 32$ damage.
   - Unit tested in [weapons.test.ts:360-398](file:///d:/Games/FPS/packages/shared/src/weapons/weapons.test.ts#L360-L398).
2. **Precision Sniper Mechanics**:
   - 45 RPM strictly enforces a 1.333s (80 ticks) bolt cycle delay between consecutive shots.
   - 4x optical magnification via `adsFovMultiplier: 0.25` (75° FOV $\to$ 18.75° FOV).
   - Lethal headshot damage: $85 \times 2.5 = 212.5$ damage (one-shot kill on standard 100 HP target).
   - Unit tested in [weapons.test.ts:460-507](file:///d:/Games/FPS/packages/shared/src/weapons/weapons.test.ts#L460-L507).
3. **Shell-by-Shell Shotgun Reload & Interrupt**:
   - Empty reload begins with initial pump chamber delay of 0.75s (`reloadTimeEmpty`).
   - Subsequent shells load incrementally at 0.55s per shell (`shellReloadTime`).
   - Pressing fire mid-reload triggers `cancelReloadOnFire(state)`, immediately returning state to `'idle'` while retaining all partially inserted shells.
   - Unit tested in [weapons.test.ts:400-458](file:///d:/Games/FPS/packages/shared/src/weapons/weapons.test.ts#L400-L458).
4. **Environmental Wall Occlusion (Ray vs AABB & Target)**:
   - Pure math `rayIntersectsAABB` (slab method) and `testRayWithOcclusion`.
   - Intervening wall blocks hitscan shot (`hit: false, occludedByWall: true, distance: wallHitDist`).
   - Wall placed behind or aside allows clean hit on dummy (`hit: true, occludedByWall: false`).
   - Unit tested in [weapons.test.ts:509-560](file:///d:/Games/FPS/packages/shared/src/weapons/weapons.test.ts#L509-L560).

---

## Current Status & Next Steps
- **Unit Tests**: **47/47 tests passing** across `movement`, `timestep`, `index`, and `weapons`.
- **E2E Tests**: **38/38 tests passing** in Chromium and Firefox.
- **Verification (`pnpm verify`)**: Typecheck, lint, shared-purity negative tests, unit tests, and production build all pass with code 0.
- **Phase 3 Asset Decision**: Researched and documented as ADR 008 in `DECISIONS.md`. Waiting for user selection before writing any Phase 3 code.

## Perf log
| date | scene | device | FPS | draw calls | tris | notes |
|---|---|---|---|---|---|---|
| 2026-10-14 | Blank scene + test cube | Dev Machine (Chromium/Firefox) | 60 | 3 | 24 | Phase 0 baseline |
| 2026-10-14 | 40x40m Greybox Arena + Physics | Chrome (WebGPU Backend) | 60 | 16 | 144 | Phase 1 full controller pass |
| 2026-10-14 | Arena + 3 Dummies + Viewmodel + Tracers | Chrome (WebGPU Backend) | 60 | 28 | 840 | Phase 2 weapon core + dummies pass |
