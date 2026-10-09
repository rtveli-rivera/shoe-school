# Sources

Every factual number in `js/data/lessons.js`, `js/data/deviations.js` and
`js/data/glossary.js` is either drawn by the engine (`chart`, `diff`, `he` blocks)
or traceable to a key below. Lessons cite keys inline as `` `key` ``.

Research done 2026-10-08. Web pages were read as data; nothing was copied
beyond short facts and index numbers. Blackjack Apprenticeship and
blackjacktheforum.com refuse automated fetches (HTTP 403); BJA's two deviation
charts (PDFs) were read directly, BJA articles through plain HTTP fetches, and
blackjacktheforum only second-hand. Schlesinger's *Blackjack Attack* was not
consulted directly: its numbers come through the pages that publish them.

## Source list

### Index plays and counting

| Key | Source | Supports |
|---|---|---|
| `schlesinger-bja3` | Don Schlesinger, *Blackjack Attack: Playing the Pros' Way*, 3rd ed. (RGE, 2005); the I18 first appeared in *Blackjack Forum*, Sept 1986 ("Attacking the Shoe"). Not consulted directly. | Origin of the Illustrious 18 and Fab 4; values via `woo-hilo`, `rarepike-i18`, `cnd-i18` |
| `schlesinger-floor` | Schlesinger, *Blackjack Attack* 3rd ed. p.190 (flooring is the "methodology of choice"), as quoted at https://wizardofvegas.com/forum/gambling/blackjack/23077-tc-rounding/ ; DSchles post at https://www.blackjackinfo.com/community/threads/rounding-counts.54915/ | True count convention: floor |
| `woo-hilo` | Wizard of Odds, "Introduction to the High-Low Card Counting Strategy", https://wizardofodds.com/games/blackjack/card-counting/high-low/ | S17 I18 + Fab 4 (6D S17 DAS LS RSA), the "TC at or above the index" rule, I18 ≈ 80-85% of all-index value, penetration sims (1-10 spread: 0.368% / 0.587% / 0.837% at 4 / 4.5 / 5 of 6 decks), SD with a spread (2.27 units, 1-10, 4.5 decks), ~1-15 as the most aggressive shoe spread |
| `bja-s17` | Blackjack Apprenticeship, S17 Deviation Chart (2018), https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_S17.pdf | S17 index cross-check |
| `bja-h17` | Blackjack Apprenticeship, H17 Deviation Chart (2018), https://www.blackjackapprenticeship.com/wp-content/uploads/2019/07/BJA_H17.pdf | H17 indices |
| `bjinfo-h17-top50` | blackjackinfo.com forum, "Top 50 indices for H17 Hilo?" (2009, 6D H17 DAS RSA LS list), https://www.blackjackinfo.com/community/threads/top-50-indices-for-h17-hilo.16762/ | H17 index cross-check |
| `bjinfo-11vA` | blackjackinfo.com forum, "Illustrious 18 question", https://www.blackjackinfo.com/community/threads/illustrious-18-question.23177/ | H17 11 v A reverse index (0) |
| `bjinfo-i18-right` | blackjackinfo.com forum, "Which Illustrious 18 indices are right?" (post quoting Schlesinger's gains), https://www.blackjackinfo.com/community/threads/which-illustrious-18-indices-are-right.7794/ | I18 value ranking: insurance 117, 16v10 53, 15v10 37 … (thousandths of a percent) |
| `bjinfo-insurance` | blackjackinfo.com forum, "Insurance index question" (values attributed to Wong, *Professional Blackjack*), https://www.blackjackinfo.com/community/threads/insurance-index-question.17043/ | Insurance index 1D +1.4, 2D +2.4, 6D +3.0, 8D +3.1 |
| `rarepike-i18` | Rare Pike, "Advanced Blackjack Strategy", https://rarepike.com/blackjack/advanced-strategy/ | S17 I18 cross-check |
| `cnd-i18` | Casino News Daily, "Blackjack Illustrious 18", https://www.casinonewsdaily.com/blackjack-guide/illustrious-18/ | I18 for 1D / 2D / shoe with H17 notes (attributed to Schlesinger); insurance 1D +1.4, 2D +2.4 |
| `bjtrainer-fyi` | blackjacktrainer.fyi deviation chart, https://www.blackjacktrainer.fyi/charts/deviations (engine-generated; low weight) | H17 12 v 6 at −3 |
| `engine-linear` | This app's engine: `js/engine/shoe.js` `shoeAtTrueCount` (linear Hi-Lo composition) + `js/engine/ev.js` row EVs, 6D, 3 decks left, two-card hands. Scratch computation, not shipped. | Directional cross-check of every index (table below) |
| `bja-deviations` | BJA, "What are Blackjack Deviations?", https://www.blackjackapprenticeship.com/blackjack-deviations/ | Deviations ≈ 20-40% of a counter's edge |
| `bja-tc-edge` | BJA, "How the true count changes your edge", https://www.blackjackapprenticeship.com/how-true-count-changes-your-edge-in-blackjack/ | ~0.5% per TC; player edge from ~TC +1; 6:5 needs TC +3 to +4 |
| `bja-truncate` | BJA, "True count conversion guide", https://www.blackjackapprenticeship.com/true-count-conversion-guide/ | BJA teaches truncation |
| `bja-countdown` | BJA, "Hi-Lo system guide", https://www.blackjackapprenticeship.com/hi%E2%80%91lo-system-guide-for-card-counting-blackjack/ and "Running count", https://www.blackjackapprenticeship.com/running-count-in-blackjack-what-it-is-and-how-to-keep-it/ | Deck countdown: under 30 s, 25 s better |
| `bja-glossary` | BJA glossary, https://www.blackjackapprenticeship.com/glossary-of-blackjack-terms/ | No mid-shoe entry |
| `lva-snyder-tc` | Las Vegas Advisor Q&A (Arnold Snyder), https://www.lasvegasadvisor.com/question/2015-07-09/ | Each Hi-Lo TC point ≈ 0.5% |
| `lva-true-count` | Snyder, "How true is your true count?", https://www.lasvegasadvisor.com/blog/how-true-is-your-true-count/ | Edge-per-TC line is not perfectly straight |
| `qfit-mb-106` | N. Wattenberger, *Modern Blackjack*, p.106, https://www.qfit.com/book/ModernBlackjackPage106.htm | Off-the-top edge with cut card: 6D H17 DAS LS −0.556%, H17 DAS −0.640%, S17 DAS LS −0.359% |
| `qfit-mb-eor` | *Modern Blackjack* p.68 (Griffin's single-deck effects of removal), https://www.qfit.com/book/ModernBlackjackPage68.htm | EoR table in m4-l1 |
| `woo-eor` | Wizard of Odds, effect of removal (6 decks), https://wizardofodds.com/games/blackjack/effect-of-removal/ | 6D EoR ≈ 1/6 of 1D in the same pattern (5: +0.141%, A: −0.094% S17) |
| `qfit-mb-score` | *Modern Blackjack* p.99, https://www.qfit.com/book/ModernBlackjackPage99.htm | SCORE definition: $/100 rounds, $10,000 bankroll, 13.5% RoR, optimal betting |
| `qfit-mb-n0` | *Modern Blackjack* p.518, https://www.qfit.com/book/ModernBlackjackPage518.htm | N0 (Brett Harris) = (SD/EV)² = 1,000,000 / SCORE |
| `qfit-tables` | *Modern Blackjack* "Tables of tables": https://www.qfit.com/book/tables6.htm , https://www.qfit.com/book/tables2.htm , https://www.qfit.com/book/tables1.htm | Hi-Lo SCOREs: 6D H17 LS 4.5/6: 1-8 8.0, 1-12 14.3; 5/6 1-12 26.8; 4/6 1-12 7.4; 2D S17 DAS LS 62/104 1-6 59.6; $6.95/100 rounds at 2% RoR (6D H17 LS 75% 1-12); standard spreads 6D 1-8/12/16, 2D 1-4/6/8, 1D 1-2/3/4 |
| `qfit-cc` | qfit, card counting systems, https://www.qfit.com/card-counting.htm | Hi-Lo BC .97, PE .51, IC .76 (glossary) |
| `qfit-tc` | qfit, "Calculating true counts", https://www.qfit.com/CalculatingTrueCounts.htm | Floor most popular; Wong truncates (1994+ editions) |
| `bjic-ror` | Blackjack in Color, risk of ruin, https://www.blackjackincolor.com/blackjackrisk4.htm | Full Kelly ≈ 13.5% RoR; RoR ≈ exp(−2·EV·B/Var) |
| `woo-variance` | Wizard of Odds, blackjack appendix 4, https://wizardofodds.com/games/blackjack/appendix/4/ | Flat-bet SD ≈ 1.14-1.16 units/hand |
| `woo-cc-intro` | Wizard of Odds, card counting introduction, https://wizardofodds.com/games/blackjack/card-counting/introduction/ | Typical counter edge 0.5-1.5% |
| `wiki-wong` | Wikipedia, "Stanford Wong", https://en.wikipedia.org/wiki/Stanford_Wong ; also https://www.blackjackinfo.com/what-is-wonging-in-blackjack/ | Wonging named after Wong (popularised it) |

### Rules, house edge and game facts

| Key | Source | Supports |
|---|---|---|
| `woo-basics` | Wizard of Odds, blackjack basics, https://wizardofodds.com/games/blackjack/basics/ | Payouts table |
| `woo-rules` | Wizard of Odds, rule variations, https://wizardofodds.com/games/blackjack/rule-variations/ (8D S17 DAS base) | H17 −0.22, no DAS −0.14, LS +0.07, 6:5 −1.39, RSA +0.08, no resplit −0.10, double 9-11 −0.09, 10-11 −0.18, ENHC −0.11, 1D +0.48, 2D +0.19, 6D +0.02 |
| `woo-dealer-probs` | Wizard of Odds, dealer probabilities, https://wizardofodds.com/games/blackjack/appendix/2a/ | Dealer bust % by upcard, 6D H17 (m1-l3) |
| `woo-shuffle` | Wizard of Odds, Ask the Wizard: shuffling, https://wizardofodds.com/ask-the-wizard/blackjack/shuffling/ | CSMs useless to counters; preferential shuffling happens |
| `woo-136` | Wizard of Odds, Ask the Wizard #136 (Jim Kilby, *Casino Operations Management*), https://wizardofodds.com/ask-the-wizard/136/ | Rounds/hour: 209, 139, 105, 84, 70, 60, 52 for 1-7 players |
| `woo-de` | Wizard of Odds, Double Exposure, https://wizardofodds.com/games/double-exposure/ | DE rules and rule effects (S17 +0.39, DAS +0.32, BJ tie wins +0.22, split once −0.71, double 9-11 −1.04, 10-11 −1.44) |
| `wiki-de` | Wikipedia, "Double Exposure Blackjack", https://en.wikipedia.org/wiki/Double_Exposure_Blackjack | Epstein 1977, Vegas World 1979; split 10s v 13-16; hit 19 v 20 |
| `lva-de` | Las Vegas Advisor, "Double exposure blackjack", https://www.lasvegasadvisor.com/question/double-exposure-blackjack/ | DE is beatable by counting; rare in land casinos |

### Casino survival and the law (general information, not legal advice)

| Key | Source | Supports |
|---|---|---|
| `snyder-heat` | Arnold Snyder, "How hot is it?" (1996), https://www.lasvegasadvisor.com/gambling-with-an-edge/evaluating-the-heat-factor/ | Escalating heat signs |
| `lva-identify` | LVA Q&A (Colin Jones, 2020), https://www.lasvegasadvisor.com/question/casino-identify-counters/ | Casinos track the count against bets; ask for ID/card after big wins; SIN/OSN databases |
| `lva-legal` | LVA FAQ, "Is counting illegal?", https://www.lasvegasadvisor.com/faq-gambling-counting-illegal/ | Mental counting legal in the US; casinos can still bar in most states |
| `lvsun-2003` | Las Vegas Sun, 29 Dec 2003, https://lasvegassun.com/news/2003/dec/29/casinos-use-controversial-database-to-catch-cheats/ | Nevada GCB: counters use their head; devices illegal |
| `nrs-463` | NRS 463.0129(3)(a), https://www.leg.state.nv.us/nrs/NRS-463.html ; Slade v. Caesars, 373 P.3d 74 (Nev. 2016) | Nevada keeps the common-law right to exclude |
| `donovan-2010` | Donovan v. Grand Victoria Casino, 934 N.E.2d 1111 (Ind. 2010), https://theindianalawyer.com/?p=113780 | Indiana casinos may exclude counters |
| `nrs-207` | NRS 207.200, https://www.leg.state.nv.us/nrs/NRS-207.html ; SB 371 (2025) https://policyrisk.com/state-bill/NV-SB371-83rd2025 | Trespass after warning is a misdemeanor; warning now lasts 36 months (24 before 2025) |
| `uston-1982` | Uston v. Resorts International Hotel, Inc., 89 N.J. 163, 445 A.2d 370 (N.J. 1982); https://www.quimbee.com/cases/uston-v-resorts-international-hotel-inc ; https://en.wikipedia.org/wiki/Ken_Uston | NJ casinos can't exclude counters: the Casino Control Commission controls game rules |
| `campione-1998` | Campione v. Adamar of N.J., 714 A.2d 299 (N.J. 1998), https://caselaw.findlaw.com/court/nj-supreme-court/1416955.html | NJ countermeasures: shuffling at will, more decks, lowering one player's limit |
| `doug-grant-2000` | Doug Grant, Inc. v. Greate Bay Casino Corp., 232 F.3d 173 (3d Cir. 2000), https://law.resource.org/pub/us/case/reporter/F3/232/232.F3d.173.98-5291.html | Shuffling at will is not cheating; countermeasures upheld |
| `nrs-465` | NRS 465.075 (devices), 465.088 (penalties), 465.101 (detention on probable cause), https://www.leg.state.nv.us/nrs/NRS-465.html | Devices a felony in Nevada; detention needs probable cause |
| `njsa-5-12-113-1` | N.J.S.A. 5:12-113.1, https://codes.findlaw.com/nj/title-5-amusements-public-exhibitions-and-meetings/nj-st-sect-5-12-113-1/ | Devices a crime in New Jersey |
| `grosjean-2009` | Grosjean v. Imperial Palace, 125 Nev. 349, 212 P.3d 1068 (2009); https://digital-release.8newsnow.com/news/nv-court-questions-gaming-agents-immunity | Courts ruled against a casino that held an advantage player |
| `tsao-2012` | Tsao v. Desert Palace, 698 F.3d 1128 (9th Cir. 2012), https://wlo.willamette.edu/9thcir/2012/10/tsao-v-desert-palace-inc.html | Trespass enforcement; security may hold for police |
| `nrs-171-123` | NRS 171.123, https://nevada.public.law/statutes/nrs_171.123 | Duty to identify applies to peace-officer detentions |
| `cfr-1021-311` | 31 CFR 1021.311 / 1021.313 / 1010.312, https://www.law.cornell.edu/cfr/text/31/1021.311 | CTR over $10,000 per gaming day; ID required |
| `usc-5324` | 31 U.S.C. 5324, https://www.law.cornell.edu/uscode/text/31/5324 | Structuring is a federal crime |
| `uk-ga-2005` | Gambling Act 2005 s.42, https://www.legislation.gov.uk/ukpga/2005/19/section/42 | UK cheating offence (not mental counting) |
| `bja-backoff` | BJA, "Casino backoff", https://www.blackjackapprenticeship.com/casino-backoff/ (+ "Behind the black dome") | Backoff conduct; video has no audio |
| `wiki-griffin` | Wikipedia, "Griffin Investigations", https://en.wikipedia.org/wiki/Griffin_Investigations ; https://www.lasvegasadvisor.com/faq-gambling-griffin/ | Griffin Book; 2005 libel verdict |
| `snyder-surveillance` | Snyder, "Surveillance talks", https://www.lasvegasadvisor.com/gambling-with-an-edge/surveillance-talks/ | Biometrica / SIN face-recognition network |
| `wiki-francesco` | Wikipedia, "Al Francesco", https://en.wikipedia.org/wiki/Al_Francesco | Big-player teams, mid-1970s; Uston |
| `wiki-mit` | Wikipedia, "MIT Blackjack Team", https://en.wikipedia.org/wiki/MIT_Blackjack_Team | MIT team from 1979 to about 2000 |
| `snyder-teams` | Snyder, "Blackjack team legal issues", https://www.lasvegasadvisor.com/gambling-with-an-edge/blackjack-team-legal-issues/ | Team play legal without devices/cheating; can still be barred |

### Responsible gambling

| Key | Source | Supports |
|---|---|---|
| `ncpg-facts` | NCPG fact sheet (Jan 2026), https://www.ncpgambling.org/wp-content/uploads/2026/01/PGAM_Fact-Sheet.pdf | Warning signs |
| `ncpg-helpline` | NCPG, 1-800-MY-RESET announcement, https://www.ncpgambling.org/news/1-800-my-reset-announcement/ ; https://www.ncpgambling.org/news/ncpg-statement-national-problem-gambling-helpline-number/ | US helpline 1-800-MY-RESET (1-800-697-3738) since 29 Jan 2026; 1-800-522-4700 still active. Note: 1-800-GAMBLER now belongs to the Council on Compulsive Gambling of New Jersey (https://800gambler.org/), after a 2025 court order |
| `gamcare` | GambleAware service finder, https://www.gambleaware.org/tools-and-support/support-in-your-area/service-finder-results/gamcare-national-gambling-helpline/ | UK National Gambling Helpline 0808 8020 133 (GamCare, 24/7) |
| `ga` | Gamblers Anonymous, https://gamblersanonymous.org/history/ | Free meetings worldwide |

## Index cross-check

How to read the published numbers: every source uses "stand / double / split /
surrender / insure at the index or higher; below it, hit". `deviations.js` stores
that number as `printed`; for plays where the deviation is a hit at low counts it
stores `index = printed − 1` with `when: 'le'` (see the file header).

"Engine" = the exact true count at which the two plays break even in the app's
own linear Hi-Lo model (`engine-linear`): 6 decks, 3 decks left, two-card hands
only. It is a directional check, not an index generator: it ignores multi-card
hands and the true-count distribution, so it can sit up to about a point away
from simulation-derived indices (16 v 10 and 10 v A are the largest gaps).

### S17 (multi-deck)

| # | Play | Schlesinger via `woo-hilo` | `bja-s17` | `rarepike-i18` | `cnd-i18` (shoe) | Engine | Chosen |
|---|---|---|---|---|---|---|---|
| 1 | Insurance | +3 | 3+ | +3 | +3 | +3.33 (tens = 1/3) | **+3** |
| 2 | 16 v 10 stand | 0 | 0+ | 0 | 0 | +1.3 | **0** |
| 3 | 15 v 10 stand | +4 | 4+ | +4 | +4 | +4.1 | **+4** |
| 4 | 10,10 v 5 split | +5 | 5+ | +5 | +5 | +4.9 | **+5** |
| 5 | 10,10 v 6 split | +4 | 4+ | +4 | +4 | +4.7 | **+4** |
| 6 | 10 v 10 double | +4 | 4+ | +4 | +4 | +3.4 | **+4** |
| 7 | 12 v 3 stand | +2 | 2+ | +2 | +2 | +1.5 | **+2** |
| 8 | 12 v 2 stand | +3 | 3+ | +3 | +3 | +3.2 | **+3** |
| 9 | 11 v A double | +1 | 1+ | +1 | +1 | +0.4 | **+1** |
| 10 | 9 v 2 double | +1 | 1+ | +1 | +1 | +0.1 | **+1** |
| 11 | 10 v A double | +4 | 4+ | +4 | +4 | +3.1 | **+4** |
| 12 | 9 v 7 double | +3 | 3+ | +3 | +3 | +2.6 | **+3** |
| 13 | 16 v 9 stand | +5 | **4+** | +5 | +5 | +5.6 | **+5** (BJA differs) |
| 14 | 13 v 2 (hit below) | −1 | −1− | −1 | "hit at −1 or lower" | −1.0 | **−1** |
| 15 | 12 v 4 (hit below) | 0 | 0− | 0 | 0 | −0.2 | **0** |
| 16 | 12 v 5 (hit below) | −2 | — | −2 | −2 | −1.8 | **−2** |
| 17 | 12 v 6 (hit below) | −1 | — | −1 | −1 | −1.25 | **−1** |
| 18 | 13 v 3 (hit below) | −2 | — | −2 | −2 | −2.5 | **−2** |
| F1 | 14 v 10 surrender | +3 | — | | | +3.4 | **+3** |
| F2 | 15 v 10 surrender (hit below) | 0 | 0− | | | −0.2 | **0** |
| F3 | 15 v 9 surrender | +2 | 2+ | | | +2.1 | **+2** |
| F4 | 15 v A surrender | +1 | **2+** | | | +1.5 | **+1** (BJA differs) |

Disagreements and choices (S17):
- **16 v 9**: BJA +4 against Schlesinger/WoO/rarepike/casinonewsdaily +5. Chose +5 (four sources; engine +5.6 agrees).
- **15 v A surrender**: BJA +2 against Schlesinger/WoO +1. Chose +1 (the original Fab 4 value; engine +1.5 sits between).
- **13 v 2 "−1−" and 12 v 4 "0−" (BJA)**: BJA prints "hit at −1 and below". BJA truncates the true count (`bja-truncate`), and a truncated −1 means an exact TC between −2 and −1, so BJA hits only at exact TC ≤ −1: the same switch point as Schlesinger's "stand at −1 or higher". Under our floored count that is "hit at −2 or lower". Not a real disagreement.
- **16 v 10 at exactly 0**: BJA "0+" ("any positive running count") hits at RC 0; Schlesinger stands at TC 0. Chose Schlesinger (≥ 0). Negligible value.
- BJA omits 12 v 5, 12 v 6, 13 v 3 and 14 v 10 surrender; they are kept from Schlesinger.

### H17 (multi-deck)

| # | Play | `bja-h17` | `bjinfo-h17-top50` | `cnd-i18` (shoe, H17) | S17 value | Engine (H17) | Chosen |
|---|---|---|---|---|---|---|---|
| 1 | Insurance | 3+ | 3 | +3 | +3 | +3.33 | **+3** |
| 2 | 16 v 10 stand | 0+ | 0 | 0 | 0 | +1.3 | **0** |
| 3 | 15 v 10 stand | 4+ | 4 | +4 | +4 | +4.1 | **+4** |
| 4 | 10,10 v 5 split | 5+ | 5 | +5 | +5 | +4.9 | **+5** |
| 5 | 10,10 v 6 split | 4+ | 4 | +4 | +4 | +4.25 | **+4** |
| 6 | 10 v 10 double | 4+ | 4 | +4 | +4 | +3.4 | **+4** |
| 7 | 12 v 3 stand | 2+ | **1** | +2 | +2 | +1.1 | **+2** |
| 8 | 12 v 2 stand | 3+ | 3 | +3 | +3 | +2.7 | **+3** |
| 9 | 11 v A | always D | −1 | 0 | +1 | −1.1 | **basic: always double** (`set: 'basic'`) |
| 10 | 9 v 2 double | 1+ | 1 | +1 | +1 | +0.1 | **+1** |
| 11 | 10 v A double | 3+ | 3 | +3 | +4 | +2.3 | **+3** |
| 12 | 9 v 7 double | 3+ | 3 | +3 | +3 | +2.6 | **+3** |
| 13 | 16 v 9 stand | **4+** | **4** | +5 | +5 | +5.6 | **+5** (see below) |
| 14 | 13 v 2 (hit below) | −1− | −1 | −1 | −1 | −1.5 | **−1** |
| 15 | 12 v 4 (hit below) | 0− | 0 | 0 | 0 | −0.6 | **0** |
| 16 | 12 v 5 (hit below) | — | — | −2 | −2 | −2.0 | **−2** |
| 17 | 12 v 6 (hit below) | — | — | **−3** | −1 | −3.8 | **−3** |
| 18 | 13 v 3 (hit below) | — | — | −2 | −2 | −2.9 | **−2** (−3 plausible) |
| F1 | 14 v 10 surrender | — | 3 | | +3 | +3.4 | **+3** |
| F2 | 15 v 10 surrender (hit below) | 0− | 0 | | 0 | −0.2 | **0** |
| F3 | 15 v 9 surrender | 2+ | 2 | | +2 | +2.1 | **+2** |
| F4 | 15 v A surrender (hit below) | −1+ | −1 | | +1 | −1.0 | **−1** |

Disagreements and choices (H17):
- **11 v A**: basic strategy doubles it in H17 shoes (engine chart agrees). Sources split on a reverse index (hit below 0: casinonewsdaily and a forum reply; below −1: the H17 forum list; BJA none). Followed BJA, the most widely used H17 chart: marked `set: 'basic'`, no deviation.
- **12 v 3**: forum list +1 against BJA and casinonewsdaily +2. Chose +2.
- **16 v 9**: BJA and the forum list print +4, but BJA prints +4 on its S17 chart as well, so it is a source difference, not a soft-17 effect. The engine's break-even is identical under S17 and H17 (+5.58): the soft-17 rule barely reaches a dealer 9. Kept Schlesinger's +5 for both, so the two lists don't differ for a reason that isn't real. **This is the one place we did not take the most-cited H17 number.**
- **12 v 6**: −3 from casinonewsdaily (H17) and blackjacktrainer.fyi; a blackjackinfo thread says H17 moves this play "a lot"; engine −3.8. Medium confidence.
- **12 v 5, 13 v 3**: no H17-specific second source; S17 values kept (engine −2.0 and −2.9).
- The H17 forum list also gives extras we do not use: 16 v A stand +3 (BJA +3), 15 v A stand +5 (BJA +5), 8 v 6 double +2, A,8 v 6 stand below 0, 16 v 8 surrender +4, 16 v 9 surrender only at −1 or above.

### One- and two-deck games

The app applies the multi-deck lists to every game. `deviations.js` `notes.fewDecks`
carries the teachable shifts:
- Insurance: about +1.4 (1D) and +2.4 (2D) against +3.0 (6D), +3.1 (8D) (`bjinfo-insurance`, attributed to Wong; `cnd-i18`). With a floored TC, +3 remains safe in 2D; +2 is the floored single-deck number.
- `cnd-i18` lists other 1D/2D values (e.g. 12 v 2 +4, 12 v 3 +3, 10 v A +2 (1D) / +3 (2D), 11 v A −1 (1D S17) / 0 (2D S17)). Single source, so only taught qualitatively.

## True count rounding: verdict

- **Schlesinger floors** and calls flooring the methodology of choice for computing the TC and applying indices (`schlesinger-floor`). Our I18 / Fab 4 numbers come from him, so `TC_ROUNDING = 'floor'` with "act when TC ≥ index" is consistent with the source of the indices.
- **qfit/Wattenberger**: floor is the most popular method; floor and round perform almost the same; truncation is slightly worse (`qfit-tc`).
- **Wong**, *Professional Blackjack*: truncates in the 1994 and later editions (`qfit-tc`).
- **Blackjack Apprenticeship teaches truncation**: "drop the decimal" (`bja-truncate`). Its charts' special "0+" and "0−" notation and its "−1−" for 13 v 2 read naturally under truncation, where TC 0 covers −0.99 to +0.99.
- Floor and truncate agree for every positive count and differ only below zero. That affects only the zero/negative plays (16 v 10, 12 v 4, 15 v 10 surrender, 13 v 2, 12 v 5, 12 v 6, 13 v 3). The lessons teach the floor and mention truncation once (m4-l7) so a student who meets BJA material is not confused.
- Deck estimation: nearest half deck in shoes (Wizard's sims, qfit); BJA starts beginners on whole decks rounded down. The app uses half decks (`hilo.js`).

## Numbers to verify against the engine

Hard-coded numbers in the lessons that the engine also computes (or could):

| Where | Number in the text | Source value | Engine (scratch run, 2026-10-08) |
|---|---|---|---|
| m1-l3 table | Dealer bust %, 6D H17: 2→36, 3→38, 4→40, 5→42, 6→44, 7→26, 8→24, 9→23, 10→23, A→20 (10/A after peek) | `woo-dealer-probs` | `dealer.js` (not run) |
| m2-l2 | Standing 16 v 7 wins "about a quarter of the time" (dealer bust 26%) | `woo-dealer-probs` | `dealer.js` |
| m1-l5, m3-l4, m6-l5, glossary | 6:5 costs about 1.4% | 1.39 (8D) | +1.36 (6D S17 DAS LS) |
| m3-l2, glossary | H17 costs about 0.2% | 0.22 | +0.197 |
| m3-l2 | 6→2 decks "almost 0.2%"; 6→1 "almost 0.5%"; 6→8 "a couple of hundredths" | 0.17 / 0.46 / 0.02 | −0.202 / −0.534 / +0.024 |
| m3-l3 table | DAS +0.14 | 0.14 | 0.141 |
| m3-l3 table | Double 10-11 only −0.18 | 0.18 | 0.192 |
| m3-l3 table | Double 9-11 only −0.09 | 0.09 | 0.096 |
| m3-l3 table | Late surrender +0.07 | 0.07 | 0.073 |
| m3-l3 table | Resplit aces +0.08 | 0.08 | 0.069 |
| m3-l3 table | No resplitting −0.1 | 0.10 | **0.053: check the split approximation in `ev.js`** |
| m3-l5 | ENHC costs about 0.1% | 0.11 | 0.11 (euro-enhc vs 6D S17 DAS no-LS) |
| m2-l5, m3-l2 | S17→H17 changes 6 cells: 11vA D, 15vA Rh, 17vA Rs, A7v2 Ds, A8v6 Ds, 8,8vA Rp | — | matches |
| m3-l2 | 6D H17 → 2D H17 (no LS): 9v2 D, A3v4 D, 6,6v2 P, 6,6v7 Ph, 7,7v8 Ph (+ A,A unsplit v5 D) | — | matches |
| m3-l3 | No DAS: 2,2/3,3 v 2-3 hit, 4,4 v 5-6 hit, 6,6 v 2 hit | — | matches |
| m3-l5 | ENHC: 11v10 H, 8,8 v 10/A H, A,A v A H | — | matches |
| m2-l2..l5 | Every basic-strategy statement for 6D H17 DAS LS | — | matches the engine chart |
| m5-l2 | Insurance break-even: tens = 1/3 of unseen cards, TC ≈ +3 in shoes | 10/3 | +3.33 (linear model) |
| m5 / deviations.js | Every index | tables above | "Engine" columns |
| m6-l1 | ~0.5% per TC; off the top ≈ −0.5 to −0.6% (6D H17) | 0.5; −0.556 (incl. cut card) | houseEdgeCD 0.528 (no cut-card effect); `sim.js` could measure edge by TC |
| m6-l4 | Flat SD ≈ 1.15 units/hand | 1.14-1.16 | `sim.js` |
| m6-l4 | SD ≈ 2.3 units/hand with a 1-10 spread | 2.27 (WoO sim) | `sim.js` with a 1-10 ramp |
| m6-l4 | N0 ≈ 70,000 rounds (6D H17 LS, 75%, 1-12) | 1e6/14.3 | `risk.js` for the default shoe ramp |
| m6-l5, m6-l6 | SCORE 7 / 14 / 27 by penetration; 8 (1-8); 60 (2D 1-6); $7 per 100 rounds at 2% RoR | `qfit-tables` (optimal ramps) | `risk.js` / `sim.js` with the app's ramps (expect lower: the app's ramps are not optimal) |
| m3-l6 | Counter edge 0.37% / 0.59% / 0.84% at 4 / 4.5 / 5 decks dealt (1-10 spread) | `woo-hilo` | `sim.js` |
| m6-l2 | The ramp table (shoe 1-12, double deck 1-8, single deck 1-4) | copied from `js/game/ramps.js` DEFAULT_RAMPS | keep in sync if ramps.js changes |
| m8-l2 | Test-out: 50 rounds, 95% overall, 90% in each part | copied from `js/views/play.js` | keep in sync |
| m4-l1 | EoR table (1D) | `qfit-mb-eor` | `ev.js` could compute EoR for the presets |
