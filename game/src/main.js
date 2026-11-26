// main.js — Archipelago Air Rally: game loop, states, scoring.
// One job: own the game state machine and wire input/physics/render/audio.
// Entry point loaded by index.html as an ES module.

import { MISSIONS, SCORES_KEY, HOP_ORDER, RING } from './config.js';
import { createInput, attachTouch } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld, nextTarget, targetBearing, groundHeight } from './world.js';
import { createPlane, stepPlane, drumPickup, landingCheck, ringScore } from './physics.js';
import { render, drawMenu } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
attachTouch(canvas, input);
const audio = createAudio();

const game = {
  state: 'menu', // menu | flying | paused | over
  menuIndex: 0,
  missions: MISSIONS,
  mission: MISSIONS.rally,
  world: null,
  plane: null,
  score: 0,
  combo: 0,
  bestCombo: 0,
  timeLeft: 0,
  hopIndex: 0,
  hopsDone: 0,
  ringsDone: 0,
  best: 0,
  popup: null,
  popupT: 0,
  banner: null,
  bannerSub: null,
  bannerColor: null,
  objective: '',
  overReason: '',
  muted: false,
  lowFuelWarned: false,
  stallWarned: false,
};

try {
  game.best = Number(localStorage.getItem(SCORES_KEY) || 0) || 0;
} catch {
  game.best = 0;
}

// Read-only handle for live verification (play-tests read score/state here).
// It changes nothing in play; the game never reads it back.
window.__aar = game;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function view() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    w, h,
    cx: w / 2,
    horizon: h * 0.42,
    focal: h * 0.9,
  };
}

function startMission(missionId) {
  game.mission = MISSIONS[missionId];
  game.world = buildWorld(missionId);
  game.plane = createPlane(game.mission);
  game.score = 0;
  game.combo = 0;
  game.bestCombo = 0;
  game.timeLeft = game.mission.timeLimit;
  game.hopIndex = 0;
  game.hopsDone = 0;
  game.ringsDone = 0;
  game.popup = null;
  game.banner = null;
  game.bannerSub = null;
  game.lowFuelWarned = false;
  game.stallWarned = false;
  game.state = 'flying';
  audio.unlock();
  updateObjective();
}

function updateObjective() {
  if (game.state !== 'flying') return;
  const target = nextTarget(game.world, game.mission.id, game.hopIndex);
  if (target.kind === 'done') {
    game.objective = 'COURSE COMPLETE — FLY HOME';
    return;
  }
  const { dist, rel } = targetBearing(game.plane, target);
  const arrow = rel < -0.35 ? '◀◀' : rel > 0.35 ? '▶▶' : '▲';
  game.objective = target.label + '  ' + arrow + '  ' + Math.round(dist) + 'm';
}

function endSortie(reason, sub) {
  game.state = 'over';
  game.overReason = reason;
  game.banner = reason;
  game.bannerSub = sub || '';
  game.bannerColor = reason === 'CRASHED' ? '#ff5a3c' : '#ffd94d';
  if (game.score > game.best) {
    game.best = game.score;
    try { localStorage.setItem(SCORES_KEY, String(game.best)); } catch { /* private mode */ }
  }
  if (reason === 'CRASHED') audio.crash();
  audio.setEngine(0, false);
}

function addScore(points, label) {
  game.score += points;
  game.popup = label;
  game.popupT = 1.4;
}

function onRing(ring, kind) {
  ring.passed = true;
  game.ringsDone += 1;
  if (kind === 'clean') {
    game.combo += 1;
    game.bestCombo = Math.max(game.bestCombo, game.combo);
    const pts = ringScore(game.combo);
    addScore(pts, '+' + pts + (game.combo > 1 ? '  COMBO x' + game.combo : ''));
    game.timeLeft += 4;
    audio.ring(game.combo);
  } else {
    // Clipped the rim: the ring counts, the plane does not.
    game.combo = 0;
    game.plane.damage += 1;
    addScore(50, '+50  RING CLIPPED!');
    audio.clip();
    if (game.plane.damage >= 3) {
      game.plane.crashed = true;
      endSortie('CRASHED', 'Three strikes — the rally plane is done.');
      return;
    }
  }
  if (game.ringsDone >= game.world.rings.length && game.mission.ringCount > 0) {
    endSortie('COURSE COMPLETE', 'All rings flown — final score ' + game.score + '.');
    return;
  }
  updateObjective();
}

