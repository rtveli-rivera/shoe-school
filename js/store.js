// store.js — progress and settings, kept in localStorage on this device only.
//
// Every read and write is wrapped: private windows and cleared storage must
// never break the app, they just start fresh.

import { DEFAULT_PRESET_ID, presetById } from './engine/rules.js';

const KEY = 'shoeschool.v1';

const DEFAULT_STATE = () => ({
  v: 1,
  settings: {
    preset: DEFAULT_PRESET_ID,
    unlockAll: false,
    indexSet: 'i18fab4',     // 'none' | 'i18' | 'i18fab4'
    seats: 3,                // other players at the simulator table
    dealSpeed: 1,            // 0.5 slow … 2 fast
    showCount: false,        // simulator: show the running/true count while playing
    ramp: null,              // custom bet ramp, or null for the preset default
    unitSize: 25,            // dollars per betting unit (bankroll tools + simulator)
  },
  lessons: {},               // lessonId -> timestamp completed
  checkpoints: {},           // moduleId -> { passed, best, ts }
  drills: {},                // drillId -> { sessions, items, correct, bestMs, history: [...] }
  misses: {},                // drillId -> { itemKey: weight } (spaced repetition of mistakes)
  sim: { rounds: 0, decisions: 0, errors: 0, betErrors: 0, countChecks: 0, countErrors: 0, tests: [] },
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    const base = DEFAULT_STATE();
    const merged = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) }, sim: { ...base.sim, ...(parsed.sim || {}) } };
    if (!presetById(merged.settings.preset)) merged.settings.preset = DEFAULT_PRESET_ID;
    return merged;
  } catch {
    return DEFAULT_STATE();
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked: keep going in memory */ }
  for (const fn of listeners) { try { fn(state); } catch { /* a listener's bug must not stop the others */ } }
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function getState() { return state; }
export function settings() { return state.settings; }

export function setSetting(key, value) {
  state.settings[key] = value;
  save();
}

// ---- lessons & modules ----

export function lessonDone(id) { return Boolean(state.lessons[id]); }
export function markLesson(id) {
  if (!state.lessons[id]) { state.lessons[id] = Date.now(); save(); }
}

export function checkpoint(moduleId) { return state.checkpoints[moduleId] || null; }

export function recordCheckpoint(moduleId, { accuracy, passed }) {
  const prev = state.checkpoints[moduleId] || { passed: false, best: 0 };
  state.checkpoints[moduleId] = { passed: prev.passed || passed, best: Math.max(prev.best || 0, accuracy), ts: Date.now() };
  save();
}

// A module is open when it is the first, when the previous module's checkpoint
// is passed, or when the student chose "unlock everything".
export function moduleUnlocked(modules, index) {
  if (state.settings.unlockAll || index === 0) return true;
  const prev = modules[index - 1];
  return Boolean(prev && state.checkpoints[prev.id]?.passed);
}

// ---- drills ----

export function drillStats(id) {
  return state.drills[id] || { sessions: 0, items: 0, correct: 0, bestMs: null, history: [] };
}

export function recordDrill(id, { items, correct, ms, extra }) {
  const d = state.drills[id] || { sessions: 0, items: 0, correct: 0, bestMs: null, history: [] };
  d.sessions += 1;
  d.items += items;
  d.correct += correct;
  if (ms && items && correct === items && (d.bestMs === null || ms < d.bestMs)) d.bestMs = ms;
  d.history.push({ ts: Date.now(), items, correct, ms: ms || null, ...(extra ? { extra } : {}) });
  if (d.history.length > 30) d.history.splice(0, d.history.length - 30);
  state.drills[id] = d;
  save();
}

export function misses(drillId) { return state.misses[drillId] || {}; }

// Raise the weight of an item the student missed; decay it when they get it right.
export function noteItem(drillId, key, correct) {
  const m = state.misses[drillId] || (state.misses[drillId] = {});
  if (correct) {
    if (m[key]) { m[key] = Math.max(0, m[key] - 1); if (!m[key]) delete m[key]; }
  } else {
    m[key] = Math.min(6, (m[key] || 0) + 3);
  }
  save();
}

// ---- simulator ----

export function recordSim(delta) {
  for (const [k, v] of Object.entries(delta)) {
    if (k === 'test') { state.sim.tests.push(v); if (state.sim.tests.length > 20) state.sim.tests.shift(); }
    else state.sim[k] = (state.sim[k] || 0) + v;
  }
  save();
}

// ---- backup ----

export function exportState() { return JSON.stringify(state, null, 2); }
export function importState(json) {
  const parsed = JSON.parse(json);
  if (!parsed || parsed.v !== 1 || typeof parsed.settings !== 'object') throw new Error('Not a Shoe School backup');
  state = { ...DEFAULT_STATE(), ...parsed };
  save();
}
export function resetAll() { state = DEFAULT_STATE(); save(); }
