import { loopingNoise2D, loopSin } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';

/**
 * Thresholded noise fill: sample looping 2D noise, threshold to B/W.
 * Threshold animates with loop-t for temporal evolution.
 */
export function fillNoise(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  rect: Rect,
  t: number,
  rng: PRNGHelper,
  noiseAmount: number,
): void {
  const offsetX = rng.random() * 100;
  const offsetY = rng.random() * 100;
  const scale = 0.08 + rng.random() * 0.12; // spatial frequency
  const baseThreshold = 0.35 + rng.random() * 0.3;
  // Animate threshold
  const threshold = baseThreshold + loopSin(t) * 0.15 * noiseAmount;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const nx = (rect.x + x + offsetX) * scale;
      const ny = (rect.y + y + offsetY) * scale;
      const n = loopingNoise2D(nx, ny, t, 1, 1.5);
      bitmap[y * bw + x] = n < threshold ? 1 : 0;
    }
  }
}
