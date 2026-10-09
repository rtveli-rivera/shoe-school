// hand-total: what is this hand worth? Soft or hard?

import { el } from '../ui.js';
import { cardForRank, handEl } from '../game/cards.js';
import { handValue } from '../engine/rules.js';
import { shuffle } from '../engine/rng.js';
import { choiceButtons, feedback, noteItem } from './common.js';

function label(ranks) {
  const v = handValue(ranks);
  if (ranks.length === 2 && v.total === 21) return 'Blackjack';
  if (v.total > 21) return 'Bust';
  return v.soft ? `Soft ${v.total}` : `Hard ${v.total}`;
}

// A distractor must be something a hand could actually be.
function validLabel(s) {
  if (s === 'Blackjack' || s === 'Bust') return true;
  const m = /^(Hard|Soft) (\d+)$/.exec(s);
  if (!m) return false;
  const n = Number(m[2]);
  return m[1] === 'Hard' ? n >= 4 && n <= 21 : n >= 12 && n <= 21;
}

function randomHand(rand) {
  // weight toward hands with aces, where beginners slip
  const n = 2 + (rand() < 0.45 ? 1 : 0) + (rand() < 0.15 ? 1 : 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = rand();
    out.push(x < 0.22 ? 1 : x < 0.5 ? 10 : 2 + Math.floor(rand() * 8));
  }
  return out;
}

export function mount(stage, ctx) {
  const { rand } = ctx;
  const next = () => {
    let ranks;
    do { ranks = randomHand(rand); } while (handValue(ranks).total > 26);
    const right = label(ranks);
    const v = handValue(ranks);
    const hardTotal = ranks.reduce((a, b) => a + b, 0);
    const set = new Set([right]);
    const cands = [];
    if (v.soft) cands.push(`Hard ${v.total}`, `Hard ${hardTotal}`, `Soft ${v.total + 1}`, `Soft ${v.total - 1}`);
    else if (right === 'Bust') cands.push(`Hard ${Math.min(21, v.total - 10)}`, `Soft ${Math.min(21, v.total - 10)}`, `Hard ${v.total - 1}`);
    else if (right === 'Blackjack') cands.push('Soft 21', 'Hard 21', 'Soft 11');
    else cands.push(`Soft ${v.total}`, `Hard ${v.total + 1}`, `Hard ${v.total - 1}`, 'Bust');
    for (const c of shuffle(rand, cands)) { if (set.size < 4 && validLabel(c)) set.add(c); }
    while (set.size < 4) set.add(`Hard ${4 + Math.floor(rand() * 17)}`);
    const opts = shuffle(rand, [...set]).map((x) => ({ label: x, value: x }));
    const fb = el('div');
    const cards = ranks.map((r) => cardForRank(r, rand));
    const choices = choiceButtons(opts, (val, i) => {
      choices.lock();
      const ok = val === right;
      choices.mark(i, opts.findIndex((o) => o.value === right));
      ctx.report(ok);
      noteItem('hand-total', ranks.slice().sort().join(','), ok);
      const why = v.soft
        ? `The ace counts as 11 here (${hardTotal} + 10 = ${v.total}), and could still drop to 1 if you hit. That makes it **soft**.`
        : right === 'Bust' ? `Every ace already counts as 1 and the hand is still over 21.`
          : right === 'Blackjack' ? 'An ace plus a ten-value card as your first two cards is a natural: **blackjack**.'
            : ranks.includes(1) ? `Counting the ace as 11 would bust, so it counts as 1: **hard ${v.total}**.` : `No ace, so it is simply **hard ${v.total}**.`;
      feedback(fb, ok, ok ? null : `It is **${right}**. ${why}`, () => ctx.advance(next));
    });
    stage.replaceChildren(
      el('p', { class: 'prompt' }, 'What is this hand?'),
      el('div', { class: 'cards-row big-cards' }, handEl(cards, { spread: true })),
      choices.node, fb);
  };
  next();
}
