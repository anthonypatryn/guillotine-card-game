// Renders the forge pixel sprites into card-art data URLs, so the game's
// existing <img src={nobleImg/actionImg(id)}> become 8-bit automatically.
import { NOBLE_SPRITES, ACTION_SPRITES, SPRITE_ALPHA as A, spriteSlug } from './sprites';

const CW = 150, CH = 214;
const cache = {};

function bounds(o) {
  let top = o.h - 1, bot = 0, found = false;
  for (let y = 0; y < o.h; y++) {
    let any = false;
    for (let x = 0; x < o.w; x++) if (A.indexOf(o.px[y * o.w + x]) > 0) { any = true; break; }
    if (any) { if (!found) { top = y; found = true; } bot = y; }
  }
  return { top, bot };
}

function backdrop(cc, w, h, cool) {
  const sky = cool ? '#cfd8e6' : '#e9dcbd', band = cool ? '#b9c4d6' : '#dccaa2',
    pil = cool ? '#aab6cc' : '#d2bd90', arch = cool ? '#cfd8e6' : '#e9dcbd',
    line = cool ? '#9aa7c0' : '#c9b488', r1 = cool ? '#9fb0cc' : '#cdb88e',
    r2 = cool ? '#8fa0bf' : '#c2ac7e', veil = cool ? 'rgba(207,216,230,.34)' : 'rgba(233,220,189,.34)';
  cc.fillStyle = cool ? '#dde3ec' : '#e9dcbd'; cc.fillRect(0, 0, w, h);
  cc.fillStyle = band; cc.fillRect(0, h * 0.06, w, h * 0.28);
  const pw = Math.max(10, Math.round(w / 8));
  cc.fillStyle = pil; for (let ax = -2; ax < w; ax += pw + 5) cc.fillRect(ax, h * 0.08, pw, h * 0.26);
  cc.fillStyle = arch; for (let ax = -2; ax < w; ax += pw + 5) { cc.beginPath(); cc.arc(ax + pw / 2, h * 0.08, pw / 2, Math.PI, 0); cc.fill(); }
  cc.fillStyle = line; cc.fillRect(0, h * 0.34, w, 3);
  const rows = [{ y: h * 0.44, c: r1, s: Math.max(9, Math.round(w / 11)) }, { y: h * 0.55, c: r2, s: Math.max(11, Math.round(w / 9)) }];
  for (let r = 0; r < rows.length; r++) { const ry = rows[r]; for (let x = 2; x < w; x += ry.s) { const jx = ((x * 37 + r * 53) % 7) - 3; cc.fillStyle = ry.c; cc.fillRect(x + jx, ry.y, ry.s - 3, h - ry.y); cc.fillRect(x + jx + 1, ry.y - ry.s * 0.6, ry.s - 5, ry.s * 0.6); } }
  cc.fillStyle = veil; cc.fillRect(0, 0, w, h);
}

function render(spr, cool, hex) {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
  backdrop(cc, CW, CH, cool);
  const scale = Math.max(3, Math.round((CW * 0.6) / spr.w));
  const b = bounds(spr), sw = spr.w * scale;
  const ox = Math.round((CW - sw) / 2), oy = CH - (b.bot + 1) * scale - 12;
  // soft contact shadow
  cc.fillStyle = 'rgba(0,0,0,.18)'; cc.beginPath();
  cc.ellipse(CW / 2, CH - 10, sw * 0.4, 6, 0, 0, 7); cc.fill();
  const pal = spr.pal;
  for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) {
    const i = A.indexOf(spr.px[y * spr.w + x]);
    if (i > 0) { cc.fillStyle = pal[i]; cc.fillRect(ox + x * scale, oy + y * scale, scale, scale); }
  }
  // faction inner border
  if (hex) { cc.strokeStyle = hex; cc.lineWidth = 5; cc.strokeRect(2.5, 2.5, CW - 5, CH - 5); }
  return c.toDataURL('image/png');
}

export function renderNoblePix(name, hex) {
  const slug = spriteSlug(name), k = 'n:' + slug;
  if (cache[k] !== undefined) return cache[k];
  const spr = NOBLE_SPRITES[slug];
  return (cache[k] = spr ? render(spr, false, hex) : null);
}
export function renderActionPix(name) {
  const slug = spriteSlug(name), k = 'a:' + slug;
  if (cache[k] !== undefined) return cache[k];
  const spr = ACTION_SPRITES[slug];
  return (cache[k] = spr ? render(spr, true, '#46566e') : null);
}

// Pixel card BACK (deck piles): a plaza/cool panel with a chunky guillotine-blade motif.
export function backImg(cool) {
  const k = cool ? 'back:a' : 'back:n'; if (cache[k] !== undefined) return cache[k];
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
  cc.fillStyle = cool ? '#1d2b45' : '#2a1d14'; cc.fillRect(0, 0, CW, CH);
  const d = cool ? '#122036' : '#1c130c', l = cool ? '#2a3d5e' : '#3a281a';
  for (let y = 0; y < CH; y += 14) for (let x = ((y / 14) & 1 ? 7 : 0); x < CW; x += 14) { cc.fillStyle = ((x + y) & 28) ? d : l; cc.fillRect(x, y, 10, 10); }
  // centered guillotine-blade diamond
  cc.fillStyle = cool ? '#4e78b0' : '#c8a24a';
  const mx = CW / 2, my = CH / 2;
  for (let i = -26; i <= 26; i += 6) { const w = 26 - Math.abs(i); cc.fillRect(mx - w, my + i, w * 2, 6); }
  cc.fillStyle = cool ? '#85b0e0' : '#e8c35a'; cc.fillRect(mx - 30, my - 34, 60, 8);
  cc.strokeStyle = cool ? '#4e78b0' : '#c8a24a'; cc.lineWidth = 5; cc.strokeRect(2.5, 2.5, CW - 5, CH - 5);
  return (cache[k] = c.toDataURL('image/png'));
}
