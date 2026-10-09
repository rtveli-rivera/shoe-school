// de.js — Double Exposure: both dealer cards are dealt face up.
//
// Pure ES module (no DOM, no Node APIs).
//
//   getDEChart(rules)                          -> DEChart
//   decideDE(hand, dealerHand, rules, opts)    -> { action, code, source, deviation, table, row, col }
//   houseEdgeDE(rules)                         -> percent of the initial bet, + = house
//
// Rules (the 'double-exposure' preset in rules.js). The usual game, per the
// Wizard of Odds Double Exposure page: both dealer cards exposed, dealer wins
// all ties except a player natural, blackjack pays even money, split once.
// What varies between casinos and is modelled: H17/S17, decks, DAS, double on
// any two / hard 9-11 / hard 10-11, more splits, tied blackjacks win or push
// (dePlayerBjWinsTie), and ties lose or push (deTiesLose). A dealer blackjack
// ends the round at once (you lose unless you also have one). A player natural
// is paid bjPays at once whatever the dealer's hand. No insurance. Surrender is
// normally not offered; if rules.surrender is 'late' it is priced at -0.5.
// Card counting indices are not modelled for this game.
//
// Chart layout (DEChart, plain JSON):
//   key, rules, variant: 'de'
//   cols   the dealer's two-card hand, 26 columns in this order:
//          'h4'..'h20'  hard totals: h4 = 2,2; h12 = T,2 / 9,3 / 8,4 / 7,5 / 6,6;
//                       h20 = T,T (two cards without an ace)
//          's12'..'s20' soft totals: s12 = A,A, s13 = A,2 ... s20 = A,9
//          A dealer blackjack (A,T) has no column: nobody plays.
//   hard  { '4'..'21':  { [col]: Code } }   the player's rows, exactly as in
//   soft  { '12'..'21': { [col]: Code } }   the classic chart (strategy.js):
//   pairs { '2'..'10','A': { [col]: Code } } hard rows exclude pairs, soft 12 = A,A unsplit
//   ev    { hard|soft|pairs: { row: { col: { stand, hit, double?, split?, splitNoDas?, surrender? } } } }
//   houseEdge (% at houseEdgeBjPays = 1, even money), houseEdgeCD, houseEdgeBjPays,
//   pBlackjackPaid (P(a player natural is paid): dealer has none, or ties win),
//   method, layout.
// Codes are the classic ones (S H D Ds P Ph Rh Rs Rp). A cell is the best
// action averaged over every player two-card hand of that row AND every dealer
// two-card hand of that column, weighted by probability.

import { normalizeRules, chartKey, handValue } from './rules.js';
import {
  HandSolver, doubleAllowedFor, chooseCode, resolveCode, ACTION_NAME, CHART_ROWS,
  accumulateRow, rowEV, totalPolicy, chartFirstU, bestFirstU, refineChartTD,
} from './ev.js';
import { fullShoe, removeCards, pairProb } from './shoe.js';
import { CHARTS } from '../data/charts.js';

export const DE_COLS = Object.freeze([
  ...Array.from({ length: 17 }, (_, i) => `h${i + 4}`),
  ...Array.from({ length: 9 }, (_, i) => `s${i + 12}`),
]);

export const DE_LAYOUT = 'Rows: your hand (hard 4-21, soft 12-21, pairs). Columns: the dealer\'s two '
  + 'face-up cards as a hard total (h4-h20) or a soft total (s12 = A,A ... s20 = A,9). '
  + 'A dealer blackjack has no column: the round is over.';

export const DE_METHOD = 'Exact combinatorial analysis with both dealer cards known: dealer '
  + 'drawing probabilities and player EVs with real card removal. Each cell is the best action '
  + 'averaged over your two-card hands with that total and the dealer\'s two-card hands in that '
  + 'column. House edge: this chart played by total over every initial deal.';

// Column key for a dealer hand, or null for a dealer blackjack.
export function dealerCol(dealerRanks) {
  const v = handValue(dealerRanks);
  if (dealerRanks.length === 2 && v.total === 21) return null;
  return `${v.soft ? 's' : 'h'}${v.total}`;
}

