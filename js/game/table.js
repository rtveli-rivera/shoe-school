// table.js — a blackjack table: shoe, seats, one round at a time.
//
// UI-agnostic: the round runs as an async function and asks `io` for every
// choice (bets, decisions, insurance) and for pacing (pause). The same model
// drives the "play full hands" drill and the casino simulator.
//
// Counting fidelity: every card carries `seen` — whether *you*, sitting at your
// seat, have seen it yet. The burn card is never seen; the dealer's hole card is
// seen when it is turned over; in a pitch game other players' cards are seen only
// when they bust, double (turned at the end), or the round is settled. The table's
// running count is the count of seen cards only, which is exactly what a
// perfect counter at this seat would have.

import { makeShoe } from './cards.js';
import { hiloTag, estimateDecksRemaining, trueCount } from '../engine/hilo.js';
import { handValue } from '../engine/rules.js';

export function cardsValue(cards) { return handValue(cards.map((c) => c.v)); }
export function isNatural(cards) { return cards.length === 2 && cardsValue(cards).total === 21; }

export class Table {
  constructor({ rules, rand, bots = 0, myIndex = null }) {
    this.rules = rules;
    this.rand = rand;
    this.myIndex = myIndex === null ? Math.floor(bots / 2) : myIndex;
    this.seats = [];
    const names = ['Ana', 'Ben', 'Carla', 'Dev', 'Eli', 'Fay'];
    for (let i = 0; i < bots + 1; i++) {
      const me = i === this.myIndex;
      this.seats.push({ index: i, me, name: me ? 'You' : names[i % names.length], hands: [], insurance: 0 });
    }
    this.dealer = { cards: [], holeHidden: false };
    this.rc = 0;
    this.shuffles = 0;
    this.newShoe();
  }

  newShoe() {
    this.shoe = makeShoe(this.rules.decks, this.rand);
    this.pos = 0;
    this.discards = 0;
    this.rc = 0;
    this.shuffles++;
    const total = this.shoe.length;
    // cut card: penetration ± a few cards, the way real dealers place it
    const jitter = Math.round((this.rand() - 0.5) * 10);
    this.cutAt = Math.min(total - 10, Math.max(20, Math.round(total * this.rules.penetration) + jitter));
    this.burn = this.draw(false); // burned face down: never counted
    this.discards += 1;
  }

  get cardsLeft() { return this.shoe.length - this.pos; }
  get decksLeftExact() { return this.cardsLeft / 52; }
  get decksLeftEstimate() { return estimateDecksRemaining(this.cardsLeft); }
  get decksDiscarded() { return this.discards / 52; }
  get needsShuffle() { return this.pos >= this.cutAt; }
  // The true count a perfect counter would use: seen count over the decks still to be dealt
  // (estimated to the half deck, as at a real table).
  get tc() { return trueCount(this.rc, this.decksLeftEstimate); }
  get tcExact() { return this.rc / Math.max(0.5, this.decksLeftExact); }

  draw(visible = true) {
    if (this.pos >= this.shoe.length) throw new Error('shoe exhausted');
    const c = { ...this.shoe[this.pos++], seen: false };
    if (visible) this.see(c);
    return c;
  }

  see(card) {
    if (card && !card.seen) { card.seen = true; this.rc += hiloTag(card.v); }
  }

  // ---- one round -------------------------------------------------------

