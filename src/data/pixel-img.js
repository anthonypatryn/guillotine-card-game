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
// ── Action cards: text + a clear pixel symbol (no art), so the effect reads
//    at a glance. Family picks the accent colour + icon. ──
const FAM = {
  lineMove:       { c: '#e8c35a', s: 'arrow' },
  toFrontEnd:     { c: '#e8c35a', s: 'tofront' },
  rearrange:      { c: '#7fd0c0', s: 'swap' },
  lineAddRemove:  { c: '#d4537e', s: 'x' },
  persistent:     { c: '#9e86c0', s: 'pin' },
  playerAttack:   { c: '#ec8b7a', s: 'steal' },
  selfEconomy:    { c: '#85b0e0', s: 'draw' },
  dayTurnControl: { c: '#f3dd8a', s: 'day' },
};
function symFor(def) {
  const f = def.family, p = def.params || {};
  if (f === 'rearrange') return p.kind === 'reverse' ? 'swap' : 'shuffle';
  if (f === 'lineAddRemove') return (p.kind === 'addNobles' || p.kind === 'lateArrival') ? 'plus' : 'x';
  if (f === 'persistent') return p.kind === 'support' ? 'dots' : (p.kind === 'toughCrowd' ? 'star' : 'shield');
  if (f === 'selfEconomy') return p.kind === 'points' ? 'star' : 'draw';
  return (FAM[f] || {}).s || 'diamond';
}
function wrapText(cc, text, font, maxW, maxLines) {
  cc.font = font;
  const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cc.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && cc.measureText(last + '…').width > maxW) last = last.slice(0, -1);
  kept[maxLines - 1] = last.replace(/\s*\S*$/, '').trimEnd() + '…';
  return kept;
}
function drawSym(cc, key, cx, cy, s, col) {
  cc.save(); cc.fillStyle = col; cc.strokeStyle = col; cc.lineWidth = Math.max(4, s * 0.26); cc.lineCap = 'square';
  const tri = (ax, ay, bx, by, dx, dy) => { cc.beginPath(); cc.moveTo(ax, ay); cc.lineTo(bx, by); cc.lineTo(dx, dy); cc.closePath(); cc.fill(); };
  const rarrow = (ox, oy, len, hd) => { cc.fillRect(ox - len / 2, oy - hd * 0.18, len * 0.64, hd * 0.36); tri(ox + len * 0.5, oy, ox + len * 0.1, oy - hd * 0.55, ox + len * 0.1, oy + hd * 0.55); };
  switch (key) {
    case 'arrow': rarrow(cx, cy, s * 1.8, s * 1.1); break;
    case 'tofront': rarrow(cx + s * 0.18, cy, s * 1.5, s * 1.0); cc.fillRect(cx - s * 0.95, cy - s * 0.6, Math.max(4, s * 0.24), s * 1.2); break;
    case 'swap':
      cc.fillRect(cx - s * 0.7, cy - s * 0.52, s * 1.0, Math.max(3, s * 0.2)); tri(cx + s * 0.62, cy - s * 0.42, cx + s * 0.2, cy - s * 0.72, cx + s * 0.2, cy - s * 0.12);
      cc.fillRect(cx - s * 0.3, cy + s * 0.32, s * 1.0, Math.max(3, s * 0.2)); tri(cx - s * 0.62, cy + s * 0.42, cx - s * 0.2, cy + s * 0.12, cx - s * 0.2, cy + s * 0.72); break;
    case 'shuffle':
      cc.lineWidth = Math.max(4, s * 0.22);
      cc.beginPath(); cc.moveTo(cx - s * 0.7, cy - s * 0.6); cc.lineTo(cx + s * 0.7, cy + s * 0.6); cc.moveTo(cx - s * 0.7, cy + s * 0.6); cc.lineTo(cx + s * 0.7, cy - s * 0.6); cc.stroke();
      tri(cx + s * 0.78, cy + s * 0.66, cx + s * 0.3, cy + s * 0.66, cx + s * 0.78, cy + s * 0.18);
      tri(cx + s * 0.78, cy - s * 0.66, cx + s * 0.78, cy - s * 0.18, cx + s * 0.3, cy - s * 0.66); break;
    case 'x':
      cc.lineWidth = Math.max(6, s * 0.34); cc.beginPath();
      cc.moveTo(cx - s * 0.6, cy - s * 0.6); cc.lineTo(cx + s * 0.6, cy + s * 0.6); cc.moveTo(cx + s * 0.6, cy - s * 0.6); cc.lineTo(cx - s * 0.6, cy + s * 0.6); cc.stroke(); break;
    case 'plus':
      cc.fillRect(cx - s * 0.18, cy - s * 0.65, s * 0.36, s * 1.3); cc.fillRect(cx - s * 0.65, cy - s * 0.18, s * 1.3, s * 0.36); break;
    case 'star': {
      cc.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.34 : s * 0.75; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? cc.lineTo(x, y) : cc.moveTo(x, y); } cc.closePath(); cc.fill(); break;
    }
    case 'dots': { const cols = ['#c0392b', '#4a90c2', '#6aa84f']; for (let i = 0; i < 3; i++) { cc.fillStyle = cols[i]; cc.fillRect(cx - s * 0.75 + i * s * 0.6, cy - s * 0.25, s * 0.42, s * 0.5); } break; }
    case 'shield':
      cc.beginPath(); cc.moveTo(cx, cy - s * 0.7); cc.lineTo(cx + s * 0.6, cy - s * 0.4); cc.lineTo(cx + s * 0.55, cy + s * 0.35); cc.lineTo(cx, cy + s * 0.75); cc.lineTo(cx - s * 0.55, cy + s * 0.35); cc.lineTo(cx - s * 0.6, cy - s * 0.4); cc.closePath(); cc.fill(); break;
    case 'steal': rarrow(cx - s * 0.1, cy, s * 1.5, s * 1.0); cc.fillRect(cx - s * 0.95, cy - s * 0.45, s * 0.3, s * 0.9); break;
    case 'draw':
      cc.fillRect(cx - s * 0.5, cy - s * 0.7, s * 1.0, s * 1.3);
      cc.fillStyle = '#1a1622'; cc.fillRect(cx - s * 0.34, cy - s * 0.5, s * 0.68, s * 0.95);
      cc.fillStyle = col; cc.fillRect(cx - s * 0.1, cy - s * 0.28, s * 0.2, s * 0.6); cc.fillRect(cx - s * 0.28, cy - s * 0.1, s * 0.56, s * 0.2); break;
    case 'day': {
      cc.beginPath(); cc.arc(cx, cy, s * 0.42, 0, 7); cc.fill();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; cc.fillRect(cx + Math.cos(a) * s * 0.6 - 2, cy + Math.sin(a) * s * 0.6 - 2, 5, 5); } break;
    }
    default: cc.beginPath(); cc.moveTo(cx, cy - s * 0.7); cc.lineTo(cx + s * 0.7, cy); cc.lineTo(cx, cy + s * 0.7); cc.lineTo(cx - s * 0.7, cy); cc.closePath(); cc.fill();
  }
  cc.restore();
}
export function renderActionPix(def) {
  if (!def || typeof def === 'string') return null;   // needs the full card def now
  const slug = spriteSlug(def.name), k = 'a:' + slug;
  if (cache[k] !== undefined) return cache[k];
  const accent = (FAM[def.family] || {}).c || '#c8a24a';
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
  cc.fillStyle = '#1a1622'; cc.fillRect(0, 0, CW, CH);
  cc.fillStyle = 'rgba(0,0,0,.16)'; for (let y = 0; y < CH; y += 4) cc.fillRect(0, y, CW, 2);
  cc.strokeStyle = '#000'; cc.lineWidth = 8; cc.strokeRect(4, 4, CW - 8, CH - 8);
  cc.strokeStyle = accent; cc.lineWidth = 3; cc.strokeRect(8, 8, CW - 16, CH - 16);
  cc.textAlign = 'center'; cc.textBaseline = 'top';
  // name (gold, up to 2 lines)
  const nm = wrapText(cc, def.name.toUpperCase(), "9px 'Silkscreen', monospace", CW - 22, 2);
  cc.font = "9px 'Silkscreen', monospace";
  nm.forEach((ln, i) => { const y = 16 + i * 14; cc.fillStyle = '#000'; cc.fillText(ln, CW / 2 + 1, y + 1); cc.fillStyle = accent; cc.fillText(ln, CW / 2, y); });
  const nb = 16 + nm.length * 14 + 4;
  cc.fillStyle = accent; cc.fillRect(16, nb, CW - 32, 2);
  // symbol
  drawSym(cc, symFor(def), CW / 2, nb + 34, 24, accent);
  // effect text (cream, wrapped)
  const ty = nb + 66;
  const tx = wrapText(cc, def.text, "7px 'Silkscreen', monospace", CW - 22, 10);
  cc.font = "7px 'Silkscreen', monospace";
  tx.forEach((ln, i) => { const y = ty + i * 10; cc.fillStyle = '#000'; cc.fillText(ln, CW / 2 + 1, y + 1); cc.fillStyle = '#d8cdb8'; cc.fillText(ln, CW / 2, y); });
  return (cache[k] = c.toDataURL('image/png'));
}
// Regenerate the text cards once the pixel fonts have actually loaded.
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { for (const key in cache) if (key[0] === 'a' && key[1] === ':') delete cache[key]; });
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
