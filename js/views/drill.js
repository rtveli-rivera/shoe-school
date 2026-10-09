// drill.js — runs one drill session: header, item counter, accuracy, timer,
// then a summary (and the pass/fail verdict when it is a module checkpoint).

import { el, clear, fmtMs, progressBar } from '../ui.js';
import { drillById } from '../drills/index.js';
import { recordDrill, recordCheckpoint, settings, moduleUnlocked } from '../store.js';
import { loadLessons } from '../game/content.js';
import { rulesFor, presetById } from '../engine/rules.js';
import { mulberry32, randomSeed } from '../engine/rng.js';

export async function render(root, { args, query, navigate }) {
  const id = args[0];
  const meta = drillById(id);
  if (!meta) { root.append(el('p', {}, 'Unknown drill.'), el('a', { class: 'btn', href: '#/train' }, 'All drills')); return; }

  let params = {};
  try { params = query.p ? JSON.parse(query.p) : {}; } catch { params = {}; }
  const MODULES = await loadLessons();
  const cpModule = query.checkpoint ? MODULES.find((m) => m.id === query.checkpoint) : null;
  const checkpoint = cpModule?.checkpoint || null;

  // gate: a drill opens with its module
  const mi = MODULES.findIndex((m) => m.id === meta.module);
  if (mi >= 0 && !moduleUnlocked(MODULES, mi)) {
    root.append(el('div', { class: 'card' }, el('h2', {}, '🔒 Not open yet'),
      el('p', { class: 'muted' }, `This drill opens with module ${mi + 1}: ${MODULES[mi].title}.`),
      el('a', { class: 'btn primary', href: '#/learn' }, 'Back to the course')));
    return;
  }

  if (id === 'casino') {
    const q = new URLSearchParams({ ...(params.preset ? { preset: params.preset } : {}), mode: params.mode || 'practice', ...(cpModule ? { checkpoint: cpModule.id } : {}) });
    navigate(`#/play?${q}`);
    return;
  }

  const presetId = params.preset || settings().preset;
  const rules = rulesFor(presetId);
  const target = checkpoint?.pass?.items || params.items || meta.items || 20;
  const mod = await import(`../drills/${id}.js`);

  let items = 0, correct = 0, t0 = null, done = false, cleanup = null, tick = null;
  const stage = el('div');
  const statItems = el('b', { class: 'num' }, `0/${target}`);
  const statAcc = el('b', { class: 'num' }, '—');
  const statTime = el('span', { class: 'timer' }, '0.0s');
  const barWrap = el('div', { style: { margin: '6px 0 14px' } }, progressBar(0));

  root.append(
    el('div', { class: 'drill-head' },
      el('a', { class: 'btn small ghost', href: query.back || (checkpoint ? '#/learn' : '#/train'), 'aria-label': 'Back' }, '←'),
      el('div', { class: 'grow' },
        el('h1', {}, `${meta.icon} ${meta.title}`),
        el('div', { class: 'drill-stats' },
          el('span', {}, statItems), el('span', {}, 'accuracy ', statAcc), statTime,
          checkpoint ? el('span', { class: 'pill gold' }, `checkpoint · ${Math.round(checkpoint.pass.accuracy * 100)}% to pass`) : null)),
    ),
    params.preset || ['bs-flash', 'bs-hands', 'dealer-rules', 'payouts', 'true-count', 'deviation-flash', 'deck-estimation'].includes(id)
      ? el('p', { class: 'faint', style: { margin: '-6px 0 6px', fontSize: '13px' } }, `Rules: ${presetById(presetId)?.name || presetId}`) : null,
    barWrap,
    stage,
  );

  const paint = () => {
    statItems.textContent = `${items}/${target}`;
    statAcc.textContent = items ? `${Math.round((correct / items) * 100)}%` : '—';
    barWrap.replaceChildren(progressBar(items / target, items && correct === items ? 'good' : ''));
  };

  const ctx = {
    params, presetId, rules,
    rand: mulberry32(params.seed ?? randomSeed()),
    stage,
    isCheckpoint: Boolean(checkpoint),
    get done() { return done; },
    start() { if (t0 === null) { t0 = performance.now(); tick = setInterval(() => { statTime.textContent = fmtMs(performance.now() - t0); }, 100); } },
    elapsed() { return t0 === null ? 0 : performance.now() - t0; },
    report(ok) {
      if (done) return;
      ctx.start();
      items++; if (ok) correct++;
      paint();
      if (items >= target) done = true;
    },
    // Call after an item's feedback: either the next item or the summary.
    advance(next) { if (done) finish(); else next(); },
    finish: (extra) => finish(extra),
  };

  function finish(extra) {
    if (stage.dataset.finished) return;
    stage.dataset.finished = '1';
    done = true;
    clearInterval(tick);
    const ms = ctx.elapsed();
    if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
    const acc = items ? correct / items : 0;
    recordDrill(id, { items, correct, ms, extra });
    let verdict = null;
    if (checkpoint) {
      const passAcc = acc >= checkpoint.pass.accuracy;
      const passTime = checkpoint.pass.maxMs ? ms <= checkpoint.pass.maxMs : true;
      const passed = passAcc && passTime && items >= (checkpoint.pass.items || 1);
      recordCheckpoint(cpModule.id, { accuracy: acc, passed });
      const nextModule = MODULES[MODULES.indexOf(cpModule) + 1];
      verdict = el('div', { class: `feedback ${passed ? 'good' : 'bad'}` },
        el('b', {}, passed ? '✓ Checkpoint passed. ' : 'Not yet. '),
        passed
          ? (nextModule ? `Module ${MODULES.indexOf(nextModule) + 1}, ${nextModule.title}, is open.` : 'That was the last checkpoint. You are ready for real tables.')
          : `You need ${Math.round(checkpoint.pass.accuracy * 100)}%${checkpoint.pass.maxMs ? ` in under ${fmtMs(checkpoint.pass.maxMs)}` : ''}. Practise the drills in this module, then try again.`);
    }
    clear(stage);
    stage.append(el('div', { class: 'card center' },
      el('div', { class: 'kicker' }, 'Session complete'),
      el('div', { class: 'result-big num' }, `${Math.round(acc * 100)}%`),
      el('p', { class: 'muted' }, `${correct} of ${items} correct · ${fmtMs(ms)}${items ? ` · ${(ms / items / 1000).toFixed(1)}s per item` : ''}`),
      extra?.summary ? el('p', {}, extra.summary) : null,
      verdict,
      el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '14px' } },
        el('button', { class: 'btn primary', type: 'button', onclick: () => navigate(location.hash) }, 'Go again'),
        el('a', { class: 'btn', href: checkpoint ? '#/learn' : '#/train' }, checkpoint ? 'Back to the course' : 'All drills')),
    ));
  }

  cleanup = mod.mount(stage, ctx) || null;
  return () => { clearInterval(tick); if (typeof cleanup === 'function') cleanup(); };
}
