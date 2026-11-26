// render.js — Archipelago Air Rally: everything the pilot sees.
// One job: draw the chase view, the world, the plane and the HUD on a canvas.
// All art is drawn in code; no images, no network.

// Project a world point into screen space from a chase camera behind the plane.
// Returns {x, y, s} (s = perspective scale) or null when behind the camera.
export function project(plane, px, py, pz, view) {
  // Camera sits behind and above the plane, looking along its heading.
  const camDist = 26;
  const camH = 7;
  const cx = plane.x - Math.sin(plane.heading) * camDist;
  const cz = plane.z + Math.cos(plane.heading) * camDist;
  const cy = plane.y + camH;
  const dx = px - cx;
  const dz = pz - cz;
  const dy = py - cy;
  // Rotate into camera space: forward = -Z of world rotated by heading.
  // Forward in world is (sin h, -cos h); right is (cos h, sin h).
  const sin = Math.sin(plane.heading);
  const cos = Math.cos(plane.heading);
  const fwd = dx * sin - dz * cos; // depth ahead (positive = in front)
  const right = dx * cos + dz * sin;
  if (fwd < 4) return null;
  const f = view.focal;
  const s = f / fwd;
  return {
    x: view.cx + right * s,
    y: view.horizon - dy * s + plane.bank * right * s * 0.12,
    s,
    depth: fwd,
  };
}

function skyGradient(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const warm = 0.5 + 0.5 * Math.sin(t * 0.05);
  g.addColorStop(0, '#2f7fc9');
  g.addColorStop(0.45, '#7ec3e8');
  g.addColorStop(0.62, '#ffe3b3');
  g.addColorStop(0.66, '#2fa8a0');
  g.addColorStop(1, '#0e6f7d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun
  ctx.fillStyle = 'rgba(255, 244, 200, 0.95)';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.16, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 244, 200, 0.25)';
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.16, 58, 0, Math.PI * 2);
  ctx.fill();
}

