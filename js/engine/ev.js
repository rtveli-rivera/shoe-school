// ev.js — player expected values, per unit bet, by combinatorial analysis.
//
// Pure ES module (no DOM, no Node APIs).
//
// Everything is exact for one hand played against the dealer with true card
// removal: every card the player draws comes out of the shoe the dealer then
// draws from (no infinite-deck shortcut). The only approximation is in
// RESplits (see "Splits" below).
//
// Contents: HandSolver (all EVs against one dealer starting hand), split
// values, the classic game (one solver per upcard), the house-edge enumeration,
// chart codes, chart rows priced from their hands, and charts played back
// (total-dependent continuation, refineChartTD). strategy.js and de.js build on
// these.
//
// ---------------------------------------------------------------------------
// The peek trick (US hole-card game, dealer shows A or 10)
//
// The player only acts when the dealer does NOT have blackjack, so every EV we
// show is conditional on that. Conditioning the hole card and then letting the
// player draw is fiddly; instead we use exchangeability (the hole card is just
// "some card the player never sees") and compute the UNNORMALISED value
//
//     U = E[ outcome * 1{dealer has no blackjack} ]
//
// with the hole card drawn after the player's cards. U and the true
// conditional EV differ by the factor P(no dealer blackjack | cards the player
// started with), which is the same for every action at a decision point, so
// decisions made on U are exactly the conditional-optimal ones. A player bust
// is worth -P(no dealer BJ | remaining shoe) in U-units, a stand is the sum over
// the dealer's non-blackjack finishes. To display an EV, divide U by
// P(no dealer BJ) at the decision point. With no peek (ENHC) and in Double
// Exposure the values are plain EVs (the factor is 1).
//
// European no hole card (ENHC): the dealer's second card is drawn after the
// player, a dealer blackjack takes every bet on the table including doubles and
// split hands (rules.enhcObo = false). With OBO ("original bets only") the
// player only ever loses the original bet to a dealer blackjack, which is
// exactly the peek game in EV and strategy, so OBO is computed as peek.
// Surrender in an ENHC game is valued as -0.5 whatever the dealer then draws
// (you surrender before the dealer's second card exists — the convention of the
// Wizard of Odds no-hole-card strategy, which surrenders e.g. hard 5-7 vs an A).
//
// ---------------------------------------------------------------------------
// Splits
//
// A split hand is valued as one hand that starts with the pair card, with BOTH
// pair cards removed from the shoe; the cards that go to the other split hand
// are not removed (each hand is played as if it were alone, on its own cards).
// For a single split (two hands) this is EXACT, not an approximation: the
// other hand draws by a stopping rule on its own cards, and the dealer's
// outcome probabilities, as a function of the remaining shoe, form a martingale
// as cards come out, so by optional stopping the other hand's draws leave this
// hand's expected result unchanged; by symmetry both hands are worth the same.
// (Checked numerically against a full two-hand enumeration: identical to 5
// decimals in six cases, docs/VALIDATION.md.)
// Resplits are the approximation. With p = the chance that a split hand's next
// card is another pair card (from the shoe after the pair), they are counted
// with the expected number of hands of each kind under that same p:
//
//     EV(split) = n_np * E[hand | 2nd card is not a pair card]
//               + n_pp * E[hand | 2nd card IS a pair card and can no longer be split]
//
// n_np, n_pp come from splitHandCounts(p, maxHands); resplitting is optional
// (the best limit 2..maxHands is taken). With maxHands = 2 this is just
// 2 * E[one split hand]. Aces get one card each unless rules.hitSplitAces, and
// are resplit only with rules.resplitAces. Hands made of a split are never
// surrendered and a two-card 21 after a split is not a blackjack. Against the
// Wizard of Odds house edges for resplit-to-4 games the result is within 0.003%.
//
// Doubling restrictions (rules.doubleOn): 'any' = any first two cards;
// '9-11' / '10-11' = HARD totals only (the Reno rule: a soft 19 such as A,8 is
// not "a 9"). The same restriction applies after a split when DAS is allowed.

import { dealerPaths, evalPaths, O_BUST, O_BJ } from './dealer.js';
import { fullShoe, removeCards, shoeSize, pairProb } from './shoe.js';

// Multiset key of a player hand: base-32 digit per rank (a hand never holds 32 of one rank).
const W = [0];
for (let r = 1; r <= 10; r++) W[r] = 32 ** (r - 1);

