// hilo.js — the Hi-Lo count: card tags, running count, true count.
//
// Engine ranks: 1 = Ace, 2..9, 10 = ten-value.
// Low cards (2-6) leaving the shoe help you: +1. High cards (10-A): -1. 7-9: 0.

export const HILO_TAGS = Object.freeze({ 1: -1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: -1 });

export function hiloTag(rank) {
  const t = HILO_TAGS[rank];
  if (t === undefined) throw new Error(`Bad rank: ${rank}`);
  return t;
}

export function runningCount(ranks, start = 0) {
  let rc = start;
  for (const r of ranks) rc += HILO_TAGS[r];
  return rc;
}

// How the app turns a running count into the true count it bets and plays by.
// 'floor' rounds down (RC +5 over 2 decks = +2.5 -> +2; RC -3 over 2 decks =
// -1.5 -> -2). Indices are written as "act when TC >= index", so flooring is the
// conservative reading: you never make a deviation a half count too early.
export const TC_ROUNDING = 'floor';

// Decks are never estimated finer than half a deck at the table, and never below
// half a deck (the last half deck is behind the cut card anyway).
export function estimateDecksRemaining(cardsRemaining, step = 0.5) {
  const decks = cardsRemaining / 52;
  return Math.max(step, Math.round(decks / step) * step);
}

export function exactTrueCount(rc, decksRemaining) {
  return rc / Math.max(0.5, decksRemaining);
}

export function trueCount(rc, decksRemaining) {
  const x = exactTrueCount(rc, decksRemaining);
  // Guard against 2.9999999 from float division landing a whole count low.
  return Math.floor(x + 1e-9);
}
