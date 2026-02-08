/** Looping time utilities — t always in [0, 1) */

const TAU = Math.PI * 2;

/** Get normalised loop time from elapsed ms and period */
export function getLoopT(elapsedMs: number, periodMs: number): number {
  return ((elapsedMs % periodMs) / periodMs) % 1;
}

/** Sinusoidal oscillation mapped to [0, 1] */
export function loopSin(t: number): number {
  return (Math.sin(t * TAU) + 1) * 0.5;
}

/** Cosine oscillation mapped to [0, 1] */
export function loopCos(t: number): number {
  return (Math.cos(t * TAU) + 1) * 0.5;
}

/** Triangle wave [0, 1] */
export function loopTriangle(t: number): number {
  return 1 - Math.abs(2 * (t % 1) - 1);
}

/**
 * Map loop-t onto a circle in 2 extra dims for seamless 4D noise sampling.
 * Returns [cx, cy] that trace a circle of given radius as t goes 0→1.
 */
export function loopCircle(t: number, radius: number): [number, number] {
  return [Math.cos(t * TAU) * radius, Math.sin(t * TAU) * radius];
}

/**
 * Simple 2D value noise (hand-rolled, no deps).
 * Deterministic for given coordinates via integer hashing.
 */
function hash2d(ix: number, iy: number): number {
  let h = ix * 374761393 + iy * 668265263;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 2D value noise in [0, 1] — cheap, deterministic */
export function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const a = hash2d(ix, iy);
  const b = hash2d(ix + 1, iy);
  const c = hash2d(ix, iy + 1);
  const d = hash2d(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Looping 2D noise: samples a 2D noise field but loops seamlessly over t.
 * Uses the 4D circle trick projected onto 2 extra noise dimensions.
 */
export function loopingNoise2D(
  x: number,
  y: number,
  t: number,
  scale: number = 1,
  loopRadius: number = 1,
): number {
  const [cx, cy] = loopCircle(t, loopRadius);
  // Combine spatial + temporal coordinates via offset
  return valueNoise2D(x * scale + cx, y * scale + cy);
}
