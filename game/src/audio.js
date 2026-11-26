// audio.js — tiny synthesised WebAudio sounds for Archipelago Air Rally.
// One job: bleeps and hums, all generated in code. No audio files.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // Engine hum: two detuned saws through a low-pass, gain follows throttle.
      engineOsc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      osc2.type = 'sawtooth';
      osc2.frequency.value = 55 * 1.01;
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      osc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      osc2.start();
      engineOsc._mate = osc2;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.15, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    setEngine(throttle, boosting) {
      const c = ensure();
      if (!c || !engineGain) return;
      const target = muted ? 0 : 0.015 + throttle * 0.05 + (boosting ? 0.03 : 0);
      engineGain.gain.setTargetAtTime(target, c.currentTime, 0.1);
      const f = 48 + throttle * 70 + (boosting ? 40 : 0);
      engineOsc.frequency.setTargetAtTime(f, c.currentTime, 0.1);
      engineOsc._mate.frequency.setTargetAtTime(f * 1.01, c.currentTime, 0.1);
    },
    ring(combo) {
      // Rising chime: the higher the combo, the brighter the chord.
      const base = 660 + Math.min(combo, 8) * 40;
      blip(base, 0.18, 'sine', 0.2);
      blip(base * 1.5, 0.22, 'sine', 0.12);
    },
    clip() { blip(180, 0.25, 'square', 0.16, 90); },
    fuel() { blip(520, 0.12, 'triangle', 0.18); blip(780, 0.16, 'triangle', 0.14); },
    land() { blip(392, 0.2, 'triangle', 0.2); blip(523, 0.3, 'triangle', 0.2); },
    crash() { blip(220, 0.5, 'sawtooth', 0.22, 55); blip(110, 0.6, 'square', 0.14, 40); },
    warn() { blip(880, 0.12, 'square', 0.1); },
    click() { blip(700, 0.06, 'sine', 0.12); },
  };
}
