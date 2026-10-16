import * as THREE from 'three';

/**
 * Creates procedural 256x256 bump/normal canvas textures for authentic PBR tactile response
 * without incurring external network downloads.
 */
function createNoiseTexture(color1: string, color2: string, grain = 0.15): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, 256, 256);

  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * grain * 255;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    data[i] = Math.min(255, Math.max(0, r + noise));
    data[i + 1] = Math.min(255, Math.max(0, g + noise));
    data[i + 2] = Math.min(255, Math.max(0, b + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

function createCorrugatedTexture(baseColor: string, darkStripe: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 128);

  // Vertical corrugated ribs
  ctx.fillStyle = darkStripe;
  for (let x = 0; x < 128; x += 16) {
    ctx.fillRect(x, 0, 6, 128);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

function createWoodCrateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  // Wood planks base
  ctx.fillStyle = '#854d0e';
  ctx.fillRect(0, 0, 256, 256);

  // Frame border
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#713f12';
  ctx.strokeRect(8, 8, 240, 240);

  // Cross brace
  ctx.beginPath();
  ctx.moveTo(16, 16);
  ctx.lineTo(240, 240);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function buildMapMaterials(): Record<string, THREE.MeshStandardMaterial> {
  const concreteTexture = createNoiseTexture('#334155', '#1e293b', 0.2);
  const stoneTexture = createNoiseTexture('#64748b', '#475569', 0.15);
  const woodTexture = createWoodCrateTexture();

  return {
    // Warehouse Materials
    floor_concrete: new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      roughness: 0.85,
      metalness: 0.1,
      map: concreteTexture,
    }),
    wall_brick: new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.75,
      metalness: 0.15,
      map: concreteTexture,
    }),
    metal_grate: new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.85,
    }),
    metal_beam: new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.5,
      metalness: 0.7,
    }),
    metal_pipe: new THREE.MeshStandardMaterial({
      color: 0xeab308, // Safety yellow
      roughness: 0.4,
      metalness: 0.6,
    }),
    wood_crate: new THREE.MeshStandardMaterial({
      color: 0xa16207,
      roughness: 0.8,
      metalness: 0.05,
      map: woodTexture,
    }),
    machinery_blue: new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.45,
      metalness: 0.65,
    }),
    metal_panel: new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.5,
      metalness: 0.6,
    }),
    concrete_barrier: new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      metalness: 0.1,
    }),

    // Plaza Materials
    floor_stone: new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.7,
      metalness: 0.1,
      map: stoneTexture,
    }),
    wall_stucco: new THREE.MeshStandardMaterial({
      color: 0xcfd8dc,
      roughness: 0.8,
      metalness: 0.05,
    }),
    stone_carved: new THREE.MeshStandardMaterial({
      color: 0xb0bec5,
      roughness: 0.65,
      metalness: 0.1,
    }),
    stone_monument: new THREE.MeshStandardMaterial({
      color: 0x374151,
      roughness: 0.35,
      metalness: 0.3,
    }),
    stone_tiles: new THREE.MeshStandardMaterial({
      color: 0xa8a29e,
      roughness: 0.6,
      metalness: 0.15,
    }),
    tile_terracotta: new THREE.MeshStandardMaterial({
      color: 0xc2410c,
      roughness: 0.7,
      metalness: 0.05,
    }),
    stone_planter: new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.8,
      metalness: 0.05,
    }),

    // Container Yard Materials
    floor_asphalt: new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.9,
      metalness: 0.05,
      map: concreteTexture,
    }),
    wall_concrete_barrier: new THREE.MeshStandardMaterial({
      color: 0x52525b,
      roughness: 0.8,
      metalness: 0.1,
    }),
    container_red: new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.5,
      metalness: 0.45,
      map: createCorrugatedTexture('#b91c1c', '#7f1d1d'),
    }),
    container_blue: new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.5,
      metalness: 0.45,
      map: createCorrugatedTexture('#1d4ed8', '#1e3a8a'),
    }),
    container_green: new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.5,
      metalness: 0.45,
      map: createCorrugatedTexture('#15803d', '#14532d'),
    }),
    container_yellow: new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.5,
      metalness: 0.45,
      map: createCorrugatedTexture('#d97706', '#92400e'),
    }),
  };
}