  // io = {
  //   bet(seat) -> Promise<number>           units (0 = sit out this round)
  //   insurance(seat) -> Promise<boolean>
  //   decide(seat, hand, options) -> Promise<'hit'|'stand'|'double'|'split'|'surrender'>
  //   pause(kind) -> Promise                 'deal' | 'action' | 'dealer' | 'settle'
  //   update()                               re-render
  // }
  async playRound(io) {
    const r = this.rules;
    const de = r.variant === 'de';
    const pitch = r.dealing === 'pitch';
    this.dealer = { cards: [], holeHidden: false, blackjack: false };
    for (const s of this.seats) { s.hands = []; s.insurance = 0; s.result = null; }

    // bets
    for (const s of this.seats) {
      const units = await io.bet(s);
      if (units > 0) s.hands = [newHand(units)];
    }
    const playing = this.seats.filter((s) => s.hands.length);
    if (!playing.length) return { skipped: true };

    // deal: one card each, dealer up, second card each, dealer hole (not in ENHC)
    const visibleToMe = (s) => s.me || !pitch;
    for (const s of playing) { s.hands[0].cards.push(this.draw(visibleToMe(s))); io.update(); await io.pause('deal'); }
    this.dealer.cards.push(this.draw(true)); io.update(); await io.pause('deal');
    for (const s of playing) { s.hands[0].cards.push(this.draw(visibleToMe(s))); io.update(); await io.pause('deal'); }
    if (r.peek || de) {
      this.dealer.cards.push(this.draw(de));
      this.dealer.holeHidden = !de;
      io.update(); await io.pause('deal');
    }
    const up = this.dealer.cards[0];

    // naturals for players
    for (const s of playing) if (isNatural(s.hands[0].cards)) s.hands[0].natural = true;

    // insurance (classic only, ace up)
    if (!de && up.v === 1) {
      for (const s of playing) if (await io.insurance(s)) s.insurance = s.hands[0].bet / 2;
    }

    // dealer blackjack check: peek game or Double Exposure (both cards known)
    const dealerHasBJ = () => this.dealer.cards.length === 2 && isNatural(this.dealer.cards);
    if ((r.peek && (up.v === 1 || up.v === 10)) || de) {
      if (dealerHasBJ()) {
        this.dealer.blackjack = true;
        this.revealHole();
        io.update();
        return this.settle(io, { dealerBJ: true });
      }
    }

    // players act, first base to third base
    for (const s of playing) {
      for (let h = 0; h < s.hands.length; h++) {
        const hand = s.hands[h];
        if (hand.natural && s.hands.length === 1) { hand.done = true; this.seeSeatHand(s, hand, 'natural'); continue; }
        this.activeSeat = s; this.activeHand = h;
        await this.playHand(io, s, hand, h);
        io.update();
      }
    }
    this.activeSeat = null;

    // dealer: in ENHC the second card comes now
    if (!r.peek && !de) { this.dealer.cards.push(this.draw(true)); io.update(); await io.pause('dealer'); }
    this.revealHole();
    io.update();
    if (!r.peek && !de && dealerHasBJ()) {
      this.dealer.blackjack = true;
      return this.settle(io, { dealerBJ: true });
    }
    const live = playing.some((s) => s.hands.some((h) => !h.busted && !h.surrendered && !(h.natural && s.hands.length === 1)));
    if (live) {
      await io.pause('dealer');
      while (dealerShouldHit(this.dealer.cards, r)) {
        this.dealer.cards.push(this.draw(true));
        io.update();
        await io.pause('dealer');
      }
    }
    return this.settle(io, { dealerBJ: false });
  }

  revealHole() {
    if (this.dealer.holeHidden) { this.dealer.holeHidden = false; }
    for (const c of this.dealer.cards) this.see(c);
  }

  seeSeatHand(s, hand) {
    // in a pitch game, a natural / bust / surrender is turned face up right away
    for (const c of hand.cards) this.see(c);
  }

  async playHand(io, s, hand, handIndex) {
    const r = this.rules;
    const pitch = r.dealing === 'pitch';
    const visible = s.me || !pitch;
    // a split hand gets its second card first
    if (hand.cards.length === 1) {
      hand.cards.push(this.draw(visible));
      io.update(); await io.pause('deal');
      if (hand.splitAces && !r.hitSplitAces) {
        // one card only on split aces — unless it is another ace and resplitting is allowed
        if (!(hand.cards[1].v === 1 && r.resplitAces && s.hands.length < r.maxSplitHands)) { hand.done = true; return; }
      }
    }
    while (!hand.done) {
      const v = cardsValue(hand.cards);
      if (v.total >= 21) { hand.done = true; if (v.total > 21) { hand.busted = true; this.seeSeatHand(s, hand); } break; }
      const opts = this.options(s, hand);
      const action = await io.decide(s, hand, opts);
      if (action === 'stand') { hand.done = true; }
      else if (action === 'hit') {
        hand.cards.push(this.draw(visible));
      } else if (action === 'double' && opts.canDouble) {
        hand.bet *= 2; hand.doubled = true;
        // pitch games deal the double card face down (even to you); it is seen at settlement
        hand.cards.push(this.draw(!pitch));
        hand.done = true;
        const t = cardsValue(hand.cards).total;
        if (t > 21) { hand.busted = true; }
      } else if (action === 'split' && opts.canSplit) {
        const second = hand.cards.pop();
        const isAces = second.v === 1;
        const nh = newHand(hand.bet);
        nh.cards.push(second);
        nh.fromSplit = true; hand.fromSplit = true;
        if (isAces) { nh.splitAces = true; hand.splitAces = true; }
        s.hands.splice(handIndex + 1, 0, nh);
        io.update(); await io.pause('action');
        hand.cards.push(this.draw(visible));
        io.update(); await io.pause('deal');
        if (hand.splitAces && !r.hitSplitAces) {
          if (!(hand.cards[1].v === 1 && r.resplitAces && s.hands.length < r.maxSplitHands)) { hand.done = true; }
        }
        continue;
      } else if (action === 'surrender' && opts.canSurrender) {
        hand.surrendered = true; hand.done = true; this.seeSeatHand(s, hand);
      } else {
        hand.done = true; // unknown action: stand
      }
      io.update();
      await io.pause('action');
    }
  }

