// ramps.js — the student's bet ramp: their saved custom ramp, or the default
// for the game type. The ramp math itself is in rampmath.js.

import { settings } from '../store.js';
import { DEFAULT_RAMPS, rampKind } from './rampmath.js';

export { DEFAULT_RAMPS, rampKind, unitsFor, describeRamp } from './rampmath.js';

export function rampFor(rules) {
  const custom = settings().ramp;
  if (custom && custom[rampKind(rules)]) return custom[rampKind(rules)];
  return DEFAULT_RAMPS[rampKind(rules)];
}
