// deviations.js — Hi-Lo index plays: insurance, the Illustrious 18 and the Fab 4
// surrenders, separately for multi-deck (4-8D) S17 and H17 games.
//
// Pure data module (no DOM, no Node APIs). Format: SPEC.md "Contract: deviations".
// Every number is cross-checked in docs/SOURCES.md ("Index cross-check"), where
// each disagreement between sources and the value chosen is written up.
//
// HOW TO READ AN ENTRY (important for the negative indices)
// ---------------------------------------------------------
// The app floors the true count (js/engine/hilo.js TC_ROUNDING = 'floor'), so a
// whole-number TC of n means "the exact TC is in [n, n+1)".
//
// Published indices (Schlesinger, Wizard of Odds, BJA) all use one rule:
//   "stand / double / split / surrender / insure when the TC is AT OR ABOVE the
//    index; below it, hit (or decline)."
// `printed` is that published number. `index` + `when` say the same thing in the
// form decide() evaluates against the floored TC:
//   - when: 'ge'  -> take `action` when TC >= index. Here index === printed.
//   - when: 'le'  -> take `action` when TC <= index. Used when basic strategy is
//                    the aggressive play (stand 13 v 2, surrender 15 v 10) and the
//                    deviation is to HIT when the count drops BELOW the printed
//                    index. "Below -1" on a floored count is "-2 or lower", so
//                    index === printed - 1.
// Example: 13 v 2 (printed -1). Stand at -1 or higher, hit at -2 or lower:
//   { index: -2, when: 'le', action: 'H', otherwise: 'S', printed: -1 }.
// The lessons teach the one rule ("at or above the number: the aggressive play;
// below it: hit"), which is the same thing.
//
// Entries with set: 'basic' are NOT deviations: they record that a famous I18
// play is already basic strategy under this rule set (11 v A is a basic double
// in H17 shoes). decide() and the drills must skip them.
//
// SURRENDER INTERPLAY (late-surrender games)
// While surrender is still allowed (first two cards, not after a split):
//   - a 'fab4' entry for the cell wins (15 v 10: surrender at 0+, hit below 0);
//   - a cell whose basic play is surrender stays surrender unless a fab4 entry
//     says otherwise (16 v 9/10/A; H17 also 15 v A, 17 v A).
// The I18 stand indices for 16 v 10, 15 v 10 and 16 v 9 apply when surrender is
// not available: no-surrender games, after a split, or with 3+ cards.
//
// Insurance entries use table: 'insurance', row: '*', up: 'A'.

const SRC_S17 = ['schlesinger-bja3', 'woo-hilo', 'bja-s17'];
const SRC_H17 = ['bja-h17', 'bjinfo-h17-top50'];

