import { useState, useRef, useEffect, useLayoutEffect, useReducer } from 'react';
import './App.css';
import { useGame } from './hooks/useGame';
import {
  NOBLE_BY_ID, ACTION_BY_ID, COLOR_HEX, COLORS,
  nobleImg, actionImg, NOBLE_BACK, ACTION_BACK,
} from './data/cards';
import { computeScore } from './utils/scoring';
import { judgeBlocks, callousActive, lineNobleCandidates, getStep, canPlayCard } from './utils/effects';
import { HostRoom, JoinClient, cleanCode } from './net/room';
import { SliceFlier, BloodSplatter, SlicedThumb, ScoreDelta, DayBanner, DealFlier, setReduce } from './Effects';
import { playBehead, playWhoosh, playBell, isMuted, toggleMuted } from './sound';

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
  carter:    { name: 'Carter One',  css: "'Carter One', Georgia, serif" },
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
  merriweather: { name: 'Merriweather',     css: "'Merriweather', Georgia, serif" },
  shantell:  { name: 'Shantell (handmade)', css: "'Shantell Sans', system-ui, sans-serif" },
  jost:      { name: 'Jost',                css: "'Jost', system-ui, sans-serif" },
  garamond:  { name: 'EB Garamond',         css: "'EB Garamond', Georgia, serif" },
  cormorant: { name: 'Cormorant',           css: "'Cormorant Garamond', Georgia, serif" },
};
const THEME_KEY = 'guillotine-theme';
function loadTheme() {
  try {
    const t = JSON.parse(localStorage.getItem(THEME_KEY));
    if (t && PALETTES[t.palette] && HEAD_FONTS[t.head] && BODY_FONTS[t.body]) {
      // migrate anyone still on the old default fonts to Carter One / Merriweather
      if (t.head === 'fraunces' && t.body === 'shantell') { t.head = 'carter'; t.body = 'merriweather'; }
      return t;
    }
  } catch { /* ignore */ }
  return { palette: 'parisian-noir', head: 'carter', body: 'merriweather' };
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
  // first-time tutorial: open "How to play" on the very first visit
  useEffect(() => {
    try { if (!localStorage.getItem('guillotine-seen-help')) { setShowHelp(true); localStorage.setItem('guillotine-seen-help', '1'); } } catch { /* ignore */ }
  }, []);
  const [speed, setSpeed] = useState(() => { try { return Number(localStorage.getItem('guillotine-speed')) || 1; } catch { return 1; } });
  const [reduce, setReduceState] = useState(() => {
    try { const v = localStorage.getItem('guillotine-reduce'); return v == null ? false : v === '1'; } catch { return false; }
  });
  useEffect(() => {
    setReduce(reduce);
    if (typeof document !== 'undefined') document.documentElement.dataset.reduce = reduce ? '1' : '';
    try { localStorage.setItem('guillotine-reduce', reduce ? '1' : '0'); } catch { /* ignore */ }
  }, [reduce]);
  const setTheme = (patch) => {
    const nt = { ...theme, ...patch };
    setThemeState(nt); applyTheme(nt);
    try { localStorage.setItem(THEME_KEY, JSON.stringify(nt)); } catch { /* ignore */ }
  };
  const toggleSpeed = () => {
    const s = speed >= 2 ? 1 : 2;
    setSpeed(s); try { localStorage.setItem('guillotine-speed', String(s)); } catch { /* ignore */ }
  };

  // Online: null = local play; else { kind:'home'|'host'|'join', room? }
  const [online, setOnline] = useState(null);
  const exitOnline = () => {
    try { online?.room?.close(); } catch { /* ignore */ }
    try { localStorage.removeItem('guillotine-host-save'); } catch { /* ignore */ }
    setOnline(null);
  };
  // On load: resume a host session after a reload, else honour an ?join invite link.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('guillotine-host-save');
      if (raw) {
        const h = JSON.parse(raw);
        if (h?.G && h.code && Date.now() - (h.at || 0) < 3 * 3600e3 && h.G.phase !== 'gameOver') {
          setOnline({ kind: 'host', room: new HostRoom('', h), resumeG: h.G }); return;
        }
        localStorage.removeItem('guillotine-host-save');
      }
      if (new URLSearchParams(window.location.search).get('join')) setOnline({ kind: 'home' });
    } catch { /* ignore */ }
  }, []);
  // Persist the local game so a refresh can resume it.
  useEffect(() => {
    if (online) return;
    try {
      if (['playing', 'targeting', 'pass'].includes(G.phase)) localStorage.setItem('guillotine-save', JSON.stringify({ G, at: Date.now() }));
      else if (G.phase === 'gameOver') localStorage.removeItem('guillotine-save');  // keep across a fresh 'start' so Resume works
    } catch { /* ignore */ }
  }, [G, online]);
  const loadLocalSave = () => { try { const s = JSON.parse(localStorage.getItem('guillotine-save')); if (s?.G) game.load(s.G); } catch { /* ignore */ } };
  let hasLocalSave = false;
  try { const s = JSON.parse(localStorage.getItem('guillotine-save')); hasLocalSave = !!(s?.G && s.G.phase !== 'gameOver'); } catch { /* ignore */ }

  // Hotseat handoff: auto-advance for solo games / CPU seats, but pause with a
  // "pass the device" screen when it moves between two human players.
  const humanCount = G.cpu.filter((c) => !c).length;
  const needPass = !online && G.phase === 'pass' && humanCount > 1 && !G.cpu?.[G.current];
  useEffect(() => {
    if (G.phase === 'pass' && !needPass) {
      const t = setTimeout(() => game.advanceFromPass(), 0);
      return () => clearTimeout(t);
    }
  }, [G.phase, G.current, G.day, needPass]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drive computer players in two beats: play a card, then (after a pause) behead.
  useEffect(() => {
    if (G.phase !== 'playing' || !G.cpu?.[G.current]) return;
    const t = setTimeout(() => { if (G.actionPlayed) game.collectAndEnd(); else game.cpuPlay(); }, Math.round(1300 / speed));
    return () => clearTimeout(t);
  }, [G.phase, G.current, G.day, G.actionPlayed, speed]); // eslint-disable-line react-hooks/exhaustive-deps


  const view = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null;
  if (view === 'bugs') return <div className="app"><BugViewer /></div>;
  if (view === 'art') return <div className="app"><ArtReview /></div>;
  if (view === 'cardedit') return <div className="app"><CardEdit /></div>;
  if (view === 'stats') return <div className="app"><StatsView /></div>;

  return (
    <div className="app">
      <header className="topbar">
        <img className="topbar-logo" src="/logo-title.png" alt="Guillotine" />
        <span className="tagline">win by getting a head</span>
        <button className="nav-btn" onClick={() => setShowHelp(true)} title="How to play">?</button>
        <button className="nav-btn" onClick={toggleSpeed} title="CPU speed">{speed}×</button>
        <button className="nav-btn theme-btn" onClick={() => setShowTheme(true)} title="Theme &amp; fonts">Aa</button>
        <MusicPlayer />
      </header>
      {showTheme && <ThemeSheet theme={theme} setTheme={setTheme} close={() => setShowTheme(false)} />}
      {showHelp && <HelpSheet close={() => setShowHelp(false)} reduce={reduce} setReduce={setReduceState} />}
      {online ? (
        online.kind === 'home'
          ? <OnlineHome onHost={(room) => setOnline({ kind: 'host', room })} onJoin={(room) => setOnline({ kind: 'join', room })} onBack={() => setOnline(null)} />
          : online.kind === 'host'
            ? <HostShell room={online.room} speed={speed} onExit={exitOnline} resumeG={online.resumeG} />
            : <ClientShell client={online.room} onExit={exitOnline} />
      ) : (
        <>
          {G.phase === 'start' && <StartScreen onStart={game.start} onOnline={() => setOnline({ kind: 'home' })} onResume={hasLocalSave ? loadLocalSave : null} />}
          {G.phase === 'gameOver' && <GameOver G={G} onRestart={game.restart} />}
          {needPass && <PassScreen name={G.players[G.current].name} onReady={game.advanceFromPass} />}
          {(G.phase === 'playing' || G.phase === 'targeting' || (G.phase === 'pass' && !needPass)) && <Board game={game} />}
        </>
      )}
      <BugReport game={game} />
      <RotateHint />
    </div>
  );
}

