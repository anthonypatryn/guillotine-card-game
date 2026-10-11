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
import { playBehead, isMuted, toggleMuted } from './sound';

export default function App() {
  const game = useGame();
  const { G } = game;

  // No handoff screen for now — advance straight into the next turn.
  useEffect(() => {
    if (G.phase === 'pass') {
      const t = setTimeout(() => game.advanceFromPass(), 0);
      return () => clearTimeout(t);
    }
  }, [G.phase, G.current, G.day]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drive computer players.
  useEffect(() => {
    if (G.phase !== 'playing' || !G.cpu?.[G.current]) return;
    const t = setTimeout(() => game.cpuTurn(), 850);
    return () => clearTimeout(t);
  }, [G.phase, G.current, G.day]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <header className="topbar">
        <h1>Guillotine</h1>
        <span className="tagline">win by getting a head</span>
        <MusicPlayer />
      </header>
      {G.phase === 'start' && <StartScreen onStart={game.start} />}
      {G.phase === 'gameOver' && <GameOver G={G} onRestart={game.restart} />}
      {(G.phase === 'playing' || G.phase === 'targeting' || G.phase === 'pass') && <Board game={game} />}
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
      <h2>Guillotine</h2>
      <p className="muted">Most heads after 3 days wins.</p>
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
  const scored = G.players.map(p => ({ name: p.name, total: computeScore(p).total }));
  const max = Math.max(...scored.map(s => s.total));
  const winners = scored.filter(s => s.total === max).map(s => s.name);
  return (
    <div className="screen center">
      <h2>Game Over</h2>
      <div className="final-scores">
        {[...scored].sort((a, b) => b.total - a.total).map(s => (
          <div key={s.name} className={'final-row' + (s.total === max ? ' win' : '')}>
            <span>{s.name}</span><span>{s.total}</span>
          </div>
        ))}
      </div>
      <h3>{winners.length > 1 ? `Tie: ${winners.join(' & ')}` : `${winners[0]} wins!`}</h3>
      <button className="btn primary" onClick={onRestart}>Play Again</button>
    </div>
  );
}

const nobleInspect = (def) => ({ img: nobleImg(def.id), name: def.name, sub: COLORS[def.color], text: def.text, color: COLOR_HEX[def.color] });
const actionInspect = (def) => ({ img: actionImg(def.id), name: def.name, sub: 'Action card', text: def.text, color: '#7a5c3a' });

function Board({ game }) {
  const { G } = game;
  const targeting = G.phase === 'targeting';
  const step = game.step();
  const [inspect, setInspect] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [fliers, setFliers] = useState([]);
  const [splats, setSplats] = useState([]);
  const seen = useRef(0);
  const lineRects = useRef({});

  // Diff new log entries → a slice + blood splatter for each beheading.
  useLayoutEffect(() => {
    const fresh = G.log.filter(l => l.id > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(seen.current, ...fresh.map(l => l.id));
    const nf = [], ns = [];
    for (const e of fresh) {
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
  });

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

      <main className="field">
        <div className="field-msg">
          <span className="message">{G.message}</span>
          <span className="deck-counts">Nobles {G.nobleDeck.length} · Actions {G.actionDeck.length}</span>
        </div>
        {locks.length > 0 && <div className="locks">{locks.map((l, i) => <span key={i} className="lock-chip">{l}</span>)}</div>}

        <GuillotineLine G={G} step={step} onPick={game.pick} onInspect={setInspect} />

        <div className="controls">
          {!targeting && (
            <button className="btn primary" onClick={game.collectAndEnd}>
              {G.line.length === 0 ? 'End turn →' : 'Collect head →'}
            </button>
          )}
          {targeting && <button className="btn" onClick={game.cancelTarget}>Cancel</button>}
        </div>

        <HandDock game={game} onInspect={setInspect} />
      </main>

      <InspectorPane inspect={inspect} />

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
        <span className="pc-score"><ScoreDelta value={total} />{total}</span>
      </div>
      <div className="pc-stats">
        <span title="cards in hand">🖐 {player.hand.length}</span>
        <span title="heads collected">🗡 {player.scorePile.length}</span>
        <span className="pc-tally">
          {colors.length === 0 ? <span className="muted small">no heads</span>
            : colors.map(c => <span key={c} className="pip" style={{ background: COLOR_HEX[c] }} title={COLORS[c]}>{tally[c]}</span>)}
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
                  onMouseEnter={() => onInspect(actionInspect(def))} onMouseLeave={() => onInspect(null)}
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
              onMouseEnter={() => onInspect(nobleInspect(def))}
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

function Guillotine() {
  return (
    <div className="guillo-wrap" title="The guillotine — next head drops here">
      <svg className="guillo" viewBox="0 0 96 150" aria-label="guillotine">
        <rect x="6" y="90" width="84" height="56" rx="3" fill="#5f5147" />
        <line x1="48" y1="90" x2="48" y2="146" stroke="#4a3f36" strokeWidth="1.5" />
        <rect x="6" y="90" width="84" height="56" rx="3" fill="none" stroke="#3d342c" strokeWidth="2" />
        <rect x="12" y="6" width="14" height="128" rx="2" fill="#8d9398" stroke="#5c6165" strokeWidth="1.5" />
        <rect x="70" y="6" width="14" height="128" rx="2" fill="#8d9398" stroke="#5c6165" strokeWidth="1.5" />
        <rect x="8" y="2" width="80" height="16" rx="2" fill="#6c7175" stroke="#4e5256" strokeWidth="1.5" />
        <rect x="30" y="20" width="36" height="16" fill="#9aa0a4" stroke="#6e7377" />
        <polygon points="30,36 66,36 58,47 38,47" fill="#d2d6d9" stroke="#aeb3b6" />
        <circle cx="48" cy="72" r="13" fill="#241a14" />
        <path d="M35 72 a13 13 0 0 1 26 0" fill="none" stroke="#c6a765" strokeWidth="3" />
        <path d="M35 72 a13 13 0 0 0 26 0" fill="none" stroke="#9c7d3e" strokeWidth="3" />
        <circle cx="20" cy="44" r="3" fill="#7a3b1e" opacity=".5" />
        <circle cx="78" cy="104" r="4" fill="#7a3b1e" opacity=".4" />
        <circle cx="30" cy="120" r="2.5" fill="#7a3b1e" opacity=".4" />
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
            onMouseEnter={() => onInspect(actionInspect(def))} onMouseLeave={() => onInspect(null)}
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
              onMouseEnter={() => onInspect(nobleInspect(def))} onMouseLeave={() => onInspect(null)}
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

function InspectorPane({ inspect }) {
  return (
    <div className={'inspector' + (inspect ? ' show' : '')}>
      {inspect ? (
        <>
          <img className="inspect-img" src={inspect.img} alt={inspect.name} style={{ borderColor: inspect.color }} />
          <div className="inspect-name">{inspect.name}</div>
          <div className="inspect-sub" style={{ color: inspect.color }}>{inspect.sub}</div>
          {inspect.text && <div className="inspect-text">{inspect.text}</div>}
        </>
      ) : <div className="inspect-hint">Hover a card to see it big.</div>}
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
