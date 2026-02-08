import { loopSin, loopCos } from '../loop';
import { loopingNoise2D } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Angled streak/scan-line fill: dense banding at a per-rect angle with
 * noise-modulated frequency and thickness. Creates the scan-line
 * aesthetic seen in Monogrid-style work.
 */
export function fillStreak(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const offsetY = rng.random() * 200;
  const offsetX = rng.random() * 200;

  // Per-rect angle — mostly horizontal-ish but can tilt
  const angle = (rng.random() - 0.5) * Math.PI * 0.6; // ±54°
  const ax = -Math.sin(angle); // perpendicular to band direction
  const ay = Math.cos(angle);

  // Base frequency of bands (lines per cell)
  const baseFreq = 0.3 + rng.random() * 0.5;
  const freq = baseFreq / Math.max(0.1, params.scale);

  // Noise modulates the local frequency/thickness
  const noiseScale = 0.04 + rng.random() * 0.06;
  const phase = loopSin(t) * 4;
  const drift = loopCos(t + 0.3) * 2;

  // Duty cycle (how thick the bright bands are)
  const duty = 0.2 + params.density * 0.6; // 0.2–0.8

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      // Project pixel onto band axis
      const proj = (rect.x + x) * ax + (rect.y + y) * ay;

      // Noise modulates frequency locally
      const nx = (rect.x + x + offsetX) * noiseScale;
      const ny = (rect.y + y + offsetY) * noiseScale;
      const nMod = loopingNoise2D(nx, ny, t, 1, 1.2);
      const localFreq = freq * (0.5 + nMod * 1.5);

      const bandPhase = proj * localFreq + phase;
      const bandVal = ((bandPhase % 1) + 1) % 1;
      const bandOn = bandVal < duty;

      if (bandOn) {
        const xNoise = loopingNoise2D(
          (rect.x + x + offsetX) * noiseScale * 2,
          (rect.y + y + offsetY) * noiseScale * 0.5,
          t, 1, 1
        );
        bitmap[y * bw + x] = xNoise < 0.15 ? 0 : 1;
      } else {
        const xNoise = loopingNoise2D(
          (rect.x + x + offsetX + drift) * noiseScale * 3,
          (rect.y + y + offsetY) * noiseScale,
          t, 1, 1
        );
        bitmap[y * bw + x] = xNoise > 0.92 ? 1 : 0;
      }
    }
  }
}
