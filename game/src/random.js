// A small seeded random number generator (mulberry32): the same seed always deals the same
// field of mines and cores, which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random point inside the field, kept at least `clearance` away from (x, y). Tries a few times, then settles. */
export function randomPointClearOf(random, clearance, x, y, width, height) {
  let px = 0;
  let py = 0;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    px = random() * width;
    py = random() * height;
    const dx = px - x;
    const dy = py - y;
    if (dx * dx + dy * dy >= clearance * clearance) break;
  }
  return { x: px, y: py };
}
