/** Mulberry32 PRNG — deterministic, fast, 32-bit state */
export type PRNG = () => number;

export function mulberry32(seed: number): PRNG {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPRNG(seed: number) {
  const rng = mulberry32(seed);
  return {
    /** [0, 1) */
    random: rng,
    /** Integer in [min, max) */
    randInt(min: number, max: number): number {
      return (rng() * (max - min) + min) | 0;
    },
    /** Boolean with given probability of true */
    randBool(p = 0.5): boolean {
      return rng() < p;
    },
    /** Pick one element */
    randChoice<T>(arr: T[]): T {
      return arr[(rng() * arr.length) | 0];
    },
    /** Fisher-Yates shuffle (in-place) */
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    /** Float in [min, max) */
    randFloat(min: number, max: number): number {
      return rng() * (max - min) + min;
    },
  };
}

export type PRNGHelper = ReturnType<typeof createPRNG>;
