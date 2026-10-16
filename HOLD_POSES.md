# HOLD_POSES.md - weapon hold-pose targets (PROPOSED, not measured from the repo)

Companion to `weapon_hold_poses_collage.png`. Same numbers also in `hold_poses.json`.

## Coordinate system
- Three.js viewmodel/camera space, metres, origin = eye. +X right, +Y up, -Z forward.
- Shoulders: S_R=[0.16, -0.24, 0.14]  S_L=[-0.16, -0.24, 0.14]
- Upper arm l1=0.32 m, forearm+wrist l2=0.3 m, max reach 0.62 m
- Pole directions: R=[0.35, -0.65, 0.05]  L=[-0.35, -0.65, 0.05]
- Gun-local to camera: `P = (ax - lat, ay - drop, butt_z - a)`; a = metres forward of butt, drop = below bore axis.
- ADS: weapon root moves so the bore axis goes to (x,y)=[0.0, -0.045]; `ads_delta` below is applied to the weapon root, sockets inherit it.

## IK math (per arm, every frame)
```
d=|W-S|; dc=min(d,l1+l2-1e-4); u=(W-S)/d; p=normalize(pole-(pole.u)u)
a=(l1^2-l2^2+dc^2)/(2dc); h=sqrt(l1^2-a^2); E=S+a*u+h*p
cos(beta)=(l1^2+l2^2-dc^2)/(2*l1*l2)   # interior elbow angle
reach%=d/(l1+l2)
```
Frame order: reset bind pose -> grip-pose clip -> weapon root (sway/recoil/bob/ADS) -> updateMatrixWorld(true) -> solve IK to sockets -> render.

## Per-weapon targets

| Weapon | grip_R cam | grip_L cam | R reach / elbow | L reach / elbow | ADS delta |
|---|---|---|---|---|---|
| Assault Rifle (key 1) | [0.1, -0.255, -0.26] | [0.04, -0.215, -0.38] | 65.3% / 81.4 deg | 90.0% / 128.2 deg | [-0.1, 0.125, 0.0] |
| Tactical Pistol (key 2) | [0.03, -0.19, -0.31] | [-0.02, -0.185, -0.32] | 76.0% / 98.8 deg | 78.1% / 102.6 deg | [-0.03, 0.075, 0.0] |
| Rapid SMG (key 3) | [0.1, -0.25, -0.27] | [0.05, -0.21, -0.38] | 66.9% / 83.8 deg | 90.6% / 129.8 deg | [-0.1, 0.125, 0.0] |
| Combat Shotgun (key 4) | [0.1, -0.245, -0.28] | [0.05, -0.205, -0.38] | 68.4% / 86.3 deg | 90.6% / 130.0 deg | [-0.1, 0.125, 0.0] |
| Precision Sniper (key 5) | [0.1, -0.25, -0.28] | [0.05, -0.215, -0.38] | 68.4% / 86.3 deg | 90.5% / 129.7 deg | [-0.1, 0.125, 0.0] |

## Hold notes and reload/action waypoints (proposed)

- **Assault Rifle**: Stock at shoulder (behind camera, not rendered). Left hand cups handguard from below.  
  Reload/action: L hand: handguard -> mag (a0.42, drop0.15) -> pull down/left (drop0.40, lat0.12) -> fresh mag (lat0.18, drop0.45) -> insert -> handguard. Empty: R hand racks charging handle.
- **Tactical Pistol**: Two-hand isosceles grip. Support hand wraps R fingers from the left, thumbs forward.  
  Reload/action: L hand leaves grip -> mag base (drop0.12) -> pull mag down -> fresh mag from belt (lat0.18, drop0.30) -> insert -> return. Slide release on empty.
- **Rapid SMG**: Compact hold, elbows tucked. Left hand on front grip / magazine housing.  
  Reload/action: L hand: front grip -> mag (a0.20, drop0.14) -> pull down -> fresh mag -> insert -> return. Empty: R hand pulls bolt.
- **Combat Shotgun**: Left hand on the pump slide from below. Pump travel 0.08 m rearward.  
  Reload/action: Per shell: L hand pump -> belt/ammo (lat0.18, drop0.30) -> loading port (a0.34, drop0.02) -> push shell in -> repeat; loop exits at 6 rounds; final pump stroke.
- **Precision Sniper**: Left hand under forend. R hand leaves grip to work the bolt at (a0.30, up0.035, lat0.045).  
  Reload/action: Bolt cycle (80 ticks): R hand grip -> bolt 0-8 -> lift 8-24 -> pull back 24-44 -> push 44-64 -> lower 64-72 -> back to grip 72-80. Mag reload: L hand to magazine well.

## Acceptance tests
- |wrist - socket| < 0.01 m; elbow.y < wrist.y and < shoulder.y; reach 55-95%; elbow angle 60-150 deg; forearm twist <= 25 deg; no NaN/flip; pose depends only on current inputs (history independent).
- Cover sway, recoil, sprint, crouch, jump landing, swap, inspect, reload and 5 s full-auto, for ALL five weapons, in first-person.

## Required reconciliation (agent)
Measure l1, l2 and shoulder positions from `arms_rig.glb` bones and every gun's socket positions from its GLB. Scale these targets by ratio; never stretch bones. Record final numbers in DECISIONS.md.
