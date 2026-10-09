// tray.js — the discard tray, drawn to scale: its height holds the whole shoe,
// the stack in it is the cards already played. Reading it is how you estimate
// the decks remaining at a real table.

import { el } from '../ui.js';

export function trayEl(decksTotal, cardsDiscarded, { marks = false, height = 220, label = 'Discard tray' } = {}) {
  const cap = decksTotal * 52;
  const frac = Math.max(0, Math.min(1, cardsDiscarded / cap));
  const tray = el('div', { class: 'tray', style: { height: `${height}px` } },
    el('div', { class: 'stack', style: { height: `${frac * (height - 6)}px` } }));
  if (marks) {
    tray.append(el('div', { class: 'tray-scale' },
      Array.from({ length: decksTotal + 1 }, (_, i) => el('span', {}, String(i)))));
  }
  return el('div', {}, tray, el('div', { class: 'tray-label' }, label));
}
