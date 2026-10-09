// sessionvalue.js: the edge-by-count table, mistake pricing, session totals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rulesFor, PRESETS } from '../js/engine/rules.js';
import { TC_EDGES } from '../js/data/tcedges.js';
import { edgeAt, mistakeCost, analyzeSession, luckVerdict, HAND_SD } from '../js/game/sessionvalue.js';

test('every classic preset has an edge table that rises with the count', () => {
  for (const p of PRESETS) {
    if (rulesFor(p.id).variant !== 'classic') continue;
    const t = TC_EDGES[p.id];
    assert.ok(t, `missing ${p.id}`);
    for (let tc = -7; tc <= 10; tc++) assert.ok(t.edges[tc] > t.edges[tc - 1], `${p.id} not rising at ${tc}`);
    const slope = (t.edges[4] - t.edges[0]) / 4;
    assert.ok(slope > 0.004 && slope < 0.007, `${p.id} slope ${slope}`);
  }
});

test('edge at a count: interpolated, clamped, and a 0.5%-per-count fallback', () => {
  const e = TC_EDGES['shoe-6d-h17'].edges;
  assert.ok(Math.abs(edgeAt('shoe-6d-h17', 2.5) - (e[2] + e[3]) / 2) < 1e-12);
  assert.equal(edgeAt('shoe-6d-h17', 99), e[10]);
  assert.ok(e[0] < 0 && e[2] > 0, 'the player edge crosses zero between TC 0 and +2 in 6D H17');
  // 6:5 single deck is still losing at +2
  assert.ok(edgeAt('sd-65', 2) < 0);
  // no table (Double Exposure): -house edge + 0.5% per count
  assert.ok(Math.abs(edgeAt('double-exposure', 2, 1.15) - (-0.0115 + 0.01)) < 1e-12);
});

test('a mistake costs the EV gap at the count it was made, never less than zero', () => {
  const rules = rulesFor('shoe-6d-h17');
  const base = { kind: 'play', table: 'hard', row: '16', up: 10, decks: 3, bet: 2 };
  // at -3 the right play with 16 v 10 is hit: standing costs
  const standLow = mistakeCost({ ...base, chosen: 'stand', right: 'hit', tc: -3 }, rules);
  // at +4 the right play is stand: hitting costs
  const hitHigh = mistakeCost({ ...base, chosen: 'hit', right: 'stand', tc: 4 }, rules);
  assert.ok(standLow > 0 && standLow < 0.2, `stand at -3 cost ${standLow}`);
  assert.ok(hitHigh > 0 && hitHigh < 0.2, `hit at +4 cost ${hitHigh}`);
  // graded wrong but actually fine at the exact count: costs nothing
  assert.equal(mistakeCost({ ...base, chosen: 'hit', right: 'stand', tc: -3 }, rules), 0);
  // a big one: standing on 11 v 6 instead of doubling, 3-unit bet
  const big = mistakeCost({ kind: 'play', table: 'hard', row: '11', up: 6, decks: 3, bet: 3, chosen: 'stand', right: 'double', tc: 0 }, rules);
  assert.ok(big > 1, `standing on 11 v 6 should cost over a unit at 3 units, got ${big}`);
});

test('insurance mistakes are priced from the share of tens left', () => {
  const declineHigh = mistakeCost({ kind: 'insurance', took: false, tc: 6, decks: 3, bet: 4 }, {});
  const takeNeutral = mistakeCost({ kind: 'insurance', took: true, tc: 0, decks: 3, bet: 4 }, {});
  assert.ok(declineHigh > 0, 'declining insurance at +6 costs');
  assert.ok(takeNeutral > 0, 'insuring at 0 costs');
  // insuring at 0 with 3 decks left: 48 tens among the 155 cards other than the
  // dealer's ace, EV = 3 * 48/155 - 1 ≈ -0.071 per insured unit, 2 units insured
  assert.ok(Math.abs(takeNeutral - 2 * (1 - 3 * 48 / 155)) < 1e-9, `got ${takeNeutral}`);
  assert.equal(mistakeCost({ kind: 'insurance', took: true, tc: 6, decks: 3, bet: 4 }, {}), 0);
});

test('session totals: worth = bets x edge - mistakes, luck = result - worth', () => {
  const rules = rulesFor('shoe-6d-h17');
  const rounds = [
    { bet: 1, tc: 0, net: -1, mistakes: [] },
    { bet: 4, tc: 3, net: 4, mistakes: [] },
    { bet: 8, tc: 4.5, net: -8, mistakes: [{ kind: 'play', table: 'hard', row: '11', up: 6, decks: 3, bet: 8, chosen: 'stand', right: 'double', tc: 4.5 }] },
  ];
  const { points, totals } = analyzeSession(rounds, { presetId: 'shoe-6d-h17', rules });
  const betValue = edgeAt('shoe-6d-h17', 0) + 4 * edgeAt('shoe-6d-h17', 3) + 8 * edgeAt('shoe-6d-h17', 4.5);
  assert.ok(Math.abs(totals.betValue - betValue) < 1e-12);
  assert.ok(totals.mistakeCost > 2);
  assert.ok(Math.abs(totals.expected - (betValue - totals.mistakeCost)) < 1e-12);
  assert.equal(totals.actual, -5);
  assert.ok(Math.abs(totals.luck - (-5 - totals.expected)) < 1e-12);
  assert.ok(Math.abs(totals.sd - HAND_SD * Math.sqrt(1 + 16 + 64)) < 1e-12);
  assert.equal(points.length, 4);
  assert.deepEqual(points.map((p) => p.actual), [0, -1, 3, -5]);
});

test('luck verdicts', () => {
  assert.match(luckVerdict(0.4), /well inside normal luck/);
  assert.match(luckVerdict(-1.5), /^unlucky, but normal: about 1 session in 15 /);
  assert.match(luckVerdict(2.5), /^very lucky: only about 1 session in 1\d\d /);
});
