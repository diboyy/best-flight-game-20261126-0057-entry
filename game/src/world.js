// world.js — Archipelago Air Rally: the archipelago, the courses, the pickups.
// One job: build the world from config and answer "what is under / ahead of
// the plane?" queries. No rendering, no input.

import { ISLANDS, RALLY_RINGS, FUELRUN_RINGS, FUEL_DUMBS, HOP_ORDER, MISSIONS } from './config.js';

// Deterministic RNG so every sortie flies the same islands and clouds.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWorld(missionId) {
  const mission = MISSIONS[missionId] || MISSIONS.rally;
  const rng = mulberry32(20261126);

  // Deep copy so a sortie can mark rings/drums taken without touching config.
  const islands = ISLANDS.map((isl) => ({ ...isl, runway: isl.runway ? { ...isl.runway } : null }));

  const ringDefs = missionId === 'fuelrun' ? FUELRUN_RINGS : missionId === 'hop' ? [] : RALLY_RINGS;
  const rings = ringDefs.map((r, i) => ({ ...r, index: i, passed: false, clipped: false }));

  const drumDefs = missionId === 'fuelrun' ? FUEL_DUMBS : FUEL_DUMBS.slice(0, mission.fuelDrums);
  const drums = drumDefs.map((d) => ({ ...d, taken: false }));

  // Decorative clouds: flat puffs drifting above the sea.
  const clouds = [];
  for (let i = 0; i < 42; i++) {
    clouds.push({
      x: (rng() * 2 - 1) * 2400,
      z: (rng() * 2 - 1) * 2400,
      y: 260 + rng() * 140,
      r: 60 + rng() * 110,
      speed: 2 + rng() * 4,
    });
  }

  // Buoys marking the home lagoon, for a recognisable home base.
  const buoys = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    buoys.push({ x: Math.sin(a) * 260, z: 900 + Math.cos(a) * 260 });
  }

  return { mission, islands, rings, drums, clouds, buoys };
}

// Ground height at (x, z): island hills rise above the sea, else 0.
// A runway strip is graded flat, so its ground is the strip height.
export function groundHeight(world, x, z) {
  let h = 0;
  for (const isl of world.islands) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < isl.r) {
      const fall = 1 - (d / isl.r) * (d / isl.r);
      const peak = isl.kind === 'volcano' ? isl.h * 1.6 : isl.h;
      h = Math.max(h, peak * fall);
    }
    if (isl.runway) {
      const along = dx * Math.sin(isl.runway.heading) + dz * -Math.cos(isl.runway.heading);
      const across = dx * Math.cos(isl.runway.heading) + dz * Math.sin(isl.runway.heading);
      if (Math.abs(along) < isl.runway.length / 2 + 8 && Math.abs(across) < isl.runway.width / 2 + 8) {
        h = isl.h * 0.12 + 1; // the graded strip, not the hill
      }
    }
  }
  return h;
}

// The runway a plane is currently over (if any), with its centre + heading.
export function runwayAt(world, x, z) {
  for (const isl of world.islands) {
    if (!isl.runway) continue;
    const dx = x - isl.x;
    const dz = z - isl.z;
    const along = dx * Math.sin(isl.runway.heading) + dz * -Math.cos(isl.runway.heading);
    const across = dx * Math.cos(isl.runway.heading) + dz * Math.sin(isl.runway.heading);
    if (Math.abs(along) < isl.runway.length / 2 && Math.abs(across) < isl.runway.width / 2) {
      return { island: isl, runway: isl.runway, along, across };
    }
  }
  return null;
}

// Next objective for the HUD arrow: next ring, next hop runway, or home.
export function nextTarget(world, missionId, hopIndex) {
  if (missionId === 'hop') {
    if (hopIndex >= HOP_ORDER.length) return { kind: 'done' };
    const isl = world.islands[HOP_ORDER[hopIndex]];
    return { kind: 'runway', x: isl.x, z: isl.z, y: 30, island: isl, label: 'RUNWAY ' + (hopIndex + 1) };
  }
  const ring = world.rings.find((r) => !r.passed);
  if (ring) return { kind: 'ring', x: ring.x, z: ring.z, y: ring.y, ring, label: 'RING ' + (ring.index + 1) };
  return { kind: 'done' };
}

// Distance + bearing from the plane to a target, for the HUD compass arrow.
export function targetBearing(plane, target) {
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  // Heading 0 = north (-Z). Bearing relative to current heading.
  const abs = Math.atan2(dx, -dz);
  let rel = abs - plane.heading;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  return { dist, rel };
}
