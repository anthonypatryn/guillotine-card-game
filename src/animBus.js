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
