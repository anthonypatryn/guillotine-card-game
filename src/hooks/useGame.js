import { useState, useCallback } from 'react';
import {
  buildNobleDeck, buildActionDeck, shuffle,
  NOBLE_BY_ID, ACTION_BY_ID,
} from '../data/cards';
import { computeScore } from '../utils/scoring';
import { getStep, applyResolved, canPlayCard, lineNobleCandidates } from '../utils/effects';
import { moveNoble } from '../utils/line';

const NUM_PLAYERS = 3;
const NOBLES_PER_DAY = 12;
const START_HAND = 5;
const TOTAL_DAYS = 3;

function draw(deck, disc, n) {
  deck = [...deck]; disc = [...disc];
  const drawn = [];
  for (let i = 0; i < n; i++) {
    if (!deck.length) { if (!disc.length) break; deck = shuffle(disc); disc = []; }
    drawn.push(deck.pop());
  }
  return { drawn, deck, disc };
}

const blankPlayer = name => ({ name, hand: [], scorePile: [], frontCards: [] });
const freshFlags = () => ({ extraCollect: 0, extraAction: false, bonusDraws: 0, skipCollect: false });

function fresh() {
  return {
    phase: 'start',     // start | pass | playing | targeting | gameOver
    players: [blankPlayer('Player 1'), blankPlayer('Player 2'), blankPlayer('Player 3')],
    current: 0,
    firstPlayer: 0,
    day: 1,
    cpu: [false, false, false],   // which seats are computer-controlled
    line: [],
    nobleDeck: [], nobleDiscard: [],
    actionDeck: [], actionDiscard: [],
    selectedIdx: null,
    actionPlayed: false,
    actionBlocked: false,          // Rush Job: can't play actions this turn
    skipAction: [false, false, false], // Rush Job set for a future turn
    confusion: [false, false, false], // Confusion in Line: scramble before next collect
    pending: null,      // { defId, cardUid, picks:[], order:[] }
    flags: freshFlags(),
    message: '',
    log: [],            // newest last
  };
}

let logSeed = 0;
const logEntry = (kind, text, data = {}) => ({ id: ++logSeed, kind, text, ...data });
const LOG_MAX = 60;
const pushLog = (log, ...entries) => [...log, ...entries].slice(-LOG_MAX);

