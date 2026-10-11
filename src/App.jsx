import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import './App.css';
import { useGame } from './hooks/useGame';
import {
  NOBLE_BY_ID, ACTION_BY_ID, COLOR_HEX, COLORS,
  nobleImg, actionImg,
} from './data/cards';
import { computeScore } from './utils/scoring';
import { judgeBlocks, callousActive } from './utils/effects';
import { SliceFlier, BloodSplatter, SlicedThumb, ScoreDelta, DayBanner } from './Effects';
import { playBehead, playWhoosh, isMuted, toggleMuted } from './sound';

// ─── Themes: color palettes + font sets (chosen in the Theme sheet) ─────────
const PALETTES = {
  'parisian-noir': { name: 'Parisian Noir', swatch: ['#171210', '#7e1d26', '#c8a24a', '#efe3cd'], vars: {
    '--bg': '#171210', '--panel': '#241a14', '--panel-light': '#3b2d22', '--ink': '#f1e7d4', '--muted': '#b7a586',
    '--accent': '#7e1d26', '--accent-bright': '#b4323d', '--gold': '#c8a24a', '--cream': '#efe3cd' } },
  'french-quarter': { name: 'French Quarter', swatch: ['#241d16', '#8a4a3c', '#d6a23c', '#c7c3b6'], vars: {
    '--bg': '#241d16', '--panel': '#352a20', '--panel-light': '#4a3b2c', '--ink': '#efe6d4', '--muted': '#bcae92',
    '--accent': '#8a4a3c', '--accent-bright': '#a85a48', '--gold': '#d6a23c', '--cream': '#c7c3b6' } },
  'belle-epoque': { name: 'Belle Époque', swatch: ['#13202b', '#d48d91', '#e6c08a', '#9fb0bf'], vars: {
    '--bg': '#13202b', '--panel': '#1c2f40', '--panel-light': '#2b4559', '--ink': '#f2e5d4', '--muted': '#9fb0bf',
    '--accent': '#b0545a', '--accent-bright': '#d48d91', '--gold': '#e6c08a', '--cream': '#f2ceae' } },
  'bordeaux': { name: 'Bordeaux & Gold', swatch: ['#1a1010', '#6e1423', '#caa64a', '#e8dcc6'], vars: {
    '--bg': '#1a1010', '--panel': '#281619', '--panel-light': '#3c2329', '--ink': '#f0e3d6', '--muted': '#b09a8e',
    '--accent': '#6e1423', '--accent-bright': '#a01e30', '--gold': '#caa64a', '--cream': '#e8dcc6' } },
  'provence': { name: 'Provence (Lavender)', swatch: ['#2a2533', '#8e7bb0', '#d6a23c', '#abb2a6'], vars: {
    '--bg': '#2a2533', '--panel': '#352e40', '--panel-light': '#473c54', '--ink': '#efe6d4', '--muted': '#b3a7bf',
    '--accent': '#6a5a8a', '--accent-bright': '#8e7bb0', '--gold': '#d6a23c', '--cream': '#e9dcc6' } },
  'cote-dazur': { name: "Côte d'Azur", swatch: ['#0f2a3a', '#2e9cb0', '#e8c35a', '#f2ead6'], vars: {
    '--bg': '#0f2a3a', '--panel': '#163a4c', '--panel-light': '#215067', '--ink': '#f0ead8', '--muted': '#9fc0d0',
    '--accent': '#1f7a8c', '--accent-bright': '#2e9cb0', '--gold': '#e8c35a', '--cream': '#f2ead6' } },
  'provincial': { name: 'French Provincial', light: true, swatch: ['#4e5760', '#abb2a6', '#e0d3c4', '#eee9e2'], vars: {
    '--bg': '#e9e3d7', '--panel': '#dcd2c1', '--panel-light': '#cabda4', '--ink': '#3a362f', '--muted': '#6e6557',
    '--accent': '#4e5760', '--accent-bright': '#63707b', '--gold': '#b5a492', '--cream': '#eee9e2' } },
  'farmhouse': { name: 'French Farmhouse', light: true, swatch: ['#efe7d8', '#b06a4a', '#8fa58c', '#7fa0bd'], vars: {
    '--bg': '#efe7d8', '--panel': '#e2d6c1', '--panel-light': '#d0c0a2', '--ink': '#3b342a', '--muted': '#7a6e5b',
    '--accent': '#b06a4a', '--accent-bright': '#c47a55', '--gold': '#d8a23c', '--cream': '#f4ecdd' } },
};
// Headings & body are chosen independently so you can dial in the exact look.
const HEAD_FONTS = {
  fraunces:  { name: 'Fraunces',    css: "'Fraunces', Georgia, serif" },
  playfair:  { name: 'Playfair',    css: "'Playfair Display', Georgia, serif" },
  bodoni:    { name: 'Bodoni',      css: "'Bodoni Moda', Georgia, serif" },
  cormorant: { name: 'Cormorant',   css: "'Cormorant Garamond', Georgia, serif" },
  marcellus: { name: 'Marcellus',   css: "'Marcellus', Georgia, serif" },
  cinzel:    { name: 'Cinzel',      css: "'Cinzel', Georgia, serif" },
  abril:     { name: 'Abril',       css: "'Abril Fatface', Georgia, serif" },
  yeseva:    { name: 'Yeseva',      css: "'Yeseva One', Georgia, serif" },
  rye:       { name: 'Rye',         css: "'Rye', serif" },
};
const BODY_FONTS = {
  shantell:  { name: 'Shantell (handmade)', css: "'Shantell Sans', system-ui, sans-serif" },
  jost:      { name: 'Jost',                css: "'Jost', system-ui, sans-serif" },
  garamond:  { name: 'EB Garamond',         css: "'EB Garamond', Georgia, serif" },
  cormorant: { name: 'Cormorant',           css: "'Cormorant Garamond', Georgia, serif" },
};
const THEME_KEY = 'guillotine-theme';
function loadTheme() {
  try {
    const t = JSON.parse(localStorage.getItem(THEME_KEY));
    if (t && PALETTES[t.palette] && HEAD_FONTS[t.head] && BODY_FONTS[t.body]) return t;
  } catch { /* ignore */ }
  return { palette: 'parisian-noir', head: 'fraunces', body: 'shantell' };
}
function applyTheme({ palette, head, body }) {
  const root = document.documentElement;
  const p = PALETTES[palette]; if (p) Object.entries(p.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  const h = HEAD_FONTS[head]; if (h) { root.style.setProperty('--font-head', h.css); root.style.setProperty('--font-display', h.css); }
  const b = BODY_FONTS[body]; if (b) root.style.setProperty('--font-body', b.css);
}
applyTheme(loadTheme());

export default function App() {
  const game = useGame();
  const { G } = game;
  const [theme, setThemeState] = useState(loadTheme);
  const [showTheme, setShowTheme] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [speed, setSpeed] = useState(() => { try { return Number(localStorage.getItem('guillotine-speed')) || 1; } catch { return 1; } });
  const setTheme = (patch) => {
    const nt = { ...theme, ...patch };
    setThemeState(nt); applyTheme(nt);
    try { localStorage.setItem(THEME_KEY, JSON.stringify(nt)); } catch { /* ignore */ }
  };
  const toggleSpeed = () => {
    const s = speed >= 2 ? 1 : 2;
    setSpeed(s); try { localStorage.setItem('guillotine-speed', String(s)); } catch { /* ignore */ }
  };

  // No handoff screen for now — advance straight into the next turn.
  useEffect(() => {
    if (G.phase === 'pass') {
      const t = setTimeout(() => game.advanceFromPass(), 0);
      return () => clearTimeout(t);
    }
  }, [G.phase, G.current, G.day]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drive computer players in two beats: play a card, then (after a pause) behead.
  useEffect(() => {
    if (G.phase !== 'playing' || !G.cpu?.[G.current]) return;
    const t = setTimeout(() => { if (G.actionPlayed) game.collectAndEnd(); else game.cpuPlay(); }, Math.round(900 / speed));
    return () => clearTimeout(t);
  }, [G.phase, G.current, G.day, G.actionPlayed, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'bugs')
    return <div className="app"><BugViewer /></div>;

  return (
    <div className="app">
      <header className="topbar">
        <img className="topbar-logo" src="/logo.jpg" alt="Guillotine" />
        <span className="tagline">win by getting a head</span>
        <button className="nav-btn" onClick={() => setShowHelp(true)} title="How to play">?</button>
        <button className="nav-btn" onClick={toggleSpeed} title="CPU speed">{speed}×</button>
        <button className="nav-btn theme-btn" onClick={() => setShowTheme(true)} title="Theme &amp; fonts">🎨</button>
        <MusicPlayer />
      </header>
      {showTheme && <ThemeSheet theme={theme} setTheme={setTheme} close={() => setShowTheme(false)} />}
      {showHelp && <HelpSheet close={() => setShowHelp(false)} />}
      {G.phase === 'start' && <StartScreen onStart={game.start} />}
      {G.phase === 'gameOver' && <GameOver G={G} onRestart={game.restart} />}
      {(G.phase === 'playing' || G.phase === 'targeting' || G.phase === 'pass') && <Board game={game} />}
      <BugReport game={game} />
    </div>
  );
}

const MODES = {
  solo:    { label: 'Solo — you + 2 CPU',   cpu: [false, true, true],   names: ['You', 'CPU 1', 'CPU 2'] },
  duo:     { label: '2 Players + 1 CPU',    cpu: [false, false, true],  names: ['Player 1', 'Player 2', 'CPU'] },
  hotseat: { label: '3 Players (hotseat)',  cpu: [false, false, false], names: ['Player 1', 'Player 2', 'Player 3'] },
};

function StartScreen({ onStart }) {
  const [mode, setMode] = useState('solo');
  const [names, setNames] = useState(MODES.solo.names);
  const cpu = MODES[mode].cpu;
  const pickMode = (m) => { setMode(m); setNames(MODES[m].names); };
  return (
    <div className="screen center">
      <img className="start-logo" src="/logo.jpg" alt="Guillotine" />
      <p className="muted">The revolutionary card game where you win by getting a head.</p>
      <div className="mode-pick">
        {Object.entries(MODES).map(([k, m]) => (
          <button key={k} className={'mode-btn' + (mode === k ? ' on' : '')} onClick={() => pickMode(k)}>{m.label}</button>
        ))}
      </div>
      <div className="name-inputs">
        {names.map((n, i) => (
          <label key={i} className="name-row">
            <input value={n} disabled={cpu[i]}
              onChange={e => setNames(names.map((v, j) => j === i ? e.target.value : v))} />
            {cpu[i] && <span className="cpu-tag">CPU</span>}
          </label>
        ))}
      </div>
      <button className="btn primary" onClick={() => onStart(names, cpu)}>Start Game</button>
    </div>
  );
}

function GameOver({ G, onRestart }) {
  const awards = accolades(G.players);
  const rows = G.players.map((p, i) => ({ name: p.name, total: computeScore(p).total, idx: i }))
    .sort((a, b) => b.total - a.total);
  const max = rows[0].total;
  const winners = rows.filter(r => r.total === max).map(r => r.name);
  return (
    <div className="screen center gameover">
      <div className="go-fleurs"><Fleur className="fleur" /><Fleur className="fleur" /><Fleur className="fleur" /></div>
      <h2>Fin de la Révolution</h2>
      <h3 className="go-winner">
        {winners.length > 1 ? `Tie — ${winners.join(' & ')}!` : `${winners[0]} wins!`}
      </h3>
      <div className="go-rows">
        {rows.map((r, place) => (
          <div key={r.name} className={'go-row' + (r.total === max ? ' win' : '')}>
            <span className="go-place">{place === 0 ? '👑' : `${place + 1}.`}</span>
            <span className="go-name">{r.name}</span>
            <span className="go-score"><HeadScore value={r.total} /></span>
            <span className="go-awards">
              {awards[r.idx].map(a => <span key={a.title} className="award" title={a.desc}>{a.title}</span>)}
            </span>
          </div>
        ))}
      </div>
      <p className="go-cry">Vive la Révolution !</p>
      <button className="btn primary" onClick={onRestart}>Encore ! (Play Again)</button>
    </div>
  );
}

const nobleInspect = (def, el) => ({ img: nobleImg(def.id), name: def.name, sub: `${COLORS[def.color]} · ${FACTION[def.color].title}`, text: def.text, color: COLOR_HEX[def.color], rect: el?.getBoundingClientRect() });
const actionInspect = (def, el) => ({ img: actionImg(def.id), name: def.name, sub: 'Action card', text: def.text, color: '#b4323d', rect: el?.getBoundingClientRect() });

// Faction = noble color. Each has a title and an emblem shown in the point box.
const FACTION = {
  blue:   { title: 'Clergy',       sym: '✝' },
  green:  { title: 'Judiciary',    sym: '⚖' },
  gray:   { title: 'Common folk',  sym: '⚒' },
  red:    { title: 'Military',     sym: '⚔' },
  purple: { title: 'Royalty',      sym: '♛' },
};

const _clamp = x => Math.max(0, Math.min(255, Math.round(x)));
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = _clamp(((n >> 16) & 255) + amt), g = _clamp(((n >> 8) & 255) + amt), b = _clamp((n & 255) + amt);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function HeadIcon({ color = 'currentColor', className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill={color} d="M12 2.6a5 5 0 0 1 5 5c0 2-1.1 3.7-2.8 4.6l.5 2.1c3.1.6 5.3 2.3 5.3 4.6V21H4v-2.1c0-2.3 2.2-4 5.3-4.6l.5-2.1A5 5 0 0 1 7 7.6a5 5 0 0 1 5-5z" />
    </svg>
  );
}

// A faction's collected heads shown in a tribe-colored basket with its emblem.
function BasketPip({ color, count, title, sym }) {
  const id = 'bg-' + color.replace('#', '');
  return (
    <span className="bpip" title={`${title}: ${count} head${count === 1 ? '' : 's'}`}>
      <svg className="bpip-svg" viewBox="0 0 30 28" aria-hidden="true">
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 48)} /><stop offset="1" stopColor={shade(color, -46)} />
        </linearGradient></defs>
        <path d="M5 10h20l-2.2 13.5a2.2 2.2 0 0 1-2.2 1.9H9.4a2.2 2.2 0 0 1-2.2-1.9z" fill={`url(#${id})`} stroke="rgba(0,0,0,.42)" strokeWidth="0.8" />
        <ellipse cx="15" cy="10" rx="11" ry="2.6" fill={shade(color, 48)} stroke="rgba(0,0,0,.35)" strokeWidth="0.8" />
        <path d="M7 15H23M8 19.5H22" stroke="rgba(0,0,0,.16)" strokeWidth="1" />
      </svg>
      <span className="bpip-sym">{sym}</span>
      <span className="bpip-ct">{count}</span>
    </span>
  );
}

function Fleur({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 30" aria-hidden="true">
      <path fill="currentColor" d="M12 1c-1.3 2.4-1.3 4.6 0 6.6 1.3-2 1.3-4.2 0-6.6z
        M11.3 8.4C8 5.9 4.6 7 4.2 10.3c-.3 2.6 1.7 4.4 4.6 4.3-1.9.9-2.9 2.4-2.3 4h2.1c-.2-.9.3-1.7 1.2-2v4.1H7.6v1.8h2.2v3.2C8.4 29 7.2 28.4 6.4 27c.6 2.1 2.6 3.2 5.6 3.2s5-1.1 5.6-3.2c-.8 1.4-2 2-3.4 1.7v-3.2h2.2v-1.8h-2.2v-4.1c.9.3 1.4 1.1 1.2 2h2.1c.6-1.6-.4-3.1-2.3-4 2.9.1 4.9-1.7 4.6-4.3C19.4 7 16 5.9 12.7 8.4c.5-.9.5-2 0-2.9-.5.9-.5 2 0 2.9-.4-.3-.9-.3-1.4 0z"/>
    </svg>
  );
}

// Fun French end-game awards derived from each player's collected heads.
function accolades(players) {
  const stat = players.map(p => {
    const nobles = p.scorePile.map(i => NOBLE_BY_ID[i.defId]);
    const byColor = {};
    nobles.forEach(n => { byColor[n.color] = (byColor[n.color] || 0) + 1; });
    return { total: p.scorePile.length, byColor };
  });
  const winnerBy = (fn) => {
    let bi = -1, bv = 0;
    stat.forEach((s, i) => { const v = fn(s); if (v > bv) { bv = v; bi = i; } });
    return bi;
  };
  const DEFS = [
    { title: '👑 La Tête Royale', desc: 'most royals beheaded', idx: winnerBy(s => s.byColor.purple || 0) },
    { title: '⚔ Le Général',     desc: 'most military',        idx: winnerBy(s => s.byColor.red || 0) },
    { title: '✝ Le Dévot',       desc: 'most clergy',          idx: winnerBy(s => s.byColor.blue || 0) },
    { title: '⚖ La Justice',     desc: 'most judiciary',       idx: winnerBy(s => s.byColor.green || 0) },
    { title: '⚒ Ami du Peuple',  desc: 'most common folk',     idx: winnerBy(s => s.byColor.gray || 0) },
    { title: '🧺 Le Boucher',    desc: 'most heads overall',   idx: winnerBy(s => s.total) },
  ];
  const per = players.map(() => []);
  DEFS.forEach(d => { if (d.idx >= 0) per[d.idx].push(d); });
  return per;
}

// Total points shown inside a black severed-head silhouette.
function HeadScore({ value }) {
  return (
    <span className="headscore" title={`${value} points`}>
      <svg className="hs-svg" viewBox="0 0 30 32" aria-hidden="true">
        <path fill="#141210" stroke="rgba(0,0,0,.5)" strokeWidth="0.5"
          d="M15 3.4a6 6 0 0 1 6 6c0 2.4-1.3 4.5-3.3 5.6l.6 2.5c3.8.7 6.5 2.8 6.5 5.6V27.4H5.2v-4.3c0-2.8 2.7-4.9 6.5-5.6l.6-2.5A6 6 0 0 1 9 9.4a6 6 0 0 1 6-6z" />
      </svg>
      <span className="hs-num">{value}</span>
    </span>
  );
}

function Board({ game }) {
  const { G } = game;
  const targeting = G.phase === 'targeting';
  const step = game.step();
  const [inspect, setInspect] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [fliers, setFliers] = useState([]);
  const [splats, setSplats] = useState([]);
  const [callout, setCallout] = useState(null);
  const seen = useRef(0);
  const lineRects = useRef({});

  // Diff new log entries → slice + blood for beheadings, callout for plays.
  useLayoutEffect(() => {
    const fresh = G.log.filter(l => l.id > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(seen.current, ...fresh.map(l => l.id));
    const nf = [], ns = [];
    let lastPlay = null;
    for (const e of fresh) {
      if (e.kind === 'play' && e.defId) {
        const def = ACTION_BY_ID[e.defId];
        lastPlay = { key: e.id, who: G.players[e.playerIdx]?.name, name: def.name, text: def.text };
        playWhoosh();
        continue;
      }
      if (e.kind !== 'collect') continue;
      playBehead();
      const from = lineRects.current[String(e.uid)];
      const pile = document.querySelector(`[data-pile="${e.playerIdx}"]`);
      if (!from || !pile) continue;
      const p = pile.getBoundingClientRect();
      const fromPt = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
      nf.push({ key: e.id, uid: e.uid, defId: e.defId, from: fromPt, to: { x: p.left + p.width / 2, y: p.top + p.height / 2 } });
      ns.push({ key: e.id, x: fromPt.x + (Math.random() * 120 - 60), y: fromPt.y + (Math.random() * 90 - 30), scale: 0.85 + Math.random() * 0.7 });
    }
    if (nf.length) setFliers(f => [...f, ...nf]);
    if (ns.length) setSplats(s => [...s, ...ns]);
    if (lastPlay) setCallout(lastPlay);
  });

  // auto-clear the callout
  useEffect(() => {
    if (!callout) return;
    const t = setTimeout(() => setCallout(null), 1900);
    return () => clearTimeout(t);
  }, [callout]);

  // Capture current line-token positions every render (for the fly-from point).
  useLayoutEffect(() => {
    const map = {};
    document.querySelectorAll('.noble-card[data-line-uid]').forEach(el => {
      map[el.getAttribute('data-line-uid')] = el.getBoundingClientRect();
    });
    lineRects.current = map;
  });

  const locks = [];
  if (judgeBlocks(G)) locks.push('⚖ Unpopular Judge — no actions this turn');
  else {
    if (G.actionBlocked) locks.push('💨 Rushed — no action, just collect');
    if (callousActive(G)) locks.push('🛡 Callous Guards — line cards locked');
  }

  const pileStep = step && step.type === 'pileNoble' ? step.playerIdx : null;
  const showPile = expanded != null ? expanded : pileStep;

  return (
    <div className="board2">
      <main className="field">
        <div className="field-msg">
          <span className="message">{G.message}</span>
          <span className="deck-counts">Nobles {G.nobleDeck.length} · Actions {G.actionDeck.length}</span>
        </div>
        {locks.length > 0 && <div className="locks">{locks.map((l, i) => <span key={i} className="lock-chip">{l}</span>)}</div>}

        <GuillotineLine G={G} step={step} onPick={game.pick} onInspect={setInspect} />

        <div className="controls">
          {!targeting && (
            <button className={'btn primary' + (!G.cpu?.[G.current] && G.line.length > 0 ? ' pulse' : '')}
              onClick={game.collectAndEnd}>
              {G.line.length === 0 ? 'End turn →' : 'Off with their head!'}
            </button>
          )}
          {targeting && <button className="btn" onClick={game.cancelTarget}>Cancel</button>}
        </div>

        <HandDock game={game} onInspect={setInspect} />
      </main>

      <aside className="hud2">
        <div className="hud-top">
          <span className="day-chip">Day {G.day} / 3</span>
          <span className="hud-nav">
            <button className="nav-btn" onClick={game.restart} title="New game">⟳</button>
            <SoundToggle />
          </span>
        </div>
        {G.players.map((p, i) => (
          <PlayerCard key={i} player={p} index={i} game={game} step={step}
            onInspect={setInspect} onExpand={setExpanded} />
        ))}
        <LogPanel log={G.log} />
      </aside>

      <HoverCard inspect={inspect} />

      {showPile != null && (
        <NoblePileModal G={G} index={showPile} game={game} step={step} onInspect={setInspect}
          forced={pileStep === showPile}
          close={() => { if (pileStep === showPile) game.cancelTarget(); setExpanded(null); }} />
      )}

      {step?.type === 'handCard' && (
        <PickModal title={G.message} cancel={game.cancelTarget}
          cards={G.players[step.playerIdx].hand.map((inst, hi) => {
            const def = ACTION_BY_ID[inst.defId];
            return { key: inst.uid, img: actionImg(def.id), name: def.name, onClick: () => game.pick({ idx: hi }) };
          })} />
      )}
      {step?.type === 'noblePick' && (
        <PickModal title={G.message} cancel={game.cancelTarget}
          cards={step.options.map(o => ({ key: o.uid, img: nobleImg(NOBLE_BY_ID[o.defId].id),
            name: NOBLE_BY_ID[o.defId].name, color: NOBLE_BY_ID[o.defId].color, onClick: () => game.pick({ uid: o.uid }) }))} />
      )}
      {step?.type === 'actionDiscardPick' && (
        <PickModal title={G.message} cancel={game.cancelTarget}
          cards={step.candidates.map(idx => {
            const inst = G.actionDiscard[idx]; const def = ACTION_BY_ID[inst.defId];
            return { key: inst.uid, img: actionImg(def.id), name: def.name, onClick: () => game.pick({ idx }) };
          })} />
      )}

      <div className="fx-layer">
        {splats.map(s => <BloodSplatter key={s.key} splat={s} onDone={() => setSplats(x => x.filter(y => y.key !== s.key))} />)}
        {fliers.map(f => <SliceFlier key={f.key} flier={f} onDone={() => setFliers(x => x.filter(y => y.key !== f.key))} />)}
      </div>
      {callout && <Callout callout={callout} />}
      <DayBanner day={G.day} />
    </div>
  );
}

// ─── Corner HUD player card ─────────────────────────────────────────────────
function PlayerCard({ player, index, game, step, onInspect, onExpand }) {
  const { G } = game;
  const isCurrent = index === G.current && (G.phase === 'playing' || G.phase === 'targeting');
  const { total } = computeScore(player);
  const playerTarget = step && step.type === 'player' && step.candidates.includes(index);
  const frontTarget = step && step.type === 'frontCard';

  const tally = {};
  player.scorePile.forEach(inst => { const c = NOBLE_BY_ID[inst.defId].color; tally[c] = (tally[c] || 0) + 1; });
  const colors = Object.keys(tally);

  return (
    <div className={'pcard' + (isCurrent ? ' active' : '') + (playerTarget ? ' selectable' : '')}
      data-pile={index}
      onClick={() => (playerTarget ? game.pick({ playerIdx: index }) : onExpand(index))}>
      <div className="pc-head">
        <span className="pc-name">{player.name}{G.cpu?.[index] ? ' 🤖' : ''}{isCurrent ? ' ◄' : ''}</span>
        <span className="pc-score"><ScoreDelta value={total} /><HeadScore value={total} /></span>
      </div>
      <div className="pc-stats">
        <span title="cards in hand">🖐 {player.hand.length}</span>
        <span className="pc-heads-ct" title="heads collected">
          <HeadIcon color="var(--muted)" className="hc-small" /> {player.scorePile.length}
        </span>
        <span className="pc-tally">
          {colors.length === 0 ? <span className="muted small">no heads</span>
            : colors.map(c => <BasketPip key={c} color={COLOR_HEX[c]} count={tally[c]} title={FACTION[c].title} sym={FACTION[c].sym} />)}
        </span>
      </div>
      {isCurrent && <TurnSteps G={G} />}
      {player.frontCards.length > 0 && (
        <div className="pc-fronts">
          {player.frontCards.map(inst => {
            const def = ACTION_BY_ID[inst.defId];
            const clickable = frontTarget && step.candidates.some(c => c.cardUid === inst.uid);
            const canDiscard = isCurrent && G.phase === 'playing' && def.params?.kind === 'callousGuards';
            return (
              <span key={inst.uid} className="front-wrap">
                <img className={'pc-front' + (clickable ? ' clickable' : '')} src={actionImg(def.id)} alt={def.name}
                  title={`${def.name}\n${def.text}`}
                  onMouseEnter={(e) => onInspect(actionInspect(def, e.currentTarget))} onMouseLeave={() => onInspect(null)}
                  onClick={clickable ? (e) => { e.stopPropagation(); game.pick({ playerIdx: index, cardUid: inst.uid }); } : undefined} />
                {canDiscard && <button className="discard-x" onClick={(e) => { e.stopPropagation(); game.discardFront(inst.uid); }} title="Discard">✕</button>}
              </span>
            );
          })}
        </div>
      )}
      <div className="pc-expand">view heads ▾</div>
    </div>
  );
}

function Callout({ callout }) {
  return (
    <div className="callout" key={callout.key}>
      <div className="co-who">{callout.who} played</div>
      <div className="co-name">{callout.name}</div>
      <div className="co-text">{callout.text}</div>
    </div>
  );
}

function TurnSteps({ G }) {
  const cur = G.phase === 'targeting' ? 0 : (G.actionPlayed ? 1 : 0);
  return (
    <div className="turn-steps">
      {['Action', 'Collect', 'Draw'].map((s, i) => (
        <span key={s} className={'tstep' + (i === cur ? ' on' : '') + (i < cur ? ' done' : '')}>{s}</span>
      ))}
    </div>
  );
}

// ─── The line of nobles + the (top-down) guillotine ─────────────────────────
function GuillotineLine({ G, step, onPick, onInspect }) {
  const scrollRef = useRef(null);
  const cardEls = useRef(new Map());
  const prevOffsets = useRef(new Map());
  const reorder = step && step.type === 'reorder';
  const lineTarget = step && (step.type === 'lineNoble' || step.type === 'reorder');
  const order = reorder ? G.pending.order : [];
  const display = G.line.map((inst, idx) => ({ inst, idx })).reverse();

  useLayoutEffect(() => {
    const next = new Map();
    cardEls.current.forEach((el, uid) => { if (el) next.set(uid, { l: el.offsetLeft, t: el.offsetTop }); });
    next.forEach((pos, uid) => {
      const prev = prevOffsets.current.get(uid);
      const el = cardEls.current.get(uid);
      if (!prev || !el) return;
      const dx = prev.l - pos.l, dy = prev.t - pos.t;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }],
        { duration: 340, easing: 'cubic-bezier(.45,0,.35,1)' });
    });
    prevOffsets.current = next;
  }, [G.line]);

  useEffect(() => {
    if (G.phase === 'targeting') return;
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [G.line.length, G.phase]);

  return (
    <div className="line-area">
      <div className="line-scroll" ref={scrollRef}>
        {display.length === 0 && <div className="line-empty">The line is empty.</div>}
        {display.map(({ inst, idx }) => {
          const def = NOBLE_BY_ID[inst.defId];
          const isCand = lineTarget && step.candidates.includes(idx);
          const ordPos = order.indexOf(idx);
          return (
            <button key={inst.uid}
              ref={el => { if (el) cardEls.current.set(inst.uid, el); else cardEls.current.delete(inst.uid); }}
              data-line-uid={inst.uid}
              className={'noble-card token' + (idx === 0 ? ' front' : '') + (isCand && ordPos < 0 ? ' candidate' : '')}
              style={{ borderColor: COLOR_HEX[def.color] }}
              onClick={() => isCand && ordPos < 0 && onPick({ idx })}
              onMouseEnter={(e) => onInspect(nobleInspect(def, e.currentTarget))}
              onMouseLeave={() => onInspect(null)}
              title={`${def.name} — ${COLORS[def.color]}`}>
              <img src={nobleImg(def.id)} alt={def.name} />
              {idx === 0 && ordPos < 0 && <span className="front-tag">NEXT</span>}
              {ordPos >= 0 && <span className="order-tag">{ordPos + 1}</span>}
            </button>
          );
        })}
      </div>
      <Guillotine />
    </div>
  );
}

