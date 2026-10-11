// Lightweight SFX: a blade slice then a gore/splatter hit on each beheading.
const SLICE = ['/sfx/slice1.mp3', '/sfx/slice2.mp3', '/sfx/slice3.mp3'];
const GORE = ['/sfx/gore-axe.mp3', '/sfx/gore-rip.mp3', '/sfx/gore-splat.mp3', '/sfx/behead1.mp3', '/sfx/behead2.mp3'];

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
[...SLICE, ...GORE].forEach(src => { const a = new Audio(src); a.preload = 'auto'; cache[src] = a; });

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

// Unlock autoplay on the first user gesture (iOS/Chrome policy).
if (typeof window !== 'undefined') {
  const unlock = () => {
    [...SLICE, ...GORE].forEach(src => {
      const a = cache[src];
      if (!a) return;
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    });
  };
  window.addEventListener('pointerdown', unlock, { once: true });
}
