// engine.test.mjs — the strategy engine against published facts.
//
//   node --test test/
//
// Published references (data to check against; docs/VALIDATION.md has the
// full comparison and every disagreement):
//  * Wizard of Odds basic strategy calculator tables: 1 deck, 2 decks, 4+ decks,
//    S17/H17. Columns 2..A, then the European no-hole-card 10 and A columns.
//    https://wizardofodds.com/games/blackjack/strategy/calculator/
//  * Wizard of Odds house edge calculator ("optimal" = composition-dependent,
//    shuffle after every hand). https://wizardofodds.com/games/blackjack/calculator/
//  * Wizard of Odds Double Exposure page (strategy charts, rule effects, games).
//    https://wizardofodds.com/games/double-exposure/
//
// Deterministic: no wall clock, no randomness.

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRules, rulesFor, chartKey, UPCARDS, PRESETS } from '../js/engine/rules.js';
import { fullShoe, removeCards, shoeAtTrueCount, shoeSize } from '../js/engine/shoe.js';
import { dealerProbs, dealerProbsFromHand } from '../js/engine/dealer.js';
import { splitHandCounts, houseEdgeCD, chooseCode, resolveCode } from '../js/engine/ev.js';
import { getChart, computeChart, decide, takeInsurance, houseEdge } from '../js/engine/strategy.js';
import { getDEChart, decideDE, computeDEChart, houseEdgeDE } from '../js/engine/de.js';
import { CHARTS } from '../js/data/charts.js';
import { computeIndex } from '../js/engine/indices.js';
import { DEVIATIONS } from '../js/data/deviations.js';

// ---------------------------------------------------------------------------
// Published charts (Wizard of Odds strategy calculator), verbatim codes.
// Rows: hard 5-21, soft 13-21, pairs 2,2..A,A. Columns: 2 3 4 5 6 7 8 9 T A,
// then European (no hole card) T and A.
// DH double/hit, DS double/stand, QH split if DAS else hit, QD split if DAS else
// double, QS split if DAS else stand, RH/RS/RP surrender if allowed else H/S/P.
const WIZARD = {
 '1d-h17': `
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H DH DH H H H H H H H
DH DH DH DH DH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
DH DH DH DH DH DH DH DH DH DH H H
H H S S S H H H H H H RH
S S S S S H H H H H H RH
S S S S S H H H H H RH RH
S S S S S H H H H RH RH RH
S S S S S H H H RH RH RH RH
S S S S S S S S S RS S RS
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
DH DH DH DH DH H H H H H H H
S DS DS DS DS S S H H H H H
S S S S DS S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
QH P P P P P H H H H H RH
QH QH P P P P QH H H H H RH
H H QH QD QD H H H H H H H
DH DH DH DH DH DH DH DH H H H H
P P P P P QH H H H H H RH
P P P P P P QH H RS RH RS RH
P P P P P P P P P P RH RH
P P P P P S P P S QS S S
S S S S S S S S S S S S
P P P P P P P P P P P H `,
 '1d-s17': `
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H DH DH H H H H H H H
DH DH DH DH DH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
DH DH DH DH DH DH DH DH DH DH H H
H H S S S H H H H H H RH
S S S S S H H H H H H RH
S S S S S H H H H H RH RH
S S S S S H H H H H RH RH
S S S S S H H H RH RH RH RH
S S S S S S S S S S S RS
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
DH DH DH DH DH H H H H H H H
S DS DS DS DS S S H H S H S
S S S S DS S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
QH P P P P P H H H H H H
QH QH P P P P QH H H H H RH
H H QH QD QD H H H H H H H
DH DH DH DH DH DH DH DH H H H H
P P P P P QH H H H H H RH
P P P P P P QH H RS H RS RH
P P P P P P P P P P RH RH
P P P P P S P P S S S S
S S S S S S S S S S S S
P P P P P P P P P P P H `,
 '2d-h17': `
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H H
DH DH DH DH DH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
DH DH DH DH DH DH DH DH DH DH H H
H H S S S H H H H H H RH
S S S S S H H H H H H RH
S S S S S H H H H H RH RH
S S S S S H H H RH RH RH RH
S S S S S H H H RH RH RH RH
S S S S S S S S S RS S RS
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
H H H DH DH H H H H H H H
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
H DH DH DH DH H H H H H H H
DS DS DS DS DS S S H H H H H
S S S S DS S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
QH QH P P P P H H H H H RH
QH QH P P P P H H H H H RH
H H H QH QH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
P P P P P QH H H H H H RH
P P P P P P QH H H H RH RH
P P P P P P P P P RP RH RH
P P P P P S P P S S S S
S S S S S S S S S S S S
P P P P P P P P P P P H `,
 '2d-s17': `
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H H
DH DH DH DH DH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
DH DH DH DH DH DH DH DH DH DH H H
H H S S S H H H H H H RH
S S S S S H H H H H H RH
S S S S S H H H H H RH RH
S S S S S H H H RH H RH RH
S S S S S H H H RH RH RH RH
S S S S S S S S S S S RS
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
H H H DH DH H H H H H H H
H H H DH DH H H H H H H H
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
H DH DH DH DH H H H H H H H
S DS DS DS DS S S H H H H H
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
QH QH P P P P H H H H H H
QH QH P P P P H H H H H RH
H H H QH QH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
P P P P P QH H H H H H RH
P P P P P P QH H H H RH RH
P P P P P P P P P P RH RH
P P P P P S P P S S S S
S S S S S S S S S S S S
P P P P P P P P P P P H `,
 '4plus-h17': `
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H H
H DH DH DH DH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
DH DH DH DH DH DH DH DH DH DH H H
H H S S S H H H H H H RH
S S S S S H H H H H H RH
S S S S S H H H H H RH RH
S S S S S H H H RH RH RH RH
S S S S S H H RH RH RH RH RH
S S S S S S S S S RS S RS
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
H H H DH DH H H H H H H H
H H H DH DH H H H H H H H
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
H DH DH DH DH H H H H H H H
DS DS DS DS DS S S H H H H H
S S S S DS S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
QH QH P P P P H H H H H RH
QH QH P P P P H H H H H RH
H H H QH QH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
QH P P P P H H H H H H RH
P P P P P P H H H H RH RH
P P P P P P P P P RP RH RH
P P P P P S P P S S S S
S S S S S S S S S S S S
P P P P P P P P P P P H `,
 '4plus-s17': `
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H RH
H H H H H H H H H H H H
H DH DH DH DH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
DH DH DH DH DH DH DH DH DH H H H
H H S S S H H H H H H RH
S S S S S H H H H H H RH
S S S S S H H H H H RH RH
S S S S S H H H RH H RH RH
S S S S S H H RH RH RH RH RH
S S S S S S S S S S S RS
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
H H H DH DH H H H H H H H
H H H DH DH H H H H H H H
H H DH DH DH H H H H H H H
H H DH DH DH H H H H H H H
H DH DH DH DH H H H H H H H
S DS DS DS DS S S H H H H H
S S S S S S S S S S S S
S S S S S S S S S S S S
S S S S S S S S S S S S
QH QH P P P P H H H H H H
QH QH P P P P H H H H H RH
H H H QH QH H H H H H H H
DH DH DH DH DH DH DH DH H H H H
QH P P P P H H H H H H RH
P P P P P P H H H H RH RH
P P P P P P P P P P RH RH
P P P P P S P P S S S S
S S S S S S S S S S S S
P P P P P P P P P P P H `,
};
const WIZ_ROWS = [
  ...Array.from({ length: 17 }, (_, i) => ['hard', String(i + 5)]),
  ...Array.from({ length: 9 }, (_, i) => ['soft', String(i + 13)]),
  ...['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'].map((p) => ['pairs', p]),
];
const parseWiz = (s) => s.trim().split('\n').map((l) => l.trim().split(/\s+/));

