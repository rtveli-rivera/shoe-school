// risk.js — what a win rate and its swings mean for a bankroll.
//
// Inputs are per round, in betting units: ev (mean result) and sd (standard
// deviation), as measured by sim.js for a game and a ramp. The formulas are the
// standard ones for a game with a small edge and many independent rounds:
// results over N rounds are close to normal with mean N·ev and sd √N·sd, and the
// chance of ever losing a bankroll B (in units) playing forever is
// exp(−2·ev·B / sd²).

// Risk of ruin: chance of losing the whole bankroll (units) if you never stop.
export function riskOfRuin(ev, sd, bankrollUnits) {
  if (ev <= 0) return 1;
  return Math.min(1, Math.exp((-2 * ev * bankrollUnits) / (sd * sd)));
}

// Bankroll (units) needed for a target risk of ruin.
export function bankrollFor(ev, sd, ror) {
  if (ev <= 0) return Infinity;
  return (-(sd * sd) * Math.log(ror)) / (2 * ev);
}

// N0: rounds until the expected win equals one standard deviation — roughly
// "how long until skill beats luck".
export function n0(ev, sd) {
  return ev > 0 ? (sd / ev) ** 2 : Infinity;
}

// Desirability index and SCORE (Schlesinger): scale-free measures of a game +
// ramp. SCORE = expected win per 100 rounds for a $10,000 bankroll bet at the
// optimal (13.5% risk) level; DI = 1000·ev/sd, SCORE = DI².
export function desirability(ev, sd) { return sd > 0 ? (1000 * ev) / sd : 0; }
export function score(ev, sd) { return sd > 0 ? 1e6 * (ev / sd) ** 2 : 0; }

// Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf), accurate to ~1e-7.
export function normCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

// Chance of being ahead after `rounds` rounds.
export function probAhead(ev, sd, rounds) {
  if (rounds <= 0 || sd <= 0) return 0.5;
  return normCdf((ev * rounds) / (sd * Math.sqrt(rounds)));
}

// Everything the bankroll screen shows, in dollars and hours.
// stats: { evPerRound, sdPerRound } from simulate(); unit ($); bankroll ($);
// roundsPerHour.
export function summarize({ evPerRound: ev, sdPerRound: sd }, { unit, bankroll, roundsPerHour, hours = 100 }) {
  const B = bankroll / unit;
  return {
    winPerHour: ev * roundsPerHour * unit,
    sdPerHour: sd * Math.sqrt(roundsPerHour) * unit,
    ror: riskOfRuin(ev, sd, B),
    n0Rounds: n0(ev, sd),
    n0Hours: n0(ev, sd) / roundsPerHour,
    di: desirability(ev, sd),
    score: score(ev, sd),
    bankrollFor5: bankrollFor(ev, sd, 0.05) * unit,
    bankrollFor1: bankrollFor(ev, sd, 0.01) * unit,
    aheadAfter: probAhead(ev, sd, hours * roundsPerHour),
    expectedAfter: ev * hours * roundsPerHour * unit,
    sdAfter: sd * Math.sqrt(hours * roundsPerHour) * unit,
    hours,
  };
}
