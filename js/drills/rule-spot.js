// rule-spot: the cells that change between two casinos' rules. Same hand,
// different game: what is the play *here*?

import { el } from '../ui.js';
import { handEl, cardForRank } from '../game/cards.js';
import { chartFor, strategy, CODE_TEXT, rowLabel } from '../game/shared.js';
import { chartDiff } from '../game/chartview.js';
import { rulesFor, presetById } from '../engine/rules.js';
import { pick } from '../engine/rng.js';
import { actionButtons, feedback, ranksForRow, rankOfUp, noteItem } from './common.js';
import { legalFor, allowedSet } from './bs-flash.js';

export function mount(stage, ctx) {
  const { rand, params } = ctx;
  const fromId = params.from || 'shoe-6d-s17';
  const toId = params.to || 'shoe-6d-h17';
  let alive = true;
  stage.append(el('div', { class: 'spinner' }));
  (async () => {
    const s = await strategy();
    const [ca, cb] = await Promise.all([chartFor(fromId), chartFor(toId)]);
    if (!alive) return;
    const diffs = chartDiff(ca, cb).filter((d) => ranksForRow(d.table, d.row, rand));
    const games = [{ id: fromId, p: presetById(fromId), rules: rulesFor(fromId) }, { id: toId, p: presetById(toId), rules: rulesFor(toId) }];
    if (!diffs.length) {
      stage.replaceChildren(el('div', { class: 'feedback info' }, `${games[0].p.short} and ${games[1].p.short} have identical charts. Nothing to spot.`));
      return;
    }
    const next = () => {
      const d = pick(rand, diffs);
      const g = pick(rand, games);
      const ranks = ranksForRow(d.table, d.row, rand);
      const up = rankOfUp(d.up);
      const opts = legalFor(ranks, g.rules);
      const res = s.decide(ranks, up, g.rules, { ...opts, indexSet: 'none' });
      const other = games.find((x) => x !== g);
      const otherRes = s.decide(ranks, up, other.rules, { ...legalFor(ranks, other.rules), indexSet: 'none' });
      const fb = el('div');
      const buttons = actionButtons(allowedSet(opts), (picked) => {
        buttons.lock();
        const ok = picked === res.action;
        buttons.mark(picked, res.action);
        ctx.report(ok);
        noteItem('rule-spot', `${g.id}|${d.table}|${d.row}|${d.up}`, ok);
        feedback(fb, ok,
          `${g.p.short}: **${CODE_TEXT[res.code]}**. In ${other.p.short} the same hand is: ${CODE_TEXT[otherRes.code]}.`,
          () => ctx.advance(next), { autoMs: 1600 });
      });
      stage.replaceChildren(
        el('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '8px' } }, el('span', { class: 'pill gold' }, `Playing: ${g.p.name}`)),
        el('div', { class: 'felt', style: { marginBottom: '14px' } },
          el('div', { class: 'dealer-zone' }, el('span', { class: 'label' }, 'Dealer'), handEl([cardForRank(up, rand), null], { hidden: [1], spread: true })),
          el('div', { class: 'me-zone', style: { display: 'flex', justifyContent: 'center', marginTop: '12px' } }, handEl(ranks.map((r) => cardForRank(r, rand)), { spread: true }))),
        el('p', { class: 'faint center', style: { fontSize: '13px' } }, `${d.table === 'pairs' ? 'Pair' : d.table[0].toUpperCase() + d.table.slice(1)} ${rowLabel(d.table, d.row)} vs ${d.up}`),
        buttons.node, fb);
    };
    next();
  })().catch((err) => { console.error(err); stage.replaceChildren(el('div', { class: 'feedback bad' }, err.message)); });
  return () => { alive = false; };
}