// A detailed guillotine on a stepped platform, facing the line (stairs on the left).
function Guillotine() {
  return (
    <div className="guillo-wrap" title="The guillotine — the next head drops here">
      <svg className="guillo" viewBox="0 0 132 158" aria-label="guillotine">
        {/* stairs leading up from the line (left) */}
        <rect x="2" y="140" width="18" height="7" fill="#5a4330" stroke="#3f2f22" strokeWidth="0.8" />
        <rect x="8" y="133" width="18" height="7" fill="#654b36" stroke="#3f2f22" strokeWidth="0.8" />
        <rect x="14" y="126" width="18" height="7" fill="#6f543c" stroke="#3f2f22" strokeWidth="0.8" />
        {/* platform (scaffold) */}
        <polygon points="30,118 122,118 130,128 22,128" fill="#79593c" stroke="#3f2f22" strokeWidth="1" />
        <rect x="22" y="128" width="108" height="14" fill="#5a4330" stroke="#3f2f22" strokeWidth="1" />
        <line x1="46" y1="128" x2="46" y2="142" stroke="#43321f" strokeWidth="1" />
        <line x1="78" y1="128" x2="78" y2="142" stroke="#43321f" strokeWidth="1" />
        <line x1="110" y1="128" x2="110" y2="142" stroke="#43321f" strokeWidth="1" />
        {/* uprights */}
        <rect x="50" y="12" width="11" height="108" rx="1" fill="#44321f" stroke="#2c2015" strokeWidth="1" />
        <rect x="88" y="12" width="11" height="108" rx="1" fill="#44321f" stroke="#2c2015" strokeWidth="1" />
        {/* top crossbeam */}
        <rect x="44" y="6" width="61" height="13" rx="2" fill="#4f3a26" stroke="#2c2015" strokeWidth="1" />
        {/* rope */}
        <line x1="74" y1="19" x2="74" y2="30" stroke="#caa66a" strokeWidth="1.6" />
        {/* mouton + angled blade */}
        <rect x="56" y="30" width="38" height="15" fill="#8d9398" stroke="#5c6165" strokeWidth="1" />
        <polygon points="56,45 94,45 94,61 56,47" fill="#d7dbde" stroke="#a9aeb1" strokeWidth="1" />
        <polygon points="56,45 94,45 90,49 56,47" fill="#eef1f3" opacity=".7" />
        {/* lunette — the neck hole */}
        <circle cx="74.5" cy="96" r="12" fill="#17110c" />
        <path d="M63 96a11.5 11.5 0 0 1 23 0" fill="none" stroke="#c6a765" strokeWidth="3" />
        <path d="M63 96a11.5 11.5 0 0 0 23 0" fill="none" stroke="#8f7236" strokeWidth="3" />
        {/* basket for the heads */}
        <path d="M58 112h33l-3.5 12a2 2 0 0 1-2 1.5H63.5a2 2 0 0 1-2-1.5z" fill="#8a6a3f" stroke="#5a4330" strokeWidth="1" />
        <path d="M60 117h29M61 121h27" stroke="rgba(0,0,0,.2)" strokeWidth="0.8" />
      </svg>
      <span className="guillo-label">GUILLOTINE</span>
    </div>
  );
}