export function handTotal(hard, ace) { return ace && hard + 10 <= 21 ? hard + 10 : hard; }
export function handIsSoft(hard, ace) { return ace && hard + 10 <= 21; }

// May a two-card hand with this value be doubled under rules.doubleOn?
export function doubleAllowedFor(rules, hard, ace) {
  if (rules.doubleOn === 'any') return true;
  if (handIsSoft(hard, ace)) return false;
  const t = handTotal(hard, ace);
  return rules.doubleOn === '9-11' ? (t >= 9 && t <= 11) : (t >= 10 && t <= 11);
}

// Expected number of finished split hands of each kind, given p = P(a split
// hand's second card is another pair card) and the hand limit. Returns
// [nonPairHands, pairHandsThatCouldNotBeResplit]. Hands are processed one at a
// time; a pair card on a hand while fewer than maxHands hands exist splits it.
export function splitHandCounts(p, maxHands) {
  const memo = new Map();
  const f = (pending, hands) => {
    if (pending === 0) return [0, 0];
    const k = pending * 8 + hands;
    const hit = memo.get(k);
    if (hit) return hit;
    const done = f(pending - 1, hands);
    const np = [1 + done[0], done[1]];
    const pr = hands < maxHands ? f(pending + 1, hands + 1) : [done[0], 1 + done[1]];
    const res = [(1 - p) * np[0] + p * pr[0], (1 - p) * np[1] + p * pr[1]];
    memo.set(k, res);
    return res;
  };
  return f(2, 2);
}

// ---------------------------------------------------------------------------
// HandSolver: all player EVs against one dealer starting hand, from one base
// shoe. Memoised on the player's card multiset.
//
//   baseShoe  the shoe before the player's cards come out (the dealer's known
//             cards are already removed).
//   dealer    { hard, ace, holeDraw }: classic = { hard: up, ace: up === 1,
//             holeDraw: true }; Double Exposure = the dealer's two cards with
//             holeDraw: false.
//   cfg       { h17, peek, tieValue (0 = push, -1 = ties lose) }
//   share     optional { cache: Map, offset }: dealer distributions shared
//             between solvers whose base shoes differ only by player cards
//             (the split contexts of one upcard). offset = the multiset key of
//             the cards this solver's base shoe lacks relative to the shared root.
//
// Values returned are U-values (see the peek trick above); noBj(hand) gives the
// factor that turns them into EVs.

export class HandSolver {
  constructor(baseShoe, dealer, cfg, share = null) {
    this.base = baseShoe.slice();
    this.dist = share ? share.cache : new Map(); // removed-multiset key -> dealer outcome probabilities
    this.offset = share ? share.offset : 0;
    this.N = shoeSize(baseShoe);
    this.paths = dealerPaths(dealer.hard, dealer.ace, !!dealer.holeDraw, !!cfg.h17);
    const bjRank = dealer.holeDraw ? (dealer.hard === 1 ? 10 : dealer.hard === 10 ? 1 : 0) : 0;
    this.peekMode = !!(dealer.holeDraw && cfg.peek && bjRank);
    this.bjRank = bjRank;
    this.enhc = !!(dealer.holeDraw && !cfg.peek);
    this.tie = cfg.tieValue ?? 0;
    this.pc = new Array(11).fill(0); // player's cards, by rank
    this.n = 0;                      // number of player cards
    this.memo = new Map();           // key -> { s: stand U, b: best U (stand or hit on) }
    this.pmemo = new Map();          // key -> U under the current fixed policy
    this.policy = null;
    this.shoeBuf = new Array(11).fill(0);
    this.dBuf = new Float64Array(7);
  }

  // --- internals: operate on the hand currently held in this.pc ------------

  // P(dealer has no blackjack) from the shoe left after the current hand
  // (plus one more card `extra`, if given). 1 when there is nothing to condition.
  _noBj(extra = 0) {
    if (!this.peekMode) return 1;
    const r = this.bjRank;
    const left = this.base[r] - this.pc[r] - (extra === r ? 1 : 0);
    return 1 - left / (this.N - this.n - (extra ? 1 : 0));
  }

  _bust(r) { return this.peekMode ? -this._noBj(r) : -1; }

