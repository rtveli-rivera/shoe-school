// sim.js agrees with the engine, counting works, and the risk formulas hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rulesFor } from '../js/engine/rules.js';
import { decide, takeInsurance, houseEdge } from '../js/engine/strategy.js';
import { decideDE, houseEdgeDE } from '../js/engine/de.js';
import { simulate } from '../js/engine/sim.js';
import { DEFAULT_RAMPS, unitsFor, describeRamp } from '../js/game/rampmath.js';
import { riskOfRuin, bankrollFor, n0, score, normCdf, probAhead } from '../js/engine/risk.js';

// Flat-betting basic strategy must reproduce the engine's house edge: two
// independent implementations (exact enumeration vs. dealt cards) of one game.
// Fixed seeds and round counts, so the test is deterministic.
for (const id of ['shoe-6d-h17', 'shoe-6d-s17', 'euro-enhc', 'sd-65']) {
  test(`flat basic strategy in the simulator matches the engine house edge: ${id}`, () => {
    const rules = rulesFor(id);
    const r = simulate({ rules, rounds: 400000, seed: 2024, ramp: () => 1, indexSet: 'none', decide, takeInsurance });
    const he = houseEdge(rules) / 100;
    const z = (r.evPerRound + he) / r.seEv;
    assert.ok(Math.abs(z) < 3.5, `sim ${(r.evPerRound * 100).toFixed(3)}% vs engine ${(-he * 100).toFixed(3)}% (z=${z.toFixed(2)})`);
  });
}

test('flat basic strategy in Double Exposure matches the engine', () => {
  const rules = rulesFor('double-exposure');
  const r = simulate({ rules, rounds: 400000, seed: 77, ramp: () => 1, indexSet: 'none', decide, decideDE, takeInsurance });
  const he = houseEdgeDE(rules) / 100;
  const z = (r.evPerRound + he) / r.seEv;
  assert.ok(Math.abs(z) < 3.5, `sim ${(r.evPerRound * 100).toFixed(3)}% vs engine ${(-he * 100).toFixed(3)}% (z=${z.toFixed(2)})`);
});

test('the count works: edge rises with the true count and a 1-12 ramp beats a 6-deck shoe', () => {
  const rules = rulesFor('shoe-6d-s17');
  const r = simulate({ rules, rounds: 600000, seed: 5, ramp: (tc) => unitsFor(DEFAULT_RAMPS.shoe, tc), indexSet: 'i18fab4', decide, takeInsurance });
  const at = (tc) => r.byTc.find((row) => row.tc === tc).edge;
  assert.ok(at(3) > at(0) + 0.008, `edge at +3 (${at(3)}) should clearly beat edge at 0 (${at(0)})`);
  assert.ok(at(-3) < at(0), 'negative counts are worse than neutral');
  assert.ok(r.evPerRound > 0, `a 1-12 spread should win: ev ${r.evPerRound}`);
  assert.ok(r.avgBet > 1 && r.avgBet < 3);
});

test('6:5 single deck cannot be beaten by the same spread', () => {
  const rules = rulesFor('sd-65');
  const r = simulate({ rules, rounds: 300000, seed: 9, ramp: (tc) => unitsFor(DEFAULT_RAMPS.single, tc), indexSet: 'i18', decide, takeInsurance });
  assert.ok(r.evPerRound < 0, `6:5 must lose: ev ${r.evPerRound}`);
});

test('risk formulas', () => {
  // ror = exp(-2 ev B / var): ev 0.02, sd 3, B 450 -> exp(-2) = 13.5%
  assert.ok(Math.abs(riskOfRuin(0.02, 3, 450) - Math.exp(-2)) < 1e-12);
  assert.equal(riskOfRuin(-0.01, 3, 1000), 1);
  assert.ok(Math.abs(bankrollFor(0.02, 3, Math.exp(-2)) - 450) < 1e-9);
  assert.equal(n0(0.02, 3), 22500);
  assert.ok(Math.abs(score(0.02, 3) - 1e6 * (0.02 / 3) ** 2) < 1e-9);
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-4);
  assert.ok(Math.abs(normCdf(-1) - 0.158655) < 1e-4);
  assert.ok(probAhead(0.02, 3, 22500) > 0.84 && probAhead(0.02, 3, 22500) < 0.842);
});

test('ramp lookup and description', () => {
  const ramp = DEFAULT_RAMPS.shoe;
  assert.equal(unitsFor(ramp, -5), 1);
  assert.equal(unitsFor(ramp, 1), 1);
  assert.equal(unitsFor(ramp, 2), 2);
  assert.equal(unitsFor(ramp, 4), 8);
  assert.equal(unitsFor(ramp, 9), 12);
  assert.deepEqual(describeRamp(ramp).map((r) => r.range), ['TC +1 or less', 'TC +2', 'TC +3', 'TC +4', 'TC +5 or more']);
});
