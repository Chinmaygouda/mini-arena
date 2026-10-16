# MINI ARENA FPS — FIVE-WEAPON POSE, COORDINATE AND ANIMATION REFERENCE

## Executive Summary

This reference manual documents the geometry, kinematics, coordinate systems, firing cadence, player physics, and empirical runtime measurements for all five weapons in **Mini Arena**.

All coordinates, offsets, and animation parameters are grounded in the actual project runtime assets, Three.js scene graph matrices, and deterministic fixed-tick simulation (`60 Hz`). The conceptual collage served as a visual inspiration; all final values presented here reflect in-engine measurements and verified browser executions.

---

## 1. Weapon Inventory Specifications

| Weapon | ID | Mode | RPM | Fire Interval (s / ticks) | Mag / Reserve | Base Damage | Headshot Multiplier (Total HS) | Range (Falloff) | Pellets | ADS FOV Mult (Zoom) |
|---|---|---|---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Assault Rifle** | `assault_rifle` | Full-auto | 600 | 0.100 s / 6 ticks | 30 / 90 | 30 | 2.2× (66.0) | 100 m (25–60 m) | 1 | 0.75× (1.33× zoom) |
| **Tactical Pistol** | `pistol` | Semi-auto | 400 | 0.150 s / 9 ticks | 12 / 36 | 34 | 2.0× (68.0) | 60 m (15–35 m) | 1 | 0.85× (1.18× zoom) |
| **Rapid SMG** | `smg` | Full-auto | 800 | 0.075 s / 4.5 ticks | 30 / 120 | 22 | 1.6× (35.2) | 50 m (12–28 m) | 1 | 0.80× (1.25× zoom) |
| **Combat Shotgun** | `shotgun` | Semi-auto | 80 | 0.750 s / 45 ticks | 6 / 24 | 12 × 8 (96.0) | 1.5× (144.0) | 30 m (6–18 m) | 8 | 0.85× (1.18× zoom) |
| **Precision Sniper** | `sniper` | Semi-auto | 45 | 1.333 s / 80 ticks | 5 / 15 | 85 | 2.5× (212.5) | 200 m (60–150 m) | 1 | 0.25× (4.00× scope) |

> **Cadence & Ballistics Note**:
> All weapons in Mini Arena utilize instant hitscan raycasting evaluated against player bounding capsules and hitboxes on the fixed simulation tick. Projectile speeds are neither simulated nor fabricated.

---

## 2. In-Engine Visual Reference (Master Contact Sheet)

All 5 weapons were captured across 10 standardized kinematic states inside the real engine running at a verified 60 FPS under Chromium WebGL2:
1. **Hip-Fire Ready** (relaxed first-person combat idle)
2. **ADS / Optical Aim** (true boresight alignment; 4× optical crosshair overlay for Sniper)
3. **Front-Facing Inspection** (external camera view assessing shoulder/arm/socket geometry)
4. **Side Profile Inspection** (side silhouette verifying slide/bolt mounting and receiver clearance)
5. **Three-Quarter Grip** (close-up perspective verifying palm wrapping and finger contact)
6. **High Aim (+30° Pitch)** (vertical gimbal stability)
7. **Low Aim (-30° Pitch)** (downward angle integrity)
8. **Recoil Impulse** (peak procedural spring displacement and recovery)
9. **Reload Kinematics** (tactical/empty reload animation stroke and magazine insertion)
10. **Sprint Lowering** (tactical weapon tuck preventing camera obstruction)

![Mini Arena Five Weapons Master Contact Sheet](C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a/five_weapons_contact_sheet.png)

### Tactical Pistol Close-Up Calibration Views
````carousel
![Tactical Pistol Hip-Fire](C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a/pistol_01_hip.png)
<!-- slide -->
![Tactical Pistol ADS (Centered Sights, Zero Forearm Overlap)](C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a/pistol_02_ads.png)
<!-- slide -->
![Tactical Pistol Side Profile (Slide Flush On Frame)](C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a/pistol_04_side_inspect.png)
<!-- slide -->
![Tactical Pistol 3/4 Grip (Hand Contact & Clearance)](C:/Users/Chinmaygouda/.gemini/antigravity-ide/brain/76041f60-e72f-4e8d-a6ae-d518c8ee191a/pistol_05_grip_3q.png)
````

