import { useRef, useEffect } from 'react';
import { NOBLE_SPRITES, SCENE_SPRITES, SPRITE_ALPHA as A, spriteSlug } from './data/sprites';
import { NOBLE_BY_ID } from './data/cards';
import { playBladeFall, playClang, playHeadBounce, playBloodDrops, isMuted } from './sound';

// ── scene geometry (internal canvas resolution) ──
const W = 1000, Hc = 360, S = 4, baseY = Hc - 14, NECK = 12, SG = 7;
const _bc = new Map(), _cc = new Map();                       // bounds / full-sprite canvas caches
function bounds(o) {
  if (_bc.has(o)) return _bc.get(o);
  let top = o.h - 1, bot = 0, f = false;
  for (let y = 0; y < o.h; y++) { let any = false; for (let x = 0; x < o.w; x++) if (A.indexOf(o.px[y * o.w + x]) > 0) { any = true; break; } if (any) { if (!f) { top = y; f = true; } bot = y; } }
  const b = { top, bot }; _bc.set(o, b); return b;
}
function spriteCanvas(o) {
  if (_cc.has(o)) return _cc.get(o);
  const b = bounds(o), h = b.bot - b.top + 1, c = document.createElement('canvas');
  c.width = o.w * S; c.height = h * S; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
  for (let y = b.top; y <= b.bot; y++) for (let x = 0; x < o.w; x++) { const i = A.indexOf(o.px[y * o.w + x]); if (i > 0) { cc.fillStyle = o.pal[i]; cc.fillRect(x * S, (y - b.top) * S, S, S); } }
  _cc.set(o, c); return c;
}
function chunk(o, y0, y1) {
  const w = o.w * S, h = (y1 - y0 + 1) * S, c = document.createElement('canvas');
  c.width = w; c.height = h; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < o.w; x++) { const i = A.indexOf(o.px[y * o.w + x]); if (i > 0) { cc.fillStyle = o.pal[i]; cc.fillRect(x * S, (y - y0) * S, S, S); } }
  return c;
}
function paintedCX(spr, y0, y1) { let L = 99, R = -1; for (let y = y0; y <= y1; y++) for (let x = 0; x < spr.w; x++) if (spr.px[y * spr.w + x] !== '0') { if (x < L) L = x; if (x > R) R = x; } return R < 0 ? spr.w / 2 : (L + R + 1) / 2; }
const _hcx = new Map();
function headCX(o) { if (_hcx.has(o)) return _hcx.get(o); const v = paintedCX(o, 0, NECK - 1) * S; _hcx.set(o, v); return v; }
function gcanvas(spr, keep) { const c = document.createElement('canvas'); c.width = spr.w * SG; c.height = spr.h * SG; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false; for (let y = 0; y < spr.h; y++) for (let x = 0; x < spr.w; x++) { if (!keep(x, y)) continue; const i = A.indexOf(spr.px[y * spr.w + x]); if (i > 0) { cc.fillStyle = spr.pal[i]; cc.fillRect(x * SG, y * SG, SG, SG); } } return c; }
const inBlade = (x, y) => y >= 6 && y <= 11 && x >= 6 && x <= 17;
function sprFor(def) { return NOBLE_SPRITES[spriteSlug(def.name)]; }

