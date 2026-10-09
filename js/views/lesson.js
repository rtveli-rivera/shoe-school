// lesson.js — renders one lesson from its blocks (format: SPEC.md, js/data/lessons.js).

import { el, md, mdInline, fmtPct } from '../ui.js';
import { markLesson, lessonDone, moduleUnlocked } from '../store.js';
import { findLesson } from '../game/content.js';
import { cardEl } from '../game/cards.js';
import { chartFor, strategy, doubleExposure, currentPresetId, CODE_TEXT, rowLabel, tableName } from '../game/shared.js';
import { chartTable, chartLegend, chartDiff, evBreakdown } from '../game/chartview.js';
import { rulesFor, presetById } from '../engine/rules.js';
import { checkpointHref } from './learn.js';

export async function render(root, { args }) {
  const found = await findLesson(args[0]);
  if (!found) {
    root.append(el('div', { class: 'card' }, el('p', {}, 'That lesson does not exist (yet).'), el('a', { class: 'btn', href: '#/learn' }, 'All lessons')));
    return;
  }
  const { module: m, moduleIndex, lesson, lessonIndex, modules } = found;
  if (!moduleUnlocked(modules, moduleIndex)) {
    root.append(el('div', { class: 'card' },
      el('h2', {}, '🔒 Not open yet'),
      el('p', { class: 'muted' }, `Pass the checkpoint at the end of module ${moduleIndex} first. Each module builds on the last.`),
      el('a', { class: 'btn primary', href: '#/learn' }, 'Back to the course')));
    return;
  }

  root.append(
    el('div', { class: 'row between' },
      el('a', { href: '#/learn', class: 'muted', style: { textDecoration: 'none' } }, `← ${m.icon || ''} ${m.title}`),
      el('span', { class: 'faint', style: { fontSize: '13px' } }, `Lesson ${lessonIndex + 1} of ${m.lessons.length} · ${lesson.minutes || 3} min`)),
    el('h1', {}, lesson.title),
  );

  for (const block of lesson.blocks || []) {
    try {
      const node = await renderBlock(block);
      if (node) root.append(node);
    } catch (err) {
      console.error('block failed', block, err);
      root.append(el('div', { class: 'feedback bad' }, `This part of the lesson could not be shown (${block.t}).`));
    }
  }

  // footer: done + next
  const nextLesson = m.lessons[lessonIndex + 1];
  const nextHref = nextLesson ? `#/lesson/${nextLesson.id}` : (m.checkpoint ? checkpointHref(m) : '#/learn');
  const nextLabel = nextLesson ? `Next: ${nextLesson.title}` : (m.checkpoint ? `Take the checkpoint: ${m.checkpoint.label || 'module test'}` : 'Back to the course');
  root.append(el('div', { class: 'card', style: { marginTop: '20px' } },
    el('a', { class: 'btn primary block', href: nextHref, onclick: () => markLesson(lesson.id) }, `✓ Done · ${nextLabel}`),
    lessonDone(lesson.id) ? el('p', { class: 'faint center', style: { margin: '8px 0 0', fontSize: '13px' } }, 'You have completed this lesson before.') : null,
  ));
}

async function renderBlock(b) {
  switch (b.t) {
    case 'p': return md('p', b.md);
    case 'h': return el('h2', {}, b.text);
    case 'list': return el(b.ordered ? 'ol' : 'ul', {}, (b.items || []).map((it) => md('li', it)));
    case 'tip': case 'warn': case 'pro':
      return el('div', { class: `callout ${b.t}` }, md('p', b.md));
    case 'table':
      return el('div', { class: 'chart-wrap' },
        el('table', { class: 'plain' },
          b.head ? el('thead', {}, el('tr', {}, b.head.map((h) => el('th', { html: mdInline(h) })))) : null,
          el('tbody', {}, (b.rows || []).map((r) => el('tr', {}, r.map((c) => el('td', { html: mdInline(String(c)) })))))),
        b.caption ? md('p', b.caption, { class: 'faint', style: 'font-size:13px' }) : null);
    case 'cards':
      return el('div', {},
        el('div', { class: 'cards-row' }, (b.cards || []).map((c) => cardEl(c))),
        b.caption ? md('p', b.caption, { class: 'muted center', style: 'font-size:14px' }) : null);
    case 'quiz': return quizBlock(b);
    case 'drill': return drillBlock(b);
    case 'chart': return chartBlock(b);
    case 'diff': return diffBlock(b);
    case 'he': return heBlock(b);
    default:
      console.warn('unknown block', b);
      return null;
  }
}