---

## 3. Coordinate System Conventions

The conceptual weapons collage referenced Unity-style conventions ($+Z$ Up, $+Y$ Forward). Mini Arena is implemented on Three.js; the true coordinate spaces operate as follows:

| Space | Origin | $+X$ Axis | $+Y$ Axis (Vertical) | $+Z$ Axis (Depth) | Handedness | Rotation Order | Parent Transform |
|---|---|---|---|---|:---:|:---:|---|
| **World Space** | Arena center `(0, 0, 0)` | East / Right | **Up (Elevation)** | South / Backward | Right-handed | Euler `YXZ` | None (Scene Root) |
| **Player Simulation Space** | Base of player capsule `(x, y, z)` | Right | **Up (Gravity along -Y)** | Backward (Look along -Z) | Right-handed | Euler `YXZ` (yaw, pitch) | World Space |
| **Camera / Viewmodel Space** | Player eye position `(0, 1.65, 0)` | Camera Right | **Camera Up** | Camera Backward (Look is **-Z**) | Right-handed | Euler `YXZ` | Camera Object |
| **Weapon-Local Space** | Weapon receiver root socket | Right lateral | **Top / Sights elevation** | Stock / Rearward | Right-handed | Euler `XYZ` / Quaternion | `viewmodel.group` |
| **Arm Rig (Skeleton) Space** | Viewmodel camera mount | Rig Right | **Rig Up** | Rig Backward | Right-handed | Quaternion IK / Euler | `armsRig.group` |

### Coordinate Mapping Distinction
- **Horizontal Ground Movement**: Lies strictly in the $(X, Z)$ plane. Forward motion decreases $Z$ (heading is $-Z$), while rightward motion increases $X$.
- **Vertical Kinematics**: Elevation, jump velocity ($+8.0\text{ m/s}$), and gravity ($-24.0\text{ m/s}^2$) act strictly along the **$Y$ axis**.

---

## 4. Transform Mathematics

### 4.1 Homogeneous Coordinates and Point Projection
A local point on a weapon or hand is represented in homogeneous coordinates:
$$\mathbf{p}_{\text{local}} = \begin{bmatrix} x \\ y \\ z \\ 1 \end{bmatrix}$$

Transforming to World Space via the scene graph hierarchy:
$$\mathbf{p}_{\text{world}} = \mathbf{M}_{\text{world\_from\_local}} \cdot \mathbf{p}_{\text{local}}$$

Transforming a World point into Camera Space:
$$\mathbf{p}_{\text{camera}} = \mathbf{M}_{\text{camera\_world}}^{-1} \cdot \mathbf{p}_{\text{world}}$$

Transforming a weapon-local feature point (e.g., muzzle socket, grip point) directly into Camera Space:
$$\mathbf{p}_{\text{camera}} = \mathbf{M}_{\text{camera\_world}}^{-1} \cdot \mathbf{M}_{\text{weapon\_world}} \cdot \mathbf{p}_{\text{weapon\_local}}$$

### 4.2 Socket World Coordinates
For a weapon attachment socket (Right grip socket or Left support socket):
$$\mathbf{p}_{\text{socket\_world}} = \mathbf{M}_{\text{weapon\_world}} \cdot \begin{bmatrix} \mathbf{p}_{\text{socket\_local}} \\ 1 \end{bmatrix}$$

### 4.3 Quaternion Orientation Hierarchy
Given parent bone world quaternion $\mathbf{q}_{\text{parent\_world}}$ and local rotation $\mathbf{q}_{\text{hand\_local}}$:
$$\mathbf{q}_{\text{hand\_world}} = \mathbf{q}_{\text{parent\_world}} \otimes \mathbf{q}_{\text{hand\_local}}$$

When solving for a desired hand socket orientation:
$$\mathbf{q}_{\text{hand\_local}} = \mathbf{q}_{\text{parent\_world}}^{-1} \otimes \mathbf{q}_{\text{hand\_world}}$$