// Hotseat handoff — hides the board so the next player doesn't see the last hand.
function PassScreen({ name, onReady }) {
  return (
    <div className="screen center pass-screen">
      <p className="muted">Pass the device to</p>
      <div className="pass-name">{name}</div>
      <button className="btn primary start-btn" onClick={onReady}>I&rsquo;m {name} — Ready</button>
    </div>
  );
}

// Portrait phones get a nudge to turn sideways — the board is landscape by
// nature — but it's dismissible, so portrait is still playable.
function RotateHint() {
  const [ok, setOk] = useState(() => { try { return sessionStorage.getItem('guillotine-portrait-ok') === '1'; } catch { return false; } });
  if (ok) return null;
  const dismiss = () => { try { sessionStorage.setItem('guillotine-portrait-ok', '1'); } catch { /* ignore */ } setOk(true); };
  return (
    <div className="rotate-hint">
      <svg viewBox="0 0 64 64" className="rotate-ico" aria-hidden="true">
        <rect x="20" y="6" width="24" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
        <path d="M14 52a24 24 0 0 0 36 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M50 44v9h-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="rotate-title">Turn your device sideways</p>
      <p className="rotate-sub">Guillotine plays best in landscape.</p>
      <button className="btn" onClick={dismiss}>Play in portrait anyway</button>
    </div>
  );
}

// Computer players fight under Resistance code-names; each has a nerve level.
const RESISTANCE_NAMES = ['Le Renard', 'La Chouette', 'Papillon', 'Le Fantôme', 'Minuit', 'Le Corbeau', 'Lazare', 'Colette'];
const DIFFS = [
  { key: 0, label: 'Recrue',    hint: 'Easy — hesitates and improvises' },
  { key: 1, label: 'Résistant', hint: 'Medium — plays the best obvious move' },
  { key: 2, label: 'Maquisard', hint: 'Hard — ruthless, grabs every head' },
];
function makeSeats(n, prev) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (prev && prev[i]) { out.push(prev[i]); continue; }
    out.push(i === 0
      ? { human: true, name: 'You', level: 1 }
      : { human: false, name: RESISTANCE_NAMES[(i - 1) % RESISTANCE_NAMES.length], level: 1 });
  }
  return out;
}

