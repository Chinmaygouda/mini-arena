// src/weapons/weaponTextures.ts
// High-performance procedural PBR textures and bump maps for FPS weapons.
// Generates photorealistic wood grain, brushed gun steel, stippled polymer,
// and tactical ballistic weave with zero external network downloads.

import * as THREE from 'three';

const textureCache = new Map<string, THREE.CanvasTexture>();

function getOrCreateCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Cleanly attaches diffuse and bump maps to a standard material when available,
 * preventing undefined property console warnings in headless environments.
 */
export function applyPBRTexture(
  material: THREE.MeshStandardMaterial,
  textures: { map: THREE.CanvasTexture | null; bumpMap: THREE.CanvasTexture | null },
  bumpScale = 0.002
): void {
  if (textures.map) {
    material.map = textures.map;
    material.needsUpdate = true;
  }
  if (textures.bumpMap) {
    material.bumpMap = textures.bumpMap;
    material.bumpScale = bumpScale;
    material.needsUpdate = true;
  }
}

/**
 * Procedural Russian Birch / Mahogany Wood Grain Texture & Bump Map
 * Used on AK-47 stock, handguards, and grips.
 */
export function getWoodGrainTextures(): { map: THREE.CanvasTexture | null; bumpMap: THREE.CanvasTexture | null } {
  if (typeof document === 'undefined') return { map: null, bumpMap: null };

  const mapKey = 'ak47_wood_diffuse';
  const bumpKey = 'ak47_wood_bump';

  if (textureCache.has(mapKey) && textureCache.has(bumpKey)) {
    return {
      map: textureCache.get(mapKey)!,
      bumpMap: textureCache.get(bumpKey)!,
    };
  }

  const canvas = getOrCreateCanvas(512, 512);
  const bumpCanvas = getOrCreateCanvas(512, 512);
  if (!canvas || !bumpCanvas) return { map: null, bumpMap: null };

  const ctx = canvas.getContext('2d')!;
  const bctx = bumpCanvas.getContext('2d')!;

  // 1. Base wood gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, '#782d12');
  grad.addColorStop(0.3, '#9c3d18');
  grad.addColorStop(0.5, '#6a250d');
  grad.addColorStop(0.75, '#a4421b');
  grad.addColorStop(1.0, '#752b11');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);

  // 2. High-frequency fibrous growth rings
  const ringCount = 180;
  for (let i = 0; i < ringCount; i++) {
    const y = (i / ringCount) * 512;
    const waveAmp = 18 + Math.sin(i * 0.15) * 12;
    const alpha = 0.08 + Math.random() * 0.18;
    const darkVein = (i % 7 === 0);

    ctx.beginPath();
    bctx.beginPath();
    ctx.strokeStyle = darkVein ? `rgba(40, 12, 5, ${alpha + 0.25})` : `rgba(215, 110, 55, ${alpha * 0.6})`;
    bctx.strokeStyle = darkVein ? `rgba(30, 30, 30, ${alpha * 1.5})` : `rgba(220, 220, 220, ${alpha * 0.8})`;
    ctx.lineWidth = darkVein ? 2.5 : 1.2;
    bctx.lineWidth = darkVein ? 2.0 : 1.0;

    for (let x = 0; x <= 512; x += 16) {
      const yOffset = Math.sin(x * 0.025 + i * 0.1) * waveAmp + Math.cos(x * 0.05) * 4;
      if (x === 0) {
        ctx.moveTo(x, y + yOffset);
        bctx.moveTo(x, y + yOffset);
      } else {
        ctx.lineTo(x, y + yOffset);
        bctx.lineTo(x, y + yOffset);
      }
    }
    ctx.stroke();
    bctx.stroke();
  }

  // 3. Micro wood pores & satin chatter marks
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const bData = bctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  const bdata = bData.data;

  for (let p = 0; p < data.length; p += 4) {
    if (Math.random() < 0.08) {
      const noise = (Math.random() - 0.5) * 22;
      data[p] = Math.max(0, Math.min(255, data[p] + noise));
      data[p + 1] = Math.max(0, Math.min(255, data[p + 1] + noise * 0.6));
      data[p + 2] = Math.max(0, Math.min(255, data[p + 2] + noise * 0.4));

      const bNoise = (Math.random() - 0.5) * 40;
      bdata[p] = Math.max(0, Math.min(255, bdata[p] + bNoise));
      bdata[p + 1] = bdata[p];
      bdata[p + 2] = bdata[p];
    }
  }
  ctx.putImageData(imgData, 0, 0);
  bctx.putImageData(bData, 0, 0);

  const mapTex = new THREE.CanvasTexture(canvas);
  mapTex.wrapS = THREE.RepeatWrapping;
  mapTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  textureCache.set(mapKey, mapTex);
  textureCache.set(bumpKey, bumpTex);

  return { map: mapTex, bumpMap: bumpTex };
}

