// running-count: cards flash by in small groups at table speed; then: what is
// the running count?

import { el, numberPad, fmtSigned, sleep } from '../ui.js';
import { cardEl, makeShoe } from '../game/cards.js';
import { runningCount } from '../engine/hilo.js';
import { feedback } from './common.js';

const SPEEDS = [
  { label: 'Slow', ms: 1200 }, { label: 'Table', ms: 800 }, { label: 'Fast', ms: 500 }, { label: 'Pro', ms: 320 },
];

export function mount(stage, ctx) {
  const { rand, params } = ctx;
  let speed = params.speed || 800;
  let group = params.group || 2;
  const length = params.length || 20;
  let alive = true;
  let deck = makeShoe(2, rand);

  const setup = () => {
    const seg = (vals, cur, set) => el('div', { class: 'seg' }, vals.map((v) => el('button', {
      type: 'button', class: v.value === cur ? 'on' : '', onclick: () => { set(v.value); setup(); },
    }, v.label)));
    stage.replaceChildren(el('div', { class: 'card' },
      el('p', {}, `About ${length} cards will flash past in groups, like hands landing on the table. Keep the running count; you will be asked for it at the end.`),
      el('div', { class: 'field' }, el('span', { class: 'label' }, 'Speed per group'), seg(SPEEDS.map((s) => ({ label: `${s.label} · ${s.ms / 1000}s`, value: s.ms })), speed, (v) => { speed = v; })),
      el('div', { class: 'field' }, el('span', { class: 'label' }, 'Cards per group'), seg([1, 2, 3].map((n) => ({ label: String(n), value: n })), group, (v) => { group = v; })),
      el('button', { class: 'btn primary block', type: 'button', onclick: run }, 'Start'),
    ));
  };

  const run = async () => {
    if (deck.length < length + 5) deck = makeShoe(2, rand);
    const n = length - 3 + Math.floor(rand() * 7);
    const seq = deck.splice(0, n);
    const expected = runningCount(seq.map((c) => c.v));
    const zone = el('div', { class: 'flash-zone big-cards', style: { minHeight: '220px' } });
    stage.replaceChildren(zone);
    for (let i = 0; i < seq.length && alive; i += group) {
      const batch = seq.slice(i, i + group);
      zone.replaceChildren(el('div', { class: 'row', style: { justifyContent: 'center' } }, batch.map((c) => cardEl(c, { deal: true }))));
      await sleep(speed);
      zone.replaceChildren();
      await sleep(Math.min(120, speed / 5));
    }
    if (!alive) return;
    ctx.start();
    const fb = el('div');
    const pad = numberPad({
      onSubmit: (val) => {
        pad.setDisabled(true);
        const ok = val === expected;
        ctx.report(ok);
        const shown = el('div', { class: 'others', style: { display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '8px' } }, seq.map((c) => cardEl(c)));
        feedback(fb, ok, el('div', {}, el('p', { style: { margin: '4px 0' } }, `The count was ${fmtSigned(expected)}. Here is what went by:`), shown),
          () => ctx.advance(run), { autoMs: -1 });
      },
    });
    stage.replaceChildren(el('p', { class: 'prompt' }, 'Running count?'), pad.node, fb);
  };

  setup();
  return () => { alive = false; };
}