export function useGame() {
  const [G, setG] = useState(fresh);

  const start = useCallback((names, cpu) => {
    let actionDeck = buildActionDeck();
    let actionDiscard = [];
    const players = Array.from({ length: NUM_PLAYERS }, (_, i) =>
      blankPlayer((names && names[i]) || `Player ${i + 1}`));
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const r = draw(actionDeck, actionDiscard, START_HAND);
      players[i].hand = r.drawn; actionDeck = r.deck; actionDiscard = r.disc;
    }
    const nd = draw(buildNobleDeck(), [], NOBLES_PER_DAY);
    setG({
      ...fresh(),
      phase: 'pass', players,
      cpu: cpu || [false, false, false],
      line: nd.drawn, nobleDeck: nd.deck, nobleDiscard: nd.disc,
      actionDeck, actionDiscard,
      message: `Day 1 — pass to ${players[0].name}`,
      log: [logEntry('day', '🏁 Game start — Day 1, 12 nobles in line.')],
    });
  }, []);

  const restart = useCallback(() => setG(fresh()), []);

  const beginTurn = useCallback(() => {
    setG(prev => {
      if (prev.line.length === 0) return endDay(prev, false);
      const blocked = prev.skipAction[prev.current];
      const skipAction = blocked
        ? prev.skipAction.map((v, i) => i === prev.current ? false : v)
        : prev.skipAction;
      return {
        ...prev,
        phase: 'playing',
        actionPlayed: false,
        actionBlocked: blocked,
        skipAction,
        selectedIdx: null,
        pending: null,
        flags: freshFlags(),
        message: blocked
          ? `${prev.players[prev.current].name} is rushed — no action this turn. Collect the front noble.`
          : `${prev.players[prev.current].name}'s turn — play an action (optional), then collect.`,
      };
    });
  }, []);

  const playCard = useCallback((handIdx) => {
    setG(prev => {
      if (prev.phase !== 'playing' || prev.actionPlayed) return prev;
      const inst = prev.players[prev.current].hand[handIdx];
      if (!inst) return prev;
      const def = ACTION_BY_ID[inst.defId];
      if (!canPlayCard(prev, def)) return prev;

      const step = getStep(def, prev, []);
      if (!step) {
        const result = applyResolved(prev, def, [], { cardUid: inst.uid });
        return finishAction(prev, def, inst, result);
      }
      return {
        ...prev,
        phase: 'targeting',
        selectedIdx: handIdx,
        pending: { defId: def.id, cardUid: inst.uid, picks: [], order: [] },
        message: `${def.name}: ${step.label}`,
      };
    });
  }, []);

  // Generic selection during targeting. `value` shape matches the step type:
  //  lineNoble→{idx}, reorder→{idx}, player→{playerIdx}, pileNoble/handCard→{idx},
  //  noblePick→{uid}, actionDiscardPick→{idx}, frontCard→{playerIdx,cardUid}
  const pick = useCallback((value) => {
    setG(prev => {
      if (prev.phase !== 'targeting' || !prev.pending) return prev;
      const def = ACTION_BY_ID[prev.pending.defId];
      const step = getStep(def, prev, prev.pending.picks);
      if (!step) return prev;

      if (step.type === 'reorder') {
        if (prev.pending.order.includes(value.idx)) return prev;
        const order = [...prev.pending.order, value.idx];
        if (order.length < step.count)
          return { ...prev, pending: { ...prev.pending, order },
            message: `${def.name}: tapped ${order.length}/${step.count}.` };
        return resolveNow(prev, def, [...prev.pending.picks, { order }]);
      }

      const picks = [...prev.pending.picks, value];
      const next = getStep(def, prev, picks);
      if (!next) return resolveNow(prev, def, picks);
      return { ...prev, pending: { ...prev.pending, picks }, message: `${def.name}: ${next.label}` };
    });
  }, []);

  const cancelTarget = useCallback(() => {
    setG(prev => prev.phase !== 'targeting' ? prev :
      { ...prev, phase: 'playing', pending: null, selectedIdx: null,
        message: `${prev.players[prev.current].name}'s turn — play an action (optional), then collect.` });
  }, []);

  // Discard own Callous Guards (the only card discardable at will).
  const discardFront = useCallback((cardUid) => {
    setG(prev => {
      if (prev.phase !== 'playing') return prev;
      const card = prev.players[prev.current].frontCards.find(c => c.uid === cardUid);
      if (!card) return prev;
      const players = prev.players.map((p, i) =>
        i === prev.current ? { ...p, frontCards: p.frontCards.filter(c => c.uid !== cardUid) } : p);
      return { ...prev, players, actionDiscard: [...prev.actionDiscard, card],
        message: `${ACTION_BY_ID[card.defId].name} discarded.`,
        log: pushLog(prev.log, logEntry('discard', `🗑 ${prev.players[prev.current].name} discarded ${ACTION_BY_ID[card.defId].name}.`)) };
    });
  }, []);

  const collectAndEnd = useCallback(() => {
    setG(prev => {
      if (prev.phase !== 'playing') return prev;
      let s = prev;
      if (s.confusion[s.current]) {
        s = { ...s, line: shuffle(s.line),
          confusion: s.confusion.map((v, i) => i === s.current ? false : v) };
      }
      s = s.flags.skipCollect
        ? { ...s, flags: { ...s.flags, extraActionDraws: 0, endDayAfter: s.flags.endDayAfter || false } }
        : collectSequence(s);
      s = drawStep(s);
      return advanceTurn(s);
    });
  }, []);

  // A computer player's turn runs in two beats (driven by App): first it plays
  // one beneficial card (or skips), then — after a pause — it collects.
  const cpuPlay = useCallback(() => {
    setG(prev => {
      if (prev.phase !== 'playing' || !prev.cpu?.[prev.current] || prev.actionPlayed) return prev;
      const choice = cpuChoose(prev);
      if (!choice) return { ...prev, actionPlayed: true, message: `${prev.players[prev.current].name} lines up a head…` };
      const result = applyResolved(prev, choice.def, choice.picks, { cardUid: choice.inst.uid });
      return finishAction(prev, choice.def, choice.inst, result);
    });
  }, []);

  return {
    G, start, restart, beginTurn, advanceFromPass: beginTurn,
    playCard, pick, cancelTarget, collectAndEnd, discardFront, cpuPlay,
    canPlay: (handIdx) => {
      if (G.phase !== 'playing' || G.actionPlayed) return false;
      const inst = G.players[G.current].hand[handIdx];
      return inst ? canPlayCard(G, ACTION_BY_ID[inst.defId]) : false;
    },
    step: () => (G.phase === 'targeting' && G.pending)
      ? getStep(ACTION_BY_ID[G.pending.defId], G, G.pending.picks) : null,
    score: (p) => computeScore(p),
  };
}

