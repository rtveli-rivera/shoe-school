// rng.js — small seeded PRNG so drills, the simulator and tests are repeatable.
//
// mulberry32: 32-bit state, fast, good enough statistical quality for card games.
// Never used for anything security-related.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

// Integer in [0, n).
export function randInt(rand, n) {
  return Math.floor(rand() * n);
}

export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

// In-place Fisher-Yates.
export function shuffle(rand, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
