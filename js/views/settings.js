// settings.js — game, index set, table, backup.

import { el, toast } from '../ui.js';
import { settings, setSetting, exportState, importState, resetAll } from '../store.js';
import { presetById } from '../engine/rules.js';
import { openGamePicker, APP_VERSION } from '../app.js';

export async function render(root, { navigate }) {
  const s = settings();
  const p = presetById(s.preset);
  const seg = (key, vals) => el('div', { class: 'seg' }, vals.map(([v, label]) => el('button', {
    type: 'button', class: s[key] === v ? 'on' : '', onclick: () => { setSetting(key, v); navigate('#/settings'); },
  }, label)));

  root.append(el('h1', {}, 'Settings'),
    el('div', { class: 'card' },
      el('div', { class: 'field' }, el('span', { class: 'label' }, 'The game you are training for'),
        el('div', { class: 'row between' }, el('b', {}, p.name), el('button', { class: 'btn small', type: 'button', onclick: () => openGamePicker(() => navigate('#/settings')) }, 'Change'))),
      el('div', { class: 'field' }, el('span', { class: 'label' }, 'Index plays the simulator expects'),
        seg('indexSet', [['none', 'None (basic only)'], ['i18', 'Illustrious 18'], ['i18fab4', 'I18 + Fab 4']])),
      el('div', { class: 'field' }, el('span', { class: 'label' }, 'Other players at the simulator table'),
        seg('seats', [[0, 'Just me'], [2, '2'], [4, '4'], [6, 'Full table']])),
      el('div', { class: 'field' }, el('span', { class: 'label' }, 'Dealing speed'),
        seg('dealSpeed', [[0.5, 'Learning'], [1, 'Normal'], [1.6, 'Fast'], [2.5, 'Real casino']])),
      el('div', { class: 'field' }, el('span', { class: 'label' }, 'Betting unit (dollars)'),
        el('input', { type: 'number', min: 1, step: 1, value: s.unitSize, onchange: (e) => setSetting('unitSize', Math.max(1, Number(e.target.value) || 25)) })),
      el('label', { class: 'switch' }, el('span', {}, 'Unlock every module (I already know the basics)'),
        el('input', { type: 'checkbox', checked: s.unlockAll, onchange: (e) => setSetting('unlockAll', e.target.checked) })),
    ),
    el('div', { class: 'card' },
      el('h3', { style: { marginTop: 0 } }, 'Your progress'),
      el('p', { class: 'muted', style: { fontSize: '14px' } }, 'Progress lives only on this device. Save a backup to move it to another phone or browser.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn small', type: 'button', onclick: download }, 'Save backup'),
        el('label', { class: 'btn small' }, 'Restore backup', el('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', onchange: restore })),
        el('button', { class: 'btn small bad', type: 'button', onclick: () => { if (confirm('Erase all progress and settings on this device?')) { resetAll(); toast('Progress erased.'); navigate('#/learn'); } } }, 'Erase everything')),
    ),
    el('p', { class: 'faint center', style: { fontSize: '12px' } }, `Shoe School v${APP_VERSION}`),
  );

  function download() {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `shoe-school-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function restore(e) {
    const f = e.target.files[0];
    if (!f) return;
    try { importState(await f.text()); toast('Backup restored.'); navigate('#/learn'); }
    catch (err) { toast(`Could not restore: ${err.message}`); }
  }
}