// Both charts in one vocabulary for a given rule set.
function wizCanon(code, r) {
  const d = r.das, s = r.surrender === 'late';
  return {
    DH: 'D', DS: 'Ds', H: 'H', S: 'S', P: 'P',
    QH: d ? 'P' : 'H', QD: d ? 'P' : 'D', QS: d ? 'P' : 'S',
    RH: s ? 'Rh' : 'H', RS: s ? 'Rs' : 'S', RP: s ? 'Rp' : 'P',
  }[code];
}
const ourCanon = (code, r) => (code === 'Ph' ? (r.das ? 'P' : 'H') : code);

function compareWithWizard(rules) {
  const r = normalizeRules(rules);
  const chart = getChart(r);
  const tbl = parseWiz(WIZARD[`${r.decks === 1 ? '1d' : r.decks === 2 ? '2d' : '4plus'}-${r.hitSoft17 ? 'h17' : 's17'}`]);
  const mism = [];
  WIZ_ROWS.forEach(([t, row], i) => {
    UPCARDS.forEach((up, j) => {
      const col = !r.peek && up === '10' ? 10 : !r.peek && up === 'A' ? 11 : j;
      const w = wizCanon(tbl[i][col], r);
      const o = ourCanon(chart[t][row][up], r);
      if (w !== o) mism.push(`${t} ${row} v ${up}: engine ${o}, published ${w}`);
    });
  });
  return mism;
}

// Cells where the engine and the published chart disagree, each written up in
// docs/VALIDATION.md. Everything else must match.
const DOCUMENTED = {
  // 8,8 vs A, 2 decks H17 DAS LS: the published table is shared by DAS and
  // no-DAS games, so it cannot say "surrender without DAS, split with DAS".
  // Engine: split -0.4965 vs surrender -0.5000 with DAS (Rp without DAS).
  'classic-2d-h17-das-dany-ls-peek-sp4-nrsa-nhsa': ['pairs 8 v A: engine P, published Rp'],
};

