/** PRNG determinista (mulberry32) — permite tests reproducibles y, en juego,
 * particionar el azar de escenarios del azar visual/físico si algún día hace falta. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickRandom<T>(arr: readonly T[], rand: () => number = Math.random): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function makeSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
