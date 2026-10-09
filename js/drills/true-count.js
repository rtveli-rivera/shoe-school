// true-count: running count ÷ decks remaining, rounded down. Optionally the
// decks remaining come from the tray picture instead of a number.

import { el, numberPad, fmtSigned } from '../ui.js';
import { trueCount, exactTrueCount, TC_ROUNDING } from '../engine/hilo.js';
import { trayEl } from '../game/tray.js';
import { feedback } from './common.js';

export function mount(stage, ctx) {
  const { rand, rules, params } = ctx;
  const decks = Math.max(1, rules.decks);
  const useTray = params.tray ?? false;
  const next = () => {
    const halves = 1 + Math.floor(rand() * (decks * 2 - 1)); // 0.5 .. decks-0.5
    const left = halves / 2;
    let rc;
    do { rc = Math.round((rand() - 0.45) * 2 * Math.min(18, 4 * left + 4)); } while (Math.abs(exactTrueCount(rc, left)) > 9);
    const right = trueCount(rc, left);
    const fb = el('div');
    const pad = numberPad({
      onSubmit: (val) => {
        pad.setDisabled(true);
        const ok = val === right;
        ctx.report(ok);
        const exact = rc / left;
        const rounding = TC_ROUNDING === 'floor' && !Number.isInteger(exact)
          ? ` We round **down**: ${exact.toFixed(2)} → ${fmtSigned(right)}${exact < 0 ? ' (down means more negative)' : ''}.` : '';
        feedback(fb, ok, `${fmtSigned(rc)} ÷ ${left} = ${exact.toFixed(2)}.${rounding}`, () => ctx.advance(next), { autoMs: 900 });
      },
    });
    stage.replaceChildren(
      el('div', { class: 'card center' },
        el('div', { class: 'kicker' }, 'Running count'),
        el('div', { class: 'result-big num' }, fmtSigned(rc)),
        useTray
          ? el('div', {}, el('p', { class: 'muted', style: { margin: '4px 0' } }, `${decks}-deck shoe. Decks left: read the tray.`),
            el('div', { class: 'tray-scene' }, trayEl(decks, (decks - left) * 52, { height: 160 })))
          : el('p', { class: 'muted', style: { margin: 0 } }, `with ${left} deck${left === 1 ? '' : 's'} left to be dealt`)),
      el('p', { class: 'prompt' }, 'True count?'),
      pad.node, fb);
  };
  next();
}