export const DEVIATIONS = {
  // ---------------------------------------------------------------- S17 ---
  // Multi-deck, dealer stands on soft 17. Schlesinger's list as published by
  // the Wizard of Odds (six decks, S17, DAS, LS), cross-checked with BJA's S17
  // chart, rarepike.com and casinonewsdaily.com.
  s17: [
    {
      id: 'insurance', set: 'insurance', rank: 1, table: 'insurance', row: '*', up: 'A',
      index: 3, printed: 3, when: 'ge', action: 'insure', otherwise: 'decline',
      label: 'Take insurance (or even money) at +3 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-16v10', set: 'i18', rank: 2, table: 'hard', row: '16', up: '10',
      index: 0, printed: 0, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 16 vs 10 at 0 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
      note: 'BJA writes 0+ ("any positive running count"), so at a running count of exactly 0 it hits; Schlesinger stands at 0. With surrender available, basic strategy surrenders 16 v 10 instead.',
    },
    {
      id: 'i18-15v10', set: 'i18', rank: 3, table: 'hard', row: '15', up: '10',
      index: 4, printed: 4, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 15 vs 10 at +4 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
      note: 'Only when surrender is not available; with surrender, the Fab 4 play (surrender at 0+) takes over.',
    },
    {
      id: 'i18-TTv5', set: 'i18', rank: 4, table: 'pairs', row: '10', up: '5',
      index: 5, printed: 5, when: 'ge', action: 'P', otherwise: 'S',
      label: 'Split 10s vs 5 at +5 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-TTv6', set: 'i18', rank: 5, table: 'pairs', row: '10', up: '6',
      index: 4, printed: 4, when: 'ge', action: 'P', otherwise: 'S',
      label: 'Split 10s vs 6 at +4 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-10v10', set: 'i18', rank: 6, table: 'hard', row: '10', up: '10',
      index: 4, printed: 4, when: 'ge', action: 'D', otherwise: 'H',
      label: 'Double 10 vs 10 at +4 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-12v3', set: 'i18', rank: 7, table: 'hard', row: '12', up: '3',
      index: 2, printed: 2, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 12 vs 3 at +2 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-12v2', set: 'i18', rank: 8, table: 'hard', row: '12', up: '2',
      index: 3, printed: 3, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 12 vs 2 at +3 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-11vA', set: 'i18', rank: 9, table: 'hard', row: '11', up: 'A',
      index: 1, printed: 1, when: 'ge', action: 'D', otherwise: 'H',
      label: 'Double 11 vs A at +1 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-9v2', set: 'i18', rank: 10, table: 'hard', row: '9', up: '2',
      index: 1, printed: 1, when: 'ge', action: 'D', otherwise: 'H',
      label: 'Double 9 vs 2 at +1 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-10vA', set: 'i18', rank: 11, table: 'hard', row: '10', up: 'A',
      index: 4, printed: 4, when: 'ge', action: 'D', otherwise: 'H',
      label: 'Double 10 vs A at +4 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-9v7', set: 'i18', rank: 12, table: 'hard', row: '9', up: '7',
      index: 3, printed: 3, when: 'ge', action: 'D', otherwise: 'H',
      label: 'Double 9 vs 7 at +3 or higher',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-16v9', set: 'i18', rank: 13, table: 'hard', row: '16', up: '9',
      index: 5, printed: 5, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 16 vs 9 at +5 or higher',
      sources: ['schlesinger-bja3', 'woo-hilo', 'rarepike-i18', 'cnd-i18'],
      note: 'BJA\'s S17 chart prints +4; Schlesinger, the Wizard of Odds, rarepike and casinonewsdaily print +5 (chosen). With surrender available, basic strategy surrenders 16 v 9.',
    },
    {
      id: 'i18-13v2', set: 'i18', rank: 14, table: 'hard', row: '13', up: '2',
      index: -2, printed: -1, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 13 vs 2 below −1 (at −2 or lower)',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
      note: 'BJA prints "−1−" (hit at −1 and below). Read as exact counts, both put the switch at −1; on a floored count, standing at −1 itself is Schlesinger\'s published rule.',
    },
    {
      id: 'i18-12v4', set: 'i18', rank: 15, table: 'hard', row: '12', up: '4',
      index: -1, printed: 0, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 12 vs 4 below 0 (at −1 or lower)',
      sources: [...SRC_S17, 'rarepike-i18', 'cnd-i18'],
    },
    {
      id: 'i18-12v5', set: 'i18', rank: 16, table: 'hard', row: '12', up: '5',
      index: -3, printed: -2, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 12 vs 5 below −2 (at −3 or lower)',
      sources: ['schlesinger-bja3', 'woo-hilo', 'rarepike-i18', 'cnd-i18'],
      note: 'Not on BJA\'s chart (it leaves out the three lowest-value negative plays).',
    },
    {
      id: 'i18-12v6', set: 'i18', rank: 17, table: 'hard', row: '12', up: '6',
      index: -2, printed: -1, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 12 vs 6 below −1 (at −2 or lower)',
      sources: ['schlesinger-bja3', 'woo-hilo', 'rarepike-i18', 'cnd-i18'],
      note: 'Not on BJA\'s chart.',
    },
    {
      id: 'i18-13v3', set: 'i18', rank: 18, table: 'hard', row: '13', up: '3',
      index: -3, printed: -2, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 13 vs 3 below −2 (at −3 or lower)',
      sources: ['schlesinger-bja3', 'woo-hilo', 'rarepike-i18', 'cnd-i18'],
      note: 'Not on BJA\'s chart.',
    },

    // Fab 4 — late surrender only.
    {
      id: 'fab4-14v10', set: 'fab4', rank: 1, table: 'hard', row: '14', up: '10',
      index: 3, printed: 3, when: 'ge', action: 'R', otherwise: 'H',
      label: 'Surrender 14 vs 10 at +3 or higher',
      sources: ['schlesinger-bja3', 'woo-hilo'],
      note: 'Not on BJA\'s S17 chart. A hard 14 that is not a pair of 7s.',
    },
    {
      id: 'fab4-15v10', set: 'fab4', rank: 2, table: 'hard', row: '15', up: '10',
      index: -1, printed: 0, when: 'le', action: 'H', otherwise: 'R',
      label: 'Surrender 15 vs 10 at 0 or higher; below 0 (at −1 or lower), hit',
      sources: ['schlesinger-bja3', 'woo-hilo', 'bja-s17'],
    },
    {
      id: 'fab4-15v9', set: 'fab4', rank: 3, table: 'hard', row: '15', up: '9',
      index: 2, printed: 2, when: 'ge', action: 'R', otherwise: 'H',
      label: 'Surrender 15 vs 9 at +2 or higher',
      sources: ['schlesinger-bja3', 'woo-hilo', 'bja-s17'],
    },
    {
      id: 'fab4-15vA', set: 'fab4', rank: 4, table: 'hard', row: '15', up: 'A',
      index: 1, printed: 1, when: 'ge', action: 'R', otherwise: 'H',
      label: 'Surrender 15 vs A at +1 or higher',
      sources: ['schlesinger-bja3', 'woo-hilo'],
      note: 'BJA\'s S17 chart prints +2; Schlesinger and the Wizard of Odds print +1 (chosen).',
    },
  ],

  // ---------------------------------------------------------------- H17 ---
  // Multi-deck, dealer hits soft 17. BJA's H17 chart (2018) and a 6D H17 DAS
  // RSA LS list posted on blackjackinfo.com agree on every play they share
  // except 12 v 3. Schlesinger's own H17 table (Blackjack Attack, 3rd ed.) was
  // not available to us; casinonewsdaily.com reports shoe values for the plays
  // H17 moves (11 v A, 10 v A, 12 v 6).
  h17: [
    {
      id: 'insurance', set: 'insurance', rank: 1, table: 'insurance', row: '*', up: 'A',
      index: 3, printed: 3, when: 'ge', action: 'insure', otherwise: 'decline',
      label: 'Take insurance (or even money) at +3 or higher',
      sources: [...SRC_H17, 'woo-hilo'],
      note: 'The insurance decision does not depend on the soft-17 rule.',
    },
    {
      id: 'i18-16v10', set: 'i18', rank: 2, table: 'hard', row: '16', up: '10',
      index: 0, printed: 0, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 16 vs 10 at 0 or higher',
      sources: [...SRC_H17],
      note: 'With surrender available, basic strategy surrenders 16 v 10 instead.',
    },
    {
      id: 'i18-15v10', set: 'i18', rank: 3, table: 'hard', row: '15', up: '10',
      index: 4, printed: 4, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 15 vs 10 at +4 or higher',
      sources: [...SRC_H17],
      note: 'Only when surrender is not available; with surrender, the Fab 4 play takes over.',
    },
    {
      id: 'i18-TTv5', set: 'i18', rank: 4, table: 'pairs', row: '10', up: '5',
      index: 5, printed: 5, when: 'ge', action: 'P', otherwise: 'S',
      label: 'Split 10s vs 5 at +5 or higher',
      sources: [...SRC_H17],
    },
    {
      id: 'i18-TTv6', set: 'i18', rank: 5, table: 'pairs', row: '10', up: '6',
      index: 4, printed: 4, when: 'ge', action: 'P', otherwise: 'S',
      label: 'Split 10s vs 6 at +4 or higher',
      sources: [...SRC_H17, 'cnd-i18'],
    },
    {
      id: 'i18-10v10', set: 'i18', rank: 6, table: 'hard', row: '10', up: '10',
      index: 4, printed: 4, when: 'ge', action: 'D', otherwise: 'H',
      label: 'Double 10 vs 10 at +4 or higher',
      sources: [...SRC_H17],
    },
    {
      id: 'i18-12v3', set: 'i18', rank: 7, table: 'hard', row: '12', up: '3',
      index: 2, printed: 2, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 12 vs 3 at +2 or higher',
      sources: ['bja-h17', 'cnd-i18', 'woo-hilo'],
      note: 'The blackjackinfo H17 list prints +1; BJA, casinonewsdaily (shoe) and the S17 value are +2 (chosen).',
    },
    {
      id: 'i18-12v2', set: 'i18', rank: 8, table: 'hard', row: '12', up: '2',
      index: 3, printed: 3, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 12 vs 2 at +3 or higher',
      sources: [...SRC_H17],
    },
    {
      id: 'i18-11vA', set: 'basic', rank: 9, table: 'hard', row: '11', up: 'A',
      index: null, printed: null, when: null, action: 'D', otherwise: 'D',
      label: 'Double 11 vs A at every count: in H17 shoes it is already basic strategy',
      sources: ['bja-h17', 'bjinfo-h17-top50', 'cnd-i18', 'bjinfo-11vA'],
      note: 'BJA\'s H17 chart doubles at every count. Some lists add a reverse index (hit below 0: casinonewsdaily and a blackjackinfo reply; below −1: the blackjackinfo H17 list; the engine\'s linear-model break-even is about −1.1). It is worth very little; we follow BJA and keep it basic.',
    },
    {
      id: 'i18-9v2', set: 'i18', rank: 10, table: 'hard', row: '9', up: '2',
      index: 1, printed: 1, when: 'ge', action: 'D', otherwise: 'H',
      label: 'Double 9 vs 2 at +1 or higher',
      sources: [...SRC_H17],
    },
    {
      id: 'i18-10vA', set: 'i18', rank: 11, table: 'hard', row: '10', up: 'A',
      index: 3, printed: 3, when: 'ge', action: 'D', otherwise: 'H',
      label: 'Double 10 vs A at +3 or higher',
      sources: [...SRC_H17, 'cnd-i18'],
      note: 'One lower than the S17 index (+4).',
    },
    {
      id: 'i18-9v7', set: 'i18', rank: 12, table: 'hard', row: '9', up: '7',
      index: 3, printed: 3, when: 'ge', action: 'D', otherwise: 'H',
      label: 'Double 9 vs 7 at +3 or higher',
      sources: [...SRC_H17],
    },
    {
      id: 'i18-16v9', set: 'i18', rank: 13, table: 'hard', row: '16', up: '9',
      index: 5, printed: 5, when: 'ge', action: 'S', otherwise: 'H',
      label: 'Stand 16 vs 9 at +5 or higher',
      sources: ['schlesinger-bja3', 'woo-hilo', 'cnd-i18', 'engine-linear'],
      note: 'BJA and the blackjackinfo H17 list print +4, but BJA prints +4 in its S17 chart too: it is a source difference, not a rule effect. The soft-17 rule barely touches a dealer 9 (the engine\'s break-even is the same, about +5.6, under S17 and H17), so we keep Schlesinger\'s +5 for both. With surrender available, basic strategy surrenders 16 v 9.',
    },
    {
      id: 'i18-13v2', set: 'i18', rank: 14, table: 'hard', row: '13', up: '2',
      index: -2, printed: -1, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 13 vs 2 below −1 (at −2 or lower)',
      sources: [...SRC_H17],
    },
    {
      id: 'i18-12v4', set: 'i18', rank: 15, table: 'hard', row: '12', up: '4',
      index: -1, printed: 0, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 12 vs 4 below 0 (at −1 or lower)',
      sources: [...SRC_H17],
    },
    {
      id: 'i18-12v5', set: 'i18', rank: 16, table: 'hard', row: '12', up: '5',
      index: -3, printed: -2, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 12 vs 5 below −2 (at −3 or lower)',
      sources: ['cnd-i18', 'woo-hilo'],
      note: 'No H17-specific second source; casinonewsdaily lists −2 for shoes with no H17 change, and the engine\'s linear-model break-even is −2.0 under H17. S17 value kept.',
    },
    {
      id: 'i18-12v6', set: 'i18', rank: 17, table: 'hard', row: '12', up: '6',
      index: -4, printed: -3, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 12 vs 6 below −3 (at −4 or lower)',
      sources: ['cnd-i18', 'bjtrainer-fyi', 'engine-linear'],
      note: 'Medium confidence. casinonewsdaily (shoe, H17) and blackjacktrainer.fyi give −3, a blackjackinfo thread says H17 moves this play "a lot", and the engine\'s linear-model break-even is about −3.8 (−1.25 under S17). In H17 the dealer busts a 6 more often, so standing on 12 stays right at lower counts.',
    },
    {
      id: 'i18-13v3', set: 'i18', rank: 18, table: 'hard', row: '13', up: '3',
      index: -3, printed: -2, when: 'le', action: 'H', otherwise: 'S',
      label: 'Hit 13 vs 3 below −2 (at −3 or lower)',
      sources: ['cnd-i18', 'woo-hilo'],
      note: 'Low confidence for H17: no H17-specific second source; S17 value kept. The engine\'s linear-model break-even is about −2.9 under H17 (−2.5 under S17), so −3 is plausible.',
    },

    // Fab 4 — late surrender only.
    {
      id: 'fab4-14v10', set: 'fab4', rank: 1, table: 'hard', row: '14', up: '10',
      index: 3, printed: 3, when: 'ge', action: 'R', otherwise: 'H',
      label: 'Surrender 14 vs 10 at +3 or higher',
      sources: ['bjinfo-h17-top50', 'woo-hilo'],
      note: 'Not on BJA\'s H17 chart. A hard 14 that is not a pair of 7s.',
    },
    {
      id: 'fab4-15v10', set: 'fab4', rank: 2, table: 'hard', row: '15', up: '10',
      index: -1, printed: 0, when: 'le', action: 'H', otherwise: 'R',
      label: 'Surrender 15 vs 10 at 0 or higher; below 0 (at −1 or lower), hit',
      sources: [...SRC_H17],
    },
    {
      id: 'fab4-15v9', set: 'fab4', rank: 3, table: 'hard', row: '15', up: '9',
      index: 2, printed: 2, when: 'ge', action: 'R', otherwise: 'H',
      label: 'Surrender 15 vs 9 at +2 or higher',
      sources: [...SRC_H17],
    },
    {
      id: 'fab4-15vA', set: 'fab4', rank: 4, table: 'hard', row: '15', up: 'A',
      index: -2, printed: -1, when: 'le', action: 'H', otherwise: 'R',
      label: 'Surrender 15 vs A at −1 or higher; below −1 (at −2 or lower), hit',
      sources: [...SRC_H17],
      note: 'In H17 shoes surrendering 15 v A is basic strategy, so the index runs the other way from S17 (+1).',
    },
  ],

  // How the indices move in one- and two-deck games. The app uses the
  // multi-deck tables above for every game; these notes are taught, not
  // applied. Sources: docs/SOURCES.md.
  notes: {
    fewDecks: [
      {
        topic: 'insurance',
        text: 'Insurance needs a smaller true count in small games: about +1.4 in a single deck and about +2.4 in a double deck, against +3 in a shoe.',
        sources: ['cnd-i18', 'bjinfo-insurance'],
      },
      {
        topic: 'general',
        text: 'Most of the other I18 indices move by about one count in one- and two-deck games (for example 12 v 2 and 12 v 3 move up, 10 v A and 11 v A move down). Learn the shoe numbers first; the differences cost little.',
        sources: ['cnd-i18'],
      },
    ],
    value: 'Schlesinger ranked the I18 by the gain each adds for a counter who spreads bets; insurance alone is worth about twice the next play (16 v 10). The I18 give roughly 80-85% of the value of every index play in a six-deck game.',
    valueSources: ['bjinfo-i18-right', 'woo-hilo'],
  },
};
