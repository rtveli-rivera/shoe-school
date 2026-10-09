# ♠ Shoe School — blackjack & card counting

A training app that takes someone who has never played blackjack to counting
cards accurately at a real casino table: perfect basic strategy for any rule set,
every common casino variant, Hi-Lo counting with the Illustrious 18 and Fab 4,
bet ramps and bankroll risk, and a casino simulator with a test-out.

No accounts, no server, no build step. It runs offline and keeps progress on
the device. Android APK via Capacitor.

**Live: https://rtveli-rivera.github.io/shoe-school/** (GitHub Pages, repo
[rtveli-rivera/shoe-school](https://github.com/rtveli-rivera/shoe-school)).

## Run it

Double-click **start.bat**. It serves the app on http://localhost:8146 and opens
your browser. Needs Python, which is used only as a static file server.

## What is inside

| Tab | What it does |
|---|---|
| **Learn** | 8 gated modules: the game → basic strategy → casino rules & variants → counting → index plays → betting & bankroll → casino survival → the simulator. Each ends in a checkpoint drill; passing opens the next. |
| **Train** | 14 drills: hand totals, dealer rules, payouts, strategy flashcards (missed cells come back), full hands, rule changes, card tags, pairs, deck countdown, running count, deck estimation from the discard tray, true count, index plays, bet ramp. |
| **Casino** | A full table: other players, your bets on your ramp, your plays (index plays at the live count), insurance, random count checks, face-up or pitch dealing. Practice mode corrects on the spot; the 50-round test-out grades silently. The summary charts luck vs skill: your result against what your play was worth (bets × the edge at each count, minus what each mistake cost), inside the band of normal luck. |
| **Charts** | The strategy chart for any game, with what every play is worth (tap a cell); the index plays; house edge by game. |
| **More** | Bankroll & risk tools (simulate your game + ramp: win per hour, risk of ruin, N0, SCORE, edge at each true count), glossary, settings, backup. |

Games: 1/2/4/6/8 decks, H17/S17, DAS, double restrictions, late surrender, resplits,
3:2 vs 6:5, European no-hole-card (and original-bets-only), face-up vs pitch
dealing, and Double Exposure (its own chart).

## How the numbers are made

- **Strategy charts are computed, not copied.** `js/engine/` is an exact
  combinatorial analysis of the shoe for each rule set (cards drawn without
  replacement, total-dependent basic strategy). Checked against the Wizard of
  Odds tables: 28,787 of 28,800 cells match over 80 rule sets, with every
  difference explained. House edges match published figures within 0.0075% over
  60 rule sets. Details in `docs/VALIDATION.md`.
- **Two independent implementations agree.** The Monte Carlo simulator
  (`js/engine/sim.js`) deals real cards; with flat bets and basic strategy it
  reproduces the engine's house edge for every game type (`test/sim.test.mjs`).
- **Index plays are the published Hi-Lo numbers**, cross-checked between sources;
  see `docs/SOURCES.md`. True counts are floored (rounded down).

## Tests

```
npm test
```

53 tests on Node 24's built-in runner, no packages needed (about 30 s). Seeds
and round counts are fixed, so results are deterministic.

After editing `docs/SOURCES.md` run `node scripts/build-sources.mjs`; after
changing the engine or presets run `npm run build:charts`.

## Install it on a phone

**Android app (APK)**: works fully offline. Share this link; it always points
at the newest version:

**https://github.com/rtveli-rivera/shoe-school/releases/latest/download/shoe-school.apk**

1. Open the link on the Android phone and download the file.
2. Tap the downloaded file. Android asks to allow installs from this source
   (Chrome or Files): **Settings → Allow from this source**, then go back.
3. Tap **Install**. If Google Play Protect asks to scan the app, let it scan;
   if it says the app is unknown, choose **More details → Install anyway**.

Updates: download the new APK from the same link and install it over the old
one. Progress is kept.

iPhones cannot install APKs; use the web version below.

*Building it* (needs JDK 17 and the Android SDK, both set up on this PC):

```
npm install              # once
npm run build:apk        # signed release -> dist/shoe-school.apk (the one to share)
npm run build:apk:debug  # debug build -> dist/shoe-school-debug.apk
```

The release key is **not in this repo**. It lives in
`%USERPROFILE%\.android\shoe-school-release.jks` with its passwords in
`shoe-school-signing.properties` next to it. **Back up both files.** Without them
you can still build, but phones will refuse to install the new APK over the old one
(people would have to uninstall first and lose their progress).
`npm run icons` regenerates the launcher icons and splash screen from `icons/icon.svg`.

**PWA** (any phone): open https://rtveli-rivera.github.io/shoe-school/ on the phone.
- **Android (Chrome):** ⋮ menu → **Install app** / Add to Home Screen.
- **iPhone (Safari):** Share → **Add to Home Screen**.

It launches full-screen and works offline after the first visit. Progress is kept
per device (Settings → Save backup to move it).

### Releasing an update

```
py bump.py           # bumps the app + Android version and the offline cache, regenerates the file list
```

Then `git commit -am "release"` and `git push`: GitHub Pages redeploys the same URL
within a minute, and installed copies show an "Update" banner. For Android, also
`npm run build:apk` and attach `dist/shoe-school.apk` (keep that exact file name)
to a new GitHub release tagged with the version, e.g. `v0.1.1`. The download link
above then serves it automatically.

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
