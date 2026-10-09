// train.js — every drill, grouped by the module that opens it.

import { el } from '../ui.js';
import { DRILLS } from '../drills/index.js';
import { drillStats, moduleUnlocked } from '../store.js';
import { loadLessons } from '../game/content.js';

export async function render(root) {
  const MODULES = await loadLessons();
  root.append(el('div', { class: 'kicker' }, 'Practice'), el('h1', {}, 'Train'),
    el('p', { class: 'lead' }, 'Short, repeatable drills. A few minutes a day beats an hour once a week.'));

  const byModule = new Map();
  for (const d of DRILLS) {
    if (!byModule.has(d.module)) byModule.set(d.module, []);
    byModule.get(d.module).push(d);
  }
  for (const [mid, drills] of byModule) {
    const mi = MODULES.findIndex((m) => m.id === mid);
    const m = MODULES[mi];
    const open = mi < 0 || moduleUnlocked(MODULES, mi);
    root.append(el('h2', {}, m ? `${m.icon || ''} ${m.title}` : mid));
    root.append(el('div', { class: 'grid2' }, drills.map((d) => {
      const st = drillStats(d.id);
      const last = st.history[st.history.length - 1];
      const acc = last && last.items ? Math.round((last.correct / last.items) * 100) : null;
      const href = d.id === 'casino' ? '#/play' : `#/drill/${d.id}`;
      return el(open ? 'a' : 'div', { class: `card link${open ? '' : ' locked'}`, href: open ? href : undefined },
        el('div', { class: 'row between' }, el('span', { style: { fontSize: '24px' } }, d.icon),
          open ? (acc !== null ? el('span', { class: `pill ${acc >= 90 ? 'good' : ''}` }, `last ${acc}%`) : el('span', { class: 'pill' }, 'new')) : el('span', { class: 'pill' }, '🔒')),
        el('h3', { style: { margin: '8px 0 4px' } }, d.title),
        el('p', { class: 'muted', style: { margin: 0, fontSize: '14px' } }, d.blurb),
        st.sessions ? el('p', { class: 'faint', style: { margin: '6px 0 0', fontSize: '12px' } }, `${st.sessions} session${st.sessions > 1 ? 's' : ''} · ${st.items} items${st.bestMs && d.id === 'deck-countdown' ? ` · best ${(st.bestMs / 1000).toFixed(1)}s` : ''}`) : null);
    })));
  }
}
