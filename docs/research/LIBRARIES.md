# LIBRARIES.md — Library Research & Evaluation Record

This document evaluates third-party and built-in library candidates for **Mini Arena** across Phases 4–8 in accordance with `AGENT_RULES.md` and the Unattended Run specification.

---

## 1. Particle Systems & Visual Effects (Phase 4)

### Candidate 1.1: `three.quarks`
- **npm Name**: `three.quarks`
- **Version**: `0.17.1`
- **License**: MIT
- **Last Published**: 2026-05-21
- **Compatibility**: Built for traditional WebGL `ShaderMaterial` and standard `WebGLRenderer`. Does not natively compile against `three/webgpu` NodeMaterials / TSL in Three r186 without fragile fallback shims.
- **Verdict**: **Rejected**. Incompatible with WebGPU pipeline and introduces extra external bundle overhead.

### Candidate 1.2: Dedicated Pooled Instanced TSL / Three Mesh Particle System (Selected)
- **Implementation**: Custom zero-allocation pooled particle emitter system utilizing `THREE.InstancedMesh` with preallocated Float32Array dynamic ring buffers for position, velocity, rotation, scale, color, and life.
- **License**: Embedded / Project code (MIT)
- **Compatibility**: 100% compatible with both `WebGPURenderer` and `WebGLRenderer` (automatic WebGL2 fallback). Zero GC allocations in the 60 FPS per-frame render loop.
- **Verdict**: **Accepted**. Delivers deterministic particle lifespans, soft smoke volume shading, explosion fireballs, debris sparks, and muzzle flashes within Intel iGPU performance budgets.

---

## 2. Decals & Raycasting (Phase 4 & Phase 5)

### Candidate 2.1: `three/addons DecalGeometry` (Allocating per decal)
- **Package**: `three/examples/jsm/geometries/DecalGeometry.js`
- **License**: MIT
- **Compatibility**: Standard Three.js addon.
- **Defect**: Calling `new DecalGeometry(mesh, pos, rot, size)` performs heavy per-vertex clipping against the target mesh on CPU every time a bullet impacts a surface. This generates large transient geometry arrays and triggers severe GC spikes during automatic fire.
- **Verdict**: **Rejected for per-shot instantiation**.

### Candidate 2.2: Instanced Decal Ring Buffer on Merged Colliders (Selected)
- **Implementation**: Pre-allocated `THREE.InstancedMesh` with a fixed-size ring buffer (e.g. 128 bullet holes, 32 blast scorch marks) with depth-offsetting (`polygonOffset: true, polygonOffsetFactor: -1.0`) oriented along the surface impact normal. Oldest decals wrap around with zero heap allocation.
- **License**: Embedded / Project code (MIT)
- **Compatibility**: 100% compatible with WebGPU and WebGL2. Constant draw call overhead ($O(1)$) and zero heap allocations.
- **Verdict**: **Accepted**.

### Candidate 2.3: `three-mesh-bvh`
- **npm Name**: `three-mesh-bvh`
- **Version**: `0.9.16`
- **License**: MIT
- **Last Published**: 2026-10-08
- **Compatibility**: Compatible with Three r186 BufferGeometries.
- **Verdict**: **Accepted for client visual decals & surface material query**. Server-side collision remains strictly authoritative on Rapier.

---

## 3. Post-Processing & Rendering Nodes (Phase 5)

### Built-in TSL Display Nodes (`three/examples/jsm/tsl/display`)
Three.js r186 includes official TSL node post-processing compatible with `WebGPURenderer`:
- **Bloom**: `BloomNode.js` (`bloom()`)
- **Ambient Occlusion**: `GTAONode.js` (`gtao()`) — Ground Truth Ambient Occlusion with spatial denoising.
- **Anti-Aliasing**:
  - `FXAANode.js` (`fxaa()`) — Fast approximate AA for Medium/Low tiers.
  - `SMAANode.js` (`smaa()`) & `TRAANode.js` (`traa()`) — Subpixel morphological and temporal reprojection AA for High tier.