test('every precomputed matrix chart matches the published chart (except documented cells)', () => {
  let cells = 0;
  for (const decks of [1, 2, 4, 6, 8]) for (const hitSoft17 of [false, true]) for (const das of [true, false]) for (const ls of [true, false]) {
    const r = normalizeRules({ decks, hitSoft17, das, surrender: ls ? 'late' : 'none' });
    assert.ok(CHARTS[chartKey(r)], `not precomputed: ${chartKey(r)}`);
    const mism = compareWithWizard(r);
    assert.deepEqual(mism, DOCUMENTED[chartKey(r)] || [], chartKey(r));
    cells += WIZ_ROWS.length * 10;
  }
  assert.equal(cells, 40 * 360);
});

test('European no-hole-card charts match the published European columns', () => {
  for (const decks of [6, 8]) for (const hitSoft17 of [false, true]) {
    const r = normalizeRules({ decks, hitSoft17, das: true, surrender: 'none', peek: false });
    assert.deepEqual(compareWithWizard(r), [], chartKey(r));
  }
});

test('6D H17 DAS LS (the default preset) matches the published chart in all 360 cells', () => {
  assert.deepEqual(compareWithWizard(rulesFor('shoe-6d-h17')), []);
});

test('charts.js is in step with the engine (fresh computation = stored chart)', () => {
  for (const id of ['shoe-6d-h17', 'sd-32']) {
    const r = rulesFor(id);
    const stored = CHARTS[chartKey(r)];
    const fresh = computeChart(r);
    for (const t of ['hard', 'soft', 'pairs']) for (const row in fresh[t]) for (const up of UPCARDS) {
      assert.equal(stored[t][row][up], fresh[t][row][up], `${id} ${t} ${row} ${up}`);
      for (const k in fresh.ev[t][row][up]) {
        assert.ok(Math.abs(stored.ev[t][row][up][k] - fresh.ev[t][row][up][k]) <= 0.00005, `${id} ev ${t} ${row} ${up} ${k}`);
      }
    }
    assert.ok(Math.abs(stored.houseEdge - fresh.houseEdge) < 1e-4);
  }
});

test('every preset has a precomputed chart', () => {
  for (const p of PRESETS) assert.ok(CHARTS[chartKey(rulesFor(p.id))], p.id);
});

// ---------------------------------------------------------------------------
// Famous cells

test('11 vs A: double in H17 shoes, hit in S17 shoes', () => {
  assert.equal(getChart(rulesFor('shoe-6d-h17')).hard['11'].A, 'D');
  assert.equal(getChart(rulesFor('shoe-6d-s17')).hard['11'].A, 'H');
});

test('16 vs 10 surrenders in late-surrender games, hits without', () => {
  assert.equal(getChart(rulesFor('shoe-6d-h17')).hard['16']['10'], 'Rh');
  assert.equal(getChart(rulesFor('shoe-6d-s17')).hard['16']['10'], 'Rh');
  assert.equal(getChart(rulesFor('dd-pitch')).hard['16']['10'], 'H');
});

test('soft 18 vs 2 doubles in H17, stands in S17 (multi-deck)', () => {
  assert.equal(getChart(rulesFor('shoe-6d-h17')).soft['18']['2'], 'Ds');
  assert.equal(getChart(rulesFor('shoe-6d-s17')).soft['18']['2'], 'S');
});

test('8,8 vs A in 6D H17 LS: surrender, else split (Rp)', () => {
  assert.equal(getChart(rulesFor('shoe-6d-h17')).pairs['8'].A, 'Rp');
  assert.equal(getChart(rulesFor('shoe-6d-s17')).pairs['8'].A, 'P');
});

test('split-if-DAS cells are coded Ph in DAS charts and H without DAS', () => {
  const das = getChart(rulesFor('shoe-6d-h17'));
  assert.equal(das.pairs['2']['2'], 'Ph');
  assert.equal(das.pairs['4']['5'], 'Ph');
  const nodas = getChart({ decks: 6, hitSoft17: true, das: false, surrender: 'late' });
  assert.equal(nodas.pairs['2']['2'], 'H');
  assert.equal(nodas.pairs['4']['5'], 'H');
});

test('ENHC: no doubling 11 vs 10 or A, no splitting 8,8 or A,A vs A', () => {
  const c = getChart(rulesFor('euro-enhc'));
  assert.equal(c.hard['11']['10'], 'H');
  assert.equal(c.hard['11'].A, 'H');
  assert.equal(c.hard['10']['10'], 'H');
  assert.equal(c.pairs['8']['10'], 'H');
  assert.equal(c.pairs['8'].A, 'H');
  assert.equal(c.pairs.A.A, 'H');
  // ...but the same cells are doubles / splits with a peek.
  const us = getChart({ decks: 6, hitSoft17: false, das: true, surrender: 'none' });
  assert.equal(us.hard['11']['10'], 'D');
  assert.equal(us.pairs['8'].A, 'P');
});

