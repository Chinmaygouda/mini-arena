# AGENTS.md
- Branch: `main` is the only active branch in this repository.
- Location: Single project root at `d:\Games\frist person shooter` (no packages/ monorepo).
- How to run: `npm install` followed by `npm run dev` (Vite dev server).
- Weapons & logic: `src/weapons/` (weaponManager, weaponTypes, models).
- Maps & environment: `src/environment/` (shootingRange, targets).
- Player & controls: `src/player/` (firstPersonControls, arms).
- Audio & UI: `src/audio/` (soundManager) and `src/ui/` (fpsHUD).
- Golden Rule: Never create orphan branches or a second app at the repo root.
