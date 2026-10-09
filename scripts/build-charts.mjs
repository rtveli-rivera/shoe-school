// build-charts.mjs — precompute every strategy chart the app ships and write
// js/data/charts.js.
//
//   node scripts/build-charts.mjs
//
// Charts: every preset in rules.js, plus the matrix of common games
// (1/2/4/6/8 decks x S17/H17 x DAS/no DAS x late surrender/none, US peek) and
// European no-hole-card 6D/8D S17/H17 (DAS, no surrender). Presets that share a
// chartKey (payout, penetration and dealing style do not change a chart) are
// stored once.
//
// The file is kept small: codes are one character per cell and each EV is
// three base-64 characters holding an integer in units of 0.0001 (4 decimals,
// offset by 2^17, so -13.1 .. +13.1). charts.js unpacks them into ordinary Chart
// objects when it is imported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS, normalizeRules, chartKey, UPCARDS } from '../js/engine/rules.js';
import { computeChart, METHOD_TEXT } from '../js/engine/strategy.js';
import { computeDEChart, DE_METHOD, DE_LAYOUT } from '../js/engine/de.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js', 'data', 'charts.js');

// One character per code.
const CODE_CHAR = { S: 'S', H: 'H', D: 'D', Ds: 'd', P: 'P', Ph: 'p', Rh: 'R', Rs: 'r', Rp: 'q' };
// One letter per EV key, in a fixed order.
const EV_LETTER = [['stand', 's'], ['hit', 'h'], ['double', 'd'], ['split', 'p'], ['splitNoDas', 'n'], ['surrender', 'r']];
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const OFFSET = 131072;
function enc3(v) {
  const n = Math.round(v * 10000) + OFFSET;
  if (!(n >= 0 && n < 262144)) throw new Error(`EV out of range: ${v}`);
  return B64[n >> 12] + B64[(n >> 6) & 63] + B64[n & 63];
}
const ROWS = [
  ...Array.from({ length: 18 }, (_, i) => ['hard', String(i + 4)]),
  ...Array.from({ length: 10 }, (_, i) => ['soft', String(i + 12)]),
  ...['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'].map((p) => ['pairs', p]),
];

function ruleSets() {
  const list = [];
  const add = (r, why) => {
    const rules = normalizeRules(r);
    const key = chartKey(rules);
    const hit = list.find((x) => x.key === key);
    if (hit) { hit.why.push(why); return; }
    list.push({ key, rules, why: [why] });
  };
  for (const p of PRESETS) add({ ...p.rules, bjPays: p.rules.variant === 'de' ? (p.rules.bjPays ?? 1) : 1.5 }, `preset ${p.id}`);
  for (const decks of [1, 2, 4, 6, 8]) for (const hitSoft17 of [false, true]) for (const das of [true, false]) for (const ls of [true, false]) {
    add({ decks, hitSoft17, das, surrender: ls ? 'late' : 'none', peek: true }, 'matrix');
  }
  for (const decks of [6, 8]) for (const hitSoft17 of [false, true]) {
    add({ decks, hitSoft17, das: true, surrender: 'none', peek: false }, 'enhc');
  }
  return list;
}

function pack(chart) {
  const cols = chart.variant === 'de' ? chart.cols : UPCARDS;
  let codes = '';
  const masks = [];
  let evs = '';
  for (const [t, row] of ROWS) {
    // EV keys present in this row (the same for every column of a row).
    const keys = EV_LETTER.filter(([k]) => cols.some((c) => chart.ev[t][row][c][k] !== undefined));
    masks.push(keys.map(([, l]) => l).join(''));
    for (const c of cols) {
      const code = chart[t][row][c];
      if (!CODE_CHAR[code]) throw new Error(`unknown code ${code}`);
      codes += CODE_CHAR[code];
      for (const [k] of keys) {
        const v = chart.ev[t][row][c][k];
        if (v === undefined) throw new Error(`missing ${k} in ${t} ${row} ${c}`);
        evs += enc3(v);
      }
    }
  }
  const o = {
    v: chart.variant, r: chart.rules, he: +chart.houseEdge.toFixed(5), cd: +chart.houseEdgeCD.toFixed(5),
    bj: chart.houseEdgeBjPays, pbj: +chart.pBlackjackPaid.toFixed(6), it: chart.tdRounds ?? 0,
    c: codes, m: masks.join(','), e: evs,
  };
  if (chart.variant === 'de') o.cols = cols;
  return o;
}