function drawSea(ctx, view, plane, world, t) {
  // Sea fills below the horizon with a slow shimmer.
  const g = ctx.createLinearGradient(0, view.horizon, 0, view.h);
  g.addColorStop(0, '#2fa8a0');
  g.addColorStop(0.25, '#1d8a94');
  g.addColorStop(1, '#0b5566');
  ctx.fillStyle = g;
  ctx.fillRect(0, view.horizon, view.w, view.h - view.horizon);
  // Sparkle strokes near the horizon.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    const x = ((i * 137 + t * 12) % view.w);
    const y = view.horizon + 8 + ((i * 53) % Math.max(1, view.h - view.horizon - 20));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 26, y);
    ctx.stroke();
  }
  // Buoys around the home lagoon.
  for (const b of world.buoys) {
    const p = project(plane, b.x, 0, b.z, view);
    if (!p || p.s < 0.02) continue;
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.5, 3 * p.s), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawIsland(ctx, view, plane, isl, t) {
  // Sample the island's rim and project each point: a low hill reads as land.
  const steps = 26;
  const top = [];
  const base = [];
  let visible = false;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = isl.x + Math.sin(a) * isl.r;
    const z = isl.z + Math.cos(a) * isl.r;
    const pTop = project(plane, x, isl.h * 0.55, z, view);
    const pBase = project(plane, x, 0, z, view);
    if (pTop && pBase) visible = true;
    top.push(pTop);
    base.push(pBase);
  }
  if (!visible) return;
  // Sand rim.
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= steps; i++) {
    const p = base[i];
    if (!p) continue;
    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = '#f2dd9e';
  ctx.fill();
  // Green hill.
  ctx.beginPath();
  started = false;
  for (let i = 0; i <= steps; i++) {
    const p = top[i];
    if (!p) continue;
    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = isl.kind === 'volcano' ? '#5c7a4a' : '#3f9e57';
  ctx.fill();
  // Volcano cone + smoke.
  if (isl.kind === 'volcano') {
    const peak = project(plane, isl.x, isl.h * 1.6, isl.z, view);
    const shoulder = project(plane, isl.x, isl.h * 0.9, isl.z, view);
    if (peak && shoulder) {
      ctx.fillStyle = '#4a4a48';
      ctx.beginPath();
      ctx.moveTo(shoulder.x - 26 * shoulder.s, shoulder.y);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(shoulder.x + 26 * shoulder.s, shoulder.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      const puff = Math.sin(t * 1.4) * 4;
      ctx.beginPath();
      ctx.arc(peak.x + puff, peak.y - 10, 12, 0, Math.PI * 2);
      ctx.arc(peak.x + 14 + puff, peak.y - 16, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Palm dots on palm islands.
  if (isl.kind === 'palm') {
    const c = project(plane, isl.x, isl.h * 0.6, isl.z, view);
    if (c && c.s > 0.05) {
      ctx.fillStyle = '#1e6b34';
      for (let i = 0; i < 5; i++) {
        const px = c.x + Math.sin(i * 2.4) * 22 * c.s;
        const py = c.y + Math.cos(i * 1.7) * 10 * c.s;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, 4 * c.s), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Runway strip, drawn as a projected quad.
  if (isl.runway) {
    const rw = isl.runway;
    const hx = Math.sin(rw.heading);
    const hz = -Math.cos(rw.heading);
    const px = Math.cos(rw.heading);
    const pz = Math.sin(rw.heading);
    const corners = [
      [isl.x + hx * rw.length / 2 + px * rw.width / 2, isl.z + hz * rw.length / 2 + pz * rw.width / 2],
      [isl.x + hx * rw.length / 2 - px * rw.width / 2, isl.z + hz * rw.length / 2 - pz * rw.width / 2],
      [isl.x - hx * rw.length / 2 - px * rw.width / 2, isl.z - hz * rw.length / 2 - pz * rw.width / 2],
      [isl.x - hx * rw.length / 2 + px * rw.width / 2, isl.z - hz * rw.length / 2 + pz * rw.width / 2],
    ];
    const pts = corners.map(([x, z]) => project(plane, x, isl.h * 0.12 + 1, z, view));
    if (pts.every(Boolean)) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fillStyle = '#3c3f45';
      ctx.fill();
      ctx.strokeStyle = '#f5f5f5';
      ctx.lineWidth = Math.max(1, 2 * pts[0].s);
      ctx.stroke();
      // Centre dashes.
      ctx.strokeStyle = '#ffd94d';
      ctx.beginPath();
      const a = project(plane, isl.x - hx * rw.length * 0.35, isl.h * 0.12 + 1.2, isl.z - hz * rw.length * 0.35, view);
      const b = project(plane, isl.x + hx * rw.length * 0.35, isl.h * 0.12 + 1.2, isl.z + hz * rw.length * 0.35, view);
      if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();
    }
  }
}

function drawRing(ctx, view, plane, ring, isNext, t) {
  const p = project(plane, ring.x, ring.y, ring.z, view);
  if (!p) return;
  const r = Math.max(2, 34 * p.s);
  const pulse = isNext ? 1 + Math.sin(t * 5) * 0.06 : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(1, 0.92);
  // Glow.
  ctx.strokeStyle = ring.passed ? 'rgba(120,220,255,0.25)' : isNext ? 'rgba(255,217,77,0.35)' : 'rgba(255,217,77,0.18)';
  ctx.lineWidth = r * 0.28 * pulse;
  ctx.beginPath();
  ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
  ctx.stroke();
  // Rim.
  ctx.strokeStyle = ring.passed ? '#7fd8ff' : isNext ? '#ffd94d' : '#ff9d4d';
  ctx.lineWidth = Math.max(2, r * 0.1 * pulse);
  ctx.beginPath();
  ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
  ctx.stroke();
  // Inner chevrons point the way through.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, 0);
  ctx.lineTo(0, r * 0.35);
  ctx.lineTo(r * 0.4, 0);
  ctx.stroke();
  ctx.restore();
  if (isNext) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RING ' + (ring.index + 1), p.x, p.y - r - 10);
  }
}

function drawDrum(ctx, view, plane, drum, t) {
  const bob = Math.sin(t * 2 + drum.x) * 3;
  const p = project(plane, drum.x, drum.y + bob, drum.z, view);
  if (!p) return;
  const s = Math.max(0.4, p.s);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = '#ff5a3c';
  ctx.beginPath();
  ctx.arc(0, 0, 11 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold ' + Math.max(9, 11 * s) + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', 0, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,90,60,0.5)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('+25 FUEL', p.x, p.y - 16 * s);
}

function drawClouds(ctx, view, plane, world) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of world.clouds) {
    const p = project(plane, c.x, c.y, c.z, view);
    if (!p || p.s < 0.02 || p.s > 3) continue;
    const r = c.r * p.s;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.36, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - r * 0.5, p.y + r * 0.08, r * 0.6, r * 0.26, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + r * 0.5, p.y + r * 0.08, r * 0.6, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The hero: a small prop plane, drawn in code, banking with the turn.
export function drawPlane(ctx, view, plane, t) {
  const cx = view.cx;
  const cy = view.h * 0.66;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank * 0.9);
  const s = 1.15;
  ctx.scale(s, s);
  // Prop blur + spinner.
  const propAngle = t * 30;
  ctx.strokeStyle = 'rgba(60,60,60,0.55)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, -58, 5, 34, propAngle % Math.PI, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#2b2f36';
  ctx.beginPath();
  ctx.arc(0, -58, 5, 0, Math.PI * 2);
  ctx.fill();
  // Wings.
  ctx.fillStyle = '#e8b23a';
  ctx.beginPath();
  ctx.moveTo(-78, -18);
  ctx.lineTo(78, -18);
  ctx.lineTo(66, -2);
  ctx.lineTo(-66, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c98f1e';
  ctx.fillRect(-78, -18, 8, 16);
  ctx.fillRect(70, -18, 8, 16);
  // Tail.
  ctx.fillStyle = '#d64533';
  ctx.beginPath();
  ctx.moveTo(-26, 34);
  ctx.lineTo(26, 34);
  ctx.lineTo(18, 46);
  ctx.lineTo(-18, 46);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-6, 26);
  ctx.lineTo(6, 26);
  ctx.lineTo(4, 48);
  ctx.lineTo(-4, 48);
  ctx.closePath();
  ctx.fill();
  // Fuselage.
  const fg = ctx.createLinearGradient(-10, 0, 10, 0);
  fg.addColorStop(0, '#f6f2e8');
  fg.addColorStop(0.5, '#ffffff');
  fg.addColorStop(1, '#d8d2c2');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, -62);
  ctx.quadraticCurveTo(13, -30, 11, 10);
  ctx.quadraticCurveTo(10, 40, 0, 48);
  ctx.quadraticCurveTo(-10, 40, -11, 10);
  ctx.quadraticCurveTo(-13, -30, 0, -62);
  ctx.closePath();
  ctx.fill();
  // Canopy.
  ctx.fillStyle = '#7ec3e8';
  ctx.beginPath();
  ctx.ellipse(0, -30, 8, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-3, -36, 3, 6, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Rally stripes + number.
  ctx.fillStyle = '#d64533';
  ctx.fillRect(-11, -6, 22, 4);
  ctx.fillStyle = '#2b2f36';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('07', 0, 26);
  // Gear.
  if (plane.gearDown) {
    ctx.strokeStyle = '#2b2f36';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, 40); ctx.lineTo(-8, 54);
    ctx.moveTo(8, 40); ctx.lineTo(8, 54);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-8, 56, 4, 0, Math.PI * 2);
    ctx.arc(8, 56, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Round instrument dial with a needle.
function drawDial(ctx, x, y, r, label, value, max, unit, warn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10, 24, 34, 0.82)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = warn ? '#ff5a3c' : '#e8e4d8';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
    ctx.strokeStyle = 'rgba(232,228,216,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
    ctx.lineTo(Math.cos(a) * (r - 9), Math.sin(a) * (r - 9));
    ctx.stroke();
  }
  const frac = Math.max(0, Math.min(1, value / max));
  const a = Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = warn ? '#ff5a3c' : '#ffd94d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(a) * (r - 10), Math.sin(a) * (r - 10));
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(value)), 0, r * 0.42);
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = '#9fb4c0';
  ctx.fillText(label + ' ' + unit, 0, r * 0.68);
  ctx.restore();
}

function drawCompass(ctx, view, plane) {
  const w = 260;
  const x0 = view.cx - w / 2;
  const y = 104; // below the timer pill so the two never overlap
  ctx.fillStyle = 'rgba(10, 24, 34, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x0, y - 16, w, 30, 8);
  ctx.fill();
  const deg = ((plane.heading * 180 / Math.PI) % 360 + 360) % 360;
  const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y - 16, w, 30);
  ctx.clip();
  for (const [d, name] of labels) {
    let rel = d - deg;
    while (rel > 180) rel -= 360;
    while (rel < -180) rel += 360;
    const x = view.cx + (rel / 60) * (w / 2);
    if (x < x0 - 20 || x > x0 + w + 20) continue;
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, x, y + 4);
  }
  ctx.restore();
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(view.cx - 6, y - 16);
  ctx.lineTo(view.cx + 6, y - 16);
  ctx.lineTo(view.cx, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HDG ' + String(Math.round(deg)).padStart(3, '0') + '°', view.cx, y + 26);
}

