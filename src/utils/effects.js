import { NOBLE_BY_ID, ACTION_BY_ID, shuffle } from '../data/cards';
import { moveNoble } from './line';

// ─── helpers ────────────────────────────────────────────────────────────────
const colorOf = inst => NOBLE_BY_ID[inst.defId].color;
const specialOf = inst => NOBLE_BY_ID[inst.defId].special;
const range = k => Array.from({ length: k }, (_, i) => i);
const rand = n => Math.floor(Math.random() * n);
const clone = players => players.map(p => ({
  ...p, hand: [...p.hand], scorePile: [...p.scorePile], frontCards: [...p.frontCards],
}));

const LINE_ALTERING = ['lineMove', 'toFrontEnd', 'rearrange', 'lineAddRemove'];

export function callousActive(G) {
  return G.players.some(p =>
    p.frontCards.some(f => ACTION_BY_ID[f.defId].params?.kind === 'callousGuards'));
}
export function judgeBlocks(G) {
  const front = G.line[0];
  return !!(front && NOBLE_BY_ID[front.defId].special === 'unpopularJudge');
}

// All cards are implemented as of M2.
export function isImplemented() { return true; }

// Legal line indices to target, honoring color filters / exact-move room.
export function lineNobleCandidates(def, line) {
  const { family, params } = def;
  const len = line.length;
  const out = [];
  const colorOk = i => !params.color || colorOf(line[i]) === params.color;

  if (family === 'lineMove') {
    const { dir, n, exact } = params;
    for (let i = 0; i < len; i++) {
      if (!colorOk(i)) continue;
      if (exact) {
        if (dir === 'fwd' && i - n >= 0) out.push(i);
        if (dir === 'back' && i + n <= len - 1) out.push(i);
      } else {
        if (dir === 'fwd' && i > 0) out.push(i);
        if (dir === 'back' && i < len - 1) out.push(i);
      }
    }
    return out;
  }
  if (family === 'toFrontEnd') {
    if (params.op === 'anyToFront') { for (let i = 1; i < len; i++) out.push(i); return out; }
    if (params.op === 'specialToFront') {
      for (let i = 1; i < len; i++) if (specialOf(line[i]) === params.special) out.push(i);
      return out;
    }
  }
  if (family === 'lineAddRemove') {
    if (params.kind === 'removeNoble' || params.kind === 'clothingSwap') {
      for (let i = 0; i < len; i++) out.push(i);
      return out;
    }
  }
  return out;
}

function allFrontCards(G) {
  const out = [];
  G.players.forEach((p, pi) => p.frontCards.forEach(c => out.push({ playerIdx: pi, cardUid: c.uid })));
  return out;
}

