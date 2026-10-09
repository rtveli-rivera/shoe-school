// content.js — loads the curriculum and glossary, tolerating a missing file
// (so the shell still runs while content is being written).

let lessons = null;
export async function loadLessons() {
  if (lessons) return lessons;
  try {
    const mod = await import('../data/lessons.js');
    lessons = mod.MODULES || [];
  } catch (err) {
    console.warn('lessons.js not available:', err);
    lessons = [];
  }
  return lessons;
}

export async function findLesson(id) {
  const MODULES = await loadLessons();
  for (let mi = 0; mi < MODULES.length; mi++) {
    const m = MODULES[mi];
    const li = m.lessons.findIndex((l) => l.id === id);
    if (li >= 0) return { module: m, moduleIndex: mi, lesson: m.lessons[li], lessonIndex: li, modules: MODULES };
  }
  return null;
}

let glossary = null;
export async function loadGlossary() {
  if (glossary) return glossary;
  try {
    const mod = await import('../data/glossary.js');
    glossary = mod.GLOSSARY || [];
  } catch {
    glossary = [];
  }
  return glossary;
}
