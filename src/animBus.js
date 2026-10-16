// Tiny signal so the view can hold the day transition / game-over until the
// severed-head animation has finished (bounced on the ground and flown to the pile).
let busy = false;
const subs = new Set();
export function setHeadBusy(b) {
  if (b === busy) return;
  busy = b;
  subs.forEach(fn => { try { fn(b); } catch { /* ignore */ } });
}
export function isHeadBusy() { return busy; }
export function onHeadBusy(fn) { subs.add(fn); return () => subs.delete(fn); }

// Day-transition gate for the plaza:
//   0 = normal, 1 = transition started → EMPTY STREET (don't show the new line),
//   2 = banner fully covering → place the new nobles instantly (hidden behind it).
let gate = 0;
const gsubs = new Set();
export function setDayGate(g) {
  if (g === gate) return;
  gate = g;
  gsubs.forEach(fn => { try { fn(g); } catch { /* ignore */ } });
}
export function dayGate() { return gate; }
export function onDayGate(fn) { gsubs.add(fn); return () => gsubs.delete(fn); }
