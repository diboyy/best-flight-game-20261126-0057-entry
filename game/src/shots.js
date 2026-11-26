// shots.js — Archipelago Air Rally: frozen screenshot states.
// One job: given ?shot=<name>, set up a deterministic game state and render
// exactly one frame, so headless Chrome captures a stable, representative
// image. Never used during normal play.

import { nextTarget } from './world.js';

function placePlaneForShot(game, x, z, y, heading, speed, throttle) {
  const p = game.plane;
  p.x = x; p.z = z; p.y = y; p.heading = heading;
  p.speed = speed; p.throttle = throttle;
  p.bank = 0;
  p.verticalSpeed = 0;
}

export function applyShot(name, game, startMission, view, ctx, render, drawMenu) {
  const v = view();
  const t = 12.0; // fixed time so clouds/props render identically every run

  if (name === 'menu') {
    drawMenu(ctx, v, game, t);
    return;
  }

  startMission('rally');
  game.state = 'flying';

  if (name === 'cover') {
    // Chase view mid-flight, first ring ahead, HUD lit, fuel full.
    placePlaneForShot(game, 0, 780, 150, 0, 92, 0.72);
    game.score = 350;
    game.combo = 3;
    game.timeLeft = 152;
    game.objective = 'RING 1  ▲  160m';
    render(ctx, v, game, game.world, t);
  } else if (name === 'ring') {
    // Ring-pass moment: plane inside ring 1, combo popup showing.
    const ring = game.world.rings[0];
    placePlaneForShot(game, ring.x, ring.z + 46, ring.y, 0, 96, 0.75);
    ring.passed = true;
    game.ringsDone = 1;
    game.combo = 4;
    game.score = 800;
    game.timeLeft = 148;
    game.popup = '+400  COMBO x4';
    game.popupT = 1.0;
    game.objective = 'RING 2  ▲  310m';
    render(ctx, v, game, game.world, t);
  } else if (name === 'landing') {
    // Runway approach: low, slow, gear down, strip ahead.
    startMission('hop');
    game.state = 'flying';
    const isl = game.world.islands[3]; // first hop runway
    const h = isl.runway.heading;
    placePlaneForShot(game,
      isl.x - Math.sin(h) * 90, isl.z + Math.cos(h) * 90,
      90, h, 52, 0.32);
    game.plane.gearDown = true;
    game.score = 400;
    game.timeLeft = 198;
    game.objective = 'RUNWAY 1  ▲  90m';
    render(ctx, v, game, game.world, t);
  } else if (name === 'fuel') {
    // Fuel-low warning moment: gauge red, warning banner, drum ahead-right.
    placePlaneForShot(game, -260, 640, 150, 0, 78, 0.5);
    game.plane.fuel = 14;
    game.score = 650;
    game.combo = 2;
    game.timeLeft = 96;
    game.banner = 'LOW FUEL';
    game.bannerSub = 'Grab the drum ahead — or glide to a runway';
    game.bannerColor = '#ff5a3c';
    game.objective = 'RING 3  ▲  480m';
    render(ctx, v, game, game.world, t);
  } else {
    render(ctx, v, game, game.world, t);
  }
}
