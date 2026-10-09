// strategy.js — basic-strategy charts, the play for any hand, house edge.
//
// Pure ES module (no DOM, no Node APIs). The main engine API (SPEC.md,
// "Contract: the strategy engine"):
//
//   getChart(rules)                 -> Chart (precomputed or computed live)
//   decide(hand, up, rules, opts)   -> { action, code, source, deviation, table, row }
//   takeInsurance(tc, rules, opts?) -> boolean
//   houseEdge(rules)                -> percent of the initial bet, + = house
//
// How a chart is made. For each dealer upcard the engine (ev.js) computes the
// exact EV of every first action for every two-card hand, with card removal.
// A chart row is a TOTAL (what published charts show), so each action's EV is
// averaged over the two-card hands making that total, weighted by how likely
// each is to be dealt (hard rows leave pairs out; pairs have their own table),
// and the cell gets the code of the best action, with its fallback.
// Pass 1 prices "hit" and "split" with perfect composition-dependent play
// afterwards; then the chart is re-priced with ITSELF played afterwards (hits
// continue by total, split hands follow the chart) and re-coded until nothing
// changes (ev.js refineChartTD; one or two rounds). That fixed point is
// total-dependent basic strategy, and chart.ev holds those EVs. The house edge
// is measured by playing exactly this chart over every initial deal.
// Multi-card hands are played from the same chart by total.
// For a Double Exposure rule set (variant 'de'), getChart returns the DE chart
// (de.js), whose columns are dealer hands instead of upcards.
//
// Chart object (plain JSON — it is posted from a Web Worker):
//   key, rules, variant: 'classic',
//   hard  { '4'..'21':  { '2'..'10','A': Code } }
//   soft  { '12'..'21': {...} }        12 = A,A when it is not split
//   pairs { '2'..'10','A': {...} }
//   ev    { hard|soft|pairs: { row: { up: { stand, hit, double?, split?, splitNoDas?, surrender? } } } }
//         EV per unit of the original bet, this chart played afterwards; with a
//         peek and an A/10 up, given that the dealer does not have blackjack.
//         splitNoDas (DAS charts only) is what splitting is worth without DAS,
//         which is what separates 'Ph' from 'P'. Rows 21 only price stand/hit.
//   houseEdge            % at houseEdgeBjPays (1.5 = 3:2), total-dependent play
//   houseEdgeCD          % at 3:2 with perfect composition-dependent play
//   houseEdgeBjPays      1.5
//   pBlackjackNoDealerBj probability of a paid natural (player BJ, dealer none)
//   pBlackjackPaid       the same number under the name de.js also uses
//   tdRounds             re-pricing rounds the total-dependent fixed point took
//   method               short text for the "why?" screen
//   precomputed          true when it came from js/data/charts.js (EVs rounded to 4 decimals)
//
// The chart key leaves out the blackjack payout (it never changes a decision),
// so 3:2 and 6:5 games share a chart; houseEdge(rules) adds the payout back:
//   edge(bjPays) = chart.houseEdge - (bjPays - 1.5) * pBlackjackNoDealerBj * 100.

import { normalizeRules, chartKey, UPCARDS, rankKey, handValue } from './rules.js';
import {
  makeGame, enumerateEdge, doubleAllowedFor, chooseCode, resolveCode, ACTION_NAME, CHART_ROWS,
  accumulateRow, rowEV, totalPolicy, chartFirstU, bestFirstU, refineChartTD,
} from './ev.js';
import { getDEChart } from './de.js';
import { CHARTS } from '../data/charts.js';
import { DEVIATIONS } from '../data/deviations.js';

export const CHART_REF_BJ_PAYS = 1.5;

export const METHOD_TEXT = 'Exact combinatorial analysis for these rules: dealer outcome '
  + 'probabilities and player EVs with real card removal. Each cell is the best action '
  + 'averaged over the two-card hands with that total, assuming you follow this same chart '
  + 'afterwards. Each split hand is valued on its own (exact for one split; resplits use '
  + 'the expected number of hands). House edge: this chart played over every possible '
  + 'initial deal, shuffling after each round.';

const liveCache = new Map(); // chartKey -> Chart computed in this session

// ---------------------------------------------------------------------------
// Chart computation (live; scripts/build-charts.mjs stores the common ones)

