// count-tags: one card, its Hi-Lo tag. +1 / 0 / −1, as fast as you can.

import { el } from '../ui.js';
import { cardEl, makeShoe } from '../game/cards.js';
import { hiloTag } from '../engine/hilo.js';
import { choiceButtons, feedback } from './common.js';

const TAG_TEXT = { 1: '+1', 0: '0', '-1': '−1' };

export function mount(stage, ctx) {
  const { rand } = ctx;
  let deck = makeShoe(1, rand);
  const next = () => {
    if (!deck.length) deck = makeShoe(1, rand);
    const card = deck.pop();
    const right = hiloTag(card.v);
    const opts = [{ label: '+1', value: 1 }, { label: '0', value: 0 }, { label: '−1', value: -1 }];
    const fb = el('div');
    const c = choiceButtons(opts, (val, i) => {
      c.lock();
      const ok = val === right;
      c.mark(i, opts.findIndex((o) => o.value === right));
      ctx.report(ok);
      const why = right === 1 ? '2 through 6 are **+1**: small cards leaving the shoe help you.'
        : right === 0 ? '7, 8 and 9 are **0**: neutral, ignore them.'
          : 'Tens, faces and aces are **−1**: the shoe just lost a card that helps you.';
      feedback(fb, ok, ok ? null : `${card.r}${card.s} is ${TAG_TEXT[right]}. ${why}`, () => ctx.advance(next), { autoMs: 120 });
    });
    stage.replaceChildren(
      el('div', { class: 'flash-zone huge-cards' }, cardEl(card)),
      el('p', { class: 'faint center', style: { fontSize: '13px' } }, 'Keys: 1 = +1 · 2 = 0 · 3 = −1'),
      c.node, fb);
  };
  next();
}
