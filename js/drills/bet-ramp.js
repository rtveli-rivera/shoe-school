// bet-ramp: the true count is called; you put out the bet. Units and dollars.

import { el, fmtSigned } from '../ui.js';
import { shuffle } from '../engine/rng.js';
import { rampFor, unitsFor, describeRamp } from '../game/ramps.js';
import { settings } from '../store.js';
import { choiceButtons, feedback } from './common.js';

export function mount(stage, ctx) {
  const { rand, rules, params } = ctx;
  const ramp = params.ramp || rampFor(rules);
  const unit = settings().unitSize || 25;
  const all = [...new Set(ramp.steps.map((s) => s.units))];
  const rampCard = el('details', { class: 'more card tight' }, el('summary', {}, `Your ramp: ${ramp.name || 'custom'}`),
    el('table', { class: 'plain' }, el('tbody', {}, describeRamp(ramp).map((r) => el('tr', {}, el('td', {}, r.range), el('td', {}, `${r.units} unit${r.units > 1 ? 's' : ''} ($${r.units * unit})`))))));
  const next = () => {
    const top = ramp.steps[ramp.steps.length - 1].tc;
    const tc = Math.round(-3 + rand() * (top + 5));
    const right = unitsFor(ramp, tc);
    const opts = shuffle(rand, all.slice()).slice(0, 4);
    if (!opts.includes(right)) opts[0] = right;
    const choices = opts.sort((a, b) => a - b).map((u) => ({ label: `${u} unit${u > 1 ? 's' : ''} · $${u * unit}`, value: u }));
    const fb = el('div');
    const c = choiceButtons(choices, (val, i) => {
      c.lock();
      const ok = val === right;
      c.mark(i, choices.findIndex((o) => o.value === right));
      ctx.report(ok);
      feedback(fb, ok, `At true count ${fmtSigned(tc)} the ramp says **${right} unit${right > 1 ? 's' : ''}** ($${right * unit}).`, () => ctx.advance(next), { autoMs: 700 });
    });
    stage.replaceChildren(rampCard,
      el('div', { class: 'card center' }, el('div', { class: 'kicker' }, 'True count before the deal'), el('div', { class: 'result-big num' }, fmtSigned(tc))),
      el('p', { class: 'prompt' }, 'Your bet?'), c.node, fb);
  };
  next();
}
