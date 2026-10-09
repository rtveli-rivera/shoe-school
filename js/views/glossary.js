// glossary.js — searchable list of terms.

import { el, mdInline } from '../ui.js';
import { loadGlossary } from '../game/content.js';

export async function render(root) {
  const terms = (await loadGlossary()).slice().sort((a, b) => a.term.localeCompare(b.term));
  const list = el('div');
  const paint = (q) => {
    const f = q.trim().toLowerCase();
    const shown = terms.filter((t) => !f || t.term.toLowerCase().includes(f) || t.def.toLowerCase().includes(f));
    list.replaceChildren(...shown.map((t) => el('div', { class: 'card tight' }, el('b', {}, t.term), el('div', { class: 'muted', style: { fontSize: '14px' }, html: mdInline(t.def) }))),
      shown.length ? '' : el('p', { class: 'muted' }, 'No term matches.'));
  };
  root.append(el('h1', {}, 'Glossary'),
    el('input', { type: 'text', placeholder: 'Search terms…', 'aria-label': 'Search terms', oninput: (e) => paint(e.target.value), style: { marginBottom: '12px' } }),
    list);
  paint('');
}