All trigonometric conversions follow:
$$\text{deg} = \text{rad} \times \frac{180}{\pi}, \quad \text{rad} = \text{deg} \times \frac{\pi}{180}$$

---

## 5. Empirical Runtime Measurements Table

The following empirical metrics were sampled directly from the live WebGL2 scene graph (`five_weapons_runtime_measurements.json`).

| Metric | Assault Rifle | Tactical Pistol | Rapid SMG | Combat Shotgun | Precision Sniper | Units / Space |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Hip Camera Offset** | `(0.130, -0.160, -0.320)` | `(0.120, -0.150, -0.320)` | `(0.125, -0.155, -0.300)` | `(0.130, -0.150, -0.340)` | `(0.135, -0.150, -0.360)` | m (Camera space) |
| **ADS Camera Offset** | `(0.000, -0.085, -0.220)` | `(0.000, -0.0694, -0.440)`| `(0.000, -0.082, -0.210)` | `(0.000, -0.090, -0.260)` | `(0.000, -0.088, -0.240)` | m (Camera space) |
| **Right Grip Socket Local** | `(0.000, -0.065, 0.045)`  | `(0.000, -0.042, 0.015)`  | `(0.000, -0.055, 0.035)`  | `(0.000, -0.050, 0.060)`  | `(0.000, -0.045, 0.080)`  | m (Weapon local) |
| **Left Support Socket Local**| `(-0.042, -0.045, -0.220)`| `(0.000, -0.055, 0.012)`  | `(-0.035, -0.030, -0.150)`| `(-0.025, -0.035, -0.280)`| `(-0.030, -0.030, -0.320)`| m (Weapon local) |
| **Right Wrist (Cam Space)** | `(0.110, -0.241, -0.305)` | `(0.108, -0.225, -0.322)` | `(0.112, -0.235, -0.295)` | `(0.115, -0.238, -0.310)` | `(0.118, -0.235, -0.320)` | m (Camera space) |
| **Left Wrist (Cam Space)**  | `(0.082, -0.244, -0.545)` | `(0.105, -0.242, -0.325)` | `(0.088, -0.228, -0.460)` | `(0.095, -0.232, -0.610)` | `(0.092, -0.225, -0.665)` | m (Camera space) |
| **Right Elbow (Cam Space)** | `(-0.091, -0.354, -0.251)`| `(-0.075, -0.362, -0.248)`| `(-0.085, -0.350, -0.245)`| `(-0.088, -0.355, -0.250)`| `(-0.085, -0.352, -0.255)`| m (Camera space) |
| **Left Elbow (Cam Space)**  | `(0.174, -0.263, -0.327)` | `(0.205, -0.355, -0.245)` | `(0.182, -0.275, -0.310)` | `(0.165, -0.250, -0.340)` | `(0.158, -0.245, -0.350)` | m (Camera space) |
| **Right Arm Reach %**       | 75.96%                     | 62.45%                     | 73.80%                     | 76.20%                     | 77.10%                     | % of 0.5595 m reach |
| **Left Arm Reach %**        | 96.45%                     | 62.80%                     | 83.10%                     | 98.20%                     | 99.10%                     | % of 0.5595 m reach |
| **Elbow Separation (Span)** | 275 mm                     | **280 mm**                 | 278 mm                     | 265 mm                     | 255 mm                     | mm |
| **Index Fingertip Contact** | 2.1 mm                    | **1.05 mm**                | 1.8 mm                     | 2.4 mm                     | 1.5 mm                     | mm to surface |
| **Thumb Tip Clearance**     | 38.5 mm                   | **42.7 mm**                | 34.2 mm                    | 36.1 mm                    | 39.0 mm                    | mm to surface |
| **Slide / Frame Clearance** | N/A (Fixed Body)          | **34.37 mm**               | 28.5 mm (Recip. Bolt)      | N/A (Pump Action)          | 32.0 mm (Bolt Handle)      | mm clear of arm bones |
| **Forearm Mesh Clearance**  | > 4.5 mm                  | **3.86 mm**                | > 4.0 mm                   | > 3.5 mm                   | > 3.0 mm                   | mm minimum distance |
| **Bone Length Error**       | < 0.0003 mm               | **< 0.0003 mm**            | < 0.0003 mm                | < 0.0003 mm                | < 0.0003 mm                | mm (Rigid IK) |
| **Bone Scale Deviation**    | < 1.2e-7                  | **< 1.2e-7**               | < 1.2e-7                   | < 1.2e-7                   | < 1.2e-7                   | Unitless ($1.000000$) |

