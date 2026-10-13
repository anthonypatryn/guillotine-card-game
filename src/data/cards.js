import { renderNoblePix, renderActionPix, backImg } from './pixel-img';
// ─── Guillotine card data ──────────────────────────────────────────────────
// Faithful to the 1998 Wizards of the Coast game.
// Full deck = 50 Noble cards + 60 Action cards. `qty` = copies in the deck.
// Images live in /public/cards/{nobles,actions}/.

export const COLORS = {
  blue:   'Church',
  green:  'Civic',
  gray:   'Good Guys',
  red:    'Military',
  purple: 'Royalty',
};

export const COLOR_HEX = {
  blue:   '#4a90c2',
  green:  '#6aa84f',
  gray:   '#8a8a8a',
  red:    '#c0392b',
  purple: '#8e5fb0',
};

// pts === null means the value is computed by a `special` scoring rule.
export const NOBLES = [
  // 🟦 Blue — Church
  { id: 'b1', name: 'Wealthy Priest',     color: 'blue',  pts: 1, qty: 2 },
  { id: 'b2', name: 'Bishop',             color: 'blue',  pts: 2, qty: 1 },
  { id: 'b3', name: 'Heretic',            color: 'blue',  pts: 2, qty: 1 },
  { id: 'b4', name: 'Bad Nun',            color: 'blue',  pts: 3, qty: 1 },
  { id: 'b5', name: 'Archbishop',         color: 'blue',  pts: 4, qty: 1 },
  { id: 'b6', name: 'Cardinal',           color: 'blue',  pts: 5, qty: 1 },

  // 🟩 Green — Civic / Government
  { id: 'e1', name: 'Rival Executioner',  color: 'green', pts: 1, qty: 1, special: 'rivalExecutioner', text: 'Collect the top noble of the noble deck after you collect this noble.' },
  { id: 'e2', name: 'Sheriff',            color: 'green', pts: 1, qty: 2 },
  { id: 'e3', name: 'Land Lord',          color: 'green', pts: 2, qty: 1 },
  { id: 'e4', name: 'Unpopular Judge',    color: 'green', pts: 2, qty: 2, special: 'unpopularJudge', text: 'No player may play an action card while the Unpopular Judge is at the front of the line.' },
  { id: 'e5', name: 'Tax Collector',      color: 'green', pts: 2, qty: 1 },
  { id: 'e6', name: 'Councilman',         color: 'green', pts: 3, qty: 1 },
  { id: 'e7', name: 'Mayor',              color: 'green', pts: 3, qty: 1 },
  { id: 'e8', name: 'Governor',           color: 'green', pts: 4, qty: 1 },

  // ⬜ Gray — "Good Guys" (negative points)
  { id: 'g1', name: 'Tragic Figure',      color: 'gray',  pts: null, qty: 1, special: 'tragicFigure',  text: 'Worth −1 point for every Gray noble in your score pile (including this one).' },
  { id: 'g2', name: 'Innocent Victim',    color: 'gray',  pts: -1,   qty: 1, special: 'innocentVictim', text: 'Choose an action card from your hand and discard it after you collect this noble.' },
  { id: 'g3', name: 'Martyr',             color: 'gray',  pts: -1,   qty: 3 },
  { id: 'g4', name: 'The Clown',          color: 'gray',  pts: -2,   qty: 1, special: 'clown',          text: "When you collect this noble, place it in another player's score pile." },
  { id: 'g5', name: 'Hero of the People', color: 'gray',  pts: -3,   qty: 1 },

  // 🟥 Red — Military / Guard
  { id: 'r1', name: 'Palace Guard',       color: 'red',   pts: null, qty: 5, special: 'palaceGuard', text: 'Worth a number of points equal to the number of Palace Guards in your score pile (including this one).' },
  { id: 'r2', name: 'Lieutenant',         color: 'red',   pts: 2, qty: 2 },
  { id: 'r3', name: 'Captain of the Guard', color: 'red', pts: 2, qty: 1, special: 'addNoble', text: 'Add another noble from the noble deck to the end of the line after you collect this noble.' },
  { id: 'r4', name: 'Colonel',            color: 'red',   pts: 3, qty: 1 },
  { id: 'r5', name: 'General',            color: 'red',   pts: 4, qty: 1, special: 'addNoble', text: 'Add another noble from the noble deck to the end of the line after you collect this noble.' },
  { id: 'r6', name: 'Master Spy',         color: 'red',   pts: 4, qty: 1, special: 'masterSpy', text: 'After each action card is played, move this card to the end of the line.' },

  // 🟪 Purple — Royalty / Court
  { id: 'v1',  name: 'Coiffeur',          color: 'purple', pts: 1, qty: 1 },
  { id: 'v2',  name: 'Lady in Waiting',   color: 'purple', pts: 1, qty: 1, special: 'drawAction', text: 'Draw an additional action card at the end of your turn after you collect this noble.' },
  { id: 'v3',  name: 'Piss Boy',          color: 'purple', pts: 1, qty: 1 },
  { id: 'v4',  name: 'Royal Cartographer', color: 'purple', pts: 1, qty: 1 },
  { id: 'v5',  name: 'Count',             color: 'purple', pts: 2, qty: 1, special: 'count',    text: '+2 points if you also have the Countess in your score pile.' },
  { id: 'v6',  name: 'Countess',          color: 'purple', pts: 2, qty: 1, special: 'countess', text: '+2 points if you also have the Count in your score pile.' },
  { id: 'v7',  name: 'Fast Noble',        color: 'purple', pts: 2, qty: 1, special: 'fastNoble', text: 'Collect an additional noble from the front of the line after you collect this noble.' },
  { id: 'v8',  name: 'Lady',              color: 'purple', pts: 2, qty: 1, special: 'drawAction', text: 'Draw an additional action card at the end of your turn after you collect this noble.' },
  { id: 'v9',  name: 'Lord',              color: 'purple', pts: 2, qty: 1, special: 'drawAction', text: 'Draw an additional action card at the end of your turn after you collect this noble.' },
  { id: 'v10', name: 'Baron',             color: 'purple', pts: 3, qty: 1 },
  { id: 'v11', name: 'Duke',              color: 'purple', pts: 3, qty: 1 },
  { id: 'v12', name: 'Robespierre',       color: 'purple', pts: 3, qty: 1, special: 'robespierre', text: 'The day ends after you collect this noble. Discard any nobles remaining in line.' },
  { id: 'v13', name: 'Regent',            color: 'purple', pts: 4, qty: 1 },
  { id: 'v14', name: 'King Louis XVI',    color: 'purple', pts: 5, qty: 1 },
  { id: 'v15', name: 'Marie Antoinette',  color: 'purple', pts: 5, qty: 1 },
];