  // Dealer outcome probabilities against the current hand, shared via this.dist.
  _dealer(key) {
    const ck = this.offset + key;
    let d = this.dist.get(ck);
    if (!d) {
      const s = this.shoeBuf;
      for (let r = 1; r <= 10; r++) s[r] = this.base[r] - this.pc[r];
      d = evalPaths(this.paths, s, new Float64Array(7));
      this.dist.set(ck, d);
    }
    return d;
  }

  _standRaw(key, hard, ace) {
    const d = this._dealer(key);
    const t = handTotal(hard, ace);
    let v = d[O_BUST];
    for (let o = 0; o < 5; o++) {
      const dt = 17 + o;
      v += d[o] * (t > dt ? 1 : t < dt ? -1 : this.tie);
    }
    if (this.enhc) v -= d[O_BJ]; // peek mode: blackjack finishes are excluded (U-value)
    return v;
  }

  _rec(key) {
    let rec = this.memo.get(key);
    if (!rec) { rec = { s: NaN, b: NaN }; this.memo.set(key, rec); }
    return rec;
  }

  _stand(key, hard, ace) {
    const rec = this._rec(key);
    if (Number.isNaN(rec.s)) rec.s = this._standRaw(key, hard, ace);
    return rec.s;
  }

  // Hit once, then continue optimally (hit/stand only).
  _hit(key, hard, ace) {
    const N = this.N - this.n;
    let v = 0;
    for (let r = 1; r <= 10; r++) {
      const avail = this.base[r] - this.pc[r];
      if (avail <= 0) continue;
      const p = avail / N;
      const h2 = hard + r;
      if (h2 > 21) { v += p * this._bust(r); continue; }
      this.pc[r]++; this.n++;
      v += p * this._best(key + W[r], h2, ace || r === 1);
      this.pc[r]--; this.n--;
    }
    return v;
  }

  _best(key, hard, ace) {
    const rec = this._rec(key);
    if (Number.isNaN(rec.b)) {
      const t = handTotal(hard, ace);
      // Below 17 with no way to bust on the next card, hitting is never worse
      // than standing (hit-then-stand already does at least as well, because
      // averaged over the drawn card the dealer's chances are unchanged), so
      // the dealer distribution for this hand is not needed.
      if (hard <= 11 && t < 17) rec.b = this._hit(key, hard, ace);
      else {
        const st = this._stand(key, hard, ace);
        rec.b = t >= 21 ? st : Math.max(st, this._hit(key, hard, ace));
      }
    }
    return rec.b;
  }

  _double(key, hard, ace) {
    const N = this.N - this.n;
    let v = 0;
    for (let r = 1; r <= 10; r++) {
      const avail = this.base[r] - this.pc[r];
      if (avail <= 0) continue;
      const p = avail / N;
      const h2 = hard + r;
      if (h2 > 21) { v += p * this._bust(r); continue; }
      this.pc[r]++; this.n++;
      v += p * this._stand(key + W[r], h2, ace || r === 1);
      this.pc[r]--; this.n--;
    }
    return 2 * v;
  }

  // Value of the current hand when every decision from here on is taken by
  // this.policy(hard, ace) -> 'S' | 'H' (a total-dependent chart).
  _policy(key, hard, ace) {
    const hit = this.pmemo.get(key);
    if (hit !== undefined) return hit;
    let v;
    if (handTotal(hard, ace) >= 21 || this.policy(hard, ace) === 'S') v = this._stand(key, hard, ace);
    else v = this._policyHit(key, hard, ace);
    this.pmemo.set(key, v);
    return v;
  }

  _policyHit(key, hard, ace) {
    const N = this.N - this.n;
    let v = 0;
    for (let r = 1; r <= 10; r++) {
      const avail = this.base[r] - this.pc[r];
      if (avail <= 0) continue;
      const p = avail / N;
      const h2 = hard + r;
      if (h2 > 21) { v += p * this._bust(r); continue; }
      this.pc[r]++; this.n++;
      v += p * this._policy(key + W[r], h2, ace || r === 1);
      this.pc[r]--; this.n--;
    }
    return v;
  }

  // Run fn(key, hard, ace) with `ranks` as the current hand.
  _with(ranks, fn) {
    let key = 0, hard = 0, ace = false;
    for (const r of ranks) { this.pc[r]++; this.n++; key += W[r]; hard += r; if (r === 1) ace = true; }
    try {
      for (let r = 1; r <= 10; r++) if (this.base[r] - this.pc[r] < -1e-9) return NaN; // impossible hand
      return fn(key, hard, ace);
    } finally {
      for (const r of ranks) { this.pc[r]--; this.n--; }
    }
  }

