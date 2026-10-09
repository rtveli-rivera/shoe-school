// dealer-rules: the dealer has these cards — hit or stand? (Soft 17 is the trap.)

import { el } from '../ui.js';
import { cardForRank, handEl } from '../game/cards.js';
import { handValue } from '../engine/rules.js';
import { choiceButtons, feedback } from './common.js';

function randomDealerHand(rand, wantSoft17) {
  for (;;) {
    let ranks;
    if (wantSoft17) {
      // A,6 / A,2,4 / A,A,5 / A,3,3 ...
      const forms = [[1, 6], [1, 2, 4], [1, 1, 5], [1, 3, 3], [1, 4, 2], [2, 1, 4], [1, 1, 1, 4]];
      ranks = forms[Math.floor(rand() * forms.length)];
    } else {
      const n = 2 + (rand() < 0.4 ? 1 : 0);
      ranks = [];
      for (let i = 0; i < n; i++) { const x = rand(); ranks.push(x < 0.12 ? 1 : x < 0.4 ? 10 : 2 + Math.floor(rand() * 8)); }
    }
    const v = handValue(ranks);
    if (v.total >= 12 && v.total <= 21 && !(ranks.length === 2 && v.total === 21)) return ranks;
  }
}

export function mount(stage, ctx) {
  const { rand, rules } = ctx;
  const ruleText = rules.hitSoft17 ? 'This table: dealer **hits** soft 17 (H17)' : 'This table: dealer **stands** on soft 17 (S17)';
  const next = () => {
    const ranks = randomDealerHand(rand, rand() < 0.3);
    const v = handValue(ranks);
    const hits = v.total < 17 || (v.total === 17 && v.soft && rules.hitSoft17);
    const right = hits ? 'hit' : 'stand';
    const fb = el('div');
    const opts = [{ label: 'Dealer hits', value: 'hit' }, { label: 'Dealer stands', value: 'stand' }];
    const choices = choiceButtons(opts, (val, i) => {
      choices.lock();
      const ok = val === right;
      choices.mark(i, opts.findIndex((o) => o.value === right));
      ctx.report(ok);
      const why = v.total === 17 && v.soft
        ? `This is **soft 17** (the ace counts as 11). At an ${rules.hitSoft17 ? 'H17 table the dealer hits it' : 'S17 table the dealer stands on it'}.`
        : v.total < 17 ? `${v.soft ? 'Soft' : 'Hard'} ${v.total} is under 17: the dealer must hit.` : `${v.soft ? 'Soft' : 'Hard'} ${v.total}: 17 or more, the dealer stands.`;
      feedback(fb, ok, ok ? null : why, () => ctx.advance(next));
    });
    stage.replaceChildren(
      el('p', { class: 'muted center', html: ruleText.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>') }),
      el('div', { class: 'cards-row big-cards' }, handEl(ranks.map((r) => cardForRank(r, rand)), { spread: true })),
      el('p', { class: 'prompt' }, 'The dealer has these cards. What happens?'),
      choices.node, fb);
  };
  next();
}