// ─── CPU ─────────────────────────────────────────────────────────────────────
function nobleValue(def) {
  if (def.special === 'palaceGuard') return 2;
  if (def.special === 'count' || def.special === 'countess') return 2;
  if (def.special === 'tragicFigure') return -1;
  return def.pts ?? 0;
}

// Greedy, safe heuristic: bring the best noble to the front / shove a bad one
// back / grab an extra good head. Skips cards that need player targeting.
function cpuChoose(G) {
  const hand = G.players[G.current].hand;
  const line = G.line;
  if (!line.length) return null;
  const frontVal = nobleValue(NOBLE_BY_ID[line[0].defId]);
  let bestIdx = -1, bestVal = frontVal;
  for (let i = 1; i < line.length; i++) {
    const v = nobleValue(NOBLE_BY_ID[line[i].defId]);
    if (v > bestVal) { bestVal = v; bestIdx = i; }
  }
  for (const inst of hand) {
    const def = ACTION_BY_ID[inst.defId];
    if (!canPlayCard(G, def)) continue;
    const { family, params } = def;
    if (bestIdx > 0 && family === 'toFrontEnd' && params.op === 'anyToFront')
      return { inst, def, picks: [{ idx: bestIdx }] };
    if (bestIdx > 0 && family === 'lineMove' && params.dir === 'fwd') {
      const cands = lineNobleCandidates(def, line);
      let pick = -1, pv = frontVal;
      for (const i of cands) { const v = nobleValue(NOBLE_BY_ID[line[i].defId]); if (v > pv) { pv = v; pick = i; } }
      if (pick >= 0) return { inst, def, picks: [{ idx: pick }] };
    }
    if (frontVal < 1 && family === 'toFrontEnd' && params.op === 'frontToEnd')
      return { inst, def, picks: [] };
    if (frontVal >= 2 && family === 'selfEconomy' && params.kind === 'doubleFeature')
      return { inst, def, picks: [] };
  }
  return null;
}

// ─── pure helpers ───────────────────────────────────────────────────────────
function resolveNow(prev, def, picks) {
  const inst = prev.players[prev.current].hand.find(c => c.uid === prev.pending.cardUid);
  const result = applyResolved(prev, def, picks, { cardUid: prev.pending.cardUid });
  return finishAction(prev, def, inst, result);
}

// Settle a played action: apply its patch, route the card (discard / in-front-of),
// run Master Spy, and decide whether the player may act again (Trip).
function finishAction(prev, def, inst, result) {
  const { toFront, toFrontPlayer, flags, players: effPlayers, message, actionDiscard: effDiscard, ...rest } = result;
  const players = (effPlayers || prev.players).map(p => ({
    ...p, hand: [...p.hand], scorePile: [...p.scorePile], frontCards: [...p.frontCards],
  }));
  players[prev.current].hand = players[prev.current].hand.filter(c => c.uid !== inst.uid);

  const baseDiscard = effDiscard ?? prev.actionDiscard;
  if (toFront) players[prev.current].frontCards.push(inst);
  else if (typeof toFrontPlayer === 'number') players[toFrontPlayer].frontCards.push(inst);

  let next = {
    ...prev, ...rest,
    players,
    actionDiscard: (toFront || typeof toFrontPlayer === 'number') ? baseDiscard : [...baseDiscard, inst],
    flags: flags || prev.flags,
    phase: 'playing', selectedIdx: null, pending: null,
  };

  // Master Spy: after each action card is played, move it to the end of the line.
  const line = next.line;
  const spyIdx = line.findIndex(c => NOBLE_BY_ID[c.defId].special === 'masterSpy');
  if (spyIdx >= 0 && spyIdx !== line.length - 1)
    next.line = moveNoble(line, spyIdx, line.length - 1 - spyIdx);

  const grantsExtra = next.flags.extraAction;
  next.actionPlayed = !grantsExtra;
  if (grantsExtra) {
    next.flags = { ...next.flags, extraAction: false };
    next.message = message || `${def.name} played — you may play another action, or collect.`;
  } else {
    next.message = message || `${def.name} played. Now collect the front noble.`;
  }
  next.log = pushLog(prev.log, logEntry('play', `▶ ${prev.players[prev.current].name} played ${def.name}.`,
    { defId: def.id, playerIdx: prev.current }));
  return next;
}