test('single deck 4,4 vs 5: split with DAS, double without (Wizard "QD")', () => {
  assert.equal(getChart({ decks: 1, hitSoft17: true, das: true, surrender: 'none' }).pairs['4']['5'], 'P');
  assert.equal(getChart({ decks: 1, hitSoft17: true, das: false, surrender: 'none' }).pairs['4']['5'], 'D');
});

test('every chart cell has stand and hit EVs, and the code is the best action', () => {
  const c = getChart(rulesFor('shoe-6d-h17'));
  const val = { S: 'stand', H: 'hit', D: 'double', Ds: 'double', P: 'split', Ph: 'split', Rh: 'surrender', Rs: 'surrender', Rp: 'surrender' };
  for (const t of ['hard', 'soft', 'pairs']) for (const row in c[t]) for (const up of UPCARDS) {
    const ev = c.ev[t][row][up];
    assert.equal(typeof ev.stand, 'number');
    assert.equal(typeof ev.hit, 'number');
    const best = Math.max(...['stand', 'hit', 'double', 'split', 'surrender'].filter((k) => ev[k] !== undefined).map((k) => ev[k]));
    assert.ok(ev[val[c[t][row][up]]] >= best - 0.0001, `${t} ${row} ${up}`);
  }
});

// ---------------------------------------------------------------------------
// House edge

// Wizard of Odds house edge calculator, "optimal results" (composition-
// dependent, shuffle every hand), resplit to 4, no RSA, no hit split aces.
const WIZARD_EDGE = [
  [{ decks: 6, hitSoft17: false, das: true, surrender: 'none' }, 0.403115],
  [{ decks: 6, hitSoft17: true, das: true, surrender: 'late' }, 0.527409],
  [{ decks: 6, hitSoft17: false, das: true, surrender: 'late' }, 0.330512],
  [{ decks: 8, hitSoft17: false, das: true, surrender: 'late' }, 0.355143],
  [{ decks: 2, hitSoft17: true, das: true, surrender: 'none' }, 0.379879],
  [{ decks: 1, hitSoft17: true, das: false, surrender: 'none' }, 0.151762],
  [{ decks: 6, hitSoft17: false, das: true, surrender: 'none', peek: false }, 0.514166],
  [{ decks: 6, hitSoft17: false, das: false, surrender: 'none', maxSplitHands: 2 }, 0.578785],
];

test('composition-dependent house edge within 0.005% of the published figures', () => {
  for (const [r, published] of WIZARD_EDGE) {
    const rules = normalizeRules(r);
    const c = CHARTS[chartKey(rules)];
    const edge = c ? c.houseEdgeCD : houseEdgeCD(rules).edge;
    assert.ok(Math.abs(edge - published) < 0.005, `${chartKey(rules)}: engine ${edge.toFixed(4)} vs ${published}`);
  }
});

test('resplitting to 4 hands is worth about 0.053% (published calculator 0.0538%)', () => {
  // The Wizard of Odds rule-variations page lists "may not resplit" at -0.10%,
  // but the same site's house-edge calculator gives 0.0538% (6D S17 DAS) and
  // 0.0548% (8D); the engine agrees with the calculator, and its split-once
  // value is exact (docs/VALIDATION.md, "Resplits").
  const r = { decks: 6, hitSoft17: false, das: true, surrender: 'none' };
  const once = houseEdgeCD(normalizeRules({ ...r, maxSplitHands: 2 })).edge;
  const four = CHARTS[chartKey(normalizeRules(r))].houseEdgeCD;
  assert.ok(Math.abs(once - four - 0.0538) < 0.002, `resplit effect ${once - four}`);
});

test('basic-strategy house edge for the default game: 0.531% (published 0.5305%)', () => {
  // Published "basic strategy with continuous shuffler" = 0.527409 + 0.0231 - 0.020.
  assert.ok(Math.abs(houseEdge(rulesFor('shoe-6d-h17')) - 0.5305) < 0.002);
});

test('rule effects: H17 about +0.2%, 6:5 about +1.36 to +1.39%', () => {
  const h17 = houseEdge(rulesFor('shoe-6d-h17')) - houseEdge(rulesFor('shoe-6d-s17'));
  assert.ok(h17 > 0.18 && h17 < 0.22, `H17 ${h17}`);
  const sixFive = houseEdge(rulesFor('sd-65')) - houseEdge(rulesFor('sd-32'));
  assert.ok(Math.abs(sixFive - 1.3948) < 0.002, `6:5 single deck ${sixFive}`); // published +1.394773
  const sixFive6 = houseEdge({ ...rulesFor('shoe-6d-h17'), bjPays: 1.2 }) - houseEdge(rulesFor('shoe-6d-h17'));
  assert.ok(Math.abs(sixFive6 - 1.3597) < 0.002, `6:5 six decks ${sixFive6}`); // published +1.359690
});

