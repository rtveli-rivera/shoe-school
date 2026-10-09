// count-pairs: two cards at once. A high and a low cancel to zero; train the eye
// to see the pair's net instead of adding one card at a time.

import { el } from '../ui.js';
import { cardEl, makeShoe } from '../game/cards.js';
import { hiloTag } from '../engine/hilo.js';
import { fmtSigned } from '../ui.js';
import { choiceButtons, feedback } from './common.js';

export function mount(stage, ctx) {
  const { rand } = ctx;
  let deck = makeShoe(1, rand);
  const next = () => {
    if (deck.length < 2) deck = makeShoe(1, rand);
    const a = deck.pop(), b = deck.pop();
    const right = hiloTag(a.v) + hiloTag(b.v);
    const opts = [-2, -1, 0, 1, 2].map((v) => ({ label: fmtSigned(v), value: v }));
    const fb = el('div');
    const c = choiceButtons(opts, (val, i) => {
      c.lock();
      const ok = val === right;
      c.mark(i, opts.findIndex((o) => o.value === right));
      ctx.report(ok);
      feedback(fb, ok, ok ? null : `${a.r}${a.s} is ${fmtSigned(hiloTag(a.v))}, ${b.r}${b.s} is ${fmtSigned(hiloTag(b.v))}: together **${fmtSigned(right)}**.${right === 0 && hiloTag(a.v) !== 0 ? ' A high and a low cancel out. Learn to see them as a zero.' : ''}`,
        () => ctx.advance(next), { autoMs: 150 });
    });
    stage.replaceChildren(
      el('div', { class: 'flash-zone big-cards' }, el('div', { class: 'row', style: { justifyContent: 'center' } }, cardEl(a), cardEl(b))),
      el('p', { class: 'faint center', style: { fontSize: '13px' } }, 'Keys 1–5: −2 · −1 · 0 · +1 · +2'),
      c.node, fb);
  };
  next();
}
