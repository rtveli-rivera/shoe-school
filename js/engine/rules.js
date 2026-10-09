// rules.js — the casino rule set: one plain object every part of the app shares.
//
// Pure ES module (no DOM, no Node APIs) so the browser, the Node tests and the
// chart precompute script all import the same file.
//
// Engine card ranks: 1 = Ace, 2..9, 10 = any ten-value card (10/J/Q/K).
// Chart keys use '2'..'10' and 'A' for the dealer upcard.

export const DEFAULT_RULES = Object.freeze({
  variant: 'classic',      // 'classic' | 'de' (Double Exposure: both dealer cards face up)
  decks: 6,                // 1 | 2 | 4 | 6 | 8
  hitSoft17: true,         // true = H17 (dealer hits soft 17), false = S17
  das: true,               // double after split
  doubleOn: 'any',         // 'any' (any first two cards) | '9-11' | '10-11'
  surrender: 'late',       // 'none' | 'late'
  peek: true,              // true = US hole card + peek for blackjack; false = European no hole card (ENHC)
  enhcObo: false,          // ENHC only: true = you lose only your original bet to a dealer blackjack (OBO)
  maxSplitHands: 4,        // 2 = split once, no resplit; 4 = resplit to four hands
  resplitAces: false,
  hitSplitAces: false,     // split aces normally get exactly one card each
  bjPays: 1.5,             // 1.5 = 3:2, 1.2 = 6:5, 1 = even money (Double Exposure)
  // Double Exposure only (ignored for 'classic'):
  deTiesLose: true,        // dealer wins every tie...
  dePlayerBjWinsTie: true, // ...except a player blackjack beats a dealer blackjack
  // Game conditions — these do not change the strategy chart, only counting / EV:
  penetration: 0.75,       // fraction of the shoe dealt before the shuffle
  dealing: 'faceup',       // 'faceup' (shoe, every player card visible) | 'pitch' (player cards face down)
});

// Ready-made casino rule sets. `id`s are stable: lessons, drills and saved
// progress refer to them.
export const PRESETS = [
  {
    id: 'shoe-6d-h17',
    name: 'Standard 6-deck shoe (H17)',
    short: '6D H17 DAS LS',
    blurb: 'The most common game in US casinos today: six decks, dealer hits soft 17, double after split, late surrender, 3:2.',
    rules: { decks: 6, hitSoft17: true, das: true, surrender: 'late', penetration: 0.75 },
  },
  {
    id: 'shoe-6d-s17',
    name: 'Good 6-deck shoe (S17)',
    short: '6D S17 DAS LS',
    blurb: 'The same shoe with the dealer standing on all 17s, which is worth about 0.2% to you. Found in higher-limit pits.',
    rules: { decks: 6, hitSoft17: false, das: true, surrender: 'late', penetration: 0.75 },
  },
  {
    id: 'shoe-8d-s17',
    name: '8-deck shoe (Atlantic City)',
    short: '8D S17 DAS LS',
    blurb: 'Eight decks, dealer stands on soft 17, double after split, late surrender. The classic Atlantic City game.',
    rules: { decks: 8, hitSoft17: false, das: true, surrender: 'late', penetration: 0.75 },
  },
  {
    id: 'dd-pitch',
    name: 'Double deck, pitched face down',
    short: '2D H17 DAS',
    blurb: 'Two decks dealt from the hand. Your cards come face down and you only see the others at the end of the round, which makes counting harder.',
    rules: { decks: 2, hitSoft17: true, das: true, surrender: 'none', penetration: 0.65, dealing: 'pitch' },
  },
  {
    id: 'dd-faceup',
    name: 'Double deck, dealt face up',
    short: '2D H17 DAS face-up',
    blurb: 'Two decks with every card dealt face up. Easy to count (you see every card) and strong (the count swings fast in two decks). The counter\'s favourite.',
    rules: { decks: 2, hitSoft17: true, das: true, surrender: 'none', penetration: 0.65, dealing: 'faceup' },
  },
  {
    id: 'sd-32',
    name: 'Single deck 3:2 (rare)',
    short: '1D H17 3:2',
    blurb: 'A real single-deck game paying 3:2 on blackjack. Hard to find, closely watched, usually no double after split.',
    rules: { decks: 1, hitSoft17: true, das: false, surrender: 'none', penetration: 0.6, dealing: 'pitch' },
  },
  {
    id: 'sd-65',
    name: 'Single deck 6:5 (avoid)',
    short: '1D H17 6:5',
    blurb: 'Looks like the best game on the floor, but the 6:5 blackjack payout costs about 1.4%. No count can beat it. Learn to recognise it and walk past.',
    rules: { decks: 1, hitSoft17: true, das: false, surrender: 'none', bjPays: 1.2, penetration: 0.6, dealing: 'pitch' },
  },
  {
    id: 'euro-enhc',
    name: 'European no-hole-card',
    short: '6D S17 DAS ENHC',
    blurb: 'Six decks, and the dealer takes the second card only after everyone has played. A dealer blackjack takes your doubles and splits too, so you double and split less against a 10 or an ace.',
    rules: { decks: 6, hitSoft17: false, das: true, surrender: 'none', peek: false, maxSplitHands: 4 },
  },
  {
    id: 'double-exposure',
    name: 'Double Exposure',
    short: 'DE 8D H17',
    blurb: 'Both dealer cards are dealt face up. In exchange, blackjack pays only even money and the dealer wins ties. A completely different strategy chart.',
    rules: {
      variant: 'de', decks: 8, hitSoft17: true, das: true, doubleOn: '9-11', surrender: 'none',
      maxSplitHands: 2, bjPays: 1, deTiesLose: true, dePlayerBjWinsTie: true, penetration: 0.75,
    },
  },
];

