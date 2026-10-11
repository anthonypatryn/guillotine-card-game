// Line model: an array of noble instances. index 0 = FRONT (the guillotine,
// next to be collected). "forward" = toward the front (toward index 0).
// "end of the line" = the back = highest index.
import { shuffle } from '../data/cards';

// Move the element at `from` by `delta` positions.
// delta < 0 moves it forward (toward the guillotine); delta > 0 moves it back.
export function moveNoble(line, from, delta) {
  const len = line.length;
  let to = from + delta;
  to = Math.max(0, Math.min(len - 1, to));
  const a = [...line];
  const [el] = a.splice(from, 1);
  a.splice(to, 0, el);
  return a;
}

export function reverseLine(line) {
  return [...line].reverse();
}

export function shuffleFirstN(line, n) {
  const k = Math.min(n, line.length);
  return [...shuffle(line.slice(0, k)), ...line.slice(k)];
}

export function removeAt(line, idx) {
  const a = [...line];
  const [removed] = a.splice(idx, 1);
  return { line: a, removed };
}

export function addToEnd(line, inst) {
  return [...line, inst];
}
