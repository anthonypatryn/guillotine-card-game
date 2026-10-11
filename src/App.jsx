import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import './App.css';
import { useGame } from './hooks/useGame';
import {
  NOBLE_BY_ID, ACTION_BY_ID, COLOR_HEX, COLORS,
  nobleImg, actionImg, ACTION_BACK,
} from './data/cards';
import { computeScore } from './utils/scoring';
import { judgeBlocks, callousActive } from './utils/effects';
import { SliceFlier, BloodSplatter, SlicedThumb, ScoreDelta, DayBanner } from './Effects';

export default function App() {
  const game = useGame();
  const { G } = game;

  // No handoff screen for now — advance straight into the next turn (keeps the
  // board mounted across turns so the day banner doesn't replay each turn).
  useEffect(() => {
    if (G.phase === 'pass') {
      const t = setTimeout(() => game.advanceFromPass(), 0);
      return () => clearTimeout(t);
    }
  }, [G.phase, G.current, G.day]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drive computer players: when it's a CPU's turn, take it after a beat.
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
      </header>
      {G.phase === 'start' && <StartScreen onStart={game.start} />}
      {G.phase === 'gameOver' && <GameOver G={G} onRestart={game.restart} />}
      {(G.phase === 'playing' || G.phase === 'targeting' || G.phase === 'pass') && <Board game={game} />}
    </div>
  );
}