  // --- public: U-values for a given hand (array of ranks) ------------------

  noBj(ranks) { return this._with(ranks, () => this._noBj()); }
  stand(ranks) { return this._with(ranks, (k, h, a) => this._stand(k, h, a)); }
  hit(ranks) { return this._with(ranks, (k, h, a) => this._hit(k, h, a)); }
  best(ranks) { return this._with(ranks, (k, h, a) => this._best(k, h, a)); }
  double(ranks) { return this._with(ranks, (k, h, a) => this._double(k, h, a)); }
  surrender(ranks) {
    // Peek: lose half unless the dealer turns out to have blackjack (then you
    // never got to act). ENHC and DE: half the bet, full stop.
    return this._with(ranks, () => -0.5 * this._noBj());
  }

  // Fixed-policy values (total-dependent strategy). Setting a new policy
  // clears the policy memo.
  setPolicy(policy) { if (policy !== this.policy) { this.policy = policy; this.pmemo.clear(); } }
  hitPolicy(ranks) { return this._with(ranks, (k, h, a) => this._policyHit(k, h, a)); }

  // Probabilities of the next card given `ranks` are out: [p1..p10] (index 0 unused).
  nextCardProbs(ranks) {
    return this._with(ranks, () => {
      const N = this.N - this.n;
      const p = [0];
      for (let r = 1; r <= 10; r++) p[r] = Math.max(0, this.base[r] - this.pc[r]) / N;
      return p;
    });
  }
}

// ---------------------------------------------------------------------------
// Split value in a split context: `ctx` is a HandSolver whose base shoe already
// lacks the OTHER pair card (base = shoe before the pair - x). `v2(r)` must
// return the U-value of the post-split hand {x, r} when it may NOT be split
// again. Returns the U-value of splitting (all hands together).
//
// Resplitting is a choice: when a pair card arrives, splitting again is not
// always better than playing the pair (9,9 vs A in a single deck is the classic
// case). The value is the best over "resplit up to m hands" for m = 2..maxHands.
export function splitValue(ctx, x, maxHands, v2) {
  const p = ctx.nextCardProbs([x]);
  let a = 0;
  for (let r = 1; r <= 10; r++) if (r !== x && p[r] > 0) a += p[r] * v2(r);
  const px = p[x];
  const vpp = px > 0 ? v2(x) : 0;
  let best = -Infinity;
  for (let m = 2; m <= Math.max(2, maxHands); m++) {
    const [nnp, npp] = splitHandCounts(px, m);
    const v = (1 - px > 1e-12 ? (nnp / (1 - px)) * a : 0) + npp * vpp;
    if (v > best) best = v;
  }
  return best;
}

// ---------------------------------------------------------------------------
// The classic game, one solver per dealer upcard.

export function classicCfg(rules) {
  // OBO is the peek game in EV terms (see header).
  return { h17: !!rules.hitSoft17, peek: !!(rules.peek || rules.enhcObo), tieValue: 0 };
}

export function makeGame(rules, shoe = fullShoe(rules.decks)) {
  const cfg = classicCfg(rules);
  const N = shoeSize(shoe);
  const perUp = [];
  for (let up = 1; up <= 10; up++) {
    if (shoe[up] <= 0) continue;
    const S0 = removeCards(shoe, [up]);
    const dealer = { hard: up, ace: up === 1, holeDraw: true };
    const cache = new Map();
    const solver = new HandSolver(S0, dealer, cfg, { cache, offset: 0 });
    const splitCtx = new Map();
    perUp.push({
      up, pUp: shoe[up] / N, S0, solver,
      // Split context for pair rank x: base shoe lacks the second pair card.
      ctx(x) {
        let c = splitCtx.get(x);
        if (!c) { c = new HandSolver(removeCards(S0, [x]), dealer, cfg, { cache, offset: W[x] }); splitCtx.set(x, c); }
        return c;
      },
    });
  }
  return { rules, shoe, cfg, perUp };
}