// The dealer's two-card hands behind a column.
export function colHands(col) {
  const t = Number(col.slice(1));
  if (col[0] === 's') return t === 12 ? [[1, 1]] : [[1, t - 11]];
  const out = [];
  for (let a = 2; a <= 10; a++) for (let b = a; b <= 10; b++) if (a + b === t) out.push([a, b]);
  return out;
}

const liveCache = new Map();

// One HandSolver per dealer two-card hand (plus split contexts), sharing
// dealer distributions within each dealer hand.
function makeDEGame(rules) {
  const full = fullShoe(rules.decks);
  const cfg = { h17: !!rules.hitSoft17, peek: false, tieValue: rules.deTiesLose ? -1 : 0 };
  const W = [0]; for (let r = 1; r <= 10; r++) W[r] = 32 ** (r - 1);
  const situations = new Map(); // 'a,b' -> u
  const get = (a, b) => {
    const k = `${a},${b}`;
    let u = situations.get(k);
    if (u) return u;
    const S0 = removeCards(full, [a, b]);
    const dealer = { hard: a + b, ace: a === 1 || b === 1, holeDraw: false };
    const cache = new Map();
    const solver = new HandSolver(S0, dealer, cfg, { cache, offset: 0 });
    const splitCtx = new Map();
    u = {
      dealer: [a, b], pD: pairProb(full, a, b), S0, solver,
      ctx(x) {
        let c = splitCtx.get(x);
        if (!c) { c = new HandSolver(removeCards(S0, [x]), dealer, cfg, { cache, offset: W[x] }); splitCtx.set(x, c); }
        return c;
      },
    };
    situations.set(k, u);
    return u;
  };
  return { rules, full, get };
}

export function computeDEChart(rulesIn) {
  const rules = normalizeRules(rulesIn);
  const game = makeDEGame(rules);
  const chart = {
    key: chartKey(rules), rules: { ...rules }, variant: 'de', cols: [...DE_COLS], layout: DE_LAYOUT,
    hard: {}, soft: {}, pairs: {}, ev: { hard: {}, soft: {}, pairs: {} },
  };
  for (const table of ['hard', 'soft', 'pairs']) {
    for (const row of CHART_ROWS[table]) { chart[table][row] = {}; chart.ev[table][row] = {}; }
  }
  for (const col of DE_COLS) {
    const us = colHands(col).map(([a, b]) => game.get(a, b));
    for (const table of ['hard', 'soft', 'pairs']) {
      for (const row of CHART_ROWS[table]) {
        const acc = { den: 0 };
        for (const u of us) accumulateRow(acc, u, rules, table, row, u.pD);
        const ev = rowEV(acc);
        chart.ev[table][row][col] = ev;
        chart[table][row][col] = chooseCode(ev, rules.das);
      }
    }
  }
  // Re-price with the chart itself played afterwards (see ev.js refineChartTD).
  chart.tdRounds = refineChartTD(chart, DE_COLS.map((col) => ({
    col, items: colHands(col).map(([a, b]) => { const u = game.get(a, b); return { u, wD: u.pD }; }),
  })), rules);
  const policies = new Map();
  const td = deEdge(game, (u, ranks) => {
    const col = dealerCol(u.dealer);
    if (!policies.has(col)) policies.set(col, totalPolicy(chart, col));
    return chartFirstU(u, ranks, rules, chart, col, policies.get(col));
  }, 1);
  const cd = deEdge(game, (u, ranks) => bestFirstU(u, ranks, rules), 1);
  chart.houseEdge = td.edge;
  chart.houseEdgeCD = cd.edge;
  chart.houseEdgeBjPays = 1;
  chart.pBlackjackPaid = td.pBlackjackPaid;
  chart.method = DE_METHOD;
  return chart;
}

