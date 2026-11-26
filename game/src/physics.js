// physics.js — Archipelago Air Rally: how the plane flies.
// One job: advance the plane state one tick from the controls. No rendering.

import { PLANE, RING } from './config.js';
import { groundHeight, runwayAt } from './world.js';

export function createPlane(mission) {
  return {
    x: 0,
    z: 900,
    y: 140, // altitude above sea
    heading: 0, // radians, 0 = north (-Z)
    bank: 0, // visual + turn coupling, radians
    speed: 55, // knots-ish
    throttle: 0.55,
    fuel: mission.startFuel,
    damage: 0,
    gearDown: false,
    boostTime: 0,
    boostCooldown: 0,
    verticalSpeed: 0,
    crashed: false,
    landed: false,
    stallWarned: false,
  };
}

// Steer + throttle + pitch -> new position, fuel burn, stall and scrape.
export function stepPlane(plane, input, edges, dt, world) {
  if (plane.crashed || plane.landed) return { event: null };

  // --- Throttle -----------------------------------------------------------
  if (input.throttleUp) plane.throttle = Math.min(1, plane.throttle + 0.6 * dt);
  if (input.throttleDown) plane.throttle = Math.max(0, plane.throttle - 0.8 * dt);

  // --- Boost --------------------------------------------------------------
  if (edges.boost && plane.boostCooldown <= 0 && plane.fuel > 5) {
    plane.boostTime = PLANE.boostSeconds;
    plane.boostCooldown = PLANE.boostCooldown;
  }
  plane.boostCooldown = Math.max(0, plane.boostCooldown - dt);
  const boosting = plane.boostTime > 0;
  if (boosting) plane.boostTime -= dt;

  // --- Speed: throttle pulls toward a target speed; boost pushes past it --
  const targetSpeed = PLANE.minSpeed + plane.throttle * (PLANE.cruiseSpeed * 1.6 - PLANE.minSpeed);
  const rate = plane.throttle > 0.5 ? 14 : 9;
  plane.speed += (targetSpeed - plane.speed) * Math.min(1, rate * dt / 60);
  if (boosting) plane.speed = Math.min(PLANE.boostSpeed, plane.speed + 26 * dt);
  plane.speed = Math.max(0, Math.min(PLANE.boostSpeed, plane.speed));

  // --- Steering: bank into the turn; fast = wide turns --------------------
  const steer = input.steer || (input.mouseActive ? input.mouseSteer * 0.7 : 0);
  const speedFactor = 1 - (plane.speed / PLANE.maxSpeed) * 0.55; // fast => lazier
  const turnRate = PLANE.turnRate * speedFactor * (0.6 + 0.4 * Math.abs(steer));
  plane.heading += steer * turnRate * dt;
  const targetBank = steer * 0.6;
  plane.bank += (targetBank - plane.bank) * Math.min(1, 6 * dt);

  // --- Pitch: climb and dive; slow flight sinks ----------------------------
  const pitch = input.pitch || (input.mouseActive ? input.mousePitch * 0.6 : 0);
  let climb = -pitch * PLANE.climbRate; // up arrow = climb
  if (plane.speed < PLANE.minSpeed) climb -= PLANE.stallSink; // stall sink
  plane.verticalSpeed = climb;
  plane.y += climb * dt;
  plane.y = Math.max(PLANE.minAltitude, Math.min(PLANE.maxAltitude, plane.y));

  // --- Move forward --------------------------------------------------------
  const metresPerSec = plane.speed * 0.9;
  plane.x += Math.sin(plane.heading) * metresPerSec * dt;
  plane.z += -Math.cos(plane.heading) * metresPerSec * dt;
  // Soft world edge: steer back in rather than hitting an invisible wall.
  const edge = 2500;
  if (Math.abs(plane.x) > edge || Math.abs(plane.z) > edge) {
    plane.heading += Math.PI * dt * 0.25 * Math.sign(plane.x * Math.cos(plane.heading) - plane.z * Math.sin(plane.heading) || 1);
  }

  // --- Fuel -----------------------------------------------------------------
  const burn = PLANE.fuelBurnIdle + plane.throttle * (PLANE.fuelBurnFull - PLANE.fuelBurnIdle)
    + (boosting ? PLANE.boostBurn : 0);
  plane.fuel = Math.max(0, plane.fuel - burn * dt);
  const outOfFuel = plane.fuel <= 0;

  // --- Gear -----------------------------------------------------------------
  if (edges.gearToggle) plane.gearDown = !plane.gearDown;

  // --- Terrain scrape -------------------------------------------------------
  // Out of fuel and sinking to the deck with no speed left: that is a crash,
  // checked before the scrape so a dead-stick ditching reads as a crash.
  const ground = groundHeight(world, plane.x, plane.z);
  if (outOfFuel && plane.y <= PLANE.minAltitude + 1 && plane.speed < PLANE.minSpeed) {
    return { event: 'fuelcrash' };
  }
  if (plane.y <= ground + 2) {
    plane.y = ground + 2;
    return { event: 'scrape' };
  }
  return { event: outOfFuel ? 'dry' : null, boosting };
}

// Fuel drum pickup: within 26 m.
export function drumPickup(plane, drum) {
  const dx = plane.x - drum.x;
  const dz = plane.z - drum.z;
  const dy = plane.y - drum.y;
  return Math.sqrt(dx * dx + dz * dz + dy * dy) < 26;
}

// Landing test on a runway the plane is over. Returns 'landed' | 'crash' | null.
export function landingCheck(plane, world) {
  const spot = runwayAt(world, plane.x, plane.z);
  if (!spot) return null;
  if (plane.y > 14) return null; // still in the air
  const headingDiff = Math.abs(angleDiff(plane.heading, spot.runway.heading));
  const sink = -plane.verticalSpeed;
  if (!plane.gearDown) return 'crash';
  if (plane.speed > PLANE.landingSpeedMax) return 'crash';
  if (sink > PLANE.landingSinkMax) return 'crash';
  if (headingDiff > PLANE.landingAlignMax) return 'crash';
  return 'landed';
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Score for a clean ring pass, with the combo multiplier.
export function ringScore(combo) {
  return RING.basePoints * combo;
}
