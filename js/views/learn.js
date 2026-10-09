// learn.js — the curriculum map: modules in order, each gated by the last checkpoint.

import { el, progressBar } from '../ui.js';
import { lessonDone, moduleUnlocked, checkpoint, settings } from '../store.js';
import { loadLessons } from '../game/content.js';

export async function render(root) {
  const MODULES = await loadLessons();
  const total = MODULES.reduce((n, m) => n + m.lessons.length, 0);
  const done = MODULES.reduce((n, m) => n + m.lessons.filter((l) => lessonDone(l.id)).length, 0);
  const next = findNext(MODULES);

  root.append(
    el('div', { class: 'kicker' }, 'Blackjack from zero to card counter'),
    el('h1', {}, 'Learn'),
    el('div', { class: 'card' },
      el('div', { class: 'row between' }, el('b', {}, 'Your course'), el('span', { class: 'muted num' }, `${done} / ${total} lessons`)),
      el('div', { style: { margin: '10px 0' } }, progressBar(total ? done / total : 0)),
      next
        ? el('a', { class: 'btn primary block', href: `#/lesson/${next.lesson.id}` }, `${done ? 'Continue' : 'Start'}: ${next.lesson.title}`)
        : el('p', { class: 'muted', style: { margin: 0 } }, 'Every lesson done. Keep your skills sharp in Train and the Casino.'),
    ),
  );

  MODULES.forEach((m, i) => {
    const open = moduleUnlocked(MODULES, i);
    const cp = checkpoint(m.id);
    const nDone = m.lessons.filter((l) => lessonDone(l.id)).length;
    const box = el('div', { class: `card${open ? '' : ' locked'}` },
      el('div', { class: 'module' },
        el('div', { class: 'mico', 'aria-hidden': 'true' }, m.icon || '♠'),
        el('div', { class: 'grow' },
          el('div', { class: 'row between' },
            el('h3', {}, `${i + 1}. ${m.title}`),
            cp?.passed ? el('span', { class: 'pill good' }, '✓ passed') : !open ? el('span', { class: 'pill' }, '🔒') : null),
          el('p', {}, m.summary),
          progressBar(m.lessons.length ? nDone / m.lessons.length : 0, nDone === m.lessons.length ? 'good' : ''),
        ),
      ),
    );
    if (open) {
      const list = el('div', { style: { marginTop: '8px' } },
        m.lessons.map((l) => el('a', { class: 'lesson-row', href: `#/lesson/${l.id}` },
          el('span', { class: `tick${lessonDone(l.id) ? ' done' : ''}` }, lessonDone(l.id) ? '✓' : ''),
          el('span', {}, l.title),
          el('span', { class: 'mins' }, `${l.minutes || 3} min`))),
        m.checkpoint ? el('a', {
          class: 'lesson-row', href: checkpointHref(m),
        }, el('span', { class: `tick${cp?.passed ? ' done' : ''}` }, cp?.passed ? '✓' : '★'),
        el('span', {}, el('b', {}, 'Checkpoint: '), m.checkpoint.label || 'Pass to unlock the next module'),
        el('span', { class: 'mins' }, cp ? `best ${Math.round(cp.best * 100)}%` : `${Math.round(m.checkpoint.pass.accuracy * 100)}% to pass`)) : null,
      );
      box.append(list);
    } else {
      box.append(el('p', { class: 'faint', style: { margin: '8px 0 0', fontSize: '14px' } },
        `Pass the module ${i} checkpoint to open this. (Already know it? Settings → unlock everything.)`));
    }
    root.append(box);
  });

  if (!settings().unlockAll) {
    root.append(el('p', { class: 'faint center', style: { fontSize: '13px' } },
      'Modules open one at a time so each skill is solid before the next one builds on it.'));
  }
}

export function checkpointHref(m) {
  const q = new URLSearchParams({ checkpoint: m.id, p: JSON.stringify(m.checkpoint.params || {}) });
  return `#/drill/${m.checkpoint.drill}?${q}`;
}

function findNext(MODULES) {
  for (let i = 0; i < MODULES.length; i++) {
    if (!moduleUnlocked(MODULES, i)) return null;
    const lesson = MODULES[i].lessons.find((l) => !lessonDone(l.id));
    if (lesson) return { module: MODULES[i], lesson };
  }
  return null;
}
