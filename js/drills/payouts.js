// payouts: what does this bet pay? Net result, in dollars.

import { el } from '../ui.js';
import { shuffle, pick } from '../engine/rng.js';
import { choiceButtons, feedback } from './common.js';

const money = (x) => {
  const s = Math.abs(x) % 1 ? Math.abs(x).toFixed(2) : String(Math.abs(x));
  return x > 0 ? `+$${s}` : x < 0 ? `−$${s}` : '$0 (push)';
};

function scenarios(bjPays) {
  const bjName = bjPays === 1.5 ? '3:2' : bjPays === 1.2 ? '6:5' : 'even money';
  return [
    { q: (b) => `You bet $${b} and get **blackjack**. This table pays ${bjName}.`, net: (b) => b * bjPays, why: (b) => `Blackjack pays ${bjName}: $${b} × ${bjPays} = $${b * bjPays}.` },
    { q: (b) => `You bet $${b} and get **blackjack** at a **6:5** table.`, net: (b) => b * 1.2, why: (b) => `6:5 pays $${b} × 1.2 = $${b * 1.2}. At 3:2 it would be $${b * 1.5}; that difference is why 6:5 games can’t be beaten.` },
    { q: (b) => `You bet $${b}, stand on 19, the dealer busts.`, net: (b) => b, why: () => 'A normal win pays 1 to 1.' },
    { q: (b) => `You bet $${b}, **double down**, and win.`, net: (b) => 2 * b, why: (b) => `Doubling puts out a second $${b}; both bets win 1 to 1.` },
    { q: (b) => `You bet $${b}, **double down**, and lose.`, net: (b) => -2 * b, why: (b) => `Both the original $${b} and the double are lost.` },
    { q: (b) => `You bet $${b} and **surrender**.`, net: (b) => -b / 2, why: () => 'Surrender gives back half your bet. You lose the other half.' },
    { q: (b) => `You bet $${b} and **push** (you and the dealer both have 20).`, net: () => 0, why: () => 'A tie is a push: your bet comes back.' },
    { q: (b) => `You bet $${b}, **split**, win one hand and lose the other.`, net: () => 0, why: () => 'Each split hand carries its own bet: +1 and −1 cancel.' },
    { q: (b) => `You bet $${b}, **split**, then double one hand. Both hands win.`, net: (b) => 3 * b, why: (b) => `$${b} on one hand, $${2 * b} on the doubled one: all of it wins.` },
    { q: (b) => `You bet $${b}, take **insurance** ($${b / 2}), the dealer has blackjack and your hand loses.`, net: () => 0, why: (b) => `Insurance pays 2 to 1: +$${b}, and the main bet loses −$${b}. Net zero.` },
    { q: (b) => `You bet $${b}, take **insurance** ($${b / 2}), the dealer does not have blackjack, and you win the hand.`, net: (b) => b / 2, why: (b) => `The insurance is lost (−$${b / 2}), the hand wins (+$${b}).` },
  ];
}

export function mount(stage, ctx) {
  const { rand, rules } = ctx;
  const list = scenarios(rules.variant === 'de' ? 1.5 : rules.bjPays);
  const next = () => {
    const s = pick(rand, list);
    const bet = pick(rand, [10, 20, 30, 50, 100]);
    const right = s.net(bet);
    const set = new Set([right]);
    for (const c of shuffle(rand, [bet * 1.5, bet * 1.2, bet, -bet, bet / 2, -bet / 2, 2 * bet, -2 * bet, 0, 3 * bet])) {
      if (set.size >= 4) break; set.add(c);
    }
    const opts = shuffle(rand, [...set]).map((x) => ({ label: money(x), value: x }));
    const fb = el('div');
    const choices = choiceButtons(opts, (val, i) => {
      choices.lock();
      const ok = val === right;
      choices.mark(i, opts.findIndex((o) => o.value === right));
      ctx.report(ok);
      feedback(fb, ok, ok ? null : s.why(bet), () => ctx.advance(next));
    });
    stage.replaceChildren(
      el('div', { class: 'card' }, el('p', { class: 'prompt', html: s.q(bet).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>') }),
        el('p', { class: 'muted center', style: { margin: 0 } }, 'What is your net result for the round?')),
      choices.node, fb);
  };
  next();
}
