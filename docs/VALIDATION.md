# Validation of the strategy engine

The charts, EVs and house edges in Shoe School are computed by the app's own
engine (`js/engine/`). This file records how they were checked against published
sources, and every place they disagree. Nothing published was copied over an
engine result. Where the engine was wrong, it was fixed (see "Engine bugs found by
this validation").

Validated on 2026-10-08 against the engine as committed with this file. The facts
below are locked in by `test/engine.test.mjs` (`node --test`).

## Summary

| Check | Result |
|---|---|
| Chart cells vs the Wizard of Odds tables, 80 rule sets × 360 cells | **28,787 / 28,800 match.** The 13 differences are written up below: 12 are no-hole-card surrender cells in 1-2 deck games, 1 is a DAS split the published table cannot express. |
| Charts the app ships (`js/data/charts.js`, 44 classic charts) | All match the published tables except that one DAS cell. |
| House edge, total-dependent basic strategy, 60 rule sets | Max \|engine − published\| **0.0075%**, mean 0.0015% |
| House edge, composition-dependent, 60 rule sets | Max **0.0026%**, mean 0.0009% |
| House edge, 13 other rule variations (resplits, RSA, hit split aces, double restrictions, ENHC/OBO) | Max 0.0027% |
| Rule effects (H17, DAS, LS, decks, ENHC, 6:5) | All within 0.003% |
| Exact two-hand split check | Engine = full enumeration to 5 decimals in 6/6 cases |
| Resplits (Monte Carlo of real resplitting) | 6D: within 0.0003 per split (≤ 0.4 SE); 1D: +0.004 per split |
| Resplit-to-4 vs split-once effect | Engine 0.053% (6D DAS) vs the published calculator's 0.054%. The rule-variations page's 0.10% disagrees with its own site's calculator (section 3). |
| `js/data/deviations.js` through `decide()` | Every I18/Fab 4/insurance entry (S17 and H17) plays `action` at its index and beyond, and `otherwise` one count past it |
| Double Exposure chart vs the published chart | 1,615 / 1,620 at 100 decks (≈ the published chart's assumption). At 8 decks the differences are real card-removal effects. |
| Double Exposure house edge | Grand (Tunica) 0.957% vs published 0.96%; rule effects within 0.03% |
| Hi-Lo index cross-check (I18 + Fab 4, 6D S17 and H17) | 41 of 43 engine crossovers within 1.0 count of the published index, 25 within 0.5. 16 v 10 is +1.3 (two-card hands only). |

**Tolerance.** House edges are compared in percentage points of the initial bet.
The target was 0.03% absolute. Everything in the tables met it with room to spare, so
the tests pin tighter limits (0.005% for composition-dependent edges, 0.002% for
the default game).

## Sources

* **Wizard of Odds, Blackjack Basic Strategy calculator**
  <https://wizardofodds.com/games/blackjack/strategy/calculator/>. Its six tables
  (1 deck, 2 decks, 4+ decks, each S17/H17), with European no-hole-card columns
  for dealer 10 and A, are embedded in the page as data. They were read cell by
  cell, and the tests hold a verbatim copy. One table covers both DAS and no-DAS games via
  "split if DAS, else hit/double/stand" codes, and both surrender and no surrender.
  One "4+ decks" table covers 4, 6 and 8 decks.
* **Wizard of Odds, Blackjack House Edge calculator**
  <https://wizardofodds.com/games/blackjack/calculator/>. A table of 3,456 rule
  combinations (decks 1/2/4/5/6/8 × S17/H17 × DAS × doubling 'any'/9-11/10-11 ×
  resplit to 2/3/4 × RSA × hit split aces × original-bets-only × surrender), plus
  6:5 adjustments. Its methodology note: "optimal" = perfect composition-dependent
  strategy, shuffled every hand. "Basic strategy with continuous shuffler" =
  total-dependent basic strategy = optimal + a per-deck-count constant (1D +0.0387,
  2D +0.014, 4D +0.0055, 6D +0.0031, 8D +0.0019).
* **Wizard of Odds, Double Exposure** <https://wizardofodds.com/games/double-exposure/>
  and its H17 appendix <https://wizardofodds.com/games/double-exposure/appendix/1/>.
  The rules, rule effects, casino examples with house edges, and the S17/H17
  strategy charts (images, transcribed by hand).
* **Hi-Lo indices** from `js/data/deviations.js` (the `printed` values; their
  sources are in `docs/SOURCES.md`).

Published charts and numbers are data to check against. The engine never reads them.

## How the engine computes (in one paragraph)

`dealer.js` enumerates once, for every dealer starting hand, each multiset of cards
the dealer can finish with and how many valid orderings reach it. Evaluating any
shoe is then a sum of falling-factorial products, so the result is exact with depletion.
`ev.js` computes player EVs for every hand with real card removal, memoised on the
player's card multiset. A peek game (A or 10 up) is handled exactly with
unnormalised values, U = E[outcome · 1{no dealer BJ}] (see the `ev.js` header).
`strategy.js` averages each action's EV over the two-card hands behind a chart
row, weighted by their probability. Pairs are left out of hard rows. It then
re-prices the chart with itself played afterwards until it stops changing, which
is the total-dependent fixed point (usually one round). The house edge plays that chart over
every initial deal.

## 1. Strategy charts vs the published charts

**What was compared.** For 1/2/4/6/8 decks × S17/H17 × DAS/no DAS × late
surrender/none × peek/no hole card (80 rule sets; resplit to 4, no RSA, double on
any two cards), every cell of hard 5-21, soft 13-21 and the 10 pairs rows against
dealer 2-A. That is 36 × 10 = 360 cells per rule set. Codes were compared in the vocabulary of the
rule set. For example, the published "QH" (split if DAS, else hit) is a split in a DAS
game and a hit otherwise. The engine's `Ph` is a split in a DAS chart. "RH" is a
surrender with late surrender, else a hit.

**Result: 28,787 of 28,800 cells match.** All 4-, 6- and 8-deck rule sets (with and
without a hole card) match in every cell. That includes the default
preset (6D H17 DAS LS) and every chart in `js/data/charts.js` but one.

### Every disagreement

EV gap = how much better the engine's play is than the published play, per unit
bet, by the engine's EVs.

| Rule set | Cell | Engine | Published | EV gap | Diagnosis |
|---|---|---|---|---|---|
| 2D H17 DAS LS (peek) | 8,8 v A | P | Rp | +0.0035 | Source format (see below) |
| 1D S17 DAS LS, no hole card | hard 14 v 10 | H | Rh | +0.0043 | ENHC surrender (see below) |
| 1D S17 DAS LS, no hole card | 2,2 v A | Rh | H | +0.0009 | ENHC surrender |
| 1D S17 noDAS LS, no hole card | hard 14 v 10 | H | Rh | +0.0043 | ENHC surrender |
| 1D S17 noDAS LS, no hole card | 2,2 v A | Rh | H | +0.0009 | ENHC surrender |
| 1D H17 DAS LS, no hole card | hard 8 v A | Rh | H | +0.0144 | ENHC surrender |
| 1D H17 DAS LS, no hole card | hard 14 v 10 | H | Rh | +0.0043 | ENHC surrender |
| 1D H17 DAS LS, no hole card | 4,4 v A | Rh | H | +0.0065 | ENHC surrender |
| 1D H17 noDAS LS, no hole card | hard 8 v A | Rh | H | +0.0144 | ENHC surrender |
| 1D H17 noDAS LS, no hole card | hard 14 v 10 | H | Rh | +0.0043 | ENHC surrender |
| 1D H17 noDAS LS, no hole card | 4,4 v A | Rh | H | +0.0065 | ENHC surrender |
| 2D H17 DAS LS, no hole card | hard 8 v A | Rh | H | +0.0019 | ENHC surrender |
| 2D H17 noDAS LS, no hole card | hard 8 v A | Rh | H | +0.0019 | ENHC surrender |

**8,8 v A, 2 decks, H17, DAS, late surrender: source format, not an engine bug.**
Engine EVs: split −0.4965, surrender −0.5000, hit −0.5313. Without DAS, splitting
is worth −0.5030, so the no-DAS chart says Rp, and the engine's no-DAS chart matches
the published cell. The published table serves DAS and no-DAS games at once. For this cell it
would need a code meaning "surrender without DAS, split with DAS", which it does not have. With
splitting limited to two hands the split is still −0.4995, better than surrender. That
two-hand split value is exact, not an approximation (section 3). The engine keeps P
and the test suite records the cell as a documented difference.

**No-hole-card games with surrender, 1-2 decks: the published European columns
use a different surrender model.** No published European chart is an engine bug:
the 4-8 deck European columns match in every cell, with surrender too. In a
no-hole-card game you surrender before the dealer's second card exists, so the engine values
surrender at exactly −0.5. A later dealer blackjack does not cost the other half. This is
the convention the same Wizard tables use: they surrender hard 5-7 vs A, which is
only right under it. In 1-2 decks the published cells disagree with exact EVs:

* The engine was checked with an independent brute-force calculator: naive
  recursion, exact removal, no shared code. For hard 8 vs A, 1 deck, H17, no hole
  card, hitting is worth −0.51372 (2,6) and −0.51395 (3,5); the engine gives −0.51383
  for the row. Surrender (−0.5) is better by 0.014, so `Rh` is right. Likewise 10,4
  v 10 hits for −0.4910, better than surrendering.
* The published single-deck European cells look like they were filled in from the
  multi-deck pattern. In 4+ decks, 8 v A is a hit and 14 v 10 a surrender, and the engine agrees
  there.

None of these rule sets is a preset or in the shipped matrix.

### Engine bugs found by this validation (fixed)

1. **Forced resplits.** The first version always resplit when another pair card
   arrived. Single deck, H17, DAS, 9,9 v A: resplitting 9s vs A is slightly wrong
   (stand on 18 instead), and forcing it pulled the split EV below standing
   (−0.18780 vs −0.18613). The engine then disagreed with the published "split if
   DAS". Resplitting is now optional: the best hand limit from 2 to the maximum is
   taken. The split is worth −0.18597 and the cell matches.
2. **Deviation entries written as "hit below the index, else surrender"** (how
   `deviations.js` encodes 15 v 10 and H17 15 v A) were not recognised as surrender
   entries by `decide()`. Fixed: an entry whose `action` or `otherwise` is `R` is a
   surrender entry. Tested with both spellings.

### What the chart does with rows that have no plain two-card hand

* Hard 4 and hard 20 exist only as 2,2 and T,T. Those rows price the pair played
  unsplit (what you do when you can no longer split). Soft 12 is A,A unsplit.
* Hard 21 is priced from three-card hands; soft 21 is A,T as a plain 21 (after a split).
  Both are always S. These rows price only stand and hit.
* `Ph` is used only when the split is best with DAS and **hitting** would be best
  without it. When losing DAS would make the best play a double or a stand
  (single-deck 4,4 v 5: published "QD"), the DAS chart says `P`. The no-DAS chart
  shows the right play (here `D`), and the tests check both.

### Composition-dependent exceptions (documented, not applied)

The app teaches the total-dependent chart, and `decide()` plays multi-card hands by
total. For reference, the engine finds these two-card exceptions in the 6-deck
presets (gain per unit bet):

* 6D H17 DAS LS: 8,7 v 10, hit instead of surrender (+0.0002).
* 6D S17 DAS LS: 10,2 v 4, hit (+0.0008), and 8,7 v 10, hit instead of surrender (+0.0002).

Three-card hard 16 v 10 (6D, no surrender left): standing beats hitting with
4,5,7 (+0.0068), 4,4,8 (+0.0044), 3,5,8 (+0.0041), 5,5,6 (+0.0041), 2,5,9 (+0.0023),
3,4,9 (+0.0018), A,5,T (+0.0017), 2,7,7 (+0.0011), A,7,8 (+0.0004) and 2,4,T (+0.0001).
That is the well-known "stand on a multi-card 16 vs 10".

## 2. House edge

`houseEdge(rules)` plays the chart (total-dependent) over every initial deal:
dealer upcard × the player's two cards. It pays naturals at `bjPays` unless the dealer also
has one, uses no insurance, and shuffles after each round. `chart.houseEdgeCD` is the same
enumeration with perfect composition-dependent play. For like-for-like comparisons:
engine TD vs published "basic strategy, continuous shuffler", and engine CD vs
published "optimal".

### Absolute house edges (%; + = house; 3:2; resplit to 4, no RSA)

| Rules | Engine TD | Published BS | Δ | Engine CD | Published optimal | Δ |
|---|---|---|---|---|---|---|
| 1D S17 DAS NS | -0.142 | -0.144 | +0.0022 | -0.181 | -0.183 | +0.0020 |
| 1D S17 DAS NS ENHC | -0.030 | -0.037 | +0.0064 | -0.073 | -0.075 | +0.0020 |
| 1D S17 DAS LS | -0.159 | -0.166 | +0.0075 | -0.203 | -0.205 | +0.0020 |
| 1D S17 noDAS NS | -0.002 | -0.003 | +0.0009 | -0.041 | -0.042 | +0.0009 |
| 1D S17 noDAS NS ENHC | 0.108 | 0.103 | +0.0050 | 0.065 | 0.064 | +0.0008 |
| 1D S17 noDAS LS | -0.019 | -0.025 | +0.0061 | -0.063 | -0.064 | +0.0009 |
| 1D H17 DAS NS | 0.046 | 0.046 | -0.0003 | 0.010 | 0.008 | +0.0026 |
| 1D H17 DAS NS ENHC | 0.164 | 0.160 | +0.0041 | 0.124 | 0.121 | +0.0025 |
| 1D H17 DAS LS | 0.015 | 0.008 | +0.0063 | -0.028 | -0.030 | +0.0026 |
| 1D H17 noDAS NS | 0.189 | 0.190 | -0.0018 | 0.153 | 0.152 | +0.0011 |
| 1D H17 noDAS NS ENHC | 0.304 | 0.302 | +0.0026 | 0.264 | 0.263 | +0.0011 |
| 1D H17 noDAS LS | 0.157 | 0.152 | +0.0049 | 0.115 | 0.114 | +0.0011 |
| 2D S17 DAS NS | 0.195 | 0.192 | +0.0023 | 0.180 | 0.178 | +0.0020 |
| 2D S17 DAS NS ENHC | 0.303 | 0.299 | +0.0035 | 0.287 | 0.285 | +0.0020 |
| 2D S17 DAS LS | 0.146 | 0.141 | +0.0050 | 0.129 | 0.127 | +0.0020 |
| 2D S17 noDAS NS | 0.336 | 0.335 | +0.0012 | 0.322 | 0.321 | +0.0011 |
| 2D S17 noDAS NS ENHC | 0.443 | 0.440 | +0.0024 | 0.428 | 0.426 | +0.0011 |
| 2D S17 noDAS LS | 0.288 | 0.284 | +0.0038 | 0.271 | 0.270 | +0.0011 |
| 2D H17 DAS NS | 0.393 | 0.394 | -0.0004 | 0.382 | 0.380 | +0.0022 |
| 2D H17 DAS NS ENHC | 0.508 | 0.506 | +0.0014 | 0.495 | 0.492 | +0.0022 |
| 2D H17 DAS LS | 0.330 | 0.328 | +0.0026 | 0.316 | 0.314 | +0.0022 |
| 2D H17 noDAS NS | 0.538 | 0.539 | -0.0016 | 0.526 | 0.525 | +0.0011 |
| 2D H17 noDAS NS ENHC | 0.650 | 0.650 | +0.0002 | 0.637 | 0.636 | +0.0011 |
| 2D H17 noDAS LS | 0.474 | 0.473 | +0.0013 | 0.460 | 0.459 | +0.0011 |
| 4D S17 DAS NS | 0.354 | 0.353 | +0.0011 | 0.349 | 0.347 | +0.0010 |
| 4D S17 DAS NS ENHC | 0.465 | 0.463 | +0.0020 | 0.458 | 0.457 | +0.0011 |
| 4D S17 DAS LS | 0.288 | 0.286 | +0.0017 | 0.282 | 0.281 | +0.0010 |
| 4D S17 noDAS NS | 0.496 | 0.495 | +0.0004 | 0.490 | 0.490 | +0.0004 |
| 4D S17 noDAS NS ENHC | 0.604 | 0.603 | +0.0013 | 0.598 | 0.598 | +0.0004 |
| 4D S17 noDAS LS | 0.429 | 0.428 | +0.0010 | 0.423 | 0.423 | +0.0004 |
| 4D H17 DAS NS | 0.563 | 0.563 | +0.0001 | 0.558 | 0.557 | +0.0011 |
| 4D H17 DAS NS ENHC | 0.675 | 0.674 | +0.0010 | 0.670 | 0.669 | +0.0011 |
| 4D H17 DAS LS | 0.481 | 0.481 | +0.0007 | 0.476 | 0.475 | +0.0010 |
| 4D H17 noDAS NS | 0.707 | 0.708 | -0.0006 | 0.702 | 0.702 | +0.0004 |
| 4D H17 noDAS NS ENHC | 0.818 | 0.817 | +0.0003 | 0.812 | 0.812 | +0.0004 |
| 4D H17 noDAS LS | 0.625 | 0.625 | -0.0000 | 0.620 | 0.620 | +0.0004 |
| 6D S17 DAS NS | 0.407 | 0.406 | +0.0005 | 0.404 | 0.403 | +0.0005 |
| 6D S17 DAS NS ENHC | 0.518 | 0.517 | +0.0011 | 0.515 | 0.514 | +0.0006 |
| 6D S17 DAS LS | 0.334 | 0.334 | +0.0004 | 0.331 | 0.331 | +0.0005 |
| 6D S17 noDAS NS | 0.548 | 0.548 | +0.0001 | 0.545 | 0.545 | +0.0001 |
| 6D S17 noDAS NS ENHC | 0.658 | 0.657 | +0.0006 | 0.654 | 0.654 | +0.0002 |
| 6D S17 noDAS LS | 0.475 | 0.475 | -0.0001 | 0.472 | 0.472 | +0.0001 |
| 6D H17 DAS NS | 0.619 | 0.619 | +0.0002 | 0.616 | 0.616 | +0.0005 |
| 6D H17 DAS NS ENHC | 0.731 | 0.730 | +0.0008 | 0.728 | 0.727 | +0.0006 |
| **6D H17 DAS LS (default)** | **0.531** | **0.531** | +0.0001 | 0.528 | 0.527 | +0.0005 |
| 6D H17 noDAS NS | 0.763 | 0.763 | -0.0002 | 0.760 | 0.760 | +0.0001 |
| 6D H17 noDAS NS ENHC | 0.873 | 0.873 | +0.0004 | 0.870 | 0.870 | +0.0002 |
| 6D H17 noDAS LS | 0.675 | 0.675 | -0.0004 | 0.672 | 0.672 | +0.0001 |
| 8D S17 DAS NS | 0.433 | 0.433 | +0.0002 | 0.431 | 0.431 | +0.0002 |
| 8D S17 DAS NS ENHC | 0.545 | 0.545 | +0.0007 | 0.543 | 0.543 | +0.0003 |
| 8D S17 DAS LS | 0.357 | 0.357 | +0.0001 | 0.355 | 0.355 | +0.0002 |
| 8D S17 noDAS NS | 0.574 | 0.574 | -0.0001 | 0.572 | 0.572 | -0.0001 |
| 8D S17 noDAS NS ENHC | 0.685 | 0.684 | +0.0004 | 0.682 | 0.682 | +0.0000 |
| 8D S17 noDAS LS | 0.498 | 0.499 | -0.0002 | 0.497 | 0.497 | -0.0001 |
| 8D H17 DAS NS | 0.647 | 0.647 | +0.0002 | 0.645 | 0.645 | +0.0002 |
| 8D H17 DAS NS ENHC | 0.759 | 0.758 | +0.0007 | 0.757 | 0.756 | +0.0003 |
| 8D H17 DAS LS | 0.555 | 0.555 | +0.0001 | 0.554 | 0.553 | +0.0002 |
| 8D H17 noDAS NS | 0.791 | 0.791 | -0.0001 | 0.789 | 0.789 | -0.0001 |
| 8D H17 noDAS NS ENHC | 0.901 | 0.901 | +0.0004 | 0.899 | 0.899 | +0.0000 |
| 8D H17 noDAS LS | 0.699 | 0.699 | -0.0002 | 0.697 | 0.698 | -0.0001 |

The engine's composition-dependent edge runs at most 0.0026% above the published one,
largest in 1-2 decks with resplits. That is the resplit approximation (section 3). The
TD column is compared against the published "optimal + per-deck-count constant",
which is itself an approximation in 1-2 decks. That explains its larger (still
≤ 0.0075%) gaps there.

### Other rule variations (composition-dependent, vs published optimal)

| Rules (6D S17 DAS NS resplit to 4 unless stated) | Engine | Published | Δ |
|---|---|---|---|
| baseline | 0.4036 | 0.4031 | +0.0005 |
| double 9-11 only | 0.4997 | 0.4992 | +0.0005 |
| double 10-11 only | 0.5956 | 0.5952 | +0.0004 |
| split once (2 hands) | 0.4569 | 0.4569 | -0.0000 |
| resplit to 3 hands | 0.4113 | 0.4118 | -0.0004 |
| resplit aces | 0.3350 | 0.3346 | +0.0005 |
| hit split aces | 0.2162 | 0.2157 | +0.0005 |
| RSA + hit split aces | 0.1575 | 0.1569 | +0.0006 |
| no hole card, lose doubles/splits | 0.5148 | 0.5142 | +0.0006 |
| no hole card, original bets only | 0.4036 | 0.4031 | +0.0005 |
| 1D H17 noDAS 9-11 split once | 0.3141 | 0.3144 | -0.0004 |
| 2D S17 DAS 10-11 RSA | 0.3556 | 0.3529 | +0.0027 |
| 8D H17 noDAS LS, original bets only | 0.6975 | 0.6976 | -0.0001 |

"Double 9-11 / 10-11" are hard totals only in the engine (`ev.js`
`doubleAllowedFor`: A,8 is a soft 19, not "a 9"). The match confirms the published
table uses the same reading.

### Rule effects (percentage points; baseline 6D S17 DAS NS)

| Rule change | Engine TD | Published BS | Engine CD | Published optimal |
|---|---|---|---|---|
| Dealer hits soft 17 | +0.212 | +0.213 | +0.213 | +0.213 |
| No double after split | +0.141 | +0.142 | +0.141 | +0.142 |
| Late surrender (S17) | -0.073 | -0.073 | -0.073 | -0.073 |
| Late surrender (H17) | -0.088 | -0.088 | -0.088 | -0.088 |
| 8 decks instead of 6 | +0.026 | +0.027 | +0.028 | +0.028 |
| 4 decks instead of 6 | -0.053 | -0.053 | -0.055 | -0.056 |
| 2 decks instead of 6 | -0.212 | -0.214 | -0.223 | -0.225 |
| 1 deck instead of 6 | -0.549 | -0.550 | -0.585 | -0.586 |
| No hole card (ENHC) | +0.112 | +0.111 | +0.111 | +0.111 |

Blackjack paying 6:5 instead of 3:2: engine +1.395 / +1.373 / +1.360 / +1.358 for
1 / 2 / 6 / 8 decks. Published: +1.394773 / +1.373499 / +1.359690 / +1.357984.

**6:5 and the shared chart.** The chart key leaves out the payout, so a 3:2 and a 6:5 game
share a chart. Each chart stores its edge at 3:2 plus `pBlackjackNoDealerBj`, the chance
of a paid natural. `houseEdge(rules)` = `chart.houseEdge − (bjPays − 1.5) ×
pBlackjackNoDealerBj × 100`. That is exact, because the payout changes no decision.

### No hole card + late surrender: the published house-edge table uses another model

The engine values surrender in a no-hole-card game at −0.5 even if the dealer then
makes blackjack, as the published European strategy tables do (section 1). Under
that model surrender is effectively early surrender, worth about 0.5-0.6% in a 6D
game. The engine gives −0.12% for 6D S17 DAS LS ENHC. The published house-edge table
instead credits late surrender with about the same value as in a peek game. Its
6D S17 DAS figure goes from 0.514% to 0.435%, so it evidently assumes a dealer
blackjack still takes a surrendered bet. The two Wizard pages disagree with
each other here. The engine follows the strategy tables, which match the physical game. No preset or shipped chart uses this combination. Treat any
house edge for "no hole card + surrender" as early-surrender pricing.

## 3. Splits: how exact is the split EV?

Each split hand is valued on its own: both pair cards are out of the shoe, but the other
hand's later cards are not. **For one split (two hands) this is exact,** provided each
hand is played on its own cards. The dealer's outcome probabilities, as a function of
the remaining shoe, are a martingale as cards are drawn. The other hand stops drawing
by a rule that depends only on its own cards, so by optional stopping its draws do
not change this hand's expected result. By symmetry both hands are worth the same.

Numerical check: a separate script played both hands in full (hand 1, then hand 2
from what is left, then the dealer from what is left after both), with the same
strategy, and compared:

| Case | Full two-hand enumeration | Engine |
|---|---|---|
| 2D H17 8,8 v A (DAS) | -0.49952 | -0.49952 |
| 2D H17 8,8 v 10 (DAS) | -0.47058 | -0.47058 |
| 1D H17 9,9 v A (DAS) | -0.18597 | -0.18597 |
| 6D H17 8,8 v A (DAS) | -0.51793 | -0.51793 |
| 1D S17 8,8 v 10 (DAS) | -0.45174 | -0.45174 |
| 2D S17 2,2 v 3 (DAS) | 0.00140 | 0.00140 |

**Resplits** are where the approximation lives. The engine counts the expected hands
with one probability p of drawing another pair card, so p does not fall as pair
cards come out. Resplitting is optional (`ev.js` `splitValue`).

Checked two ways:

* **Monte Carlo with real resplits.** True depletion, hands played one after
  another, the dealer last, and the engine's own post-split decisions as a fixed
  strategy. 3,000,000 rounds each (seeded):

  | Case (S17, DAS) | Monte Carlo | Engine | Difference |
  |---|---|---|---|
  | 6D 8,8 v 6, split once (control: exact) | 0.3277 ± 0.0012 | 0.3279 | 0.2 SE |
  | 6D 8,8 v 6, resplit to 4 | 0.4058 ± 0.0013 | 0.4060 | 0.2 SE |
  | 6D 8,8 v 10, resplit to 4 | −0.4752 ± 0.0011 | −0.4751 | 0.1 SE |
  | 6D 2,2 v 5, resplit to 4 | 0.1727 ± 0.0016 | 0.1732 | 0.4 SE |
  | 1D 8,8 v 6, resplit to 4 | 0.3824 ± 0.0014 | 0.3868 | +0.0044 (3.2 SE) |

  In 6 decks the resplit values are right. In 1 deck the constant p overstates a
  resplit by about 0.004 per split, because pair cards really do run out. At
  house-edge level that is at most 0.003% (table below).

* **Effect of resplitting to 4 hands vs splitting once**, composition-dependent:

  | Rules | Engine | Published (house-edge calculator) |
  |---|---|---|
  | 6D S17 DAS | 0.0532 | 0.0538 |
  | 6D S17 no DAS | 0.0338 | 0.0339 |
  | 8D S17 DAS | 0.0546 | 0.0548 |
  | 2D S17 DAS | 0.0425 | 0.0449 |
  | 1D S17 DAS | 0.0268 | 0.0298 |
  | 1D H17 no DAS | 0.0155 | 0.0170 |

**"Player may not resplit: −0.10%" (Wizard of Odds rule-variations page).** The
content check found this outlier. That page
(<https://wizardofodds.com/games/blackjack/rule-variations/>, baseline 8 decks, S17,
DAS, split to 4 hands) lists "Player may not resplit −0.10%" and "Split to only 3
hands −0.01%". For exactly that rule set, the same site's house-edge calculator gives
0.4858% split once vs 0.4310% resplit to 4 (**0.0548%**) and 0.4400% resplit to 3
(0.009%). The engine gives **0.0546%** and 0.0080%. Three independent facts back the
calculator's figure:
(1) the engine's split-once value is exact (above),
(2) its resplit values match a Monte Carlo of real resplitting in 6-8 deck shoes to
within 0.0003 per split, and
(3) the rule-variations page's own "split to only 3 hands −0.01%" is consistent with the
calculator. So the −0.10% on the rule-variations page disagrees with its own site's
calculator. It is not reproduced, and the lessons should quote 0.05% (6-8 decks, DAS) for
"no resplitting". The test suite pins 0.0538 ± 0.002.

## 4. Double Exposure

**Rules and the preset.** The Wizard of Odds Double Exposure page gives the usual game:
both dealer cards exposed, the dealer wins ties except a player natural, blackjack pays even money,
split once. It lists as varying: S17/H17, tied naturals win or push, DAS, double
on any two or not, more splits. Its casino examples include Atlantic City (8 decks, S17,
hard 9-11 plus soft 19-20, DAS, tied naturals win, split once) and Las Vegas/Reno
games (6 decks, H17, hard 9-11). The `double-exposure` preset is 8 decks, H17, DAS,
hard 9-11, split once, even money, ties lose, tied naturals win. That is within the
documented range, so **the preset was not changed.** The engine
puts its house edge at **1.15%**, a tough game. The Atlantic City S17 version is
about 0.76% (without the soft 19-20 doubles, which the rule model does not have; the published
0.66% includes them).

`dePlayerBjWinsTie: false` is modelled as "tied naturals push", the other
published option.

**Chart vs the published chart.** The published DE charts (S17 and H17; rows hard 5-21, soft 13-21, pairs;
columns dealer hard 4-20 and soft 12-16/17) assume doubling on any two cards and
DAS-dependent split codes (P/H, P/S, P/D). They were compared under those rules,
split once. The deck count is not stated.

| Engine rules | S17 cells matching (of 792) | H17 cells matching (of 828) |
|---|---|---|
| 6 decks, DAS | 782 | 817 |
| 8 decks, DAS | 784 | 819 |
| 100 decks, DAS (≈ infinite; scratch run, the rule model allows 1-8) | **789** | **826** |

The differences shrink as decks increase (soft 14 v h6: EV gap 0.0111 at 6 decks,
0.0073 at 8, gone at 100). So the published chart is an infinite-deck (or very
many-deck) chart, and the 6-8 deck differences are real card-removal effects. The
cells at 8 decks, S17 (engine / published, EV gap):
soft 14 v h6 D/H (0.0073), 4,4 v h6 P/H (0.0106), 7,7 v s12 S/H (0.0022), soft 18 v
s16 H/S (0.0049), soft 18 v s15 S/H (0.0005), 7,7 v h10 S/H (0.0006), and soft 18
v h13/h14 Ds/Dh (both double; stand vs hit if you cannot double differ by 0.0004).
At 8 decks, H17: 11 v s12 D/H (0.0021), 11 v s17 D/H (0.0047), soft 13 v h6 D/H
(0.0060), 7,7 v h10 S/H (0.0006), 8,8 v s15 P/S (0.0013), and the soft 18 Ds/Dh
fallbacks v h4, h5, h13, h14. At 100 decks only near-ties remain: soft 18 v h13/h14,
whether to stand or hit if you cannot double (EVs differ by 0.00003), and S17 soft 18 v
s16 (0.0004).

**House edges and rule effects vs the published figures.**

| Game | Engine | Published |
|---|---|---|
| Grand, Tunica: 6D S17, hard 9-11, no DAS, tied BJ wins, split once | 0.957% | 0.96% |
| Circus Circus, Reno: 6D H17, hard 9-11, no DAS, tied BJ pushes, split once | 1.562% | 1.47% |
| Stratosphere: 6D H17, hard 9-11, DAS, tied BJ wins, "split up to four times" | 0.758% (4 hands) | 0.68% |

| Rule effect (engine baseline 6D H17, any double, DAS, split once) | Engine | Published |
|---|---|---|
| Dealer stands on soft 17 | +0.386 | +0.39 |
| Double after split | +0.308 | +0.32 |
| Tied blackjack wins instead of pushing | +0.217 | +0.22 |
| Double on hard 9-11 only | -1.074 | -1.04 |
| Double on hard 10-11 only | -1.455 | -1.44 |

Notes: the Circus Circus figure disagrees with the page's own rule effects. Grand
0.96 + H17 0.39 + tied-BJ push 0.22 = 1.57, where the engine has 1.562. For Stratosphere, the engine
gives 1.124 / 0.869 / 0.758 for 2 / 3 / 4 hands. Extrapolating, unlimited resplits
come to about 0.66-0.70, consistent with 0.68 if "split up to four times" means more than four
hands.

## 5. Hi-Lo index cross-check (engine estimate vs published)

`js/engine/indices.js` `computeIndex(play, rules)` prices the entry's two plays on a
representative shoe at each true count. Half the shoe is left (3 decks of 6), with
tens and aces up and 2-6s down by exactly what a running count of TC × 3 implies,
spread evenly within each Hi-Lo group. It then finds where the two EVs cross. "Published" is
the `printed` value in `js/data/deviations.js`. The engine figure is the exact
crossover. For 'H vs S' rows the published number is where standing starts (stand
above the crossover).

| Game | Play | Comparison | Published | Engine crossover | Δ |
|---|---|---|---|---|---|
| S17 | insurance | insure vs decline | 3 | 3.05 | +0.05 |
| S17 | 16 v 10 | S vs H | 0 | 1.30 | +1.30 |
| S17 | 15 v 10 | S vs H | 4 | 4.10 | +0.10 |
| S17 | T,T v 5 | P vs S | 5 | 4.91 | -0.09 |
| S17 | T,T v 6 | P vs S | 4 | 4.73 | +0.73 |
| S17 | 10 v 10 | D vs H | 4 | 3.38 | -0.62 |
| S17 | 12 v 3 | S vs H | 2 | 1.48 | -0.52 |
| S17 | 12 v 2 | S vs H | 3 | 3.18 | +0.18 |
| S17 | 11 v A | D vs H | 1 | 0.40 | -0.60 |
| S17 | 9 v 2 | D vs H | 1 | 0.07 | -0.93 |
| S17 | 10 v A | D vs H | 4 | 3.13 | -0.87 |
| S17 | 9 v 7 | D vs H | 3 | 2.59 | -0.41 |
| S17 | 16 v 9 | S vs H | 5 | 5.57 | +0.57 |
| S17 | 13 v 2 | H vs S | -1 | -1.02 | -0.02 |
| S17 | 12 v 4 | H vs S | 0 | -0.20 | -0.20 |
| S17 | 12 v 5 | H vs S | -2 | -1.85 | +0.15 |
| S17 | 12 v 6 | H vs S | -1 | -1.24 | -0.24 |
| S17 | 13 v 3 | H vs S | -2 | -2.49 | -0.49 |
| S17 | 14 v 10 (Fab 4) | R vs H | 3 | 3.40 | +0.40 |
| S17 | 15 v 10 (Fab 4) | H vs R | 0 | -0.18 | -0.18 |
| S17 | 15 v 9 (Fab 4) | R vs H | 2 | 2.12 | +0.12 |
| S17 | 15 v A (Fab 4) | R vs H | 1 | 1.46 | +0.46 |
| H17 | insurance | insure vs decline | 3 | 3.05 | +0.05 |
| H17 | 16 v 10 | S vs H | 0 | 1.30 | +1.30 |
| H17 | 15 v 10 | S vs H | 4 | 4.10 | +0.10 |
| H17 | T,T v 5 | P vs S | 5 | 4.87 | -0.13 |
| H17 | T,T v 6 | P vs S | 4 | 4.26 | +0.26 |
| H17 | 10 v 10 | D vs H | 4 | 3.38 | -0.62 |
| H17 | 12 v 3 | S vs H | 2 | 1.07 | -0.93 |
| H17 | 12 v 2 | S vs H | 3 | 2.66 | -0.34 |
| H17 | 9 v 2 | D vs H | 1 | 0.07 | -0.93 |
| H17 | 10 v A | D vs H | 3 | 2.27 | -0.73 |
| H17 | 9 v 7 | D vs H | 3 | 2.59 | -0.41 |
| H17 | 16 v 9 | S vs H | 5 | 5.57 | +0.57 |
| H17 | 13 v 2 | H vs S | -1 | -1.52 | -0.52 |
| H17 | 12 v 4 | H vs S | 0 | -0.57 | -0.57 |
| H17 | 12 v 5 | H vs S | -2 | -1.99 | +0.01 |
| H17 | 12 v 6 | H vs S | -3 | -3.77 | -0.77 |
| H17 | 13 v 3 | H vs S | -2 | -2.88 | -0.88 |
| H17 | 14 v 10 (Fab 4) | R vs H | 3 | 3.40 | +0.40 |
| H17 | 15 v 10 (Fab 4) | H vs R | 0 | -0.18 | -0.18 |
| H17 | 15 v 9 (Fab 4) | R vs H | 2 | 2.12 | +0.12 |
| H17 | 15 v A (Fab 4) | H vs R | -1 | -1.04 | -0.04 |

(H17 11 v A is basic strategy in H17 shoes, `set: 'basic'`, so there is nothing to cross-check.)

**How close it gets.** 41 of 43 crossovers are within 1.0 count of the published
index and 25 within 0.5. Every H17-vs-S17 shift the sources show comes out in the right direction:
10 v A 4 → 3, 12 v 6 −1 → −3, 15 v A surrender +1 → −1, 13 v 2 and 13 v 3 lower in H17.
The systematic differences have known causes:

* **16 v 10 (+1.3):** the engine prices two-card 16s only (T,6 and 9,7). The
  published 0 covers all 16s, and multi-card 16s stand much sooner (section 1). It is
  the most composition-sensitive play in the game.
* **Doubles run 0.4-0.9 low** (10 v 10, 10 v A, 11 v A, 9 v 2, 9 v 7). Published
  indices come from full-shoe simulations bucketed by an integer true count. The
  engine uses one representative shoe per count and a linear removal model. Some
  published double indices are also set conservatively because doubling adds variance.
* The engine's figure is a cross-check only. The app plays the published indices.

## 6. Performance

Node 24 on the development PC, cold process:

| Task | Time |
|---|---|
| Import `js/data/charts.js` (45 charts, 241 KB) and unpack | 25 ms |
| `getChart` for a precomputed rule set | a table lookup |
| `getChart` for any other classic rule set (computed live) | 0.5-0.8 s |
| `getDEChart` for a non-preset Double Exposure rule set | 1.2-1.8 s |
| `node scripts/build-charts.mjs` (45 charts) | about 33 s |
| `test/engine.test.mjs` | about 8 s |

A phone running the Web Worker should expect several times these figures.

## Reproducing

* `node --test` runs the suite. The engine tests hold the published charts verbatim and
  check every precomputed chart against them, the documented exceptions, the house
  edges and effects above, the DE spot checks, `decide()` and the index cross-check.
* `node scripts/build-charts.mjs` regenerates `js/data/charts.js`. A test fails
  if the stored charts drift from the engine.
* The brute-force cross-checks were throwaway scripts outside the repository: the
  hard 8 v A recursion, the two-hand split enumeration, the 100-deck DE run and the
  Wizard house-edge table parse. Their results are recorded above.
