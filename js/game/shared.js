// shared.js — the engine as the UI sees it: current rules, charts (cached,
// computed in a worker when not precomputed), action names and colours.

import { rulesFor, presetById, chartKey, normalizeRules } from '../engine/rules.js';
import { settings } from '../store.js';

export function currentPresetId() { return settings().preset; }
export function currentPreset() { return presetById(settings().preset); }
export function currentRules() { return rulesFor(settings().preset); }

let strategyMod = null;
let deMod = null;
export async function strategy() {
  if (!strategyMod) strategyMod = await import('../engine/strategy.js');
  return strategyMod;
}
export async function doubleExposure() {
  if (!deMod) deMod = await import('../engine/de.js');
  return deMod;
}

const chartCache = new Map();

// getChart is synchronous for precomputed rule sets. For anything else it can
// take a few seconds, so it runs in a worker and the UI shows a spinner.
export async function chartFor(rulesOrPreset) {
  const rules = typeof rulesOrPreset === 'string' ? rulesFor(rulesOrPreset) : normalizeRules(rulesOrPreset);
  const key = chartKey(rules);
  if (chartCache.has(key)) return chartCache.get(key);
  const p = (async () => {
    if (rules.variant === 'de') {
      const de = await doubleExposure();
      return de.getDEChart(rules);
    }
    const { CHARTS } = await import('../data/charts.js');
    const s = await strategy();
    if (CHARTS[key] || typeof Worker === 'undefined') return s.getChart(rules);
    return computeInWorker(rules).catch(() => s.getChart(rules));
  })();
  chartCache.set(key, p);
  return p;
}

function computeInWorker(rules) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => { w.terminate(); if (e.data && e.data.ok) resolve(e.data.chart); else reject(new Error(e.data && e.data.error)); };
    w.onerror = (e) => { w.terminate(); reject(e); };
    w.postMessage({ type: 'chart', rules });
  });
}

// ---- action vocabulary ----

export const ACTIONS = {
  hit: { label: 'Hit', short: 'H', cls: 'act-H', key: 'H' },
  stand: { label: 'Stand', short: 'S', cls: 'act-S', key: 'S' },
  double: { label: 'Double', short: 'D', cls: 'act-D', key: 'D' },
  split: { label: 'Split', short: 'P', cls: 'act-P', key: 'P' },
  surrender: { label: 'Surrender', short: 'R', cls: 'act-R', key: 'R' },
};

export const CODE_TEXT = {
  S: 'Stand',
  H: 'Hit',
  D: 'Double (if you can’t, hit)',
  Ds: 'Double (if you can’t, stand)',
  P: 'Split',
  Ph: 'Split if double-after-split is allowed, otherwise hit',
  Rh: 'Surrender (if you can’t, hit)',
  Rs: 'Surrender (if you can’t, stand)',
  Rp: 'Surrender (if you can’t, split)',
};

export const CODE_SHORT = { S: 'S', H: 'H', D: 'D', Ds: 'Ds', P: 'P', Ph: 'Ph', Rh: 'Rh', Rs: 'Rs', Rp: 'Rp' };

export function rowLabel(table, row) {
  if (table === 'pairs') return row === 'A' ? 'A,A' : row === '10' ? 'T,T' : `${row},${row}`;
  if (table === 'soft') return row === '12' ? 'A,A' : `A,${Number(row) - 11}`;
  return row;
}

export function tableName(table) {
  return { hard: 'Hard totals', soft: 'Soft totals', pairs: 'Pairs' }[table] || table;
}
