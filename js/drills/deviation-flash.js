// deviation-flash: the hand, the upcard and the true count. Basic strategy or
// the index play? Counts are chosen around each index so the boundary is drilled.

import { el, fmtSigned, modal } from '../ui.js';
import { handEl, cardForRank } from '../game/cards.js';
import { strategy, ACTIONS, CODE_TEXT } from '../game/shared.js';
import { DEVIATIONS } from '../data/deviations.js';
import { settings } from '../store.js';
import { pick } from '../engine/rng.js';
import { actionButtons, choiceButtons, feedback, weightedPick, noteItem, ranksForRow, rankOfUp, peekRow } from './common.js';
import { showChartPeek } from '../game/peek.js';
import { legalFor, allowedSet } from './bs-flash.js';

export function mount(stage, ctx) {
  const { rand, rules, params } = ctx;
  const indexSet = params.indexSet || settings().indexSet || 'i18fab4';
  const list = (DEVIATIONS[rules.hitSoft17 ? 'h17' : 's17'] || []).filter((d) =>
    (d.set !== 'fab4' || (indexSet === 'i18fab4' && rules.surrender === 'late')) && d.set !== 'basic');
  let alive = true;
  if (!list.length) {
    stage.append(el('div', { class: 'feedback info' }, 'The index tables are not loaded yet.'));
    return () => {};
  }
  (async () => {
    const s = await strategy();
    if (!alive) return;
    const next = () => {
      const dev = weightedPick(rand, list, (d) => d.id, 'deviation-flash');
      const tc = dev.index + pick(rand, [-2, -1, -1, 0, 0, 1, 1, 2]);
      const fb = el('div');
      const tcBox = el('div', { class: 'card center', style: { padding: '10px' } },
        el('div', { class: 'kicker' }, 'True count'), el('div', { class: 'result-big num', style: { fontSize: '40px' } }, fmtSigned(tc)));

      if (dev.set === 'insurance' || dev.action === 'insure') {
        const right = s.takeInsurance(tc, rules);
        const opts = [{ label: 'Take insurance', value: true }, { label: 'Decline', value: false }];
        let didPeek = false;   // a peek counts as a miss
        const c = choiceButtons(opts, (val, i) => {
          c.lock();
          const ok = val === right && !didPeek;
          c.mark(i, right ? 0 : 1);
          ctx.report(ok);
          noteItem('deviation-flash', dev.id, ok);
          feedback(fb, ok, `Insurance becomes a good bet at true count **${fmtSigned(dev.index)}** or higher. At ${fmtSigned(tc)}: ${right ? 'take it' : 'decline'}.`, () => ctx.advance(next), { autoMs: 900 });
        });
        const mine = [cardForRank(10, rand), cardForRank(2 + Math.floor(rand() * 8), rand)];
        stage.replaceChildren(tcBox,
          el('div', { class: 'felt', style: { marginBottom: '12px' } },
            el('div', { class: 'dealer-zone' }, el('span', { class: 'label' }, 'Dealer'), handEl([cardForRank(1, rand), null], { hidden: [1], spread: true })),
            el('div', { class: 'me-zone', style: { display: 'flex', justifyContent: 'center', marginTop: '12px' } }, handEl(mine, { spread: true }))),
          el('p', { class: 'prompt' }, 'Insurance?'), c.node,
          peekRow(ctx, () => {
            didPeek = true;
            modal((close) => el('div', {}, el('div', { class: 'kicker' }, 'Insurance'),
              el('p', {}, `Take insurance (or even money) at true count ${fmtSigned(dev.index)} or higher; decline below it.`),
              el('button', { class: 'btn small primary', type: 'button', onclick: close }, 'Back')));
          }, { label: '📋 Rule' }),
          fb);
        return;
      }

      const ranks = ranksForRow(dev.table, dev.row, rand);
      const up = rankOfUp(dev.up);
      const opts = legalFor(ranks, rules);
      const basic = s.decide(ranks, up, rules, { ...opts, indexSet: 'none' });
      const res = s.decide(ranks, up, rules, { ...opts, tc, indexSet });
      const right = res.action;
      let didPeek = false;   // a peek counts as a miss
      const buttons = actionButtons(allowedSet(opts), (picked) => {
        buttons.lock();
        const ok = picked === right && !didPeek;
        buttons.mark(picked, right);
        ctx.report(ok);
        noteItem('deviation-flash', dev.id, ok);
        const deviates = res.source === 'deviation';
        feedback(fb, ok,
          `${didPeek ? 'Peeked, so it counts as a miss. ' : ''}${dev.label}. At ${fmtSigned(tc)}: **${ACTIONS[right].label}**${deviates ? ' (the index play)' : ` (basic strategy: ${CODE_TEXT[basic.code] || basic.action})`}.`,
          () => ctx.advance(next), { autoMs: 1100, title: didPeek ? '👀 Peeked' : undefined });
      });
      stage.replaceChildren(tcBox,
        el('div', { class: 'felt', style: { marginBottom: '12px' } },
          el('div', { class: 'dealer-zone' }, el('span', { class: 'label' }, 'Dealer'), handEl([cardForRank(up, rand), null], { hidden: [1], spread: true })),
          el('div', { class: 'me-zone', style: { display: 'flex', justifyContent: 'center', marginTop: '12px' } }, handEl(ranks.map((r) => cardForRank(r, rand)), { spread: true }))),
        buttons.node,
        peekRow(ctx, () => { didPeek = true; showChartPeek({ rules, presetId: ctx.presetId, hand: ranks, up, opts, indexSet }); }),
        fb);
    };
    next();
  })().catch((err) => { console.error(err); stage.replaceChildren(el('div', { class: 'feedback bad' }, err.message)); });
  return () => { alive = false; };
}
