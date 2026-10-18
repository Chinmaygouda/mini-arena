# Research Findings on Reload Animations

Top-tier FPS titles spend **significant effort** creating unique, weapon-specific reload animations. For example, the indie game *Road to Vostok* used over 120 custom animations – including “incredibly lifelike reloading animations” – for just five weapons. Likewise, professional FPS animation packs explicitly include **separate clips for reload and empty-reload states**. These extra states (e.g. tactical vs. empty reload) and detail “most easily raise” a game’s realism. In short, AAA practice is to *analyze real reload sequences* for each gun and implement a full set of hand/magazine motions. 

- *Observe real guns.* Study how a soldier or mechanic reloads each weapon. Look at the fluid weight shifts, hand grips, and magazine motions. This empirical approach is essential: as one guide notes, “the most effective reload animations adhere to fundamental animation principles” and should be built from real-world references.  
- *Use proper IK for two hands.* Modern FPS systems use inverse-kinematics so the off-hand stays attached to the weapon. This avoids the classic “floating hand” bug: the **left hand tracks the gun during firing but can release it during reload**. Ensuring the left hand grips the correct point (magazine or fore-end) with IK will prevent visible disconnects.  
- *Distinct animation stages.* A magazine reload typically includes: **ejecting the spent mag, reaching for a new one, inserting it, and (if needed) racking the slide or bolt**. Shotguns, by contrast, often load one shell at a time. Snipers/revolvers may have multi-step or cylinder-open sequences. Each step should be keyed so it looks intentional (for example, seeing the mag click into place, or the shell seating). 

### Weapon-Type Reload Guidelines

- **Pistols (e.g. M9):** Typically one-handed magazine reloads. An animation might *tilt the pistol up or to the side*, tap the magazine release, let the empty magazine drop, then insert a fresh magazine and slide it home. The guide recommends smooth hand-to-magazine contact and a distinct “click” when seating the mag.  
- **SMGs (e.g. Cyclone-9):** Similar to rifles, use two hands. One hand holds/supports the gun; the other grabs and swaps the box magazine. Emphasize rapid but controlled movement, possibly with a slight weapon recoil/rock as the mag is inserted.  
- **Rifles (AK-47):** Also two-handed magazine reloads. A common technique is to **flip or tilt the rifle** to let gravity assist ejection (as user suggested). The spent magazine can fall out under its own weight while the user’s hand moves to catch/insert a new mag. Then one hand may come up to **rack the charging handle** (or tap the bolt) if the gun is empty. This sequence – mag out, mag in, bolt action – matches the “magazine reload” pattern described in industry guidelines.  
- **Shotgun (SPAS-12):** Likely a pump-action with individual shells. The animation should load shells one by one into the chamber or tubular mag. For example, the left hand might bring a shell from a bandolier or belt, align it with the loading gate, and push it in (the magazine count increments in the middle of the motion). Repeat until capacity or ammo is gone, then pump the fore-end to chamber. This reflects the “individual shell loading” type from industry guidance. The left hand should smoothly return to the foregrip afterward.  
- **Sniper Rifle (AW-50):** If it uses a detachable box mag, treat it like a large rifle reload (mag out/in, then bolt). If it’s single-shot or internal magazine, an alternative is to animate **individual rounds**: the user could open the breach or cartridge door, take each round (user’s idea of “6 individual animations”) and load them. This mimics a realistic heavy weapon reload and ensures each bullet insertion is visible (like loading bolts or shells in older sniper rifles).  

Each weapon’s reload should end with the gun returned to its ready position and hands synchronized. Crucially, do **not** reuse one generic animation for all guns. AAA/FPS practice is to have unique sequences for each gun’s geometry and reload style. Also include separate clips for *empty* vs. *tactical* reloads if feasible – for example, racking the bolt only when the magazine is depleted. 

### Summary of Proposed Animations
- **Pistol (M9):** Raise and tilt gun ~30–60°; press mag release so empty mag drops out to the side; left hand grabs new mag, inserts it; slide the gun forward/back to chamber; return to ready.  
- **SMG (Cyclone-9):** Hold gun steady; left hand releases and removes mag (letting it drop or hold it deliberately); bring in fresh mag vertically; insert and lock; quick bolt or tap to chamber if needed.  
- **Rifle (AK-47):** Flip the rifle right (or downward) to eject mag by gravity; left hand grabs the fallen mag; right hand steadies gun; left inserts new mag; right hand pulls charging handle or taps it if empty; return to hold.  
- **Shotgun (SPAS-12):** Bring gun close to body; left hand scoops a shell from waist; push shell into side-loading port/receptacle; repeat for additional shells (show each being placed); then pump the fore-end to chamber last shell.  
- **Sniper (AW-50):** (If mag-fed) Flip or lower to eject big mag; drop it out; insert loaded mag; cycle bolt. (If single rounds) Cock open rear, take one bullet at a time from an ammo pouch, slot each round into chamber or magazine; close breach.  

These sequences should be animated so the hands clearly touch and manipulate the correct parts, matching the weapon model. The left/right hand motions must stay on the gun via IK so that hands never visibly detach (avoiding the “floating hand” issue described in modern animation guides). 

## Implementation Prompt for AI

Use the following prompt to instruct your AI/code agent to improve the reload animations:

``` 
### UX Improvement: Realistic Reload Animations

You are a senior FPS programmer and animator (TypeScript/Three.js). Inspect the current reload implementation for each weapon (pistol, SMG, AK-47, SPAS-12, AW-50). Identify how the model, hand joints, and animation clips are set up.

**Tasks:**  
- For each weapon, create a distinct reload sequence as outlined above. Do not use a shared generic animation.  
- Pistol: animate the gun tipping and pressing magazine release, then inserting new magazine and sliding it home.  
- SMG/AK-47: animate holding/releasing the mag, new mag insertion, and racking (bolt/charging). Consider flipping the rifle so mag drops naturally.  
- Shotgun: animate picking up shells one by one, inserting each into the magazine tube or breach, and then pumping the action.  
- Sniper: animate removing/inserting the box magazine (or loading individual rounds if single-shot), then charging the bolt.  

Use IK so the left hand tracks the weapon properly. Sync each hand’s motion with the gun parts (magazine, shell, bolt). Update the animation state machine and keyframes accordingly. Preserve existing ammo counting and cooldown rules.

**Verify:** Play the game. For each weapon, execute reload with both full and empty mags, while standing, moving, and after firing. Ensure the hands stay attached to the weapon, ammo updates occur at the correct moment, and there are no abrupt snaps. The gun should end in the normal ready/aim pose. Test with pointer lock and in all maps.

**Report:** Provide the files modified, a description of the old vs. new animation setup, and evidence (screenshots or video frames) showing the improved reload sequence for each weapon.

Priority: Implement the described reload animations accurately and verify them in the running game before any other changes.
```

## Summary of Animations by Weapon

- **M9 Pistol:** Push pistol forward (~30°), mag drops left, insert new mag, slide pistol back.  
- **Cyclone-9 SMG:** Stabilize gun, detach mag downward, insert new mag, chamber if needed.  
- **AK-47 Rifle:** Tilt rifle right (magazine side) so empty mag falls, swap mag, pull charging handle.  
- **SPAS-12 Shotgun:** Load shells one at a time into side breach, then pump fore-end.  
- **AW-50 Sniper:** Remove/insert heavy mag (or load rounds individually), then cycle bolt handle.  

Each animation should look natural and weapon-specific, in line with AAA FPS animation principles. The prompt above tells the agent exactly how to implement and test these improvements.