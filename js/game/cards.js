// cards.js — real playing cards for the UI: parsing, shoes, rendering.
//
// A UI card is { r: 'A'|'2'..'10'|'J'|'Q'|'K', s: '♠'|'♥'|'♦'|'♣', v: engine rank }
// where the engine rank is 1 for an ace, 2..9, and 10 for any ten-value card.

import { el } from '../ui.js';
import { shuffle, pick } from '../engine/rng.js';

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['♠', '♥', '♦', '♣'];
const RED = new Set(['♥', '♦']);

export function rankToEngine(r) {
  if (r === 'A') return 1;
  if (r === 'J' || r === 'Q' || r === 'K') return 10;
  return Number(r);
}

export function makeCard(r, s) { return { r, s, v: rankToEngine(r) }; }

export function parseCard(str) {
  if (typeof str !== 'string') return str;
  const s = str.slice(-1);
  const r = str.slice(0, -1).toUpperCase();
  if (!SUITS.includes(s) || !RANKS.includes(r)) throw new Error(`Bad card string: ${str}`);
  return makeCard(r, s);
}

export function cardText(c) { return `${c.r}${c.s}`; }

// A display card for an engine rank, with a random suit (and a random face for tens).
export function cardForRank(v, rand) {
  const s = pick(rand, SUITS);
  if (v === 1) return makeCard('A', s);
  if (v === 10) return makeCard(pick(rand, ['10', 'J', 'Q', 'K']), s);
  return makeCard(String(v), s);
}

export function fullDeck() {
  const out = [];
  for (const s of SUITS) for (const r of RANKS) out.push(makeCard(r, s));
  return out;
}

export function makeShoe(decks, rand) {
  const out = [];
  for (let d = 0; d < decks; d++) out.push(...fullDeck());
  return shuffle(rand, out);
}

// Render one card. opts: { back, dim, deal, title }
export function cardEl(card, opts = {}) {
  if (opts.back || !card) {
    return el('span', { class: `pcard back${opts.deal ? ' deal-in' : ''}`, role: 'img', 'aria-label': 'face-down card' });
  }
  const c = typeof card === 'string' ? parseCard(card) : card;
  const face = c.r === 'J' || c.r === 'Q' || c.r === 'K';
  const cls = ['pcard'];
  if (RED.has(c.s)) cls.push('red');
  if (opts.dim) cls.push('dim');
  if (opts.deal) cls.push('deal-in');
  const corner = (k) => el('span', { class: k }, el('span', { class: 'rk' }, c.r), el('span', { class: 'st' }, c.s));
  return el('span', { class: cls.join(' '), role: 'img', 'aria-label': spokenCard(c) },
    corner('tl'),
    el('span', { class: `mid${face ? ' face' : ''}` }, face ? `${c.r}${c.s}` : c.s),
    corner('br'),
  );
}

const SPOKEN_R = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
const SPOKEN_S = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
export function spokenCard(c) { return `${SPOKEN_R[c.r] || c.r} of ${SPOKEN_S[c.s]}`; }

// A row of overlapping cards. cards: UI cards or strings; hidden: indexes face down.
export function handEl(cards, { hidden = [], spread = false, dealLast = false, cls = '' } = {}) {
  return el('div', { class: `hand${spread ? ' spread' : ''} ${cls}` },
    cards.map((c, i) => cardEl(c, { back: hidden.includes(i), deal: dealLast && i === cards.length - 1 })));
}
