import { useState, useRef, useEffect, useLayoutEffect, useReducer } from 'react';
import './App.css';
import { useGame } from './hooks/useGame';
import {
  NOBLE_BY_ID, ACTION_BY_ID, COLOR_HEX, COLORS,
  nobleImg, actionImg, NOBLE_BACK, ACTION_BACK,
} from './data/cards';
import { computeScore } from './utils/scoring';
import { SCENE_SPRITES, SPRITE_ALPHA, NOBLE_SPRITES, spriteSlug } from './data/sprites';
import PlazaScene from './PlazaScene';
import { judgeBlocks, callousActive, getStep, canPlayCard, playBlockReason, applyResolved } from './utils/effects';
import { HostRoom, JoinClient, cleanCode } from './net/room';
import { SliceFlier, BloodSplatter, SlicedThumb, ScoreDelta, DayBanner, DealFlier, setReduce } from './Effects';
import { playBehead, playWhoosh, playBell, playSlice, isMuted, toggleMuted } from './sound';
import { loadTheme, applyTheme, THEME_KEY, ThemeSheet } from './theme';
import BugReport from './BugReport';
import BugList from './BugList';


// Pixel brand logo: the forged guillotine emblem + the wordmark in pixel type.
function ShineLogo({ className }) {
  // Pixel-art wordmark (guillotine built into the letters).
  return <img src="/logo-guillotine.svg" alt="Guillotine" className={'pixlogo-img ' + (className || '')} />;
}

