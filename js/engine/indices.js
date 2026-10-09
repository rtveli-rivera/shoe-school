// indices.js — the engine's own estimate of where an index play turns correct.
//
// Pure ES module (no DOM, no Node APIs). A CROSS-CHECK of the published
// Illustrious 18 / Fab 4 numbers in js/data/deviations.js, never a replacement:
// published indices come from simulations of whole shoes; this is a quick
// combinatorial approximation.
//
//   computeIndex(play, rules, opts?) -> { exact, rounded, direction, decksRemaining, ... }
//
// Method. For a true count t, take the representative Hi-Lo shoe
// shoeAtTrueCount(t, D) (shoe.js): D decks left (default: half the shoe), with
// the tens and aces up and the 2-6s down by exactly the amount a running count
// of t * D implies, spread evenly within each Hi-Lo group. On that shoe the two
// plays of the entry (its `action` and its `otherwise`) are priced exactly like
// a chart cell (averaged over the two-card hands of the row, best play
// afterwards), and the true count where their EVs cross is found by bracketing
// and bisection. `direction` says on which side of the crossing `action` wins:
// 'ge' (at and above) or 'le' (at and below).
//
// Known limits: one representative shoe per count (real shoes at the same
// count vary), two-card hands only (a published 16 vs 10 index covers 3+ card
// 16s too), and no betting correlation. Expect agreement within about one
// count for most plays.

import { normalizeRules } from './rules.js';
import { shoeAtTrueCount } from './shoe.js';
import { makeGame, accumulateRow, rowEV } from './ev.js';

const EV_OF = { S: 'stand', H: 'hit', D: 'double', P: 'split', R: 'surrender' };

function rankOfUp(up) { return up === 'A' ? 1 : Number(up); }

// EV(action) - EV(otherwise) for the entry's cell at true count tc.
function evGap(play, rules, tc, decksRemaining) {
  const shoe = shoeAtTrueCount(tc, decksRemaining);
  const up = rankOfUp(String(play.up));
  if (play.table === 'insurance' || play.action === 'insure') {
    // Insurance pays 2:1 on a dealer ten under the ace: EV = 3 * P(ten) - 1.
    const n = shoe.reduce((a, b) => a + b, 0) - 1; // the ace is out
    const pTen = shoe[10] / n;
    return { gap: 3 * pTen - 1, a: 3 * pTen - 1, b: 0 };
  }
  const game = makeGame(rules, shoe);
  const u = game.perUp.find((x) => x.up === up);
  const ev = rowEV(accumulateRow({ den: 0 }, u, rules, play.table, String(play.row)));
  const a = ev[EV_OF[play.action]];
  const b = ev[EV_OF[play.otherwise]];
  if (a === undefined || b === undefined) throw new Error(`Cannot price ${play.action} vs ${play.otherwise} in ${play.table} ${play.row} v ${play.up}`);
  return { gap: a - b, a, b };
}

// play: a deviations.js entry (table, row, up, action, otherwise), or
//       { table: 'insurance', up: 'A', action: 'insure' }.
// opts: { decksRemaining (default rules.decks / 2), lo = -12, hi = 12, tol = 0.02 }
export function computeIndex(play, rulesIn, opts = {}) {
  let rules = normalizeRules(rulesIn);
  // Surrender plays need late surrender; other plays are priced as if it were
  // not available (that is when the I18 stand/hit indices are used).
  const needsR = play.action === 'R' || play.otherwise === 'R';
  rules = normalizeRules({ ...rules, surrender: needsR ? 'late' : 'none' });
  const D = opts.decksRemaining ?? rules.decks / 2;
  const lo = opts.lo ?? -12, hi = opts.hi ?? 12, tol = opts.tol ?? 0.02;
  const cache = new Map();
  const f = (tc) => {
    const k = Math.round(tc * 1000);
    if (!cache.has(k)) cache.set(k, evGap(play, rules, tc, D));
    return cache.get(k).gap;
  };
  const at0 = evGap(play, rules, 0, D);
  // Bracket: walk outward from 0 in steps of 1 until the sign changes.
  const s0 = Math.sign(f(0));
  let left = null, right = null;
  for (let step = 1; step <= Math.max(-lo, hi); step++) {
    if (step <= hi && Math.sign(f(step)) !== s0) { left = step - 1; right = step; break; }
    if (-step >= lo && Math.sign(f(-step)) !== s0) { left = -step; right = -step + 1; break; }
  }
  const base = { decksRemaining: D, evAt0: { action: at0.a, otherwise: at0.b } };
  if (left === null) return { ...base, exact: null, rounded: null, direction: s0 > 0 ? 'always' : 'never' };
  let a = left, b = right;
  const fa = f(a);
  while (b - a > tol) {
    const m = (a + b) / 2;
    if (Math.sign(f(m)) === Math.sign(fa)) a = m; else b = m;
  }
  const exact = (a + b) / 2;
  // Which side favours `action`: gap rising with the count -> at and above.
  const direction = f(exact + 1) > f(exact - 1) ? 'ge' : 'le';
  return { ...base, exact, rounded: Math.round(exact), direction };
}

// All entries of a deviations.js list that this module can price.
export function computeIndices(list, rules, opts = {}) {
  return list
    .filter((e) => ['i18', 'fab4', 'insurance'].includes(e.set))
    .map((e) => ({ entry: e, result: computeIndex(e, rules, opts) }));
}

