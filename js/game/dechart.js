// dechart.js — the Double Exposure chart. The dealer's two face-up cards give 26
// columns, too wide for a phone, so the chart is shown one dealer group at a
// time: hard 4–11, hard 12–16, hard 17–20, soft.

import { el } from '../ui.js';
import { chartTable, chartLegend, evBreakdown } from './chartview.js';
import { tableName } from './shared.js';

const GROUPS = [
  { id: 'low', label: 'Dealer 4–11', cols: ['h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10', 'h11'] },
  { id: 'stiff', label: 'Dealer 12–16', cols: ['h12', 'h13', 'h14', 'h15', 'h16'] },
  { id: 'pat', label: 'Dealer 17–20', cols: ['h17', 'h18', 'h19', 'h20'] },
  { id: 'soft', label: 'Dealer soft', cols: ['s12', 's13', 's14', 's15', 's16', 's17', 's18', 's19', 's20'] },
];

const colLabel = (c) => (c[0] === 's' ? (c === 's12' ? 'A,A' : `A,${Number(c.slice(1)) - 11}`) : c.slice(1));

export function renderDEChart(chart) {
  let group = GROUPS[1];
  const detail = el('div');
  const tables = el('div');
  const seg = el('div', { class: 'seg', style: { margin: '6px 0 12px' } });
  const paint = () => {
    seg.replaceChildren(GROUPS.map((g) => el('button', { type: 'button', class: g === group ? 'on' : '', onclick: () => { group = g; paint(); } }, g.label)));
    const onCell = (t, row, col) => detail.replaceChildren(evBreakdown(chart, t, row, col, { title: `${tableName(t).split(' ')[0]} ${row} vs dealer ${colLabel(col)}` }));
    tables.replaceChildren(['hard', 'soft', 'pairs'].map((t) => el('div', {}, el('h2', {}, tableName(t)),
      chartTable(chart, t, { cols: group.cols, colLabel, onCell }))));
  };
  paint();
  return el('div', {},
    el('p', { class: 'muted', style: { fontSize: '14px' } }, 'You see both dealer cards, so the columns are the dealer’s total, not one upcard. Hard totals are two cards without an ace; soft totals have one. Tap any cell to see what every play is worth.'),
    el('div', { class: 'callout warn' }, el('p', {}, 'The price for seeing both cards: blackjack pays even money and the dealer wins ties. Against a dealer 17–20 you often have to hit hands you would stand on anywhere else.')),
    seg, chartLegend(), tables, detail,
    chart.houseEdge !== undefined ? el('p', { class: 'faint', style: { fontSize: '13px' } }, `House edge with this chart: ${chart.houseEdge.toFixed(2)}%.`) : null,
  );
}