export default function App() {
  const game = useGame();
  const { G } = game;
  // On first load, swish the guillotine blade as the logo gleam sweeps across.
  useEffect(() => { playSlice(0.45); }, []);
  const [theme, setThemeState] = useState(loadTheme);
  const [showTheme, setShowTheme] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showBug, setShowBug] = useState(false);
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
    const t = setTimeout(() => { if (G.actionPlayed) game.collectAndEnd(); else game.cpuPlay(); }, Math.round(1900 / speed));
    return () => clearTimeout(t);
  }, [G.phase, G.current, G.day, G.actionPlayed, speed]); // eslint-disable-line react-hooks/exhaustive-deps


  const view = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null;
  if (view === 'bugs') return <div className="app"><BugList /></div>;
  if (view === 'art') return <div className="app"><ArtReview /></div>;
  if (view === 'cardedit') return <div className="app"><CardEdit /></div>;
  if (view === 'stats') return <div className="app"><StatsView /></div>;

  return (
    <div className="app">
      <header className="topbar">
        <span className="tb-left">
          <ShineLogo className="topbar-logo" />
          <span className="tagline">win by getting a head</span>
        </span>
        <span className="tb-center">
          <button className="nav-btn" onClick={() => setShowHelp(true)} title="How to play">?</button>
          <button className="nav-btn" onClick={toggleSpeed} title="CPU speed">{speed}×</button>
          <button className="nav-btn theme-btn" onClick={() => setShowTheme(true)} title="Theme &amp; fonts">Aa</button>
        </span>
        <span className="tb-right"><MusicPlayer /></span>
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
      <button className="bug-fab" title="Report a bug" onClick={() => setShowBug(true)}><BugIcon className="bug-ico" /></button>
      {showBug && <BugReport onClose={() => setShowBug(false)} context={{
        day: G.day, phase: G.phase,
        players: G.players.map((p, i) => ({ name: p.name, cpu: !!G.cpu?.[i] })),
        log: (G.log || []).map((l) => l.text),
      }} />}
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
// Per-seat player colors (8-bit roster chips)
const PLAYER_HUES = ['#e8c35a', '#4e78b0', '#4e8a56', '#c0392b', '#9e86c0'];
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
      <ShineLogo className="start-logo" />
      <p className="muted">The revolutionary card game where you win by getting a head.</p>
      <div className="fleur-divider" aria-hidden="true"><i /></div>
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
            <span className="seat-av" style={{ '--seat-c': PLAYER_HUES[i % PLAYER_HUES.length] }} aria-hidden="true">
              <span className="seat-av-face" />
              <span className="seat-av-num">P{i + 1}</span>
            </span>
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
      <div className="start-links">
        <a className="hof-link" href="?view=stats">Hall of Fame →</a>
        <a className="hof-link" href="?view=bugs">Bug reports (PIN) →</a>
        <a className="hof-link" href="/tools.html">Pixel Tools →</a>
      </div>
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
              <span className="notice-rank">{place === 0 ? <span className="go-crown" title="winner">★</span> : `${place + 1}`}</span>
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

// The resulting line if `def` were applied with `picks` — but ONLY for cards
// whose outcome is deterministic (no shuffle/random draw), so the preview never
// lies. Returns { line, movedUid } or null. Powers the "Result" strip.
function previewResultLine(G, def, picks = []) {
  if (!def || !G.line.length) return null;
  const { family, params } = def;
  const deterministic =
    family === 'lineMove' ||
    family === 'toFrontEnd' ||
    (family === 'rearrange' && params?.kind === 'reverse') ||
    (family === 'lineAddRemove' && params?.kind === 'removeNoble');
  if (!deterministic) return null;
  let patch;
  try { patch = applyResolved(G, def, picks, {}); } catch { return null; }
  if (!patch || !patch.line) return null;
  const idx = picks[0]?.idx;
  let movedUid = null;
  if (family === 'lineMove' && idx != null) movedUid = G.line[idx]?.uid;
  else if (family === 'toFrontEnd') {
    if (params.op === 'frontToEnd') movedUid = G.line[0]?.uid;
    else if ((params.op === 'anyToFront' || params.op === 'specialToFront') && idx != null) movedUid = G.line[idx]?.uid;
    else if (params.op === 'namedToFront' || params.op === 'nearestColorToFront') movedUid = patch.line[0]?.uid;
  }
  return { line: patch.line, movedUid };
}

// Which nobles in line relate to the one you're hovering (set-scorers, pairs, dupes).
function relatedNobleUids(def, line) {
  if (!line) return null;
  const uids = new Set();
  const add = (pred) => line.forEach(i => { const d = NOBLE_BY_ID[i.defId]; if (d && pred(d)) uids.add(i.uid); });
  if (def.name === 'Count') add(d => d.name === 'Countess');
  else if (def.name === 'Countess') add(d => d.name === 'Count');
  if (def.special === 'palaceGuard') add(d => d.special === 'palaceGuard');
  if (def.color === 'gray') add(d => d.color === 'gray');            // Tragic Figure & the Gray set
  add(d => d.name === def.name);                                      // duplicates of the same noble
  return uids.size ? uids : null;
}
// Which nobles an action card would touch (by faction / special / named target).
function relatedActionUids(def, line) {
  if (!line) return null;
  const p = def.params || {}; const uids = new Set();
  const add = (pred) => line.forEach(i => { const d = NOBLE_BY_ID[i.defId]; if (d && pred(d)) uids.add(i.uid); });
  if (p.color) add(d => d.color === p.color);
  if (p.special) add(d => d.special === p.special);
  if (p.nobleId) add(d => d.id === p.nobleId);
  return uids.size ? uids : null;
}
const nobleInspect = (def, el, gain, line) => ({ img: nobleImg(def.id), name: def.name, faction: def.color, factionName: FACTION[def.color].title, text: def.text, color: COLOR_HEX[def.color], gain, rect: el?.getBoundingClientRect(), affected: relatedNobleUids(def, line) });
const actionInspect = (def, el, line) => ({ img: actionImg(def.id), name: def.name, text: def.text, color: '#b4323d', rect: el?.getBoundingClientRect(), affected: relatedActionUids(def, line) });

// What a noble would be worth to `player` if collected right now — the true
// marginal points (combos included, via computeScore) plus a plain-language note
// about the combo that makes it swing. Powers the hover "+N pts" decision helper.
function nobleGain(player, nobleDef) {
  if (!player) return null;
  const base = computeScore(player).total;
  const after = computeScore({ ...player, scorePile: [...player.scorePile, { uid: '__preview__', defId: nobleDef.id }] }).total;
  const delta = after - base;
  const hold = (fn) => player.scorePile.some(i => fn(NOBLE_BY_ID[i.defId]));
  let note = null;
  if (nobleDef.special === 'count')
    note = hold(n => n.special === 'countess') ? 'Completes your Count + Countess (+2 each)!' : 'Pairs with the Countess for +2 each.';
  else if (nobleDef.special === 'countess')
    note = hold(n => n.special === 'count') ? 'Completes your Count + Countess (+2 each)!' : 'Pairs with the Count for +2 each.';
  else if (nobleDef.special === 'palaceGuard')
    note = 'Palace Guards score +1 for every Guard you hold.';
  else if (nobleDef.special === 'tragicFigure')
    note = 'Loses a point for every common-folk head you hold.';
  else if (nobleDef.special === 'unpopularJudge')
    note = 'While at the front, no one can play actions.';
  return { delta, note };
}

// Simple crown for the current points leader.
const CrownIcon = (p) => <Ico {...p} fill="currentColor" stroke="none" d={<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" />} />;

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

// A collected noble rendered as just its severed PIXEL head (top rows of the sprite).
const _headCache = {};
function headImg(def) {
  const k = spriteSlug(def.name); if (_headCache[k] !== undefined) return _headCache[k];
  const spr = NOBLE_SPRITES[k]; if (!spr) return (_headCache[k] = null);
  let L = 99, R = -1, T = 99, B = -1;
  for (let y = 0; y < 12; y++) for (let x = 0; x < spr.w; x++) if (SPRITE_ALPHA.indexOf(spr.px[y * spr.w + x]) > 0) { if (x < L) L = x; if (x > R) R = x; if (y < T) T = y; if (y > B) B = y; }
  if (R < 0) return (_headCache[k] = null);
  const sc = 4, w = R - L + 1, h = B - T + 1, c = document.createElement('canvas');
  c.width = w * sc; c.height = h * sc; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
  for (let y = T; y <= B; y++) for (let x = L; x <= R; x++) { const i = SPRITE_ALPHA.indexOf(spr.px[y * spr.w + x]); if (i > 0) { cc.fillStyle = spr.pal[i]; cc.fillRect((x - L) * sc, (y - T) * sc, sc, sc); } }
  return (_headCache[k] = c.toDataURL('image/png'));
}
// Each player's collected heads as a little pile of pixel heads.
function HeadPile({ nobles }) {
  if (!nobles.length) return <div className="head-pile empty">No heads yet</div>;
  const show = nobles.slice(-9);
  return (
    <div className="head-pile" title={`${nobles.length} head${nobles.length === 1 ? '' : 's'}`}>
      {show.map((inst) => { const src = headImg(NOBLE_BY_ID[inst.defId]); return src ? <img key={inst.uid} className="hp-head" src={src} alt="" /> : null; })}
      {nobles.length > show.length && <span className="hp-more">+{nobles.length - show.length}</span>}
    </div>
  );
}

// Quick-glance color squares: how many heads of each faction a player holds.
const FACTION_ORDER = ['red', 'blue', 'green', 'purple', 'gray'];
function FactionChips({ nobles }) {
  const by = {};
  nobles.forEach(n => { by[n.color] = (by[n.color] || 0) + 1; });
  const entries = FACTION_ORDER.filter(c => by[c]);
  if (!entries.length) return <div className="fc-row empty">No heads yet</div>;
  return (
    <div className="fc-row">
      {entries.map(c => (
        <span key={c} className="fc-chip" title={`${by[c]} ${COLORS[c] || c} head${by[c] > 1 ? 's' : ''}`}>
          <i className="fc-sw" style={{ background: COLOR_HEX[c] }} />
          <b className="fc-ct">{by[c]}</b>
        </span>
      ))}
    </div>
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

// Total points as a pixel chip.
function HeadScore({ value, gold }) {
  return (
    <span className={'headscore' + (gold ? ' gold' : '')} title={`${value} points`}>
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
  const [confirmNew, setConfirmNew] = useState(false);
  const [turnCue, setTurnCue] = useState(false);
  const [linePreview, setLinePreview] = useState(null);
  const [cardOpen, setCardOpen] = useState(null);   // hand-card index open in the viewer
  const [nobleOpen, setNobleOpen] = useState(null); // line-noble index open in the viewer
  const seen = useRef(0);

  // Points leader (unique leader with >0, else none — don't crown a 0–0 tie).
  const scores = G.players.map(p => computeScore(p).total);
  const maxScore = Math.max(...scores);
  const leaderIdx = (maxScore > 0 && scores.filter(s => s === maxScore).length === 1)
    ? scores.indexOf(maxScore) : -1;

  // Who is viewing (local hotseat: the active seat; online: this client's seat).
  const viewerIdx = game.seat != null ? game.seat : G.current;
  const myTurn = G.phase === 'playing' && !G.cpu?.[G.current] && G.current === viewerIdx;
  // "My" seat for the hand dock — so your hand stays visible between turns. Online
  // it's your seat; local solo it's the sole human; otherwise the active human.
  const curIsMineHuman = !G.cpu?.[G.current] && (game.seat == null || G.current === game.seat);
  const mySeat = game.seat != null ? game.seat
    : (G.cpu.filter((c) => !c).length === 1 ? G.cpu.findIndex((c) => !c) : null);
  const handSeat = curIsMineHuman ? G.current : mySeat;
  const handPlayable = handSeat != null && handSeat === G.current && curIsMineHuman && G.phase === 'playing';
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
    let lastPlay = null;
    const myHeads = [];           // nobles the VIEWER collected this batch → confirmation toast
    let lastCollectKey = 0;
    for (const e of fresh) {
      if (e.kind === 'play' && e.defId) {
        const def = ACTION_BY_ID[e.defId];
        lastPlay = { key: e.id, who: G.players[e.playerIdx]?.name, name: def.name, text: def.text };
        playWhoosh();
        continue;
      }
      if (e.kind !== 'collect') continue;
      // The behead animation (blade, blood, bouncing head → pile) is owned by PlazaScene.
      const mine = game.seat != null ? e.playerIdx === game.seat : !G.cpu?.[e.playerIdx];
      if (mine && e.defId) { myHeads.push(NOBLE_BY_ID[e.defId].name); lastCollectKey = e.id; }
    }
    // Plays take visual priority; otherwise confirm the viewer's own collect.
    if (lastPlay) setCallout(lastPlay);
    else if (myHeads.length) setCallout({ key: lastCollectKey, verb: 'collected', who: 'You', name: myHeads.join(' + ') });
  });

  // auto-clear the callout
  useEffect(() => {
    if (!callout) return;
    const t = setTimeout(() => setCallout(null), 3300);
    return () => clearTimeout(t);
  }, [callout]);

  // Clear the hover result-preview whenever the board moves on.
  useEffect(() => { setLinePreview(null); }, [G.line, G.phase, G.current]);
  // Close the noble viewer when the line changes (indices would shift).
  useEffect(() => { setNobleOpen(null); }, [G.line]);
  // Keep the hand viewer across turns (so you can study), but close it if its
  // index is no longer valid for the hand being shown.
  useEffect(() => {
    if (cardOpen != null && (handSeat == null || cardOpen >= (G.players[handSeat]?.hand.length ?? 0))) setCardOpen(null);
  }, [cardOpen, handSeat, G.players]);

  // Flash a "Your turn" cue when control lands on the viewer (esp. useful online
  // and in hotseat, where it's easy to miss the handoff).
  useEffect(() => {
    if (!myTurn) return;
    setTurnCue(true);
    const t = setTimeout(() => setTurnCue(false), 2100);
    return () => clearTimeout(t);
  }, [myTurn, G.current, G.day]);

  // Keyboard shortcuts (desktop): Space = behead/end turn, 1–5 = play that hand
  // card, U = undo, Esc = cancel targeting / close a pinned preview.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (cardOpen != null || nobleOpen != null) return; // an open viewer owns the keyboard
      const canBehead = G.phase === 'playing' && !G.cpu?.[G.current] && G.current === viewerIdx;
      if (e.key === 'Escape') {
        if (G.phase === 'targeting') { game.cancelTarget(); e.preventDefault(); }
        else { closeInspect(); }
        return;
      }
      if ((e.key === ' ' || e.key === 'Spacebar') && canBehead && G.phase === 'playing') {
        game.collectAndEnd(); e.preventDefault(); return;
      }
      if ((e.key === 'u' || e.key === 'U') && game.canUndo()) { game.undo(); e.preventDefault(); return; }
      // Number keys open that hand card in the viewer (works between turns too).
      if (/^[1-9]$/.test(e.key) && handSeat != null) {
        const hi = Number(e.key) - 1;
        if (hi < G.players[handSeat].hand.length) { setCardOpen(hi); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Plaza scene wiring (replaces the card-token line)
  const vScene = G.players[viewerIdx];
  const plazaHover = (def, rect) => onInspect(def ? nobleInspect(def, { getBoundingClientRect: () => rect }, nobleGain(vScene, def), G.line) : null);
  const plazaClick = (i) => { if (step && (step.type === 'lineNoble' || step.type === 'reorder') && step.candidates?.includes(i)) game.pick({ idx: i }); else setNobleOpen(i); };
  const activeIsMe = game.seat == null || G.current === game.seat;
  const canBehead = G.phase === 'playing' && !targeting && !G.cpu?.[G.current] && activeIsMe;
  const beheadCta = G.line.length === 0 ? 'End turn' : 'Off with their head!';

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

        <div className="plaza-wrap">
          <PlazaScene game={game} onNobleHover={plazaHover} onNobleClick={plazaClick}
            canBehead={canBehead} onBehead={game.collectAndEnd} ctaLabel={beheadCta} />
          {(targeting || game.canUndo()) && (
            <div className="plaza-controls">
              {targeting && <button className="btn small" onClick={game.cancelTarget} title="Cancel (Esc)">Cancel</button>}
              {game.canUndo() && <button className="btn small" onClick={game.undo} title="Undo (U)">↶ Undo</button>}
            </div>
          )}
          {canBehead && <p className="behead-hint">Click the executioner to behead{G.line.length === 0 ? ' / end turn' : ''} <span className="bh-key">Space</span></p>}
        </div>

        <HandDock game={game} seat={handSeat} canPlay={handPlayable} onOpen={setCardOpen} />
      </main>

      <aside className="hud2">
        <div className="hud-top">
          <span className="day-chip">Day {G.day} / 3</span>
          <span className="hud-nav">
            {confirmNew
              ? (<span className="confirm-new">New game?
                  <button className="nav-btn danger" onClick={() => { setConfirmNew(false); game.restart(); }} title="Confirm new game">Yes</button>
                  <button className="nav-btn" onClick={() => setConfirmNew(false)} title="Keep playing">No</button>
                </span>)
              : <button className="nav-btn" onClick={() => setConfirmNew(true)} title="New game">↻</button>}
            <SoundToggle />
          </span>
        </div>
        {G.players.map((p, i) => (
          <PlayerCard key={i} player={p} index={i} game={game} step={step}
            onInspect={onInspect} onExpand={setExpanded} isLeader={i === leaderIdx} />
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
      {cardOpen != null && handSeat != null && cardOpen < (G.players[handSeat]?.hand.length ?? 0) && (
        <HandCardViewer game={game} seat={handSeat} canPlay={handPlayable} index={cardOpen} setIndex={setCardOpen} onClose={() => setCardOpen(null)} />
      )}
      {nobleOpen != null && nobleOpen < G.line.length && (
        <NobleViewer game={game} viewer={G.players[viewerIdx]} step={step} index={nobleOpen} setIndex={setNobleOpen} onClose={() => setNobleOpen(null)} />
      )}
      {callout && <Callout callout={callout} />}
      {turnCue && <div className="turn-cue">Your turn</div>}
      <Coach show={myTurn && G.day === 1} />
      <DayBanner day={G.day} />
    </div>
  );
}

// A one-time first-turn nudge covering the whole interaction loop.
function Coach({ show }) {
  const [done, setDone] = useState(() => { try { return localStorage.getItem('guillotine-coached') === '1'; } catch { return false; } });
  if (done || !show) return null;
  const dismiss = () => { try { localStorage.setItem('guillotine-coached', '1'); } catch { /* ignore */ } setDone(true); };
  return (
    <div className="coach" onClick={dismiss}>
      <div className="coach-card" onClick={(e) => e.stopPropagation()}>
        <p className="coach-title">Your turn — here’s the loop</p>
        <ol className="coach-list">
          <li><b>Tap a hand card</b> (or press <kbd>1</kbd>–<kbd>5</kbd>) to view it big; flip through with <kbd>‹</kbd> <kbd>›</kbd> or <kbd>←</kbd> <kbd>→</kbd>, then <b>Play this card</b> (or <kbd>Space</kbd>). Optional.</li>
          <li><b>Hover a noble</b> in the line to see what it’s worth to you.</li>
          <li><b>Behead</b> the front noble — the big button, or press <kbd>Space</kbd>.</li>
        </ol>
        <button className="btn primary" onClick={dismiss}>Got it</button>
      </div>
    </div>
  );
}

// ─── Corner HUD player card ─────────────────────────────────────────────────
function PlayerCard({ player, index, game, step, onInspect, onExpand, isLeader }) {
  const { G } = game;
  const isCurrent = index === G.current && (G.phase === 'playing' || G.phase === 'targeting');
  const { total, lines } = computeScore(player);
  const breakdown = lines.length
    ? lines.map(l => `${l.label}: ${l.value > 0 ? '+' : ''}${l.value}`).join('\n') + `\n──────\nTotal: ${total}`
    : 'No heads collected yet.';
  const playerTarget = step && step.type === 'player' && step.candidates.includes(index);
  const frontTarget = step && step.type === 'frontCard';

  return (
    <div className={'pcard' + (isCurrent ? ' active' : '') + (playerTarget ? ' selectable' : '') + (isLeader ? ' leader' : '')}
      data-pile={index}
      onClick={() => (playerTarget ? game.pick({ playerIdx: index }) : onExpand(index))}>
      <div className="pc-name-row">
        {isLeader && <CrownIcon className="pc-crown" />}
        <span className="pc-name-full">{player.name}</span>
        {G.cpu?.[index] && <span className="cpu-badge">CPU</span>}
      </div>
      <div className="pc-top">
        <HandStack count={player.hand.length} />
        <span className="pc-score" title={`Score breakdown:\n${breakdown}`}><ScoreDelta value={total} /><HeadScore value={total} gold /></span>
      </div>
      <FactionChips nobles={player.scorePile.map(i => NOBLE_BY_ID[i.defId])} />
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
                  onMouseEnter={(e) => onInspect(actionInspect(def, e.currentTarget, game.G.line))} onMouseLeave={() => onInspect(null)}
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
    <div className={'callout' + (callout.verb === 'collected' ? ' collect' : '')} key={callout.key}>
      <div className="co-who">{callout.who} {callout.verb || 'played'}</div>
      <div className="co-name">{callout.name}</div>
      {callout.text && <div className="co-text">{callout.text}</div>}
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
function GuillotineLine({ game, step, onPick, onInspect, targeting, drop, hint, preview, onPreview, onOpenNoble }) {
  const { G } = game;
  const pendingDef = G.pending ? ACTION_BY_ID[G.pending.defId] : null;
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
  // Whose pile the "+N pts" hover preview is measured against: the viewer's.
  const viewer = G.players[game.seat != null ? game.seat : G.current];
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
              onClick={() => { if (isCand && ordPos < 0) onPick({ idx }); else onOpenNoble?.(idx); }}
              onMouseEnter={(e) => { onInspect(nobleInspect(def, e.currentTarget, nobleGain(viewer, def), G.line));
                if (onPreview && isCand && ordPos < 0 && step?.type === 'lineNoble' && pendingDef) onPreview(previewResultLine(G, pendingDef, [{ idx }])); }}
              onMouseLeave={() => { onInspect(null); if (onPreview) onPreview(null); }}
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
          title={canBehead ? `${cta} (Space)` : 'Wait for your turn'}>
          <Guillotine drop={drop} />
          <span className="guillo-cta">{cta}</span>
        </button>
        <div className="guillo-aux">
          {targeting && <button className="btn small" onClick={game.cancelTarget} title="Cancel (Esc)">Cancel</button>}
          {game.canUndo() && <button className="btn small" onClick={game.undo} title="Undo this turn's actions (U)">↶ Undo</button>}
        </div>
      </div>
      <LinePreviewStrip preview={preview} />
    </div>
  );
}

// Non-interactive "here's the line afterward" strip, shown just under the line
// while hovering a deterministic line-altering card (or a target for one).
function LinePreviewStrip({ preview, inline }) {
  if (!preview) return null;
  const display = preview.line.map((inst, idx) => ({ inst, idx })).reverse();
  return (
    <div className={'line-preview' + (inline ? ' inline' : '')} aria-hidden="true">
      <span className="lp-label">Result</span>
      <div className="lp-row">
        {display.map(({ inst, idx }) => {
          const def = NOBLE_BY_ID[inst.defId];
          return <img key={inst.uid}
            className={'lp-card' + (idx === 0 ? ' front' : '') + (inst.uid === preview.movedUid ? ' moved' : '')}
            src={nobleImg(def.id)} alt="" style={{ borderColor: COLOR_HEX[def.color] }} />;
        })}
        <span className="lp-guillo" title="guillotine (front)">▸</span>
      </div>
    </div>
  );
}

// Pixel guillotine (from the forge sprite); the blade drops on each behead.
const GB_IN = (x, y) => y >= 6 && y <= 11 && x >= 6 && x <= 17;  // blade cells in the 24x32 sprite
function Guillotine({ drop = 0 }) {
  const ref = useRef(null);
  const g = SCENE_SPRITES.guillotine;
  const SG = 7, travel = 10 * SG;
  const paint = (off) => {
    const c = ref.current; if (!c || !g) return;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const pal = g.pal, W = g.w;
    for (let y = 0; y < g.h; y++) for (let x = 0; x < W; x++) {
      if (GB_IN(x, y)) continue;
      const i = SPRITE_ALPHA.indexOf(g.px[y * W + x]);
      if (i > 0) { ctx.fillStyle = pal[i]; ctx.fillRect(x * SG, y * SG, SG, SG); }
    }
    for (let y = 6; y <= 11; y++) for (let x = 6; x <= 17; x++) {
      const i = SPRITE_ALPHA.indexOf(g.px[y * g.w + x]);
      if (i > 0) { ctx.fillStyle = pal[i]; ctx.fillRect(x * SG, y * SG + off, SG, SG); }
    }
  };
  useEffect(() => {
    if (!g) return;
    if (!drop) { paint(0); return; }
    let raf, start = null; const dDur = 300, hold = 160, uDur = 300;
    const step = (t) => {
      if (start === null) start = t; const el = t - start; let off;
      if (el < dDur) off = (el / dDur) * travel;
      else if (el < dDur + hold) off = travel;
      else { const u = Math.min(1, (el - dDur - hold) / uDur); off = travel * (1 - u); }
      paint(off);
      if (el < dDur + hold + uDur) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [drop]);
  if (!g) return <div className="guillo-wrap" />;
  return (
    <div className="guillo-wrap" title="The guillotine — the next head drops here">
      <canvas ref={ref} width={g.w * SG} height={g.h * SG}
        style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
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
// The fanned hand along the bottom. A card is a launcher: tapping it opens the
// card viewer (CardLightbox) — it never plays straight from the fan.
// The fanned hand. `seat` is whose hand to show (yours, even between turns, so
// you can keep studying it); `canPlay` is true only when you may actually play.
function HandDock({ game, seat, canPlay, onOpen }) {
  const { G } = game;
  if (seat == null) return <div className="hand-dock cpu">{G.players[G.current]?.name} is thinking…</div>;
  const hand = G.players[seat].hand;
  const n = hand.length;
  const peeking = !canPlay; // showing my hand while it isn't my turn
  return (
    <div className={'hand-dock' + (peeking ? ' peek' : '')} style={{ '--n': n }}>
      {peeking && <div className="hand-peek-note">{G.cpu?.[G.current] ? `${G.players[G.current]?.name} is thinking…` : `${G.players[G.current]?.name}'s turn`} — your hand</div>}
      {hand.map((inst, hi) => {
        const def = ACTION_BY_ID[inst.defId];
        const playable = canPlay && game.canPlay(hi);
        return (
          <button key={inst.uid} className={'dock-card' + (playable ? ' playable' : (canPlay ? ' dim' : ''))}
            style={{ '--i': hi - (n - 1) / 2 }}
            onClick={() => onOpen(hi)}
            title={`${def.name}\n${def.text}`}>
            <img src={actionImg(def.id)} alt={def.name} loading="lazy" decoding="async" />
          </button>
        );
      })}
    </div>
  );
}

// Touch swipe helper (ported from Long Shot): left/right/up/down, 50px / 700ms.
function useSwipe(onSwipe, { min = 50 } = {}) {
  const start = useRef(null);
  const cb = useRef(onSwipe); cb.current = onSwipe;
  return {
    onTouchStart: (e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, at: Date.now() }; },
    onTouchEnd: (e) => {
      const s = start.current; start.current = null;
      if (!s || Date.now() - s.at > 700) return;
      const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.3) cb.current(dx < 0 ? 'left' : 'right');
      else if (Math.abs(dy) > Math.abs(dx) * 1.3) cb.current(dy < 0 ? 'up' : 'down');
    },
  };
}

// Shared full-screen one-at-a-time viewer. Cycle with ‹ › arrows, ←/→ keys, or a
// swipe (left=next, right=prev, down=close); Space/Enter triggers the bar's
// primary (.lb-play) button. Mirrors Long Shot's lightbox.
function Lightbox({ count, index, setIndex, onClose, cardKey, card, bar }) {
  const n = count;
  const prev = () => setIndex((index - 1 + n) % n);
  const next = () => setIndex((index + 1) % n);
  const swipe = useSwipe((d) => { if (d === 'left') next(); else if (d === 'right') prev(); else if (d === 'down') onClose(); });
  useEffect(() => {
    const key = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea')) return;
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === ' ' || e.key === 'Enter') {
        if (e.key === 'Enter' && e.target.closest?.('button')) return;
        const b = document.querySelector('.lightbox .lb-bar button.lb-play:not(:disabled)');
        if (b) { e.preventDefault(); document.activeElement?.blur?.(); b.click(); }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }); // re-register each render so the index closure stays fresh
  return (
    <div className="lightbox card-lb" onClick={onClose} {...swipe}>
      <div className="lb-inner" onClick={(e) => e.stopPropagation()}>
        {n > 1 && <button className="lb-arrow" onClick={prev} aria-label="Previous">‹</button>}
        <div className="lb-card" key={cardKey}>{card}</div>
        {n > 1 && <button className="lb-arrow" onClick={next} aria-label="Next">›</button>}
      </div>
      <div className="lb-bar" onClick={(e) => e.stopPropagation()}>
        {bar}
        <div className="lb-nav">
          <button className="btn" onClick={onClose}>Close</button>
          <span className="lb-count">{index + 1} / {n}</span>
        </div>
      </div>
    </div>
  );
}

// The hand card viewer. `canPlay` gates whether Play is offered (false while
// peeking between turns — you can still flip through and read).
function HandCardViewer({ game, seat, canPlay, index, setIndex, onClose }) {
  const { G } = game;
  const hand = G.players[seat]?.hand ?? [];
  const inst = hand[index];
  if (!inst) return null;
  const def = ACTION_BY_ID[inst.defId];
  const canPlayNow = canPlay && game.canPlay(index);
  const blocked = canPlay && !canPlayNow ? playBlockReason(G, def) : null;
  const result = canPlayNow && !getStep(def, G, []) ? previewResultLine(G, def, []) : null;
  const play = () => { onClose(); game.playCard(index); };
  const bar = (
    <>
      <div className="lb-name">{def.name}</div>
      <div className="lb-text">{def.text}</div>
      {result && <LinePreviewStrip preview={result} inline />}
      {canPlayNow
        ? <button className="btn primary lb-play" onClick={play}>Play this card ▸</button>
        : <div className="lb-info">{blocked || `It’s ${G.players[G.current]?.name}’s turn — play on yours.`}</div>}
    </>
  );
  return <Lightbox count={hand.length} index={index} setIndex={setIndex} onClose={onClose}
    cardKey={inst.uid} card={<img src={actionImg(def.id)} alt={def.name} />} bar={bar} />;
}

// The line-noble viewer — same cycler, showing each noble big with what it's
// worth to the viewer. During targeting a legal pick gets a "Choose" button.
function NobleViewer({ game, viewer, step, index, setIndex, onClose }) {
  const { G } = game;
  const inst = G.line[index];
  if (!inst) return null;
  const def = NOBLE_BY_ID[inst.defId];
  const gain = nobleGain(viewer, def);
  const canPick = step && step.type === 'lineNoble' && step.candidates.includes(index);
  const pick = () => { onClose(); game.pick({ idx: index }); };
  const bar = (
    <>
      <div className="lb-name">{def.name}</div>
      <div className="lb-faction">{FACTION[def.color].title}{index === 0 ? ' · at the guillotine (next)' : ''}</div>
      <div className="lb-text">{def.text}</div>
      {gain && (
        <div className={'hc-gain' + (gain.delta < 0 ? ' neg' : gain.delta > 0 ? ' pos' : '')}>
          <span className="hc-gain-val">{gain.delta >= 0 ? '+' : ''}{gain.delta} pts</span>
          <span className="hc-gain-sub"> if you collect it</span>
          {gain.note && <div className="hc-gain-note">{gain.note}</div>}
        </div>
      )}
      {canPick && <button className="btn primary lb-play" onClick={pick}>Choose this noble ▸</button>}
    </>
  );
  return <Lightbox count={G.line.length} index={index} setIndex={setIndex} onClose={onClose}
    cardKey={inst.uid}
    card={<img src={nobleImg(def.id)} alt={def.name} style={{ border: `3px solid ${COLOR_HEX[def.color]}` }} />} bar={bar} />;
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
              onMouseEnter={(e) => onInspect(nobleInspect(def, e.currentTarget, null, G.line))} onMouseLeave={() => onInspect(null)}
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
  const { img, name, faction, factionName, text, color, onPlay, pinned, gain, blocked } = inspect;
  const sign = gain && gain.delta >= 0 ? '+' : '';
  return (
    <>
      {pinned && <div className="hovercard-backdrop" onClick={onClose} />}
      <div className={'hovercard center' + (pinned ? ' pinned' : '')}
        onMouseEnter={onKeep} onMouseMove={onKeep} onMouseLeave={onLeave}>
        <div className="hc-imgwrap">
          <img className="hc-img" src={img} alt={name} style={{ borderColor: color }} />
          {faction && <span className="hc-emblem" title={factionName} style={{ display: 'inline-block', width: 12, height: 12, background: COLOR_HEX[faction], borderRadius: 2, verticalAlign: 'middle' }} />}
        </div>
        <div className="hc-name">{name}</div>
        {factionName && faction && <div className="hc-faction">{factionName}</div>}
        {text && <div className="hc-text">{text}</div>}
        {gain && (
          <div className={'hc-gain' + (gain.delta < 0 ? ' neg' : gain.delta > 0 ? ' pos' : '')}>
            <span className="hc-gain-val">{sign}{gain.delta} pts</span>
            <span className="hc-gain-sub"> if you collect it</span>
            {gain.note && <div className="hc-gain-note">{gain.note}</div>}
          </div>
        )}
        {blocked && <div className="hc-blocked">Can’t play now: {blocked}</div>}
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
      <ShineLogo className="start-logo" />
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
    const t = setTimeout(() => { if (G.actionPlayed) game.collectAndEnd(); else game.cpuPlay(); }, Math.round(1900 / speed));
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

const TRACK_LIST = [
  { src: '/music/marseillaise.mp3', name: 'La Marseillaise (8-bit)' },
  { src: '/music/one-day-more-8bit.mp3', name: 'One Day More (8-bit)' },
  { src: '/music/do-you-hear-8bit.mp3', name: 'Do You Hear the People Sing (8-bit)' },
  { src: '/music/clair-de-lune.mp3', name: 'Clair de Lune — Debussy (8-bit)' },
  { src: '/music/moonlight-3rd.mp3', name: 'Moonlight Sonata III — Beethoven (8-bit)' },
  { src: '/music/rondo-alla-turca.mp3', name: 'Rondo Alla Turca — Mozart (8-bit)' },
  { src: '/music/chopin-ballades.mp3', name: '4 Ballades — Chopin (8-bit)' },
  { src: '/music/jimmy-cueball.mp3', name: "Jimmy White's Cueball (GBC)" },
  { src: '/music/std-rainbow.mp3', name: 'Over the Rainbow (SNES Jazz)' },
  { src: '/music/std-infant-eyes.mp3', name: 'Infant Eyes (SNES Jazz)' },
  { src: '/music/std-ipanema.mp3', name: 'Girl From Ipanema (SNES Jazz)' },
  { src: '/music/std-miss-jones.mp3', name: 'Have You Met Miss Jones? (SNES Jazz)' },
  { src: '/music/std-one-only-love.mp3', name: 'My One And Only Love (SNES Jazz)' },
  { src: '/music/std-poinciana.mp3', name: 'Poinciana (SNES Jazz)' },
  { src: '/music/std-favorite-things.mp3', name: 'My Favorite Things (SNES Jazz)' },
  { src: '/music/std-never-in-love.mp3', name: 'Never Been in Love Before (SNES Jazz)' },
  { src: '/music/std-green-dolphin.mp3', name: 'On Green Dolphin Street (SNES Jazz)' },
  { src: '/music/std-humpty.mp3', name: 'Humpty Dumpty (SNES Jazz)' },
  { src: '/music/std-rainbow-connection.mp3', name: 'Rainbow Connection (SNES Jazz)' },
  { src: '/music/std-just-the-way.mp3', name: 'Just the Way You Are (SNES Jazz)' },
];
// Shuffle once per load so the rotation varies between sessions.
const TRACKS = (() => {
  const a = [...TRACK_LIST];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
})();

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
          <p className="muted small">Watch for combos: Count + Countess, stacking Palace Guards, and negative "good-guy" nobles (Hero, Tragic Figure). Tap any card to see it big and flip through the rest.</p>
          <p className="help-factions"><b>Keyboard</b></p>
          <dl className="help-keys">
            <dt><kbd>1</kbd>–<kbd>9</kbd></dt><dd>open that hand card</dd>
            <dt><kbd>‹</kbd> <kbd>›</kbd> / <kbd>←</kbd> <kbd>→</kbd></dt><dd>flip through cards in a viewer</dd>
            <dt><kbd>Space</kbd></dt><dd>play the open card, or behead the front noble</dd>
            <dt><kbd>U</kbd></dt><dd>undo this turn’s actions</dd>
            <dt><kbd>Esc</kbd></dt><dd>close a viewer / cancel targeting</dd>
          </dl>
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
