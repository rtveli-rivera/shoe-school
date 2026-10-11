# Shoe School — blackjack & Hi-Lo card counting trainer

A no-build PWA (vanilla ES modules) plus a Capacitor Android APK that takes a
beginner to accurate card counting. Live at https://rtveli-rivera.github.io/shoe-school/
(GitHub Pages from `main`, public repo `rtveli-rivera/shoe-school`). Shareable APK:
https://github.com/rtveli-rivera/shoe-school/releases/latest/download/shoe-school.apk

**Read `SPEC.md` first** (the brief and the contracts between engine, data and UI),
then `README.md` (user-facing: run, install, release).

## Correctness comes first

- Strategy charts and house edges are **computed** by `js/engine/` (exact
  combinatorial analysis), never copied. They are validated against published
  tables in `docs/VALIDATION.md` (28,787 / 28,800 cells; house edge within 0.0075%).
- Index plays (I18 + Fab 4, S17 and H17) come from `docs/SOURCES.md`. True counts are
  **floored**. A `when: 'le'` entry uses `index = printed − 1`.
- `sim.js` (dealt cards) must keep matching the engine's house edge (`test/sim.test.mjs`).
- Never hand-edit the generated files. Regenerate them instead:
  - `js/data/charts.js`: `npm run build:charts` after changing the engine or presets;
  - `js/data/tcedges.js`: `node scripts/build-tcedges.mjs`;
  - `js/data/sources.js`: `node scripts/build-sources.mjs` after editing `docs/SOURCES.md`.
- No copying of Blackjack Apprenticeship text or branding. Facts and indices are fine.

## Working on it

- Preview: the `shoe-school` config in `.claude/launch.json` (`scripts/serve.py`, port
  8146, no-cache; plain `http.server` served stale modules). The owner uses `start.bat`.
- `npm test`: 62 tests, about 30 s, deterministic.
- Strings in `js/data/lessons.js` are single-quoted. A plain apostrophe written by a
  script breaks the file, so use ’. `test/content.test.mjs` catches it.
- A preview tab that isn't in front throttles timers to about 1 s, so the simulator
  looks slow there. That's not a bug.

## Releasing (done this way for 0.1.0 and 0.1.2)

1. `py bump.py`: app version, offline cache, Android versionName/versionCode.
2. Commit and `git push`. Pages redeploys in about 30 s.
3. `npm run build:apk`: a signed release build to `dist/shoe-school.apk`, verified with apksigner.
4. Create a GitHub release, tagged `vX.Y.Z`, with the asset named exactly `shoe-school.apk`.
   - `gh` isn't installed; use Claude in Chrome. The owner is signed in to GitHub there,
     not in the built-in browser.
   - Upload the file first, then fill in the title and notes, because the upload turns
     the form into a draft.
   - `file_upload` only reads session folders, so copy the APK to the scratchpad first.
   - Publishing is public: ask the owner first.

**Signing key:** `%USERPROFILE%\.android\shoe-school-release.jks` plus
`shoe-school-signing.properties`, which holds the password. Never put either in the repo
and never print the password. If it's lost, new APKs can no longer install over the old ones.

## Owner's decisions (2026-10-08 to 10-11)

- **Counting:** Hi-Lo with the I18 + Fab 4 only.
- **Games:** every standard variant, face-up vs pitch dealing, and Double Exposure.
- **Extras:** the casino simulator, the bankroll tools, and casino survival.
  No streaks or gamification.
- **No live win/loss graph at the table.** The session summary has the
  "Luck or skill?" chart instead (result vs. what the play was worth, inside a
  normal-luck band).
- **💡 Hint** (the strategy chart with the hand marked, or the bet ramp while betting; key `?`; called "peek" in the code):
  - practice mode only;
  - not scored in the simulator, and hinted hands are fed to the flashcards;
  - a hint counts as a miss in drills;
  - never available in checkpoints or the test-out.
- **Publishing:** a new GitHub release only after the owner says yes. Pushing to
  `main` is the normal web deploy.
