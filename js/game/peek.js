// peek.js — "peek at the chart" while practising: the strategy chart for the
// game being played, with the current hand's cell highlighted, plus any index
// play for that cell. The index play is shown as its rule ("stand at 0 or
// higher"), never with the current count: applying the count stays your job.
//
// Callers decide what a peek costs (not scored in the simulator, a miss in the
// drills) and never offer it in a test-out or checkpoint.

import { el, modal } from '../ui.js';
import { chartFor, strategy, doubleExposure, CODE_TEXT, tableName } from './shared.js';
import { chartTable, chartLegend } from './chartview.js';
import { DE_GROUPS, deColLabel } from './dechart.js';
import { DEVIATIONS } from '../data/deviations.js';
import { presetById, handValue } from '../engine/rules.js';
import { describeRamp } from './rampmath.js';

const upKey = (rank) => (rank === 1 ? 'A' : String(rank));
// chart codes whose first choice may not be allowed right now
const NEEDS = { D: 'double', Ds: 'double', Rh: 'surrender', Rs: 'surrender', Rp: 'surrender' };

// The index play that covers this chart cell, if the student uses index plays.
export function indexPlayFor(rules, table, row, up, indexSet) {
  if (!indexSet || indexSet === 'none' || rules.variant !== 'classic') return null;
  const list = DEVIATIONS[rules.hitSoft17 ? 'h17' : 's17'] || [];
  return list.find((d) => d.table === table && String(d.row) === String(row) && d.up === up
    && d.set !== 'basic' && d.set !== 'insurance'
    && (d.set !== 'fab4' || (indexSet === 'i18fab4' && rules.surrender === 'late'))) || null;
}

// The "Hint" button that opens the peek; the ? key does the same.
// onOpen() runs every time it is opened (callers count the peek there).
export function peekButton(onOpen, { label = '💡 Hint', title = 'Hint: the strategy chart with your hand marked (?)' } = {}) {
  const b = el('button', { class: 'btn small ghost', type: 'button', title, onclick: () => onOpen() }, label, el('span', { class: 'faint', style: { fontSize: '11px' } }, ' ?'));
  const onKey = (e) => {
    if (!b.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal-back')) return;
    if (e.key === '?' || e.key === '/') { e.preventDefault(); onOpen(); }
  };
  document.addEventListener('keydown', onKey);
  return b;
}

// hand: engine ranks; up: dealer upcard rank (classic) or dealer ranks (DE);
// opts: what is allowed right now ({ canDouble, canSplit, canSurrender, splitCount }).
export async function showChartPeek({ rules, presetId, hand, up, opts, indexSet }) {
  const de = rules.variant === 'de';
  const s = await strategy();
  const D = de ? await doubleExposure() : null;
  const chart = de ? D.getDEChart(rules) : await chartFor(rules);
  // the basic-strategy cell (index plays are shown separately, as a rule)
  const res = de
    ? D.decideDE(hand, up, rules, { ...opts, indexSet: 'none' })
    : s.decide(hand, up, rules, { ...opts, indexSet: 'none' });
  const table = res.table, row = res.row;
  const col = de ? res.col : upKey(up);
  const v = handValue(hand);
  const handText = table === 'pairs' && hand.length === 2
    ? `a pair of ${hand[0] === 1 ? 'aces' : hand[0] === 10 ? 'tens' : `${hand[0]}s`}`
    : `${v.soft ? 'soft' : 'hard'} ${v.total}`;
  const dealerText = de ? `dealer ${deColLabel(col)}` : `dealer ${col}`;
  const code = res.code;
  // the chart code, and what it means right now (no double after three cards, no surrender after a split)
  const fallback = NEEDS[code] && res.action !== NEEDS[code] ? ` You can’t ${NEEDS[code]} right now, so: ${res.action}.` : '';
  const dev = de ? null : indexPlayFor(rules, table, row, col, indexSet);
  const p = presetById(presetId);

  const tables = el('div');
  let all = false;
  const paint = () => {
    const which = all ? ['hard', 'soft', 'pairs'] : [table];
    const cols = de ? DE_GROUPS.find((g) => g.cols.includes(col))?.cols : undefined;
    tables.replaceChildren(which.map((t) => el('div', {},
      which.length > 1 ? el('h3', { style: { margin: '10px 0 4px' } }, tableName(t)) : null,
      chartTable(chart, t, { highlight: t === table ? [[row, col]] : [], ...(de ? { cols, colLabel: deColLabel } : {}) }))));
    requestAnimationFrame(() => tables.querySelector('td.hl')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  };
  paint();

  modal((close) => el('div', {},
    el('div', { class: 'row between', style: { marginBottom: '6px' } },
      el('div', {}, el('div', { class: 'kicker' }, `Strategy chart · ${p ? p.short : ''}`),
        el('b', {}, `${handText[0].toUpperCase()}${handText.slice(1)} vs ${dealerText}`)),
      el('button', { class: 'btn small ghost', type: 'button', onclick: close, 'aria-label': 'Close' }, '✕')),
    el('div', { class: 'feedback info', style: { marginTop: 0 } },
      el('div', {}, 'Chart: ', el('b', {}, CODE_TEXT[code] || code), fallback),
      dev ? el('div', { style: { marginTop: '6px' } }, '📈 Index play for this hand: ', el('b', {}, dev.label), '. Check your true count.') : null),
    tables,
    chartLegend(),
    el('div', { class: 'row', style: { marginTop: '6px' } },
      el('button', { class: 'btn small', type: 'button', onclick: (e) => { all = !all; e.target.textContent = all ? 'Show this table only' : 'Show all three tables'; paint(); } }, 'Show all three tables'),
      el('button', { class: 'btn small primary', type: 'button', onclick: close }, 'Back to the hand')),
  ));
  return { table, row, col };
}

// The bet ramp, for a peek while betting. No count is shown.
export function showRampPeek(ramp, unitSize) {
  modal((close) => el('div', {},
    el('div', { class: 'row between' }, el('div', { class: 'kicker' }, 'Your bet ramp'),
      el('button', { class: 'btn small ghost', type: 'button', onclick: close, 'aria-label': 'Close' }, '✕')),
    el('table', { class: 'plain' }, el('tbody', {}, describeRamp(ramp).map((r) => el('tr', {},
      el('td', {}, r.range), el('td', { style: { textAlign: 'right' } }, el('b', {}, `${r.units} unit${r.units > 1 ? 's' : ''}`), ` · $${r.units * unitSize}`))))),
    el('p', { class: 'muted', style: { fontSize: '14px' } }, 'Bet by the true count before the deal: running count ÷ decks left, rounded down.'),
    el('button', { class: 'btn small primary', type: 'button', onclick: close }, 'Back to the bet'),
  ));
}

