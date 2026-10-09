// charts.js — the strategy chart for any game, the index plays, the house edge.

import { el, fmtPct, fmtSigned } from '../ui.js';
import { PRESETS, presetById, rulesFor, describeRules } from '../engine/rules.js';
import { chartFor, strategy, tableName } from '../game/shared.js';
import { chartTable, chartLegend, evBreakdown } from '../game/chartview.js';
import { settings } from '../store.js';
import { DEVIATIONS } from '../data/deviations.js';
import { openGamePicker } from '../app.js';

export async function render(root, { query, navigate }) {
  const presetId = query.preset && presetById(query.preset) ? query.preset : settings().preset;
  const p = presetById(presetId);
  const rules = rulesFor(presetId);
  const tab = query.tab || 'basic';

  root.append(el('div', { class: 'kicker' }, 'Reference'), el('h1', {}, 'Strategy charts'),
    el('div', { class: 'card tight' },
      el('div', { class: 'row between' },
        el('div', {}, el('b', {}, p.name), el('div', { class: 'muted', style: { fontSize: '13px' } }, describeRules(rules).slice(0, 7).join(' · '))),
        el('button', { class: 'btn small', type: 'button', onclick: () => openGamePicker((id) => navigate(`#/charts?preset=${id}&tab=${tab}`)) }, 'Change game'))),
    el('div', { class: 'seg', style: { margin: '6px 0 14px' } },
      [['basic', 'Basic strategy'], ['index', 'Index plays'], ['edge', 'House edge']].map(([k, label]) =>
        el('button', { type: 'button', class: k === tab ? 'on' : '', onclick: () => navigate(`#/charts?preset=${presetId}&tab=${k}`) }, label))),
  );

  const body = el('div', {}, el('div', { class: 'spinner' }));
  root.append(body);
  try {
    if (tab === 'basic') await basicTab(body, presetId, rules);
    else if (tab === 'index') indexTab(body, rules);
    else await edgeTab(body);
  } catch (err) {
    console.error(err);
    body.replaceChildren(el('div', { class: 'feedback bad' }, `Could not build the chart: ${err.message}`));
  }
}

async function basicTab(body, presetId, rules) {
  const chart = await chartFor(rules);
  const detail = el('div');
  if (rules.variant === 'de') {
    const { renderDEChart } = await import('../game/dechart.js');
    body.replaceChildren(renderDEChart(chart, rules));
    return;
  }
  const onCell = (t, row, up) => { detail.replaceChildren(evBreakdown(chart, t, row, up)); detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  const s = await strategy();
  body.replaceChildren(
    el('p', { class: 'muted', style: { fontSize: '14px' } }, 'Rows are your hand, columns the dealer’s upcard. Tap any cell to see what every play is worth.'),
    chartLegend(),
    ['hard', 'soft', 'pairs'].map((t) => el('div', {}, el('h2', {}, tableName(t)), chartTable(chart, t, { onCell }))),
    detail,
    el('div', { class: 'card tight' },
      el('div', { class: 'kv' },
        el('span', {}, 'House edge with this chart'), el('span', { class: 'v' }, fmtPct(s.houseEdge(rules))),
        el('span', {}, 'How it was computed'), el('span', { class: 'v', style: { fontWeight: 400, fontSize: '13px' } }, chart.method || 'exact combinatorial analysis'))),
    el('p', { class: 'faint', style: { fontSize: '13px' } }, 'Multi-card hands follow the same rows: when you can no longer double, use the fallback in the code (D → hit, Ds → stand).'),
  );
}

function indexTab(body, rules) {
  const key = rules.hitSoft17 ? 'h17' : 's17';
  const list = DEVIATIONS[key] || [];
  const groups = [['insurance', 'Insurance'], ['i18', 'The Illustrious 18'], ['fab4', 'The Fab 4 (surrender)']];
  const fmtAction = { S: 'Stand', H: 'Hit', D: 'Double', P: 'Split', R: 'Surrender', insure: 'Insure' };
  body.replaceChildren(
    el('p', { class: 'muted', style: { fontSize: '14px' } }, `Hi-Lo index plays for ${key.toUpperCase()} multi-deck games. Make the play when the true count reaches the index (≥ for positive plays, ≤ for the "hit below" ones). The Settings tab chooses which set the simulator expects.`),
    list.length ? groups.map(([set, title]) => {
      const rows = list.filter((d) => d.set === set);
      if (!rows.length) return null;
      return el('div', {}, el('h2', {}, title), el('table', { class: 'plain' },
        el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Hand'), el('th', {}, 'Play'), el('th', { style: { textAlign: 'right' } }, 'Index'))),
        el('tbody', {}, rows.map((d, i) => el('tr', {},
          el('td', { class: 'faint' }, d.rank || i + 1),
          el('td', {}, d.set === 'insurance' ? 'Dealer ace' : `${d.table === 'pairs' ? `${d.row},${d.row}` : d.row} vs ${d.up}`),
          el('td', {}, `${fmtAction[d.action] || d.action}${d.when === 'le' ? ' at or below' : ' at or above'}`, d.otherwise ? el('div', { class: 'faint', style: { fontSize: '12px' } }, `otherwise ${fmtAction[d.otherwise] || d.otherwise}`) : null),
          el('td', { class: 'num', style: { textAlign: 'right', fontWeight: 800 } }, fmtSigned(d.index)))))));
    }) : el('div', { class: 'feedback info' }, 'Index tables are loading in the next update.'),
  );
}

async function edgeTab(body) {
  const s = await strategy();
  const rows = [];
  for (const p of PRESETS) {
    const rules = rulesFor(p.id);
    let he = null;
    try {
      const chart = await chartFor(rules);
      he = rules.variant === 'de' ? chart.houseEdge : s.houseEdge(rules);
    } catch (err) { console.warn(err); }
    rows.push({ p, he });
  }
  rows.sort((a, b) => (a.he ?? 9) - (b.he ?? 9));
  const max = Math.max(...rows.map((r) => Math.abs(r.he ?? 0)), 0.5);
  body.replaceChildren(
    el('p', { class: 'muted', style: { fontSize: '14px' } }, 'House edge for a perfect basic-strategy player, before any counting. Lower is better for you.'),
    el('div', { class: 'he-bars' }, rows.map(({ p, he }) => el('div', { class: 'he-bar' },
      el('span', {}, p.name),
      el('div', { class: 'track' }, he === null ? null : el('div', { class: `fill${he < 0 ? ' neg' : ''}`, style: { width: `${Math.abs(he) / max * 100}%` } })),
      el('b', { class: 'num' }, he === null ? '—' : fmtPct(he))))),
  );
}
