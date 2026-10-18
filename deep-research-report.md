# Fixing Stair Traversal & Weapon-Weighted Sprint Poses

**Executive Summary:** Players often experience “steppy” motion on stairs when character collision settings or animations don’t match the geometry. Common causes include too-small step offsets, overly wide or tall capsules, and mesh collisions that force the character to repeatedly jump each step. Fixes usually involve adjusting the character controller (raising **step height** or **slope limits**, reducing capsule radius/skin width) and using **smoothing colliders** (invisible ramps or “ghost” stairs) so the player glides up instead of catching edges.  For weapon-weighted sprint poses, solutions range from separate animations per weapon to additive lean offsets driven by weapon weight. We compare approaches (animation layers vs procedural offsets) and recommend a blend-tree method that uses a `weaponWeight` parameter. 

**Prioritized Tasks:** 
1. **Gather Assets/Inputs:** Identify all stair geometry (map files, stair mesh assets), character controller code, collision settings, animation rigs, and current climb/sprint animations. Also collect weapon metadata (weights, classes).  
2. **Baseline Analysis:** Measure typical step heights on each map. Review player capsule dimensions and current max step offset / slope settings in the movement code.  
3. **Movement Controller Tuning:** Adjust the controller’s stepOffset and slopeLimit to cover observed step heights. Tune capsule radius/height or skin width to avoid edge snagging.  
4. **Mesh/Collider Fixes:** For each stair mesh, create a hidden inclined collider or “ghost” geometry to smooth the ascent. (E.g. overlay a ramp collider aligned with the top corners of stairs.) Alternatively, duplicate the stair mesh with finer incremental steps (“ghost stairs”) so collisions form a gentle ramp. Use collision layers to prevent ghost stairs from affecting other objects.  
5. **Animation/IK Adjustments:** If needed, implement foot IK or custom climb animations. One approach is to use foot-placement IK with a simplified plane collider under stairs and the real stair mesh as complex collision. This lets the feet align smoothly. Also consider adding transition animations (e.g. press-up climbing) if stepping detection is implemented.  
6. **Sprint-Pose Setup:** Define a procedure (e.g. a blend tree) where a parameter like `weaponWeight` modulates the character’s upper-body lean. Use either layered/additive animations or code-driven bone offsets: for instance, an additive “lean-back” pose that blends in proportionally to weapon mass.  
7. **Integration & Testing:** Implement and test on all maps. Verify the player smoothly ascends stairs of varying heights without per-step jitter (target peak vertical jitter < ~1–2 cm) and maintains a stable frame rate. Check that sprinting with a heavy vs light weapon produces a plausible stance difference (head/torso angle tilt, stride change). 

## Common Stair-Climbing Solutions 

- **Step-Offset & Capsule Tuning:** Ensure the character controller’s *max step height* (stepOffset) is at least as tall as the stair risers. Unreal/Unity typically require `stepOffset < capsuleHeight – skinWidth`. If the offset is too small, the player stops at each step; raising it lets the character step up automatically. Also set the slope limit above the stairs’ incline or use invisible ramp colliders if slopes are steep.  Adjust capsule dimensions so it doesn’t clip stair lips: a slightly smaller radius or increased skin width can prevent edge catches.  
- **Invisible Ramps / “Ghost” Geometry:** A standard trick is to place an invisible inclined collider over each staircase. Disable the visible stair mesh’s collider and let the character walk up the smooth ramp instead.  This way the player “glides” up while the steps look normal. Similarly, one can overlap a second stair mesh with tiny steps (the “ghost stairs”) underneath the real stairs. This doubles the stair collision: the invisible mesh has very low risers, smoothing the ascent, while the visible mesh provides the visuals. The ghost-stairs method removes per-step bumps, though objects placed on stairs may appear to float (solved by collision layers).  
- **Foot IK / Animation Blending:** For high fidelity, apply foot IK or dedicated climb animations. Unreal’s Foot Placement system, for example, performs traces to align each foot with the ground. A recommended setup is to use a simplified flat collision (ramp) under the stairs for sweeping movement, and still trace against the actual stair mesh for each foot. This avoids the foot “dropping” issue on stairs. Alternatively, use a special stair-climb animation or input (as in classic games) that plays an animation sequence while snapping the character up. This guarantees feet hit steps perfectly, but requires triggering a non-interactive clip.  
- **NavMesh/Collision Alternatives:** If using navigation meshes, increase the agent’s step height tolerance to match stairs so AI can path over them. As a fallback or for first-person controllers, one can apply a post-move downward raycast (as shown in Unity example code) to snap the character to ground, smoothing minor elevation changes.  

  
## Sprint Pose Approaches

