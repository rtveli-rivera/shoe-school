// dealer.js — exact probabilities of the dealer's final hand, drawing without
// replacement from a given shoe composition.
//
// Pure ES module (no DOM, no Node APIs).
//
// Method. The dealer's play is fixed, so every way the dealer can finish is a
// sequence of drawn cards. The probability of one ordered sequence drawn from
// a shoe S of N cards depends only on the multiset m of cards drawn:
//
//     P(sequence) = prod_r S_r (S_r - 1) ... (S_r - m_r + 1)  /  N (N - 1) ... (N - n + 1)
//
// (a product of falling factorials; n = number of cards drawn). So for each
// dealer starting hand we enumerate ONCE, independent of the shoe, every
// terminal multiset together with how many valid orderings reach it (orderings
// in which the dealer had not already stopped) and its outcome. Evaluating a
// shoe is then a short sum over that list — no recursion per shoe. The path
// tables are memoised per (starting hand, H17/S17); this is the "memoised on
// the dealer's card multiset" part, done once for the whole program.
//
// Outcomes are indexed 0..6 = dealer 17, 18, 19, 20, 21, bust, blackjack.
// Blackjack can only happen when the dealer starts from a single upcard: the
// first card drawn is the hole card, and upcard + hole = 21 is a natural.

export const OUTCOMES = Object.freeze(['17', '18', '19', '20', '21', 'bust', 'bj']);
export const O_BUST = 5;
export const O_BJ = 6;

const KEY_BASE = 16; // per-rank digit of the multiset key (a dealer never draws 16 of one rank)

function total(hard, ace) { return ace && hard + 10 <= 21 ? hard + 10 : hard; }
function isSoft(hard, ace) { return ace && hard + 10 <= 21; }

// Does a dealer holding (hard sum with aces as 1, has an ace) stop drawing?
export function dealerStands(hard, ace, h17) {
  const t = total(hard, ace);
  if (t > 17) return true;
  if (t === 17) return !(h17 && isSoft(hard, ace));
  return false;
}

const pathCache = new Map();

// Compiled path table for a dealer starting at (hard, ace).
//   holeDraw: true when the dealer holds one card (classic upcard) so the
//             first card drawn is the hole card and can make a blackjack.
//   h17:      dealer hits soft 17.
// Returns flat typed arrays (see evalPaths).
export function dealerPaths(hard0, ace0, holeDraw, h17) {
  const cacheKey = `${hard0}|${ace0 ? 1 : 0}|${holeDraw ? 1 : 0}|${h17 ? 1 : 0}`;
  const hit = pathCache.get(cacheKey);
  if (hit) return hit;

  const terminals = new Map(); // multiset key -> { counts, n, outcome, ways }
  const addTerminal = (key, counts, n, outcome, ways) => {
    const t = terminals.get(key);
    if (t) { t.ways += ways; return; }
    terminals.set(key, { counts, n, outcome, ways });
  };

  if (!holeDraw && dealerStands(hard0, ace0, h17)) {
    // Already finished (Double Exposure dealer standing on two cards).
    addTerminal(0, new Array(11).fill(0), 0, Math.min(total(hard0, ace0), 21) - 17, 1);
  } else {
    let layer = new Map([[0, { counts: new Array(11).fill(0), hard: hard0, ace: ace0, n: 0, ways: 1 }]]);
    while (layer.size) {
      const next = new Map();
      for (const [key, st] of layer) {
        for (let r = 1; r <= 10; r++) {
          const hard = st.hard + r;
          const ace = st.ace || r === 1;
          const n = st.n + 1;
          const k2 = key + KEY_BASE ** (r - 1);
          let outcome = -1;
          if (holeDraw && n === 1 && total(hard, ace) === 21) outcome = O_BJ;
          else if (hard > 21) outcome = O_BUST;
          else if (dealerStands(hard, ace, h17)) outcome = total(hard, ace) - 17;
          if (outcome >= 0) {
            const counts = st.counts.slice(); counts[r]++;
            addTerminal(k2, counts, n, outcome, st.ways);
          } else {
            const s2 = next.get(k2);
            if (s2) s2.ways += st.ways;
            else {
              const counts = st.counts.slice(); counts[r]++;
              next.set(k2, { counts, hard, ace, n, ways: st.ways });
            }
          }
        }
      }
      layer = next;
    }
  }

  // Compile into a trie. Each terminal multiset is the product of one
  // falling-factorial factor per rank it contains, r * 16 + m_r indexing the
  // per-shoe table built in evalPaths. Ordering the factors by rank (tens
  // first) and sharing common prefixes means each shoe evaluation costs one
  // multiplication per trie node plus two per terminal, instead of one per
  // factor of every terminal. Nodes are stored parent-before-child.
  const list = [...terminals.values()];
  const nodeOf = new Map([['', 0]]); // prefix string -> node index (0 = root, factor 1)
  const parent = [0], term = [0];
  const leaf = new Uint32Array(list.length);
  const outcome = new Uint8Array(list.length);
  const ways = new Float64Array(list.length);
  const ncards = new Uint8Array(list.length);
  let maxN = 0;
  const maxM = new Uint8Array(11); // most cards of each rank any terminal draws
  list.forEach((t, i) => {
    for (let r = 1; r <= 10; r++) if (t.counts[r] > maxM[r]) maxM[r] = t.counts[r];
    let prefix = '', node = 0;
    for (let r = 10; r >= 1; r--) {
      if (!t.counts[r]) continue;
      const f = r * 16 + t.counts[r];
      prefix += `${f},`;
      let nx = nodeOf.get(prefix);
      if (nx === undefined) { nx = parent.length; parent.push(node); term.push(f); nodeOf.set(prefix, nx); }
      node = nx;
    }
    leaf[i] = node; outcome[i] = t.outcome; ways[i] = t.ways; ncards[i] = t.n;
    if (t.n > maxN) maxN = t.n;
  });
  // Group terminals by (outcome, cards drawn) so 1 / N(N-1)...(N-n+1) is
  // applied once per group: slot = outcome * 16 + n.
  const slot = new Uint8Array(list.length);
  for (let i = 0; i < list.length; i++) slot[i] = outcome[i] * 16 + ncards[i];
  const compiled = {
    size: list.length, nodes: parent.length,
    parent: Uint32Array.from(parent), term: Uint16Array.from(term),
    leaf, ways, slot, maxN, maxM,
  };
  pathCache.set(cacheKey, compiled);
  return compiled;
}

