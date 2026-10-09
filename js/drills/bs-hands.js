// bs-hands: real hands, played to the end (splits, doubles, the dealer's draw).
// Every decision is checked against the chart; a wrong one is corrected and the
// hand continues with the right play.

import { el, sleep } from '../ui.js';
import { handEl } from '../game/cards.js';
import { Table, cardsValue } from '../game/table.js';
import { strategy, doubleExposure, CODE_TEXT, ACTIONS } from '../game/shared.js';
import { actionButtons, choiceButtons } from './common.js';
import { allowedSet } from './bs-flash.js';
import { settings } from '../store.js';

export function mount(stage, ctx) {
  const { rand, rules } = ctx;
  let alive = true;
  const speed = settings().dealSpeed || 1;
  (async () => {
    const s = await strategy();
    const de = rules.variant === 'de' ? await doubleExposure() : null;
    const table = new Table({ rules, rand, bots: 0 });
    const felt = el('div', { class: 'felt', style: { marginBottom: '12px' } });
    const controls = el('div');
    const note = el('div');
    stage.replaceChildren(felt, controls, note);

    const draw = () => {
      const d = table.dealer;
      const me = table.seats[0];
      const dv = cardsValue(d.cards.filter((_, i) => !(i === 1 && d.holeHidden)));
      felt.replaceChildren(
        el('div', { class: 'dealer-zone' }, el('span', { class: 'label' }, 'Dealer'),
          handEl(d.cards, { hidden: d.holeHidden ? [1] : [], spread: true }),
          d.cards.length ? el('span', { class: 'total-badge' }, d.holeHidden ? `${dv.total}` : `${dv.soft && dv.total < 21 ? 'soft ' : ''}${dv.total}`) : null),
        el('div', { class: 'seat-row me-zone', style: { marginTop: '14px' } },
          me.hands.map((h, i) => {
            const v = cardsValue(h.cards);
            const active = table.activeSeat === me && table.activeHand === i;
            return el('div', { class: `seat me${active && me.hands.length > 1 ? ' active' : ''}` },
              handEl(h.cards, { spread: me.hands.length === 1 }),
              h.cards.length ? el('span', { class: 'total-badge' }, `${v.soft && v.total < 21 ? 'soft ' : ''}${v.total}${h.doubled ? ' ×2' : ''}`) : null,
              h.result ? el('span', { class: `outcome ${h.net > 0 ? 'win' : h.net < 0 ? 'lose' : 'push'}` }, h.result) : null);
          })));
    };

    const io = {
      bet: async () => 1,
      update: draw,
      pause: (kind) => sleep((kind === 'deal' ? 160 : kind === 'dealer' ? 380 : 120) / speed),
      insurance: () => new Promise((resolve) => {
        const opts = [{ label: 'Take insurance', value: true }, { label: 'No insurance', value: false }];
        const c = choiceButtons(opts, (val, i) => {
          c.lock();
          const ok = val === false;
          c.mark(i, 1);
          ctx.report(ok);
          note.replaceChildren(el('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
            ok ? '✓ Never insure without a count.' : '✗ Insurance is a side bet that loses money unless the true count is +3 or more. Without counting: always decline.'));
          setTimeout(() => resolve(false), ok ? 400 : 1600);
        });
        controls.replaceChildren(el('p', { class: 'prompt' }, 'Dealer shows an ace. Insurance?'), c.node);
      }),
      decide: (seat, hand, opts) => new Promise((resolve) => {
        const ranks = hand.cards.map((c) => c.v);
        const decideOpts = { ...opts, indexSet: 'none' };
        const res = de
          ? de.decideDE(ranks, table.dealer.cards.map((c) => c.v), rules, decideOpts)
          : s.decide(ranks, table.dealer.cards[0].v, rules, decideOpts);
        const right = res.action;
        const buttons = actionButtons(allowedSet(opts), (picked) => {
          buttons.lock();
          const ok = picked === right;
          buttons.mark(picked, right);
          ctx.report(ok);
          if (ok) { note.replaceChildren(); setTimeout(() => resolve(picked), 150); }
          else {
            note.replaceChildren(el('div', { class: 'feedback bad' },
              el('b', {}, `✗ ${ACTIONS[right].label}. `), `Chart: ${CODE_TEXT[res.code] || res.code}. Playing it correctly…`));
            setTimeout(() => resolve(right), 1400);
          }
        });
        controls.replaceChildren(buttons.node);
      }),
    };

    while (alive && !ctx.done) {
      if (table.needsShuffle) table.newShoe();
      note.replaceChildren();
      controls.replaceChildren();
      await table.playRound(io);
      if (!alive) return;
      draw();
      const me = table.seats[0];
      const net = me.result || 0;
      controls.replaceChildren(el('p', { class: 'felt-msg', style: { color: 'var(--muted)' } },
        net > 0 ? `You win ${net} unit${net === 1 ? '' : 's'}` : net < 0 ? `You lose ${-net} unit${net === -1 ? '' : 's'}` : 'Push'));
      await sleep(1100 / speed);
    }
    if (alive) ctx.finish();
  })().catch((err) => { console.error(err); stage.replaceChildren(el('div', { class: 'feedback bad' }, `Something broke: ${err.message}`)); });
  return () => { alive = false; };
}