Weapon weight should subtly modify the sprint stance. Common strategies include:  
- **Blend Trees / Animation Layers:** Define multiple animation clips (e.g. “sprint-light”, “sprint-heavy”) and blend between them based on a weight parameter. In Unity or Unreal, an Animator/BlendSpace can interpolate the spine tilt or arm position according to `weaponWeight`. For example, blend in an additive “lean back” layer as weight increases. *Pros:* very controllable and art-authored; *Cons:* requires multiple animations or layers.  
- **Additive Animations:** Create an additive pose that represents the heavy carry offset (e.g. crouched ankles, shoulders pulled back). This single additive clip can be applied on top of any sprint animation at runtime, scaled by weight. *Pros:* Reuses base run animation, easy to tweak magnitude; *Cons:* must author a correct additive clip and configure layering.  
- **Procedural Adjustments:** Calculate a spine or camera tilt at runtime: for example, rotate the torso bone backward by `leanAngle = k * weaponWeight`. Unity’s Animation Rigging or a simple bone transform script can do this. Similarly, incorporate inertia: treat the weapon as a mass and apply a dynamic spring to the camera (as in weapon sway systems) so heavier guns cause slower bob. *Pros:* Engine-agnostic and no extra assets needed; *Cons:* can look robotic if not well-tuned, harder to predict exactly.  
- **Pose Library / Hardcoded Poses:** Store separate hardcoded poses for a few weight categories and blend between them. *Pros:* simple, inexpensive; *Cons:* less smooth range, must interpolate carefully.  

All methods should ultimately use a parameter (e.g. `weaponWeight` or weapon category) to drive the blend. The recommended solution is an animation blend tree: it easily scales from light to heavy and integrates well with existing animation systems, without requiring full new animations for each weapon.  

## Acceptance Criteria & Targets

- **Performance:** Aim for seamless stair traversal up to a chosen max step height (e.g. 0.3 m) with negligible jitter (target vertical “pop” < 0.02 m). Maintain stable framerate (target ≥60 FPS).  
- **Stair Traversal:** The player should ascend and descend all staircases without the camera jarring or character catching on steps. Each footstep on a stair should feel like a smooth slide rather than a physics collision.  
- **Sprint Pose:** When sprinting, characters with heavier weapons should visibly lean back or move more slowly than with light arms. The difference should be smooth and proportional to the supplied weight values. No unnatural clipping or freezing of upper body should occur.  

A checklist for testing:
- Run up/down all staircases at different speeds; look for any stutter or pause at a step edge.  
- Verify character collisions (capsule, stepping) after changes: the collider should clear each stair’s edge.  
- Place various objects (crates, NPCs) on stairs to ensure they rest naturally (ghost stair colliders should exclude movable items).  
- Sprint with the lightest and heaviest weapon: compare upper-body angle, arm position, and speed. Ensure the pose changes are noticeable but realistic.  

## Comparison of Stair-Smoothing Approaches

