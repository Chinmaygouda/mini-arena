# Mini Arena — Vanguard FPS

A high-performance tactical first-person shooter built with Three.js and Vite.

## How to Run

### 1. Prerequisites
Ensure you have Node.js (v18+) and npm installed.

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173/` (or port specified by Vite).

### 4. Build for Production
```bash
npm run build
npm run preview
```

## Weapons (5 Authentic Firearms)
- **[1] AK-47 Vanguard Assault Rifle**: Full-auto 600 RPM with hollow reflex optic, glowing red reticle, and multi-stage keyframe reload.
- **[2] Tactical M9 Combat Pistol**: Semi-auto sidearm with open U-notch iron sight.
- **[3] Cyclone-9 SMG**: 800 RPM submachine gun with top Picatinny rail.
- **[4] SPAS-12 Combat Shotgun**: 12-gauge 8-pellet buckshot spread with animated grooved pump action and shell reload.
- **[5] AW-50 Heavy Sniper Rifle**: .50 BMG heavy penetrator with high-magnification telescopic optic, mil-dot scope overlay, and cycling bolt.

## Map Arenas (6 Tactical Environments)
- **Tactical Shooting Range**: Outdoor ballistic proving ground with reactive steel silhouette targets at 8m–60m.
- **Foundry Yard**: Golden hour industrial arena with warehouses, corridors, and central yard.
- **Cul-de-Sac**: Suburban tactical combat layout.
- **Dustline Village**: Arid tactical compound with close-quarters alleys.
- **Overpass Arena**: Two-tier elevated highway and combat structure.
- **Neighborhood District (2v2 rebuild in progress)**: A slightly tighter 92m × 92m playable layout for two players per team. Maple House is being renovated as a spacious 12m × 10m open-plan two-storey prototype, with a pitched roof, wide staircase, jump-through windows, and a wider balcony terrace with a central jump-out gap. The other six structures remain neutral blockouts until each is built and tested. Spawn-slot metadata is for future multiplayer integration; it is not networked multiplayer.

## Neighborhood Rebuild Workflow

The `neighborhood-rebuild` branch develops this map incrementally:
1. Lock the compact block layout and road grid.
2. Finish and runtime-test spacious Maple House traversal (wide entrance, stair run, vaultable windows and balcony jump-out) as the architectural reference.
3. Approve each next house, apartment building, and market separately.
4. Build out the park, vehicles, bus shelter, street furniture, and final route balancing after the structures pass review.

A code/data test passing is not visual approval. Before moving to the next building, run the Vite game, inspect the building from multiple exterior views and inside, and test doors, windows, collision, stairs, balcony access, and browser console errors.

## Keybindings
- **W, A, S, D**: Movement
- **Mouse**: Look / Aim
- **Left Mouse Button (LMB)**: Fire weapon
- **Right Mouse Button (RMB) / Q**: Aim Down Sights (ADS)
- **R**: Tactical reload
- **1, 2, 3, 4, 5**: Instant weapon selection (or use Mouse Wheel)
- **M**: Open Map Arena selector
- **V**: Inspect weapon
- **Shift**: Sprint
- **Space**: Jump