- **Cascaded Shadow Maps (CSM)**: `CSMShadowNode.js` (`three/examples/jsm/csm/CSMShadowNode.js`) provides native TSL cascades for directional sunlight without light-leaking.
- **Environment Lighting**: `THREE.PMREMGenerator` pre-filters CC0 HDRIs into pre-filtered radiance maps for PBR metalness/roughness lighting.
- **Asset Compression**: `@gltf-transform/cli` (`v4.5.1`, MIT) executes automated deduplication, vertex cache optimization, quantization, and meshopt compression.

---

## 4. Navmesh & Pathfinding (Phase 5 & Phase 7)

### Candidate 4.1: `three-pathfinding`
- **npm Name**: `three-pathfinding`
- **License**: MIT
- **Defects**: Unmaintained, lacks 3D recast voxelization, unable to bake walkable slopes, stair stepping, or agent radius off-mesh connections automatically from level geometry.
- **Verdict**: **Rejected**.

### Candidate 4.2: `@recast-navigation/core` & `@recast-navigation/generators` (Selected)
- **npm Name**: `@recast-navigation/core`, `@recast-navigation/three`, `@recast-navigation/generators`
- **Version**: `0.43.1`
- **License**: MIT
- **Last Published**: 2026-04-07
- **Rationale**: Industry-standard Recast & Detour navmesh compiler compiled to WASM. Generates tight navmeshes with configurable agent radius ($0.35\text{ m}$), step height ($0.35\text{ m}$), and max walkable slope ($45^\circ$). Pre-baked offline into binary `.bin` files via `tools/build-map.mjs`, consuming zero runtime CPU during matches.
- **Verdict**: **Accepted**.

---

## 5. Audio Engine (Phase 8)

### Candidate 5.1: `howler`
- **npm Name**: `howler`
- **Version**: `2.2.4`
- **License**: MIT
- **Defects**: Lacks native low-pass filter occlusion curves for walls/cover; panner model lacks direct BiquadFilter convolution routing; adds external runtime bundle weight.
- **Verdict**: **Rejected**.

### Candidate 5.2: `three.PositionalAudio`
- **Package**: `three/src/audio/PositionalAudio.js`
- **License**: MIT
- **Defects**: Couples audio directly to Three.js scene-graph objects. Violates architecture rule: `shared` and headless simulations cannot use Three.js. Lacks voice priority stealing, ducking, and global bus routing.
- **Verdict**: **Rejected**.

### Candidate 5.3: Raw Web Audio API Engine (`AudioManager`) (Selected)
- **Implementation**: Native browser Web Audio API (`AudioContext`) with 4 dedicated gain buses (`Master`, `SFX`, `UI`, `Music`), 32 pre-allocated pooled voices, HRTF `PannerNode` spatialization, distance attenuation models, and dynamic `BiquadFilterNode` low-pass filtering for line-of-sight occlusion behind walls.
- **License**: Native Browser API (W3C standard, zero license risk, zero external dependencies).
- **Verdict**: **Accepted**.

---

## 6. Approved Permissive Free Asset Sources

| Provider | Permitted Licenses | Asset Types Used | Tracking Rule |
|---|---|---|---|
| **Poly Haven** | CC0 1.0 Universal | PBR Photographic Textures (Albedo, Normal, ORM) & Downscaled HDRIs | Logged in `ASSETS.md` with source URL |
| **ambientCG** | CC0 1.0 Universal | PBR Architectural Textures (Concrete, Metal, Tiles) | Logged in `ASSETS.md` with source URL |
| **Kenney.nl** | CC0 1.0 Universal | Modular 3D Kit Meshes, UI Sound Effects | Logged in `ASSETS.md` with source URL |
| **Quaternius** | CC0 1.0 Universal | Character & Prop Models | Logged in `ASSETS.md` with source URL |
| **Freesound.org** | CC0 1.0 Universal ONLY | Audio Foley & Weapon Foley (CC0 filtered only) | Each file checked & verified CC0 |
| **OpenGameArt.org** | CC0 / Permissive | Audio & Decal Textures (CC0 filtered only) | Each file checked & verified CC0 |