// Probability the dealer has blackjack given the cards already out (S0 lacks
// the upcard; `ranks` = the player's cards). Used for peek bookkeeping.
export function dealerBjProb(S0, up, ranks) {
  const bjRank = up === 1 ? 10 : up === 10 ? 1 : 0;
  if (!bjRank) return 0;
  let left = S0[bjRank], n = shoeSize(S0);
  for (const r of ranks) { if (r === bjRank) left--; n--; }
  return left / n;
}

// Composition-dependent U-values of a split, optimal play of each split hand.
//   das: whether doubling after the split is allowed (passed separately so the
//        chart can price 'split if DAS, else hit').
export function splitU(u, x, rules, das) {
  const ctx = u.ctx(x);
  const aces = x === 1;
  const oneCard = aces && !rules.hitSplitAces;
  const maxHands = aces && !rules.resplitAces ? Math.min(2, rules.maxSplitHands) : rules.maxSplitHands;
  const v2 = (r) => ctx._with([x, r], (k, h, a) => {
    if (oneCard) return ctx._stand(k, h, a);
    let v = ctx._best(k, h, a);
    if (das && doubleAllowedFor(rules, h, a)) v = Math.max(v, ctx._double(k, h, a));
    return v;
  });
  return splitValue(ctx, x, maxHands, v2);
}

// U-values of every allowed first action for a two-card hand vs one upcard.
// Returns { stand, hit, double?, surrender?, split?, splitNoDas?, noBj }.
export function firstActionsU(u, ranks, rules) {
  const s = u.solver;
  const out = { stand: s.stand(ranks), hit: s.hit(ranks), noBj: s.noBj(ranks) };
  let hard = 0, ace = false;
  for (const r of ranks) { hard += r; if (r === 1) ace = true; }
  if (ranks.length === 2 && doubleAllowedFor(rules, hard, ace)) out.double = s.double(ranks);
  if (ranks.length === 2 && rules.surrender === 'late') out.surrender = s.surrender(ranks);
  if (ranks.length === 2 && ranks[0] === ranks[1] && rules.maxSplitHands >= 2) {
    out.split = splitU(u, ranks[0], rules, rules.das);
    if (rules.das) out.splitNoDas = splitU(u, ranks[0], rules, false);
  }
  return out;
}

// ---------------------------------------------------------------------------
// House edge: full enumeration of the initial deal (dealer upcard x the
// player's two cards), no insurance.
//
//   firstU(u, ranks) -> U-value of the play chosen for that non-blackjack hand.
//
// Returns { edge: house edge in % at rules.bjPays (+ = house),
//           pBlackjackNoDealerBj: P(player natural and dealer has none) }.
// A player natural is paid bjPays unless the dealer also has one (push). With
// peek, a dealer natural against a non-natural costs exactly one unit; without
// peek the U-values already contain the dealer natural (it takes doubles and
// splits too).
export function enumerateEdge(game, firstU, bjPays = game.rules.bjPays) {
  const { rules } = game;
  let ev = 0, pBj = 0;
  for (const u of game.perUp) {
    let evUp = 0;
    for (let a = 1; a <= 10; a++) {
      for (let b = a; b <= 10; b++) {
        const w = pairProb(u.S0, a, b);
        if (w <= 0) continue;
        const ranks = [a, b];
        const pd = dealerBjProb(u.S0, u.up, ranks);
        if (a === 1 && b === 10) {
          evUp += w * (1 - pd) * bjPays;
          pBj += u.pUp * w * (1 - pd);
          continue;
        }
        const U = firstU(u, ranks);
        evUp += w * (game.cfg.peek ? U - pd : U);
      }
    }
    ev += u.pUp * evUp;
  }
  return { edge: -100 * ev, pBlackjackNoDealerBj: pBj };
}

// Composition-dependent optimal house edge ("perfect play", shuffled every round).
export function houseEdgeCD(rules, game = makeGame(rules)) {
  return enumerateEdge(game, (u, ranks) => bestFirstU(u, ranks, rules));
}

// ---------------------------------------------------------------------------
// Chart codes (shared by strategy.js and de.js)
//
//   S stand | H hit | D double, else hit | Ds double, else stand
//   P split | Ph split if DAS, else hit
//   Rh surrender, else hit | Rs surrender, else stand | Rp surrender, else split