const MODES = {
  solo:    { label: 'Solo — you + 2 CPU',   cpu: [false, true, true],  names: ['You', 'CPU 1', 'CPU 2'] },
  duo:     { label: '2 Players + 1 CPU',    cpu: [false, false, true], names: ['Player 1', 'Player 2', 'CPU'] },
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
          <button key={k} className={'mode-btn' + (mode === k ? ' on' : '')} onClick={() => pickMode(k)}>
            {m.label}
          </button>
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

function PassScreen({ G, onContinue }) {
  const name = G.players[G.current].name;
  return (
    <div className="screen center">
      <div className="day-chip">Day {G.day} / 3</div>
      <h2>Pass to {name}</h2>
      <p className="muted">Everyone else, look away.</p>
      <button className="btn primary" onClick={onContinue}>{name}, I'm ready</button>
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
  const [fliers, setFliers] = useState([]);
  const [splats, setSplats] = useState([]);
  const seen = useRef(0);
  const lineRects = useRef({});

  // Diff new log entries → spawn a slice + blood splatter for each beheading.
  // Declared BEFORE the capture effect so it reads the PREVIOUS render's rects
  // (the collected card is already gone from the DOM this render).
  useLayoutEffect(() => {
    const fresh = G.log.filter(l => l.id > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(seen.current, ...fresh.map(l => l.id));
    const newFliers = [], newSplats = [];
    for (const e of fresh) {
      if (e.kind !== 'collect') continue;
      const from = lineRects.current[String(e.uid)];
      const pile = document.querySelector(`[data-pile="${e.playerIdx}"]`);
      if (!from || !pile) continue;
      const p = pile.getBoundingClientRect();
      const fromPt = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
      newFliers.push({ key: e.id, uid: e.uid, defId: e.defId, from: fromPt,
        to: { x: p.left + 28, y: p.top + 34 } });
      newSplats.push({ key: e.id, x: fromPt.x + (Math.random() * 120 - 60),
        y: fromPt.y + (Math.random() * 90 - 30), scale: 0.9 + Math.random() * 0.7 });
    }
    if (newFliers.length) setFliers(f => [...f, ...newFliers]);
    if (newSplats.length) setSplats(s => [...s, ...newSplats]);
  });

  // Capture current line-card screen positions every render.
  useLayoutEffect(() => {
    const map = {};
    document.querySelectorAll('.noble-card[data-line-uid]').forEach(el => {
      map[el.getAttribute('data-line-uid')] = el.getBoundingClientRect();
    });
    lineRects.current = map;
  });

  const locks = [];
  if (judgeBlocks(G)) locks.push('⚖ Unpopular Judge at the front — no action cards this turn.');
  else {
    if (G.actionBlocked) locks.push('💨 Rushed — no action this turn, just collect.');
    if (callousActive(G)) locks.push('🛡 Callous Guards — line-altering cards are locked.');
  }

  return (
    <div className="board">
      <div className="board-main">
        <div className="hud">
          <span className="day-chip">Day {G.day} / 3</span>
          <span className="message">{G.message}</span>
          <span className="deck-counts">Nobles {G.nobleDeck.length} · Actions {G.actionDeck.length}</span>
        </div>

        {locks.length > 0 && (
          <div className="locks">{locks.map((l, i) => <span key={i} className="lock-chip">{l}</span>)}</div>
        )}

        <LineArea G={G} step={step} onPick={game.pick} onInspect={setInspect} />

        <div className="controls">
          {!targeting && (
            <button className="btn primary" onClick={game.collectAndEnd}>
              {G.line.length === 0 ? 'End turn →' : 'Collect front noble →'}
            </button>
          )}
          {targeting && <button className="btn" onClick={game.cancelTarget}>Cancel</button>}
        </div>

        <div className="players">
          {G.players.map((p, i) => (
            <PlayerPanel key={i} player={p} index={i} game={game} step={step} onInspect={setInspect} />
          ))}
        </div>

        <LogPanel log={G.log} />
      </div>

      <InspectorPane inspect={inspect} />

      {step && step.type === 'noblePick' &&
        <PickModal title={G.message} cancel={game.cancelTarget}
          cards={step.options.map(o => ({ key: o.uid, img: nobleImg(NOBLE_BY_ID[o.defId].id),
            name: NOBLE_BY_ID[o.defId].name, color: NOBLE_BY_ID[o.defId].color,
            onClick: () => game.pick({ uid: o.uid }) }))} />}

      {step && step.type === 'actionDiscardPick' &&
        <PickModal title={G.message} cancel={game.cancelTarget}
          cards={step.candidates.map(idx => {
            const inst = G.actionDiscard[idx]; const def = ACTION_BY_ID[inst.defId];
            return { key: inst.uid, img: actionImg(def.id), name: def.name,
              onClick: () => game.pick({ idx }) };
          })} />}

      <div className="fx-layer">
        {splats.map(s => <BloodSplatter key={s.key} splat={s}
          onDone={() => setSplats(x => x.filter(y => y.key !== s.key))} />)}
        {fliers.map(f => <SliceFlier key={f.key} flier={f}
          onDone={() => setFliers(x => x.filter(y => y.key !== f.key))} />)}
      </div>
      <DayBanner day={G.day} />
    </div>
  );
}

function LineArea({ G, step, onPick, onInspect }) {
  const scrollRef = useRef(null);
  const cardEls = useRef(new Map());
  const prevOffsets = useRef(new Map());
  const reorder = step && step.type === 'reorder';
  const lineTarget = step && (step.type === 'lineNoble' || step.type === 'reorder');
  const order = reorder ? G.pending.order : [];
  // back of line on the left, front (next to collect) on the right by the guillotine
  const display = G.line.map((inst, idx) => ({ inst, idx })).reverse();

  // FLIP: animate cards sliding to their new slots when the line reorders.
  useLayoutEffect(() => {
    const next = new Map();
    cardEls.current.forEach((el, uid) => { if (el) next.set(uid, { l: el.offsetLeft, t: el.offsetTop }); });
    next.forEach((pos, uid) => {
      const prev = prevOffsets.current.get(uid);
      const el = cardEls.current.get(uid);
      if (!prev || !el) return;
      const dx = prev.l - pos.l, dy = prev.t - pos.t;
      if (dx || dy) el.animate(
        [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }],
        { duration: 340, easing: 'cubic-bezier(.45,0,.35,1)' });
    });
    prevOffsets.current = next;
  }, [G.line]);

  // Keep the front of the line in view — but not while targeting (a candidate
  // near the back must stay reachable; don't yank the scroll out from under it).
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
              className={'noble-card' + (idx === 0 ? ' front' : '') + (isCand && ordPos < 0 ? ' candidate' : '')}
              style={{ borderColor: COLOR_HEX[def.color] }}
              onClick={() => isCand && ordPos < 0 && onPick({ idx })}
              onMouseEnter={() => onInspect(nobleInspect(def))}
              onMouseLeave={() => onInspect(null)}
              title={`${def.name} — ${COLORS[def.color]}${def.text ? `\n${def.text}` : ''}`}>
              <img src={nobleImg(def.id)} alt={def.name} />
              {idx === 0 && ordPos < 0 && <span className="front-tag">NEXT ▶</span>}
              {ordPos >= 0 && <span className="order-tag">{ordPos + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="guillotine" title="The guillotine — front of the line">
        <div className="g-frame"><div className="g-blade" /></div>
        <span>GUILLOTINE</span>
      </div>
    </div>
  );
}

function PlayerPanel({ player, index, game, step, onInspect }) {
  const { G } = game;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const isCurrent = index === G.current && (G.phase === 'playing' || G.phase === 'targeting');
  const { total, lines } = computeScore(player);

  const playerTarget = step && step.type === 'player' && step.candidates.includes(index);
  const pileTarget = step && step.type === 'pileNoble' && step.playerIdx === index;
  const handTarget = step && step.type === 'handCard' && step.playerIdx === index;
  const frontTarget = step && step.type === 'frontCard';
  const frontHere = frontTarget ? step.candidates.filter(c => c.playerIdx === index) : [];

  return (
    <div className={'player-panel' + (isCurrent ? ' active' : '') + (playerTarget ? ' selectable' : '')}
      onClick={playerTarget ? () => game.pick({ playerIdx: index }) : undefined}>
      <div className="panel-head">
        <span className="pname">{player.name}{G.cpu?.[index] ? ' 🤖' : ''}{isCurrent ? ' ◄' : ''}</span>
        <span className="pscore" onClick={(e) => { e.stopPropagation(); setShowBreakdown(v => !v); }}>
          <ScoreDelta value={total} />
          {total} pts ▾
          {showBreakdown && (
            <div className="breakdown" onClick={e => e.stopPropagation()}>
              {lines.length === 0 && <div className="muted small">no points yet</div>}
              {lines.map((l, i) => (
                <div key={i} className="bd-row"><span>{l.label}</span><span>{l.value > 0 ? `+${l.value}` : l.value}</span></div>
              ))}
              <div className="bd-row total"><span>Total</span><span>{total}</span></div>
            </div>
          )}
        </span>
      </div>

      <div className="pile" data-pile={index}>
        {player.scorePile.length === 0 && <span className="muted small">no heads yet</span>}
        {player.scorePile.map((inst, pi) => {
          const def = NOBLE_BY_ID[inst.defId];
          const clickable = pileTarget && step.candidates.includes(pi);
          return <SlicedThumb key={inst.uid} defId={inst.defId} uid={inst.uid}
            className={'thumb noble' + (clickable ? ' clickable' : '')}
            title={`${def.name} (${COLORS[def.color]})`}
            onMouseEnter={() => onInspect(nobleInspect(def))} onMouseLeave={() => onInspect(null)}
            onClick={clickable ? (e) => { e.stopPropagation(); game.pick({ idx: pi }); } : undefined} />;
        })}
      </div>

      {player.frontCards.length > 0 && (
        <div className="fronts">
          {player.frontCards.map(inst => {
            const def = ACTION_BY_ID[inst.defId];
            const clickable = frontHere.some(c => c.cardUid === inst.uid);
            const canDiscard = isCurrent && G.phase === 'playing' && def.params?.kind === 'callousGuards';
            return (
              <span key={inst.uid} className="front-wrap">
                <img className={'thumb action' + (clickable ? ' clickable' : '')} src={actionImg(def.id)}
                  alt={def.name} title={`${def.name}\n${def.text}`}
                  onMouseEnter={() => onInspect(actionInspect(def))} onMouseLeave={() => onInspect(null)}
                  onClick={clickable ? (e) => { e.stopPropagation(); game.pick({ playerIdx: index, cardUid: inst.uid }); } : undefined} />
                {canDiscard && <button className="discard-x" title="Discard Callous Guards"
                  onClick={(e) => { e.stopPropagation(); game.discardFront(inst.uid); }}>✕</button>}
              </span>
            );
          })}
        </div>
      )}

      <div className="hand">
        {isCurrent
          ? player.hand.map((inst, hi) => <HandCard key={inst.uid} inst={inst} handIdx={hi} game={game} onInspect={onInspect} />)
          : handTarget
            ? player.hand.map((inst, hi) => {
                const def = ACTION_BY_ID[inst.defId];
                return <button key={inst.uid} className="hand-card small clickable"
                  onClick={(e) => { e.stopPropagation(); game.pick({ idx: hi }); }}
                  onMouseEnter={() => onInspect(actionInspect(def))} onMouseLeave={() => onInspect(null)}
                  title={`${def.name}\n${def.text}`}>
                  <img src={actionImg(def.id)} alt={def.name} />
                </button>;
              })
            : <div className="hidden-hand">
                {player.hand.map(inst => <img key={inst.uid} className="thumb back" src={ACTION_BACK} alt="card" />)}
              </div>}
      </div>
    </div>
  );
}

function HandCard({ inst, handIdx, game, onInspect }) {
  const { G } = game;
  const def = ACTION_BY_ID[inst.defId];
  const playable = game.canPlay(handIdx);
  const selected = G.selectedIdx === handIdx;
  return (
    <button className={'hand-card' + (selected ? ' selected' : '') + (playable ? '' : ' locked')}
      onClick={() => playable && game.playCard(handIdx)}
      onMouseEnter={() => onInspect(actionInspect(def))} onMouseLeave={() => onInspect(null)}
      title={`${def.name}\n${def.text}`}>
      <img src={actionImg(def.id)} alt={def.name} />
    </button>
  );
}

function InspectorPane({ inspect }) {
  return (
    <div className={'inspector' + (inspect ? ' show' : '')}>
      {inspect ? (
        <>
          <img className="inspect-img" src={inspect.img} alt={inspect.name}
            style={{ borderColor: inspect.color }} />
          <div className="inspect-name">{inspect.name}</div>
          <div className="inspect-sub" style={{ color: inspect.color }}>{inspect.sub}</div>
          {inspect.text && <div className="inspect-text">{inspect.text}</div>}
        </>
      ) : (
        <div className="inspect-hint">Hover a card to inspect it.</div>
      )}
    </div>
  );
}

function LogPanel({ log }) {
  const recent = log.slice(-12).reverse();
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
