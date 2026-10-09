// deck-countdown: flip through a deck as fast as you can, counting. A full deck
// always ends at 0 — so with cards secretly removed, the final count tells you
// what was taken out. The classic counter's warm-up.

import { el, fmtMs, numberPad, fmtSigned } from '../ui.js';
import { cardEl, makeShoe, cardText } from '../game/cards.js';
import { runningCount } from '../engine/hilo.js';
import { feedback } from './common.js';

export function mount(stage, ctx) {
  const { rand, params } = ctx;
  let removed = params.removed ?? 0;
  let perFlip = params.perFlip ?? 1;
  const decks = params.decks || 1;
  let cleanupKeys = null;

  const setup = () => {
    const seg = (vals, cur, set, fmt) => el('div', { class: 'seg' }, vals.map((v) => el('button', {
      type: 'button', class: v === cur ? 'on' : '', onclick: () => { set(v); setup(); },
    }, fmt(v))));
    stage.replaceChildren(el('div', { class: 'card' },
      el('p', {}, `Flip through ${decks === 1 ? 'a full deck' : `${decks} decks`} as fast as you can, keeping the running count in your head. Tap the card (or press Space) for the next one.`),
      el('p', { class: 'muted' }, removed ? `${removed} card${removed > 1 ? 's are' : ' is'} secretly removed before you start, so the count will not end at 0. Your final count is what the missing cards would have cancelled.` : 'A complete deck always counts back to 0. If you do not end at 0, you slipped somewhere.'),
      params.removed === undefined ? el('div', { class: 'field' }, el('span', { class: 'label' }, 'Cards removed'), seg([0, 1, 3], removed, (v) => { removed = v; }, (v) => String(v))) : null,
      el('div', { class: 'field' }, el('span', { class: 'label' }, 'Cards per flip'), seg([1, 2], perFlip, (v) => { perFlip = v; }, (v) => v === 1 ? 'One at a time' : 'Two at a time (pairs)')),
      el('p', { class: 'faint', style: { fontSize: '14px' } }, 'Targets for one deck: under 30 seconds is table-ready, under 25 is good, under 20 is excellent.'),
      el('button', { class: 'btn primary block', type: 'button', onclick: run }, 'Start'),
    ));
  };

  const run = () => {
    const cards = makeShoe(decks, rand);
    const hiddenOut = cards.splice(0, removed);
    const expected = runningCount(cards.map((c) => c.v));
    let i = 0;
    const t0 = performance.now();
    ctx.start();
    const zone = el('div', { class: 'flash-zone huge-cards', style: { cursor: 'pointer', minHeight: '260px' } });
    const left = el('p', { class: 'faint center num' });
    const flip = () => {
      if (i >= cards.length) { end(); return; }
      const batch = cards.slice(i, i + perFlip);
      i += batch.length;
      zone.replaceChildren(el('div', { class: 'row', style: { justifyContent: 'center' } }, batch.map((c) => cardEl(c))));
      left.textContent = `${cards.length - i} cards left`;
    };
    const onKey = (e) => { if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); flip(); } };
    document.addEventListener('keydown', onKey);
    cleanupKeys = () => document.removeEventListener('keydown', onKey);
    zone.addEventListener('click', flip);
    stage.replaceChildren(zone, left, el('p', { class: 'faint center', style: { fontSize: '13px' } }, 'Tap the card or press Space'));
    flip();

    const end = () => {
      cleanupKeys(); cleanupKeys = null;
      const ms = performance.now() - t0;
      const fb = el('div');
      const pad = numberPad({
        onSubmit: (val) => {
          pad.setDisabled(true);
          const ok = val === expected;
          ctx.report(ok);
          const removedText = removed ? ` The removed card${removed > 1 ? 's were' : ' was'} ${hiddenOut.map(cardText).join(' ')}.` : '';
          feedback(fb, ok, `${ok ? '' : `The count was **${fmtSigned(expected)}**. `}Time: **${fmtMs(ms)}**${ms < 20000 ? ' (excellent)' : ms < 25000 ? ' (good)' : ms < 30000 ? ' (table-ready)' : ' (keep practising: aim for under 30s)'}.${removedText}`,
            () => ctx.advance(run), { autoMs: -1 });
        },
      });
      stage.replaceChildren(el('p', { class: 'prompt' }, 'Done! What is your final running count?'), pad.node, fb);
    };
  };

  setup();
  return () => { if (cleanupKeys) cleanupKeys(); };
}
