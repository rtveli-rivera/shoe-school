// chartview.js — renders a strategy chart table (hard / soft / pairs).

import { el } from '../ui.js';
import { UPCARDS } from '../engine/rules.js';
import { rowLabel, CODE_TEXT } from './shared.js';

const HARD_ROWS = ['21', '20', '19', '18', '17', '16', '15', '14', '13', '12', '11', '10', '9', '8', '7', '6', '5'];
const SOFT_ROWS = ['21', '20', '19', '18', '17', '16', '15', '14', '13'];
const PAIR_ROWS = ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

export function rowsOf(table) {
  return table === 'hard' ? HARD_ROWS : table === 'soft' ? SOFT_ROWS : PAIR_ROWS;
}

function sameRow(t, a, b, cols) {
  return t[a] && t[b] && cols.every((u) => t[a][u] === t[b][u]);
}

// Hard and soft rows that are identical at the top (17+ stand) or bottom (low
// totals always hit) are merged into one "18–21" / "5–8" line, the way printed
// charts do it. The middle is never merged: every total there is worth learning.
function groupedRows(chart, table, cols) {
  const rows = rowsOf(table).filter((r) => chart[table] && chart[table][r]); // descending totals
  if (table === 'pairs') return rows.map((r) => ({ rows: [r], label: rowLabel(table, r) }));
  const t = chart[table];
  // top: rows identical to the highest total, all 17 or more (hard) / soft 19+ (soft)
  const topMin = table === 'hard' ? 17 : 19;
  let a = 1;
  while (a < rows.length && Number(rows[a]) >= topMin && sameRow(t, rows[0], rows[a], cols)) a++;
  // bottom (hard only): rows identical to the lowest total, all 8 or less
  let b = rows.length;
  if (table === 'hard') {
    b = rows.length - 1;
    while (b - 1 >= a && Number(rows[b - 1]) <= 8 && sameRow(t, rows[rows.length - 1], rows[b - 1], cols)) b--;
  }
  const lab = (r) => rowLabel(table, r);
  const out = [];
  const top = rows.slice(0, a);
  out.push({ rows: top, label: top.length > 1 ? (table === 'hard' ? `${top[top.length - 1]}+` : `${lab(top[top.length - 1])}+`) : lab(top[0]) });
  for (const r of rows.slice(a, b)) out.push({ rows: [r], label: lab(r) });
  const bottom = rows.slice(b);
  if (bottom.length) out.push({ rows: bottom, label: bottom.length > 1 ? `${bottom[bottom.length - 1]}–${bottom[0]}` : bottom[0] });
  return out;
}

// opts: { highlight: [[row, up]], diffWith: otherChart, onCell(table, row, up, code),
//         cols: column keys (default: the ten upcards), colLabel(key) }
export function chartTable(chart, table, opts = {}) {
  const hl = new Set((opts.highlight || []).map(([r, u]) => `${r}|${u}`));
  const cols = opts.cols || UPCARDS;
  const colLabel = opts.colLabel || ((u) => u);
  const groups = groupedRows(chart, table, cols);
  const head = el('tr', {}, el('th', { class: 'rowh' }, table === 'pairs' ? 'Pair' : table === 'soft' ? 'Soft' : 'Hard'),
    cols.map((u) => el('th', { scope: 'col' }, colLabel(u))));
  const body = groups.map((g) => {
    const row = g.rows[0];
    return el('tr', {}, el('th', { class: 'rowh', scope: 'row' }, g.label),
      cols.map((u) => {
        const code = chart[table][row][u];
        const cls = [`c-${code}`];
        if (g.rows.some((r) => hl.has(`${r}|${u}`))) cls.push('hl');
        if (opts.diffWith && opts.diffWith[table] && opts.diffWith[table][row] && opts.diffWith[table][row][u] !== code) cls.push('diff');
        return el('td', {
          class: cls.join(' '), title: `${g.label} vs ${colLabel(u)}: ${CODE_TEXT[code] || code}`,
          onclick: opts.onCell ? () => opts.onCell(table, row, u, code) : undefined,
        }, code);
      }));
  });
  return el('div', { class: 'chart-wrap' }, el('table', { class: 'chart' }, el('thead', {}, head), el('tbody', {}, body)));
}

export function chartLegend() {
  const items = [
    ['H', 'Hit', 'var(--act-H)'], ['S', 'Stand', 'var(--act-S)'], ['D', 'Double, else hit', 'var(--act-D)'],
    ['Ds', 'Double, else stand', 'var(--act-D)'], ['P', 'Split', 'var(--act-P)'], ['Ph', 'Split if DAS, else hit', 'var(--act-P)'],
    ['Rh', 'Surrender, else hit', 'var(--act-R)'], ['Rs', 'Surrender, else stand', 'var(--act-R)'], ['Rp', 'Surrender, else split', 'var(--act-R)'],
  ];
  return el('div', { class: 'legend' }, items.map(([k, t, c]) => el('span', { style: { '--c': c } }, `${k} ${t}`)));
}

// "Why?": every legal play's average result for this cell, best first.
export function evBreakdown(chart, table, row, up, { title } = {}) {
  const ev = chart.ev?.[table]?.[row]?.[up];
  const code = chart[table]?.[row]?.[up];
  const names = { stand: 'Stand', hit: 'Hit', double: 'Double', split: 'Split', surrender: 'Surrender' };
  const rows = ev ? Object.entries(ev).filter(([, v]) => typeof v === 'number').sort((a, b) => b[1] - a[1]) : [];
  return el('div', { class: 'feedback info' },
    el('b', {}, title || `${rowLabel(table, row)} vs ${up}: ${CODE_TEXT[code] || code}`),
    rows.length ? el('table', { class: 'plain', style: { marginTop: '8px', marginBottom: 0 } },
      el('tbody', {}, rows.map(([k, v], i) => el('tr', {},
        el('td', {}, i === 0 ? el('b', {}, names[k] || k) : (names[k] || k)),
        el('td', { class: 'num', style: { textAlign: 'right' } }, `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}¢`),
      )))) : null,
    rows.length ? el('div', { class: 'faint', style: { fontSize: '12px', marginTop: '6px' } },
      'Average result per $1 bet for each play, computed for these exact rules. The chart picks the highest.') : null,
  );
}

// Cells that differ between two charts: [{ table, row, up, a, b }]
export function chartDiff(a, b) {
  const out = [];
  for (const table of ['hard', 'soft', 'pairs']) {
    for (const row of rowsOf(table)) {
      if (!a[table]?.[row] || !b[table]?.[row]) continue;
      for (const u of UPCARDS) {
        if (a[table][row][u] !== b[table][row][u]) out.push({ table, row, up: u, a: a[table][row][u], b: b[table][row][u] });
      }
    }
  }
  return out;
}