export default function PlazaScene({ game, onNobleHover, onNobleClick }) {
  const canvasRef = useRef(null);
  const sc = useRef({ vis: [], exec: null, queue: [], head: null, blood: [], floaters: [], shake: 0, rioters: [], smoke: [], seen: -1, geom: null });
  const gameRef = useRef(game); gameRef.current = game;
  const hoverCb = useRef(onNobleHover); hoverCb.current = onNobleHover;
  const clickCb = useRef(onNobleClick); clickCb.current = onNobleClick;

  // one-time init + rAF loop
  useEffect(() => {
    const s = sc.current;
    s.rioters = []; for (let i = 0; i < 30; i++) s.rioters.push({ x: Math.random() * W, y: 182 + Math.random() * 26, sp: (Math.random() < .5 ? -1 : 1) * (0.3 + Math.random() * 0.8), ph: Math.random() * 6.28, arm: Math.random() < .42 });
    s.smoke = []; for (let j = 0; j < 8; j++) s.smoke.push({ x: Math.random() * W, y: 30 + Math.random() * 70, r: 16 + Math.random() * 26, sp: 0.1 + Math.random() * 0.2, ph: Math.random() * 6.28 });
    const g = SCENE_SPRITES.guillotine;
    if (g) {
      const gw = g.w * SG, gh = g.h * SG, gcx = paintedCX(g, 0, g.h - 1);
      const gy0 = baseY - gh, gx0 = Math.round(W - gw - 24);
      const HX = gx0 + Math.round(gcx * SG), HY = gy0 + 21 * SG, STOCKY = gy0 + 23 * SG;
      const bladeTravel = STOCKY - (gy0 + 12 * SG);
      s.geom = { gx0, gy0, HX, HY, STOCKY, bladeTravel, GBODY: gcanvas(g, (x, y) => !inBlade(x, y)), GBLADE: gcanvas(g, inBlade), frontX: HX - 118 };
    }
    let raf; const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reconcile visual line + queue beheads whenever the game state changes
  useEffect(() => {
    const s = sc.current, G = game.G, line = G.line;
    // detect new collects (behead) before rebuilding vis (so we can grab the sprite)
    const prev = {}; s.vis.forEach(v => prev[v.uid] = v);
    let maxId = s.seen;
    for (const e of G.log) {
      if (e.id <= s.seen) continue; maxId = Math.max(maxId, e.id);
      if (e.kind === 'collect' && e.defId) {
        const def = NOBLE_BY_ID[e.defId], spr = sprFor(def);
        if (spr) s.queue.push({ def, spr, startX: (prev[e.uid]?._x ?? (s.geom?.frontX ?? W)), pileIdx: e.playerIdx });
      }
    }
    s.seen = maxId;
    // rebuild vis from the current line, preserving positions for cards that remain
    s.vis = line.map((inst) => {
      const def = NOBLE_BY_ID[inst.defId], ex = prev[inst.uid];
      if (ex) { ex.def = def; return ex; }
      return { uid: inst.uid, def, spr: sprFor(def), _x: W + 60, _wt: 0 };
    });
  }, [game.G.line, game.G.log]);

  function gapFor(n) { const geom = sc.current.geom; const avail = (geom?.frontX ?? W - 140) - 30; return Math.max(24, Math.min(92, avail / Math.max(1, n))); }

  function pileCanvasPt(pileIdx) {
    const cv = canvasRef.current; if (!cv) return { x: W / 2, y: baseY };
    const el = document.querySelector(`[data-pile="${pileIdx}"]`); const r = cv.getBoundingClientRect(); const sx = W / r.width, sy = Hc / r.height;
    if (!el) return { x: W / 2, y: 40 };
    const p = el.getBoundingClientRect();
    return { x: (p.left + p.width / 2 - r.left) * sx, y: (p.top + p.height / 2 - r.top) * sy };
  }

  function draw(t) {
    const cv = canvasRef.current; if (!cv) return; const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const s = sc.current, geom = s.geom;
    ctx.save();
    if (s.shake > 0) { ctx.translate((Math.random() - .5) * s.shake, (Math.random() - .5) * s.shake); s.shake *= 0.82; if (s.shake < 0.4) s.shake = 0; }
    ctx.clearRect(-24, -24, W + 48, Hc + 48);
    drawPlaza(ctx, s, t);

    // start a queued behead
    if (!s.exec && s.queue.length && geom) { const q = s.queue.shift(); s.exec = { o: q.spr, def: q.def, x: q.startX, phase: 'walk', t: 0, wt: 0, blade: 0, bvel: 0, pileIdx: q.pileIdx }; s.exec.target = geom.HX - headCX(q.spr); if (!isMuted()) { /* footstep tick could go here */ } }

    let bf = 0, showHole = false, sink = 1, walkDraw = false;
    const ex = s.exec;
    if (ex && geom) {
      if (ex.phase === 'walk') { ex.x += (ex.target - ex.x) * 0.12; ex.wt++; if (Math.abs(ex.target - ex.x) < 2) { ex.x = ex.target; ex.phase = 'set'; ex.t = 0; } walkDraw = true; }
      else if (ex.phase === 'set') { ex.t++; const k = Math.min(1, ex.t / 28); sink = k * k * (3 - 2 * k); showHole = true; if (ex.t > 40) { ex.phase = 'drop'; ex.blade = 0; ex.bvel = 0; playBladeFall(); } }
      else if (ex.phase === 'drop') { ex.bvel = (ex.bvel || 0.012) + 0.004; ex.blade += ex.bvel; bf = Math.min(1, ex.blade); if (ex.blade >= 1) { bf = 1; s.shake = 10; sever(s); showHole = false; } else showHole = true; }
      else if (ex.phase === 'fly') { bf = 1; ex.t++; if (ex.t > 40) s.exec = null; }
    }

    // walking victim is BEHIND the frame; while laying down the body stays behind too
    if (walkDraw) drawShuffle(ctx, ex);
    else if (showHole) drawVictimBehind(ctx, geom, ex.o, ex.x, sink);
    if (geom) ctx.drawImage(geom.GBODY, geom.gx0, geom.gy0);
    if (geom) ctx.drawImage(geom.GBLADE, geom.gx0, geom.gy0 + bf * geom.bladeTravel);

    // the standing line (back → front); gap compresses so all fit
    const gap = gapFor(s.vis.length);
    for (let i = 0; i < s.vis.length; i++) {
      const o = s.vis[i], tgt = geom ? geom.frontX - i * gap : W - 140 - i * gap;
      o._x += (tgt - o._x) * 0.12; if (!o.spr) continue;
      const c = spriteCanvas(o.spr), w = o.spr.w * S, moving = Math.abs(tgt - o._x) > 0.6; if (moving) o._wt = (o._wt || 0) + 1;
      const wob = moving ? Math.sin(o._wt * 0.45) : 0, lift = moving ? Math.abs(Math.sin(o._wt * 0.45)) * 2 : 0;
      const ph = i * 1.9, rot = moving ? wob * 0.035 : Math.sin(t / 1000 + ph) * 0.85 * Math.PI / 180, ox = moving ? wob * 2.2 : 0;
      if (o._x < -w || o._x > W) continue;
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(o._x + w / 2, baseY + 2, w * 0.42, 5, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(o._x + w / 2 + ox, baseY - lift); ctx.rotate(rot); ctx.drawImage(c, -w / 2, -c.height); ctx.restore();
      if (i === 0 && !s.exec) drawTag(ctx, o._x + w / 2, baseY - c.height - 6, 'NEXT');
    }
    if (showHole) drawVictimHead(ctx, geom, ex.o, ex.x, sink);
    drawExecutioner(ctx, geom);
    updateHead(ctx, s); updateBlood(ctx, s); updateFloaters(ctx, s);
    ctx.restore();
  }

  function sever(s) {
    const ex = s.exec, geom = s.geom, b = bounds(ex.o), ch = chunk(ex.o, b.top, NECK - 1), dir = Math.random() < .5 ? -1 : 1;
    const pile = pileCanvasPt(ex.pileIdx);
    s.head = { c: ch, x: geom.HX - ch.width / 2, y: geom.HY - ch.height / 2, vx: dir * (1.2 + Math.random() * 4.5), vy: -(6.2 + Math.random() * 4.5), rot: 0, vr: (Math.random() < .5 ? -1 : 1) * (0.12 + Math.random() * 0.34), bounce: 0.4 + Math.random() * 0.34, rest: 0, life: 0, pile };
    const tones = ['#8a0f14', '#a7303a', '#6e1620'];
    for (let k = 0; k < 42; k++) s.blood.push({ x: geom.HX, y: geom.HY + 4, vx: (Math.random() * 2 - 1) * 5.5, vy: -Math.random() * 7 - 1, life: 1, sz: S * (Math.random() < .3 ? 2 : 1), col: tones[k % 3] });
    ex.phase = 'fly'; ex.t = 0; playClang(); playBloodDrops();
    const pts = parseInt(ex.def.pts, 10); spawnScore(s, ex.def, geom.HX, geom.gy0 - 16, isNaN(pts) ? 0 : pts);
  }
  function updateHead(ctx, s) {
    const h = s.head; if (!h) return;
    h.life++;
    if (h.life < 36) {                      // free bounce
      h.vy += 0.4; h.x += h.vx; h.y += h.vy; h.rot += h.vr;
      const gY = baseY - h.c.height;
      if (h.y > gY) { h.y = gY; const imp = Math.abs(h.vy); if (imp > 1.6) playHeadBounce(Math.min(0.45, 0.12 + imp * 0.04)); h.vy *= -h.bounce; h.vx *= 0.75; h.vr *= 0.72; }
    } else {                                 // home to the player's pile, shrinking
      h.x += (h.pile.x - h.c.width / 2 - h.x) * 0.16; h.y += (h.pile.y - h.c.height / 2 - h.y) * 0.16; h.rot += h.vr * 0.3; h.vr *= 0.94;
      h.scale = (h.scale ?? 1) * 0.93;
      if (h.scale < 0.18) { s.head = null; return; }
    }
    ctx.save(); ctx.translate(h.x + h.c.width / 2, h.y + h.c.height / 2); ctx.rotate(h.rot); const sc2 = h.scale ?? 1; ctx.scale(sc2, sc2); ctx.drawImage(h.c, -h.c.width / 2, -h.c.height / 2); ctx.restore();
  }
  function updateBlood(ctx, s) {
    for (let i = s.blood.length - 1; i >= 0; i--) { const p = s.blood[i]; p.vy += 0.34; p.x += p.vx; p.y += p.vy; p.life -= 0.009; if (p.y > baseY) { p.y = baseY; p.vy *= -0.3; p.vx *= 0.6; } if (p.life <= 0) { s.blood.splice(i, 1); continue; } ctx.globalAlpha = Math.max(0, Math.min(1, p.life)); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.sz, p.sz); }
    ctx.globalAlpha = 1;
  }
  function spawnScore(s, def, x, y, pts) {
    const sign = pts < 0 ? '-' : '+', col = pts < 0 ? '#ff6a6a' : '#ffe08a';
    s.floaters.push({ txt: sign + Math.abs(pts), x, y, vy: -0.85, life: 1.8, size: 20, col, shadow: '#280a0a' });
    s.floaters.push({ txt: (def.name || '').toUpperCase(), x, y: y + 18, vy: -0.85, life: 1.8, size: 8, col: '#efe3cd', shadow: '#120c08', delay: 4 });
  }
  function updateFloaters(ctx, s) {
    for (let i = s.floaters.length - 1; i >= 0; i--) { const f = s.floaters[i]; if (f.delay > 0) { f.delay--; continue; } f.y += f.vy; f.vy *= 0.94; f.life -= 0.009; if (f.life <= 0) { s.floaters.splice(i, 1); continue; } const a = Math.max(0, Math.min(1, f.life)); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = f.size + "px 'Press Start 2P',monospace"; ctx.fillStyle = f.shadow; ctx.fillText(f.txt, f.x + 2, f.y + 2); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y); }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  // ── pointer: hover/click a standing noble ──
  function at(e) {
    const cv = canvasRef.current, r = cv.getBoundingClientRect(), sx = W / r.width, sy = Hc / r.height;
    const mx = (e.clientX - r.left) * sx, my = (e.clientY - r.top) * sy; const s = sc.current;
    for (let i = 0; i < s.vis.length; i++) { const o = s.vis[i]; if (!o.spr) continue; const c = spriteCanvas(o.spr), w = o.spr.w * S, top = baseY - c.height; if (mx >= o._x && mx <= o._x + w && my >= top - 6 && my <= baseY) return { i, o, top, w }; }
    return null;
  }
  function onMove(e) {
    const hit = at(e); const cv = canvasRef.current; cv.style.cursor = hit ? 'pointer' : 'default';
    if (!hit || !hoverCb.current) { hoverCb.current && hoverCb.current(null); return; }
    const r = cv.getBoundingClientRect(), invx = r.width / W, invy = r.height / Hc;
    const rect = { left: r.left + hit.o._x * invx, top: r.top + hit.top * invy, width: hit.w * invx, height: (baseY - hit.top) * invy, right: r.left + (hit.o._x + hit.w) * invx, bottom: r.top + baseY * invy };
    hoverCb.current(hit.o.def, rect);
  }
  function onLeave() { hoverCb.current && hoverCb.current(null); }
  function onClick(e) { const hit = at(e); if (hit && clickCb.current) clickCb.current(hit.i); }

  return <canvas ref={canvasRef} width={W} height={Hc} className="plaza-scene"
    onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick} aria-label="The condemned line" />;
}

// ── drawing helpers (module scope; take ctx) ──
function drawTag(ctx, cx, y, txt) { ctx.font = "7px 'Press Start 2P',monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; const w = ctx.measureText(txt).width + 8; ctx.fillStyle = '#c8a24a'; ctx.fillRect(cx - w / 2, y - 10, w, 12); ctx.fillStyle = '#140d08'; ctx.fillText(txt, cx, y - 1); ctx.textAlign = 'left'; }
function victimTopY(geom, o, sink) { const b = bounds(o), groundTop = baseY - (b.bot + 1) * S, midHead = (b.top + NECK) / 2, holeTop = geom.HY - midHead * S; return groundTop + (holeTop - groundTop) * sink; }
function drawVictimBehind(ctx, geom, o, x, sink) { const b = bounds(o), c = spriteCanvas(o), topY = victimTopY(geom, o, sink); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, baseY); ctx.clip(); ctx.drawImage(c, x, topY + b.top * S); ctx.restore(); }
function drawVictimHead(ctx, geom, o, x, sink) { const b = bounds(o), c = spriteCanvas(o), topY = victimTopY(geom, o, sink); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, topY + NECK * S); ctx.clip(); ctx.drawImage(c, x, topY + b.top * S); ctx.restore(); }
function drawShuffle(ctx, ex) { const o = ex.o, c = spriteCanvas(o), wt = ex.wt || 0, wob = Math.sin(wt * 0.45), lift = Math.abs(Math.sin(wt * 0.45)) * 2; ctx.save(); ctx.translate(ex.x + c.width / 2 + wob * 2.2, baseY - lift); ctx.rotate(wob * 0.035); ctx.drawImage(c, -c.width / 2, -c.height); ctx.restore(); }
function drawExecutioner(ctx, geom) { const e = SCENE_SPRITES.executioner; if (!e || !geom) return; const c = spriteCanvas(e), ex2 = Math.min(W - c.width - 2, geom.gx0 + geom.GBODY.width - 10); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(ex2 + c.width / 2, baseY + 2, c.width * 0.4, 5, 0, 0, 7); ctx.fill(); ctx.drawImage(c, ex2, baseY - c.height); }
function eiffel(ctx, ex, baseline, h, col) { ctx.fillStyle = col; const topY = baseline - h, midY = topY + h * 0.45, sp = h * 0.22; ctx.fillRect(ex - 1, topY - 8, 2, 8); ctx.beginPath(); ctx.moveTo(ex - 3, midY); ctx.lineTo(ex - 1.5, topY); ctx.lineTo(ex + 1.5, topY); ctx.lineTo(ex + 3, midY); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(ex - 3, midY); ctx.lineTo(ex - sp, baseline); ctx.lineTo(ex - sp + 6, baseline); ctx.lineTo(ex - 1, midY); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(ex + 3, midY); ctx.lineTo(ex + sp, baseline); ctx.lineTo(ex + sp - 6, baseline); ctx.lineTo(ex + 1, midY); ctx.closePath(); ctx.fill(); ctx.fillRect(ex - 9, midY - 1, 18, 3); ctx.fillRect(ex - sp * 0.75, baseline - h * 0.3, sp * 1.5, 3); }
function drawSkyline(ctx, wallTop) { ctx.save(); ctx.globalAlpha = 0.9; const tops = [16, 28, 12, 24, 34, 14, 22, 30, 12, 26, 18, 32, 14, 20, 28, 16]; ctx.fillStyle = '#2c2636'; for (let bx = -12, i = 0; bx < W + 12; bx += 60, i++) { const hh = tops[i % tops.length]; ctx.fillRect(bx, wallTop - hh, 50, hh); } ctx.fillStyle = '#342d40'; ctx.beginPath(); ctx.arc(236, wallTop - 24, 18, Math.PI, 0); ctx.fill(); ctx.fillRect(218, wallTop - 24, 36, 24); ctx.fillRect(234, wallTop - 40, 2, 16); ctx.beginPath(); ctx.arc(640, wallTop - 20, 14, Math.PI, 0); ctx.fill(); ctx.fillRect(626, wallTop - 20, 28, 20); eiffel(ctx, 430, wallTop, 120, '#3a3348'); ctx.restore(); }
function drawPlaza(ctx, s, t) {
  t = t || 0; const wallTop = 92, wallBot = 174;
  const sky = ['#14111c', '#1a1622', '#231a24', '#2e1f24', '#3a2622'], bh = (wallTop + 16) / sky.length;
  for (let i = 0; i < sky.length; i++) { ctx.fillStyle = sky[i]; ctx.fillRect(-16, -16 + i * bh, W + 32, bh + 2); }
  const glow = 0.5 + 0.5 * Math.sin(t / 300); ctx.fillStyle = 'rgba(190,80,28,' + (0.10 + 0.07 * glow).toFixed(3) + ')'; ctx.fillRect(-16, wallTop - 70, W + 32, 90);
  for (let i = 0; i < s.smoke.length; i++) { const p = s.smoke[i]; p.x += p.sp; if (p.x - p.r > W + 24) p.x = -p.r - 24; ctx.fillStyle = 'rgba(58,60,68,0.10)'; for (let c = 0; c < 5; c++) { const ox = (c - 2) * p.r * 0.5, oy = Math.sin(p.ph + c + t / 700) * p.r * 0.3, rr = p.r * (0.6 + 0.1 * c); ctx.fillRect(p.x + ox - rr / 2, p.y + oy - rr / 2, rr, rr); } }
  drawSkyline(ctx, wallTop);
  ctx.fillStyle = '#2b2f36'; ctx.fillRect(-16, wallTop, W + 32, wallBot - wallTop);
  ctx.fillStyle = '#262a30'; for (let by = wallTop; by < wallBot; by += 8) ctx.fillRect(-16, by, W + 32, 2);
  ctx.fillStyle = '#20242a'; for (let bx = -16; bx < W + 16; bx += 22) ctx.fillRect(bx, wallTop, 2, wallBot - wallTop);
  const aw = 66, ah = 50, ay = wallBot - ah;
  for (let ax = 24; ax < W - 24; ax += 118) { ctx.fillStyle = '#14171c'; ctx.fillRect(ax, ay, aw, ah); ctx.beginPath(); ctx.arc(ax + aw / 2, ay, aw / 2, Math.PI, 0); ctx.fill(); ctx.fillStyle = 'rgba(150,70,30,' + (0.12 + 0.08 * glow).toFixed(3) + ')'; ctx.fillRect(ax + 6, ay + ah - 16, aw - 12, 14); ctx.strokeStyle = '#3a4049'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax + aw / 2, ay, aw / 2, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#3a4049'; ctx.fillRect(ax + aw / 2 - 3, ay - aw / 2 - 2, 6, 8); }
  const px = 118, ptop = 64, pbot = wallBot, fy = ptop + 6, fh = 36, fw = 66;
  ctx.fillStyle = '#4a3a28'; ctx.fillRect(px, ptop, 4, pbot - ptop); ctx.fillStyle = '#caa24a'; ctx.fillRect(px - 1, ptop - 4, 6, 5);
  for (let sx = 0; sx < fw; sx += 3) { const wav = Math.sin((sx / 10) - (t / 180)) * 4 * (sx / fw), seg = Math.floor(sx / (fw / 3)); ctx.fillStyle = ['#2b4c8c', '#e8e2d6', '#a7303a'][seg]; ctx.fillRect(px + 4 + sx, fy + wav, 3, fh); }
  for (let sx2 = fw - 24; sx2 < fw; sx2 += 3) { const wav2 = Math.sin((sx2 / 10) - (t / 180)) * 4 * (sx2 / fw), burn = (sx2 - (fw - 24)) / 24; for (let yy = 0; yy < fh; yy += 3) if (Math.random() < 0.35 + burn * 0.5) { ctx.fillStyle = ['#ff7a1e', '#ffb43c', '#ffe08a', '#5a2a16'][Math.floor(Math.random() * 4)]; ctx.fillRect(px + 4 + sx2, fy + wav2 + yy, 3, 3); } }
  for (let k = 0; k < 12; k++) { const fx = px + 4 + fw - 6 + Math.random() * 12, fyk = fy + Math.random() * fh; ctx.fillStyle = ['#ff7a1e', '#ffd24c', '#ffe08a'][k % 3]; ctx.fillRect(fx, fyk, 3, 3); }
  for (let sm = 0; sm < 7; sm++) { const syf = fy - sm * 13 - ((t / 16) % 13), sxf = px + fw + 2 + Math.sin((t / 300) + sm) * 10, a = 0.22 * (1 - sm / 7), rz = 5 + sm * 3; ctx.fillStyle = 'rgba(72,72,80,' + a.toFixed(3) + ')'; ctx.fillRect(sxf - rz / 2, syf - rz / 2, rz, rz); }
  ctx.fillStyle = '#2a2420'; ctx.fillRect(-16, wallBot, W + 32, Hc - wallBot + 16);
  ctx.fillStyle = '#241e1a'; for (let cy = wallBot + 6; cy < Hc + 12; cy += 14) for (let cx = ((Math.floor(cy / 14) & 1) ? 0 : 7) - 16; cx < W + 16; cx += 14) ctx.fillRect(cx, cy, 10, 8);
  for (let ri = 0; ri < s.rioters.length; ri++) { const r = s.rioters[ri]; r.x += r.sp; if (r.x < -8) r.x = W + 8; if (r.x > W + 8) r.x = -8; const bob = Math.sin(t / 110 + r.ph) * 1.6, y = r.y + bob; ctx.fillStyle = '#15110d'; ctx.fillRect(r.x, y, 3, 6); ctx.fillStyle = '#2a2018'; ctx.fillRect(r.x, y - 3, 3, 3); if (r.arm) { const hx = r.x + (r.sp > 0 ? 3 : -1); ctx.fillStyle = '#6b4f34'; ctx.fillRect(hx, y - 6, 1, 6); ctx.fillStyle = '#ff9a3c'; ctx.fillRect(hx, y - 8, 1, 2); } }
}