// Pick a cell's code from its EVs { stand, hit, double?, split?, splitNoDas?,
// surrender? } (all on the same scale). `das` = the chart's own DAS rule.
// Ties go to the earlier action in S, H, D, P, R order.
//
// 'Ph' is only used when the split is best WITH double-after-split and hitting
// would be best WITHOUT it. When losing DAS would make the best play a double
// or a stand instead (e.g. 4,4 vs 5 in a single deck), the code stays 'P' —
// the code set has no "split, else double" — and the chart for the no-DAS
// rule set shows the right play.
export function chooseCode(e, das) {
  const acts = [['S', e.stand], ['H', e.hit]];
  if (e.double !== undefined) acts.push(['D', e.double]);
  if (e.split !== undefined) acts.push(['P', e.split]);
  if (e.surrender !== undefined) acts.push(['R', e.surrender]);
  let best = acts[0];
  for (const a of acts) if (a[1] > best[1]) best = a;
  switch (best[0]) {
    case 'S': return 'S';
    case 'H': return 'H';
    case 'D': return e.hit >= e.stand ? 'D' : 'Ds';
    case 'R': {
      let second = acts[0];
      for (const a of acts) if (a[0] !== 'R' && a[1] > second[1]) second = a;
      if (second[0] === 'P') return 'Rp';
      return e.hit >= e.stand ? 'Rh' : 'Rs';
    }
    case 'P': {
      if (!das || e.splitNoDas === undefined) return 'P';
      let alt = ['P', e.splitNoDas];
      for (const a of acts) if (a[0] !== 'P' && a[1] > alt[1]) alt = a;
      return alt[0] === 'H' ? 'Ph' : 'P';
    }
  }
  throw new Error('unreachable');
}

// Resolve a code against what the table allows right now. Returns
// 'S' | 'H' | 'D' | 'P' | 'R', or null for a split code when splitting is not
// possible (the caller then looks the hand up by its total).
export function resolveCode(code, { canDouble = false, canSplit = false, canSurrender = false, das = true } = {}) {
  switch (code) {
    case 'S': return 'S';
    case 'H': return 'H';
    case 'D': return canDouble ? 'D' : 'H';
    case 'Ds': return canDouble ? 'D' : 'S';
    case 'P': return canSplit ? 'P' : null;
    case 'Ph': return canSplit ? (das ? 'P' : 'H') : null;
    case 'Rh': return canSurrender ? 'R' : 'H';
    case 'Rs': return canSurrender ? 'R' : 'S';
    case 'Rp': return canSurrender ? 'R' : canSplit ? 'P' : null;
    default: throw new Error(`Unknown chart code: ${code}`);
  }
}

export const ACTION_NAME = Object.freeze({ S: 'stand', H: 'hit', D: 'double', P: 'split', R: 'surrender' });

// Probability of drawing exactly the multiset `ranks` as the next cards.
export function multisetProb(shoe, ranks) {
  const cnt = new Array(11).fill(0);
  for (const r of ranks) cnt[r]++;
  let n = 0, p = 1, orderings = 1;
  const N = shoeSize(shoe);
  for (let r = 1; r <= 10; r++) {
    for (let i = 0; i < cnt[r]; i++) { p *= Math.max(0, shoe[r] - i); n++; orderings *= n; orderings /= (i + 1); }
  }
  for (let i = 0; i < n; i++) p /= (N - i);
  return p * orderings;
}