// House edge by full enumeration of the initial deal (dealer two cards x
// player two cards). firstU(u, ranks) -> value of the play for a non-natural.
function deEdge(game, firstU, bjPays) {
  const { rules, full } = game;
  let ev = 0, pPaid = 0;
  for (let a = 1; a <= 10; a++) {
    for (let b = a; b <= 10; b++) {
      const pD = pairProb(full, a, b);
      if (!(pD > 0)) continue;
      if (a === 1 && b === 10) {
        // Dealer natural: the round ends. A player natural wins or pushes.
        const S0 = removeCards(full, [a, b]);
        const pBj = pairProb(S0, 1, 10);
        const tie = rules.dePlayerBjWinsTie ? bjPays : 0;
        ev += pD * (pBj * tie - (1 - pBj));
        if (rules.dePlayerBjWinsTie) pPaid += pD * pBj;
        continue;
      }
      const u = game.get(a, b);
      let e = 0;
      for (let p = 1; p <= 10; p++) {
        for (let q = p; q <= 10; q++) {
          const w = pairProb(u.S0, p, q);
          if (!(w > 0)) continue;
          if (p === 1 && q === 10) { e += w * bjPays; pPaid += pD * w; continue; }
          e += w * firstU(u, [p, q]);
        }
      }
      ev += pD * e;
    }
  }
  return { edge: -100 * ev, pBlackjackPaid: pPaid };
}

// ---------------------------------------------------------------------------
// Public API

export function getDEChart(rulesIn) {
  const rules = normalizeRules({ ...rulesIn, variant: 'de' });
  const key = chartKey(rules);
  if (CHARTS[key]) return CHARTS[key];
  let c = liveCache.get(key);
  if (!c) { c = computeDEChart(rules); liveCache.set(key, c); }
  return c;
}

export function houseEdgeDE(rulesIn) {
  const rules = normalizeRules({ ...rulesIn, variant: 'de' });
  const chart = getDEChart(rules);
  return chart.houseEdge - (rules.bjPays - chart.houseEdgeBjPays) * chart.pBlackjackPaid * 100;
}

// The play for `hand` against the dealer's two face-up cards `dealerHand`.
// opts: { canDouble, canSplit, canSurrender, splitCount } — ANDed with the
// rules, as in strategy.decide(). Count-based deviations are not modelled.
export function decideDE(hand, dealerHand, rulesIn, opts = {}) {
  const rules = normalizeRules({ ...rulesIn, variant: 'de' });
  const col = dealerCol(dealerHand);
  if (col === null) {
    return { action: 'none', code: null, source: 'basic', deviation: null, table: null, row: null, col: null,
      reason: 'Dealer blackjack: the round is over.' };
  }
  const chart = getDEChart(rules);
  if (!chart.hard['16'][col]) throw new Error(`No Double Exposure column for a dealer ${col}`);
  const v = handValue(hand);
  if (v.total > 21) throw new Error('Hand is bust');
  let hard = 0, ace = false;
  for (const r of hand) { hard += r; if (r === 1) ace = true; }
  const splitCount = opts.splitCount || 0;
  const two = hand.length === 2;
  const pair = two && hand[0] === hand[1];
  if (two && splitCount === 0 && v.total === 21) {
    return { action: 'stand', code: 'S', source: 'basic', deviation: null, table: 'soft', row: '21', col,
      reason: 'Blackjack: paid at once.' };
  }
  const allowed = {
    canDouble: (opts.canDouble ?? true) && two && (splitCount === 0 || rules.das) && doubleAllowedFor(rules, hard, ace),
    canSplit: (opts.canSplit ?? true) && pair && splitCount + 1 < rules.maxSplitHands
      && !(hand[0] === 1 && splitCount > 0 && !rules.resplitAces),
    canSurrender: (opts.canSurrender ?? true) && two && splitCount === 0 && rules.surrender === 'late',
    das: rules.das,
  };
  let table, row, code, act = null;
  if (pair && allowed.canSplit) {
    table = 'pairs'; row = hand[0] === 1 ? 'A' : String(hand[0]); code = chart.pairs[row][col];
    act = resolveCode(code, allowed);
  }
  if (act === null) {
    table = v.soft ? 'soft' : 'hard'; row = String(v.total); code = chart[table][row][col];
    act = resolveCode(code, { ...allowed, canSplit: false });
  }
  return { action: ACTION_NAME[act], code, source: 'basic', deviation: null, table, row, col };
}