// options.continuation: 'td' (default) = cells priced with the chart itself
// played afterwards (refineChartTD); 'cd' = perfect composition-dependent play
// afterwards (one pass). Kept for the validation write-up.
export function computeChart(rulesIn, { continuation = 'td' } = {}) {
  const rules = normalizeRules(rulesIn);
  if (rules.variant === 'de') return getDEChart(rules);
  const game = makeGame(rules);
  const chart = {
    key: chartKey(rules), rules: { ...rules, bjPays: CHART_REF_BJ_PAYS }, variant: 'classic',
    hard: {}, soft: {}, pairs: {}, ev: { hard: {}, soft: {}, pairs: {} },
  };
  for (const table of ['hard', 'soft', 'pairs']) {
    for (const row of CHART_ROWS[table]) { chart[table][row] = {}; chart.ev[table][row] = {}; }
  }
  for (const u of game.perUp) {
    const col = rankKey(u.up);
    for (const table of ['hard', 'soft', 'pairs']) {
      for (const row of CHART_ROWS[table]) {
        const ev = rowEV(accumulateRow({ den: 0 }, u, rules, table, row));
        chart.ev[table][row][col] = ev;
        chart[table][row][col] = chooseCode(ev, rules.das);
      }
    }
  }
  chart.tdRounds = continuation === 'td'
    ? refineChartTD(chart, game.perUp.map((u) => ({ col: rankKey(u.up), items: [{ u, wD: 1 }] })), rules)
    : 0;
  const policies = new Map();
  const tdFirst = (u, ranks) => {
    const col = rankKey(u.up);
    if (!policies.has(col)) policies.set(col, totalPolicy(chart, col));
    return chartFirstU(u, ranks, rules, chart, col, policies.get(col));
  };
  const td = enumerateEdge(game, tdFirst, CHART_REF_BJ_PAYS);
  const cd = enumerateEdge(game, (u, ranks) => bestFirstU(u, ranks, rules), CHART_REF_BJ_PAYS);
  chart.houseEdge = td.edge;
  chart.houseEdgeCD = cd.edge;
  chart.houseEdgeBjPays = CHART_REF_BJ_PAYS;
  chart.pBlackjackNoDealerBj = td.pBlackjackNoDealerBj;
  chart.pBlackjackPaid = td.pBlackjackNoDealerBj;
  chart.method = METHOD_TEXT;
  return chart;
}

// ---------------------------------------------------------------------------
// Public API

export function getChart(rulesIn) {
  const rules = normalizeRules(rulesIn);
  if (rules.variant === 'de') return getDEChart(rules);
  const key = chartKey(rules);
  if (CHARTS[key]) return CHARTS[key];
  let c = liveCache.get(key);
  if (!c) { c = computeChart(rules); liveCache.set(key, c); }
  return c;
}

// House edge in percent of the initial bet (+ = house) for these rules,
// including the blackjack payout, with the chart played by total.
export function houseEdge(rulesIn) {
  const rules = normalizeRules(rulesIn);
  const chart = getChart(rules);
  return chart.houseEdge - (rules.bjPays - chart.houseEdgeBjPays) * chart.pBlackjackPaid * 100;
}

function deviationList(rules, opts) {
  if (Array.isArray(opts.deviations)) return opts.deviations;
  const set = DEVIATIONS && DEVIATIONS[rules.hitSoft17 ? 'h17' : 's17'];
  return Array.isArray(set) ? set : [];
}

const holds = (e, tc) => (e.when === 'le' ? tc <= e.index : tc >= e.index);

// Insurance (or even money): only on a count. Default index +3 when the
// deviation list has no insurance entry.
export function takeInsurance(tc, rulesIn, opts = {}) {
  if (typeof tc !== 'number' || Number.isNaN(tc)) return false;
  if (opts.indexSet === 'none') return false;
  const rules = normalizeRules(rulesIn);
  const e = deviationList(rules, opts).find((d) => d.set === 'insurance' || d.action === 'insure');
  if (!e) return tc >= 3;
  return holds(e, tc);
}

// The play for `hand` (engine ranks) against upcard `up` (engine rank).
//
// opts: { canDouble, canSplit, canSurrender, splitCount, tc, indexSet,
//         deviations (override list), insurance (true = answer the insurance
//         question instead) }
// can* flags from the caller are ANDed with what the rules allow: doubling
// only on two cards (after a split only with DAS) and within rules.doubleOn;
// surrender only on the first two cards of an unsplit hand; splitting only a
// pair while fewer than rules.maxSplitHands hands exist (aces resplit only with
// rules.resplitAces). A split code that cannot be split falls back to the row
// for the hand's total.
export function decide(hand, up, rulesIn, opts = {}) {
  const rules = normalizeRules(rulesIn);
  if (rules.variant === 'de') throw new Error('Double Exposure: use decideDE() from de.js');
  if (opts.insurance) {
    const take = up === 1 && takeInsurance(opts.tc, rules, opts);
    return { action: take ? 'insurance' : 'insurance-no', code: null, source: take ? 'deviation' : 'basic', deviation: null, table: null, row: null };
  }
  const chart = getChart(rules);
  const upKey = rankKey(up);
  const v = handValue(hand);
  if (v.total > 21) throw new Error('Hand is bust');
  let hard = 0, ace = false;
  for (const r of hand) { hard += r; if (r === 1) ace = true; }
  const splitCount = opts.splitCount || 0;
  const two = hand.length === 2;
  const pair = two && hand[0] === hand[1];
  const allowed = {
    canDouble: (opts.canDouble ?? true) && two && (splitCount === 0 || rules.das) && doubleAllowedFor(rules, hard, ace),
    canSplit: (opts.canSplit ?? true) && pair && splitCount + 1 < rules.maxSplitHands
      && !(hand[0] === 1 && splitCount > 0 && !rules.resplitAces),
    canSurrender: (opts.canSurrender ?? true) && two && splitCount === 0 && rules.surrender === 'late',
    das: rules.das,
  };

  // Basic strategy.
  let table, row, code, act = null;
  if (pair && allowed.canSplit) {
    table = 'pairs'; row = rankKey(hand[0]); code = chart.pairs[row][upKey];
    act = resolveCode(code, allowed);
  }
  if (act === null) {
    table = v.soft ? 'soft' : 'hard'; row = String(v.total); code = chart[table][row][upKey];
    act = resolveCode(code, { ...allowed, canSplit: false });
  }
  const basic = { action: ACTION_NAME[act], code, source: 'basic', deviation: null, table, row };

  if (typeof opts.tc !== 'number' || Number.isNaN(opts.tc) || !['i18', 'i18fab4'].includes(opts.indexSet)) return basic;
  return applyDeviations(basic, hand, upKey, rules, chart, allowed, opts);
}

