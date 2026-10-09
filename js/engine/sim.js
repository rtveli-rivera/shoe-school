// sim.js — Monte Carlo blackjack for the bankroll tools.
//
// One player, heads-up against the dealer, a real shoe dealt to the cut card,
// Hi-Lo counted the way a player at the table sees the cards (the hole card only
// when it is turned over), bets from a ramp, every decision from
// strategy.decide() at the current true count. Synchronous and allocation-light
// so a worker can play a few hundred thousand rounds a second.
//
// Results are per *initial unit*: a round bet at 4 units that wins a double is
// +8. The per-true-count table records the result per unit bet, so it shows the
// player's edge at each count independent of the ramp.

import { mulberry32 } from './rng.js';
import { HILO_TAGS, trueCount } from './hilo.js';
import { handValue } from './rules.js';

// Fill and shuffle a shoe of engine ranks.
function freshShoe(decks, rand, buf) {
  let i = 0;
  for (let d = 0; d < decks; d++) {
    for (let r = 1; r <= 9; r++) for (let k = 0; k < 4; k++) buf[i++] = r;
    for (let k = 0; k < 16; k++) buf[i++] = 10;
  }
  for (let j = buf.length - 1; j > 0; j--) {
    const x = Math.floor(rand() * (j + 1));
    const t = buf[j]; buf[j] = buf[x]; buf[x] = t;
  }
}

function dealerHits(cards, rules) {
  const v = handValue(cards);
  return v.total < 17 || (v.total === 17 && v.soft && rules.hitSoft17);
}

function canDoubleOn(cards, rules, fromSplit, splitAces) {
  if (cards.length !== 2) return false;
  if (fromSplit && !rules.das) return false;
  if (splitAces && !rules.hitSplitAces) return false;
  if (rules.doubleOn === 'any') return true;
  const v = handValue(cards);
  const [lo, hi] = rules.doubleOn.split('-').map(Number);
  return !v.soft && v.total >= lo && v.total <= hi;
}