function quizBlock(b) {
  const fb = el('div');
  let answered = false;
  const buttons = b.options.map((opt, i) => el('button', {
    class: 'choice', type: 'button', html: mdInline(opt),
    onclick: () => {
      if (answered) return;
      answered = true;
      buttons.forEach((btn, j) => { if (j === b.answer) btn.classList.add('correct'); else if (j === i) btn.classList.add('wrong'); });
      fb.append(el('div', { class: `feedback ${i === b.answer ? 'good' : 'bad'}` },
        el('b', {}, i === b.answer ? 'Correct. ' : 'Not quite. '), el('span', { html: mdInline(b.explain || '') })));
    },
  }));
  return el('div', { class: 'card quiz' }, el('div', { class: 'kicker' }, 'Quick check'), md('p', b.q, { style: 'font-weight:600' }), el('div', { class: 'choices' }, buttons), fb);
}

function drillBlock(b) {
  const q = new URLSearchParams({ p: JSON.stringify(b.params || {}) });
  return el('a', { class: 'card link', href: `#/drill/${b.drill}?${q}` },
    el('div', { class: 'row' }, el('span', { style: { fontSize: '26px' } }, '🎯'),
      el('div', { class: 'grow' }, el('b', {}, b.label || 'Practice'), el('div', { class: 'muted', style: { fontSize: '14px' } }, 'Opens a drill. Come back here when you are done.'))));
}

async function chartBlock(b) {
  const presetId = b.preset || currentPresetId();
  const p = presetById(presetId);
  const chart = await chartFor(presetId);
  if (rulesFor(presetId).variant === 'de') {
    return el('div', { class: 'card' }, el('p', {}, 'The Double Exposure chart is on the Charts tab (Double Exposure game).'),
      el('a', { class: 'btn small', href: '#/charts?preset=double-exposure' }, 'Open the chart'));
  }
  const tables = b.table ? [b.table] : ['hard', 'soft', 'pairs'];
  const detail = el('div');
  const onCell = (table, row, up, code) => explainCell(detail, chart, table, row, up, code);
  return el('div', { class: 'card' },
    el('div', { class: 'row between' }, el('b', {}, p ? p.name : 'Strategy chart'), el('span', { class: 'pill gold' }, p ? p.short : '')),
    tables.map((t) => el('div', {}, tables.length > 1 ? el('h3', {}, tableName(t)) : null,
      chartTable(chart, t, { highlight: (b.highlight || []).map((h) => Array.isArray(h) ? h : [h.row, h.up]), onCell }))),
    chartLegend(), detail,
    el('p', { class: 'faint', style: { fontSize: '13px', margin: 0 } }, 'Tap any cell to see why.'));
}

export function explainCell(target, chart, table, row, up) {
  target.replaceChildren(evBreakdown(chart, table, row, up));
}

async function diffBlock(b) {
  const [ca, cb] = await Promise.all([chartFor(b.from), chartFor(b.to)]);
  const pa = presetById(b.from), pb = presetById(b.to);
  const diffs = chartDiff(ca, cb);
  const box = el('div', { class: 'card' },
    el('div', { class: 'kicker' }, 'What changes'),
    el('p', {}, el('b', {}, pa.short), ' → ', el('b', {}, pb.short), `: ${diffs.length} chart cell${diffs.length === 1 ? '' : 's'} change.`));
  if (diffs.length) {
    box.append(el('table', { class: 'plain' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Hand'), el('th', {}, pa.short), el('th', {}, pb.short))),
      el('tbody', {}, diffs.map((d) => el('tr', {},
        el('td', {}, `${tableName(d.table).split(' ')[0]} ${rowLabel(d.table, d.row)} vs ${d.up}`),
        el('td', {}, CODE_TEXT[d.a] || d.a), el('td', {}, el('b', {}, CODE_TEXT[d.b] || d.b)))))));
  }
  return box;
}

async function heBlock(b) {
  const s = await strategy();
  const items = [];
  for (const id of b.presets || []) {
    const p = presetById(id);
    if (!p) continue;
    let he = null;
    try {
      const rules = rulesFor(id);
      if (rules.variant === 'de') {
        he = (await doubleExposure()).houseEdgeDE(rules);
      } else {
        await chartFor(id);
        he = s.houseEdge(rules);
      }
    } catch (err) { console.warn(err); }
    items.push({ p, he });
  }
  const max = Math.max(0.5, ...items.map((i) => Math.abs(i.he ?? 0)));
  return el('div', { class: 'card' },
    el('div', { class: 'kicker' }, 'House edge with perfect basic strategy'),
    el('div', { class: 'he-bars' }, items.map(({ p, he }) => el('div', { class: 'he-bar' },
      el('span', {}, p.short),
      el('div', { class: 'track' }, he === null ? null : el('div', { class: `fill${he < 0 ? ' neg' : ''}`, style: { width: `${Math.abs(he) / max * 100}%` } })),
      el('b', { class: 'num' }, he === null ? '…' : fmtPct(he))))),
    el('p', { class: 'faint', style: { fontSize: '13px', margin: 0 } }, 'Computed by the app’s engine for each game’s exact rules. A negative number means the player has the edge.'));
}