  // What this hand may do right now.
  options(s, hand) {
    const r = this.rules;
    const two = hand.cards.length === 2;
    const v = cardsValue(hand.cards);
    let canDouble = two && (!hand.fromSplit || r.das) && !(hand.splitAces && !r.hitSplitAces);
    if (canDouble && r.doubleOn !== 'any') {
      const [lo, hi] = r.doubleOn.split('-').map(Number);
      canDouble = !v.soft && v.total >= lo && v.total <= hi;
    }
    const pair = two && hand.cards[0].v === hand.cards[1].v;
    let canSplit = pair && s.hands.length < r.maxSplitHands;
    if (canSplit && hand.cards[0].v === 1 && hand.fromSplit && !r.resplitAces) canSplit = false;
    const canSurrender = two && !hand.fromSplit && s.hands.length === 1 && r.surrender === 'late' && r.variant !== 'de';
    return { canDouble, canSplit, canSurrender, splitCount: s.hands.length - 1 };
  }

  settle(io, { dealerBJ }) {
    const r = this.rules;
    const de = r.variant === 'de';
    const d = cardsValue(this.dealer.cards);
    const out = [];
    for (const s of this.seats) {
      if (!s.hands.length) continue;
      let net = 0;
      if (s.insurance) net += dealerBJ ? s.insurance * 2 : -s.insurance;
      for (const hand of s.hands) {
        for (const c of hand.cards) this.see(c);             // everything is turned over at the end
        const p = cardsValue(hand.cards);
        const natural = hand.natural && s.hands.length === 1;
        let res, amt;
        if (hand.surrendered) { res = 'surrender'; amt = -hand.bet / 2; }
        else if (dealerBJ) {
          if (natural) {
            if (de && r.dePlayerBjWinsTie) { res = 'blackjack'; amt = hand.bet * r.bjPays; }
            else { res = 'push'; amt = 0; }
          } else if (!r.peek && !de && r.enhcObo) {
            // ENHC "original bet only": you lose the one bet you started with;
            // the extra money from doubles and splits comes back.
            res = 'lose';
            amt = hand === s.hands[0] ? -(hand.doubled ? hand.bet / 2 : hand.bet) : 0;
          } else {
            // peek games only get here before anyone acts; ENHC (lose all) takes doubles and splits too
            res = 'lose'; amt = -hand.bet;
          }
        } else if (natural) { res = 'blackjack'; amt = hand.bet * r.bjPays; }
        else if (hand.busted || p.total > 21) { res = 'lose'; amt = -hand.bet; }
        else if (d.total > 21) { res = 'win'; amt = hand.bet; }
        else if (p.total > d.total) { res = 'win'; amt = hand.bet; }
        else if (p.total < d.total) { res = 'lose'; amt = -hand.bet; }
        else if (de && r.deTiesLose) { res = 'lose'; amt = -hand.bet; }
        else { res = 'push'; amt = 0; }
        hand.result = res; hand.net = amt;
        net += amt;
      }
      s.result = net;
      out.push({ seat: s.index, me: s.me, net });
    }
    for (const c of this.dealer.cards) this.see(c);
    // the round's cards go to the discard tray
    this.discards += this.dealer.cards.length + this.seats.reduce((n, s) => n + s.hands.reduce((m, h) => m + h.cards.length, 0), 0);
    io.update();
    return { dealerBJ, dealer: d, results: out };
  }
}

function newHand(bet) {
  return { cards: [], bet, doubled: false, fromSplit: false, splitAces: false, done: false, busted: false, surrendered: false, natural: false, result: null, net: 0 };
}

export function dealerShouldHit(cards, rules) {
  const v = cardsValue(cards);
  if (v.total < 17) return true;
  if (v.total === 17 && v.soft && rules.hitSoft17) return true;
  return false;
}
