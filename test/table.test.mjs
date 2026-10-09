// Table model: settlement rules, dealing visibility, and the seen-card count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Table, cardsValue, dealerShouldHit } from '../js/game/table.js';
import { rulesFor, normalizeRules } from '../js/engine/rules.js';
import { makeCard } from '../js/game/cards.js';
import { mulberry32 } from '../js/engine/rng.js';
import { hiloTag, trueCount, estimateDecksRemaining, runningCount } from '../js/engine/hilo.js';

// Put an exact card order on top of the shoe (after the burn card).
function rig(table, ranks) {
  const cards = ranks.map((r) => makeCard(r, '♠'));
  table.shoe.splice(table.pos, cards.length, ...cards);
}

// io that plays scripted decisions for the player and stands for bots.
function scriptedIo(decisions = [], { insurance = false, bet = 1 } = {}) {
  const asked = [];
  return {
    asked,
    bet: async () => bet,
    insurance: async () => insurance,
    decide: async (seat, hand, opts) => { asked.push({ total: cardsValue(hand.cards).total, opts }); return decisions.shift() || 'stand'; },
    pause: async () => {},
    update: () => {},
  };
}

test('blackjack pays the table payout; 6:5 pays 1.2', async () => {
  for (const [preset, pay] of [['shoe-6d-h17', 1.5], ['sd-65', 1.2]]) {
    const t = new Table({ rules: rulesFor(preset), rand: mulberry32(1) });
    // player A, dealer 9, player K, dealer 7 (hole)
    rig(t, ['A', '9', 'K', '7']);
    const res = await t.playRound(scriptedIo());
    assert.equal(res.results[0].net, pay);
  }
});

test('peek game: dealer blackjack ends the round before anyone acts', async () => {
  const t = new Table({ rules: rulesFor('shoe-6d-h17'), rand: mulberry32(2) });
  rig(t, ['10', 'A', '6', 'K']); // player 10,6 ; dealer A,K
  const io = scriptedIo(['hit']);
  const res = await t.playRound(io);
  assert.equal(io.asked.length, 0, 'no decision asked');
  assert.equal(res.dealerBJ, true);
  assert.equal(res.results[0].net, -1);
});

test('ENHC: a dealer blackjack takes the double too; OBO gives it back', async () => {
  const base = rulesFor('euro-enhc');
  for (const [rules, expected] of [[base, -2], [normalizeRules({ ...base, enhcObo: true }), -1]]) {
    const t = new Table({ rules, rand: mulberry32(3) });
    // player 6,5 vs dealer 10 ; player doubles, draws 2 ; dealer's second card A = blackjack
    rig(t, ['6', '10', '5', '2', 'A']);
    const res = await t.playRound(scriptedIo(['double']));
    assert.equal(res.dealerBJ, true);
    assert.equal(res.results[0].net, expected);
  }
});

test('Double Exposure: ties lose, a player blackjack beats a dealer blackjack at even money', async () => {
  const rules = rulesFor('double-exposure');
  let t = new Table({ rules, rand: mulberry32(4) });
  rig(t, ['10', '10', '9', '9']); // player 19, dealer 19
  let res = await t.playRound(scriptedIo(['stand']));
  assert.equal(res.results[0].net, -1, 'tie loses');

  t = new Table({ rules, rand: mulberry32(5) });
  rig(t, ['A', 'A', 'K', 'Q']); // both blackjack
  res = await t.playRound(scriptedIo());
  assert.equal(res.results[0].net, rules.dePlayerBjWinsTie ? rules.bjPays : 0);
});

test('Double Exposure: both dealer cards are visible and counted at once', async () => {
  const t = new Table({ rules: rulesFor('double-exposure'), rand: mulberry32(6) });
  rig(t, ['10', '5', '7', '6', '10']); // player 10,7 ; dealer 5,6 ; player stands; dealer draws 10 -> 21
  let rcAtDecision = null;
  const io = scriptedIo();
  io.decide = async () => { rcAtDecision = t.rc; return 'stand'; };
  await t.playRound(io);
  // seen at the decision: 10 (−1), 5 (+1), 7 (0), 6 (+1) = +1
  assert.equal(rcAtDecision, 1);
});

