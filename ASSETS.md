# ASSETS.md — External Asset Attribution & Licensing Manifest

All external assets (models, textures, audio, animations) evaluated or used in **Mini Arena** must be logged here.
Only CC0, permissive (MIT/BSD/Apache/CC-BY), or purchased commercial game licenses with license text preserved are permitted. No unverified, NC (NonCommercial), or SA (ShareAlike) assets.

Local license file copies are stored in the [licenses/](file:///d:/Games/FPS/licenses) directory:
- [CC0 1.0 Universal](file:///d:/Games/FPS/licenses/CC0-1.0.txt)
- [CC-BY 4.0 International](file:///d:/Games/FPS/licenses/CC-BY-4.0.txt)
- [MIT License](file:///d:/Games/FPS/licenses/MIT.txt)

---

## 1. Active In-Engine Assets (USED)

The following assets are bundled into the game client runtime (`packages/client/public/models/`):

| Asset Identifier | Status | Category | Primary Source URL | Creator / Author | License & Local Text | Download Date | Attribution Requirement | Active In-Engine File & Usage |
|---|---|---|---|---|---|---|---|---|
| **Styloo AK-47 Model Slice** | **USED** | 3D Weapon Model (GLB) | [styloo.itch.io/guns-asset-pack](https://styloo.itch.io/guns-asset-pack) | Styloo (@Styl0o_) | CC0 1.0 Universal ([licenses/CC0-1.0.txt](file:///d:/Games/FPS/licenses/CC0-1.0.txt)) | 2026-10-15 | None required (CC0 Public Domain). Optional courtesy credit: *"Low Poly Gun Assets Pack by Styloo (CC0)"* | `packages/client/public/models/ak47.glb` (1.76 MB, 2,373 triangles). Active Assault Rifle visual model; magazine (`akmagazine_low`) split into discrete mesh for physical drop & reload kinematics. |
| **Drillimpact PSX Arms Rig** | **USED** | 3D Rigged Arms (GLB) | [drillimpact.itch.io/psx-first-person-arms](https://drillimpact.itch.io/psx-first-person-arms) | drillimpact | CC0 1.0 Universal ([licenses/CC0-1.0.txt](file:///d:/Games/FPS/licenses/CC0-1.0.txt)) | 2026-10-15 | None required (CC0 Public Domain). Optional courtesy credit: *"PSX First Person Arms by drillimpact (CC0)"* | `packages/client/public/models/arms_rig.glb` (1.09 MB, 1,176 triangles). Active first-person dual arm rig (52-bone articulated SkinnedMesh). |
| **Internal Procedural Arms Rig & Two-Bone IK** | **USED** | In-Engine Rig & Solver | [packages/client/src/animation/twoBoneIk.ts](file:///d:/Games/FPS/packages/client/src/animation/twoBoneIk.ts) | Mini Arena Engineering | MIT ([licenses/MIT.txt](file:///d:/Games/FPS/licenses/MIT.txt)) | 2026-10-14 | None (Original in-house code) | Dual-arm procedural hierarchy with analytical Two-Bone IK solver and elbow pole targets (synchronous fallback and IK guide). |
| **Modular Procedural Weapon Suite** | **USED** | In-Engine 3D Geometry | [packages/client/src/models/](file:///d:/Games/FPS/packages/client/src/models) | Mini Arena Engineering | MIT ([licenses/MIT.txt](file:///d:/Games/FPS/licenses/MIT.txt)) | 2026-10-14 | None (Original in-house code) | Active procedural models for Pistol, SMG, Shotgun, and Sniper, featuring split magazines, pump slides, and bolt handles. |
| **High-Power Optical Sniper Scope** | **USED** | 2D HUD / SVG Overlay | [packages/client/index.html](file:///d:/Games/FPS/packages/client/index.html#L216-L255) | Mini Arena Engineering | MIT ([licenses/MIT.txt](file:///d:/Games/FPS/licenses/MIT.txt)) | 2026-10-14 | None (Original in-house code) | Active 4.0X optical scope overlay with vignette, mil-dots, and elevation stadia. |

---

## 2. Pre-Evaluated Candidates (CANDIDATE)

The following assets were vetted for technical and licensing compliance during Phase 3 research. They are **not** bundled into the active game client, but are pre-cleared for future phases (Phase 4 grenades, Phase 5 art pass):

| Asset Name | Status | Category | Primary Direct URL | Creator / Author | Asset License & Local Text | Verified Evaluation Date | License Status & Attribution Policy | Notes & Future Role |
|---|---|---|---|---|---|---|---|---|
| **Styloo Guns Pack (Remaining Weapons & Grenades)** | **CANDIDATE** | 3D Weapon Models & Grenades | [styloo.itch.io/guns-asset-pack](https://styloo.itch.io/guns-asset-pack) | Styloo (@Styl0o_) | CC0 1.0 Universal ([licenses/CC0-1.0.txt](file:///d:/Games/FPS/licenses/CC0-1.0.txt)) | 2026-10-15 | CC0 Public Domain. Pre-cleared. | Contains matching Pistol, Mac-10 (SMG), Shotgun, AWP (Sniper), and Phase 4 throwables (Flashbang, Smoke, Frag, Incendiary) from same author for guaranteed visual cohesion. |
| **FPS Rig AKM & Arms Rig** | **CANDIDATE** | 3D Arms & Weapon | [poly.pizza/u/J-Toastie](https://poly.pizza/u/J-Toastie) | J-Toastie | CC-BY 3.0 / 4.0 ([licenses/CC-BY-4.0.txt](file:///d:/Games/FPS/licenses/CC-BY-4.0.txt)) | 2026-10-14 | **Candidate only.** Kept as candidate until used. When used, mandatory attribution: *"FPS Rig & AKM by J-Toastie (CC-BY)"*. | High-quality skeletal arms with baked animations. Candidate for future visual spike after Phase 4. |
| **50+ LowPoly Guns** | **CANDIDATE** | 3D Weapon Models | [quaternius.com/packs/lowpolyguns.html](https://quaternius.com/packs/lowpolyguns.html) | Quaternius | CC0 1.0 Universal ([licenses/CC0-1.0.txt](file:///d:/Games/FPS/licenses/CC0-1.0.txt)) | 2026-10-14 | CC0 Public Domain. Pre-cleared. Optional courtesy credit: *"50+ LowPoly Guns by Quaternius (CC0)"*. | Extensive modular low-poly weapon pack. Alternative candidate for weapon variations. |
| **Kenney Starter-Kit-FPS** | **CANDIDATE** | 3D Blasters & Audio | [kenney.nl/assets/starter-kit-fps](https://kenney.nl/assets/starter-kit-fps) | Kenney | CC0 1.0 Universal ([licenses/CC0-1.0.txt](file:///d:/Games/FPS/licenses/CC0-1.0.txt)) | 2026-10-14 | CC0 Public Domain. Pre-cleared. Optional courtesy credit: *"Starter Kit FPS by Kenney (CC0)"*. | Audio sound effects candidate for Phase 8. |
| **FPS Arms Rig (ace-spectre)** | **CANDIDATE** | 3D Rig & Mocap | [ace-spectre.itch.io/fps-rig](https://ace-spectre.itch.io/fps-rig) | ace-spectre | CC-BY 4.0 ($1.50) ([licenses/CC-BY-4.0.txt](file:///d:/Games/FPS/licenses/CC-BY-4.0.txt)) | 2026-10-14 | **Candidate only.** If purchased & integrated, mandatory attribution: *"FPS Rig by ace-spectre (CC-BY 4.0)"*. | Commercial CC-BY asset candidate ($1.50). |

---

## 3. Disqualified / Unverified Candidates (REJECTED)

| Asset Candidate | Status | Reason for Disqualification | License Finding |
|---|---|---|---|
| **gdquest-demos/godot-4-FPS-arms** | **REJECTED** | NonCommercial (`-NC`) and ShareAlike (`-SA`) restrictions violate commercial game distribution rules. | CC-BY-NC-SA 4.0 |
| **sheeshKAAN/Weapons-3D-Models** | **REJECTED** | No open-source LICENSE file in repository (defaults to All Rights Reserved under international copyright). | All Rights Reserved |
| **kennux/OsFPS** | **REJECTED** | 3D weapon meshes were stripped prior to repository publication. | MIT (code only, no asset files) |
| **DJMaesen Weapons** | **REJECTED** | Disparate individual high-poly models on Sketchfab; no cohesive browser-ready low-poly pack. | CC-BY (variable polycount, per-model) |
| **civil_1337** | **REJECTED** | Unverified / Unusable. No public license, source repository, or verifiable author page found. | Unverified |
| **TastyFPS** | **REJECTED** | Unverified / Unusable. Refers to content creator handle; no open 3D pack exists. | Unverified |
