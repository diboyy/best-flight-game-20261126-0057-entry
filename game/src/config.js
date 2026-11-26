// config.js — Archipelago Air Rally: missions, course layout, tuning.
// One job: every number the rest of the game reads. No rendering, no state.

export const WORLD = {
  size: 5200, // world is a square of sea, half-extent in metres
  seaLevel: 0,
  startX: 0,
  startZ: 900,
  startHeading: 0, // radians, 0 = north (-Z)
  startAltitude: 140,
  startSpeed: 55, // knots-ish display units
};

export const PLANE = {
  minSpeed: 28, // below this the plane stalls and sinks
  maxSpeed: 165,
  cruiseSpeed: 85,
  boostSpeed: 190,
  boostSeconds: 3,
  boostCooldown: 12,
  turnRate: 0.55, // rad/s at cruise, scaled by speed
  climbRate: 26, // m/s at full climb
  sinkRate: 18,
  maxAltitude: 420,
  minAltitude: 2,
  stallSink: 30,
  fuelCapacity: 100,
  fuelBurnIdle: 0.55, // %/s at 0 throttle
  fuelBurnFull: 2.6, // %/s at full throttle
  boostBurn: 4.5, // extra %/s while boosting
  maxDamage: 3,
  landingSpeedMax: 62, // above this a touchdown is a crash
  landingSinkMax: 9,
  landingAlignMax: 0.35, // radians off runway heading
};

export const RING = {
  radius: 34,
  innerRadius: 26, // inside this: clean pass; between inner and outer: clip
  basePoints: 100,
  timeBonus: 4, // seconds added per clean ring
};

// Missions: different goals, same sky. Selectable from the menu.
export const MISSIONS = {
  rally: {
    id: 'rally',
    name: 'Ring Rally',
    tagline: 'Thread every ring. Combos multiply the points.',
    timeLimit: 180,
    startFuel: 100,
    ringCount: 8,
    fuelDrums: 3,
    description: 'Score attack: fly the ring course in order. Clean passes build a combo multiplier; a miss or a clip breaks it.',
  },
  hop: {
    id: 'hop',
    name: 'Island Hop',
    tagline: 'Land on three island strips, in order. Slow, aligned, gear down.',
    timeLimit: 240,
    startFuel: 100,
    ringCount: 0,
    fuelDrums: 2,
    description: 'Touch down on each runway in order. Too fast, too steep or gear up and you bounce — or crash.',
  },
  fuelrun: {
    id: 'fuelrun',
    name: 'Fuel Run',
    tagline: 'A long course, scarce fuel. Efficiency wins.',
    timeLimit: 300,
    startFuel: 55,
    ringCount: 10,
    fuelDrums: 6,
    description: 'The long course with a half tank. Cruise lean, grab every fuel drum, and mind the throttle.',
  },
};

// Fixed, hand-placed course: deterministic, so every sortie flies the same
// archipelago and screenshots are reproducible.
export const ISLANDS = [
  // x, z, radius, height, kind
  { x: 0, z: 900, r: 150, h: 26, kind: 'home', runway: { heading: 0, length: 170, width: 26 } },
  { x: -620, z: 250, r: 210, h: 34, kind: 'palm' },
  { x: 540, z: -120, r: 260, h: 58, kind: 'volcano' },
  { x: -380, z: -700, r: 170, h: 30, kind: 'palm', runway: { heading: 1.1, length: 150, width: 24 } },
  { x: 760, z: -820, r: 190, h: 36, kind: 'palm', runway: { heading: -0.6, length: 150, width: 24 } },
  { x: 120, z: -1250, r: 230, h: 44, kind: 'palm' },
  { x: -980, z: -1150, r: 150, h: 28, kind: 'rock' },
  { x: 1050, z: 420, r: 140, h: 24, kind: 'rock' },
  { x: -1050, z: 700, r: 120, h: 22, kind: 'rock' },
  { x: 420, z: 1150, r: 130, h: 26, kind: 'palm' },
];

// Ring course for Ring Rally (x, z, altitude). Flown in order, northwards.
export const RALLY_RINGS = [
  { x: 0, z: 620, y: 150 },
  { x: -260, z: 330, y: 170 },
  { x: -520, z: -40, y: 150 },
  { x: 120, z: -420, y: 190 },
  { x: 540, z: -560, y: 170 },
  { x: 300, z: -980, y: 150 },
  { x: -240, z: -1050, y: 180 },
  { x: -380, z: -700, y: 110 },
];

// Longer, leaner course for Fuel Run.
export const FUELRUN_RINGS = [
  { x: 0, z: 620, y: 150 },
  { x: -420, z: 300, y: 160 },
  { x: -640, z: -180, y: 170 },
  { x: -100, z: -520, y: 190 },
  { x: 480, z: -620, y: 160 },
  { x: 760, z: -820, y: 120 },
  { x: 420, z: -1180, y: 170 },
  { x: -180, z: -1180, y: 150 },
  { x: -620, z: -900, y: 180 },
  { x: -380, z: -700, y: 110 },
];

// Fuel drums float above the sea along the courses (x, z, y).
export const FUEL_DUMBS = [
  { x: -130, z: 470, y: 150 },
  { x: 240, z: -300, y: 170 },
  { x: 620, z: -700, y: 160 },
  { x: 60, z: -1100, y: 160 },
  { x: -500, z: -950, y: 170 },
  { x: -260, z: -820, y: 150 },
];

// Island Hop landing order: island indices into ISLANDS.
export const HOP_ORDER = [3, 4, 0];

export const SCORES_KEY = 'archipelago-air-rally-best';
