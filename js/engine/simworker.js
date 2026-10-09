// simworker.js — runs sim.js off the main thread (Web Worker only).
import { simulate } from './sim.js';
import { decide, takeInsurance } from './strategy.js';
import { decideDE } from './de.js';
import { unitsFor } from '../game/rampmath.js';

self.onmessage = (e) => {
  const { rules, ramp, rounds, seed, indexSet, wongOutBelow } = e.data || {};
  try {
    const result = simulate({
      rules, rounds, seed, indexSet, wongOutBelow,
      ramp: (tc) => unitsFor(ramp, tc),
      decide, decideDE, takeInsurance,
      onProgress: (f) => self.postMessage({ progress: f }),
    });
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