| **Approach**                       | **Complexity** | **Engine-Agnostic Steps**                                       | **Pros**                                          | **Cons**                                            |
|------------------------------------|---------------|-----------------------------------------------------------------|---------------------------------------------------|-----------------------------------------------------|
| Adjust StepOffset / Capsule        | *Low*         | Raise controller’s max step height ≥ stair height. Reduce capsule radius or increase skinWidth. Tune slope limit. | Quick to try, no new assets needed. Fixes small steps easily. | Only works for steps below offset. Too high offset can ‘float’ feet. Wide stairs still cause clipping.        |
| Invisible Ramp Collider (“ramp”)   | *Medium*      | Place a flat/inclined collider under stairs (match top or bottom). Disable/ignore actual stair collider. | Eliminates bumps entirely. Simple concept. Works for any stair shape. | May cause floating feet or foot clipping (tweak alignment). Requires extra collision setup. |
| Ghost Stairs (double mesh)         | *Medium*      | Duplicate stair mesh with finer steps. Make the new mesh invisible and collidable. (Use layers to avoid object collisions.) | Very smooth ascent. Preserves original visuals. | Two colliders to maintain. Static objects may float (needs layer filters).                  |
| Foot IK / Stair Animations         | *High*        | Implement foot-placement IK or dedicated stair-climb anim. Simplify collision (plane) under stairs; use IK traces for feet. Or trigger special climb anim. | Perfect foot alignment on steps. Can use realistic animations (e.g. Press “up” for stairs). | Complex to implement. IK can cause downward drift on uneven stairs. Requires animation rig/work. |
| Partial Ramps (each step sloped)   | *Medium*      | Model stairs as a series of small ramps (trapezoids) instead of vertical edges.  | No sudden step jumps. Retains stair feel and control. | Must remodel level geometry. Players might “slide” on ramps if too steep (tune friction). |
| Cinematic Climb (e.g. “press-up”) | *Low/Med*     | Disable physics on stairs and play a pre-baked stair animation sequence on input. | Guaranteed smooth animation. Simple in engine logic. | No mid-stair control. Breaks player agency and blends. Feels archaic in modern games. |

Each option is engine-agnostic in concept. For example, any engine can increase character step height and shrink the capsule, or overlay invisible ramp colliders. IK/animation fixes require an animation system or rig (like Unreal Control Rig or Unity’s IK). The best approach often combines fixes: start with tuning stepOffset and capsule, and if jitter remains, add a ramp/ghost collider solution. 

---

