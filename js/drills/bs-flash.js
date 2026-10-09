// bs-flash: two cards and the dealer's upcard. What is the play?
// Cells the student misses come back more often (store.noteItem).

import { el } from '../ui.js';
import { handEl, cardForRank } from '../game/cards.js';
import { chartFor, strategy, doubleExposure, CODE_TEXT, rowLabel } from '../game/shared.js';
import { evBreakdown } from '../game/chartview.js';
import { handValue } from '../engine/rules.js';
import { actionButtons, feedback, weightedPick, noteItem, ranksForRow, flashCells, rankOfUp } from './common.js';

export function legalFor(ranks, rules, { fromSplit = false } = {}) {
  const v = handValue(ranks);
  let canDouble = ranks.length === 2 && (!fromSplit || rules.das);
  if (canDouble && rules.doubleOn !== 'any') {
    const [lo, hi] = rules.doubleOn.split('-').map(Number);
    canDouble = !v.soft && v.total >= lo && v.total <= hi;
  }
  const canSplit = ranks.length === 2 && ranks[0] === ranks[1];
  const canSurrender = ranks.length === 2 && !fromSplit && rules.surrender === 'late' && rules.variant !== 'de';
  return { canDouble, canSplit, canSurrender, splitCount: 0 };
}

export function allowedSet(opts) {
  const s = new Set(['hit', 'stand']);
  if (opts.canDouble) s.add('double');
  if (opts.canSplit) s.add('split');
  if (opts.canSurrender) s.add('surrender');
  return s;
}

export function mount(stage, ctx) {
  const { rand, rules, params } = ctx;
  stage.append(el('div', { class: 'spinner' }));
  const tables = params.tables || ['hard', 'soft', 'pairs'];
  let alive = true;
  (async () => {
    const s = await strategy();
    const de = rules.variant === 'de' ? await doubleExposure() : null;
    const chart = de ? null : await chartFor(rules);
    if (!alive) return;
    const cells = flashCells(tables).filter((c) => ranksForRow(c.table, c.row, rand));
    const keyOf = (c) => `${ctx.presetId}|${c.table}|${c.row}|${c.up}`;

    const next = () => {
      const cell = weightedPick(rand, cells, keyOf, 'bs-flash');
      const ranks = ranksForRow(cell.table, cell.row, rand);
      const up = rankOfUp(cell.up);
      const opts = legalFor(ranks, rules);
      let dealerRanks = [up];
      let res;
      if (de) {
        // Double Exposure: the dealer's second card is face up too
        do { dealerRanks = [up, 1 + Math.floor(rand() * 10)]; } while (handValue(dealerRanks).total === 21);
        res = de.decideDE(ranks, dealerRanks, rules, { ...opts, indexSet: 'none' });
      } else {
        res = s.decide(ranks, up, rules, { ...opts, indexSet: 'none' });
      }
      const right = res.action;
      const fb = el('div');
      const buttons = actionButtons(allowedSet(opts), (picked) => {
        buttons.lock();
        const ok = picked === right;
        buttons.mark(picked, right);
        ctx.report(ok);
        noteItem('bs-flash', keyOf(cell), ok);
        const tName = cell.table === 'pairs' ? 'pair' : cell.table;
        const msg = el('div', {},
          el('p', { style: { margin: '6px 0' } }, `${tName === 'pair' ? 'Pair of' : tName[0].toUpperCase() + tName.slice(1)} ${rowLabel(cell.table, cell.row)} vs ${de ? dealerRanks.map((r) => r === 1 ? 'A' : r).join('+') : cell.up}: `,
            el('b', {}, CODE_TEXT[res.code] || res.action)),
          chart ? evBreakdown(chart, res.table || cell.table, res.row || cell.row, cell.up) : null);
        feedback(fb, ok, ok ? null : msg, () => ctx.advance(next));
      });
      const dealerCards = dealerRanks.map((r) => cardForRank(r, rand));
      const mine = ranks.map((r) => cardForRank(r, rand));
      const v = handValue(ranks);
      stage.replaceChildren(
        el('div', { class: 'felt', style: { marginBottom: '14px' } },
          el('div', { class: 'dealer-zone' }, el('span', { class: 'label' }, 'Dealer'),
            handEl(de ? dealerCards : [dealerCards[0], null], { hidden: de ? [] : [1], spread: true })),
          el('div', { class: 'me-zone', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '12px' } },
            handEl(mine, { spread: true }),
            el('span', { class: 'total-badge', style: { marginTop: '6px' } }, ranks[0] === ranks[1] ? `pair of ${ranks[0] === 1 ? 'aces' : ranks[0] === 10 ? 'tens' : ranks[0] + 's'}` : `${v.soft ? 'soft' : 'hard'} ${v.total}`))),
        buttons.node, fb);
    };
    next();
  })().catch((err) => { console.error(err); stage.replaceChildren(el('div', { class: 'feedback bad' }, `Could not load the strategy engine: ${err.message}`)); });
  return () => { alive = false; };
}