test('houseEdge is cheap for precomputed charts and depends on the payout', () => {
  const r = rulesFor('sd-32');
  const c = getChart(r);
  assert.equal(c.houseEdgeBjPays, 1.5);
  assert.ok(c.pBlackjackNoDealerBj > 0.04 && c.pBlackjackNoDealerBj < 0.05);
  assert.ok(Math.abs(houseEdge({ ...r, bjPays: 1 }) - (c.houseEdge + 0.5 * c.pBlackjackNoDealerBj * 100)) < 1e-9);
});

test('charts are plain JSON', () => {
  for (const c of [getChart(rulesFor('shoe-6d-h17')), getDEChart(rulesFor('double-exposure'))]) {
    assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
  }
});

// ---------------------------------------------------------------------------
// Building blocks

test('dealer probabilities: six decks S17', () => {
  const s = fullShoe(6);
  const d6 = dealerProbs(removeCards(s, [6]), 6, { hitSoft17: false, peek: true });
  assert.ok(Math.abs(d6.bust - 0.42284) < 1e-4);
  const dA = dealerProbs(removeCards(s, [1]), 1, { hitSoft17: false, peek: true });
  assert.equal(dA.bj, 0);
  assert.ok(Math.abs(dA.bust - 0.16703) < 1e-4);
  const sum = Object.values(dA).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  const enhc = dealerProbs(removeCards(s, [10]), 10, { hitSoft17: false, peek: false });
  assert.ok(Math.abs(enhc.bj - 24 / 311) < 1e-12); // 24 aces left in 311 cards
  // Double Exposure: a dealer standing on 18 never draws.
  assert.equal(dealerProbsFromHand(removeCards(s, [10, 8]), [10, 8], { hitSoft17: true })['18'], 1);
});

test('split hand counts', () => {
  assert.deepEqual(splitHandCounts(0, 4), [2, 0]);
  const [np, pp] = splitHandCounts(0.1, 2);
  assert.ok(Math.abs(np - 1.8) < 1e-12 && Math.abs(pp - 0.2) < 1e-12);
  const [np4, pp4] = splitHandCounts(0.1, 4);
  assert.ok(np4 > 2 && np4 + pp4 < 4);
});

test('code choice and resolution', () => {
  assert.equal(chooseCode({ stand: -0.54, hit: -0.53, surrender: -0.5 }, true), 'Rh');
  assert.equal(chooseCode({ stand: 0.1, hit: 0.05, double: 0.12 }, true), 'Ds');
  assert.equal(chooseCode({ stand: -0.2, hit: -0.1, split: 0.0, splitNoDas: -0.15 }, true), 'Ph');
  assert.equal(chooseCode({ stand: -0.2, hit: -0.1, split: 0.0, splitNoDas: -0.15 }, false), 'P');
  assert.equal(resolveCode('Ds', { canDouble: false }), 'S');
  assert.equal(resolveCode('Rp', { canSurrender: false, canSplit: false }), null);
});

test('true-count shoes keep their size and Hi-Lo balance', () => {
  const s = shoeAtTrueCount(2, 3);
  assert.ok(Math.abs(shoeSize(s) - 156) < 1e-9);
  // RC of the dealt cards = TC * decks remaining.
  const low = s[2] + s[3] + s[4] + s[5] + s[6], high = s[1] + s[10];
  assert.ok(Math.abs((high - low) - 2 * 3) < 1e-9);
});

// ---------------------------------------------------------------------------
// decide()

const H17 = rulesFor('shoe-6d-h17');
const S17NS = normalizeRules({ decks: 6, hitSoft17: false, das: true, surrender: 'none' });

test('decide: surrender only on the first two cards of an unsplit hand', () => {
  assert.equal(decide([10, 6], 10, H17).action, 'surrender');
  assert.equal(decide([10, 6], 10, H17, { canSurrender: false }).action, 'hit');
  assert.equal(decide([10, 4, 2], 10, H17).action, 'hit');
  assert.equal(decide([10, 6], 10, H17, { splitCount: 1 }).action, 'hit');
  assert.equal(decide([10, 7], 1, H17).action, 'surrender'); // Rs
  assert.equal(decide([10, 4, 3], 1, H17).action, 'stand');
});

test('decide: doubles fall back after three cards', () => {
  assert.equal(decide([5, 6], 6, H17).action, 'double');
  assert.equal(decide([5, 3, 3], 6, H17).action, 'hit');
  assert.equal(decide([1, 7], 3, H17).action, 'double');
  const r = decide([1, 4, 3], 3, H17); // soft 18, Ds -> stand
  assert.deepEqual([r.action, r.code, r.table, r.row], ['stand', 'Ds', 'soft', '18']);
  // No double after split without DAS.
  assert.equal(decide([5, 6], 6, { ...H17, das: false }, { splitCount: 1 }).action, 'hit');
  // Restricted doubling: hard 9-11 only.
  assert.equal(decide([1, 7], 4, { ...H17, doubleOn: '9-11' }).action, 'stand');
  assert.equal(decide([4, 5], 4, { ...H17, doubleOn: '10-11' }).action, 'hit');
});