/**
 * Procedural Machined Gun Steel / Brushed Receiver Texture & Bump Map
 * Used on rifle receivers, slide barrels, dust covers, and metallic frames.
 */
export function getBrushedSteelTextures(): { map: THREE.CanvasTexture | null; bumpMap: THREE.CanvasTexture | null } {
  if (typeof document === 'undefined') return { map: null, bumpMap: null };

  const mapKey = 'steel_brushed_diffuse';
  const bumpKey = 'steel_brushed_bump';

  if (textureCache.has(mapKey) && textureCache.has(bumpKey)) {
    return {
      map: textureCache.get(mapKey)!,
      bumpMap: textureCache.get(bumpKey)!,
    };
  }

  const canvas = getOrCreateCanvas(512, 512);
  const bumpCanvas = getOrCreateCanvas(512, 512);
  if (!canvas || !bumpCanvas) return { map: null, bumpMap: null };

  const ctx = canvas.getContext('2d')!;
  const bctx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#30353c';
  ctx.fillRect(0, 0, 512, 512);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);

  // Directional hairline brush marks (longitudinal)
  const lineCount = 350;
  for (let i = 0; i < lineCount; i++) {
    const y = Math.random() * 512;
    const len = 120 + Math.random() * 380;
    const x = Math.random() * 512;
    const tone = Math.random() > 0.5 ? 255 : 0;
    const alpha = 0.03 + Math.random() * 0.08;

    ctx.strokeStyle = `rgba(${tone}, ${tone}, ${tone}, ${alpha})`;
    ctx.lineWidth = 0.8 + Math.random() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();

    bctx.strokeStyle = `rgba(${tone}, ${tone}, ${tone}, ${alpha * 1.5})`;
    bctx.lineWidth = ctx.lineWidth;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + len, y);
    bctx.stroke();
  }

  // Subtle stamped tooling marks & subtle edge highlights
  for (let y = 32; y < 512; y += 96) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(0, y, 512, 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, y + 2, 512, 2);

    bctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    bctx.fillRect(0, y, 512, 2);
    bctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    bctx.fillRect(0, y + 2, 512, 2);
  }

  const mapTex = new THREE.CanvasTexture(canvas);
  mapTex.wrapS = THREE.RepeatWrapping;
  mapTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  textureCache.set(mapKey, mapTex);
  textureCache.set(bumpKey, bumpTex);

  return { map: mapTex, bumpMap: bumpTex };
}

/**
 * Procedural Stippled Tactical Polymer Grip Texture & Bump Map
 * Used on pistol grips, SMG lower receivers, and shotgun forends.
 */