export const DEFAULT_PRESET_ID = 'shoe-6d-h17';

export function normalizeRules(partial = {}) {
  const r = { ...DEFAULT_RULES, ...partial };
  if (![1, 2, 4, 6, 8].includes(r.decks)) throw new Error(`Unsupported deck count: ${r.decks}`);
  if (!['any', '9-11', '10-11'].includes(r.doubleOn)) throw new Error(`Bad doubleOn: ${r.doubleOn}`);
  if (!['none', 'late'].includes(r.surrender)) throw new Error(`Bad surrender: ${r.surrender}`);
  if (!['classic', 'de'].includes(r.variant)) throw new Error(`Bad variant: ${r.variant}`);
  if (r.maxSplitHands < 1 || r.maxSplitHands > 4) throw new Error(`Bad maxSplitHands: ${r.maxSplitHands}`);
  if (r.peek) r.enhcObo = false;
  return Object.freeze(r);
}

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

export function rulesFor(presetIdOrRules) {
  if (typeof presetIdOrRules === 'string') {
    const p = presetById(presetIdOrRules);
    if (!p) throw new Error(`Unknown preset: ${presetIdOrRules}`);
    return normalizeRules(p.rules);
  }
  return normalizeRules(presetIdOrRules);
}

// The part of the rules that changes the strategy chart. Payout, penetration and
// dealing style do not change a single decision, so they are left out: two
// casinos differing only in those share a chart.
export function chartKey(rules) {
  const r = normalizeRules(rules);
  const parts = [
    r.variant,
    `${r.decks}d`,
    r.hitSoft17 ? 'h17' : 's17',
    r.das ? 'das' : 'ndas',
    `d${r.doubleOn}`,
    r.surrender === 'late' ? 'ls' : 'ns',
    r.peek ? 'peek' : (r.enhcObo ? 'enhc-obo' : 'enhc'),
    `sp${r.maxSplitHands}`,
    r.resplitAces ? 'rsa' : 'nrsa',
    r.hitSplitAces ? 'hsa' : 'nhsa',
  ];
  if (r.variant === 'de') parts.push(r.deTiesLose ? 'tl' : 'tp', r.dePlayerBjWinsTie ? 'bjw' : 'bjl');
  return parts.join('-');
}

// Short human labels, e.g. ['6 decks', 'Dealer hits soft 17', ...].
export function describeRules(rules) {
  const r = normalizeRules(rules);
  const out = [];
  if (r.variant === 'de') out.push('Double Exposure (both dealer cards face up)');
  out.push(`${r.decks} deck${r.decks > 1 ? 's' : ''}`);
  out.push(r.hitSoft17 ? 'Dealer hits soft 17 (H17)' : 'Dealer stands on soft 17 (S17)');
  out.push(r.bjPays === 1.5 ? 'Blackjack pays 3:2' : r.bjPays === 1.2 ? 'Blackjack pays 6:5' : 'Blackjack pays even money');
  out.push(r.doubleOn === 'any' ? 'Double on any two cards' : `Double on ${r.doubleOn} only`);
  out.push(r.das ? 'Double after split allowed' : 'No double after split');
  out.push(r.maxSplitHands > 2 ? `Resplit to ${r.maxSplitHands} hands` : 'Split once only');
  if (r.resplitAces) out.push('Resplit aces');
  if (r.hitSplitAces) out.push('Hit split aces');
  if (r.surrender === 'late') out.push('Late surrender');
  if (!r.peek) out.push(r.enhcObo ? 'No hole card (lose original bet only)' : 'No hole card (dealer blackjack takes doubles and splits)');
  if (r.variant === 'de') out.push(r.deTiesLose ? (r.dePlayerBjWinsTie ? 'Dealer wins ties, except your blackjack' : 'Dealer wins all ties') : 'Ties push');
  out.push(`${Math.round(r.penetration * 100)}% penetration`);
  out.push(r.dealing === 'pitch' ? 'Player cards dealt face down' : 'All cards dealt face up');
  return out;
}

// --- card helpers shared by engine and UI ---------------------------------

export const UPCARDS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

// Engine rank (1..10) -> chart key ('A', '2'..'10').
export function rankKey(rank) { return rank === 1 ? 'A' : String(rank); }
// Chart key -> engine rank.
export function keyRank(key) { return key === 'A' ? 1 : Number(key); }

// Hand total for engine ranks. Returns { total, soft } where soft means an ace
// is being counted as 11.
export function handValue(ranks) {
  let total = 0, aces = 0;
  for (const r of ranks) { total += r; if (r === 1) aces++; }
  let soft = false;
  if (aces && total + 10 <= 21) { total += 10; soft = true; }
  return { total, soft };
}

export function isBlackjack(ranks) {
  return ranks.length === 2 && handValue(ranks).total === 21;
}