test('decide: splits respect the hand limit and resplit-aces rule', () => {
  const r = decide([8, 8], 1, H17);
  assert.deepEqual([r.action, r.code, r.table], ['surrender', 'Rp', 'pairs']);
  assert.equal(decide([8, 8], 1, H17, { splitCount: 1 }).action, 'split');
  const capped = decide([8, 8], 1, H17, { splitCount: 3 }); // 4 hands already
  assert.deepEqual([capped.action, capped.table, capped.row], ['hit', 'hard', '16']);
  assert.equal(decide([1, 1], 6, H17).action, 'split');
  assert.deepEqual(decide([1, 1], 6, H17, { splitCount: 1 }).table, 'soft'); // no resplit of aces
  assert.equal(decide([1, 1], 6, { ...H17, resplitAces: true }, { splitCount: 1 }).action, 'split');
  assert.equal(decide([2, 2], 2, H17).action, 'split'); // Ph with DAS
  assert.equal(decide([8, 8], 10, H17, { canSplit: false }).action, 'surrender'); // hard 16 row
  assert.equal(decide([10, 10], 6, H17).action, 'stand');
});

test('decide: deviations from an override list', () => {
  const list = [
    { id: 'i18-16v10', set: 'i18', table: 'hard', row: '16', up: '10', index: 0, when: 'ge', action: 'S', otherwise: 'H' },
    { id: 'i18-13v2', set: 'i18', table: 'hard', row: '13', up: '2', index: -2, when: 'le', action: 'H', otherwise: 'S' },
    { id: 'i18-TTv6', set: 'i18', table: 'pairs', row: '10', up: '6', index: 4, when: 'ge', action: 'P', otherwise: 'S' },
    { id: 'i18-10v10', set: 'i18', table: 'hard', row: '10', up: '10', index: 4, when: 'ge', action: 'D', otherwise: 'H' },
    { id: 'fab4-14v10', set: 'fab4', table: 'hard', row: '14', up: '10', index: 3, when: 'ge', action: 'R', otherwise: 'H' },
    { id: 'fab4-15v10', set: 'fab4', table: 'hard', row: '15', up: '10', index: -1, when: 'le', action: 'H', otherwise: 'R' },
    { id: 'basic-11vA', set: 'basic', table: 'hard', row: '11', up: 'A', action: 'D', otherwise: 'D' },
    { id: 'insurance', set: 'insurance', table: 'insurance', row: '*', up: 'A', index: 3, when: 'ge', action: 'insure', otherwise: 'decline' },
  ];
  const o = (tc, indexSet = 'i18fab4', extra = {}) => ({ tc, indexSet, deviations: list, ...extra });
  // No surrender: the I18 stand index.
  let r = decide([10, 6], 10, S17NS, o(0));
  assert.deepEqual([r.action, r.source, r.deviation.id], ['stand', 'deviation', 'i18-16v10']);
  assert.equal(decide([10, 6], 10, S17NS, o(-1)).action, 'hit');
  assert.equal(decide([10, 6], 10, S17NS, { indexSet: 'none', tc: 5, deviations: list }).action, 'hit');
  assert.equal(decide([10, 6], 10, S17NS, { indexSet: 'i18', deviations: list }).action, 'hit'); // no tc
  // Late surrender: 16 v 10 stays a surrender at any count on two cards...
  assert.equal(decide([10, 6], 10, H17, o(2)).action, 'surrender');
  // ...and the stand index applies to three cards.
  assert.equal(decide([10, 4, 2], 10, H17, o(2)).action, 'stand');
  // 'le' entries.
  assert.equal(decide([10, 3], 2, S17NS, o(-2)).action, 'hit');
  assert.equal(decide([10, 3], 2, S17NS, o(-1)).action, 'stand');
  // Pairs and doubles.
  assert.equal(decide([10, 10], 6, S17NS, o(4)).action, 'split');
  assert.equal(decide([10, 10], 6, S17NS, o(3)).action, 'stand');
  assert.equal(decide([6, 4], 10, S17NS, o(4)).action, 'double');
  assert.equal(decide([5, 5], 10, S17NS, o(4)).action, 'double'); // 5,5 is a hard 10
  assert.equal(decide([6, 2, 2], 10, S17NS, o(4)).action, 'hit'); // can't double 3 cards
  // Fab 4, both spellings, only in the i18fab4 set and only while surrender is possible.
  assert.equal(decide([10, 4], 10, H17, o(3)).action, 'surrender');
  assert.equal(decide([10, 4], 10, H17, o(3, 'i18')).action, 'hit');
  assert.equal(decide([10, 4], 10, H17, o(2)).action, 'hit');
  assert.equal(decide([10, 5], 10, H17, o(0)).action, 'surrender');
  r = decide([10, 5], 10, H17, o(-1));
  assert.deepEqual([r.action, r.source, r.deviation.id], ['hit', 'deviation', 'fab4-15v10']);
  assert.equal(decide([10, 5], 10, H17, o(-1, 'i18')).action, 'surrender'); // basic Rh
  // 'basic' entries are never applied.
  assert.equal(decide([6, 5], 1, H17, o(-5)).action, 'double');
  // Insurance.
  assert.equal(takeInsurance(3, H17, { deviations: list }), true);
  assert.equal(takeInsurance(2, H17, { deviations: list }), false);
  assert.equal(takeInsurance(undefined, H17), false);
  assert.equal(decide([10, 6], 1, H17, { insurance: true, tc: 4, deviations: list }).action, 'insurance');
  assert.equal(decide([10, 6], 1, H17, { insurance: true, tc: 0, deviations: list }).action, 'insurance-no');
});