// family + params drive utils/effects.js. text is the printed rules text.
export const ACTIONS = [
  { id: 'a1',  name: 'After You....',        qty: 1, family: 'playerAttack', params: { kind: 'frontNobleToPlayer' }, text: "Put the noble at the front of the line into another player's score pile." },
  { id: 'a2',  name: 'Bribed Guards',        qty: 1, family: 'toFrontEnd',   params: { op: 'frontToEnd' }, text: 'Move the noble at the front of the line to the end of the line.' },
  { id: 'a3',  name: 'Callous Guards',       qty: 1, family: 'persistent',   params: { kind: 'callousGuards' }, text: 'Put this card in front of you. Action cards that alter the line may not be played. You may discard this card at any time.' },
  { id: 'a4',  name: 'Church Support',       qty: 1, family: 'persistent',   params: { kind: 'support', color: 'blue' }, text: 'Put this card in front of you. +1 point for each Blue noble in your score pile.' },
  { id: 'a5',  name: 'Civic Pride',          qty: 1, family: 'lineMove',     params: { dir: 'fwd', n: 2, exact: false, color: 'green' }, text: 'Move a Green noble forward up to 2 places in line.' },
  { id: 'a6',  name: 'Civic Support',        qty: 1, family: 'persistent',   params: { kind: 'support', color: 'green' }, text: 'Play this card in front of you. +1 point for each Green noble in your score pile.' },
  { id: 'a7',  name: 'Clerical Error',       qty: 1, family: 'playerAttack', params: { kind: 'clericalError' }, text: "Choose a player. Collect any noble from that player's score pile. That player then collects any noble from your score pile." },
  { id: 'a8',  name: 'Clothing Swap',        qty: 1, family: 'lineAddRemove', params: { kind: 'clothingSwap' }, text: 'Choose any noble in line and discard it. Replace it with the top noble from the noble deck.' },
  { id: 'a9',  name: 'Confusion in Line',    qty: 1, family: 'playerAttack', params: { kind: 'confusion' }, text: 'Choose a player. Randomly rearrange the line just before that player collects his or her next noble.' },
  { id: 'a10', name: 'Double Feature',       qty: 2, family: 'selfEconomy',  params: { kind: 'doubleFeature' }, text: 'Collect an additional noble from the front of the line this turn.' },
  { id: 'a11', name: 'Escape!',              qty: 1, family: 'rearrange',    params: { kind: 'escape' }, text: 'Randomly choose 2 nobles in line and discard them. Randomly rearrange the remaining nobles in line.' },
  { id: 'a12', name: 'Extra Cart',           qty: 2, family: 'lineAddRemove', params: { kind: 'addNobles', n: 3 }, text: 'Add 3 nobles from the noble deck to the end of the line.' },
  { id: 'a13', name: 'Fainting Spell',       qty: 1, family: 'lineMove',     params: { dir: 'back', n: 3, exact: false }, text: 'Move a noble backward up to 3 places in line.' },
  { id: 'a14', name: 'Fled to England',      qty: 1, family: 'lineAddRemove', params: { kind: 'removeNoble' }, text: 'Discard any noble in line.' },
  { id: 'a15', name: 'Forced Break',         qty: 1, family: 'playerAttack', params: { kind: 'allDiscardRandom' }, text: 'All other players must discard an action card at random.' },
  { id: 'a16', name: 'Foreign Support',      qty: 1, family: 'persistent',   params: { kind: 'foreignSupport' }, text: 'Put this card in front of you. Draw an action card whenever you collect a Purple noble.' },
  { id: 'a17', name: 'Forward March',        qty: 1, family: 'toFrontEnd',   params: { op: 'specialToFront', special: 'palaceGuard' }, text: 'Move a Palace Guard to the front of the line.' },
  { id: 'a18', name: 'Fountain of Blood',    qty: 1, family: 'persistent',   params: { kind: 'points', value: 2 }, text: 'Put this card in front of you. It is worth 2 points.' },
  { id: 'a19', name: 'Friend of the Queen',  qty: 2, family: 'lineMove',     params: { dir: 'back', n: 2, exact: false }, text: 'Move a noble backward up to 2 places in line.' },
  { id: 'a20', name: 'Ignoble Noble',        qty: 2, family: 'lineMove',     params: { dir: 'fwd', n: 4, exact: true }, text: 'Move a noble forward exactly 4 places in line.' },
  { id: 'a21', name: 'Indifferent Public',   qty: 1, family: 'persistent',   params: { kind: 'indifferentPublic' }, text: 'Put this card in front of you. Any Gray nobles in your score pile are worth 1 point instead of their normal values.' },
  { id: 'a22', name: 'Infighting',           qty: 1, family: 'playerAttack', params: { kind: 'forceDiscard2' }, text: 'Choose a player. That player must choose 2 action cards from his or her hand and discard them.' },
  { id: 'a23', name: 'Information Exchange',  qty: 1, family: 'selfEconomy',  params: { kind: 'tradeHands' }, text: 'Trade hands with another player.' },
  { id: 'a24', name: 'Lack of Faith',        qty: 1, family: 'toFrontEnd',   params: { op: 'nearestColorToFront', color: 'blue' }, text: 'If there are any Blue nobles in line, move the one nearest the front of the line to the front of the line.' },
  { id: 'a25', name: 'Lack of Support',      qty: 1, family: 'playerAttack', params: { kind: 'lookDiscard' }, text: "Choose a player. Look at that player's hand, choose an action card, and discard it." },
  { id: 'a26', name: 'Late Arrival',         qty: 1, family: 'lineAddRemove', params: { kind: 'lateArrival' }, text: 'Look at the top 3 cards of the noble deck and add any one of them to the end of the line.' },
  { id: 'a27', name: 'Let Them Eat Cake',    qty: 1, family: 'toFrontEnd',   params: { op: 'namedToFront', nobleId: 'v15' }, text: 'If Marie Antoinette is in line, move her to the front of the line.' },
  { id: 'a28', name: "L'Idiot",              qty: 2, family: 'lineMove',     params: { dir: 'fwd', n: 2, exact: false }, text: 'Move a noble forward up to 2 places in line.' },
  { id: 'a29', name: 'Majesty',              qty: 1, family: 'lineMove',     params: { dir: 'fwd', n: 2, exact: false, color: 'purple' }, text: 'Move a Purple noble forward up to 2 places in line.' },
  { id: 'a30', name: 'Mass Confusion',       qty: 1, family: 'rearrange',    params: { kind: 'massConfusion' }, text: 'Put all nobles in line in the noble deck. Shuffle and deal out the same number of nobles in a new line.' },
  { id: 'a31', name: 'Military Might',       qty: 1, family: 'lineMove',     params: { dir: 'fwd', n: 2, exact: false, color: 'red' }, text: 'Move a Red noble forward up to 2 places in line.' },
  { id: 'a32', name: 'Military Support',     qty: 1, family: 'persistent',   params: { kind: 'support', color: 'red' }, text: 'Put this card in front of you. +1 point for each Red noble in your score pile.' },
  { id: 'a33', name: 'Milling in Line',      qty: 2, family: 'rearrange',    params: { kind: 'shuffleFirstN', n: 5 }, text: 'Randomly rearrange the first 5 nobles in line.' },
  { id: 'a34', name: 'Missed!',              qty: 1, family: 'playerAttack', params: { kind: 'lastNobleToEnd' }, text: 'Choose a player. That player must place the last noble he or she collected at the end of the line.' },
  { id: 'a35', name: 'Missing Heads',        qty: 1, family: 'playerAttack', params: { kind: 'loseRandomNoble' }, text: 'Choose a player. That player loses a random noble from his or her score pile.' },
  { id: 'a36', name: 'Opinionated Guards',   qty: 1, family: 'rearrange',    params: { kind: 'rearrangeFirstN', n: 4 }, text: 'Rearrange the first 4 nobles in line any way you wish.' },
  { id: 'a37', name: 'Political Influence',  qty: 2, family: 'selfEconomy',  params: { kind: 'politicalInfluence' }, text: 'Draw 3 additional action cards at the end of your turn. Do not collect a noble this turn.' },
  { id: 'a38', name: 'Public Demand',        qty: 1, family: 'toFrontEnd',   params: { op: 'anyToFront' }, text: 'Move any noble in line to the front of the line.' },
  { id: 'a39', name: 'Pushed',               qty: 2, family: 'lineMove',     params: { dir: 'fwd', n: 2, exact: true }, text: 'Move a noble forward exactly 2 places in line.' },
  { id: 'a40', name: 'Rain Delay',           qty: 1, family: 'selfEconomy',  params: { kind: 'rainDelay' }, text: "Shuffle all players' hands into the action deck and deal out 5 new action cards to each player." },
  { id: 'a41', name: 'Rat Break',            qty: 1, family: 'selfEconomy',  params: { kind: 'ratBreak' }, text: 'Put an action card of your choice from the discard pile into your hand.' },
  { id: 'a42', name: 'Rush Job',             qty: 1, family: 'playerAttack', params: { kind: 'rushJob' }, text: 'Choose a player. That player cannot play an action card on his or her next turn.' },
  { id: 'a43', name: 'Scarlet Pimpernel',    qty: 1, family: 'dayTurnControl', params: { kind: 'endDayAfterTurn' }, text: 'The day ends after you finish your turn. Discard any nobles remaining in line.' },
  { id: 'a44', name: 'Stumble',              qty: 2, family: 'lineMove',     params: { dir: 'fwd', n: 1, exact: true }, text: 'Move a noble forward exactly 1 place in line.' },
  { id: 'a45', name: 'The Long Walk',        qty: 1, family: 'rearrange',    params: { kind: 'reverse' }, text: 'Reverse the order of the line.' },
  { id: 'a46', name: "'Tis a Far Better Thing", qty: 1, family: 'lineMove',  params: { dir: 'fwd', n: 3, exact: true }, text: 'Move a noble forward exactly 3 places in line.' },
  { id: 'a47', name: 'Tough Crowd',          qty: 1, family: 'persistent',   params: { kind: 'toughCrowd', value: -2, target: 'other' }, text: 'Put this card in front of another player. It is worth −2 points to that player.' },
  { id: 'a48', name: 'Trip',                 qty: 2, family: 'lineMove',     params: { dir: 'back', n: 1, exact: true, extraAction: true }, text: 'Move a noble backward exactly 1 place in line. You may play another action card this turn.' },
  { id: 'a49', name: 'Twist of Fate',        qty: 1, family: 'playerAttack', params: { kind: 'discardFrontCard' }, text: 'Put any action card in front of any player into the discard pile.' },
  { id: 'a50', name: 'Was That My Name?',    qty: 1, family: 'lineMove',     params: { dir: 'fwd', n: 3, exact: false }, text: 'Move a noble forward up to 3 places in line.' },
];

export const NOBLE_BY_ID  = Object.fromEntries(NOBLES.map(n => [n.id, n]));
export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map(a => [a.id, a]));

export function nobleImg(id)  { const n = NOBLE_BY_ID[id];  return (n && renderNoblePix(n.name, COLOR_HEX[n.color])) || `/cards/nobles/${id}.jpeg`; }
export function actionImg(id) { const a = ACTION_BY_ID[id]; return (a && renderActionPix(a)) || `/cards/actions/${id}.jpeg`; }
export const NOBLE_BACK  = backImg(false);
export const ACTION_BACK = backImg(true);

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let uidSeed = 0;
export const nextUid = () => ++uidSeed;

// Expand by qty into instances with unique uids. type marks the deck.
function expand(defs, type) {
  const out = [];
  for (const def of defs) {
    for (let i = 0; i < def.qty; i++) {
      out.push({ uid: nextUid(), type, defId: def.id });
    }
  }
  return out;
}

export function buildNobleDeck()  { return shuffle(expand(NOBLES,  'noble')); }   // 50 cards
export function buildActionDeck() { return shuffle(expand(ACTIONS, 'action')); }  // 60 cards
