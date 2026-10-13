// Lightweight SFX: a blade slice then a gore/splatter hit on each beheading.
const SLICE = ['/sfx/slice1.mp3', '/sfx/slice2.mp3', '/sfx/slice3.mp3'];
const GORE = ['/sfx/gore-axe.mp3', '/sfx/gore-rip.mp3', '/sfx/gore-splat.mp3', '/sfx/behead1.mp3', '/sfx/behead2.mp3'];
const BELL = '/sfx/bell.mp3';        // solemn toll — rounds ending / game over
const ROOSTER = '/sfx/rooster.mp3';  // dawn — a new day begins

let muted = false;
try { muted = localStorage.getItem('guillotine-muted') === '1'; } catch { /* ignore */ }

export function isMuted() { return muted; }
export function toggleMuted() {
  muted = !muted;
  try { localStorage.setItem('guillotine-muted', muted ? '1' : '0'); } catch { /* ignore */ }
  return muted;
}

// Preload one element per clip (cloned per play so sounds can overlap).
const cache = {};
[...SLICE, ...GORE, BELL, ROOSTER].forEach(src => { const a = new Audio(src); a.preload = 'auto'; cache[src] = a; });

function playOne(src, volume) {
  if (muted) return;
  try {
    const a = cache[src] ? cache[src].cloneNode() : new Audio(src);
    a.volume = volume;
    a.play().catch(() => {});
  } catch { /* ignore */ }
}
export function playBell(volume = 0.6) { playOne(BELL, volume); }
export function playRooster(volume = 0.7) { playOne(ROOSTER, volume); }

function play(pool, volume) {
  if (muted) return;
  const src = pool[Math.floor(Math.random() * pool.length)];
  try {
    const a = cache[src] ? cache[src].cloneNode() : new Audio(src);
    a.volume = volume;
    a.playbackRate = 0.95 + Math.random() * 0.1;
    a.play().catch(() => {});
  } catch { /* ignore */ }
}

export function playBehead() {
  if (muted) return;
  play(SLICE, 0.7);
  setTimeout(() => play(GORE, 0.85), 110);
}

// Just the blade swish (no gore) — used for the logo gleam on load.
export function playSlice(volume = 0.5) { play(SLICE, volume); }

// A synthesized card "whoosh" (filtered noise sweep) when a card is played.
let _ac;
function actx() {
  if (!_ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) _ac = new A(); }
  return _ac;
}
export function playWhoosh() {
  if (muted) return;
  try {
    const ctx = actx(); if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const dur = 0.22, t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(380, t); bp.frequency.exponentialRampToValueAtTime(2400, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t); src.stop(t + dur);
  } catch { /* ignore */ }
}

// ── Condemned Line behead SFX (synth, 8-bit) ──
function nbuf(ctx, dur) { const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
export function playBladeFall() { // long sword-swish while the blade falls
  if (muted) return; try { const ctx = actx(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume(); const t = ctx.currentTime, dur = 0.46;
    const s = ctx.createBufferSource(); s.buffer = nbuf(ctx, dur); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(550, t); bp.frequency.exponentialRampToValueAtTime(5200, t + dur * 0.82); bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.06); g.gain.setValueAtTime(0.16, t + dur * 0.62); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(bp).connect(g).connect(ctx.destination); s.start(t); s.stop(t + dur);
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(3000, t + dur * 0.88); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.07, t + 0.07); og.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + dur);
  } catch { /* ignore */ } }
export function playClang() { // heavy metallic clang at the neck, + low thunk
  if (muted) return; try { const ctx = actx(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume(); const t = ctx.currentTime, base = 430;
    [[1, 0.5], [2.76, 0.26], [5.4, 0.14], [8.9, 0.07]].forEach(pr => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(base * pr[0] * 1.04, t); o.frequency.exponentialRampToValueAtTime(base * pr[0], t + 0.07); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pr[1] * 0.3, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.72); });
    const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.setValueAtTime(185, t); o2.frequency.exponentialRampToValueAtTime(42, t + 0.2); g2.gain.setValueAtTime(0.55, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); o2.connect(g2).connect(ctx.destination); o2.start(t); o2.stop(t + 0.32);
  } catch { /* ignore */ } }
export function playHeadBounce(vol = 0.3) { // soft pitched thud when the head bounces (NOT a coin)
  if (muted) return; try { const ctx = actx(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume(); const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(0.5, vol), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.16);
    const s = ctx.createBufferSource(); s.buffer = nbuf(ctx, 0.08); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; const ng = ctx.createGain(); ng.gain.setValueAtTime(vol * 0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); s.connect(f).connect(ng).connect(ctx.destination); s.start(t); s.stop(t + 0.09);
  } catch { /* ignore */ } }
export function playBloodDrops() { // wet droplet plips
  if (muted) return; try { const ctx = actx(); if (!ctx) return; if (ctx.state === 'suspended') ctx.resume(); const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) { const t = ctx.currentTime + 0.04 + i * (0.05 + Math.random() * 0.12); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; const f0 = 280 + Math.random() * 520; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.4, t + 0.07); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1 + Math.random() * 0.05, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.1); }
  } catch { /* ignore */ } }
// 8-bit "new day" fanfare — a square-wave arpeggio sting.
export function playDaySting(volume = 0.38) {
  if (muted) return;
  try {
    const ctx = actx(); if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    [392, 523, 659, 784, 1047].forEach((f, i) => {
      const t = t0 + i * 0.085;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.15);
    });
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'square'; o2.frequency.setValueAtTime(131, t0);
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(volume * 0.5, t0 + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o2.connect(g2).connect(ctx.destination); o2.start(t0); o2.stop(t0 + 0.34);
  } catch { /* ignore */ }
}

// Unlock autoplay on the first user gesture (iOS/Chrome policy).
if (typeof window !== 'undefined') {
  const unlock = () => {
    [...SLICE, ...GORE, BELL, ROOSTER].forEach(src => {
      const a = cache[src];
      if (!a) return;
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    });
  };
  window.addEventListener('pointerdown', unlock, { once: true });
}