// Scratch buffers reused by evalPaths (the engine is single-threaded per worker).
const FF = new Float64Array(11 * 16);
const INV = new Float64Array(32);
const ACC = new Float64Array(7 * 16);
let PROD = new Float64Array(1024);

// Raw (unconditioned) outcome probabilities for a compiled path table drawn
// from `shoe`. `shoe` must already exclude every card known to be out (the
// dealer's own upcard, the player's cards...). Returns a Float64Array(7).
export function evalPaths(paths, shoe, out = new Float64Array(7)) {
  let N = 0;
  const maxM = paths.maxM;
  for (let r = 1; r <= 10; r++) {
    const s = shoe[r];
    N += s;
    const base = r * 16;
    FF[base] = 1;
    for (let m = 1, e = maxM[r]; m <= e; m++) {
      const f = s - m + 1;
      FF[base + m] = FF[base + m - 1] * (f > 0 ? f : 0);
    }
  }
  INV[0] = 1;
  for (let n = 1; n <= paths.maxN; n++) {
    const f = N - n + 1;
    INV[n] = f > 0 ? INV[n - 1] / f : 0;
  }
  const { nodes, parent, term, size, leaf, ways, slot } = paths;
  if (PROD.length < nodes) PROD = new Float64Array(nodes * 2);
  const prod = PROD;
  prod[0] = 1;
  for (let i = 1; i < nodes; i++) prod[i] = prod[parent[i]] * FF[term[i]];
  ACC.fill(0);
  for (let i = 0; i < size; i++) ACC[slot[i]] += prod[leaf[i]] * ways[i];
  for (let o = 0; o < 7; o++) {
    let v = 0;
    for (let n = 0; n <= paths.maxN; n++) v += ACC[o * 16 + n] * INV[n];
    out[o] = v;
  }
  return out;
}

// Raw outcome probabilities for a classic upcard (shoe excludes the upcard).
export function dealerRaw(shoe, up, h17, out) {
  return evalPaths(dealerPaths(up, up === 1, true, h17), shoe, out);
}

function toObject(a, scale = 1) {
  const o = {};
  OUTCOMES.forEach((k, i) => { o[k] = a[i] * scale; });
  return o;
}

// Public form: { '17', '18', '19', '20', '21', bust, bj } for an upcard.
// With a hole card and peek (rules.peek, the US game) and an A or 10 up, the
// player only ever acts once the dealer is known NOT to have blackjack, so the
// result is conditioned on that: bj = 0 and the rest sums to 1. Without peek
// (ENHC) the probabilities are unconditioned and bj is the dealer's natural.
// `shoe` excludes the upcard (and any other cards known to be gone).
export function dealerProbs(shoe, up, rules) {
  const raw = dealerRaw(shoe, up, !!rules.hitSoft17);
  if (rules.peek && raw[O_BJ] > 0) {
    const noBj = 1 - raw[O_BJ];
    const o = toObject(raw, 1 / noBj);
    o.bj = 0;
    return o;
  }
  return toObject(raw);
}

// Double Exposure: the dealer's whole starting hand is known (no blackjack —
// a dealer natural ends the round before anyone plays).
export function dealerProbsFromHand(shoe, dealerRanks, rules) {
  let hard = 0, ace = false;
  for (const r of dealerRanks) { hard += r; if (r === 1) ace = true; }
  return toObject(evalPaths(dealerPaths(hard, ace, false, !!rules.hitSoft17), shoe));
}
