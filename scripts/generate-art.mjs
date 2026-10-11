// Regenerates the game's derived SVG art from the two source files the artist
// provided (public/art-pieces.svg and public/art-game.svg) into public/art/.
//
//   node scripts/generate-art.mjs
//
// Outputs: basket-{color}.svg (recoloured to in-game card colours, with an
// embossed faction symbol), symbol-{color}.svg (faction emblem), head.svg +
// head-gold.svg (points silhouette), blade.svg (guillotine blade), and
// fleur-real-{gold,silver,bright}.svg (the metallic fleurs-de-lis).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/art');
mkdirSync(OUT, { recursive: true });

// ── pieces from art-pieces.svg (baskets, symbols, head, blade) ───────────────
const src = readFileSync(resolve(ROOT, 'public/art-pieces.svg'), 'utf8');
const defs = src.slice(src.indexOf('<defs>'), src.indexOf('</defs>') + 7);
const grabG = m => { const i = src.indexOf(m); return src.slice(i, src.indexOf('</g>', i) + 4); };
const grabPath = m => { const i = src.indexOf(m); return src.slice(i, src.indexOf('/>', i) + 2); };
const head = (() => { const li = src.indexOf('<g id="Layer_1">'); const hs = src.indexOf('<g>', li); return src.slice(hs, src.indexOf('</g>', hs) + 4); })();
const blade = (() => { const bi = src.indexOf('<circle class="st17"'); return src.slice(src.lastIndexOf('<g>', bi), src.indexOf('</g>', bi) + 4); })();
const graySym = (() => { const gi = src.indexOf('M537.3'); return src.slice(src.lastIndexOf('<g class="st4">', gi), src.indexOf('</g>', gi) + 4); })();

const wrap = (vb, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb}">${defs}<g style="isolation:isolate">${body}</g></svg>\n`;

const baskets = {
  red:    { vb: '245.2 32.8 104.2 106.2',  g: grabG('<g id="UZ4a6q">'),  s: grabPath('<path class="st4" d="M313.8,124'),   cls: 'st18' },
  blue:   { vb: '355 32.1 104.2 106.9',    g: grabG('<g id="UZ4a6q1"'),  s: grabG('<g id="b5YSFI.tif"'),                   cls: 'st11' },
  green:  { vb: '245.2 146.7 104.2 106.2', g: grabG('<g id="UZ4a6q2"'),  s: grabG('<g id="_x38_MR7EK.tif"'),               cls: 'st6' },
  purple: { vb: '355 146 104.2 106.9',     g: grabG('<g id="UZ4a6q3"'),  s: grabPath('<path class="st4" d="M428.6,211.5'), cls: 'st5' },
  gray:   { vb: '466.9 32.8 104.2 106.2',  g: grabG('<g id="UZ4a6q4"'),  s: graySym,                                       cls: 'st13' },
};
const CARD_HEX = { red: '#c0392b', blue: '#4a90c2', green: '#6aa84f', gray: '#8a8a8a', purple: '#8e5fb0' };
const SYM_HEX  = { red: '#e02b1d', blue: '#00aeef', green: '#199b2e', purple: '#bf00ed', gray: '#848484' };
const symVB = { red: '278.5 92 37.3 37.2', blue: '391.1 88.4 35.4 44', green: '278.8 201.9 37 38.1', purple: '383.3 206.5 47.6 31.2', gray: '496.9 94.3 44.8 34.3' };
const cleanSym = m => m.replace(/ ?class="st4"/g, '').replace(/ id="[^"]*"/g, '').replace(/ data-name="[^"]*"/g, '');
const popSymbol = m => { const c = cleanSym(m); return `<g fill="#ffffff" opacity="0.30" transform="translate(0 -1)">${c}</g><g fill="#16100a" opacity="0.92">${c}</g>`; };

for (const [k, v] of Object.entries(baskets)) {
  const basket = v.g.replace(`class="${v.cls}"`, `fill="${CARD_HEX[k]}"`);
  writeFileSync(resolve(OUT, `basket-${k}.svg`), wrap(v.vb, basket + popSymbol(v.s)));
  const clean = cleanSym(v.s);
  writeFileSync(resolve(OUT, `symbol-${k}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${symVB[k]}"><g fill="${SYM_HEX[k]}">${clean}</g></svg>\n`);
}
writeFileSync(resolve(OUT, 'head.svg'), wrap('49.2 52.1 148.9 179', head));
writeFileSync(resolve(OUT, 'head-gold.svg'), wrap('49.2 52.1 148.9 179', head).replace('<g style="isolation:isolate">', '<g style="isolation:isolate" fill="#d9ad5c">'));
writeFileSync(resolve(OUT, 'blade.svg'), wrap('302.4 313.2 132.8 110.6', blade));

// ── metallic fleurs-de-lis from art-game.svg (first 3 top-level <g>) ─────────
const fsrc = readFileSync(resolve(ROOT, 'public/art-game.svg'), 'utf8');
const nthGroup = n => { let i = 0, s = -1; for (let k = 0; k <= n; k++) { s = fsrc.indexOf('<g>', i); i = fsrc.indexOf('</g>', s) + 4; } return fsrc.slice(s, i); };
const fleurs = { 'fleur-real-gold': '597.8 -6 321.7 369', 'fleur-real-silver': '966.8 -6 321.7 369', 'fleur-real-bright': '1329.8 -6 321.7 369' };
Object.entries(fleurs).forEach(([name, vb], i) => {
  writeFileSync(resolve(OUT, `${name}.svg`), `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${nthGroup(i)}</svg>\n`);
});

console.log('Regenerated art in public/art/. Note: the UI fleur (public/art/fleur.svg) is a chosen copy — set it with e.g. `cp public/art/fleur-real-silver.svg public/art/fleur.svg`.');
