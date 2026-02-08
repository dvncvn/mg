import { loopSin, loopCos } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';

// 8×8 Bayer matrix (normalised to [0, 1))
const BAYER8 = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
].map((v) => v / 64);

/**
 * Ordered dithering fill: apply Bayer dithering over an animated gradient.
 * Gradient direction and phase animate with loop-t.
 */
export function fillDither(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  _rect: Rect,
  t: number,
  rng: PRNGHelper,
  _noiseAmount: number,
): void {
  // Gradient angle varies per rect, phase sweeps with t
  const angle = rng.random() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const phase = loopSin(t);
  const phaseB = loopCos(t + 0.25);

  const maxDim = Math.max(bw, bh) || 1;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      // Normalised gradient value [0, 1]
      const grad = ((x * dx + y * dy) / maxDim + phase) % 1;
      const value = (grad + phaseB * 0.3) % 1;
      const bayerVal = BAYER8[(y & 7) * 8 + (x & 7)];
      bitmap[y * bw + x] = value < bayerVal ? 1 : 0;
    }
  }
}
