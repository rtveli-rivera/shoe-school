// rampmath.js — bet ramps as data: default ramps and the TC -> units lookup.
// Pure (no storage), so the simulation worker can use it.
//
// These are starting points of the usual shape: the minimum bet at neutral and
// negative counts, then the bet grows with each true count up to the top bet.
// The bankroll tools measure what a ramp earns and risks for the chosen game;
// the student can edit it in the Tools tab.

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

export function unitsFor(ramp, tc) {
  let units = ramp.steps[0].units;
  for (const s of ramp.steps) if (tc >= s.tc) units = s.units;
  return units;
}

export function describeRamp(ramp) {
  return ramp.steps.map((s, i) => {
    const next = ramp.steps[i + 1];
    const sign = (n) => (n > 0 ? `+${n}` : String(n));
    let range;
    if (i === 0) range = next ? `TC ${sign(next.tc - 1)} or less` : 'Any count';
    else if (!next) range = `TC ${sign(s.tc)} or more`;
    else if (next.tc - 1 === s.tc) range = `TC ${sign(s.tc)}`;
    else range = `TC ${sign(s.tc)} to ${sign(next.tc - 1)}`;
    return { range, units: s.units };
  });
}
