// deck-estimation: read the discard tray. How many decks are still to be dealt?
// Answers are in half decks, which is as fine as anyone estimates at a table.

import { el } from '../ui.js';
import { shuffle } from '../engine/rng.js';
import { trayEl } from '../game/tray.js';
import { choiceButtons, feedback } from './common.js';

const fmtDecks = (x) => `${Number.isInteger(x) ? x : x.toFixed(1)} deck${x === 1 ? '' : 's'}`;

export function mount(stage, ctx) {
  const { rand, rules, params } = ctx;
  const decks = params.decks || rules.decks;
  let marks = params.marks ?? false;
  const next = () => {
    const halfSteps = decks * 2;
    const playedHalves = 1 + Math.floor(rand() * Math.max(1, Math.floor(halfSteps * 0.85) - 1));
    const jitter = Math.round((rand() - 0.5) * 8);
    const discarded = Math.max(10, playedHalves * 26 + jitter);
    const left = (decks * 52 - discarded) / 52;
    const right = Math.max(0.5, Math.round(left * 2) / 2);
    const set = new Set([right]);
    for (const d of shuffle(rand, [-1, -0.5, 0.5, 1, 1.5, -1.5])) { const v = right + d; if (v >= 0.5 && v <= decks && set.size < 4) set.add(v); }
    const opts = [...set].sort((a, b) => a - b).map((v) => ({ label: fmtDecks(v), value: v }));
    const fb = el('div');
    const c = choiceButtons(opts, (val, i) => {
      c.lock();
      const ok = val === right;
      c.mark(i, opts.findIndex((o) => o.value === right));
      ctx.report(ok);
      feedback(fb, ok, `${discarded} cards played = ${(discarded / 52).toFixed(2)} decks in the tray. ${decks} − ${(discarded / 52).toFixed(2)} ≈ **${fmtDecks(right)} left**.`,
        () => ctx.advance(next), { autoMs: 900 });
    });
    stage.replaceChildren(
      el('p', { class: 'center muted' }, `A ${decks}-deck game. The tray is drawn to scale: full = all ${decks} decks.`),
      el('div', { class: 'tray-scene' }, trayEl(decks, discarded, { marks })),
      el('label', { class: 'switch', style: { maxWidth: '320px', margin: '0 auto 10px' } },
        el('span', { class: 'muted' }, 'Show deck marks (training wheels)'),
        el('input', { type: 'checkbox', checked: marks, onchange: (e) => { marks = e.target.checked; next(); } })),
      el('p', { class: 'prompt' }, 'How many decks are left to be dealt?'),
      c.node, fb);
  };
  next();
}
