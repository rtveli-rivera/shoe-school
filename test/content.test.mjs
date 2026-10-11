// The curriculum files load and only point at things that exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../js/data/lessons.js';
import { GLOSSARY } from '../js/data/glossary.js';
import { SOURCES } from '../js/data/sources.js';
import { DRILLS } from '../js/drills/index.js';
import { PRESETS } from '../js/engine/rules.js';

const drillIds = new Set(DRILLS.map((d) => d.id));
const presetIds = new Set(PRESETS.map((p) => p.id));

test('lessons: 8 modules in order, unique ids, valid drills, presets and quizzes', () => {
  assert.deepEqual(MODULES.map((m) => m.id), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']);
  const ids = new Set();
  for (const m of MODULES) {
    assert.ok(m.lessons.length > 0, m.id);
    assert.ok(drillIds.has(m.checkpoint.drill), `${m.id} checkpoint drill ${m.checkpoint.drill}`);
    for (const l of m.lessons) {
      assert.ok(!ids.has(l.id), `duplicate lesson id ${l.id}`);
      ids.add(l.id);
      for (const b of l.blocks) {
        if (b.t === 'drill') assert.ok(drillIds.has(b.drill), `${l.id}: unknown drill ${b.drill}`);
        for (const pid of [b.preset, b.from, b.to, b.params?.preset, ...(b.presets || [])]) {
          if (pid) assert.ok(presetIds.has(pid), `${l.id}: unknown preset ${pid}`);
        }
        if (b.t === 'quiz') assert.ok(b.answer >= 0 && b.answer < b.options.length, `${l.id}: quiz answer out of range`);
      }
    }
  }
});

test('every inline source key in the lessons and glossary resolves to a citation', () => {
  const text = JSON.stringify(MODULES) + JSON.stringify(GLOSSARY);
  const keys = new Set([...text.matchAll(/`([a-z0-9]+-[a-z0-9-]+)`/g)].map((m) => m[1]));
  const missing = [...keys].filter((k) => !SOURCES[k]);
  assert.deepEqual(missing, []);
});

test('glossary terms are unique', () => {
  const terms = GLOSSARY.map((g) => g.term.toLowerCase());
  assert.equal(new Set(terms).size, terms.length);
});