// Collect front noble(s) + resolve on-collection triggers.
function collectSequence(prev) {
  let line = [...prev.line];
  let players = prev.players.map(p => ({ ...p, scorePile: [...p.scorePile] }));
  let nobleDeck = [...prev.nobleDeck];
  let nobleDiscard = [...prev.nobleDiscard];
  let extraActionDraws = 0;
  let endDayAfter = prev.flags.endDayAfter || false;

  const cur = prev.current;
  const curName = players[cur].name;
  const logLines = [];
  const hasForeignSupport = players[cur].frontCards
    .some(f => ACTION_BY_ID[f.defId].params?.kind === 'foreignSupport');
  let toCollect = 1 + (prev.flags.extraCollect || 0);

  while (toCollect > 0 && line.length > 0) {
    const inst = line.shift();
    const def = NOBLE_BY_ID[inst.defId];
    toCollect -= 1;

    if (def.special === 'clown') {
      const other = (cur + 1) % players.length;
      players[other].scorePile.push(inst);
      logLines.push(logEntry('collect', `🤡 ${def.name} went to ${players[other].name}.`,
        { uid: inst.uid, defId: inst.defId, playerIdx: other }));
    } else {
      players[cur].scorePile.push(inst);
      logLines.push(logEntry('collect', `✂ ${curName} collected ${def.name}.`,
        { uid: inst.uid, defId: inst.defId, playerIdx: cur }));
    }

    if (def.color === 'purple' && hasForeignSupport) extraActionDraws += 1;
    if (def.special === 'fastNoble') toCollect += 1;
    if (def.special === 'drawAction') extraActionDraws += 1;
    if (def.special === 'robespierre') endDayAfter = true;
    if (def.special === 'rivalExecutioner') {
      const r = draw(nobleDeck, nobleDiscard, 1);
      nobleDeck = r.deck; nobleDiscard = r.disc;
      if (r.drawn[0]) players[cur].scorePile.push(r.drawn[0]);
    }
    if (def.special === 'addNoble') {
      const r = draw(nobleDeck, nobleDiscard, 1);
      nobleDeck = r.deck; nobleDiscard = r.disc;
      if (r.drawn[0]) line.push(r.drawn[0]);
    }
  }
  return { ...prev, line, players, nobleDeck, nobleDiscard,
    flags: { ...prev.flags, extraActionDraws, endDayAfter },
    log: pushLog(prev.log, ...logLines) };
}

function drawStep(s) {
  const n = 1 + (s.flags.extraActionDraws || 0) + (s.flags.bonusDraws || 0);
  const r = draw(s.actionDeck, s.actionDiscard, n);
  const players = s.players.map((p, i) =>
    i === s.current ? { ...p, hand: [...p.hand, ...r.drawn] } : p);
  return { ...s, players, actionDeck: r.deck, actionDiscard: r.disc };
}

function advanceTurn(s) {
  if (s.flags.endDayAfter) return endDay(s, true);
  const current = (s.current + 1) % s.players.length;
  return { ...s, current, phase: 'pass', flags: freshFlags(),
    message: `Day ${s.day} — pass to ${s.players[current].name}` };
}

function endDay(s, discardRemaining) {
  let nobleDiscard = [...s.nobleDiscard];
  if (discardRemaining && s.line.length) nobleDiscard = [...nobleDiscard, ...s.line];
  if (s.day >= TOTAL_DAYS)
    return { ...s, line: [], nobleDiscard, phase: 'gameOver', message: 'Game over!',
      log: pushLog(s.log, logEntry('day', '🏁 Day 3 over — game over!')) };

  const day = s.day + 1;
  const firstPlayer = (s.firstPlayer + 1) % s.players.length;
  const nd = draw(s.nobleDeck, nobleDiscard, NOBLES_PER_DAY);
  return {
    ...s, day, firstPlayer, current: firstPlayer,
    line: nd.drawn, nobleDeck: nd.deck, nobleDiscard: nd.disc,
    phase: 'pass', flags: freshFlags(),
    message: `Day ${day} — pass to ${s.players[firstPlayer].name}`,
    log: pushLog(s.log, logEntry('day', `📅 Day ${day} begins — 12 new nobles in line.`)),
  };
}