const UNPACK_SRC = `
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_VAL = {};
for (let i = 0; i < 64; i++) B64_VAL[B64[i]] = i;
const ev3 = (s, i) => ((B64_VAL[s[i]] << 12) + (B64_VAL[s[i + 1]] << 6) + B64_VAL[s[i + 2]] - 131072) / 10000;
const CODE_OF = { S: 'S', H: 'H', D: 'D', d: 'Ds', P: 'P', p: 'Ph', R: 'Rh', r: 'Rs', q: 'Rp' };
const KEY_OF = { s: 'stand', h: 'hit', d: 'double', p: 'split', n: 'splitNoDas', r: 'surrender' };
const UP = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
const ROWS = [
  ...Array.from({ length: 18 }, (_, i) => ['hard', String(i + 4)]),
  ...Array.from({ length: 10 }, (_, i) => ['soft', String(i + 12)]),
  ...['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'].map((p) => ['pairs', p]),
];

function unpack(key, p) {
  const cols = p.v === 'de' ? p.cols : UP;
  const chart = {
    key, rules: p.r, variant: p.v,
    hard: {}, soft: {}, pairs: {}, ev: { hard: {}, soft: {}, pairs: {} },
    houseEdge: p.he, houseEdgeCD: p.cd, houseEdgeBjPays: p.bj, pBlackjackPaid: p.pbj,
    method: p.v === 'de' ? DE_METHOD : METHOD, tdRounds: p.it, precomputed: true,
  };
  if (p.v === 'de') { chart.cols = cols.slice(); chart.layout = DE_LAYOUT; } else chart.pBlackjackNoDealerBj = p.pbj;
  const masks = p.m.split(',');
  let ci = 0, ei = 0;
  ROWS.forEach(([t, row], ri) => {
    const mask = masks[ri];
    chart[t][row] = {};
    chart.ev[t][row] = {};
    for (const c of cols) {
      chart[t][row][c] = CODE_OF[p.c[ci++]];
      const ev = {};
      for (const l of mask) { ev[KEY_OF[l]] = ev3(p.e, ei); ei += 3; }
      chart.ev[t][row][c] = ev;
    }
  });
  return chart;
}

export const CHARTS = {};
for (const [k, p] of Object.entries(PACKED)) CHARTS[k] = unpack(k, p);
`;

const t0 = performance.now();
const sets = ruleSets();
const packed = {};
const lines = [];
for (const { key, rules, why } of sets) {
  const t = performance.now();
  const chart = rules.variant === 'de' ? computeDEChart(rules) : computeChart(rules);
  packed[key] = pack(chart);
  const ms = performance.now() - t;
  lines.push(`${key}  ${ms.toFixed(0)} ms  edge ${chart.houseEdge.toFixed(3)}%  (${why.join(', ')})`);
  console.log(lines[lines.length - 1]);
}
const total = ((performance.now() - t0) / 1000).toFixed(1);

const header = `// charts.js — GENERATED by scripts/build-charts.mjs. Do not edit by hand;
// change the engine and run \`node scripts/build-charts.mjs\`.
//
// ${sets.length} charts: every preset in rules.js, the common rule matrix and ENHC.
// Each entry unpacks to a Chart exactly as strategy.getChart() returns one
// (see js/engine/strategy.js and, for Double Exposure, js/engine/de.js).
// Packed form: one character per cell code; EVs as 3 base-64 characters each
// (integers in units of 0.0001, offset by 2^17).
// House edges are stored at houseEdgeBjPays (1.5 for classic charts, 1 for
// Double Exposure); strategy.houseEdge(rules) adjusts for the rules' payout.
`;
const body = `${header}
const METHOD = ${JSON.stringify(METHOD_TEXT)};
const DE_METHOD = ${JSON.stringify(DE_METHOD)};
const DE_LAYOUT = ${JSON.stringify(DE_LAYOUT)};

const PACKED = {
${Object.entries(packed).map(([k, p]) => `  ${JSON.stringify(k)}: ${JSON.stringify(p)},`).join('\n')}
};
${UNPACK_SRC}`;
fs.writeFileSync(OUT, body);
console.log(`\nWrote ${OUT}: ${sets.length} charts, ${(body.length / 1024).toFixed(0)} KB, built in ${total} s`);