export function drawHUD(ctx, view, game, t) {
  const { plane, score, combo, timeLeft, mission, state } = game;
  const w = view.w;

  // Top bar.
  ctx.fillStyle = 'rgba(8, 20, 30, 0.66)';
  ctx.fillRect(0, 0, w, 46);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ARCHIPELAGO AIR RALLY', 14, 29);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(mission.name.toUpperCase(), 14, 42);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('SCORE ' + score, w - 14, 29);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = combo > 1 ? '#ffd94d' : '#9fb4c0';
  ctx.fillText(combo > 1 ? 'COMBO x' + combo : 'BEST ' + game.best, w - 14, 44);

  // Timer pill, top centre.
  const mm = Math.floor(Math.max(0, timeLeft) / 60);
  const ss = Math.floor(Math.max(0, timeLeft) % 60);
  const timeStr = mm + ':' + String(ss).padStart(2, '0');
  ctx.textAlign = 'center';
  ctx.fillStyle = timeLeft < 30 ? '#ff5a3c' : 'rgba(8,20,30,0.66)';
  ctx.beginPath();
  ctx.roundRect(view.cx - 52, 52, 104, 30, 15);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(timeStr, view.cx, 73);

  drawCompass(ctx, view, plane);

  // Dials, bottom left.
  drawDial(ctx, 62, view.h - 62, 44, 'SPEED', plane.speed, 190, 'kt', plane.speed < 30);
  drawDial(ctx, 162, view.h - 62, 44, 'ALT', plane.y, 420, 'm', plane.y < 20);
  drawDial(ctx, 262, view.h - 62, 44, 'THR', plane.throttle * 100, 100, '%', false);

  // Fuel gauge, bottom right.
  const fx = w - 220;
  const fy = view.h - 84;
  ctx.fillStyle = 'rgba(10, 24, 34, 0.82)';
  ctx.beginPath();
  ctx.roundRect(fx, fy, 206, 62, 8);
  ctx.fill();
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', fx + 12, fy + 20);
  const lowFuel = plane.fuel < 25;
  if (lowFuel && Math.sin(t * 8) > 0) {
    ctx.fillStyle = '#ff5a3c';
    ctx.fillText('LOW FUEL!', fx + 120, fy + 20);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.roundRect(fx + 12, fy + 30, 182, 12, 6);
  ctx.fill();
  ctx.fillStyle = lowFuel ? '#ff5a3c' : plane.fuel < 50 ? '#ffd94d' : '#3fbf7a';
  ctx.beginPath();
  ctx.roundRect(fx + 12, fy + 30, 182 * Math.max(0, plane.fuel / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = '#e8e4d8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(Math.round(plane.fuel) + '%', fx + 12, fy + 56);
  ctx.textAlign = 'right';
  ctx.fillText('GEAR ' + (plane.gearDown ? 'DOWN' : 'UP') + '  ·  DMG ' + '✕'.repeat(plane.damage) + '○'.repeat(Math.max(0, 3 - plane.damage)), fx + 194, fy + 56);

  // Boost meter.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fb4c0';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(plane.boostCooldown > 0 ? 'BOOST ' + Math.ceil(plane.boostCooldown) + 's' : 'BOOST READY [SPACE]', fx, fy - 8);

  // Objective line under the timer.
  if (state === 'flying' && game.objective) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(8,20,30,0.6)';
    const label = game.objective;
    const tw = ctx.measureText(label).width + 24;
    ctx.beginPath();
    ctx.roundRect(view.cx - tw / 2, 140, tw, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(label, view.cx, 157);
  }

  // Combo popup.
  if (game.popup && game.popupT > 0) {
    const a = Math.min(1, game.popupT);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(game.popup, view.cx, view.h * 0.3);
    ctx.restore();
  }

  // Warning banners.
  if (game.banner) {
    ctx.textAlign = 'center';
    ctx.fillStyle = game.bannerColor || '#ff5a3c';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(game.banner, view.cx, view.h * 0.42);
    if (game.bannerSub) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(game.bannerSub, view.cx, view.h * 0.42 + 28);
    }
  }
}

export function drawMenu(ctx, view, game, t) {
  // Sky backdrop for the menu: reuse the sky + sea, then a panel.
  skyGradient(ctx, view.w, view.h, t);
  ctx.fillStyle = '#1d8a94';
  ctx.fillRect(0, view.h * 0.62, view.w, view.h * 0.38);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(view.w * 0.2, view.h * 0.2, 120, 26, 0, 0, Math.PI * 2);
  ctx.ellipse(view.w * 0.65, view.h * 0.3, 150, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('ARCHIPELAGO', view.cx, view.h * 0.2);
  ctx.fillStyle = '#ffd94d';
  ctx.fillText('AIR RALLY', view.cx, view.h * 0.2 + 52);
  ctx.fillStyle = '#e8f4f8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('A chase-view prop-plane rally over a tropical archipelago.', view.cx, view.h * 0.2 + 84);
  ctx.fillText('Thread the rings. Mind the fuel. Land it like you mean it.', view.cx, view.h * 0.2 + 106);

  // Mission cards.
  const cards = Object.values(game.missions);
  const cw = 250;
  const gap = 18;
  const total = cards.length * cw + (cards.length - 1) * gap;
  let x = view.cx - total / 2;
  const y = view.h * 0.42;
  cards.forEach((m, i) => {
    const sel = i === game.menuIndex;
    ctx.fillStyle = sel ? 'rgba(255,217,77,0.95)' : 'rgba(8,20,30,0.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, cw, 150, 12);
    ctx.fill();
    ctx.fillStyle = sel ? '#12202c' : '#fff';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText(m.name, x + cw / 2, y + 34);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = sel ? '#3a2f10' : '#c8dde6';
    wrapText(ctx, m.tagline, x + cw / 2, y + 60, cw - 28, 17);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = sel ? '#3a2f10' : '#9fb4c0';
    ctx.fillText(m.timeLimit + 's  ·  ' + (m.ringCount ? m.ringCount + ' rings' : '3 landings'), x + cw / 2, y + 128);
    x += cw + gap;
  });

  ctx.fillStyle = '#fff';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('← → choose mission   ·   ENTER to fly   ·   best score ' + game.best, view.cx, y + 190);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#c8dde6';
  ctx.fillText('W/S throttle · A/D or ←/→ steer · ↑/↓ pitch · SPACE boost · G gear · P pause', view.cx, y + 216);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}

// Full frame: sky, sea, islands, clouds, rings, drums, plane, HUD.
export function render(ctx, view, game, world, t) {
  const plane = game.plane;
  skyGradient(ctx, view.w, view.h, t);
  drawSea(ctx, view, plane, world, t);
  // Far to near: sort islands by depth so nearer ones draw over farther ones.
  const sorted = [...world.islands].sort((a, b) => {
    const da = (a.x - plane.x) ** 2 + (a.z - plane.z) ** 2;
    const db = (b.x - plane.x) ** 2 + (b.z - plane.z) ** 2;
    return db - da;
  });
  for (const isl of sorted) drawIsland(ctx, view, plane, isl, t);
  drawClouds(ctx, view, plane, world);
  const nextRing = world.rings.find((r) => !r.passed);
  for (const ring of world.rings) {
    if (ring.passed) continue;
    drawRing(ctx, view, plane, ring, ring === nextRing, t);
  }
  for (const drum of world.drums) {
    if (!drum.taken) drawDrum(ctx, view, plane, drum, t);
  }
  drawPlane(ctx, view, plane, t);
  drawHUD(ctx, view, game, t);
}