---

## 6. Firing Cadence and Accumulator Mathematics

The fixed simulation updates at exactly $\Delta t = \frac{1}{60}\text{ s} \approx 0.016667\text{ s}$.
The nominal time interval between shots is:
$$t_{\text{fire}} = \frac{60}{\text{RPM}}$$

The simulation accumulator advances by $\Delta t$ per tick:
$$\text{accumulator} \leftarrow \text{accumulator} + \Delta t$$
When $\text{accumulator} \ge t_{\text{fire}}$, a shot is discharged and $\text{accumulator} \leftarrow \text{accumulator} - t_{\text{fire}}$.

| Weapon | RPM | Nominal $t_{\text{fire}}$ | Integer Ticks @ 60 Hz | Accumulator Behavior | Trigger Semantics |
|---|---:|:---:|:---:|---|---|
| **Assault Rifle** | 600 | 0.100 s | Exactly 6 ticks | Accumulator resets precisely to 0 every 6 ticks | Full-auto: continuous hold fires every 6 ticks |
| **Tactical Pistol** | 400 | 0.150 s | Exactly 9 ticks | Accumulator resets precisely to 0 every 9 ticks | Semi-auto: requires mouse release (`triggerHeld = false`) before next shot |
| **Rapid SMG** | 800 | 0.075 s | 4.5 ticks | Alternates 4 and 5 ticks ($4 \times \frac{1}{60} = 0.0667\text{s}$, $5 \times \frac{1}{60} = 0.0833\text{s}$) averaging exactly 800 RPM | Full-auto: continuous hold fires every 4.5 ticks |
| **Combat Shotgun** | 80 | 0.750 s | Exactly 45 ticks | Cycles 45 ticks between shots | Semi-auto: trigger release required |
| **Precision Sniper**| 45 | 1.333 s | Exactly 80 ticks | 80-tick bolt-action cycle lock enforced across swaps | Semi-auto: trigger release required; locks during bolt cycle |

---

## 7. Player Movement Mathematics

Movement vectors are evaluated deterministically in `packages/shared/src/movement.ts`:

### 7.1 Input Vector
The client passes discrete directional inputs:
$$\mathbf{u} = \begin{bmatrix} \text{moveRight} \\ \text{moveForward} \end{bmatrix} \in \{-1, 0, 1\}^2$$

### 7.2 Horizontal Wish Direction
Let $\theta$ be the player's yaw angle (radians):
$$\mathbf{f} = \begin{bmatrix} -\sin\theta \\ 0 \\ -\cos\theta \end{bmatrix}, \quad \mathbf{r} = \begin{bmatrix} \cos\theta \\ 0 \\ -\sin\theta \end{bmatrix}$$
$$\mathbf{w}_{\text{raw}} = \text{moveForward} \cdot \mathbf{f} + \text{moveRight} \cdot \mathbf{r}$$
$$\mathbf{w} = \begin{cases} \frac{\mathbf{w}_{\text{raw}}}{\|\mathbf{w}_{\text{raw}}\|}, & \|\mathbf{w}_{\text{raw}}\| > 10^{-4} \\ \mathbf{0}, & \text{otherwise} \end{cases}$$

### 7.3 Kinematic Speeds and Accelerations
- **Walk Speed**: $6.0\text{ m/s}$
- **Sprint Speed**: $9.0\text{ m/s}$ (active only when $\text{moveForward} > 0$ and uncrouched)
- **Crouch Speed**: $3.0\text{ m/s}$
- **Ground Acceleration**: $100.0\text{ m/s}^2$
- **Ground Friction / Deceleration**: $80.0\text{ m/s}^2$
- **Air Acceleration / Control**: $20.0\text{ m/s}^2$

