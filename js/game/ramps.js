// ramps.js — default Hi-Lo bet ramps (units by true count), per game type.
//
// These are starting points of the usual shape: the minimum bet at neutral and
// negative counts, then the bet grows with each true count up to the top bet.
// The bankroll tools (sim.js / risk.js) measure what a ramp earns and risks for
// the chosen game; the student can edit it in the Tools tab.

import { settings } from '../store.js';

// steps: [{ tc, units }] read as "at this TC or higher, bet `units`". The first
// step's units apply to every count below it too.
export const DEFAULT_RAMPS = {
  shoe: { name: 'Shoe (4–8 decks), 1–12', steps: [{ tc: -99, units: 1 }, { tc: 2, units: 2 }, { tc: 3, units: 4 }, { tc: 4, units: 8 }, { tc: 5, units: 12 }] },
  double: { name: 'Double deck, 1–8', steps: [{ tc: -99, units: 1 }, { tc: 1, units: 2 }, { tc: 2, units: 4 }, { tc: 3, units: 6 }, { tc: 4, units: 8 }] },
  single: { name: 'Single deck, 1–4', steps: [{ tc: -99, units: 1 }, { tc: 1, units: 2 }, { tc: 2, units: 3 }, { tc: 3, units: 4 }] },
};

export function rampKind(rules) {
  return rules.decks >= 4 ? 'shoe' : rules.decks === 2 ? 'double' : 'single';
}

export function rampFor(rules) {
  const custom = settings().ramp;
  if (custom && custom[rampKind(rules)]) return custom[rampKind(rules)];
  return DEFAULT_RAMPS[rampKind(rules)];
}

export function unitsFor(ramp, tc) {
  let units = ramp.steps[0].units;
  for (const s of ramp.steps) if (tc >= s.tc) units = s.units;
  return units;
}

export function describeRamp(ramp) {
  return ramp.steps.map((s, i) => {
    const next = ramp.steps[i + 1];
    const range = i === 0 ? `TC ${next ? `≤ ${next.tc - 1}` : 'any'}` : next ? (next.tc - 1 === s.tc ? `TC ${s.tc >= 0 ? '+' : ''}${s.tc}` : `TC +${s.tc} to +${next.tc - 1}`) : `TC +${s.tc} or more`;
    return { range, units: s.units };
  });
}
