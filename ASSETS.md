# ASSETS.md — External Asset Attribution & Licensing Manifest

All external assets (models, textures, audio, animations) evaluated or used in **Mini Arena** must be logged here.
Only CC0, permissive (MIT/BSD/Apache/CC-BY), or purchased commercial game licenses with license text preserved are permitted. No unverified or NC/ND/SA assets.

---

## 1. Active In-Engine Assets (Phase 3: Approach A $0 Budget)

| Asset Identifier | Category | Primary Source URL | Creator / Author | Asset License | Date Verified | Attribution Text | In-Game Usage |
|---|---|---|---|---|---|---|---|
| **Procedural First-Person Arms Rig** | 3D Arms Rig & IK | Internal Procedural ([twoBoneIk.ts](file:///d:/Games/FPS/packages/client/src/animation/twoBoneIk.ts)) | Mini Arena Engineering | MIT (Project Root) | 2026-10-14 | None required (In-house code) | Active first-person dual arm rig with sleeves and tactical gloves driven by analytical Two-Bone IK. |
| **Modular Weapon Geometry Suite** | 3D Weapon Models | Internal Procedural ([packages/client/src/models](file:///d:/Games/FPS/packages/client/src/models)) | Mini Arena Engineering | MIT (Project Root) | 2026-10-14 | None required (In-house code) | Active models for Assault Rifle, Tactical Pistol, Rapid SMG, Combat Shotgun, and Precision Sniper. |
| **High-Power Optical Sniper Scope** | 2D HUD / SVG Overlay | Internal SVG ([index.html](file:///d:/Games/FPS/packages/client/index.html#L216-L255)) | Mini Arena Engineering | MIT (Project Root) | 2026-10-14 | None required (In-house code) | Active 4.0X optical scope overlay with vignette, mil-dots, and elevation stadia. |

---

## 2. External Asset Registry & Pre-Evaluated Candidates (Post-Phase 4 Spike)

The following assets were investigated during Phase 3 research. Any future transition to Approach B (external GLBs) will use these verified primary sources:

| Asset Name | Category | Primary Direct URL | Creator / Author | Asset License | Wrapper/Code License | Verified Source Status | Required Attribution Text |
|---|---|---|---|---|---|---|---|
| **50+ LowPoly Guns** | 3D Weapon Models | [quaternius.com/packs/lowpolyguns.html](https://quaternius.com/packs/lowpolyguns.html) | Quaternius | CC0 1.0 Universal | CC0 (Direct Download) | **Verified Primary Source ($0)** | "50+ LowPoly Guns by Quaternius (CC0)" |
| **PSX First Person Arms** | 3D Rigged Arms | [drillimpact.itch.io/psx-first-person-arms](https://drillimpact.itch.io/psx-first-person-arms) | drillimpact | CC0 1.0 Universal | CC0 (itch.io) | **Verified Primary Source ($0)** | "PSX First Person Arms by drillimpact (CC0)" |
| **FPS Rig AKM & Arms Rig** | 3D Arms & Weapon | [poly.pizza/u/J-Toastie](https://poly.pizza/u/J-Toastie) | J-Toastie | CC-BY 3.0 / 4.0 | MIT (ThreeJS_FPS_2.0 wrapper only) | **Verified Primary Source ($0)** | "FPS Rig & AKM by J-Toastie (CC-BY)" |
| **Styloo Guns Asset Pack** | 3D Weapon Models | [styloo.itch.io/guns-assets-pack](https://styloo.itch.io/guns-assets-pack) | Styloo (@Styl0o_) | CC0 1.0 Universal | CC0 (itch.io) | **Verified Primary Source ($0)** | "Low Poly Gun Assets Pack by Styloo (CC0)" |
| **Kenney Starter-Kit-FPS** | 3D Blasters & Audio | [kenney.nl/assets/starter-kit-fps](https://kenney.nl/assets/starter-kit-fps) | Kenney | CC0 1.0 Universal | CC0 (Direct Download) | **Verified Primary Source ($0)** | "Starter Kit FPS by Kenney (CC0)" |
| **FPS Arms Rig (ace-spectre)** | 3D Rig & Mocap | [ace-spectre.itch.io/fps-rig](https://ace-spectre.itch.io/fps-rig) | ace-spectre | CC-BY 4.0 ($1.50) | CC-BY 4.0 (itch.io) | **Verified Candidate ($1.50)** | "FPS Rig by ace-spectre (CC-BY 4.0)" |

---

## 3. Disqualified / Unverified Candidates

| Asset Candidate | Reason for Disqualification | License Finding |
|---|---|---|
| **DJMaesen Weapons** | Disparate individual high-poly models on Sketchfab; no cohesive browser-ready low-poly pack. | CC-BY (per-model, variable polycount) |
| **civil_1337** | **Unverified / Unusable**. No public license, source repository, or verifiable author page found. | Unverified |
| **TastyFPS** | **Unverified / Unusable**. Refers to content creator handle; no open 3D pack exists. | Unverified |
| **gdquest-demos/godot-4-FPS-arms** | **Rejected**. NonCommercial (`-NC`) and ShareAlike (`-SA`) restrictions violate commercial game distribution rules. | CC-BY-NC-SA 4.0 |
| **sheeshKAAN/Weapons-3D-Models** | **Rejected**. No open-source LICENSE file in repository (defaults to All Rights Reserved). | All Rights Reserved |
| **kennux/OsFPS** | **Rejected**. 3D weapon meshes were stripped prior to repository publication. | MIT (code only, no assets) |