// ─── step targeting ─────────────────────────────────────────────────────────
// Returns the next selection the player must make, or null when ready to apply.
// Step shape: { type, candidates|options, playerIdx?, count?, label, empty? }
export function getStep(def, G, picks) {
  const { family, params } = def;
  const cur = G.current;
  const others = G.players.map((_, i) => i).filter(i => i !== cur);
  const n = picks.length;
  const lineStep = (label) => {
    const c = lineNobleCandidates(def, G.line);
    return { type: 'lineNoble', candidates: c, label, empty: c.length === 0 };
  };
  const playerStep = (filterFn, label) => {
    const c = others.filter(filterFn);
    return { type: 'player', candidates: c, label, empty: c.length === 0 };
  };

  switch (family) {
    case 'lineMove':
      return n === 0 ? lineStep('Choose a noble in the line.') : null;

    case 'toFrontEnd':
      if ((params.op === 'anyToFront' || params.op === 'specialToFront') && n === 0)
        return lineStep('Choose a noble.');
      return null;

    case 'rearrange':
      if (params.kind === 'rearrangeFirstN' && n === 0) {
        const k = Math.min(params.n, G.line.length);
        return { type: 'reorder', candidates: range(k), count: k,
          label: `Tap the first ${k} nobles in their new order (front first).`, empty: k === 0 };
      }
      return null;

    case 'lineAddRemove':
      if ((params.kind === 'removeNoble' || params.kind === 'clothingSwap') && n === 0)
        return lineStep('Choose a noble.');
      if (params.kind === 'lateArrival' && n === 0) {
        const opts = G.nobleDeck.slice(-3).reverse();
        return { type: 'noblePick', options: opts,
          label: 'Choose a noble to add to the end of the line.', empty: opts.length === 0 };
      }
      return null;

    case 'persistent':
      if (params.kind === 'toughCrowd' && n === 0)
        return playerStep(() => true, 'Choose a player to saddle with Tough Crowd (−2).');
      return null;

    case 'selfEconomy':
      if (params.kind === 'tradeHands' && n === 0)
        return playerStep(() => true, 'Choose a player to trade hands with.');
      if (params.kind === 'ratBreak' && n === 0) {
        const c = range(G.actionDiscard.length);
        return { type: 'actionDiscardPick', candidates: c,
          label: 'Choose an action card from the discard pile.', empty: c.length === 0 };
      }
      return null;

    case 'dayTurnControl':
      return null;

    case 'playerAttack':
      switch (params.kind) {
        case 'frontNobleToPlayer':
          return n === 0
            ? { type: 'player', candidates: others, label: 'Choose a player to receive the front noble.', empty: others.length === 0 || G.line.length === 0 }
            : null;
        case 'confusion':
          return n === 0 ? playerStep(() => true, "Choose a player whose next collection gets scrambled.") : null;
        case 'allDiscardRandom':
          return null;
        case 'forceDiscard2':
          return n === 0 ? playerStep(i => G.players[i].hand.length > 0, 'Choose a player to discard 2 cards.') : null;
        case 'rushJob':
          return n === 0 ? playerStep(() => true, 'Choose a player who skips actions next turn.') : null;
        case 'loseRandomNoble':
          return n === 0 ? playerStep(i => G.players[i].scorePile.length > 0, 'Choose a player to lose a random noble.') : null;
        case 'lastNobleToEnd':
          return n === 0 ? playerStep(i => G.players[i].scorePile.length > 0, "Choose a player; their last-collected noble returns to the line.") : null;
        case 'discardFrontCard': {
          if (n > 0) return null;
          const c = allFrontCards(G);
          return { type: 'frontCard', candidates: c, label: 'Choose an action card in front of a player to discard.', empty: c.length === 0 };
        }
        case 'clericalError':
          if (n === 0) return playerStep(i => G.players[i].scorePile.length > 0, 'Choose a player to take a noble from.');
          if (n === 1) {
            const pi = picks[0].playerIdx;
            const c = range(G.players[pi].scorePile.length);
            return { type: 'pileNoble', playerIdx: pi, candidates: c, label: 'Choose a noble to take.', empty: c.length === 0 };
          }
          return null;
        case 'lookDiscard':
          if (n === 0) return playerStep(i => G.players[i].hand.length > 0, "Choose a player whose hand to peek at.");
          if (n === 1) {
            const pi = picks[0].playerIdx;
            const c = range(G.players[pi].hand.length);
            return { type: 'handCard', playerIdx: pi, candidates: c, label: 'Choose a card to discard.', empty: c.length === 0 };
          }
          return null;
        default:
          return null;
      }

    default:
      return null;
  }
}

// Can the current player legally play this card right now?
export function canPlayCard(G, def) {
  if (judgeBlocks(G)) return false;            // Unpopular Judge at front
  if (G.actionBlocked) return false;           // Rush Job
  if (callousActive(G) && LINE_ALTERING.includes(def.family)) return false;
  const step = getStep(def, G, []);
  if (step && step.empty) return false;        // no legal target
  return true;
}

