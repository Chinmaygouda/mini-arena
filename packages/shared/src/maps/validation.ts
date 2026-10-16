import { MapSpec, SpawnPoint } from './types';

export interface MapValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    spawnCount: number;
    alphaSpawns: number;
    bravoSpawns: number;
    minSpawnDistance: number;
    boxCount: number;
    rampCount: number;
    stairCount: number;
    isReachable: boolean;
  };
}

/**
 * Validates a map specification against competitive FPS standards and physical playability rules.
 */
export function validateMapSpec(map: MapSpec): MapValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate Bounds
  if (map.bounds.maxX <= map.bounds.minX || map.bounds.maxZ <= map.bounds.minZ) {
    errors.push(`Invalid map bounds for ${map.id}: min must be less than max.`);
  }

  // 2. Validate Spawns
  const alphaSpawns = map.spawns.filter((s) => s.team === 'alpha');
  const bravoSpawns = map.spawns.filter((s) => s.team === 'bravo');

  if (map.spawns.length < 4) {
    errors.push(`Map ${map.id} has ${map.spawns.length} spawns; minimum 4 required.`);
  }
  if (alphaSpawns.length < 2) {
    errors.push(`Map ${map.id} has ${alphaSpawns.length} Alpha spawns; minimum 2 required.`);
  }
  if (bravoSpawns.length < 2) {
    errors.push(`Map ${map.id} has ${bravoSpawns.length} Bravo spawns; minimum 2 required.`);
  }

  // Check spawns are inside bounds
  for (const spawn of map.spawns) {
    if (
      spawn.pos.x < map.bounds.minX + 1.0 ||
      spawn.pos.x > map.bounds.maxX - 1.0 ||
      spawn.pos.z < map.bounds.minZ + 1.0 ||
      spawn.pos.z > map.bounds.maxZ - 1.0
    ) {
      errors.push(`Spawn ${spawn.id} at (${spawn.pos.x}, ${spawn.pos.z}) violates perimeter clearance.`);
    }

    // Check spawn point doesn't intersect any solid obstacle box
    for (const box of map.boxes) {
      if (box.id === 'floor') continue;
      const halfX = box.size.x / 2 + 0.4; // 0.4m player capsule radius
      const halfZ = box.size.z / 2 + 0.4;
      if (
        Math.abs(spawn.pos.x - box.pos.x) < halfX &&
        Math.abs(spawn.pos.z - box.pos.z) < halfZ &&
        box.pos.y + box.size.y / 2 > spawn.pos.y
      ) {
        errors.push(`Spawn ${spawn.id} collides with obstacle box ${box.id}.`);
      }
    }
  }

  // Compute minimum distance between opposing team spawns
  let minSpawnDistance = Infinity;
  for (const a of alphaSpawns) {
    for (const b of bravoSpawns) {
      const dist = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
      if (dist < minSpawnDistance) {
        minSpawnDistance = dist;
      }
    }
  }

  if (minSpawnDistance < 15.0) {
    warnings.push(`Minimum spawn distance across teams is ${minSpawnDistance.toFixed(1)}m; recommended >= 15m.`);
  }

  // 3. Validate Ramps and Slopes
  for (const ramp of map.ramps) {
    if (ramp.angleDeg > 45) {
      warnings.push(`Ramp ${ramp.id} has angle ${ramp.angleDeg}° (>45° is a climb blocker).`);
    }
  }

  // 4. Validate 2D Grid Reachability (BFS flood fill from Alpha to Bravo)
  const a0 = alphaSpawns[0];
  const b0 = bravoSpawns[0];
  let isReachable = false;
  if (a0 && b0) {
    isReachable = checkFloorReachability(map, a0, b0);
    if (!isReachable) {
      errors.push(`Map ${map.id} fails reachability: no unobstructed floor path found between Alpha and Bravo spawns.`);
    }
  } else {
    errors.push(`Map ${map.id} missing spawn for reachability analysis.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      spawnCount: map.spawns.length,
      alphaSpawns: alphaSpawns.length,
      bravoSpawns: bravoSpawns.length,
      minSpawnDistance,
      boxCount: map.boxes.length,
      rampCount: map.ramps.length,
      stairCount: map.stairs?.length ?? 0,
      isReachable,
    },
  };
}

/**
 * 2D Grid Breadth-First-Search checking that a path exists between two spawn positions.
 */
function checkFloorReachability(map: MapSpec, startSpawn: SpawnPoint, targetSpawn: SpawnPoint): boolean {
  const cellSize = 1.0; // 1m resolution
  const minX = Math.floor(map.bounds.minX);
  const maxX = Math.ceil(map.bounds.maxX);
  const minZ = Math.floor(map.bounds.minZ);
  const maxZ = Math.ceil(map.bounds.maxZ);

  const gridWidth = Math.round((maxX - minX) / cellSize) + 1;
  const gridDepth = Math.round((maxZ - minZ) / cellSize) + 1;

  // 0 = walkable, 1 = blocked
  const grid = new Uint8Array(gridWidth * gridDepth);

  const getIdx = (gx: number, gz: number) => gz * gridWidth + gx;
  const worldToGrid = (wx: number, wz: number) => ({
    gx: Math.round((wx - minX) / cellSize),
    gz: Math.round((wz - minZ) / cellSize),
  });

  // Mark obstacle boxes on grid
  for (const box of map.boxes) {
    if (box.id === 'floor') continue;
    if (box.pos.y - box.size.y / 2 > 2.0) continue; // High overhead canopy/roof doesn't block floor

    const bMinX = box.pos.x - box.size.x / 2;
    const bMaxX = box.pos.x + box.size.x / 2;
    const bMinZ = box.pos.z - box.size.z / 2;
    const bMaxZ = box.pos.z + box.size.z / 2;

    const gStart = worldToGrid(bMinX, bMinZ);
    const gEnd = worldToGrid(bMaxX, bMaxZ);

    for (let gz = Math.max(0, gStart.gz); gz <= Math.min(gridDepth - 1, gEnd.gz); gz++) {
      for (let gx = Math.max(0, gStart.gx); gx <= Math.min(gridWidth - 1, gEnd.gx); gx++) {
        grid[getIdx(gx, gz)] = 1;
      }
    }
  }

  // BFS from start to target
  const start = worldToGrid(startSpawn.pos.x, startSpawn.pos.z);
  const target = worldToGrid(targetSpawn.pos.x, targetSpawn.pos.z);

  const queue: Array<{ gx: number; gz: number }> = [start];
  const visited = new Uint8Array(gridWidth * gridDepth);
  visited[getIdx(start.gx, start.gz)] = 1;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (Math.abs(cur.gx - target.gx) <= 1 && Math.abs(cur.gz - target.gz) <= 1) {
      return true; // Path reached!
    }

    const neighbors = [
      { nx: cur.gx + 1, nz: cur.gz },
      { nx: cur.gx - 1, nz: cur.gz },
      { nx: cur.gx, nz: cur.gz + 1 },
      { nx: cur.gx, nz: cur.gz - 1 },
    ];

    for (const { nx, nz } of neighbors) {
      if (nx >= 0 && nx < gridWidth && nz >= 0 && nz < gridDepth) {
        const nIdx = getIdx(nx, nz);
        if (visited[nIdx] === 0 && grid[nIdx] === 0) {
          visited[nIdx] = 1;
          queue.push({ gx: nx, gz: nz });
        }
      }
    }
  }

  return false;
}
