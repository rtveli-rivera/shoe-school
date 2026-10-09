// more.js — the rest: bankroll tools, glossary, settings, about.

import { el } from '../ui.js';
import { getState } from '../store.js';

export async function render(root) {
  const sim = getState().sim;
  const links = [
    ['#/tools', '🧮', 'Bankroll & risk', 'Bet ramps, win rate, risk of ruin and hours to the long run, simulated for your game.'],
    ['#/glossary', '📖', 'Glossary', 'Every term from “hole card” to “N0”.'],
    ['#/settings', '⚙️', 'Settings', 'Your game, index set, table speed, backup and reset.'],
    ['#/about', '♠', 'About & responsible play', 'How the numbers are computed, the sources, and when to stop.'],
  ];
  root.append(el('h1', {}, 'More'),
    el('div', { class: 'grid2' }, links.map(([href, ico, title, blurb]) => el('a', { class: 'card link', href },
      el('div', { style: { fontSize: '24px' } }, ico), el('h3', { style: { margin: '6px 0 4px' } }, title),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' } }, blurb)))),
    sim.rounds ? el('div', { class: 'card', style: { marginTop: '12px' } },
      el('div', { class: 'kicker' }, 'Casino simulator so far'),
      el('div', { class: 'kv', style: { marginTop: '8px' } },
        el('span', {}, 'Rounds played'), el('span', { class: 'v' }, sim.rounds),
        el('span', {}, 'Playing accuracy'), el('span', { class: 'v' }, sim.decisions ? `${(100 - (sim.errors / sim.decisions) * 100).toFixed(1)}%` : '—'),
        el('span', {}, 'Count checks right'), el('span', { class: 'v' }, sim.countChecks ? `${(100 - (sim.countErrors / sim.countChecks) * 100).toFixed(0)}%` : '—'))) : null,
  );
}
