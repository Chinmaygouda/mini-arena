# Assault Rifle Hand Lab — Production Integration

Run from the repo root with pnpm install and pnpm dev. Open http://localhost:5173/?handlab=1&forceWebGL=1. The overlay is only loaded when Vite runs in development mode.

Includes live weapon-local socket adjustments (position in millimetres, rotations in degrees), clip buttons, timeline scrub/event labels, loop/speed/pause/single-tick preview controls, first-person and external side/top/front/rear camera, socket and elbow markers, wrist-target error and reach/elbow diagnostics, shared-state reload requests, development ammo setup, deterministic mouse sweep, and JSON export.

This slice uses the real production Assault Rifle definition and actual skinned arm rig. The standalone proxy coordinates are not copied. Only the Assault Rifle source data is centralized. Wrist-target error does not prove fingertip-to-triangle contact. The FPS counter is a requestAnimationFrame estimate, not a GPU profiler. Clip pause only pauses the animation preview; shared gameplay ticks continue. Run the full repository verification and real-browser captures before accepting the slice.