function checkCourseComplete() {
  if (game.mission.ringCount > 0 && game.world.rings.every((r) => r.passed)) {
    endSortie('COURSE COMPLETE', 'All rings flown — final score ' + game.score + '.');
  }
}

function onLanding(islIndex) {
  game.hopsDone += 1;
  game.hopIndex += 1;
  const pts = 400 + Math.max(0, Math.round(game.plane.fuel)) * 2;
  addScore(pts, 'LANDED! +' + pts);
  audio.land();
  game.plane.landed = true;
  game.plane.speed = 0;
  if (game.hopIndex >= 3) {
    endSortie('ISLAND HOP COMPLETE', 'All three strips — final score ' + game.score + '.');
    return;
  }
  // Taxi off: reset to the runway, ready for the next leg.
  setTimeout(() => {
    if (game.state !== 'flying') return;
    game.plane.landed = false;
    game.plane.y = 60;
    game.plane.speed = 55;
    game.plane.gearDown = false;
    const nextIsl = game.world.islands[HOP_ORDER[game.hopIndex]];
    game.plane.heading = nextIsl && nextIsl.runway ? nextIsl.runway.heading : 0;
    updateObjective();
  }, 1400);
}

function tick(dt, t) {
  const edges = input.consumeEdges();

  if (game.state === 'menu') {
    if (input.steer < 0 && !game._menuMoved) { game.menuIndex = (game.menuIndex + 2) % 3; game._menuMoved = true; audio.click(); }
    else if (input.steer > 0 && !game._menuMoved) { game.menuIndex = (game.menuIndex + 1) % 3; game._menuMoved = true; audio.click(); }
    else if (input.steer === 0) game._menuMoved = false;
    if (input.anyKey && (input.boost || keysEnter())) startMission(Object.keys(MISSIONS)[game.menuIndex]);
    input.anyKey = false;
    input._enter = false;
    return;
  }

  if (game.state === 'over') {
    if (edges.boost || keysEnter()) {
      input._enter = false;
      // Any key after a beat returns to the menu.
      if (t - game._overAt > 1.2) { game.state = 'menu'; game.banner = null; }
    }
    input.anyKey = false;
    return;
  }

  if (edges.pauseToggle) {
    game.state = game.state === 'paused' ? 'flying' : 'paused';
    return;
  }
  if (game.state === 'paused') return;

  // --- flying ---------------------------------------------------------------
  const plane = game.plane;
  const result = stepPlane(plane, input, edges, dt, game.world);
  audio.setEngine(plane.throttle, result.boosting);

  if (result.event === 'scrape') {
    plane.damage += 1;
    game.combo = 0;
    audio.clip();
    game.popup = 'TERRAIN SCRAPE!';
    game.popupT = 1.2;
    if (plane.damage >= 3) {
      plane.crashed = true;
      endSortie('CRASHED', 'Three strikes — the rally plane is done.');
      return;
    }
  }
  if (result.event === 'fuelcrash') {
    plane.crashed = true;
    endSortie('CRASHED', 'Out of fuel, out of sky.');
    return;
  }
  if (result.event === 'dry' && !game.lowFuelWarned) {
    game.lowFuelWarned = true;
    game.popup = 'OUT OF FUEL — GLIDE TO A RUNWAY';
    game.popupT = 2.5;
    audio.warn();
  }
  if (plane.fuel < 25 && plane.fuel > 0 && Math.floor(t) % 5 === 0 && !game._warnedTick) {
    game._warnedTick = Math.floor(t);
    audio.warn();
  }
  if (plane.speed < 30 && !plane.stallWarned) {
    plane.stallWarned = true;
    game.popup = 'STALL WARNING — THROTTLE UP';
    game.popupT = 1.5;
  } else if (plane.speed > 45) plane.stallWarned = false;

  // Rings: resolve the next ring by closest approach as the plane flies by.
  // A head-on pass reads the minimum distance to the ring centre, so a plane
  // that threads the disc scores clean and one that skirts the rim clips it;
  // flying past wide of the ring is a miss that breaks the combo.
  const nextRing = game.world.rings.find((r) => !r.passed);
  if (nextRing) {
    const dx = plane.x - nextRing.x;
    const dz = plane.z - nextRing.z;
    const dy = plane.y - nextRing.y;
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (nextRing._minDist === undefined || d < nextRing._minDist) nextRing._minDist = d;
    const receding = nextRing._prevDist !== undefined && d > nextRing._prevDist + 0.5;
    if (receding && d > RING.radius + 14 && nextRing._minDist !== undefined) {
      const min = nextRing._minDist;
      if (min <= RING.innerRadius) onRing(nextRing, 'clean');
      else if (min <= RING.radius) onRing(nextRing, 'clip');
      else {
        nextRing.passed = true;
        nextRing.missed = true;
        game.combo = 0;
        game.popup = 'RING MISSED';
        game.popupT = 1.2;
        audio.clip();
        updateObjective();
      }
      checkCourseComplete();
      if (game.state !== 'flying') return;
    }
    nextRing._prevDist = d;
  }
  // Fuel drums.
  for (const drum of game.world.drums) {
    if (!drum.taken && drumPickup(plane, drum)) {
      drum.taken = true;
      plane.fuel = Math.min(100, plane.fuel + 25);
      game.lowFuelWarned = false;
      addScore(25, '+25 FUEL');
      audio.fuel();
    }
  }
  // Landings (Island Hop, or any runway touch in other missions).
  // Guarded by !plane.landed: a plane sitting on the strip must not re-land
  // every frame while it taxis off.
  if (!plane.landed) {
    const landing = landingCheck(plane, game.world);
    if (landing === 'landed') {
      if (game.mission.id === 'hop') onLanding();
      else {
        addScore(200, 'LANDED! +200');
        audio.land();
        plane.landed = true;
        setTimeout(() => { if (game.state === 'flying') { plane.landed = false; plane.y = 60; plane.speed = 55; } }, 1200);
      }
    } else if (landing === 'crash') {
      plane.crashed = true;
      endSortie('CRASHED', plane.gearDown ? 'Too fast, too steep, or off-line for the strip.' : 'Gear was up — the strip is not a beach.');
      return;
    }
  }

  // Timer.
  game.timeLeft -= dt;
  if (game.timeLeft <= 0) {
    game.timeLeft = 0;
    if (game.mission.id === 'hop' && game.hopIndex >= 3) return;
    endSortie('TIME UP', 'Sortie over — final score ' + game.score + '.');
    return;
  }

  if (game.popupT > 0) game.popupT -= dt;
  updateObjective();
}

