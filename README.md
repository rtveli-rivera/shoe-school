# ♠ Shoe School — blackjack & card counting

A training app that takes someone who has never played blackjack to counting
cards accurately at a real casino table: perfect basic strategy for any rule set,
every common casino variant, Hi-Lo counting with the Illustrious 18 and Fab 4,
bet ramps and bankroll risk, and a casino simulator with a test-out.

No accounts, no server, no build step. It runs offline and keeps progress on
the device. Android APK via Capacitor.

## Run it

Double-click **start.bat**. It serves the app on http://localhost:8146 and opens
your browser. Needs Python, which is used only as a static file server.

## What is inside

| Tab | What it does |
|---|---|
| **Learn** | 8 gated modules: the game → basic strategy → casino rules & variants → counting → index plays → betting & bankroll → casino survival → the simulator. Each ends in a checkpoint drill; passing opens the next. |
| **Train** | 14 drills: hand totals, dealer rules, payouts, strategy flashcards (missed cells come back), full hands, rule changes, card tags, pairs, deck countdown, running count, deck estimation from the discard tray, true count, index plays, bet ramp. |
| **Casino** | A full table: other players, your bets on your ramp, your plays (index plays at the live count), insurance, random count checks, face-up or pitch dealing. Practice mode corrects on the spot; the 50-round test-out grades silently. |
| **Charts** | The strategy chart for any game, with what every play is worth (tap a cell); the index plays; house edge by game. |
| **More** | Bankroll & risk tools (simulate your game + ramp: win per hour, risk of ruin, N0, SCORE, edge at each true count), glossary, settings, backup. |

Games: 1/2/4/6/8 decks, H17/S17, DAS, double restrictions, late surrender, resplits,
3:2 vs 6:5, European no-hole-card (and original-bets-only), face-up vs pitch
dealing, and Double Exposure (its own chart).

## How the numbers are made

- **Strategy charts are computed, not copied.** `js/engine/` is an exact
  combinatorial analysis of the shoe for each rule set (cards drawn without
  replacement, total-dependent basic strategy). Every chart was then compared
  cell by cell with published charts; see `docs/VALIDATION.md`.
- **Two independent implementations agree.** The Monte Carlo simulator
  (`js/engine/sim.js`) deals real cards; with flat bets and basic strategy it
  reproduces the engine's house edge for every game type (`test/sim.test.mjs`).
- **Index plays are the published Hi-Lo numbers**, cross-checked between sources;
  see `docs/SOURCES.md`. True counts are floored (rounded down).

## Tests

```
npm test
```

Node 24's built-in runner, no packages needed. Seeds and round counts are fixed,
so results are deterministic.

## Install it on a phone

**Android APK** (works fully offline, no hosting):

```
npm install
npm run icons        # once: Android launcher icons from icons/icon.svg
npx cap add android  # once: creates android/
npm run build:apk    # -> dist/shoe-school.apk
```

Copy `dist/shoe-school.apk` to the phone and open it (allow "install unknown apps"
for your file manager once).

**PWA** (any phone, needs HTTPS hosting): push this folder to GitHub Pages (or drop
it on Netlify), open the URL on the phone, then "Add to Home Screen". It works
offline after the first visit.

### Releasing an update

```
py bump.py           # bumps the version + the offline cache, regenerates the file list
```

Then commit and push (PWA) or `npm run build:apk` (Android). Installed PWAs show
an "Update" banner.

## Layout

```
index.html  css/  icons/  manifest.webmanifest  sw.js
js/app.js                 shell + router
js/engine/                rules, Hi-Lo, exact strategy engine, Double Exposure, simulator, risk
js/data/                  lessons, index plays, glossary, precomputed charts
js/game/                  table model, cards, charts, ramps (UI side)
js/drills/  js/views/     one file per drill / screen
scripts/                  chart precompute, local server, APK + icon builders
test/                     node --test
docs/                     VALIDATION.md, SOURCES.md
SPEC.md                   the brief and the contracts between the parts
```

## A note on play

Counting is legal, but casinos are private property and can refuse your play.
Even a perfect counter has a small edge and big swings. Play only with money you
can afford to lose. In the US, the free National Problem Gambling Helpline is 1-800-MY-RESET (1-800-697-3738).