// ─── The logged-in player's action-card hand ────────────────────────────────
function HandDock({ game, onInspect }) {
  const { G } = game;
  if (G.cpu?.[G.current]) return <div className="hand-dock cpu">🤖 {G.players[G.current].name} is thinking…</div>;
  const hand = G.players[G.current].hand;
  const n = hand.length;
  return (
    <div className="hand-dock">
      {hand.map((inst, hi) => {
        const def = ACTION_BY_ID[inst.defId];
        const playable = game.canPlay(hi);
        return (
          <button key={inst.uid} className={'dock-card' + (playable ? ' playable' : '')}
            style={{ '--i': hi - (n - 1) / 2 }}
            onClick={() => playable && game.playCard(hi)}
            onMouseEnter={(e) => onInspect(actionInspect(def, e.currentTarget))} onMouseLeave={() => onInspect(null)}
            title={`${def.name}\n${def.text}`}>
            <img src={actionImg(def.id)} alt={def.name} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Expandable view of a player's collected heads ──────────────────────────
function NoblePileModal({ G, index, game, step, onInspect, forced, close }) {
  const player = G.players[index];
  const { total, lines } = computeScore(player);
  const pileTarget = step && step.type === 'pileNoble' && step.playerIdx === index;
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal pile-modal" onClick={e => e.stopPropagation()}>
        <p className="modal-title">{player.name}'s heads — {total} pts{pileTarget ? ' · choose one to take' : ''}</p>
        <div className="pile-grid">
          {player.scorePile.length === 0 && <span className="muted">No heads yet.</span>}
          {player.scorePile.map((inst, pi) => {
            const def = NOBLE_BY_ID[inst.defId];
            const clickable = pileTarget && step.candidates.includes(pi);
            return <SlicedThumb key={inst.uid} defId={inst.defId} uid={inst.uid}
              className={'pile-card' + (clickable ? ' clickable' : '')}
              title={`${def.name} (${COLORS[def.color]})`}
              onMouseEnter={(e) => onInspect(nobleInspect(def, e.currentTarget))} onMouseLeave={() => onInspect(null)}
              onClick={clickable ? () => { game.pick({ idx: pi }); close(); } : undefined} />;
          })}
        </div>
        {lines.length > 0 && (
          <div className="pile-breakdown">
            {lines.map((l, i) => <div key={i} className="bd-row"><span>{l.label}</span><span>{l.value > 0 ? `+${l.value}` : l.value}</span></div>)}
          </div>
        )}
        <button className="btn" onClick={close}>{forced ? 'Cancel' : 'Close'}</button>
      </div>
    </div>
  );
}

// A big preview in one consistent spot (screen center) so the eye always knows
// where to look — never jumping around the hovered card.
function HoverCard({ inspect }) {
  if (!inspect) return null;
  const { img, name, sub, text, color } = inspect;
  return (
    <div className="hovercard center">
      <img className="hc-img" src={img} alt={name} style={{ borderColor: color }} />
      <div className="hc-name">{name}</div>
      <div className="hc-sub" style={{ color }}>{sub}</div>
      {text && <div className="hc-text">{text}</div>}
    </div>
  );
}

const TRACKS = [
  { src: '/music/01-french-jazz.mp3', name: 'French Jazz' },
  { src: '/music/02-paris.mp3', name: 'Paris' },
  { src: '/music/03-france-paris.mp3', name: 'France · Paris' },
  { src: '/music/04-french-france.mp3', name: 'Rue de Paris' },
  { src: '/music/05-montmartre.mp3', name: 'Montmartre' },
  { src: '/music/06-cafe-de-paris.mp3', name: 'Café de Paris' },
];

function MusicPlayer() {
  const audioRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(() => {
    try { return parseFloat(localStorage.getItem('guillotine-music-vol') ?? '0.4'); } catch { return 0.4; }
  });
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol;
    try { localStorage.setItem('guillotine-music-vol', String(vol)); } catch { /* ignore */ }
  }, [vol]);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.src = TRACKS[idx].src; a.volume = vol;
    if (playing) a.play().catch(() => {});
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auto-start on the first user gesture (browsers block autoplay before that).
  useEffect(() => {
    const start = () => {
      const a = audioRef.current;
      if (a && a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    };
    window.addEventListener('pointerdown', start, { once: true });
    return () => window.removeEventListener('pointerdown', start);
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };
  const next = () => setIdx(i => (i + 1) % TRACKS.length);
  return (
    <div className="music-player">
      <audio ref={audioRef} onEnded={next} />
      <button className="mp-btn" onClick={toggle} title={playing ? 'Pause' : 'Play'}>{playing ? '⏸' : '▶'}</button>
      <button className="mp-btn" onClick={next} title="Next track">⏭</button>
      <span className="mp-name">♪ {TRACKS[idx].name}</span>
      <input className="mp-vol" type="range" min="0" max="1" step="0.05" value={vol}
        onChange={e => setVol(parseFloat(e.target.value))} title="Music volume" />
    </div>
  );
}

function SoundToggle() {
  const [muted, setMuted] = useState(isMuted());
  return (
    <button className="sound-toggle nav-btn" title={muted ? 'Unmute SFX' : 'Mute SFX'}
      onClick={() => setMuted(toggleMuted())}>{muted ? '🔇' : '🔊'}</button>
  );
}

function LogPanel({ log }) {
  const recent = log.slice(-10).reverse();
  return (
    <div className="log-panel">
      <div className="log-head">Game Log</div>
      <div className="log-body">
        {recent.length === 0 && <div className="muted small">No moves yet.</div>}
        {recent.map((entry, i) => (
          <div key={entry.id} className={'log-line' + (i === 0 ? ' newest' : '')}>{entry.text}</div>
        ))}
      </div>
    </div>
  );
}

function HelpSheet({ close }) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal help-sheet" onClick={e => e.stopPropagation()}>
        <p className="modal-title">How to play</p>
        <div className="help-body">
          <p><b>Goal.</b> Collect the most valuable heads over <b>3 days</b>. Each noble's points are the number in its basket (lower-right).</p>
          <p><b>Your turn, in order:</b></p>
          <ol>
            <li><b>Play an action card</b> (optional) — rearrange the line, add/remove nobles, or target opponents.</li>
            <li><b>Behead the front noble</b> (the one by the guillotine) into your score pile.</li>
            <li><b>Draw</b> a new action card.</li>
          </ol>
          <p>The day ends when the line is empty; a fresh 12 nobles come out. After day 3, most points wins.</p>
          <p className="help-factions"><b>Factions (noble colours):</b></p>
          <div className="help-legend">
            <span>✝ Clergy</span><span>⚖ Judiciary</span><span>⚒ Common folk</span><span>⚔ Military</span><span>♛ Royalty</span>
          </div>
          <p className="muted small">Watch for combos: Count + Countess, stacking Palace Guards, and negative "good-guy" nobles (Hero, Tragic Figure). Hover any card to see it big.</p>
        </div>
        <button className="btn primary" onClick={close}>Got it</button>
      </div>
    </div>
  );
}

function BugReport({ game }) {
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState('');
  const [where, setWhere] = useState('');
  const [status, setStatus] = useState(null);
  const submit = async () => {
    if (!what.trim()) { setStatus('Please say what went wrong.'); return; }
    const G = game.G;
    const snap = { day: G.day, phase: G.phase, players: G.players.map(p => p.name), log: (G.log || []).map(l => l.text) };
    setStatus('Sending…');
    try {
      const r = await fetch('/api/bugs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bug', what, where, page: location.href, ua: navigator.userAgent, game: snap }),
      });
      const j = await r.json();
      if (r.ok) { setStatus(`Merci! Filed as BUG-${j.no}.`); setWhat(''); setWhere(''); }
      else setStatus(j.error || 'Could not submit.');
    } catch { setStatus('Network error.'); }
  };
  return (
    <>
      <button className="bug-fab" title="Report a bug" onClick={() => { setOpen(true); setStatus(null); }}>🐞</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal bug-modal" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Report a bug</p>
            <textarea className="bug-what" placeholder="What went wrong? What did you expect?"
              value={what} onChange={e => setWhat(e.target.value)} />
            <input className="bug-where" placeholder="Where in the game? (optional)"
              value={where} onChange={e => setWhere(e.target.value)} />
            <div className="muted small">The current day, turn and game log are attached automatically.</div>
            {status && <div className="bug-status">{status}</div>}
            <div className="bug-actions">
              <button className="btn" onClick={() => setOpen(false)}>Close</button>
              <button className="btn primary" onClick={submit}>Send</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BugViewer() {
  const [pin, setPin] = useState('');
  const [bugs, setBugs] = useState(null);
  const [err, setErr] = useState(null);
  const load = async () => {
    try {
      const r = await fetch('/api/bugs', { headers: { 'x-bug-pin': pin } });
      const j = await r.json();
      if (r.ok) { setBugs(j.bugs); setErr(null); } else setErr(j.error);
    } catch { setErr('Network error.'); }
  };
  const act = async (action, no) => {
    await fetch('/api/bugs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bug-pin': pin }, body: JSON.stringify({ action, no }) });
    load();
  };
  if (bugs === null) {
    return (
      <div className="screen center">
        <h2>Bug reports</h2>
        <input className="bug-where" placeholder="PIN" value={pin}
          onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        {err && <div className="bug-status">{err}</div>}
        <button className="btn primary" onClick={load}>View</button>
      </div>
    );
  }
  return (
    <div className="bug-list">
      <h2>Bug reports ({bugs.length})</h2>
      {bugs.length === 0 && <p className="muted">No reports yet.</p>}
      {bugs.map(b => (
        <div key={b.no} className={'bug-item' + (b.status === 'fixed' ? ' fixed' : '')}>
          <div className="bi-head"><b>BUG-{b.no}</b> <span className="muted small">{new Date(b.at).toLocaleString()}</span> <span className="bi-status">{b.status}</span></div>
          <div className="bi-what">{b.what}</div>
          {b.where && <div className="muted small">where: {b.where}</div>}
          {b.game && <div className="muted small">day {b.game.day} · {b.game.phase} · {b.game.players?.join(', ')}</div>}
          {b.game?.log?.length > 0 && <details><summary className="muted small">game log</summary><pre className="bi-log">{b.game.log.join('\n')}</pre></details>}
          <div className="bi-actions">
            {b.status !== 'fixed'
              ? <button className="btn" onClick={() => act('fix', b.no)}>Mark fixed</button>
              : <button className="btn" onClick={() => act('reopen', b.no)}>Reopen</button>}
            <button className="btn" onClick={() => act('remove', b.no)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ThemeSheet({ theme, setTheme, close }) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal theme-sheet" onClick={e => e.stopPropagation()}>
        <p className="modal-title">Theme &amp; Fonts</p>
        <div className="ts-label">Color palette</div>
        <div className="ts-grid">
          {Object.entries(PALETTES).map(([k, p]) => (
            <button key={k} className={'ts-pal' + (theme.palette === k ? ' on' : '')} onClick={() => setTheme({ palette: k })}>
              <span className="ts-sw">{p.swatch.map((c, i) => <i key={i} style={{ background: c }} />)}</span>
              <span className="ts-name">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="ts-label">Headings</div>
        <div className="ts-grid ts-grid-3">
          {Object.entries(HEAD_FONTS).map(([k, f]) => (
            <button key={k} className={'ts-font' + (theme.head === k ? ' on' : '')}
              onClick={() => setTheme({ head: k })} style={{ fontFamily: f.css }}>
              {f.name}
            </button>
          ))}
        </div>
        <div className="ts-label">Body text</div>
        <div className="ts-grid">
          {Object.entries(BODY_FONTS).map(([k, f]) => (
            <button key={k} className={'ts-font' + (theme.body === k ? ' on' : '')}
              onClick={() => setTheme({ body: k })} style={{ fontFamily: f.css }}>
              {f.name}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={close}>Done</button>
      </div>
    </div>
  );
}

function PickModal({ title, cards, cancel }) {
  return (
    <div className="modal-backdrop" onClick={cancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <p className="modal-title">{title}</p>
        <div className="modal-cards">
          {cards.map(c => (
            <button key={c.key} className="modal-card" onClick={c.onClick} title={c.name}
              style={c.color ? { borderColor: COLOR_HEX[c.color] } : undefined}>
              <img src={c.img} alt={c.name} />
            </button>
          ))}
        </div>
        <button className="btn" onClick={cancel}>Cancel</button>
      </div>
    </div>
  );
}