// The two-card (or, where none exist, three-card) hands behind each chart row.
//   hard 5-19: two different non-ace cards; hard 4 and 20 only exist as the
//   pairs 2,2 and T,T (used unsplit); hard 21 needs three cards.
//   soft 13-20: A + x; soft 12 = A,A unsplit; soft 21 = A,T counted as a
//   plain 21 (a two-card 21 after a split, not a natural).
//   pairs: x,x.
export const CHART_ROWS = Object.freeze({
  hard: Object.freeze(Array.from({ length: 18 }, (_, i) => String(i + 4))),
  soft: Object.freeze(Array.from({ length: 10 }, (_, i) => String(i + 12))),
  pairs: Object.freeze(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']),
});

export function rowHands(table, row) {
  if (table === 'pairs') { const x = row === 'A' ? 1 : Number(row); return [[x, x]]; }
  const t = Number(row);
  if (table === 'soft') return t === 12 ? [[1, 1]] : [[1, t - 11]];
  if (t === 4) return [[2, 2]];
  if (t === 20) return [[10, 10]];
  if (t === 21) {
    const out = [];
    for (let a = 1; a <= 10; a++) for (let b = a; b <= 10; b++) for (let c = b; c <= 10; c++) {
      const hard = a + b + c;
      if (hard === 21) out.push([a, b, c]); // any ace here counts as 1: hard 21
    }
    return out;
  }
  const out = [];
  for (let a = 2; a <= 10; a++) for (let b = a + 1; b <= 10; b++) if (a + b === t) out.push([a, b]);
  return out;
}

// Which first actions a chart row prices, before rule restrictions.
//   twoCard: rows that are decided on the first two cards (all but hard/soft 21).
export function rowIsTwoCard(table, row) { return !(table !== 'pairs' && row === '21'); }

// ---------------------------------------------------------------------------
// Chart rows priced from the hands behind them, and charts played back.
// `u` is one dealer situation: { S0, solver, ctx(x) } (an upcard in the classic
// game, a dealer two-card hand in Double Exposure). `col` is the chart column
// key for it ('2'..'A', or 'h12' / 's17' ... in Double Exposure).

export const EV_KEYS = Object.freeze(['stand', 'hit', 'double', 'split', 'splitNoDas', 'surrender']);

// U-values of the actions a chart row prices, for one hand of that row.
export function rowActionsU(u, ranks, rules, table, row) {
  const s = u.solver;
  if (table === 'pairs') return firstActionsU(u, ranks, rules);
  const out = { stand: s.stand(ranks), hit: s.hit(ranks), noBj: s.noBj(ranks) };
  if (!rowIsTwoCard(table, row)) return out;
  // hard 4 / hard 20 / soft 12 are the pairs 2,2 / T,T / A,A played unsplit.
  let hard = 0, ace = false;
  for (const r of ranks) { hard += r; if (r === 1) ace = true; }
  if (doubleAllowedFor(rules, hard, ace)) out.double = s.double(ranks);
  if (rules.surrender === 'late') out.surrender = s.surrender(ranks);
  return out;
}

// Add one dealer situation's contribution to a row accumulator (weight wD for
// the dealer side; the player's hands are weighted by their probability from u.S0).
export function accumulateRow(acc, u, rules, table, row, wD = 1) {
  for (const ranks of rowHands(table, row)) {
    const w = wD * multisetProb(u.S0, ranks);
    if (!(w > 0)) continue;
    const e = rowActionsU(u, ranks, rules, table, row);
    acc.den += w * e.noBj;
    for (const k of EV_KEYS) if (e[k] !== undefined) acc[k] = (acc[k] || 0) + w * e[k];
  }
  return acc;
}

// EVs of an accumulated row (per unit bet, given no dealer blackjack with a peek).
export function rowEV(acc) {
  if (!(acc.den > 0)) throw new Error('Chart row has no possible hands for this shoe');
  const ev = {};
  for (const k of EV_KEYS) if (acc[k] !== undefined) ev[k] = acc[k] / acc.den;
  return ev;
}

// Multi-card decisions by a chart column: hit or stand on this total.
export function totalPolicy(chart, col) {
  return (hard, ace) => {
    const t = handTotal(hard, ace);
    const code = (handIsSoft(hard, ace) ? chart.soft : chart.hard)[String(t)]?.[col];
    return code && resolveCode(code) === 'S' ? 'S' : 'H';
  };
}

// The chart's play for a two-card hand, as an action letter ('S','H','D','P','R').
export function chartAction(chart, ranks, col, allowed) {
  let hard = 0, ace = false;
  for (const r of ranks) { hard += r; if (r === 1) ace = true; }
  const pair = ranks.length === 2 && ranks[0] === ranks[1];
  let act = null;
  if (pair && allowed.canSplit) act = resolveCode(chart.pairs[ranks[0] === 1 ? 'A' : String(ranks[0])][col], allowed);
  if (act === null) {
    const code = (handIsSoft(hard, ace) ? chart.soft : chart.hard)[String(handTotal(hard, ace))][col];
    act = resolveCode(code, { ...allowed, canSplit: false });
  }
  return act;
}

// U-value of a split played by the chart: each post-split two-card hand takes
// the chart's play (no surrender; double only with DAS), then hits/stands by total.
export function chartSplitU(u, x, rules, chart, col, policy) {
  const ctx = u.ctx(x);
  ctx.setPolicy(policy);
  const aces = x === 1;
  const oneCard = aces && !rules.hitSplitAces;
  const maxHands = aces && !rules.resplitAces ? Math.min(2, rules.maxSplitHands) : rules.maxSplitHands;
  const v2 = (r) => {
    const hand = [x, r];
    if (oneCard) return ctx.stand(hand);
    const act = chartAction(chart, hand, col, {
      canDouble: rules.das && doubleAllowedFor(rules, x + r, x === 1 || r === 1),
      canSplit: false, canSurrender: false, das: rules.das,
    });
    if (act === 'S') return ctx.stand(hand);
    if (act === 'D') return ctx.double(hand);
    return ctx.hitPolicy(hand);
  };
  return splitValue(ctx, x, maxHands, v2);
}

// U-value of a two-card hand played entirely by the chart (total-dependent).
export function chartFirstU(u, ranks, rules, chart, col, policy) {
  let hard = 0, ace = false;
  for (const r of ranks) { hard += r; if (r === 1) ace = true; }
  const allowed = {
    canDouble: doubleAllowedFor(rules, hard, ace),
    canSplit: ranks[0] === ranks[1] && rules.maxSplitHands >= 2,
    canSurrender: rules.surrender === 'late',
    das: rules.das,
  };
  const act = chartAction(chart, ranks, col, allowed);
  const s = u.solver;
  switch (act) {
    case 'S': return s.stand(ranks);
    case 'H': s.setPolicy(policy); return s.hitPolicy(ranks);
    case 'D': return s.double(ranks);
    case 'R': return s.surrender(ranks);
    case 'P': return chartSplitU(u, ranks[0], rules, chart, col, policy);
  }
  throw new Error(`bad action ${act}`);
}

// U-value of the best composition-dependent first action.
export function bestFirstU(u, ranks, rules) {
  const e = firstActionsU(u, ranks, rules);
  let best = Math.max(e.stand, e.hit);
  for (const k of ['double', 'surrender', 'split']) if (e[k] !== undefined) best = Math.max(best, e[k]);
  return best;
}

// U-values of a row's actions for one hand when the CHART is followed after
// the first decision: hits continue by total, split hands are played by the
// chart. (stand / double / surrender have no later decisions.)
export function chartRowU(u, ranks, rules, table, row, chart, col, policy) {
  const e = rowActionsU(u, ranks, rules, table, row);
  u.solver.setPolicy(policy);
  e.hit = u.solver.hitPolicy(ranks);
  if (e.split !== undefined) {
    e.split = chartSplitU(u, ranks[0], rules, chart, col, policy);
    if (e.splitNoDas !== undefined) e.splitNoDas = chartSplitU(u, ranks[0], { ...rules, das: false }, chart, col, policy);
  }
  return e;
}

// Total-dependent fixed point. A chart first built from perfect-play
// continuations is re-priced assuming the chart itself is followed afterwards,
// its codes re-picked, and so on until no cell changes (usually 1-2 rounds).
// This is what "basic strategy" means: the best chart for a player who plays
// every later decision from the same chart.
//   groups: [{ col, items: [{ u, wD }] }] — the dealer situations behind each column.
// Returns the number of rounds used.
export function refineChartTD(chart, groups, rules, maxIter = 4) {
  for (let it = 0; it < maxIter; it++) {
    const updates = [];
    for (const { col, items } of groups) {
      const policy = totalPolicy(chart, col);
      for (const table of ['hard', 'soft', 'pairs']) {
        for (const row of CHART_ROWS[table]) {
          const acc = { den: 0 };
          for (const { u, wD } of items) {
            for (const ranks of rowHands(table, row)) {
              const w = wD * multisetProb(u.S0, ranks);
              if (!(w > 0)) continue;
              const e = chartRowU(u, ranks, rules, table, row, chart, col, policy);
              acc.den += w * e.noBj;
              for (const k of EV_KEYS) if (e[k] !== undefined) acc[k] = (acc[k] || 0) + w * e[k];
            }
          }
          updates.push([table, row, col, rowEV(acc)]);
        }
      }
    }
    let changed = 0;
    for (const [table, row, col, ev] of updates) {
      chart.ev[table][row][col] = ev;
      const code = chooseCode(ev, rules.das);
      if (code !== chart[table][row][col]) { chart[table][row][col] = code; changed++; }
    }
    if (!changed) return it + 1;
  }
  return maxIter;
}