// ---------------------------------------------------------------------------
// Double Exposure

test('Double Exposure preset: spot checks against the published chart', () => {
  const de = rulesFor('double-exposure');
  const c = getDEChart(de);
  assert.equal(c.variant, 'de');
  assert.equal(c.cols.length, 26);
  assert.equal(c.hard['12'].h4, 'S');      // stand on a stiff vs a dealer stiff
  assert.equal(c.hard['16'].h12, 'S');
  assert.equal(c.hard['16'].h7, 'H');
  assert.equal(c.hard['17'].h17, 'H');     // ties lose: hit 17 vs 17
  assert.equal(c.hard['20'].h20, 'H');
  assert.equal(c.hard['19'].h18, 'S');
  assert.equal(c.pairs['10'].h14, 'P');    // split tens vs a dealer stiff
  assert.equal(c.pairs['10'].h20, 'H');
  assert.equal(c.pairs.A.h11, 'H');
  assert.equal(c.hard['11'].h10, 'H');
  assert.equal(c.hard['10'].h4, 'D');
  assert.equal(c.hard['7'].h14, 'H');      // doubling 7 needs "any two cards"; preset is hard 9-11
  assert.ok(Math.abs(c.houseEdge - 1.15) < 0.01);
});

test('decideDE', () => {
  const de = rulesFor('double-exposure');
  assert.equal(decideDE([10, 6], [10, 2], de).action, 'stand');
  assert.equal(decideDE([10, 6], [10, 7], de).action, 'hit');
  assert.equal(decideDE([10, 10], [10, 4], de).action, 'split');
  assert.equal(decideDE([10, 10], [10, 4], de, { splitCount: 1 }).action, 'stand'); // split once only
  assert.equal(decideDE([5, 6], [10, 6], de).action, 'double');
  assert.equal(decideDE([5, 3, 3], [10, 6], de).action, 'hit');
  assert.equal(decideDE([10, 6], [1, 10], de).action, 'none'); // dealer blackjack
  const r = decideDE([1, 7], [9, 4], de);
  assert.deepEqual([r.table, r.row, r.col], ['soft', '18', 'h13']);
});

test('Double Exposure house edges and rule effects vs the published figures', () => {
  // Grand (Tunica): 6D S17, hard 9-11, no DAS, tied blackjack wins, split once: 0.96%.
  const grand = normalizeRules({ variant: 'de', decks: 6, hitSoft17: false, doubleOn: '9-11', das: false,
    maxSplitHands: 2, surrender: 'none', bjPays: 1, deTiesLose: true, dePlayerBjWinsTie: true });
  const g = houseEdgeDE(grand);
  assert.ok(Math.abs(g - 0.96) < 0.01, `Grand ${g}`);
  // Tied blackjack wins vs pushes: published +0.22%.
  const push = houseEdgeDE({ ...grand, dePlayerBjWinsTie: false });
  assert.ok(Math.abs(push - g - 0.22) < 0.02, `tie rule ${push - g}`);
});

test('Double Exposure 8D S17 any-double DAS chart vs the published chart', () => {
  // The published chart is effectively infinite-deck; at 8 decks card removal
  // moves exactly these cells (docs/VALIDATION.md). At 100 decks all but 3
  // near-ties match (checked outside the test suite: the rules model allows 1-8 decks).
  const c = computeDEChart({ variant: 'de', decks: 8, hitSoft17: false, das: true, doubleOn: 'any', maxSplitHands: 2,
    surrender: 'none', bjPays: 1 });
  assert.equal(c.soft['14'].h6, 'D');   // published H (EV gap 0.0073 at 8 decks)
  assert.equal(c.pairs['4'].h6, 'Ph');  // published H (0.0106)
  assert.equal(c.soft['18'].h13, 'Ds'); // published Dh (stand vs hit differ by 0.0004)
  assert.equal(c.soft['19'].h12, 'Ds');
  assert.equal(c.pairs['5'].h16, 'P');  // published P/D
  assert.equal(c.pairs['9'].s16, 'P');  // published P/S
  assert.equal(c.hard['14'].h11, 'S');
});

