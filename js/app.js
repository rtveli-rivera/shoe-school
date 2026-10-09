// app.js — the shell: hash router, the game-rules chip, offline updates.
const APP_VERSION = '0.1.1';
export { APP_VERSION };

import { el, clear, modal } from './ui.js';
import { PRESETS, presetById } from './engine/rules.js';
import { settings, setSetting, onChange } from './store.js';

// route name -> view module (loaded on first use, so startup stays fast)
const ROUTES = {
  learn: () => import('./views/learn.js'),
  lesson: () => import('./views/lesson.js'),
  train: () => import('./views/train.js'),
  drill: () => import('./views/drill.js'),
  play: () => import('./views/play.js'),
  charts: () => import('./views/charts.js'),
  more: () => import('./views/more.js'),
  tools: () => import('./views/tools.js'),
  glossary: () => import('./views/glossary.js'),
  settings: () => import('./views/settings.js'),
  about: () => import('./views/about.js'),
};
// which bottom tab lights up for each route
const TAB_OF = { learn: 'learn', lesson: 'learn', train: 'train', drill: 'train', play: 'play', charts: 'charts' };

const view = document.getElementById('view');
let cleanup = null;
let renderSeq = 0;

export function parseHash(hash = location.hash) {
  const h = hash.replace(/^#\/?/, '');
  const [path, qs = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const name = parts[0] || 'learn';
  const query = Object.fromEntries(new URLSearchParams(qs));
  return { name, args: parts.slice(1).map(decodeURIComponent), query };
}

export function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function render() {
  const seq = ++renderSeq;
  const route = parseHash();
  const loader = ROUTES[route.name] || ROUTES.learn;
  if (cleanup) { try { cleanup(); } catch { /* a view's teardown must not block navigation */ } cleanup = null; }
  document.body.classList.remove('fullscreen');
  document.querySelectorAll('.modal-back').forEach((m) => m.remove());
  const tab = TAB_OF[route.name] || (ROUTES[route.name] ? 'more' : 'learn');
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  try {
    const mod = await loader();
    if (seq !== renderSeq) return;            // a newer navigation won
    clear(view);
    window.scrollTo(0, 0);
    const out = await mod.render(view, { args: route.args, query: route.query, navigate });
    if (seq !== renderSeq) { if (typeof out === 'function') out(); return; }
    cleanup = typeof out === 'function' ? out : null;
    view.focus({ preventScroll: true });
  } catch (err) {
    console.error(err);
    clear(view);
    view.append(el('div', { class: 'card' },
      el('h2', {}, 'Something went wrong'),
      el('p', { class: 'muted' }, String(err && err.message || err)),
      el('a', { class: 'btn', href: '#/learn' }, 'Back to lessons')));
  }
}

// ---- the game chip: which casino rules everything is tuned to ----

const chip = document.getElementById('game-chip');
function paintChip() {
  const p = presetById(settings().preset);
  chip.textContent = `🎲 ${p ? p.short : 'Choose game'}`;
}

export function openGamePicker(onPick) {
  modal((close) => el('div', {},
    el('h2', { style: { marginTop: 0 } }, 'Which game are you training for?'),
    el('p', { class: 'muted' }, 'Charts, drills and the simulator all follow these rules. Pick the game you will actually play.'),
    PRESETS.map((p) => el('button', {
      class: `preset-opt${p.id === settings().preset ? ' on' : ''}`, type: 'button',
      onclick: () => { setSetting('preset', p.id); close(); if (onPick) onPick(p.id); else render(); },
    }, el('b', {}, p.name), el('small', {}, p.blurb))),
    el('button', { class: 'btn block ghost', type: 'button', onclick: close }, 'Cancel'),
  ));
}

chip.addEventListener('click', () => openGamePicker());
onChange(paintChip);
paintChip();

window.addEventListener('hashchange', render);
render();

// ---- offline + updates ----

// No service worker on localhost: start.bat / the dev preview should always load
// fresh files, and the Android app bundles its files anyway (it runs on
// https://localhost inside Capacitor). Offline caching is for the hosted PWA.
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if (LOCAL && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
}
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !LOCAL) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const banner = document.getElementById('update-banner');
    const offer = (worker) => {
      clear(banner);
      banner.append(el('span', {}, '♠ A new version of Shoe School is ready.'),
        el('button', { class: 'btn small primary', type: 'button', onclick: () => worker.postMessage('skipWaiting') }, 'Update'));
      banner.classList.remove('hidden');
    };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 60 * 60 * 1000);
  }).catch(() => { /* offline install not available: the app still works online */ });
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}
