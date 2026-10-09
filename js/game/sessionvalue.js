// sessionvalue.js — luck versus skill for a simulator session.
//
// For every round the simulator records the bet, the true count it was bet at,
// the result, and any graded mistakes. From that:
//   actual    the units really won or lost
//   expected  what the play was worth: bet x edge at that count (tcedges.js),
//             minus what each mistake cost at the count it was made
//   sd        the normal spread of luck around `expected`: one blackjack hand
//             swings about 1.15 bets (standard deviation), and swings add up
//             as the square root of the sum of squares
// The gap between actual and expected is luck.

import { TC_EDGES } from '../data/tcedges.js';
import { shoeAtTrueCount } from '../engine/shoe.js';
import { makeGame, accumulateRow, rowEV } from '../engine/ev.js';
import { normCdf } from '../engine/risk.js';

export const HAND_SD = 1.15;          // per unit bet; blackjack's flat-bet standard deviation
const SLOPE_FALLBACK = 0.005;         // the classic "0.5% per true count" when no table exists
const EV_KEY = { stand: 'stand', hit: 'hit', double: 'double', split: 'split', surrender: 'surrender' };

// Player edge (fraction of the bet) at a true count, interpolated in the table.
export function edgeAt(presetId, tc, fallbackHouseEdge = 0.5) {
  const t = TC_EDGES[presetId];
  if (!t) return -fallbackHouseEdge / 100 + SLOPE_FALLBACK * tc;
  const keys = Object.keys(t.edges).map(Number).sort((a, b) => a - b);
  const lo = keys[0], hi = keys[keys.length - 1];
  const x = Math.max(lo, Math.min(hi, tc));
  const a = Math.floor(x), b = Math.min(hi, a + 1);
  const f = x - a;
  return t.edges[a] * (1 - f) + t.edges[b] * f;
}

// What one graded mistake cost, in units (never negative).
// m: { kind: 'play', table, row, up (engine rank), chosen, right, tc, decks, bet, chart? }
//    { kind: 'insurance', took, tc, decks, bet }
// The cell is priced on the representative shoe for the count it was made at.
// When that shoe cannot be built (very few cards left), the chart's neutral EVs
// are used instead.
const gameCache = new Map();
function gameAt(rules, tc, decks) {
  const d = Math.max(1, Math.round(decks * 2) / 2);
  const t = Math.round(tc * 4) / 4;
  const key = `${d}|${t}`;
  if (!gameCache.has(key)) gameCache.set(key, makeGame(rules, shoeAtTrueCount(t, d)));
  return gameCache.get(key);
}

export function mistakeCost(m, rules) {
  if (m.kind === 'insurance') {
    let pTen = 4 / 13;
    try {
      const s = shoeAtTrueCount(m.tc, Math.max(1, m.decks));
      const n = s.reduce((x, y) => x + y, 0) - 1; // the dealer's ace is out
      pTen = s[10] / n;
    } catch { /* keep the neutral share */ }
    const evPerUnit = 3 * pTen - 1;            // insurance pays 2:1 on half the bet
    const insBet = m.bet / 2;
    return Math.max(0, (m.took ? -evPerUnit : evPerUnit) * insBet);
  }
  let ev = null;
  if (rules.variant === 'classic') {
    try {
      const u = gameAt(rules, m.tc, m.decks).perUp.find((x) => x.up === m.up);
      ev = rowEV(accumulateRow({ den: 0 }, u, rules, m.table, String(m.row)));
    } catch { ev = null; }
  }
  if (!ev && m.chart) ev = m.chart.ev?.[m.table]?.[m.row]?.[m.col ?? (m.up === 1 ? 'A' : String(m.up))];
  if (!ev) return 0;
  const a = ev[EV_KEY[m.right]], b = ev[EV_KEY[m.chosen]];
  if (typeof a !== 'number' || typeof b !== 'number') return 0;
  return Math.max(0, a - b) * m.bet;
}

// rounds: [{ bet, tc, net, mistakes: [...] }]  ->  points + totals
export function analyzeSession(rounds, { presetId, rules, houseEdge = 0.5 }) {
  const points = [{ round: 0, actual: 0, expected: 0, sd: 0 }];
  let actual = 0, betValue = 0, mistakeCost_ = 0, varSum = 0;
  rounds.forEach((r, i) => {
    actual += r.net;
    betValue += r.bet * edgeAt(presetId, r.tc, houseEdge);
    for (const m of r.mistakes || []) mistakeCost_ += mistakeCost(m, rules);
    varSum += (HAND_SD * r.bet) ** 2;
    points.push({ round: i + 1, actual, expected: betValue - mistakeCost_, sd: Math.sqrt(varSum) });
  });
  const expected = betValue - mistakeCost_;
  const sd = Math.sqrt(varSum);
  const luck = actual - expected;
  return { points, totals: { actual, expected, betValue, mistakeCost: mistakeCost_, luck, sd, z: sd ? luck / sd : 0 } };
}

// One sentence on how unusual the luck was. "1 session in N" is one-sided:
// the chance of being at least this unlucky (or this lucky).
export function luckVerdict(z) {
  const a = Math.abs(z);
  const way = z < 0 ? 'unlucky' : 'lucky';
  const oneIn = Math.max(2, Math.round(1 / (1 - normCdf(a))));
  if (a < 1) return 'well inside normal luck: about 2 sessions in 3 land this close to the expected line';
  if (a < 2) return `${way}, but normal: about 1 session in ${oneIn} is this ${way} or more`;
  return `very ${way}: only about 1 session in ${oneIn} is this ${way} or more`;
}
