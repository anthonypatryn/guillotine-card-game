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