function keysEnter() {
  return input._enter === true;
}

// Track Enter separately (input.js does not own it).
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') input._enter = true;
  if (e.key === 'm' || e.key === 'M') game.muted = audio.toggleMute();
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') input._enter = false;
});

let last = performance.now();
let elapsed = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;
  const v = view();
  tick(dt, elapsed);
  if (game.state === 'menu') {
    drawMenu(ctx, v, game, elapsed);
  } else {
    if (game.state === 'over' && !game._overAt) game._overAt = elapsed;
    if (game.state !== 'over') game._overAt = 0;
    render(ctx, v, game, game.world, elapsed);
    if (game.state === 'over') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('Score ' + game.score + '  ·  best ' + game.best + '  ·  press any key for the menu', v.cx, v.h * 0.42 + 62);
    }
    if (game.state === 'paused') {
      ctx.fillStyle = 'rgba(8,20,30,0.6)';
      ctx.fillRect(0, 0, v.w, v.h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', v.cx, v.h * 0.5);
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('P to resume', v.cx, v.h * 0.5 + 30);
    }
  }
  requestAnimationFrame(frame);
}

// Screenshot states (?shot=cover|ring|landing|menu|fuel) render one frozen
// frame for the build session's headless captures — see shots.js.
const params = new URLSearchParams(window.location.search);
if (params.get('shot')) {
  applyShot(params.get('shot'), game, startMission, view, ctx, render, drawMenu);
} else {
  requestAnimationFrame(frame);
}
