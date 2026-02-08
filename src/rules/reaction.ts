import { loopTriangle } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';

/**
 * Cheap reaction-diffusion-esque fill: precompute a short cycle of
 * diffusion frames, index into cycle with loop-t for seamless looping.
 */
export function fillReaction(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  _rect: Rect,
  t: number,
  rng: PRNGHelper,
  _noiseAmount: number,
): void {
  const size = bw * bh;

  // Deterministic initial concentration
  const u = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    u[i] = rng.random() < 0.3 ? 1.0 : 0.0;
  }

  // Run a fixed number of diffusion + threshold iterations
  const totalIter = 8;
  // Use loopTriangle to pick how far into the iteration cycle we go
  const targetIter = Math.round(loopTriangle(t) * totalIter);

  const tmp = new Float32Array(size);
  const diffRate = 0.2;

  for (let iter = 0; iter < targetIter; iter++) {
    // Diffusion step (3×3 average) + growth/decay
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = (x + dx + bw) % bw;
            const ny = (y + dy + bh) % bh;
            sum += u[ny * bw + nx];
            count++;
          }
        }
        const avg = sum / count;
        const val = u[y * bw + x];
        // Blend toward average + nonlinear reaction
        const reacted = val + diffRate * (avg - val) + 0.02 * (val * (1 - val) * (val - 0.3));
        tmp[y * bw + x] = Math.max(0, Math.min(1, reacted));
      }
    }
    u.set(tmp);
  }

  // Threshold to B/W
  for (let i = 0; i < size; i++) {
    bitmap[i] = u[i] > 0.5 ? 1 : 0;
  }
}
