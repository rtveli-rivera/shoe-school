// play.js — the casino simulator: a full table, your bets, your plays, your count.
//
// Practice mode corrects you on the spot. Test-out mode grades silently and
// shows everything at the end. Grading is fair to the counter: a bet or a play
// counts as right if it matches the true count computed with either the exact
// decks remaining or the half-deck estimate you would make from the tray.

import { el, sleep, numberPad, fmtSigned, fmtPct, mdInline } from '../ui.js';
import { handEl, cardEl } from '../game/cards.js';
import { Table, cardsValue } from '../game/table.js';
import { trayEl } from '../game/tray.js';
import { strategy, doubleExposure, ACTIONS, CODE_TEXT } from '../game/shared.js';
import { rampFor, unitsFor } from '../game/ramps.js';
import { actionButtons, choiceButtons } from '../drills/common.js';
import { allowedSet } from '../drills/bs-flash.js';
import { settings, recordSim, recordCheckpoint } from '../store.js';
import { presetById, rulesFor, describeRules } from '../engine/rules.js';
import { trueCount } from '../engine/hilo.js';
import { mulberry32, randomSeed } from '../engine/rng.js';
import { loadLessons } from '../game/content.js';
import { openGamePicker } from '../app.js';

const TEST_ROUNDS = 50;

export async function render(root, { query, navigate }) {
  const presetId = query.preset && presetById(query.preset) ? query.preset : settings().preset;
  const mode = query.mode === 'test' ? 'test' : (query.mode === 'practice' ? 'practice' : null);
  if (!mode || query.setup) return setupScreen(root, presetId, query, navigate);
  return runTable(root, presetId, mode, query, navigate);
}