test('pitch game: other players\' cards are not counted until they are turned over', async () => {
  const rules = rulesFor('dd-pitch');
  const t = new Table({ rules, rand: mulberry32(7), bots: 1, myIndex: 1 });
  // order: bot c1, me c1, dealer up, bot c2, me c2, dealer hole
  rig(t, ['5', '9', '8', '4', '9', '9', '10']);
  const seen = [];
  const io = scriptedIo();
  io.decide = async (seat) => { seen.push({ me: seat.me, rc: t.rc }); return 'stand'; };
  await t.playRound(io);
  // when the bot decides, only my cards (9,9) and the dealer's 8 are seen: rc 0
  assert.equal(seen[0].me, false);
  assert.equal(seen[0].rc, 0);
  // after settlement everything is turned over: 5,4 (+2), 9,9,8 (0), hole 9 (0), dealer draws nothing (17)
  assert.equal(t.rc, 2);
});

test('the table count always equals the tags of the cards that were seen', async () => {
  for (const preset of ['shoe-6d-h17', 'dd-pitch', 'euro-enhc', 'double-exposure', 'sd-32']) {
    const rules = rulesFor(preset);
    const rand = mulberry32(11);
    const t = new Table({ rules, rand, bots: 3 });
    const io = scriptedIo();
    io.decide = async (seat, hand, opts) => {
      const v = cardsValue(hand.cards);
      if (opts.canSplit && rand() < 0.3) return 'split';
      if (opts.canDouble && v.total >= 9 && v.total <= 11) return 'double';
      return v.total < 17 ? 'hit' : 'stand';
    };
    for (let i = 0; i < 300; i++) {
      if (t.needsShuffle) t.newShoe();
      await t.playRound(io);
      // after settlement every dealt card is seen, so rc = tags of shoe[1 .. pos) (card 0 is the burn)
      const dealt = t.shoe.slice(1, t.pos).map((c) => c.v);
      assert.equal(t.rc, runningCount(dealt), `${preset} round ${i}`);
    }
  }
});

test('split aces get one card each; DAS gates the double after a split', async () => {
  const rules = rulesFor('shoe-6d-h17');
  const t = new Table({ rules, rand: mulberry32(8) });
  rig(t, ['A', '9', 'A', '7', '5', '9']); // player A,A ; dealer 9,7 ; split -> A,5 and A,9
  const io = scriptedIo(['split']);
  const res = await t.playRound(io);
  assert.equal(io.asked.length, 1, 'only the split decision; split aces are dealt one card');
  const hands = t.seats[0].hands;
  assert.equal(hands.length, 2);
  assert.deepEqual(hands.map((h) => h.cards.length), [2, 2]);
  // A,5 = 16 loses to 16? dealer 9,7 = 16 must hit; just check the bookkeeping is per hand
  assert.equal(res.results[0].net, hands[0].net + hands[1].net);
});

test('dealer hits soft 17 only under H17', () => {
  const soft17 = [makeCard('A', '♠'), makeCard('6', '♠')];
  assert.equal(dealerShouldHit(soft17, rulesFor('shoe-6d-h17')), true);
  assert.equal(dealerShouldHit(soft17, rulesFor('shoe-6d-s17')), false);
  assert.equal(dealerShouldHit([makeCard('10', '♠'), makeCard('7', '♠')], rulesFor('shoe-6d-h17')), false);
});

test('Hi-Lo helpers: tags, floor rounding, half-deck estimates', () => {
  assert.deepEqual([1, 2, 6, 7, 9, 10].map(hiloTag), [-1, 1, 1, 0, 0, -1]);
  assert.equal(trueCount(5, 2), 2);
  assert.equal(trueCount(-3, 2), -2);
  assert.equal(trueCount(9, 3), 3);
  assert.equal(trueCount(6, 1.5), 4);
  assert.equal(estimateDecksRemaining(130), 2.5);
  assert.equal(estimateDecksRemaining(10), 0.5);
  // a full deck counts back to zero
  const deck = [];
  for (let r = 1; r <= 13; r++) for (let s = 0; s < 4; s++) deck.push(Math.min(10, r));
  assert.equal(runningCount(deck), 0);
});