// ---------------------------------------------------------------------------
// Index cross-check (engine estimate of where a deviation becomes correct)

test('computeIndex: engine crossovers near the published indices (6D S17, half the shoe left)', () => {
  const r = rulesFor('shoe-6d-s17');
  const near = (play, published, tol) => {
    const x = computeIndex(play, r).exact;
    assert.ok(Math.abs(x - published) <= tol, `${play.table} ${play.row} v ${play.up}: engine ${x}, published ${published}`);
    return x;
  };
  near({ table: 'insurance', row: '*', up: 'A', action: 'insure' }, 3, 0.2);                    // 3.05
  near({ table: 'hard', row: '15', up: '10', action: 'S', otherwise: 'H' }, 4, 0.3);           // 4.10
  near({ table: 'hard', row: '13', up: '2', action: 'H', otherwise: 'S' }, -1, 0.3);           // -1.02
  near({ table: 'hard', row: '14', up: '10', action: 'R', otherwise: 'H' }, 3, 0.6);           // 3.40
  near({ table: 'pairs', row: '10', up: '5', action: 'P', otherwise: 'S' }, 5, 0.3);           // 4.91
  // Two-card 16s only: the published 0 also covers 3+ card 16s, which stand sooner.
  near({ table: 'hard', row: '16', up: '10', action: 'S', otherwise: 'H' }, 0, 1.5);           // 1.30
});

// ---------------------------------------------------------------------------
// The real js/data/deviations.js, entry by entry: decide() must play `action`
// on the index side of the count and `otherwise` one count past it.


// A two-card hand for a deviation cell (no pairs except in the pairs table).
function handFor(e) {
  if (e.table === 'pairs') { const x = e.row === 'A' ? 1 : Number(e.row); return [x, x]; }
  const t = Number(e.row);
  if (e.table === 'soft') return [1, t - 11];
  return t > 11 ? [10, t - 10] : t === 11 ? [6, 5] : t === 10 ? [6, 4] : t === 9 ? [5, 4] : [t - 3, 3];
}

test('every real deviation entry flips the play exactly at its index (S17 and H17)', () => {
  const NAME = { S: 'stand', H: 'hit', D: 'double', P: 'split', R: 'surrender' };
  let checked = 0;
  for (const game of ['s17', 'h17']) {
    const list = DEVIATIONS[game];
    assert.ok(Array.isArray(list) && list.length > 0, game);
    for (const e of list) {
      if (e.set === 'basic') continue;
      // Surrender entries are played where surrender is offered; the I18 plays
      // where it is not (they apply when you cannot surrender).
      const surrenderEntry = e.action === 'R' || e.otherwise === 'R';
      const rules = normalizeRules({ decks: 6, hitSoft17: game === 'h17', das: true, surrender: surrenderEntry ? 'late' : 'none' });
      if (e.set === 'insurance') {
        assert.equal(takeInsurance(e.index, rules), true, e.id);
        assert.equal(takeInsurance(e.index - 1, rules), false, e.id);
        assert.equal(takeInsurance(e.index + 1, rules), true, e.id);
        assert.equal(decide([10, 6], 1, rules, { insurance: true, tc: e.index }).action, 'insurance', e.id);
        checked++;
        continue;
      }
      const hand = handFor(e);
      const up = e.up === 'A' ? 1 : Number(e.up);
      const at = (tc) => decide(hand, up, rules, { tc, indexSet: 'i18fab4' });
      const inside = e.when === 'le' ? e.index - 1 : e.index + 1;   // further into the deviation side
      const outside = e.when === 'le' ? e.index + 1 : e.index - 1;  // one count past the index
      for (const tc of [e.index, inside]) {
        const r = at(tc);
        assert.equal(r.action, NAME[e.action], `${game} ${e.id} at TC ${tc}`);
        assert.equal(r.deviation && r.deviation.id, e.id, `${game} ${e.id} at TC ${tc}: entry used`);
      }
      assert.equal(at(outside).action, NAME[e.otherwise], `${game} ${e.id} at TC ${outside}`);
      // The I18 set alone never applies a Fab 4 entry.
      if (e.set === 'fab4') {
        const basic = decide(hand, up, rules);
        assert.equal(decide(hand, up, rules, { tc: e.index, indexSet: 'i18' }).action, basic.action, `${e.id} not in i18`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 40, `checked ${checked}`);
});

test('the printed index and the floored-count index agree (le entries are printed - 1)', () => {
  for (const game of ['s17', 'h17']) for (const e of DEVIATIONS[game]) {
    if (e.set === 'basic' || e.printed === undefined) continue;
    assert.equal(e.index, e.when === 'le' ? e.printed - 1 : e.printed, `${game} ${e.id}`);
  }
});
