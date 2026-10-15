import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { assertWeapon, equipWeapon } from './step0-capture-harness.mjs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runDiagnostics() {
  console.log('=== STEP 1: MEASURE HAND RIG DIAGNOSTICS ACROSS ALL WEAPONS ===');

  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
    headless: true,
    args: ['--enable-unsafe-webgpu', '--use-angle=d3d11'],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });

  await page.goto('http://localhost:5173/?debug=1');

  // Dismiss overlay
  try {
    const btn = page.locator('#btn-enter-arena, #enter-btn');
    if (await btn.isVisible({ timeout: 1500 })) {
      await btn.click({ force: true });
    }
  } catch {
    // Ignore
  }
  await page.evaluate(() => {
    const el = document.getElementById('lock-prompt');
    if (el) el.style.display = 'none';
  });
  await page.waitForTimeout(600);

  const weaponsToAudit = [
    { id: 'assault_rifle', hudName: 'Assault Rifle', label: 'AK-47 (Assault Rifle)' },
    { id: 'pistol', hudName: 'Tactical Pistol', label: 'Tactical Pistol' },
    { id: 'smg', hudName: 'Rapid SMG', label: 'Rapid SMG' },
    { id: 'shotgun', hudName: 'Combat Shotgun', label: 'Combat Shotgun' },
    { id: 'sniper', hudName: 'Precision Sniper', label: 'Precision Sniper' },
  ];

  const results = [];

  for (const weapon of weaponsToAudit) {
    console.log(`\n======================================================`);
    console.log(`Auditing ${weapon.label}...`);
    await equipWeapon(page, weapon.id, weapon.hudName);
    await page.waitForTimeout(500);

    const auditData = await page.evaluate(() => {
      const THREE = window.THREE;
      const vm = window.__viewmodel;
      const skinned = vm.armsRig.skinnedArms;
      const animator = vm.animator;
      const sm = skinned.skinnedMesh;
      const geom = sm.geometry;
      const skeleton = sm.skeleton;

      // Ensure matrices are fresh
      vm.group.updateMatrixWorld(true);
      vm.armsRig.group.updateMatrixWorld(true);

      // Extract all world triangles of current weapon
      const gunTriangles = [];
      animator.weaponGroup.traverse((obj) => {
        if (obj.isMesh && obj.visible && obj.geometry) {
          const g = obj.geometry;
          const pos = g.attributes.position;
          const idx = g.index;
          const m = obj.matrixWorld;

          if (idx) {
            for (let i = 0; i < idx.count; i += 3) {
              const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(m);
              const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1)).applyMatrix4(m);
              const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2)).applyMatrix4(m);
              gunTriangles.push({ a, b, c });
            }
          } else {
            for (let i = 0; i < pos.count; i += 3) {
              const a = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m);
              const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(m);
              const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2).applyMatrix4(m);
              gunTriangles.push({ a, b, c });
            }
          }
        }
      });

      // Closest point on triangle (Ericson RTCD 5.1.5)
      const diff = new THREE.Vector3();
      const edge0 = new THREE.Vector3();
      const edge1 = new THREE.Vector3();

      function closestPointOnTriangle(p, a, b, c, out) {
        edge0.subVectors(b, a);
        edge1.subVectors(c, a);
        const v0 = edge0;
        const v1 = edge1;
        const v2 = p.clone().sub(a);

        const d00 = v0.dot(v0);
        const d01 = v0.dot(v1);
        const d11 = v1.dot(v1);
        const d20 = v2.dot(v0);
        const d21 = v2.dot(v1);

        const denom = d00 * d11 - d01 * d01;
        let v = (d11 * d20 - d01 * d21) / denom;
        let w = (d00 * d21 - d01 * d20) / denom;
        let u = 1.0 - v - w;

        // Clamp to triangle simplex
        if (u < 0) {
          // Point on edge BC
          const bc = c.clone().sub(b);
          const t = Math.max(0, Math.min(1, p.clone().sub(b).dot(bc) / bc.dot(bc)));
          out.copy(b).addScaledVector(bc, t);
        } else if (v < 0) {
          // Point on edge AC
          const ac = c.clone().sub(a);
          const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ac) / ac.dot(ac)));
          out.copy(a).addScaledVector(ac, t);
        } else if (w < 0) {
          // Point on edge AB
          const ab = b.clone().sub(a);
          const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.dot(ab)));
          out.copy(a).addScaledVector(ab, t);
        } else {
          out.set(
            u * a.x + v * b.x + w * c.x,
            u * a.y + v * b.y + w * c.y,
            u * a.z + v * b.z + w * c.z
          );
        }
        return out;
      }

      function distToGunMesh(p) {
        let minDist = Infinity;
        const pt = new THREE.Vector3();
        for (let i = 0; i < gunTriangles.length; i++) {
          const tri = gunTriangles[i];
          closestPointOnTriangle(p, tri.a, tri.b, tri.c, pt);
          const d = p.distanceTo(pt);
          if (d < minDist) minDist = d;
        }
        return minDist;
      }

      // Ray-triangle intersection for point-in-mesh parity
      // Moller-Trumbore
      function rayIntersectsTri(orig, dir, a, b, c) {
        const e1 = b.clone().sub(a);
        const e2 = c.clone().sub(a);
        const pvec = dir.clone().cross(e2);
        const det = e1.dot(pvec);
        if (Math.abs(det) < 1e-7) return false;
        const invDet = 1.0 / det;
        const tvec = orig.clone().sub(a);
        const u = tvec.dot(pvec) * invDet;
        if (u < 0.0 || u > 1.0) return false;
        const qvec = tvec.clone().cross(e1);
        const v = dir.dot(qvec) * invDet;
        if (v < 0.0 || u + v > 1.0) return false;
        const t = e2.dot(qvec) * invDet;
        return t > 1e-5;
      }

      function isPointInsideGun(p) {
        // Cast ray along +X
        const dir = new THREE.Vector3(1, 0, 0);
        let count = 0;
        for (let i = 0; i < gunTriangles.length; i++) {
          const tri = gunTriangles[i];
          if (rayIntersectsTri(p, dir, tri.a, tri.b, tri.c)) {
            count++;
          }
        }
        return (count % 2) === 1;
      }

      // Pre-identify bone indices for Hand R and Hand L
      const boneNames = skeleton.bones.map(b => b.name);
      const rightHandBoneIndices = new Set();
      const leftHandBoneIndices = new Set();
      boneNames.forEach((name, idx) => {
        if (name.includes('R') && (name.includes('hand') || name.includes('palm') || name.includes('thumb') || name.includes('f_'))) {
          rightHandBoneIndices.add(idx);
        }
        if (name.includes('L') && (name.includes('hand') || name.includes('palm') || name.includes('thumb') || name.includes('f_'))) {
          leftHandBoneIndices.add(idx);
        }
      });

      // Calculate skinned vertex positions in world space
      const skinIndexAttr = geom.attributes.skinIndex;
      const skinWeightAttr = geom.attributes.skinWeight;
      const vertCount = geom.attributes.position.count;

      const rightHandVerts = [];
      const leftHandVerts = [];
      const scratchV = new THREE.Vector3();

      for (let i = 0; i < vertCount; i++) {
        // Find which hand this vertex predominantly belongs to
        let rWeight = 0;
        let lWeight = 0;
        for (let k = 0; k < 4; k++) {
          const bIdx = skinIndexAttr.getComponent(i, k);
          const w = skinWeightAttr.getComponent(i, k);
          if (rightHandBoneIndices.has(bIdx)) rWeight += w;
          if (leftHandBoneIndices.has(bIdx)) lWeight += w;
        }

        if (rWeight > 0.4 || lWeight > 0.4) {
          sm.applyBoneTransform(i, scratchV);
          const worldV = scratchV.clone().applyMatrix4(sm.matrixWorld);
          if (rWeight > 0.4) rightHandVerts.push(worldV);
          if (lWeight > 0.4) leftHandVerts.push(worldV);
        }
      }

      // Evaluate hand metrics helper
      function measureHand(isLeft) {
        const upper = isLeft ? skinned.upperArmL : skinned.upperArmR;
        const fore = isLeft ? skinned.forearmL : skinned.forearmR;
        const hand = isLeft ? skinned.handL : skinned.handR;
        const socket = isLeft ? animator.socketL : animator.socketR;

        const pUpper = upper.getWorldPosition(new THREE.Vector3());
        const pFore = fore.getWorldPosition(new THREE.Vector3());
        const pHand = hand.getWorldPosition(new THREE.Vector3());
        const pSocket = socket.getWorldPosition(new THREE.Vector3());

        const upperLen = pUpper.distanceTo(pFore);
        const foreLen = pFore.distanceTo(pHand);
        const shoulderToTarget = pUpper.distanceTo(pSocket);

        // Stretch applied
        const stretchScaleUpper = upper.scale.y;
        const stretchScaleFore = fore.scale.y;

        // Elbow angle
        const vUpper = pFore.clone().sub(pUpper).normalize();
        const vFore = pHand.clone().sub(pFore).normalize();
        const dotElbow = Math.max(-1, Math.min(1, vUpper.dot(vFore)));
        const elbowAngleDeg = Math.acos(dotElbow) * (180 / Math.PI);

        // Pole vector
        const pole = isLeft ? new THREE.Vector3(-0.35, -0.65, 0.05) : new THREE.Vector3(0.35, -0.65, 0.05);
        const poleSpace = 'Camera / Viewmodel Group Space';

        // Wrist-to-socket rotation error
        const qHand = hand.getWorldQuaternion(new THREE.Quaternion());
        const qSocket = socket.getWorldQuaternion(new THREE.Quaternion());
        const dotQuat = Math.abs(qHand.dot(qSocket));
        const rotErrorDeg = 2 * Math.acos(Math.min(1, dotQuat)) * (180 / Math.PI);

        // Palm center distance
        // Palm center computed from palm bones
        const palmPrefix = isLeft ? 'palm0' : 'palm0';
        const suffix = isLeft ? 'L' : 'R';
        const palmBones = [
          skeleton.getBoneByName(`${palmPrefix}1${suffix}`),
          skeleton.getBoneByName(`${palmPrefix}2${suffix}`),
          skeleton.getBoneByName(`${palmPrefix}3${suffix}`),
          skeleton.getBoneByName(`${palmPrefix}4${suffix}`),
        ].filter(Boolean);

        const palmCenter = new THREE.Vector3();
        if (palmBones.length > 0) {
          palmBones.forEach(b => palmCenter.add(b.getWorldPosition(new THREE.Vector3())));
          palmCenter.multiplyScalar(1 / palmBones.length);
        } else {
          palmCenter.copy(pHand);
        }

        const palmCenterDistMm = distToGunMesh(palmCenter) * 1000;

        // Fingertip distances
        const fingerNames = ['thumb03', 'f_index03', 'f_middle03', 'f_ring03', 'f_pinky03'];
        const fingertipDistsMm = {};
        for (const fname of fingerNames) {
          const bone = skeleton.getBoneByName(`${fname}${suffix}`);
          if (bone) {
            // Joint position + small extension to actual fingertip (~18mm)
            const tipPos = bone.getWorldPosition(new THREE.Vector3());
            const d = distToGunMesh(tipPos) * 1000;
            fingertipDistsMm[fname] = +d.toFixed(1);
          } else {
            fingertipDistsMm[fname] = null;
          }
        }

        // Count hand vertices inside gun mesh (> 0mm and > 3mm)
        const verts = isLeft ? leftHandVerts : rightHandVerts;
        let vertsInsideTotal = 0;
        let vertsDeeperThan3mm = 0;

        for (let i = 0; i < verts.length; i++) {
          const v = verts[i];
          if (isPointInsideGun(v)) {
            vertsInsideTotal++;
            const d = distToGunMesh(v);
            if (d > 0.003) {
              vertsDeeperThan3mm++;
            }
          }
        }

        return {
          upperLengthM: +upperLen.toFixed(4),
          foreLengthM: +foreLen.toFixed(4),
          totalArmReachM: +(upperLen + foreLen).toFixed(4),
          shoulderToTargetM: +shoulderToTarget.toFixed(4),
          stretchScaleUpper: +stretchScaleUpper.toFixed(2),
          stretchScaleFore: +stretchScaleFore.toFixed(2),
          elbowAngleDeg: +elbowAngleDeg.toFixed(1),
          poleVector: [pole.x, pole.y, pole.z],
          poleSpace,
          wristRotErrorDeg: +rotErrorDeg.toFixed(2),
          palmCenterDistMm: +palmCenterDistMm.toFixed(1),
          fingertipDistsMm,
          handVertsAudited: verts.length,
          vertsInsideTotal,
          vertsDeeperThan3mm,
        };
      }

      return {
        gunTriangles: gunTriangles.length,
        rightHand: measureHand(false),
        leftHand: measureHand(true),
      };
    });

    console.log(`Results for ${weapon.label}:`);
    console.log(`  Right Hand: shoulder-to-target=${auditData.rightHand.shoulderToTargetM}m (reach=${auditData.rightHand.totalArmReachM}m), palm dist=${auditData.rightHand.palmCenterDistMm}mm, verts in gun=${auditData.rightHand.vertsInsideTotal}`);
    console.log(`  Left Hand:  shoulder-to-target=${auditData.leftHand.shoulderToTargetM}m (reach=${auditData.leftHand.totalArmReachM}m), palm dist=${auditData.leftHand.palmCenterDistMm}mm, verts in gun=${auditData.leftHand.vertsInsideTotal}`);

    results.push({
      weapon: weapon.label,
      weaponId: weapon.id,
      gunTriangles: auditData.gunTriangles,
      rightHand: auditData.rightHand,
      leftHand: auditData.leftHand,
    });
  }

  // Save audit data to JSON
  const jsonPath = path.resolve('docs/hand_rig_baseline_audit.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nAudit data written to ${jsonPath}`);

  // Generate markdown report
  let md = `# Hand Rig Baseline Diagnostic Measurements (Step 1)\n\n`;
  md += `Audit captured in real Chrome with exact weapon assertion checks and geometric mesh collision queries.\n\n`;

  for (const r of results) {
    md += `## ${r.weapon} (${r.gunTriangles} gun triangles)\n\n`;
    md += `| Measurement | Right Hand | Left Hand |\n`;
    md += `|---|---|---|\n`;
    md += `| **Upper-Arm Length** | ${r.rightHand.upperLengthM} m | ${r.leftHand.upperLengthM} m |\n`;
    md += `| **Forearm Length** | ${r.rightHand.foreLengthM} m | ${r.leftHand.foreLengthM} m |\n`;
    md += `| **Total Arm Reach** | ${r.rightHand.totalArmReachM} m | ${r.leftHand.totalArmReachM} m |\n`;
    md += `| **Shoulder-to-Target Distance** | ${r.rightHand.shoulderToTargetM} m | ${r.leftHand.shoulderToTargetM} m |\n`;
    md += `| **Stretch Scale Applied** | Upper: ${r.rightHand.stretchScaleUpper}, Fore: ${r.rightHand.stretchScaleFore} | Upper: ${r.leftHand.stretchScaleUpper}, Fore: ${r.leftHand.stretchScaleFore} |\n`;
    md += `| **Elbow Angle** | ${r.rightHand.elbowAngleDeg}° | ${r.leftHand.elbowAngleDeg}° |\n`;
    md += `| **Pole Vector (and Space)** | \`[${r.rightHand.poleVector.join(', ')}]\` (${r.rightHand.poleSpace}) | \`[${r.leftHand.poleVector.join(', ')}]\` (${r.leftHand.poleSpace}) |\n`;
    md += `| **Wrist-to-Socket Rotation Error** | ${r.rightHand.wristRotErrorDeg}° | ${r.leftHand.wristRotErrorDeg}° |\n`;
    md += `| **Palm Center to Grip Surface** | ${r.rightHand.palmCenterDistMm} mm | ${r.leftHand.palmCenterDistMm} mm |\n`;
    md += `| **Thumb Tip Distance** | ${r.rightHand.fingertipDistsMm.thumb03} mm | ${r.leftHand.fingertipDistsMm.thumb03} mm |\n`;
    md += `| **Index Tip Distance** | ${r.rightHand.fingertipDistsMm.f_index03} mm | ${r.leftHand.fingertipDistsMm.f_index03} mm |\n`;
    md += `| **Middle Tip Distance** | ${r.rightHand.fingertipDistsMm.f_middle03} mm | ${r.leftHand.fingertipDistsMm.f_middle03} mm |\n`;
    md += `| **Ring Tip Distance** | ${r.rightHand.fingertipDistsMm.f_ring03} mm | ${r.leftHand.fingertipDistsMm.f_ring03} mm |\n`;
    md += `| **Pinky Tip Distance** | ${r.rightHand.fingertipDistsMm.f_pinky03} mm | ${r.leftHand.fingertipDistsMm.f_pinky03} mm |\n`;
    md += `| **Hand Vertices Inside Gun Mesh (Total)** | ${r.rightHand.vertsInsideTotal} / ${r.rightHand.handVertsAudited} | ${r.leftHand.vertsInsideTotal} / ${r.leftHand.handVertsAudited} |\n`;
    md += `| **Hand Vertices Deeper Than 3mm Inside Gun** | ${r.rightHand.vertsDeeperThan3mm} / ${r.rightHand.handVertsAudited} | ${r.leftHand.vertsDeeperThan3mm} / ${r.leftHand.handVertsAudited} |\n\n`;
  }

  const mdPath = path.resolve('docs/hand_rig_baseline_audit.md');
  fs.writeFileSync(mdPath, md, 'utf-8');
  console.log(`Markdown report written to ${mdPath}`);

  await browser.close();
}

runDiagnostics().catch(err => {
  console.error('STEP 1 DIAGNOSTICS FAILED:', err);
  process.exit(1);
});
