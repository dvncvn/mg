import { loopSin, loopCos, loopingNoise2D } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Angled column/curtain fill: stripes at a per-rect angle with
 * noise-modulated widths and density, creating a waterfall/drip texture.
 */
export function fillColumns(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const offsetX = rng.random() * 200;
  const offsetY = rng.random() * 200;

  // Per-rect angle — mostly vertical, occasionally tilted
  const angle = rng.random() < 0.35 ? Math.PI * 0.5 + (rng.random() - 0.5) * Math.PI * 0.6 : Math.PI * 0.5;
  const ax = Math.cos(angle); // perpendicular to stripe direction
  const ay = Math.sin(angle);

  const baseFreq = 0.2 + rng.random() * 0.4;
  const freq = baseFreq / Math.max(0.1, params.scale);
  const noiseScale = 0.03 + rng.random() * 0.05;
  const phase = loopCos(t) * 3;
  const yDrift = loopSin(t + 0.25) * 2;

  const duty = 0.15 + params.density * 0.55;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      // Project pixel onto stripe axis
      const proj = (rect.x + x) * ax + (rect.y + y) * ay;

      // Noise modulates frequency locally
      const nx = (rect.x + x + offsetX) * noiseScale;
      const ny = (rect.y + y + offsetY) * noiseScale;
      const nMod = loopingNoise2D(nx, ny, t, 1, 1.2);
      const localFreq = freq * (0.4 + nMod * 1.6);

      const stripePhase = proj * localFreq + phase;
      const stripeVal = ((stripePhase % 1) + 1) % 1;
      const stripeOn = stripeVal < duty;

      if (stripeOn) {
        const tNoise = loopingNoise2D(
          (rect.x + x + offsetX) * noiseScale * 0.5,
          (rect.y + y + offsetY + yDrift) * noiseScale * 2,
          t, 1, 1
        );
        bitmap[y * bw + x] = tNoise < 0.12 ? 0 : 1;
      } else {
        const tNoise = loopingNoise2D(
          (rect.x + x + offsetX) * noiseScale,
          (rect.y + y + offsetY + yDrift) * noiseScale * 3,
          t, 1, 1
        );
        bitmap[y * bw + x] = tNoise > 0.93 ? 1 : 0;
      }
    }
  }
}