// Index plays (entries in the js/data/deviations.js format). Order:
//  (1) While surrender is possible: a surrender entry for the cell decides
//      surrender / no surrender. A surrender entry is one whose action OR
//      otherwise is 'R', so both spellings work: "surrender when TC >= 3"
//      ({action:'R', when:'ge'}) and "hit when TC <= -1, else surrender"
//      ({action:'H', when:'le', otherwise:'R'}). Without one, a chart
//      surrender stays a surrender.
//  (2) Otherwise a play entry for the cell (I18): when its condition holds,
//      its action; when not, its `otherwise` (this matters when an index sits
//      on the other side of zero from the chart).
// Entries whose action is not possible right now are skipped, as are entries
// of other sets (set: 'basic' marks a famous play that is already basic
// strategy). A pair that the chart does not split also takes entries for its
// total (5,5 is a hard 10).
function applyDeviations(basic, hand, upKey, rules, chart, allowed, opts) {
  const tc = opts.tc;
  const sets = opts.indexSet === 'i18fab4' ? ['i18', 'fab4'] : ['i18'];
  const list = deviationList(rules, opts).filter((e) => sets.includes(e.set) && e.action !== 'insure');
  const isSurrenderEntry = (e) => e.action === 'R' || e.otherwise === 'R';
  const v = handValue(hand);
  const totalTable = v.soft ? 'soft' : 'hard';
  const cells = [[basic.table, basic.row]];
  if (basic.table === 'pairs' && basic.action !== 'split') cells.push([totalTable, String(v.total)]);
  const matching = [];
  for (const [t, r] of cells) for (const e of list) if (e.table === t && String(e.row) === r && String(e.up) === upKey) matching.push(e);
  const feasible = (a) => (a === 'D' ? allowed.canDouble : a === 'P' ? allowed.canSplit : a === 'R' ? allowed.canSurrender : a === 'S' || a === 'H');
  // The basic play with surrender ruled out.
  const noSurrender = { ...allowed, canSurrender: false };
  let fallbackAct = resolveCode(basic.code, noSurrender);
  if (fallbackAct === null) {
    const code = chart[totalTable][String(v.total)][upKey];
    fallbackAct = resolveCode(code, { ...noSurrender, canSplit: false });
  }
  // `deviation` = the entry that decided the play; `source` says whether the
  // play differs from the chart's.
  const result = (a, entry) => ({
    ...basic, action: ACTION_NAME[a], deviation: entry,
    source: ACTION_NAME[a] !== basic.action ? 'deviation' : 'basic',
  });

  let blockedBy = null;
  if (allowed.canSurrender) {
    const sEntry = matching.find(isSurrenderEntry);
    if (sEntry) {
      const surrender = sEntry.action === 'R' ? holds(sEntry, tc) : !holds(sEntry, tc);
      if (surrender) return result('R', sEntry);
      blockedBy = sEntry; // the count says: do not surrender here
    } else if (basic.action === 'surrender') return basic;
  }
  const pEntry = matching.find((e) => !isSurrenderEntry(e) && feasible(e.action));
  if (pEntry && holds(pEntry, tc)) return result(pEntry.action, pEntry);
  let act = fallbackAct;
  let entry = blockedBy;
  if (blockedBy && blockedBy.action !== 'R' && feasible(blockedBy.action)) act = blockedBy.action; // e.g. 'H' below the index
  if (pEntry) {
    // Not at the index: the entry's `otherwise` play.
    const other = pEntry.otherwise && feasible(pEntry.otherwise) ? pEntry.otherwise : fallbackAct;
    if (!entry || other !== act) entry = pEntry;
    act = other;
  }
  if (!entry) return basic;
  return result(act, entry);
}

export { UPCARDS };
