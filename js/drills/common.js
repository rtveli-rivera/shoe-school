// common.js — pieces every drill uses: answer buttons, feedback, weighted picks.

import { el, mdInline } from '../ui.js';
import { ACTIONS } from '../game/shared.js';
import { cardForRank } from '../game/cards.js';
import { shuffle } from '../engine/rng.js';
import { misses, noteItem } from '../store.js';

// Blackjack action buttons. allowed: Set of action names. Keyboard: H S D P R.
export function actionButtons(allowed, onPick, order = ['hit', 'stand', 'double', 'split', 'surrender']) {
  const btns = {};
  const wrap = el('div', { class: 'actions' }, order.map((a) => {
    const A = ACTIONS[a];
    btns[a] = el('button', { class: `act ${A.cls}`, type: 'button', disabled: !allowed.has(a), onclick: () => onPick(a) },
      A.label, el('span', { class: 'key' }, A.key));
    return btns[a];
  }));
  const onKey = (e) => {
    if (!wrap.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const a = order.find((x) => ACTIONS[x].key === e.key.toUpperCase());
    if (a && allowed.has(a) && !btns[a].disabled) { e.preventDefault(); onPick(a); }
  };
  document.addEventListener('keydown', onKey);
  return {
    node: wrap,
    lock() { Object.values(btns).forEach((b) => { b.disabled = true; }); },
    mark(picked, right) {
      if (btns[right]) btns[right].classList.add('correct');
      if (picked !== right && btns[picked]) btns[picked].classList.add('wrong');
    },
  };
}

// Multiple-choice buttons. options: [{ label, value }]. Keyboard 1..9.
export function choiceButtons(options, onPick, { cls = '' } = {}) {
  const btns = options.map((o, i) => el('button', { class: `choice ${cls}`, type: 'button', html: mdInline(o.label), onclick: () => onPick(o.value, i) }));
  const wrap = el('div', { class: 'choices' }, btns);
  const onKey = (e) => {
    if (!wrap.isConnected) { document.removeEventListener('keydown', onKey); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= options.length && !btns[n - 1].disabled) { e.preventDefault(); onPick(options[n - 1].value, n - 1); }
  };
  document.addEventListener('keydown', onKey);
  return {
    node: wrap,
    lock() { btns.forEach((b) => { b.disabled = true; }); },
    mark(pickedIndex, rightIndex) {
      if (btns[rightIndex]) btns[rightIndex].classList.add('correct');
      if (pickedIndex !== rightIndex && btns[pickedIndex]) btns[pickedIndex].classList.add('wrong');
    },
  };
}

// Feedback under an answer. Correct answers move on by themselves; a miss waits
// for "Next" so there is time to read why.
export function feedback(target, ok, content, onNext, { autoMs = 700 } = {}) {
  const next = el('button', { class: 'btn primary', type: 'button', style: { marginTop: '10px' } }, 'Next →');
  const box = el('div', { class: `feedback ${ok ? 'good' : 'bad'}` },
    el('b', {}, ok ? '✓ Correct' : '✗ Not quite'),
    content ? (typeof content === 'string' ? el('div', { html: mdInline(content) }) : content) : null);
  target.replaceChildren(box);
  let fired = false;
  const go = () => { if (fired) return; fired = true; document.removeEventListener('keydown', onKey); onNext(); };
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  if (ok && autoMs >= 0) {
    setTimeout(go, autoMs);
  } else {
    box.append(el('div', {}, next));
    next.addEventListener('click', go);
    setTimeout(() => document.addEventListener('keydown', onKey), 150);
  }
}

// Pick an item, favouring ones this student has missed before.
export function weightedPick(rand, items, keyOf, drillId) {
  const m = misses(drillId);
  const weights = items.map((it) => 1 + 4 * (m[keyOf(it)] || 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < items.length; i++) { x -= weights[i]; if (x <= 0) return items[i]; }
  return items[items.length - 1];
}

export { noteItem };

// Two engine ranks that make a chart row. table: 'hard' | 'soft' | 'pairs'.
export function ranksForRow(table, row, rand) {
  if (table === 'pairs') { const r = row === 'A' ? 1 : Number(row); return [r, r]; }
  if (table === 'soft') { return shuffle(rand, [1, Number(row) - 11]); }
  const total = Number(row);
  const opts = [];
  for (let a = 2; a <= 10; a++) { const b = total - a; if (b >= 2 && b <= 10 && a !== b && a < b) opts.push([a, b]); }
  if (!opts.length) return null;
  return shuffle(rand, [...opts[Math.floor(rand() * opts.length)]]);
}

export function displayCards(ranks, rand) { return ranks.map((v) => cardForRank(v, rand)); }

// Every chart cell a two-card flashcard can show.
export function flashCells(tables) {
  const out = [];
  const ups = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  for (const t of tables) {
    const rows = t === 'hard' ? ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19']
      : t === 'soft' ? ['13', '14', '15', '16', '17', '18', '19', '20']
        : ['A', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    for (const row of rows) for (const up of ups) out.push({ table: t, row, up });
  }
  return out;
}

export function rankOfUp(up) { return up === 'A' ? 1 : Number(up); }
