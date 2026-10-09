// shoe.js — shoe compositions: how many cards of each rank are left.
//
// Pure ES module (no DOM, no Node APIs).
//
// A shoe is a plain array of length 11 indexed by engine rank: shoe[1] = aces,
// shoe[2..9] = twos..nines, shoe[10] = all ten-value cards. shoe[0] is unused
// (always 0) so a rank indexes its own count directly. Six decks are
// [0, 24, 24, 24, 24, 24, 24, 24, 24, 24, 96].
//
// Counts are normally integers. `shoeAtTrueCount` builds a fractional shoe for
// the index cross-check; every probability routine in the engine accepts
// fractional counts (a falling factorial of 12.4 is still well defined).

export const RANKS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

export function fullShoe(decks) {
  const s = new Array(11).fill(0);
  for (let r = 1; r <= 9; r++) s[r] = 4 * decks;
  s[10] = 16 * decks;
  return s;
}

export function shoeSize(shoe) {
  let n = 0;
  for (let r = 1; r <= 10; r++) n += shoe[r];
  return n;
}

// New shoe with `ranks` taken out. Throws if a rank is not available, which
// always means a bug in the caller (an impossible hand for this shoe).
export function removeCards(shoe, ranks) {
  const s = shoe.slice();
  for (const r of ranks) {
    if (!(s[r] >= 1 - 1e-9)) throw new Error(`No ${r} left in the shoe`);
    s[r] -= 1;
  }
  return s;
}

export function addCards(shoe, ranks) {
  const s = shoe.slice();
  for (const r of ranks) s[r] += 1;
  return s;
}

// Probability that the next card is `rank`.
export function cardProb(shoe, rank) {
  return shoe[rank] / shoeSize(shoe);
}

// Probability of being dealt the unordered pair {a, b} as the next two cards.
export function pairProb(shoe, a, b) {
  const n = shoeSize(shoe);
  if (a === b) return (shoe[a] * (shoe[a] - 1)) / (n * (n - 1));
  return (2 * shoe[a] * shoe[b]) / (n * (n - 1));
}

// Hi-Lo running count of the cards that are NOT in `shoe` (i.e. already dealt)
// relative to a full shoe of `decks`. Positive = rich in tens and aces.
export function hiloRunningCountOf(shoe, decks) {
  const full = fullShoe(decks);
  let rc = 0;
  for (let r = 2; r <= 6; r++) rc += full[r] - shoe[r];
  rc -= (full[1] - shoe[1]) + (full[10] - shoe[10]);
  return rc;
}

// A representative shoe at a Hi-Lo true count: `decksRemaining` decks are left
// (52 * decksRemaining cards) and the cards already dealt carried a running
// count of tc * decksRemaining. The dealt cards are assumed to be spread evenly
// inside each Hi-Lo group (2-6, 7-9, T-A) — the usual "linear" model used when
// estimating index numbers. The result has fractional counts.
//
// With RC = tc * D dealt, the remaining D decks hold tc*D/2 more high cards and
// tc*D/2 fewer low cards than a neutral D-deck shoe; the neutral 7-9 group is
// untouched. Within the high group, tens and aces keep their 16:4 ratio.
export function shoeAtTrueCount(tc, decksRemaining) {
  const d = decksRemaining;
  const shift = (tc * d) / 2; // extra high cards (= missing low cards)
  const s = new Array(11).fill(0);
  for (let r = 2; r <= 6; r++) s[r] = 4 * d - shift / 5;
  for (let r = 7; r <= 9; r++) s[r] = 4 * d;
  s[10] = 16 * d + shift * (16 / 20);
  s[1] = 4 * d + shift * (4 / 20);
  for (let r = 1; r <= 10; r++) if (s[r] < 0) throw new Error(`True count ${tc} is impossible with ${d} decks left`);
  return s;
}
