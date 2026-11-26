// input.js — keyboard + mouse input for Archipelago Air Rally.
// One job: turn key/mouse events into a plain control state the physics reads.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    steer: 0, // -1 left .. +1 right (A/D or arrows)
    pitch: 0, // -1 climb .. +1 dive (Up/Down arrows)
    throttleUp: false, // W
    throttleDown: false, // S
    boost: false, // Space, edge-triggered by physics
    gearToggle: false, // G, edge-triggered
    pauseToggle: false, // P or Escape, edge-triggered
    anyKey: false,
    mouseSteer: 0, // -1..1 from mouse X offset while held
    mousePitch: 0, // -1..1 from mouse Y offset while held
    mouseActive: false,
  };

  function keyName(e) {
    // Normalise every key: 'ArrowLeft' -> 'arrowleft', 'A' -> 'a', ' ' -> ' '.
    // refresh() compares against lower-case names, so an un-normalised
    // multi-character key (arrows, Escape) would silently never match.
    return e.key.toLowerCase();
  }

  function onKeyDown(e) {
    const k = keyName(e);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!e.repeat) {
      if (k === ' ') state.boost = true;
      if (k === 'g') state.gearToggle = true;
      if (k === 'p' || k === 'escape') state.pauseToggle = true;
    }
    keys.add(k);
    state.anyKey = true;
    refresh();
  }

  function onKeyUp(e) {
    keys.delete(keyName(e));
    refresh();
  }

  function refresh() {
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    state.steer = (right ? 1 : 0) - (left ? 1 : 0);
    const up = keys.has('arrowup');
    const down = keys.has('arrowdown');
    state.pitch = (down ? 1 : 0) - (up ? 1 : 0);
    state.throttleUp = keys.has('w');
    state.throttleDown = keys.has('s');
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    state.mouseSteer = Math.max(-1, Math.min(1, nx * 1.4));
    state.mousePitch = Math.max(-1, Math.min(1, ny * 1.4));
    state.mouseActive = true;
  }

  function onMouseDown() {
    state.boost = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  // Edge-triggered flags are consumed by the game loop each frame.
  state.consumeEdges = () => {
    const edges = { boost: state.boost, gearToggle: state.gearToggle, pauseToggle: state.pauseToggle };
    state.boost = false;
    state.gearToggle = false;
    state.pauseToggle = false;
    return edges;
  };

  return state;
}

// Touch: left half steers, right half pitches, double-tap boosts. Kept tiny.
export function attachTouch(canvas, state) {
  let lastTap = 0;
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - lastTap < 300) state.boost = true;
    lastTap = now;
    for (const t of e.changedTouches) {
      const rect = canvas.getBoundingClientRect();
      const nx = ((t.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((t.clientY - rect.top) / rect.height) * 2 - 1;
      if (nx < 0) state.steer = nx < -0.25 ? -1 : nx > 0.25 ? 1 : 0;
      else state.pitch = ny;
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    state.steer = 0;
    state.pitch = 0;
  });
}