function StartScreen({ onStart, onOnline, onResume }) {
  const [count, setCount] = useState(3);
  const [seats, setSeats] = useState(() => makeSeats(3));
  const setCountN = (n) => { setCount(n); setSeats(s => makeSeats(n, s)); };
  const patch = (i, p) => setSeats(s => s.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const toggleHuman = (i) => patch(i, seats[i].human
    ? { human: false, name: RESISTANCE_NAMES[i % RESISTANCE_NAMES.length] }
    : { human: true, name: i === 0 ? 'You' : `Player ${i + 1}` });
  const go = () => onStart(
    seats.map(s => s.name || 'Player'),
    seats.map(s => !s.human),
    seats.map(s => (s.human ? 0 : s.level)),
  );
  return (
    <div className="screen center start-screen">
      <div className="start-fleurs" aria-hidden="true" />
      <img className="start-logo" src="/logo-title.png" alt="Guillotine" />
      <p className="muted">The revolutionary card game where you win by getting a head.</p>
      {onResume && <button className="btn primary start-btn resume-btn" onClick={onResume}>↻ Resume saved game</button>}
      <div className="count-pick">
        <span className="cp-label">Players</span>
        {[2, 3, 4, 5].map(n => (
          <button key={n} className={'count-btn' + (count === n ? ' on' : '')} onClick={() => setCountN(n)}>{n}</button>
        ))}
      </div>
      <div className="seat-list">
        {seats.map((s, i) => (
          <div key={i} className={'seat-row' + (s.human ? ' is-human' : ' is-cpu')}>
            <button className="seat-toggle" onClick={() => toggleHuman(i)} title="Switch Human / Computer">
              {s.human ? 'Human' : 'CPU'}
            </button>
            <input className="seat-name" value={s.name} onChange={e => patch(i, { name: e.target.value })} />
            {!s.human && (
              <span className="seat-diffs">
                {DIFFS.map(d => (
                  <button key={d.key} className={'diff-btn' + (s.level === d.key ? ' on' : '')}
                    onClick={() => patch(i, { level: d.key })} title={d.hint}>{d.label}</button>
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="start-buttons">
        <button className="btn primary start-btn" onClick={go}>Start Game</button>
        {onOnline && <button className="btn start-btn online-btn" onClick={onOnline}>Play Online →</button>}
      </div>
      <p className="muted small resist-note">CPU players are code-named Résistants — set each one's nerve from Recrue to Maquisard. Or play online with friends.</p>
      <a className="hof-link" href="?view=stats">Hall of Fame →</a>
    </div>
  );
}

function GameOver({ G, onRestart, record = true }) {
  useEffect(() => { playBell(0.7); }, []);
  useEffect(() => {
    if (!record) return;
    try {
      const rows = G.players.map((p) => ({ name: p.name, total: computeScore(p).total })).sort((a, b) => b.total - a.total);
      const w = rows[0];
      fetch('/api/tally', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record', winner: w.name, score: w.total, players: G.players.length }) }).catch(() => {});
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const awards = accolades(G.players);
  const rows = G.players.map((p, i) => ({ name: p.name, total: computeScore(p).total, idx: i }))
    .sort((a, b) => b.total - a.total);
  const max = rows[0].total;
  const winners = rows.filter(r => r.total === max).map(r => r.name);
  return (
    <div className="screen center gameover go-wipe">
      <div className="noticeboard">
        <div className="nb-title">Fin de la Révolution</div>
        <div className="nb-winner">{winners.length > 1 ? `Tie — ${winners.join(' & ')}!` : `${winners[0]} wins!`}</div>
        <div className="notices">
          {rows.map((r, place) => (
            <div key={r.name} className={'notice' + (r.total === max ? ' win' : '')}
              style={{ '--rot': `${(place % 2 ? 1 : -1) * (1.4 + place * 0.5)}deg`, '--d': `${0.55 + place * 0.2}s` }}>
              <span className="nail" />
              <span className="notice-rank">{place === 0 ? <img className="go-crown" src="/art/fleur.svg" alt="winner" /> : `${place + 1}`}</span>
              <span className="notice-name">{r.name}</span>
              <span className="notice-score"><HeadScore value={r.total} /></span>
              <span className="notice-awards">
                {awards[r.idx].map(a => <span key={a.title} className="award" title={a.desc}>{a.title}</span>)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="go-cry">Vive la Révolution !</p>
      <button className="btn primary" onClick={onRestart}>Encore ! (Play Again)</button>
    </div>
  );
}

// Touch devices have no hover — a tap opens the pinned preview instead of
// playing straight away, so you can read the card and confirm with Play.
const COARSE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

// Which line nobles an action card would affect right now (for the hover hint).
function affectedLineUids(def, G) {
  const line = G.line;
  if (!def || !line.length) return null;
  const idxs = new Set();
  const { family, params } = def;
  if (family === 'lineMove' || family === 'lineNoble' || family === 'reorder') {
    try { lineNobleCandidates(def, line).forEach(i => idxs.add(i)); } catch { /* ignore */ }
  }
  if (family === 'toFrontEnd') {
    if (params?.op === 'frontToEnd') idxs.add(0);
    else if (params?.op === 'anyToFront') line.forEach((_, i) => idxs.add(i));
  }
  if (!idxs.size) return null;
  return new Set([...idxs].map(i => line[i]?.uid).filter(Boolean));
}

const nobleInspect = (def, el) => ({ img: nobleImg(def.id), name: def.name, faction: def.color, factionName: FACTION[def.color].title, text: def.text, color: COLOR_HEX[def.color], rect: el?.getBoundingClientRect() });
const actionInspect = (def, el) => ({ img: actionImg(def.id), name: def.name, text: def.text, color: '#b4323d', rect: el?.getBoundingClientRect() });

// Faction = noble color. Each has a title and an emblem shown in the point box.
const FACTION = {
  blue:   { title: 'Clergy' },
  green:  { title: 'Judiciary' },
  gray:   { title: 'Common folk' },
  red:    { title: 'Military' },
  purple: { title: 'Royalty' },
};
// Basket order on the player card (matches the card mockup).
const BASKET_ORDER = ['green', 'purple', 'red', 'blue', 'gray'];

// Small clean line-icons (no emoji) for media controls.
const Ico = ({ d, vb = '0 0 24 24', className, fill = 'none', stroke = 'currentColor' }) => (
  <svg className={className} viewBox={vb} fill={fill} stroke={stroke} strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const PlayIcon = (p) => <Ico {...p} fill="currentColor" stroke="none" d={<path d="M7 4.5v15l12-7.5z" />} />;
const PauseIcon = (p) => <Ico {...p} fill="currentColor" stroke="none" d={<><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></>} />;
const NextIcon = (p) => <Ico {...p} fill="currentColor" stroke="none" d={<><path d="M6 4.5v15l11-7.5z" /><rect x="17" y="4.5" width="3" height="15" rx="1" /></>} />;
const SpeakerIcon = ({ muted, ...p }) => <Ico {...p} d={muted
  ? <><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" /><path d="M17 9l5 5M22 9l-5 5" /></>
  : <><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></>} />;
const BugIcon = (p) => <Ico {...p} d={<><rect x="8" y="7" width="8" height="12" rx="4" /><path d="M12 7V4M9 5l2 2M15 5l-2 2M8 10H4M8 14H3.5M8 18l-3 2M16 10h4M16 14h4.5M16 18l3 2" /></>} />;

// A faction's collected heads shown in its tribe-colored basket (real art) with
// the running count of heads caught in it.
function BasketPip({ colorKey, count, title }) {
  return (
    <span className={'bpip' + (count ? '' : ' empty')} title={`${title}: ${count} head${count === 1 ? '' : 's'}`}>
      <img className="bpip-img" src={`/art/basket-${colorKey}.svg`} alt="" />
      {count > 0 && <span className="bpip-ct">{count}</span>}
    </span>
  );
}

// Cards in hand, drawn as a little jaunty stack of cards with the count.
function HandStack({ count }) {
  return (
    <span className="hand-stack" title={`${count} card${count === 1 ? '' : 's'} in hand`}>
      <svg className="hand-stack-svg" viewBox="0 0 40 46" aria-hidden="true">
        <rect x="5" y="9" width="24" height="33" rx="3" fill="#e7e1d3" stroke="#7d7566" strokeWidth="1" transform="rotate(-10 17 25)" />
        <rect x="11" y="8" width="24" height="33" rx="3" fill="#f2ece0" stroke="#7d7566" strokeWidth="1" transform="rotate(7 23 24)" />
        <rect x="8" y="6" width="24" height="33" rx="3" fill="#fff" stroke="#7d7566" strokeWidth="1" />
      </svg>
      <span className="hand-stack-ct">{count}</span>
    </span>
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
    { title: 'La Tête Royale', desc: 'most royals beheaded', idx: winnerBy(s => s.byColor.purple || 0) },
    { title: 'Le Général',     desc: 'most military',        idx: winnerBy(s => s.byColor.red || 0) },
    { title: 'Le Dévot',       desc: 'most clergy',          idx: winnerBy(s => s.byColor.blue || 0) },
    { title: 'La Justice',     desc: 'most judiciary',       idx: winnerBy(s => s.byColor.green || 0) },
    { title: 'Ami du Peuple',  desc: 'most common folk',     idx: winnerBy(s => s.byColor.gray || 0) },
    { title: 'Le Boucher',     desc: 'most heads overall',   idx: winnerBy(s => s.total) },
  ];
  const per = players.map(() => []);
  DEFS.forEach(d => { if (d.idx >= 0) per[d.idx].push(d); });
  return per;
}

// Total points shown over the severed-head silhouette (real art).
function HeadScore({ value, gold }) {
  return (
    <span className={'headscore' + (gold ? ' gold' : '')} title={`${value} points`}>
      <img className="hs-img" src={gold ? '/art/head-gold.svg' : '/art/head.svg'} alt="" />
      <span className="hs-num">{value}</span>
    </span>
  );
}

function Board({ game }) {
  const { G } = game;
  const targeting = G.phase === 'targeting';
  const step = game.step();
  const [inspect, setInspect] = useState(null);
  const [hintUids, setHintUids] = useState(null);
  const inspectRef = useRef(null); inspectRef.current = inspect;
  const inspectT = useRef(null);
  // Touch has no hover: a tap PINS the preview (with its Play button) until the
  // player dismisses it; a mouse hover shows it transiently. `ins.pinned` marks a
  // tapped preview; `ins.affected` drives the line highlight.
  const onInspect = (ins) => {
    if (ins && !ins.pinned && inspectRef.current?.pinned) return;      // hover can't replace a pinned preview
    clearTimeout(inspectT.current);
    if (ins) { setInspect(ins); setHintUids(ins.affected || null); }
    else if (inspectRef.current?.pinned) return;                       // mouse-leave doesn't close a pinned one
    else inspectT.current = setTimeout(() => { setInspect(null); setHintUids(null); }, 420);
  };
  const keepInspect = () => clearTimeout(inspectT.current);
  const closeInspect = () => { clearTimeout(inspectT.current); setInspect(null); setHintUids(null); };
  const [expanded, setExpanded] = useState(null);
  const [fliers, setFliers] = useState([]);
  const [splats, setSplats] = useState([]);
  const [deals, setDeals] = useState([]);
  const [dropTick, setDropTick] = useState(0);
  const [callout, setCallout] = useState(null);
  const seen = useRef(0);
  const lineRects = useRef({});
  const deckRects = useRef({});
  const prevDay = useRef(0);
  const prevLine = useRef(0);
  const prevHandLen = useRef(0);

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
      setDropTick(t => t + 1);
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

  // Capture current line-token + draw-pile positions every render (fly points).
  useLayoutEffect(() => {
    const map = {};
    document.querySelectorAll('.noble-card[data-line-uid]').forEach(el => {
      map[el.getAttribute('data-line-uid')] = el.getBoundingClientRect();
    });
    lineRects.current = map;
    const dmap = {};
    document.querySelectorAll('[data-deck]').forEach(el => {
      dmap[el.getAttribute('data-deck')] = el.getBoundingClientRect();
    });
    deckRects.current = dmap;
  });

  // Deal cards out of the draw piles: nobles → line (new day / opening), and
  // actions → the human hand when it grows. Diffs counts, like the log diff.
  useLayoutEffect(() => {
    const nd = deckRects.current.noble, ad = deckRects.current.action;
    const add = [];
    const lineGrew = G.line.length > prevLine.current;
    if (nd && lineGrew && (G.day !== prevDay.current || prevLine.current === 0)) {
      const from = { x: nd.left + nd.width / 2, y: nd.top + nd.height / 2 };
      Object.values(lineRects.current).forEach((r, i) => {
        add.push({ key: `nd-${G.day}-${i}-${seen.current}`, back: NOBLE_BACK, from,
          to: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, delay: i * 95 });
      });
    }
    const curHand = G.players[G.current]?.hand.length ?? 0;
    if (ad && !G.cpu?.[G.current] && curHand > prevHandLen.current) {
      const dock = document.querySelector('.hand-dock');
      if (dock) {
        const dr = dock.getBoundingClientRect();
        const from = { x: ad.left + ad.width / 2, y: ad.top + ad.height / 2 };
        const k = Math.min(curHand - prevHandLen.current, 6);
        for (let i = 0; i < k; i++) add.push({ key: `ad-${G.current}-${curHand}-${i}`, back: ACTION_BACK, from,
          to: { x: dr.left + dr.width * (0.3 + 0.4 * Math.random()), y: dr.top + dr.height / 2 }, delay: i * 110 });
      }
    }
    prevDay.current = G.day; prevLine.current = G.line.length; prevHandLen.current = curHand;
    if (add.length) setDeals(d => [...d, ...add]);
  });

  const locks = [];
  if (judgeBlocks(G)) locks.push('Unpopular Judge — no actions this turn');
  else {
    if (G.actionBlocked) locks.push('Rushed — no action, just collect');
    if (callousActive(G)) locks.push('Callous Guards — line cards locked');
  }

  const pileStep = step && step.type === 'pileNoble' ? step.playerIdx : null;
  const showPile = expanded != null ? expanded : pileStep;

  return (
    <div className="board2">
      <main className="field">
        <div className="field-msg">
          <span className="message">{G.message}</span>
        </div>
        <div className="field-bar">
          <TurnSteps G={G} />
          <div className="decks-col">
            <DeckPile kind="noble" count={G.nobleDeck.length} label="Nobles" />
            <DeckPile kind="action" count={G.actionDeck.length} label="Actions" />
          </div>
        </div>
        {locks.length > 0 && <div className="locks">{locks.map((l, i) => <span key={i} className="lock-chip">{l}</span>)}</div>}

        <GuillotineLine game={game} step={step} onPick={game.pick} onInspect={onInspect} targeting={targeting} drop={dropTick} hint={hintUids} />

        <HandDock game={game} onInspect={onInspect} />
      </main>

      <aside className="hud2">
        <div className="hud-top">
          <span className="day-chip">Day {G.day} / 3</span>
          <span className="hud-nav">
            <button className="nav-btn" onClick={game.restart} title="New game">↻</button>
            <SoundToggle />
          </span>
        </div>
        {G.players.map((p, i) => (
          <PlayerCard key={i} player={p} index={i} game={game} step={step}
            onInspect={onInspect} onExpand={setExpanded} />
        ))}
        <LogPanel log={G.log} />
      </aside>

      <HoverCard inspect={inspect} onKeep={keepInspect} onLeave={() => onInspect(null)} onClose={closeInspect} />

      {showPile != null && (
        <NoblePileModal G={G} index={showPile} game={game} step={step} onInspect={onInspect}
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
        {deals.map(d => <DealFlier key={d.key} deal={d} onDone={() => setDeals(x => x.filter(y => y.key !== d.key))} />)}
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

  return (
    <div className={'pcard' + (isCurrent ? ' active' : '') + (playerTarget ? ' selectable' : '')}
      data-pile={index}
      onClick={() => (playerTarget ? game.pick({ playerIdx: index }) : onExpand(index))}>
      <div className="pc-top">
        <span className="pc-name"><span className="pc-name-txt">{player.name}</span>{G.cpu?.[index] && <span className="cpu-badge">CPU</span>}</span>
        <HandStack count={player.hand.length} />
        <span className="pc-score"><ScoreDelta value={total} /><HeadScore value={total} gold /></span>
      </div>
      <div className="pc-baskets">
        {BASKET_ORDER.map(c => <BasketPip key={c} colorKey={c} count={tally[c] || 0} title={FACTION[c].title} />)}
      </div>
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
                {canDiscard && <button className="discard-x" onClick={(e) => { e.stopPropagation(); game.discardFront(inst.uid); }} title="Discard">×</button>}
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
function GuillotineLine({ game, step, onPick, onInspect, targeting, drop, hint }) {
  const { G } = game;
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
        { duration: 600, easing: 'cubic-bezier(.45,0,.35,1)' });
    });
    prevOffsets.current = next;
  }, [G.line]);

  useEffect(() => {
    if (G.phase === 'targeting') return;
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [G.line.length, G.phase]);

  const activeIsMe = game.seat == null || G.current === game.seat;
  const canBehead = G.phase === 'playing' && !targeting && !G.cpu?.[G.current] && activeIsMe;
  const cta = G.line.length === 0 ? 'End turn' : 'Off with their head!';
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
              className={'noble-card token' + (idx === 0 ? ' front' : '') + (isCand && ordPos < 0 ? ' candidate' : '') + (hint?.has(inst.uid) ? ' affected' : '')}
              style={{ borderColor: COLOR_HEX[def.color] }}
              onClick={(e) => { if (isCand && ordPos < 0) onPick({ idx }); else onInspect({ ...nobleInspect(def, e.currentTarget), pinned: true }); }}
              onMouseEnter={(e) => onInspect(nobleInspect(def, e.currentTarget))}
              onMouseLeave={() => onInspect(null)}
              title={`${def.name} — ${COLORS[def.color]}`}>
              <img src={nobleImg(def.id)} alt={def.name} loading="lazy" decoding="async" />
              {idx === 0 && ordPos < 0 && <span className="front-tag">NEXT</span>}
              {ordPos >= 0 && <span className="order-tag">{ordPos + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="guillo-col">
        <button className={'guillo-btn' + (canBehead ? ' live' : '') + (canBehead && G.line.length > 0 ? ' pulse' : '')}
          onClick={canBehead ? game.collectAndEnd : undefined} disabled={!canBehead}
          title={canBehead ? cta : 'Wait for your turn'}>
          <Guillotine drop={drop} />
          <span className="guillo-cta">{cta}</span>
        </button>
        <div className="guillo-aux">
          {targeting && <button className="btn small" onClick={game.cancelTarget}>Cancel</button>}
          {game.canUndo() && <button className="btn small" onClick={game.undo}>↶ Undo</button>}
        </div>
      </div>
    </div>
  );
}

// A detailed guillotine on a stepped platform; the blade drops on each behead.
function Guillotine({ drop = 0 }) {
  return (
    <div className="guillo-wrap" title="The guillotine — the next head drops here">
      <svg className="guillo" viewBox="0 0 132 158" aria-label="guillotine">
        <defs>
          <linearGradient id="guilloMetal" x1="0" y1="0" x2="1" y2="0.35">
            <stop offset="0" stopColor="#848484" /><stop offset=".3" stopColor="#dadbdc" />
            <stop offset=".6" stopColor="#848484" /><stop offset="1" stopColor="#67696a" />
          </linearGradient>
          <linearGradient id="guilloEdge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bababa" /><stop offset=".3" stopColor="#fff" /><stop offset="1" stopColor="#929394" />
          </linearGradient>
          <radialGradient id="guilloRivet" cx=".35" cy=".3" r=".75">
            <stop offset="0" stopColor="#fffcdf" /><stop offset=".3" stopColor="#d8bb12" /><stop offset="1" stopColor="#332d04" />
          </radialGradient>
        </defs>
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
        {/* carriage: rope + metallic blade + wooden stock with rivets — drops on behead */}
        <g className="guillo-blade" key={drop}>
          <line x1="74" y1="10" x2="74" y2="28" stroke="#caa66a" strokeWidth="1.6" />
          <polygon points="52,44 97,44 97,60 52,66" fill="url(#guilloMetal)" stroke="#5c6165" strokeWidth="0.6" />
          <polygon points="52,60 97,55 97,60 52,66" fill="url(#guilloEdge)" opacity=".85" />
          <rect x="47" y="28" width="54" height="17" rx="2" fill="#774c00" stroke="#3f2f22" strokeWidth="0.8" />
          <rect x="50" y="30" width="48" height="13" rx="1.5" fill="#4c3612" />
          <circle cx="58" cy="36.5" r="2.6" fill="url(#guilloRivet)" />
          <circle cx="70" cy="36.5" r="2.6" fill="url(#guilloRivet)" />
          <circle cx="82" cy="36.5" r="2.6" fill="url(#guilloRivet)" />
          <circle cx="94" cy="36.5" r="2.6" fill="url(#guilloRivet)" />
        </g>
        {/* lunette — the neck hole */}
        <circle cx="74.5" cy="96" r="12" fill="#17110c" />
        <path d="M63 96a11.5 11.5 0 0 1 23 0" fill="none" stroke="#c6a765" strokeWidth="3" />
        <path d="M63 96a11.5 11.5 0 0 0 23 0" fill="none" stroke="#8f7236" strokeWidth="3" />
        {/* basket for the heads */}
        <path d="M58 112h33l-3.5 12a2 2 0 0 1-2 1.5H63.5a2 2 0 0 1-2-1.5z" fill="#8a6a3f" stroke="#5a4330" strokeWidth="1" />
        <path d="M60 117h29M61 121h27" stroke="rgba(0,0,0,.2)" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

// ─── A draw pile beside the line (card-sized); cards deal out from here ───────
function DeckPile({ kind, count, label }) {
  const back = kind === 'noble' ? NOBLE_BACK : ACTION_BACK;
  return (
    <div className="deck-pile" data-deck={kind} title={`${label} draw pile — ${count} left`}>
      <span className="deck-pile-stack">
        <img src={back} alt="" />
        <span className="deck-pile-ct">{count}</span>
      </span>
      <span className="deck-pile-label">{label}</span>
    </div>
  );
}

// ─── The logged-in player's action-card hand ────────────────────────────────
function HandDock({ game, onInspect }) {
  const { G } = game;
  const activeIsMe = game.seat == null || G.current === game.seat;
  if (G.cpu?.[G.current]) return <div className="hand-dock cpu">{G.players[G.current].name} is thinking…</div>;
  if (!activeIsMe) return <div className="hand-dock cpu">Waiting for {G.players[G.current].name}…</div>;
  const hand = G.players[G.current].hand;
  const n = hand.length;
  return (
    <div className="hand-dock">
      {hand.map((inst, hi) => {
        const def = ACTION_BY_ID[inst.defId];
        const playable = game.canPlay(hi);
        const ins = (el) => ({ ...actionInspect(def, el), onPlay: playable ? () => game.playCard(hi) : null,
          affected: playable ? affectedLineUids(def, G) : null });
        return (
          <button key={inst.uid} className={'dock-card' + (playable ? ' playable' : '')}
            style={{ '--i': hi - (n - 1) / 2 }}
            onClick={(e) => { if (COARSE) onInspect({ ...ins(e.currentTarget), pinned: true }); else if (playable) game.playCard(hi); }}
            onMouseEnter={(e) => onInspect(ins(e.currentTarget))}
            onMouseLeave={() => onInspect(null)}
            title={`${def.name}\n${def.text}`}>
            <img src={actionImg(def.id)} alt={def.name} loading="lazy" decoding="async" />
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
  const poss = player.name === 'You' ? 'Your heads' : `${player.name}'s heads`;
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal pile-modal" onClick={e => e.stopPropagation()}>
        <p className="modal-title">{poss} — {total} pts{pileTarget ? ' · choose one to take' : ''}</p>
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
function HoverCard({ inspect, onKeep, onLeave, onClose }) {
  if (!inspect) return null;
  const { img, name, faction, factionName, text, color, onPlay, pinned } = inspect;
  return (
    <>
      {pinned && <div className="hovercard-backdrop" onClick={onClose} />}
      <div className={'hovercard center' + (pinned ? ' pinned' : '')}
        onMouseEnter={onKeep} onMouseMove={onKeep} onMouseLeave={onLeave}>
        <div className="hc-imgwrap">
          <img className="hc-img" src={img} alt={name} style={{ borderColor: color }} />
          {faction && <img className="hc-emblem" src={`/art/symbol-${faction}.svg`} alt={factionName} title={factionName} />}
        </div>
        <div className="hc-name">{name}</div>
        {text && <div className="hc-text">{text}</div>}
        {onPlay && (
          <button className="btn primary hc-play" onClick={() => { onPlay(); onClose && onClose(); }}>
            Play this card ▸
          </button>
        )}
        {pinned && <button className="hc-close" onClick={onClose}>{onPlay ? 'Cancel' : 'Close'}</button>}
      </div>
    </>
  );
}

// ─── Online multiplayer (PeerJS, host-authoritative — mirrors Long Shot) ─────
function useLive(obj) {
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => (obj ? obj.on(bump) : undefined), [obj]);
}

// Online chat + quick taunts, a collapsible corner panel.
function ChatPanel({ messages, onSend }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const send = () => { const t = text.trim(); if (t) { onSend(t); setText(''); } };
  const recent = (messages || []).slice(-30);
  return (
    <div className={'chat-panel' + (open ? ' open' : '')}>
      <button className="chat-toggle" onClick={() => setOpen((o) => !o)}>Chat{recent.length ? ` · ${recent.length}` : ''}</button>
      {open && (
        <div className="chat-box">
          <div className="chat-log">
            {recent.length ? recent.map((m, i) => <div key={i} className="chat-msg"><b>{m.name}</b> {m.text}</div>)
              : <div className="muted small">Say hello…</div>}
          </div>
          <div className="chat-taunts">
            {['Nice!', 'Off with your head!', 'Mercy!', 'Ha!'].map((t) => <button key={t} onClick={() => onSend(t)}>{t}</button>)}
          </div>
          <div className="chat-input">
            <input value={text} maxLength={120} placeholder="Message…"
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="btn small" onClick={send}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}

function OnlineHome({ onHost, onJoin, onBack }) {
  const joinCode = cleanCode(new URLSearchParams(location.search).get('join') || '');
  const [tab, setTab] = useState(joinCode ? 'join' : 'host');
  const [name, setName] = useState(() => { try { return localStorage.getItem('guillotine-name') || 'You'; } catch { return 'You'; } });
  const [code, setCode] = useState(joinCode);
  const save = (n) => { setName(n); try { localStorage.setItem('guillotine-name', n); } catch { /* ignore */ } };
  const host = () => onHost(new HostRoom(name.trim() || 'You'));
  const join = () => { const c = cleanCode(code); if (c.length === 5) onJoin(new JoinClient(c, name.trim() || 'Friend')); };
  return (
    <div className="screen center online-home">
      <img className="start-logo" src="/logo-title.png" alt="Guillotine" />
      <div className="oh-tabs">
        <button className={'mode-btn' + (tab === 'host' ? ' on' : '')} onClick={() => setTab('host')}>Host a game</button>
        <button className={'mode-btn' + (tab === 'join' ? ' on' : '')} onClick={() => setTab('join')}>Join with a code</button>
      </div>
      <label className="oh-field"><span>Your name</span>
        <input value={name} maxLength={14} onChange={(e) => save(e.target.value)} /></label>
      {tab === 'join' && (
        <label className="oh-field"><span>Room code</span>
          <input className="oh-code" value={code} maxLength={5} placeholder="ABCDE"
            onChange={(e) => setCode(cleanCode(e.target.value))} /></label>
      )}
      {tab === 'host'
        ? <button className="btn primary start-btn" onClick={host}>Create room</button>
        : <button className="btn primary start-btn" onClick={join} disabled={cleanCode(code).length !== 5}>Join room</button>}
      <button className="btn" onClick={onBack}>← Back</button>
    </div>
  );
}

// Lobby — host sees controls + the room code; a friend sees the seats and waits.
function Lobby({ room, isHost, code, seats, onStart, onExit }) {
  const copy = () => { try { navigator.clipboard.writeText(`${location.origin}/?join=${code}`); } catch { /* ignore */ } };
  const canStart = isHost && seats.length >= 2 && seats.every((s) => s.kind !== 'remote' || s.connected);
  return (
    <div className="screen center lobby">
      <h2>Online lobby</h2>
      <div className="lobby-code" onClick={copy} title="Copy invite link">
        <span className="lc-label">Room code</span>
        <span className="lc-code">{code || '…'}</span>
        <span className="lc-copy">tap to copy invite link</span>
      </div>
      <div className="lobby-seats">
        {seats.map((s, i) => (
          <div key={i} className={'lseat ' + s.kind}>
            <span className="ls-name">{s.name}
              <span className="ls-tag">{s.kind === 'host' ? 'host' : s.kind === 'ai' ? 'CPU' : (s.connected ? 'online' : 'offline')}</span></span>
            {isHost && s.kind === 'ai' && (
              <span className="seat-diffs">
                {DIFFS.map((d) => <button key={d.key} className={'diff-btn' + ((s.level ?? 1) === d.key ? ' on' : '')}
                  onClick={() => room.setLevel(i, d.key)}>{d.label}</button>)}
              </span>
            )}
            {isHost && s.kind !== 'host' && <button className="btn small" onClick={() => room.removeSeat(i)}>Remove</button>}
          </div>
        ))}
      </div>
      {isHost ? (
        <div className="lobby-actions">
          <button className="btn" onClick={() => room.addComputer()} disabled={seats.length >= 5}>+ Add CPU</button>
          <button className="btn primary" onClick={onStart} disabled={!canStart}>Start Game</button>
        </div>
      ) : <p className="muted">Waiting for the host to start…</p>}
      <button className="btn" onClick={onExit}>Leave</button>
    </div>
  );
}

function HostShell({ room, speed, onExit, resumeG }) {
  useLive(room);
  const game = useGame();
  const { G } = game;
  const loaded = useRef(false);
  useEffect(() => { if (resumeG && !loaded.current) { loaded.current = true; game.load(resumeG); room.started = true; } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { room.game = game; if (room.started) room.pushState(); });  // keep engine fresh + broadcast
  // save the host session so a reload resumes it (friends auto-reconnect)
  useEffect(() => {
    if (!room.started || G.phase === 'start') return;
    try {
      if (G.phase === 'gameOver') localStorage.removeItem('guillotine-host-save');
      else localStorage.setItem('guillotine-host-save', JSON.stringify({ ...room.snapshot(), G, at: Date.now() }));
    } catch { /* ignore */ }
  }, [G]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (G.phase === 'pass') { const t = setTimeout(() => game.advanceFromPass(), 0); return () => clearTimeout(t); }
  }, [G.phase, G.current, G.day]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (G.phase !== 'playing' || !G.cpu?.[G.current]) return;
    const t = setTimeout(() => { if (G.actionPlayed) game.collectAndEnd(); else game.cpuPlay(); }, Math.round(1300 / speed));
    return () => clearTimeout(t);
  }, [G.phase, G.current, G.day, G.actionPlayed, speed]); // eslint-disable-line react-hooks/exhaustive-deps
  const exit = () => { try { localStorage.removeItem('guillotine-host-save'); } catch { /* ignore */ } onExit(); };
  const start = () => { const [names, cpu, lvl] = room.setupArgs(); game.start(names, cpu, lvl); room.markStarted(); };
  if (!room.started || G.phase === 'start')
    return <Lobby room={room} isHost code={room.code} seats={room.seats} onStart={start} onExit={exit} />;
  if (G.phase === 'gameOver') return <GameOver G={G} onRestart={exit} />;
  return (<><Board game={{ ...game, seat: 0 }} /><ChatPanel messages={room.chat} onSend={(t) => room.sayAs(t)} /></>);
}

function ClientShell({ client, onExit }) {
  useLive(client);
  if (client.status === 'error' || client.status === 'ended')
    return (<div className="screen center"><h2>Disconnected</h2><p className="muted">{client.error}</p>
      {client.status === 'error' && <button className="btn primary" onClick={() => client.rejoin()}>Try again</button>}
      <button className="btn" onClick={onExit}>Leave</button></div>);
  if (!client.G || ['lobby', 'connecting', 'reconnecting'].includes(client.status)) {
    if (client.lobby && client.status === 'lobby')
      return <Lobby isHost={false} code={client.lobby.code} seats={client.lobby.seats} onExit={onExit} />;
    return (<div className="screen center"><h2>{client.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</h2>
      <button className="btn" onClick={onExit}>Leave</button></div>);
  }
  const G = client.G, seat = client.you;
  const facade = {
    G, seat,
    step: () => (G.phase === 'targeting' && G.pending) ? getStep(ACTION_BY_ID[G.pending.defId], G, G.pending.picks) : null,
    canPlay: (hi) => { if (G.phase !== 'playing' || G.actionPlayed || G.current !== seat) return false; const inst = G.players[seat]?.hand[hi]; return inst && !inst.hidden ? canPlayCard(G, ACTION_BY_ID[inst.defId]) : false; },
    canUndo: () => false, undo: () => {}, restart: () => {},
    playCard: (hi) => client.action('playCard', [hi]),
    pick: (v) => client.action('pick', [v]),
    cancelTarget: () => client.action('cancelTarget', []),
    collectAndEnd: () => client.action('collectAndEnd', []),
    discardFront: (uid) => client.action('discardFront', [uid]),
    advanceFromPass: () => {}, cpuPlay: () => {}, score: (p) => computeScore(p),
  };
  if (G.phase === 'gameOver') return <GameOver G={G} onRestart={onExit} record={false} />;
  return (<><Board game={facade} /><ChatPanel messages={client.chat} onSend={(t) => client.say(t)} /></>);
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

  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };
  const next = () => setIdx(i => (i + 1) % TRACKS.length);
  const prev = () => setIdx(i => (i - 1 + TRACKS.length) % TRACKS.length);
  const seek = (e) => { const a = audioRef.current; const t = parseFloat(e.target.value); if (a) { a.currentTime = t; setCur(t); } };
  const pct = dur ? (cur / dur) * 100 : 0;
  return (
    <div className="music-player">
      <audio ref={audioRef} onEnded={next}
        onTimeUpdate={e => setCur(e.target.currentTime)}
        onLoadedMetadata={e => setDur(e.target.duration || 0)} />
      <div className="mp-controls">
        <button className="mp-btn" onClick={prev} title="Previous"><NextIcon className="mp-ico flip" /></button>
        <button className="mp-btn mp-play" onClick={toggle} title={playing ? 'Pause' : 'Play'}>{playing ? <PauseIcon className="mp-ico" /> : <PlayIcon className="mp-ico" />}</button>
        <button className="mp-btn" onClick={next} title="Next"><NextIcon className="mp-ico" /></button>
      </div>
      <div className="mp-main">
        <span className="mp-name">{TRACKS[idx].name}</span>
        <div className="mp-seekrow">
          <span className="mp-time">{fmtTime(cur)}</span>
          <input className="mp-seek" type="range" min="0" max={dur || 0} step="0.1" value={cur}
            onChange={seek} style={{ '--pct': pct + '%' }} title="Seek" />
          <span className="mp-time">{fmtTime(dur)}</span>
        </div>
      </div>
      <input className="mp-vol" type="range" min="0" max="1" step="0.05" value={vol}
        onChange={e => setVol(parseFloat(e.target.value))} title="Volume" />
    </div>
  );
}
function fmtTime(t) {
  if (!isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function SoundToggle() {
  const [muted, setMuted] = useState(isMuted());
  return (
    <button className="sound-toggle nav-btn" title={muted ? 'Unmute SFX' : 'Mute SFX'}
      onClick={() => setMuted(toggleMuted())}><SpeakerIcon muted={muted} className="nav-ico" /></button>
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

function HelpSheet({ close, reduce, setReduce }) {
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
            <span><img className="leg-emblem" src="/art/symbol-blue.svg" alt="" /> Clergy</span>
            <span><img className="leg-emblem" src="/art/symbol-green.svg" alt="" /> Judiciary</span>
            <span><img className="leg-emblem" src="/art/symbol-gray.svg" alt="" /> Common folk</span>
            <span><img className="leg-emblem" src="/art/symbol-red.svg" alt="" /> Military</span>
            <span><img className="leg-emblem" src="/art/symbol-purple.svg" alt="" /> Royalty</span>
          </div>
          <p className="muted small">Watch for combos: Count + Countess, stacking Palace Guards, and negative "good-guy" nobles (Hero, Tragic Figure). Hover any card to see it big.</p>
          <label className="help-toggle">
            <input type="checkbox" checked={reduce} onChange={e => setReduce(e.target.checked)} />
            Reduce motion (fewer animations)
          </label>
        </div>
        <button className="btn primary" onClick={close}>Got it</button>
      </div>
    </div>
  );
}

// ─── Number-placement editor (/?view=cardedit) ───────────────────────────────
// Drag to move, scroll to scale. Values (as % of the art box) persist to
// localStorage so the exact placement can be baked into the CSS.
const NUMPOS_KEY = 'guillotine-numpos';
const NUMPOS_DEFAULTS = {
  head:   { x: 47.2, y: 41.9, f: 40 },   // f = font size as % of box height
  basket: { x: 47.1, y: 31.8, f: 33 },
  hand:   { x: 48.4, y: 47, f: 38 },
};
function DragNum({ value, pos, setPos, boxH, dark }) {
  const onDown = (e) => {
    e.preventDefault();
    const parent = e.currentTarget.parentElement.getBoundingClientRect();
    const move = (ev) => {
      const x = Math.max(0, Math.min(100, ((ev.clientX - parent.left) / parent.width) * 100));
      const y = Math.max(0, Math.min(100, ((ev.clientY - parent.top) / parent.height) * 100));
      setPos(p => ({ ...p, x: +x.toFixed(1), y: +y.toFixed(1) }));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const onWheel = (e) => { e.preventDefault(); setPos(p => ({ ...p, f: +Math.max(6, Math.min(90, p.f + (e.deltaY < 0 ? 1 : -1))).toFixed(0) })); };
  return (
    <span className={'edit-num' + (dark ? ' dark' : '')}
      style={{ left: pos.x + '%', top: pos.y + '%', fontSize: (pos.f / 100 * boxH) + 'px' }}
      onPointerDown={onDown} onWheel={onWheel}>{value}</span>
  );
}
const HandStackArt = () => (
  <svg className="ce-img" viewBox="0 0 40 46" aria-hidden="true">
    <rect x="5" y="9" width="24" height="33" rx="3" fill="#e7e1d3" stroke="#7d7566" strokeWidth="1" transform="rotate(-10 17 25)" />
    <rect x="11" y="8" width="24" height="33" rx="3" fill="#f2ece0" stroke="#7d7566" strokeWidth="1" transform="rotate(7 23 24)" />
    <rect x="8" y="6" width="24" height="33" rx="3" fill="#fff" stroke="#7d7566" strokeWidth="1" />
  </svg>
);
function CardEdit() {
  const [pos, setPos] = useState(() => {
    try { return { ...NUMPOS_DEFAULTS, ...(JSON.parse(localStorage.getItem(NUMPOS_KEY)) || {}) }; } catch { return NUMPOS_DEFAULTS; }
  });
  useEffect(() => { try { localStorage.setItem(NUMPOS_KEY, JSON.stringify(pos)); } catch { /* ignore */ } }, [pos]);
  const set = (key) => (fn) => setPos(p => ({ ...p, [key]: fn(p[key]) }));
  const HH = 230, BH = 210, NH = 196;   // editor box heights
  const slot = (label, key, art, boxH, dark) => (
    <div className="ce-slot">
      <div className="ce-box" style={{ height: boxH, width: boxH * 0.84 }}>
        {art}
        <DragNum value={key === 'head' ? '22' : key === 'basket' ? '4' : '5'} pos={pos[key]} setPos={set(key)} boxH={boxH} dark={dark} />
      </div>
      <div className="ce-label">{label}</div>
      <div className="ce-vals">x {pos[key].x}% · y {pos[key].y}% · size {pos[key].f}%</div>
    </div>
  );
  return (
    <div className="card-edit">
      <h1>Number placement</h1>
      <p className="muted"><b>Drag</b> each number to move · <b>scroll</b> over it to scale. Then tell me &ldquo;done&rdquo; and I&rsquo;ll bake these in exactly. (Baskets all share one position.)</p>
      <div className="ce-grid">
        {slot('Head · points', 'head', <img className="ce-img" src="/art/head-gold.svg" alt="" />, HH, true)}
        {slot('Basket · count', 'basket', <img className="ce-img" src="/art/basket-purple.svg" alt="" />, BH, false)}
        {slot('Hand · count', 'hand', <HandStackArt />, NH, true)}
      </div>
      <pre className="ce-readout">{JSON.stringify(pos)}</pre>
      <div className="ce-btns">
        <button className="btn primary" onClick={() => { try { navigator.clipboard.writeText(JSON.stringify(pos)); } catch { /* ignore */ } }}>Copy values</button>
        <button className="btn" onClick={() => setPos(NUMPOS_DEFAULTS)}>Reset</button>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Paste the copied line back to me and I&rsquo;ll apply it exactly.</p>
    </div>
  );
}

// ─── Hall of Fame (/?view=stats) ─────────────────────────────────────────────
function StatsView() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch('/api/tally').then((r) => r.json()).then(setData).catch(() => setData({ games: 0, wins: [], recent: [] })); }, []);
  return (
    <div className="art-review stats-view">
      <header className="ar-head">
        <img className="ar-logo" src="/logo-title.png" alt="Guillotine" />
        <h1>Hall of Fame</h1>
        <p className="muted">{data ? `${data.games} game${data.games === 1 ? '' : 's'} played` : 'Loading…'}</p>
      </header>
      {data && (
        <>
          <section>
            <h2>Most wins</h2>
            <div className="hof-list">
              {(data.wins || []).length ? data.wins.map((w, i) => (
                <div key={w.name + i} className="hof-row"><span className="hof-rank">{i + 1}</span>
                  <span className="hof-name">{w.name}</span><span className="hof-n">{w.n} win{w.n === 1 ? '' : 's'}</span></div>
              )) : <p className="muted">No champions yet — go win one.</p>}
            </div>
          </section>
          <section>
            <h2>Recent champions</h2>
            <div className="hof-list">
              {(data.recent || []).length ? data.recent.map((r, i) => (
                <div key={i} className="hof-row"><span className="hof-name">{r.winner}</span>
                  <span className="hof-n">{r.score} pts · {r.players}p</span></div>
              )) : <p className="muted">—</p>}
            </div>
          </section>
        </>
      )}
      <p className="ar-foot muted">Vive la Révolution !</p>
    </div>
  );
}

// ─── Art review page (/?view=art) — gallery for approving assets ─────────────
function ArtTile({ src, label, node, size = 96, wide }) {
  const content = node || <img src={src} alt={label} style={{ maxWidth: size, maxHeight: size, display: 'block' }} />;
  return (
    <figure className={'art-tile' + (wide ? ' wide' : '')}>
      <div className="art-swatches">
        <span className="art-sw dark">{content}</span>
        <span className="art-sw light">{content}</span>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}
function ArtReview() {
  const COLORSET = ['red', 'blue', 'green', 'gray', 'purple'];
  return (
    <div className="art-review">
      <header className="ar-head">
        <img className="ar-logo" src="/logo-title.png" alt="Guillotine" />
        <h1>Art Review</h1>
        <p className="muted">Each asset is shown on dark &amp; light. Tell me which fleur (A–D) to approve, and flag anything to fix.</p>
      </header>

      <section>
        <h2>Fleur-de-lis — your real art (pick one for the UI)</h2>
        <div className="art-grid">
          <ArtTile src="/art/fleur-real-gold.svg" label="Gold" />
          <ArtTile src="/art/fleur-real-silver.svg" label="Silver (in use)" />
          <ArtTile src="/art/fleur-real-bright.svg" label="Bright gold" />
        </div>
      </section>

      <section>
        <h2>Card layout target</h2>
        <div className="art-grid">
          <ArtTile src="/art-game.svg" label="Your card mockup (symbols are external PNGs — not embedded)" size={228} wide />
        </div>
      </section>

      <section>
        <h2>Logo &amp; guillotine</h2>
        <div className="art-grid">
          <ArtTile src="/logo-title.png" label="Logo wordmark" size={220} wide />
          <ArtTile node={<Guillotine />} label="Guillotine" />
          <ArtTile src="/art/blade.svg" label="Blade" />
          <ArtTile src="/art/head.svg" label="Head · points" />
        </div>
      </section>

      <section>
        <h2>Faction baskets</h2>
        <div className="art-grid">
          {COLORSET.map(c => <ArtTile key={c} src={`/art/basket-${c}.svg`} label={`${c} · ${FACTION[c].title}`} />)}
        </div>
      </section>

      <section>
        <h2>Faction symbols</h2>
        <div className="art-grid">
          {COLORSET.map(c => <ArtTile key={c} src={`/art/symbol-${c}.svg`} label={FACTION[c].title} size={60} />)}
        </div>
      </section>

      <section>
        <h2>Card backs</h2>
        <div className="art-grid">
          <ArtTile src="/cards/nobles/back.webp" label="Noble back" size={120} />
          <ArtTile src="/cards/actions/back.png" label="Action back" size={120} />
        </div>
      </section>

      <p className="ar-foot muted">— end of review —</p>
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
      <button className="bug-fab" title="Report a bug" onClick={() => { setOpen(true); setStatus(null); }}><BugIcon className="bug-ico" /></button>
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
