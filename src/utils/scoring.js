import { NOBLE_BY_ID, ACTION_BY_ID } from '../data/cards';

// Compute a player's total score, applying all dynamic scoring rules.
// player = { scorePile: [inst], frontCards: [inst] }
// Returns { total, lines: [{ label, value }] } — lines power an optional breakdown UI.
export function computeScore(player) {
  const nobles = player.scorePile.map(inst => NOBLE_BY_ID[inst.defId]);
  const fronts = player.frontCards.map(inst => ACTION_BY_ID[inst.defId]);

  const indifferent = fronts.some(f => f.params?.kind === 'indifferentPublic');
  const grayCount  = nobles.filter(n => n.color === 'gray').length;
  const guardCount = nobles.filter(n => n.special === 'palaceGuard').length;
  const hasCount    = nobles.some(n => n.special === 'count');
  const hasCountess = nobles.some(n => n.special === 'countess');

  const lines = [];
  let total = 0;
  const add = (label, value) => { if (value !== 0) lines.push({ label, value }); total += value; };

  for (const n of nobles) {
    if (n.color === 'gray' && indifferent) { add(`${n.name} (Indifferent)`, 1); continue; }
    if (n.special === 'tragicFigure')      { add(n.name, -grayCount); continue; }
    if (n.special === 'palaceGuard')       { add(n.name, guardCount); continue; }
    if (n.special === 'count')    { add(n.name, 2 + (hasCountess ? 2 : 0)); continue; }
    if (n.special === 'countess') { add(n.name, 2 + (hasCount ? 2 : 0)); continue; }
    add(n.name, n.pts ?? 0);
  }

  for (const f of fronts) {
    const p = f.params || {};
    if (p.kind === 'points')     add(f.name, p.value);
    if (p.kind === 'toughCrowd') add(f.name, p.value);
    if (p.kind === 'support') {
      const cnt = nobles.filter(n => n.color === p.color).length;
      add(`${f.name} (+1 × ${cnt})`, cnt);
    }
  }

  return { total, lines };
}
