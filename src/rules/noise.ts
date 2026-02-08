import { loopingNoise2D, loopSin } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Thresholded noise fill: sample looping 2D noise, threshold to B/W.
 * Scale controls spatial frequency; density shifts the threshold.
 * Noise is stretched along a per-rect random angle for directional grain.
 */
export function fillNoise(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const offsetX = rng.random() * 100;
  const offsetY = rng.random() * 100;
  const baseScale = 0.08 + rng.random() * 0.12;
  // Exponential mapping: scale=0.1 → 30x finer, scale=6 → 0.06x (huge blobs)
  const scale = baseScale * Math.pow(params.scale, -1.5);

  // Anisotropic stretch: sometimes elongate along a random angle
  const angle = rng.random() < 0.35 ? rng.random() * Math.PI : 0;
  const stretch = 1.5 + rng.random() * 2.5;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Density shifts the threshold: low density = more black, high = more white
  const baseThreshold = 0.2 + params.density * 0.6; // 0.2–0.8
  const threshold = baseThreshold + loopSin(t) * 0.12 * params.noiseAmount;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const px = rect.x + x + offsetX;
      const py = rect.y + y + offsetY;
      // Rotate into stretch space, scale along one axis, sample noise
      const rx = (px * cosA + py * sinA) * scale;
      const ry = (-px * sinA + py * cosA) * scale * stretch;
      const n = loopingNoise2D(rx, ry, t, 1, 1.5);
      bitmap[y * bw + x] = n < threshold ? 1 : 0;
    }
  }
}