function setupScreen(root, presetId, query, navigate) {
  const p = presetById(presetId);
  const rules = rulesFor(presetId);
  const go = (mode) => {
    const q = new URLSearchParams({ preset: presetId, mode, ...(query.checkpoint ? { checkpoint: query.checkpoint } : {}) });
    navigate(`#/play?${q}`);
  };
  root.append(el('div', { class: 'kicker' }, 'Casino simulator'), el('h1', {}, 'Take a seat'),
    el('div', { class: 'card' },
      el('div', { class: 'row between' }, el('b', {}, p.name),
        el('button', { class: 'btn small', type: 'button', onclick: () => openGamePicker((id) => navigate(`#/play?preset=${id}`)) }, 'Change game')),
      el('p', { class: 'muted', style: { fontSize: '14px', margin: '6px 0 0' } }, describeRules(rules).join(' · '))),
    el('div', { class: 'grid2' },
      el('button', { class: 'card link', type: 'button', style: { textAlign: 'left' }, onclick: () => go('practice') },
        el('div', { style: { fontSize: '26px' } }, '🎓'), el('h3', { style: { margin: '6px 0 4px' } }, 'Practice'),
        el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' } }, 'Every bet, play and count is checked on the spot. You can peek at the count.')),
      el('button', { class: 'card link', type: 'button', style: { textAlign: 'left' }, onclick: () => go('test') },
        el('div', { style: { fontSize: '26px' } }, '🏁'), el('h3', { style: { margin: '6px 0 4px' } }, `Test-out (${TEST_ROUNDS} rounds)`),
        el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' } }, 'Real conditions. No help, no feedback until the end. Pass it and you are table-ready.'))),
    el('div', { class: 'card tight', style: { marginTop: '12px' } },
      el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' } },
        `Table: ${settings().seats} other player${settings().seats === 1 ? '' : 's'}, index plays: ${{ none: 'none', i18: 'Illustrious 18', i18fab4: 'I18 + Fab 4' }[settings().indexSet]}, speed ×${settings().dealSpeed}. `,
        el('a', { href: '#/settings' }, 'Change in Settings'), '.')),
  );
}

async function runTable(root, presetId, mode, query, navigate) {
  const rules = rulesFor(presetId);
  const s = await strategy();
  const de = rules.variant === 'de' ? await doubleExposure() : null;
  const st = settings();
  const speed = st.dealSpeed || 1;
  const indexSet = st.indexSet;
  const ramp = rampFor(rules);
  const rand = mulberry32(randomSeed());
  const table = new Table({ rules, rand, bots: st.seats });
  const me = table.seats[table.myIndex];
  document.body.classList.add('fullscreen');

  let alive = true;
  let showCount = mode === 'practice' && st.showCount;
  let lastBet = 1;
  let round = 0;          // rounds started (the HUD shows the one in play)
  let completed = 0;      // rounds finished (the summary counts these)
  let net = 0;
  const stats = { decisions: 0, errors: 0, bets: 0, betErrors: 0, counts: 0, countErrors: 0, insurance: 0, insuranceErrors: 0 };
  const mistakes = [];
  let nextCheck = 3 + Math.floor(rand() * 3);

  // ---- layout ----
  const hud = el('div', { class: 'hud' });
  const felt = el('div', { class: 'felt' });
  const controls = el('div', { style: { marginTop: '12px', minHeight: '120px' } });
  const note = el('div');
  const logBox = el('div', { class: 'log' });
  root.append(
    el('div', { class: 'row between', style: { marginBottom: '8px' } },
      el('button', { class: 'btn small ghost', type: 'button', onclick: () => endSession('exit') }, '✕ Leave table'),
      el('span', { class: 'pill gold' }, `${presetById(presetId).short} · ${mode === 'test' ? 'TEST-OUT' : 'practice'}`)),
    hud, el('div', { style: { height: '8px' } }), felt, note, controls,
    mode === 'practice' ? el('details', { class: 'more card tight', style: { marginTop: '12px' } }, el('summary', {}, 'Mistakes this session'), logBox) : null,
  );

  const decisionTc = () => ({
    est: table.tc,
    exact: trueCount(table.rc, table.decksLeftExact),
  });

  function paintHud() {
    const acc = stats.decisions ? `${(100 - (stats.errors / stats.decisions) * 100).toFixed(0)}%` : '—';
    hud.replaceChildren(
      el('span', {}, 'Round ', el('b', { class: 'num' }, mode === 'test' ? `${round}/${TEST_ROUNDS}` : round)),
      el('span', {}, 'Result ', el('b', { class: 'num' }, `${fmtSigned(net)}u`)),
      el('span', {}, 'Plays ', el('b', { class: 'num' }, acc)),
      showCount ? el('span', {}, 'RC ', el('b', { class: 'num' }, fmtSigned(table.rc)), ' · TC ', el('b', { class: 'num' }, fmtSigned(table.tc))) : null,
      mode === 'practice' ? el('button', { class: 'btn small ghost', type: 'button', style: { minHeight: '28px', padding: '2px 10px' }, onclick: () => { showCount = !showCount; paintHud(); } }, showCount ? 'Hide count' : 'Peek count') : null,
    );
  }

  function seatEl(seat) {
    const active = table.activeSeat === seat;
    return el('div', { class: `seat${seat.me ? ' me' : ''}${active ? ' active' : ''}` },
      el('span', { class: 'sname' }, seat.name),
      seat.hands.length ? el('div', { class: 'row', style: { gap: '6px', justifyContent: 'center', flexWrap: 'nowrap' } }, seat.hands.map((h, i) => {
        // a card you have not seen yet is drawn face down (pitch games, double cards)
        const hidden = h.cards.map((c, k) => (c.seen ? -1 : k)).filter((k) => k >= 0);
        const shownAll = hidden.length === 0;
        const v = cardsValue(h.cards);
        return el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', outline: seat.me && active && table.activeHand === i && seat.hands.length > 1 ? '2px solid var(--gold)' : 'none', borderRadius: '8px', padding: '2px' } },
          handEl(h.cards, { hidden, spread: false }),
          shownAll && h.cards.length ? el('span', { class: 'total-badge' }, `${v.soft && v.total < 21 ? 's' : ''}${v.total}`) : null,
          el('span', { class: 'bet' }, `${h.bet}u`),
          h.result ? el('span', { class: `outcome ${h.net > 0 ? 'win' : h.net < 0 ? 'lose' : 'push'}` }, h.result) : null);
      })) : el('span', { class: 'faint', style: { fontSize: '11px' } }, '—'));
  }

  function paint() {
    const d = table.dealer;
    const dv = cardsValue(d.cards.filter((_, i) => !(i === 1 && d.holeHidden)));
    const others = table.seats.filter((x) => !x.me);
    felt.replaceChildren(
      el('div', { class: 'row between', style: { alignItems: 'flex-start' } },
        el('div', { class: 'shoe-mini' }, el('div', { style: { transform: 'scale(0.42)', transformOrigin: 'top left', width: '34px', height: '96px' } }, trayEl(rules.decks, table.discards, { label: '' }))),
        el('div', { class: 'dealer-zone' }, el('span', { class: 'label' }, 'Dealer'),
          handEl(d.cards, { hidden: d.holeHidden ? [1] : [], spread: true }),
          d.cards.length ? el('span', { class: 'total-badge' }, `${dv.soft && dv.total < 21 && !d.holeHidden ? 's' : ''}${dv.total}`) : el('span', { style: { height: '22px' } })),
        el('div', { style: { width: '34px' } })),
      el('div', { class: 'felt-msg' }, rules.variant === 'de' ? 'Double Exposure · ties lose · blackjack pays 1:1' : `Blackjack pays ${rules.bjPays === 1.5 ? '3 to 2' : '6 to 5'} · dealer ${rules.hitSoft17 ? 'hits' : 'stands on'} soft 17`),
      others.length ? el('div', { class: 'seat-row others' }, others.map(seatEl)) : null,
      el('div', { class: 'seat-row me-zone', style: { marginTop: '8px' } }, seatEl(me)),
    );
    paintHud();
  }

  function logMistake(kind, text) {
    mistakes.push({ kind, text, round });
    logBox.prepend(el('div', { class: 'bad', html: mdInline(`R${round} · ${text}`) }));
  }

  function practiceNote(ok, text) {
    if (mode !== 'practice') return;
    note.replaceChildren(el('div', { class: `feedback ${ok ? 'good' : 'bad'}`, style: { margin: '8px 0 0', padding: '8px 12px' }, html: mdInline(text) }));
  }

  // ---- the io the table calls ----
  const io = {
    update: paint,
    pause: (kind) => sleep((kind === 'deal' ? 170 : kind === 'dealer' ? 420 : kind === 'action' ? 160 : 260) / speed),
    bet: (seat) => {
      if (!seat.me) return Promise.resolve(1 + Math.floor(rand() * 3));
      return askBet();
    },
    insurance: (seat) => {
      if (!seat.me) return Promise.resolve(false);
      return new Promise((resolve) => {
        const tc = decisionTc();
        const right = s.takeInsurance(tc.est, rules);
        const rightAlt = s.takeInsurance(tc.exact, rules);
        const opts = [{ label: 'Insurance', value: true }, { label: 'No insurance', value: false }];
        const c = choiceButtons(opts, (val) => {
          c.lock();
          const ok = val === right || val === rightAlt;
          stats.insurance++; if (!ok) { stats.insuranceErrors++; logMistake('insurance', `Insurance at TC ${fmtSigned(tc.est)}: should ${right ? 'take' : 'decline'}`); }
          practiceNote(ok, ok ? '✓ Insurance decision right.' : `✗ At true count ${fmtSigned(tc.est)} you should **${right ? 'take' : 'decline'}** insurance (take it at +3 or more).`);
          resolve(val);
        });
        controls.replaceChildren(el('p', { class: 'prompt' }, 'Dealer shows an ace. Insurance?'), c.node);
      });
    },
    decide: (seat, hand, opts) => {
      const ranks = hand.cards.map((c) => c.v);
      const dealerRanks = table.dealer.cards.map((c) => c.v);
      if (!seat.me) {
        const res = de ? de.decideDE(ranks, dealerRanks, rules, { ...opts, indexSet: 'none' }) : s.decide(ranks, dealerRanks[0], rules, { ...opts, indexSet: 'none' });
        return sleep(260 / speed).then(() => res.action);
      }
      return new Promise((resolve) => {
        const tc = decisionTc();
        const ask = (t) => de
          ? de.decideDE(ranks, dealerRanks, rules, { ...opts, tc: t, indexSet })
          : s.decide(ranks, dealerRanks[0], rules, { ...opts, tc: t, indexSet });
        const res = ask(tc.est);
        const resAlt = ask(tc.exact);
        const buttons = actionButtons(allowedSet(opts), (picked) => {
          buttons.lock();
          const ok = picked === res.action || picked === resAlt.action;
          stats.decisions++;
          if (!ok) {
            stats.errors++;
            const why = res.source === 'deviation' ? ` (index play: ${res.deviation?.label || 'deviation'})` : ` (chart: ${CODE_TEXT[res.code] || res.code})`;
            logMistake('play', `${cardsValue(hand.cards).soft ? 'soft ' : ''}${cardsValue(hand.cards).total} vs ${dealerRanks[0] === 1 ? 'A' : dealerRanks[0]} at TC ${fmtSigned(tc.est)}: you ${ACTIONS[picked].label.toLowerCase()}, right is **${ACTIONS[res.action].label}**${why}`);
            practiceNote(false, `✗ **${ACTIONS[res.action].label}**${why}. Playing your choice.`);
          } else {
            practiceNote(true, res.source === 'deviation' ? `✓ Index play: ${res.deviation?.label || ''}` : '✓');
          }
          resolve(picked);
        });
        controls.replaceChildren(buttons.node);
      });
    },
  };

  // ---- betting ----
  function askBet() {
    return new Promise((resolve) => {
      let bet = lastBet;
      const tc = decisionTc();
      const shown = el('div', { class: 'result-big num', style: { fontSize: '34px' } });
      const paintBet = () => { shown.textContent = `${bet}u · $${bet * st.unitSize}`; };
      const chip = (u, cls) => el('button', { class: `chipbtn ${cls}`, type: 'button', onclick: () => { bet = Math.min(bet + u, 40); paintBet(); } }, `+${u}`);
      const deal = () => {
        document.removeEventListener('keydown', onKey);
        const right = unitsFor(ramp, tc.est);
        const rightAlt = unitsFor(ramp, tc.exact);
        const ok = bet === right || bet === rightAlt;
        stats.bets++;
        if (!ok) { stats.betErrors++; logMistake('bet', `Bet ${bet}u at TC ${fmtSigned(tc.est)}: the ramp says **${right}u**`); }
        practiceNote(ok, ok ? `✓ Bet right for true count ${fmtSigned(tc.est)}.` : `✗ At true count ${fmtSigned(tc.est)} your ramp says **${right} unit${right > 1 ? 's' : ''}**.`);
        lastBet = bet;
        resolve(bet);
      };
      const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); deal(); } };
      document.addEventListener('keydown', onKey);
      controls.replaceChildren(
        el('p', { class: 'center muted', style: { margin: '0 0 4px' } }, 'Place your bet'),
        shown,
        el('div', { class: 'chips' }, chip(1, 'chip-1'), chip(2, 'chip-5'), chip(4, 'chip-25'), chip(8, 'chip-100'),
          el('button', { class: 'btn small', type: 'button', onclick: () => { bet = 1; paintBet(); } }, 'Min')),
        el('button', { class: 'btn primary block', type: 'button', style: { marginTop: '10px' }, onclick: deal }, 'Deal (Enter)'));
      paintBet();
    });
  }

  // ---- count checks ----
  function askNumber(prompt) {
    return new Promise((resolve) => {
      const pad = numberPad({ onSubmit: (v) => { pad.setDisabled(true); resolve(v); } });
      controls.replaceChildren(el('p', { class: 'prompt' }, prompt), pad.node);
    });
  }

  async function countCheck(reason) {
    const rc = table.rc;
    const tc = decisionTc();
    const a = await askNumber(reason === 'shuffle' ? 'Shuffle time. What was the final running count?' : 'Count check: what is the running count?');
    if (!alive) return;
    stats.counts++;
    const okRc = a === rc;
    if (!okRc) { stats.countErrors++; logMistake('count', `Running count was **${fmtSigned(rc)}**, you said ${fmtSigned(a)}`); }
    if (reason === 'shuffle') { practiceNote(okRc, okRc ? '✓ Count right. New shoe: start again from 0.' : `✗ It was **${fmtSigned(rc)}**. New shoe: start again from 0.`); return; }
    const b = await askNumber(`And the true count? (${table.decksLeftEstimate} deck${table.decksLeftEstimate === 1 ? '' : 's'} left: read the tray)`);
    if (!alive) return;
    stats.counts++;
    const okTc = b === tc.est || b === tc.exact;
    if (!okTc) { stats.countErrors++; logMistake('count', `True count was **${fmtSigned(tc.est)}**, you said ${fmtSigned(b)}`); }
    practiceNote(okRc && okTc, `${okRc ? '✓' : '✗'} Running count ${fmtSigned(rc)} · ${okTc ? '✓' : '✗'} true count ${fmtSigned(tc.est)} (${table.decksLeftEstimate} decks left).`);
  }

  // ---- the session ----
  async function loop() {
    paint();
    while (alive) {
      if (table.needsShuffle) {
        await countCheck('shuffle');
        if (!alive) return;
        table.newShoe();
        paint();
        controls.replaceChildren(el('p', { class: 'felt-msg', style: { color: 'var(--muted)' } }, '🔀 The dealer shuffles. Count starts at 0.'));
        await sleep(900 / speed);
      }
      if (round >= nextCheck) {
        await countCheck('check');
        nextCheck = round + 3 + Math.floor(rand() * 4);
        if (!alive) return;
      }
      round++;
      const result = await table.playRound(io);
      if (!alive) return;
      completed++;
      const mine = result.results?.find((r) => r.me);
      if (mine) net += mine.net;
      paint();
      controls.replaceChildren(el('p', { class: 'felt-msg', style: { color: 'var(--muted)' } },
        !mine ? '' : mine.net > 0 ? `You win ${mine.net}u` : mine.net < 0 ? `You lose ${-mine.net}u` : 'Push'));
      await sleep(1000 / speed);
      if (mode === 'test' && round >= TEST_ROUNDS) { endSession('done'); return; }
    }
  }

  async function endSession(why) {
    if (!alive) return;
    alive = false;
    document.body.classList.remove('fullscreen');
    recordSim({ rounds: completed, decisions: stats.decisions, errors: stats.errors, betErrors: stats.betErrors, countChecks: stats.counts, countErrors: stats.countErrors });
    const part = (n, e) => (n ? (n - e) / n : 1);
    const show = (n, e) => (n ? `${fmtPct(part(n, e) * 100, 1)} (${n - e}/${n})` : '—');
    const playAcc = part(stats.decisions + stats.insurance, stats.errors + stats.insuranceErrors);
    const betAcc = part(stats.bets, stats.betErrors);
    const countAcc = part(stats.counts, stats.countErrors);
    const total = stats.decisions + stats.insurance + stats.bets + stats.counts;
    const overall = total ? (total - stats.errors - stats.insuranceErrors - stats.betErrors - stats.countErrors) / total : 0;
    let verdict = null;
    if (mode === 'test') {
      const finished = why === 'done';
      let passAcc = 0.95;
      let cpModule = null;
      if (query.checkpoint) {
        const MODULES = await loadLessons();
        cpModule = MODULES.find((m) => m.id === query.checkpoint);
        passAcc = cpModule?.checkpoint?.pass?.accuracy || passAcc;
      }
      const passed = finished && overall >= passAcc && playAcc >= 0.9 && betAcc >= 0.9 && countAcc >= 0.9;
      recordSim({ test: { ts: Date.now(), preset: presetId, overall, passed } });
      if (cpModule) recordCheckpoint(cpModule.id, { accuracy: overall, passed });
      verdict = el('div', { class: `feedback ${passed ? 'good' : 'bad'}` }, el('b', {}, passed ? '✓ Test passed. ' : finished ? 'Not yet. ' : 'Test abandoned. '),
        passed ? 'You played, bet and counted like a professional. Keep it sharp with short sessions.' : `You need ${Math.round(passAcc * 100)}% overall and at least 90% in each part over all ${TEST_ROUNDS} rounds.`);
    }
    root.replaceChildren(
      el('div', { class: 'kicker' }, mode === 'test' ? 'Test-out results' : 'Session summary'),
      el('h1', {}, `${completed} round${completed === 1 ? '' : 's'} · ${fmtSigned(net)} units`),
      verdict,
      el('div', { class: 'card' }, el('div', { class: 'kv' },
        el('span', {}, 'Playing decisions'), el('span', { class: 'v' }, show(stats.decisions + stats.insurance, stats.errors + stats.insuranceErrors)),
        el('span', {}, 'Bets on the ramp'), el('span', { class: 'v' }, show(stats.bets, stats.betErrors)),
        el('span', {}, 'Count checks'), el('span', { class: 'v' }, show(stats.counts, stats.countErrors)),
        el('span', {}, 'Overall'), el('span', { class: 'v' }, total ? fmtPct(overall * 100, 1) : '—'))),
      mistakes.length ? el('div', { class: 'card' }, el('h3', { style: { marginTop: 0 } }, 'Every mistake'),
        el('div', { class: 'log', style: { maxHeight: 'none' } }, mistakes.map((m) => el('div', { class: 'bad', html: mdInline(`R${m.round} · ${m.text}`) })))) : el('p', { class: 'muted' }, 'No mistakes. 👏'),
      el('p', { class: 'faint', style: { fontSize: '13px' } }, 'The units won or lost are luck over a few rounds; only the accuracy numbers say anything about you.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', type: 'button', onclick: () => navigate(`#/play?preset=${presetId}&mode=${mode}${query.checkpoint ? `&checkpoint=${query.checkpoint}` : ''}&r=${Date.now()}`) }, 'Play again'),
        el('a', { class: 'btn', href: '#/play?setup=1' }, 'Change table'),
        el('a', { class: 'btn ghost', href: '#/learn' }, 'Back to the course')),
    );
  }

  loop().catch((err) => {
    if (!alive) return;
    console.error(err);
    controls.replaceChildren(el('div', { class: 'feedback bad' }, `The table hit an error: ${err.message}`));
  });

  return () => { if (alive) { alive = false; document.body.classList.remove('fullscreen'); } };
}