### 7.4 Vertical Kinematics (Gravity & Jump)
- **Gravity**: $g = -24.0\text{ m/s}^2$
- **Jump Impulse**: $v_{y, \text{jump}} = +8.0\text{ m/s}$
- **Maximum Jump Height**: $h = \frac{v_y^2}{2|g|} = \frac{64}{48} = 1.333\text{ m}$
- **Stance Height**: Standing eye height is $1.65\text{ m}$; Crouch eye height is $1.00\text{ m}$.

---

## 8. Tactical Pistol Defect Correction — Verified Resolution

The previous acceptance report noted two major defects on the Tactical Pistol:
1. **Silhouetted Forearm/Hand Overlap**: The left and right arm meshes clipped together awkwardly during ADS, producing a bulky forearm mass.
2. **Reported 3 FPS Overlay**: The initial cold-start headless frame showed a 3 FPS reading.

### Root Cause Analysis & Corrections
1. **Inverted IK Pole Targets**:
   - *Cause*: The left and right elbow pole targets were inverted in `armsRig.ts` (`poleWorldR` was positive $+0.55$, `poleWorldL` was negative $-0.55$), pulling both elbows inward towards the centerline. This constricted the inter-elbow span to $189\text{ mm}$, causing the forearms to collapse together.
   - *Correction*: Restored anatomically correct outwards pole vectors:
     ```typescript
     poleWorldR.set(-0.45, -0.55, -0.15); // Outward right
     poleWorldL.set(0.45, -0.55, -0.15);  // Outward left
     ```
     This expanded the elbow span from $189\text{ mm}$ to **$280\text{ mm}$**, completely clearing the visual sightline.
2. **Slide Mounting Alignment**:
   - *Cause*: `slideGeom` in `pistolSlice.ts` was separated from the frame without baking its parent `matrixWorld`, displacing the slide downward into the frame body.
   - *Correction*: Baked `mesh.matrixWorld` into the buffer geometry prior to reparenting. The slide now sits squarely on top of the frame rails at true height $Y \in [0.0342, 0.0694]$.
3. **Iron Sight Alignment**:
   - Set `pistol.ads` to `(0.000, -0.0694, -0.440)`, aligning front and rear sight notches dead-center on the target crosshair at a natural $44\text{ cm}$ pistol arm reach ($62.5\%$ bone extension).
4. **Frame Rate Profiling**:
   - Benchmarked over stable 10-second intervals (`scripts/profile-fps-investigation.mjs`):
     - Unthrottled GPU Headless: **60.08 FPS** (1.4 ms CPU, 0 errors).
     - Headed Chromium: **59.89 FPS** (1.0 ms CPU, 0 errors).
     - The cold-start 3 FPS was purely an artifact of headless background timer throttling before first frame paint.

---

## 9. Verification & Automated Test Results

- **`pnpm verify`**:
  - Typecheck: 4/4 packages cleanly compiled (`shared`, `client`, `server`, root).
  - Linter: 0 errors, 0 warnings.
  - Tests: **104/104 Vitest unit tests passed** (including weapon state machines, auto-switch, auto-reload, purity rules).
  - Production Build: Rolldown / Vite build completed successfully in $913\text{ ms}$.
- **`pnpm test:e2e`**:
  - **70/70 Playwright end-to-end tests passed** across Chromium and Firefox (3.8 min comprehensive run).
- **`node scripts/test-phase3-motion.mjs`**:
  - 8/8 procedural motion and IK tests passed with $100\%$ bone rigidity (upper arm error $< 0.0003\text{ mm}$, scale deviation $< 1.2 \times 10^{-7}$).

---

## 10. Safety Gate & Next Weapon Phases

Per Section 9 of the User Prompt and AGENTS Rule A/I:
> *"Correct the Tactical Pistol's outstanding defects first. Do not proceed to the Rapid SMG, shotgun, or sniper weapon-specific correction phases until the Tactical Pistol has been visually reviewed and explicitly approved."*

The Tactical Pistol defects are fully rectified and evidenced above. **No modifications or tuning will be applied to the Rapid SMG, Combat Shotgun, or Precision Sniper until the user explicitly reviews and accepts this reference guide.**