export function getStippledPolymerTextures(): { map: THREE.CanvasTexture | null; bumpMap: THREE.CanvasTexture | null } {
  if (typeof document === 'undefined') return { map: null, bumpMap: null };

  const mapKey = 'polymer_stipple_diffuse';
  const bumpKey = 'polymer_stipple_bump';

  if (textureCache.has(mapKey) && textureCache.has(bumpKey)) {
    return {
      map: textureCache.get(mapKey)!,
      bumpMap: textureCache.get(bumpKey)!,
    };
  }

  const canvas = getOrCreateCanvas(256, 256);
  const bumpCanvas = getOrCreateCanvas(256, 256);
  if (!canvas || !bumpCanvas) return { map: null, bumpMap: null };

  const ctx = canvas.getContext('2d')!;
  const bctx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#22262b';
  ctx.fillRect(0, 0, 256, 256);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);

  // Micro-diamond tactile stippling grid
  const cellSize = 6;
  for (let y = 0; y < 256; y += cellSize) {
    for (let x = 0; x < 256; x += cellSize) {
      const stagger = (Math.floor(y / cellSize) % 2) * (cellSize / 2);
      const px = (x + stagger) % 256;
      const py = y;

      const jitter = (Math.random() - 0.5) * 1.5;
      const r = 1.8 + jitter;

      // Diffuse shade
      const shade = 28 + Math.floor(Math.random() * 24);
      ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      // Bump peak
      bctx.fillStyle = 'rgba(240, 240, 240, 0.45)';
      bctx.beginPath();
      bctx.arc(px - 0.6, py - 0.6, r * 0.75, 0, Math.PI * 2);
      bctx.fill();

      // Bump shadow depression
      bctx.fillStyle = 'rgba(20, 20, 20, 0.55)';
      bctx.beginPath();
      bctx.arc(px + 0.8, py + 0.8, r * 0.8, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  const mapTex = new THREE.CanvasTexture(canvas);
  mapTex.wrapS = THREE.RepeatWrapping;
  mapTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  textureCache.set(mapKey, mapTex);
  textureCache.set(bumpKey, bumpTex);

  return { map: mapTex, bumpMap: bumpTex };
}

/**
 * Procedural Carbon Fiber / Fluted Heat Shield Texture & Bump Map
 * Used on heavy sniper rifle chassis, match fluted barrel, and tactical attachments.
 */
export function getCarbonFiberTextures(): { map: THREE.CanvasTexture | null; bumpMap: THREE.CanvasTexture | null } {
  if (typeof document === 'undefined') return { map: null, bumpMap: null };

  const mapKey = 'carbon_fiber_diffuse';
  const bumpKey = 'carbon_fiber_bump';

  if (textureCache.has(mapKey) && textureCache.has(bumpKey)) {
    return {
      map: textureCache.get(mapKey)!,
      bumpMap: textureCache.get(bumpKey)!,
    };
  }

  const canvas = getOrCreateCanvas(128, 128);
  const bumpCanvas = getOrCreateCanvas(128, 128);
  if (!canvas || !bumpCanvas) return { map: null, bumpMap: null };

  const ctx = canvas.getContext('2d')!;
  const bctx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#181b1f';
  ctx.fillRect(0, 0, 128, 128);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 128, 128);

  // 2x2 Twill Carbon Weave Pattern
  const unit = 16;
  for (let y = 0; y < 128; y += unit) {
    for (let x = 0; x < 128; x += unit) {
      const isAlt = (Math.floor(x / unit) + Math.floor(y / unit)) % 2 === 0;

      // Diagonal gradient within weave block
      const twill = ctx.createLinearGradient(x, y, x + unit, y + unit);
      if (isAlt) {
        twill.addColorStop(0, '#2b3038');
        twill.addColorStop(0.5, '#424b56');
        twill.addColorStop(1, '#1b1e22');
      } else {
        twill.addColorStop(0, '#1c1f24');
        twill.addColorStop(0.5, '#353c44');
        twill.addColorStop(1, '#272b32');
      }
      ctx.fillStyle = twill;
      ctx.fillRect(x, y, unit, unit);

      // Fine carbon strand lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let s = 2; s < unit; s += 3) {
        ctx.beginPath();
        if (isAlt) {
          ctx.moveTo(x + s, y);
          ctx.lineTo(x + s, y + unit);
        } else {
          ctx.moveTo(x, y + s);
          ctx.lineTo(x + unit, y + s);
        }
        ctx.stroke();
      }

      // Bump map relief
      bctx.fillStyle = isAlt ? '#a0a0a0' : '#606060';
      bctx.fillRect(x, y, unit, unit);
      bctx.strokeStyle = isAlt ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)';
      bctx.strokeRect(x + 0.5, y + 0.5, unit - 1, unit - 1);
    }
  }

  const mapTex = new THREE.CanvasTexture(canvas);
  mapTex.wrapS = THREE.RepeatWrapping;
  mapTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  textureCache.set(mapKey, mapTex);
  textureCache.set(bumpKey, bumpTex);

  return { map: mapTex, bumpMap: bumpTex };
}

/**
 * Procedural Ballistic Tactical Fabric / Glove Texture & Bump Map
 * Used on operative tactical combat gloves and uniform sleeves.
 */
export function getTacticalFabricTextures(): { map: THREE.CanvasTexture | null; bumpMap: THREE.CanvasTexture | null } {
  if (typeof document === 'undefined') return { map: null, bumpMap: null };

  const mapKey = 'fabric_tactical_diffuse';
  const bumpKey = 'fabric_tactical_bump';

  if (textureCache.has(mapKey) && textureCache.has(bumpKey)) {
    return {
      map: textureCache.get(mapKey)!,
      bumpMap: textureCache.get(bumpKey)!,
    };
  }

  const canvas = getOrCreateCanvas(128, 128);
  const bumpCanvas = getOrCreateCanvas(128, 128);
  if (!canvas || !bumpCanvas) return { map: null, bumpMap: null };

  const ctx = canvas.getContext('2d')!;
  const bctx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#222830';
  ctx.fillRect(0, 0, 128, 128);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 128, 128);

  // Micro-weave cross-hatch pattern
  const step = 4;
  for (let x = 0; x < 128; x += step) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();

    bctx.strokeStyle = 'rgba(220, 220, 220, 0.25)';
    bctx.beginPath();
    bctx.moveTo(x, 0);
    bctx.lineTo(x, 128);
    bctx.stroke();
  }

  for (let y = 0; y < 128; y += step) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();

    bctx.strokeStyle = 'rgba(30, 30, 30, 0.35)';
    bctx.beginPath();
    bctx.moveTo(0, y);
    bctx.lineTo(128, y);
    bctx.stroke();
  }

  const mapTex = new THREE.CanvasTexture(canvas);
  mapTex.wrapS = THREE.RepeatWrapping;
  mapTex.wrapT = THREE.RepeatWrapping;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;

  textureCache.set(mapKey, mapTex);
  textureCache.set(bumpKey, bumpTex);

  return { map: mapTex, bumpMap: bumpTex };
}