```plaintext
**AI Task Prompt:** Fix Stepped Stairs and Heavy-Weapon Sprint Animation

**Objectives:** Ensure the player moves smoothly up/down all stairs, and implements weight-based differences in the sprinting pose. The player should never “catch” on stairs, and sprint stance should change plausibly with weapon weight.

**Required Inputs (files/data to supply):**  
- Map and level geometry files containing stairs (e.g. `Level1.map`, `Level2.map`).  
- Stair mesh assets and collision models (e.g. `StairMesh_Residential.fbx`, `StairMesh_Modern.fbx`).  
- Player movement/collision code (e.g. `CharacterController.cpp` or `PlayerMovement.cs`) and physics settings (capsule height, radius, stepOffset, slope limit).  
- Animation assets and rigs: player skeleton/rig file (e.g. `PlayerRig.fbx`) and current animations (`Anim_Run.anim`, `Anim_Sprint.anim`, `Anim_ClimbStairs.anim`).  
- Weapon data, including weight parameters for each weapon (`WeaponsData.json` with fields like `id`, `mass`, etc.).  

**Desired Outputs:**  
- Pseudocode or code patches to adjust the character controller (stepOffset, slope limits, capsule size).  
- Updated or new colliders: e.g. an invisible inclined collider (or “ghost” stair mesh) for each staircase.  
- Animation modifications or setup: e.g. a blend tree configuration, additive animations, or IK rig setup to alter the sprint pose based on weapon weight.  
- A testing/checklist report describing how to verify the fixes (e.g. steps to reproduce, expected results).

**Constraints:**  
- Do not assume a specific game engine; use engine-neutral descriptions (e.g. “character has a capsule collider height and step-height parameter”).  
- All changes should support a target framerate (e.g. ≥60 FPS) on typical hardware.  
- Maintain existing walk/run/playstyles; avoid introducing a full cutscene for each stair (unless explicitly chosen as an approach).  

**Performance Targets (examples):**  
- *Stair traversal:* target a maximum ascent step of ~0.25–0.30 m with no visible stutter (vertical jitter < 0.02 m). The player’s movement through stairs should not slow the game below target FPS.  
- *Sprint pose:* with the heaviest weapon (weight = max in data), the player’s torso lean/backward offset should be ~10–15° more than unarmed sprint. Running speed should adjust slightly (e.g. heavy sprint ≤ 75% of light sprint speed) to feel realistic.

**Acceptance Criteria:**  
- **Stepless Stairs:** On any staircase, the player ascends/descends continuously without pausing at each stair edge. There should be no frames where the character’s feet visibly collide and bounce at a step (i.e., no “step jolt”). Camera/head motion remains smooth.  
- **Capsule and Collider:** The player’s capsule collider does not snag on stair edges. The player should be able to climb stairs up to the configured stepHeight and slope without jumping.  
- **Sprint Variance:** When sprinting, the player’s stance shifts with weapon weight: heavy weapons make the character lean or recoil more. The change is subtle but discernible; it should not break the run cycle or clip through world geometry.  
- **Performance:** The fixes must not introduce significant overhead (e.g. complex IK per-frame) that drops the FPS below targets during normal play.  

**Step-by-Step Tasks:**  
1. **Assess Stair Geometry:** For each map file (e.g. `Level1.map`, etc.), identify all stair objects and measure their risers (vertical height of each step). Document the tallest step (e.g. 0.25 m).  
2. **Check Controller Settings:** Open the player movement code. If `stepOffset` (max step height) is less than the measured stair risers, increase it to match or slightly exceed the tallest stair. Likewise, ensure the capsule height/radius and slope limit allow ascending the stairs. If necessary, reduce the capsule radius to avoid lip collisions and set slope limit > staircase angle.  
3. **Implement Ramp Collider:** For each staircase asset, add an invisible collider: e.g. a single box or plane rotated to form a continuous ramp from bottom to top. Disable (or ignore collision of) the visual stair collider. Confirm that walking on this ramp smoothly lifts the character. This uses the “invisible ramp” trick.  
4. **Ghost Stairs (Alternative):** Optionally, create a second mesh for each stair with very shallow steps (ghost stairs), overlay it on the real stairs, and enable collision on it only. Place these ghost meshes on a separate collision layer so that physics objects (crates, NPCs) don’t collide with them.  
5. **Adjust Foot Placement:** If bumps remain, configure the animation system’s foot-placement or IK rig: use a simplified flat collision under stairs and enable foot tracing against the stair surface, as in Unreal’s Foot Placement node. Tune the pelvis stiffness so feet don’t overshoot.  
6. **Sprint Pose Blend Tree:** In the animation setup (Animator/AnimBlueprint), create or update a blend tree. Add a parameter (e.g. `weaponWeight`). Use it to blend between a neutral sprint pose and a heavier pose (or apply an additive “lean-back” animation clip weighted by `weaponWeight`). For example, define `leanAngle = baseLean + k * weaponWeight`. Insert this into the upper-body layer of the sprint animation.  
7. **Pose Library/Curves:** If no blend system exists, use animation curves or scripts: e.g. in code, read the weapon weight, compute a rotation around the spine joint, and apply it during sprint. Alternatively, store key poses for “light” and “heavy” sprint and interpolate based on weight.  
8. **Validation Tests:** Create a test plan: Run up each flight of stairs at normal run speed and observe. The character’s vertical position should increase smoothly (no halts). Check with debug: log the player’s Y-offset variance on stairs (<0.02). Test sprint animations with the lightest and heaviest weapons and confirm the torso tilt difference (~10°) and a small speed reduction.  
9. **Edge Cases:** Test extremely tall single steps (above offset): either make them non-climbable (forces jump) or lower them. Test thin/wide stairs and narrow colliders. For dynamic objects on stairs, ensure they sit on the real mesh (not the ghost).  
10. **Document Changes:** In code comments or a design doc, note all parameter values used (e.g. `StepOffset=0.30f m, CapsuleRadius=0.25f`), the names of new colliders or meshes, and sample outputs (e.g. before/after step curves).

**Sample Parameter Values:**  
- `maxStepHeight = 0.30` (meters)  
- `slopeLimit = 50` (degrees)  
- `capsuleRadius = 0.25` (m), `capsuleHeight = 1.8` (m)  
- Sprint `baseLean = 0°`, `leanPerUnitWeight = 15° * (weaponWeight / maxWeight)`  
- Target framerate ≥ 60 FPS on mid-range hardware.  

**Outputs:** Return code or pseudocode snippets for each change, annotated with what file to modify. For example:  
```diff
// In PlayerController.cpp
controller.stepOffset = 0.30f;    // Raised above tallest stair (0.25m)
controller.slopeLimit = 50.0f;    // Allow steep stairs
controller.radius = 0.25f;        // Slimmer capsule to clear edges
// Added after movement:
Vector3 down;
if (Physics.Raycast(position, Vector3.down, out hit, 2f))
    controller.Move(Vector3.down * (hit.distance - desiredFootHeight));  // Snap to ground
```  
And describe in words the collider and animation adjustments made. The prompt should guide implementing and testing each item step-by-step.