// ─── apply a fully-targeted action → state patch ────────────────────────────
// Returns a patch merged by useGame.finishAction. Special keys:
//   toFront:true            → place played card in current player's frontCards
//   toFrontPlayer:i         → place played card in player i's frontCards
//   players / line / nobleDeck / nobleDiscard / actionDiscard / flags /
//   confusion / skipAction  → replace those slices
export function applyResolved(G, def, picks = [], ctx = {}) {
  const { family, params } = def;
  const line = G.line;
  const cur = G.current;

  if (family === 'lineMove') {
    const { dir, n, exact } = params;
    const idx = picks[0].idx;
    const delta = dir === 'fwd'
      ? -(exact ? n : Math.min(n, idx))
      : (exact ? n : Math.min(n, line.length - 1 - idx));
    const patch = { line: moveNoble(line, idx, delta) };
    if (params.extraAction) patch.flags = { ...G.flags, extraAction: true };
    return patch;
  }

  if (family === 'toFrontEnd') {
    if (params.op === 'frontToEnd') return { line: moveNoble(line, 0, line.length - 1) };
    if (params.op === 'anyToFront' || params.op === 'specialToFront')
      return { line: moveNoble(line, picks[0].idx, -picks[0].idx) };
    if (params.op === 'namedToFront') {
      const i = line.findIndex(c => c.defId === params.nobleId);
      return i <= 0 ? {} : { line: moveNoble(line, i, -i) };
    }
    if (params.op === 'nearestColorToFront') {
      const i = line.findIndex(c => colorOf(c) === params.color);
      return i <= 0 ? {} : { line: moveNoble(line, i, -i) };
    }
  }

  if (family === 'rearrange') {
    if (params.kind === 'reverse') return { line: [...line].reverse() };
    if (params.kind === 'shuffleFirstN') {
      const k = Math.min(params.n, line.length);
      return { line: [...shuffle(line.slice(0, k)), ...line.slice(k)] };
    }
    if (params.kind === 'escape') {
      let rest = [...line]; const disc = [];
      for (let c = 0; c < 2 && rest.length; c++) { const j = rand(rest.length); disc.push(rest[j]); rest.splice(j, 1); }
      return { line: shuffle(rest), nobleDiscard: [...G.nobleDiscard, ...disc] };
    }
    if (params.kind === 'massConfusion') {
      const count = line.length;
      const pool = shuffle([...G.nobleDeck, ...line]);
      return { line: pool.slice(0, count), nobleDeck: pool.slice(count) };
    }
    if (params.kind === 'rearrangeFirstN') {
      const order = picks[0].order;
      const k = order.length;
      const front = order.map(i => line[i]);
      return { line: [...front, ...line.slice(k)] };
    }
  }

  if (family === 'lineAddRemove') {
    if (params.kind === 'addNobles') {
      let deck = [...G.nobleDeck]; let disc = [...G.nobleDiscard]; const add = [];
      for (let c = 0; c < params.n; c++) {
        if (!deck.length) { if (!disc.length) break; deck = shuffle(disc); disc = []; }
        add.push(deck.pop());
      }
      return { line: [...line, ...add], nobleDeck: deck, nobleDiscard: disc };
    }
    if (params.kind === 'removeNoble') {
      const a = [...line]; const [rm] = a.splice(picks[0].idx, 1);
      return { line: a, nobleDiscard: [...G.nobleDiscard, rm] };
    }
    if (params.kind === 'clothingSwap') {
      const a = [...line]; const [rm] = a.splice(picks[0].idx, 1);
      let deck = [...G.nobleDeck]; let disc = [...G.nobleDiscard, rm];
      if (!deck.length) { deck = shuffle(disc); disc = []; }
      const drawn = deck.pop();
      a.splice(picks[0].idx, 0, drawn);
      return { line: a, nobleDeck: deck, nobleDiscard: disc };
    }
    if (params.kind === 'lateArrival') {
      const deck = [...G.nobleDeck];
      const j = deck.findIndex(c => c.uid === picks[0].uid);
      const [chosen] = deck.splice(j, 1);
      return { line: [...line, chosen], nobleDeck: deck };
    }
  }

  if (family === 'persistent') {
    if (params.kind === 'toughCrowd') return { toFrontPlayer: picks[0].playerIdx };
    return { toFront: true };
  }

  if (family === 'selfEconomy') {
    if (params.kind === 'doubleFeature')
      return { flags: { ...G.flags, extraCollect: (G.flags.extraCollect || 0) + 1 } };
    if (params.kind === 'politicalInfluence')
      return { flags: { ...G.flags, skipCollect: true, bonusDraws: (G.flags.bonusDraws || 0) + 3 } };
    if (params.kind === 'tradeHands') {
      const players = clone(G.players);
      const tgt = picks[0].playerIdx;
      const curHand = players[cur].hand.filter(c => c.uid !== ctx.cardUid);
      players[cur].hand = players[tgt].hand;
      players[tgt].hand = curHand;
      return { players };
    }
    if (params.kind === 'ratBreak') {
      const disc = [...G.actionDiscard];
      const [card] = disc.splice(picks[0].idx, 1);
      const players = clone(G.players);
      players[cur].hand.push(card);
      return { players, actionDiscard: disc };
    }
    if (params.kind === 'rainDelay') {
      const players = clone(G.players);
      let pool = [...G.actionDeck];
      players.forEach(p => {
        p.hand.forEach(c => { if (c.uid !== ctx.cardUid) pool.push(c); });
        p.hand = [];
      });
      pool = shuffle(pool);
      let disc = [...G.actionDiscard];
      const take = () => { if (!pool.length) { pool = shuffle(disc); disc = []; } return pool.pop(); };
      players.forEach(p => { for (let i = 0; i < 5; i++) { const c = take(); if (c) p.hand.push(c); } });
      return { players, actionDeck: pool, actionDiscard: disc };
    }
  }

  if (family === 'dayTurnControl') {
    if (params.kind === 'endDayAfterTurn') return { flags: { ...G.flags, endDayAfter: true } };
  }

  if (family === 'playerAttack') {
    const players = clone(G.players);
    switch (params.kind) {
      case 'frontNobleToPlayer': {
        const a = [...line]; const noble = a.shift();
        players[picks[0].playerIdx].scorePile.push(noble);
        return { players, line: a };
      }
      case 'confusion': {
        const confusion = [...G.confusion]; confusion[picks[0].playerIdx] = true;
        return { confusion };
      }
      case 'allDiscardRandom': {
        const disc = [];
        players.forEach((p, i) => {
          if (i === cur) return;
          if (p.hand.length) { const j = rand(p.hand.length); disc.push(p.hand.splice(j, 1)[0]); }
        });
        return { players, actionDiscard: [...G.actionDiscard, ...disc] };
      }
      case 'forceDiscard2': {
        const pi = picks[0].playerIdx; const disc = [];
        for (let c = 0; c < 2 && players[pi].hand.length; c++) {
          const j = rand(players[pi].hand.length); disc.push(players[pi].hand.splice(j, 1)[0]);
        }
        return { players, actionDiscard: [...G.actionDiscard, ...disc] };
      }
      case 'rushJob': {
        const skipAction = [...G.skipAction]; skipAction[picks[0].playerIdx] = true;
        return { skipAction };
      }
      case 'loseRandomNoble': {
        const pi = picks[0].playerIdx; const pile = players[pi].scorePile;
        const j = rand(pile.length); const [lost] = pile.splice(j, 1);
        return { players, nobleDiscard: [...G.nobleDiscard, lost] };
      }
      case 'lastNobleToEnd': {
        const pi = picks[0].playerIdx; const noble = players[pi].scorePile.pop();
        return { players, line: [...line, noble] };
      }
      case 'discardFrontCard': {
        const { playerIdx, cardUid } = picks[0];
        const fc = players[playerIdx].frontCards;
        const j = fc.findIndex(c => c.uid === cardUid);
        const [rm] = fc.splice(j, 1);
        return { players, actionDiscard: [...G.actionDiscard, rm] };
      }
      case 'clericalError': {
        const tgt = picks[0].playerIdx;
        const taken = players[tgt].scorePile.splice(picks[1].idx, 1)[0];
        players[cur].scorePile.push(taken);
        // Target collects "any OTHER noble" from your pile — auto-takes your
        // highest-value one, excluding the noble just transferred.
        const mine = players[cur].scorePile;
        const eligible = mine.map((c, i) => i).filter(i => mine[i].uid !== taken.uid);
        if (eligible.length) {
          let best = eligible[0];
          for (const i of eligible)
            if ((NOBLE_BY_ID[mine[i].defId].pts ?? 0) > (NOBLE_BY_ID[mine[best].defId].pts ?? 0)) best = i;
          const give = mine.splice(best, 1)[0];
          players[tgt].scorePile.push(give);
        }
        return { players };
      }
      case 'lookDiscard': {
        const pi = picks[0].playerIdx;
        const [card] = players[pi].hand.splice(picks[1].idx, 1);
        return { players, actionDiscard: [...G.actionDiscard, card] };
      }
      default:
        return {};
    }
  }

  return {};
}
