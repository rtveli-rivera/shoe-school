// tools.js — bankroll & risk: simulate a game + bet ramp, then show win rate,
// swings, risk of ruin, N0, SCORE, and the edge at every true count.

import { el, fmtPct, fmtSigned, progressBar } from '../ui.js';
import { presetById, rulesFor, describeRules } from '../engine/rules.js';
import { settings, setSetting } from '../store.js';
import { DEFAULT_RAMPS, rampKind, rampFor, describeRamp, unitsFor } from '../game/ramps.js';
import { summarize } from '../engine/risk.js';
import { columnChart } from '../game/barchart.js';
import { openGamePicker } from '../app.js';

const money = (x) => `${x < 0 ? '−' : ''}$${Math.abs(x) >= 100 ? Math.round(Math.abs(x)).toLocaleString('en-US') : Math.abs(x).toFixed(2)}`;

export async function render(root, { navigate }) {
  const presetId = settings().preset;
  const p = presetById(presetId);
  const rules = rulesFor(presetId);
  const kind = rampKind(rules);
  let ramp = JSON.parse(JSON.stringify(rampFor(rules)));
  const st = settings();
  const inputs = { unit: st.unitSize || 25, bankroll: 10000, roundsPerHour: 80, rounds: 1500000, wong: 'none' };
  let worker = null;

  root.append(el('div', { class: 'kicker' }, 'Bankroll & risk'), el('h1', {}, 'What is this game worth?'),
    el('p', { class: 'lead' }, 'Simulate hundreds of thousands of rounds of perfect Hi-Lo play with your ramp, then see what it earns per hour, how hard it swings, and how big a bankroll it needs.'),
    el('div', { class: 'card tight' },
      el('div', { class: 'row between' }, el('div', {}, el('b', {}, p.name), el('div', { class: 'muted', style: { fontSize: '13px' } }, describeRules(rules).slice(0, 6).join(' · '))),
        el('button', { class: 'btn small', type: 'button', onclick: () => openGamePicker(() => navigate(`#/tools?r=${Date.now()}`)) }, 'Change game'))));

  // ---- ramp editor ----
  const rampBox = el('div');
  const paintRamp = () => {
    rampBox.replaceChildren(
      el('table', { class: 'plain' },
        el('thead', {}, el('tr', {}, el('th', {}, 'True count'), el('th', {}, 'Bet (units)'), el('th', {}))),
        el('tbody', {}, ramp.steps.map((s, i) => el('tr', {},
          el('td', {}, i === 0 ? describeRamp(ramp)[0].range : el('input', {
            type: 'number', value: s.tc, step: 1, style: { width: '80px', minHeight: '36px' },
            onchange: (e) => { s.tc = Math.round(Number(e.target.value)); ramp.steps.sort((a, b) => a.tc - b.tc); paintRamp(); },
          })),
          el('td', {}, el('input', {
            type: 'number', value: s.units, min: 0, step: 1, style: { width: '80px', minHeight: '36px' },
            onchange: (e) => { s.units = Math.max(0, Math.round(Number(e.target.value))); paintRamp(); },
          })),
          el('td', {}, i > 0 ? el('button', { class: 'btn small ghost', type: 'button', 'aria-label': 'Remove step', onclick: () => { ramp.steps.splice(i, 1); paintRamp(); } }, '✕') : null))))),
      el('div', { class: 'row' },
        el('button', { class: 'btn small', type: 'button', onclick: () => { const last = ramp.steps[ramp.steps.length - 1]; ramp.steps.push({ tc: Math.max(1, last.tc + 1), units: last.units + 2 }); paintRamp(); } }, '+ Step'),
        el('button', { class: 'btn small ghost', type: 'button', onclick: () => { ramp = JSON.parse(JSON.stringify(DEFAULT_RAMPS[kind])); paintRamp(); } }, 'Reset to default'),
        el('button', { class: 'btn small ghost', type: 'button', onclick: saveRamp }, 'Use in the simulator')),
      el('p', { class: 'faint', style: { fontSize: '13px', margin: '6px 0 0' } },
        `Spread 1 to ${Math.max(...ramp.steps.map((s) => s.units))}. A bigger spread earns more and draws more attention.`));
  };
  function saveRamp() {
    const all = { ...(settings().ramp || {}) };
    all[kind] = { name: 'Your ramp', steps: ramp.steps.map((s) => ({ ...s })) };
    setSetting('ramp', all);
    rampBox.append(el('div', { class: 'feedback good' }, 'Saved. The casino simulator and the bet-ramp drill now use this ramp.'));
  }
  paintRamp();

  const num = (key, label, attrs) => el('div', { class: 'field' }, el('label', {}, label),
    el('input', { type: 'number', value: inputs[key], ...attrs, onchange: (e) => { inputs[key] = Number(e.target.value) || inputs[key]; } }));

  root.append(el('div', { class: 'card' },
    el('h3', { style: { marginTop: 0 } }, 'Your bet ramp'), rampBox),
    el('div', { class: 'card' },
      el('div', { class: 'grid2', style: { gap: '0 12px' } },
        num('unit', 'Betting unit ($)', { min: 1, step: 5 }),
        num('bankroll', 'Bankroll ($)', { min: 100, step: 1000 }),
        num('roundsPerHour', 'Rounds per hour (≈100 alone, ≈60 at a full table)', { min: 20, max: 250, step: 10 }),
        el('div', { class: 'field' }, el('label', {}, 'Wong out (leave the table) when the count is'),
          el('select', { onchange: (e) => { inputs.wong = e.target.value; } },
            [['none', 'Never: play every round'], ['-1', 'Below −1'], ['0', 'Below 0'], ['1', 'Below +1']].map(([v, t]) => el('option', { value: v }, t)))),
      ),
      el('div', { class: 'field' }, el('label', {}, 'Precision'),
        el('select', { onchange: (e) => { inputs.rounds = Number(e.target.value); } },
          [[300000, 'Quick look: 300,000 rounds (rough)'], [1500000, 'Precise: 1.5 million rounds'], [5000000, 'Very precise: 5 million rounds (slow)']].map(([v, t]) => el('option', { value: v, selected: v === inputs.rounds }, t)))),
      el('button', { class: 'btn primary block', type: 'button', onclick: run }, 'Simulate'),
    ));

  const out = el('div');
  root.append(out);

  function run() {
    if (worker) worker.terminate();
    const bar = el('div', {}, progressBar(0));
    out.replaceChildren(el('div', { class: 'card' }, el('p', { class: 'muted', style: { margin: '0 0 8px' } }, `Playing ${inputs.rounds.toLocaleString('en-US')} rounds…`), bar));
    worker = new Worker(new URL('../engine/simworker.js', import.meta.url), { type: 'module' });
    const t0 = performance.now();
    worker.onmessage = (e) => {
      if (e.data.progress !== undefined) { bar.replaceChildren(progressBar(e.data.progress)); return; }
      worker.terminate(); worker = null;
      if (!e.data.ok) { out.replaceChildren(el('div', { class: 'feedback bad' }, `Simulation failed: ${e.data.error}`)); return; }
      showResults(e.data.result, (performance.now() - t0) / 1000);
    };
    worker.onerror = (err) => { out.replaceChildren(el('div', { class: 'feedback bad' }, `Simulation failed: ${err.message || 'worker error'}`)); };
    worker.postMessage({
      rules, ramp, rounds: inputs.rounds, seed: (Math.random() * 2 ** 31) >>> 0, indexSet: settings().indexSet,
      wongOutBelow: inputs.wong === 'none' ? null : Number(inputs.wong),
    });
  }

  function showResults(r, secs) {
    const s = summarize(r, { unit: inputs.unit, bankroll: inputs.bankroll, roundsPerHour: inputs.roundsPerHour, hours: 100 });
    const losing = r.evPerRound <= 0;
    const tile = (label, value, sub) => el('div', { class: 'card tight', style: { marginBottom: 0 } },
      el('div', { class: 'muted', style: { fontSize: '13px' } }, label), el('div', { style: { fontSize: '22px', fontWeight: 800 }, class: 'num' }, value),
      sub ? el('div', { class: 'faint', style: { fontSize: '12px' } }, sub) : null);
    const width = Math.min(out.clientWidth || 340, 720) - 34;
    const rows = r.byTc.filter((row) => row.freq >= 0.001);
    const freqChart = columnChart(rows.map((row) => ({ x: fmtSigned(row.tc), y: row.freq * 100, tip: `TC ${fmtSigned(row.tc)}: ${(row.freq * 100).toFixed(1)}% of rounds` })),
      { width, height: 180, yFmt: (v) => `${v}%`, xTitle: 'True count before the deal', ariaLabel: 'How often each true count occurs' });
    const edgeRows = rows.filter((row) => row.n >= 2000);
    const edgeChart = columnChart(edgeRows.map((row) => ({ x: fmtSigned(row.tc), y: row.edge * 100, tip: `TC ${fmtSigned(row.tc)}: ${row.edge >= 0 ? '+' : '−'}${Math.abs(row.edge * 100).toFixed(2)}% ± ${(row.se * 196).toFixed(2)}% · bet ${unitsFor(ramp, row.tc)}u` })),
      { width, height: 200, signed: true, yFmt: (v) => `${v > 0 ? '+' : ''}${v}%`, xTitle: 'True count before the deal', ariaLabel: 'Player edge at each true count' });

    out.replaceChildren(
      el('div', { class: 'card' },
        el('div', { class: 'kicker' }, 'Expected win per hour'),
        el('div', { class: 'num', style: { fontSize: '48px', fontWeight: 800, lineHeight: 1.1, color: losing ? 'var(--bad)' : 'var(--text)' } }, money(s.winPerHour)),
        el('p', { class: 'muted', style: { margin: '6px 0 0' } },
          `${fmtPct(r.evPerRound / r.avgBet * 100, 2)} of the money you bet (average bet ${r.avgBet.toFixed(2)} units). One hour swings by about ±${money(s.sdPerHour)}.`)),
      losing ? el('div', { class: 'feedback bad' }, el('b', {}, 'This game and ramp lose money. '), 'Counting cannot overcome this game as set up: look for 3:2, deeper penetration, or a bigger spread (see the betting module).') : null,
      el('div', { class: 'grid2', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' } },
        tile('Risk of ruin', losing ? '100%' : fmtPct(s.ror * 100, 1), `with a ${money(inputs.bankroll)} bankroll`),
        tile('Bankroll for 5% risk', losing ? '—' : money(s.bankrollFor5), `${money(s.bankrollFor1)} for 1%`),
        tile('N0 (long run)', losing ? '—' : `${Math.round(s.n0Hours).toLocaleString('en-US')} h`, `${Math.round(s.n0Rounds).toLocaleString('en-US')} rounds`),
        tile('Ahead after 100 hours', `${Math.round(s.aheadAfter * 100)}%`, `expect ${money(s.expectedAfter)} ± ${money(s.sdAfter)}`),
        tile('SCORE', losing ? '—' : s.score.toFixed(1), `DI ${s.di.toFixed(2)}`),
        tile('Rounds sat out', `${Math.round((r.satOut / r.rounds) * 100)}%`, inputs.wong === 'none' ? 'playing every round' : 'wonged out'),
      ),
      el('div', { class: 'card', style: { marginTop: '12px' } },
        el('h3', { style: { marginTop: 0 } }, 'Your edge at each true count'),
        el('p', { class: 'muted', style: { fontSize: '13px' } }, 'Blue bars: you have the edge. Red: the house does. This is why the bet goes up with the count.'),
        edgeChart),
      el('div', { class: 'card' },
        el('h3', { style: { marginTop: 0 } }, 'How often each true count comes up'),
        el('p', { class: 'muted', style: { fontSize: '13px' } }, 'Most rounds are played at a neutral or negative count. The money is made in the thin tail on the right.'),
        freqChart),
      el('details', { class: 'more card tight' }, el('summary', {}, 'Show as a table'),
        el('table', { class: 'plain' },
          el('thead', {}, el('tr', {}, el('th', {}, 'TC'), el('th', {}, 'How often'), el('th', {}, 'Edge'), el('th', {}, 'Your bet'))),
          el('tbody', {}, rows.map((row) => el('tr', {}, el('td', {}, fmtSigned(row.tc)), el('td', {}, `${(row.freq * 100).toFixed(1)}%`),
            el('td', {}, row.n >= 2000 ? `${row.edge >= 0 ? '+' : '−'}${Math.abs(row.edge * 100).toFixed(2)}%` : '(few rounds)'), el('td', {}, `${unitsFor(ramp, row.tc)}u`)))))),
      el('p', { class: 'faint', style: { fontSize: '12px' } },
        `${r.played.toLocaleString('en-US')} rounds played over ${r.shoes.toLocaleString('en-US')} shoes in ${secs.toFixed(1)}s. Win rate ±${(r.seEv * 196 / Math.max(1e-9, r.avgBet)).toFixed(3)}% (95%). Assumes perfect play and counting, playing heads-up; mistakes, cover plays and a crowded table all lower it. TC −10/+10 include everything beyond.`),
    );
  }

  return () => { if (worker) worker.terminate(); };
}
