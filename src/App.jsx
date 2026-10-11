import { useState, useRef, useEffect } from 'react';
import './App.css';
import { useGame } from './hooks/useGame';
import {
  NOBLE_BY_ID, ACTION_BY_ID, COLOR_HEX, COLORS,
  nobleImg, actionImg, ACTION_BACK,
} from './data/cards';
import { computeScore } from './utils/scoring';
import { judgeBlocks, callousActive } from './utils/effects';

export default function App() {
  const game = useGame();
  const { G } = game;
  return (
    <div className="app">
      <header className="topbar">
        <h1>Guillotine</h1>
        <span className="tagline">win by getting a head</span>
      </header>
      {G.phase === 'start' && <StartScreen onStart={game.start} />}
      {G.phase === 'pass' && <PassScreen G={G} onContinue={game.advanceFromPass} />}
      {G.phase === 'gameOver' && <GameOver G={G} onRestart={game.restart} />}
      {(G.phase === 'playing' || G.phase === 'targeting') && <Board game={game} />}
    </div>
  );
}

function StartScreen({ onStart }) {
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3']);
  return (
    <div className="screen center">
      <h2>3-Player Hotseat</h2>
      <p className="muted">Pass the device between turns. Most heads after 3 days wins.</p>
      <div className="name-inputs">
        {names.map((n, i) => (
          <input key={i} value={n}
            onChange={e => setNames(names.map((v, j) => j === i ? e.target.value : v))} />
        ))}
      </div>
      <button className="btn primary" onClick={() => onStart(names)}>Start Game</button>
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
    </div>
  );
}

function LineArea({ G, step, onPick, onInspect }) {
  const scrollRef = useRef(null);
  const reorder = step && step.type === 'reorder';
  const lineTarget = step && (step.type === 'lineNoble' || step.type === 'reorder');
  const order = reorder ? G.pending.order : [];
  // back of line on the left, front (next to collect) on the right by the guillotine
  const display = G.line.map((inst, idx) => ({ inst, idx })).reverse();

  // Keep the front of the line (and guillotine) in view.
  useEffect(() => {
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
        <span className="pname">{player.name}{isCurrent ? ' ◄' : ''}</span>
        <span className="pscore" onClick={(e) => { e.stopPropagation(); setShowBreakdown(v => !v); }}>
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

      <div className="pile">
        {player.scorePile.length === 0 && <span className="muted small">no heads yet</span>}
        {player.scorePile.map((inst, pi) => {
          const def = NOBLE_BY_ID[inst.defId];
          const clickable = pileTarget && step.candidates.includes(pi);
          return <img key={inst.uid}
            className={'thumb noble' + (clickable ? ' clickable' : '')}
            style={{ borderColor: COLOR_HEX[def.color] }}
            src={nobleImg(def.id)} alt={def.name} title={`${def.name} (${COLORS[def.color]})`}
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
        {recent.map((line, i) => (
          <div key={log.length - i} className={'log-line' + (i === 0 ? ' newest' : '')}>{line}</div>
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
