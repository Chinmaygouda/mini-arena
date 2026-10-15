import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('docs/screenshots/gun_angles');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function captureAngles() {
  console.log('=== CAPTURING GUN HOLDING ANGLES SHOWCASE ===');

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=default', '--enable-unsafe-webgpu'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  async function dismissOverlay() {
    try {
      const btn = page.locator('#btn-enter-arena, #enter-btn');
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ force: true });
      } else {
        await page.mouse.click(640, 360);
      }
    } catch {
      // Ignore
    }
    await page.evaluate(() => {
      const el = document.getElementById('lock-prompt');
      if (el) el.style.display = 'none';
    });
    await page.waitForTimeout(500);
  }

  // Camera angles relative to viewmodel anchor
  const angles = [
    {
      id: '01_first_person_hip',
      weapon: 'AK-47',
      slot: 'Digit3',
      title: 'First-Person Hip Hold (Player POV)',
      desc: 'Standard in-game first-person perspective showing weapon framing, arms, and HUD',
      camSetup: null,
      ads: false,
    },
    {
      id: '02_first_person_ads',
      weapon: 'AK-47',
      slot: 'Digit3',
      title: 'First-Person ADS (Aim Down Sights)',
      desc: 'Rifle shouldered and raised to eye line; iron sights aligned with reticle',
      camSetup: null,
      ads: true,
    },
    {
      id: '03_right_side_profile',
      weapon: 'AK-47',
      slot: 'Digit3',
      title: 'Right Side Profile View',
      desc: 'Direct side view showing trigger hand, pistol grip angle, and low elbow bend',
      camSetup: { pos: [0.65, -0.15, -0.28], look: [0.08, -0.15, -0.28] },
      ads: false,
    },
    {
      id: '04_left_side_profile',
      weapon: 'AK-47',
      slot: 'Digit3',
      title: 'Left Side Profile View',
      desc: 'Support arm profile showing left hand cupping the handguard and natural elbow drop',
      camSetup: { pos: [-0.65, -0.15, -0.28], look: [0.08, -0.15, -0.28] },
      ads: false,
    },
    {
      id: '05_quarter_front_right',
      weapon: 'AK-47',
      slot: 'Digit3',
      title: '3/4 Front-Right (Cinematic Quarter)',
      desc: 'Three-quarter isometric angle showcasing 3D depth of both hands gripping the rifle',
      camSetup: { pos: [0.45, 0.05, -0.75], look: [0.08, -0.15, -0.30] },
      ads: false,
    },
    {
      id: '06_quarter_front_left',
      weapon: 'AK-47',
      slot: 'Digit3',
      title: '3/4 Front-Left (Support Hand & Mag)',
      desc: 'Front-left angle showing left fingers wrapped under the handguard and curved magazine',
      camSetup: { pos: [-0.45, 0.05, -0.75], look: [0.08, -0.15, -0.30] },
      ads: false,
    },
    {
      id: '07_quarter_rear_right',
      weapon: 'AK-47',
      slot: 'Digit3',
      title: '3/4 Rear Over-The-Shoulder View',
      desc: 'Over-the-shoulder perspective showing weapon alignment toward forward horizon',
      camSetup: { pos: [0.38, 0.10, 0.15], look: [0.08, -0.12, -0.38] },
      ads: false,
    },
    {
      id: '08_top_down_overhead',
      weapon: 'AK-47',
      slot: 'Digit3',
      title: 'Top-Down Overhead View',
      desc: 'Overhead view showing dual-arm triangle stance and downward/outward elbow flare',
      camSetup: { pos: [0.08, 0.65, -0.28], look: [0.08, -0.15, -0.28], up: [0, 0, -1] },
      ads: false,
    },
    {
      id: '09_front_barrel_view',
      weapon: 'AK-47',
      slot: 'Digit3',
      title: 'Front Barrel View (Shooter Stance)',
      desc: 'Looking down the barrel into the hold, showing finger wrap and forearm posture',
      camSetup: { pos: [0.08, -0.12, -0.90], look: [0.08, -0.15, -0.30] },
      ads: false,
    },
    {
      id: '10_shotgun_quarter_front',
      weapon: 'Shotgun',
      slot: 'Digit4',
      title: 'Combat Shotgun — 3/4 Front-Right Angle',
      desc: 'Quarter angle showing left hand cradling ribbed pump slide and right hand on stock',
      camSetup: { pos: [0.45, 0.05, -0.75], look: [0.08, -0.15, -0.30] },
      ads: false,
    },
    {
      id: '11_shotgun_right_side',
      weapon: 'Shotgun',
      slot: 'Digit4',
      title: 'Combat Shotgun — Right Side Profile',
      desc: 'Side view showing shotgun receiver, pump slide grip, and elbow bend angle',
      camSetup: { pos: [0.65, -0.15, -0.28], look: [0.08, -0.15, -0.28] },
      ads: false,
    },
    {
      id: '12_pistol_quarter_front',
      weapon: 'Pistol',
      slot: 'Digit1',
      title: 'Tactical Pistol — 3/4 Front-Right Angle',
      desc: 'Two-handed compact pistol grasp showing support hand wrapping around shooting hand',
      camSetup: { pos: [0.40, 0.02, -0.65], look: [0.08, -0.15, -0.28] },
      ads: false,
    },
  ];

  console.log('-> Navigating to http://localhost:5173/?debug=1...');
  await page.goto('http://localhost:5173/?debug=1', { waitUntil: 'networkidle' });
  await dismissOverlay();
  await page.waitForTimeout(600);

  const capturedImages = [];
  let currentSlot = 'Digit3';

  for (const angle of angles) {
    if (angle.slot !== currentSlot) {
      console.log(`-> Switching weapon to ${angle.weapon} (${angle.slot})...`);
      await page.keyboard.press(angle.slot);
      currentSlot = angle.slot;
      await page.waitForTimeout(700);
    }

    console.log(`-> Capturing angle: ${angle.title}...`);

    await page.evaluate(({ camSetup, ads }) => {
      const THREE = window.THREE;
      const camera = window.__camera;
      const input = window.__inputManager;

      input.isAds = ads;

      if (!camSetup) {
        window.__debugCamera = null;
      } else {
        if (!window.__debugCamera) {
          const dbgCam = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.01, 100);
          camera.add(dbgCam);
          window.__debugCamera = dbgCam;
        }
        window.__debugCamera.position.set(camSetup.pos[0], camSetup.pos[1], camSetup.pos[2]);
        if (camSetup.up) {
          window.__debugCamera.up.set(camSetup.up[0], camSetup.up[1], camSetup.up[2]);
        } else {
          window.__debugCamera.up.set(0, 1, 0);
        }
        window.__debugCamera.userData.target = new THREE.Vector3(camSetup.look[0], camSetup.look[1], camSetup.look[2]);
      }
    }, { camSetup: angle.camSetup, ads: angle.ads });

    await page.waitForTimeout(400);

    const filename = `${angle.id}.png`;
    const filePath = path.join(OUT_DIR, filename);
    await page.screenshot({ path: filePath });
    console.log(`   Saved ${filename}`);

    capturedImages.push({
      ...angle,
      filename,
      filePath,
      relPath: `./${filename}`,
    });
  }

  // Generate composite HTML contact sheet
  console.log('-> Generating composite contact sheet...');
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Gun Holding Angles Showcase</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #090b10;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 30px;
    }
    header {
      margin-bottom: 25px;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 15px;
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      color: #38bdf8;
      letter-spacing: -0.5px;
    }
    p.subtitle {
      color: #94a3b8;
      font-size: 14px;
      margin-top: 5px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .card img {
      width: 100%;
      height: auto;
      display: block;
      border-bottom: 1px solid #1e293b;
    }
    .card-info {
      padding: 12px 14px;
      flex: 1;
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: #f8fafc;
      margin-bottom: 4px;
    }
    .card-desc {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <header>
    <h1>Mini Arena — Weapon Holding Angles Showcase</h1>
    <p class="subtitle">Multi-perspective visual audit of analytical two-bone IK arms attachment, socket alignment, and natural hand grasp poses</p>
  </header>
  <div class="grid">
    ${capturedImages.map(img => `
      <div class="card">
        <img src="${img.filename}" alt="${img.title}" />
        <div class="card-info">
          <div class="card-title">${img.title}</div>
          <div class="card-desc">${img.desc}</div>
        </div>
      </div>
    `).join('\n')}
  </div>
</body>
</html>
  `;

  const htmlPath = path.join(OUT_DIR, 'contact_sheet.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');

  // Load contact sheet and capture full-res showcase image
  const sheetPage = await context.newPage();
  await sheetPage.setViewportSize({ width: 1920, height: 1800 });
  await sheetPage.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
  await sheetPage.waitForTimeout(600);

  const showcasePath = path.join(OUT_DIR, 'gun_holding_angles_showcase.png');
  await sheetPage.screenshot({ path: showcasePath, fullPage: true });
  console.log(`\n=== SHOWCASE SAVED: ${showcasePath} ===`);

  await browser.close();
}

captureAngles().catch(err => {
  console.error('Failed to capture gun angles:', err);
  process.exit(1);
});