// opts: {
//   rules, decide, decideDE, takeInsurance   (from strategy.js / de.js)
//   ramp(tc) -> units                        bet for a true count
//   indexSet: 'none' | 'i18' | 'i18fab4'
//   wongOutBelow: tc | null                  sit out (bet nothing) below this count
//   rounds, seed, onProgress(frac)
// }
export function simulate(opts) {
  const { rules, decide, decideDE, takeInsurance, ramp, indexSet = 'i18fab4', rounds = 100000, seed = 1, onProgress } = opts;
  const wongOut = opts.wongOutBelow ?? null;
  const de = rules.variant === 'de';
  const holeFirst = rules.peek || de;     // ENHC deals the second dealer card after the players
  const rand = mulberry32(seed);
  const shoe = new Int8Array(rules.decks * 52);
  const cut = Math.round(shoe.length * rules.penetration);
  let pos = 0, rc = 0;
  const draw = (seen = true) => { const c = shoe[pos++]; if (seen) rc += HILO_TAGS[c]; return c; };
  const reshuffle = () => { freshShoe(rules.decks, rand, shoe); pos = 0; rc = 0; draw(false); /* burn */ };
  const tcOf = () => trueCount(rc, Math.max(0.5, Math.round(((shoe.length - pos) / 52) * 2) / 2));
  reshuffle();

  const byTc = new Map();
  let played = 0, sat = 0, sumWin = 0, sumSq = 0, sumBet = 0, hands = 0, shoes = 1;
  const progressEvery = Math.max(1000, Math.floor(rounds / 50));

  for (let n = 0; n < rounds; n++) {
    if (pos >= cut || shoe.length - pos < 20) { reshuffle(); shoes++; }
    const tc = tcOf();
    const bet = wongOut !== null && tc < wongOut ? 0 : ramp(tc);
    const res = playRound();               // a sat-out round still uses up cards (the other players)
    if (onProgress && n % progressEvery === 0) onProgress(n / rounds);
    if (!bet) { sat++; continue; }
    const win = res * bet;
    played++; sumWin += win; sumSq += win * win; sumBet += bet;
    const key = Math.max(-10, Math.min(10, tc));
    let row = byTc.get(key);
    if (!row) { row = { n: 0, win: 0, sq: 0 }; byTc.set(key, row); }
    row.n++; row.win += res; row.sq += res * res;
  }

  // One round for one unit; returns the result in units of the initial bet.
  function playRound() {
    const p = [draw(), 0];
    const up = draw();
    p[1] = draw();
    const hole = holeFirst ? draw(de) : 0;   // face up in Double Exposure, face down otherwise
    const playerBJ = handValue(p).total === 21;
    const insured = !de && up === 1 && takeInsurance(tcOf(), rules);
    const ins = (dealerBJ) => (insured ? (dealerBJ ? 1 : -0.5) : 0);   // half a unit at 2:1

    // dealer blackjack, known before anyone acts (peek, or both cards up)
    if (holeFirst && (up === 1 || up === 10) && handValue([up, hole]).total === 21) {
      if (!de) rc += HILO_TAGS[hole];
      hands++;
      if (playerBJ) return ins(true) + (de && rules.dePlayerBjWinsTie ? rules.bjPays : 0);
      return ins(true) - 1;
    }
    if (playerBJ) {
      hands++;
      if (holeFirst) { if (!de) rc += HILO_TAGS[hole]; return ins(false) + rules.bjPays; }
      const second = draw();                  // ENHC: a dealer blackjack would push it
      const dbj = handValue([up, second]).total === 21;
      return ins(dbj) + (dbj ? 0 : rules.bjPays);
    }

    // the player's hands; a split inserts the new hand right after the current one
    const list = [{ cards: p, bet: 1, fromSplit: false, splitAces: false, done: false, surrendered: false }];
    let splits = 0;
    for (let h = 0; h < list.length; h++) {
      const hand = list[h];
      if (hand.cards.length === 1) {
        hand.cards.push(draw());
        if (hand.splitAces && !rules.hitSplitAces && !(hand.cards[1] === 1 && rules.resplitAces && list.length < rules.maxSplitHands)) {
          hand.done = true;
        }
      }
      while (!hand.done) {
        if (handValue(hand.cards).total >= 21) { hand.done = true; break; }
        const two = hand.cards.length === 2;
        const pair = two && hand.cards[0] === hand.cards[1];
        const o = {
          canDouble: canDoubleOn(hand.cards, rules, hand.fromSplit, hand.splitAces),
          canSplit: pair && list.length < rules.maxSplitHands && !(hand.cards[0] === 1 && hand.fromSplit && !rules.resplitAces),
          canSurrender: two && !hand.fromSplit && list.length === 1 && rules.surrender === 'late' && !de,
          splitCount: splits, tc: tcOf(), indexSet,
        };
        const a = de ? decideDE(hand.cards, [up, hole], rules, o).action : decide(hand.cards, up, rules, o).action;
        if (a === 'hit') hand.cards.push(draw());
        else if (a === 'double' && o.canDouble) { hand.bet = 2; hand.cards.push(draw()); hand.done = true; }
        else if (a === 'split' && o.canSplit) {
          const c = hand.cards.pop();
          const aces = c === 1;
          splits++;
          hand.fromSplit = true; hand.splitAces = aces;
          list.splice(h + 1, 0, { cards: [c], bet: 1, fromSplit: true, splitAces: aces, done: false, surrendered: false });
          hand.cards.push(draw());
          if (aces && !rules.hitSplitAces && !(hand.cards[1] === 1 && rules.resplitAces && list.length < rules.maxSplitHands)) hand.done = true;
        } else if (a === 'surrender' && o.canSurrender) { hand.surrendered = true; hand.done = true; }
        else hand.done = true;                 // stand
      }
    }
    hands += list.length;

    // the dealer turns the hole card (or, ENHC, draws the second card)
    const dealer = [up];
    if (holeFirst) { dealer.push(hole); if (!de) rc += HILO_TAGS[hole]; } else dealer.push(draw());
    if (!holeFirst && handValue(dealer).total === 21) {
      // ENHC: a dealer blackjack takes doubles and splits too — or only the original bet (OBO)
      let loss = 0;
      if (rules.enhcObo) loss = list[0].surrendered ? 0.5 : 1;
      else for (const hand of list) loss += hand.surrendered ? 0.5 : hand.bet;
      return ins(true) - loss;
    }
    const live = list.some((hand) => !hand.surrendered && handValue(hand.cards).total <= 21);
    if (live) while (dealerHits(dealer, rules)) dealer.push(draw());
    const d = handValue(dealer).total;
    let result = 0;
    for (const hand of list) {
      if (hand.surrendered) { result -= 0.5; continue; }
      const t = handValue(hand.cards).total;
      if (t > 21) result -= hand.bet;
      else if (d > 21 || t > d) result += hand.bet;
      else if (t < d) result -= hand.bet;
      else if (de && rules.deTiesLose) result -= hand.bet;
    }
    return ins(false) + result;
  }

  const ev = played ? sumWin / played : 0;
  const variance = played ? sumSq / played - ev * ev : 0;
  const tcRows = [...byTc.entries()].sort((a, b) => a[0] - b[0]).map(([tc, r]) => {
    const m = r.win / r.n;
    const sd = Math.sqrt(Math.max(0, r.sq / r.n - m * m));
    return { tc, freq: r.n / Math.max(1, played), n: r.n, edge: m, se: sd / Math.sqrt(r.n) };
  });
  return {
    rounds, played, satOut: sat, shoes, hands,
    evPerRound: ev,                              // units per round played
    sdPerRound: Math.sqrt(Math.max(0, variance)),
    seEv: Math.sqrt(Math.max(0, variance) / Math.max(1, played)),
    avgBet: played ? sumBet / played : 0,
    edgeOnAction: sumBet ? sumWin / sumBet : 0,  // result per unit of initial bets
    byTc: tcRows,
  };
}
