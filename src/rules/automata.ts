import { loopTriangle } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';

/**
 * Cellular automata fill: initialise random state, run N steps of a
 * totalistic 2D rule. Step count oscillates with t for seamless looping.
 */
export function fillAutomata(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  _rect: Rect,
  t: number,
  rng: PRNGHelper,
  _noiseAmount: number,
): void {
  const size = bw * bh;
  // Deterministic initial state
  const state = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    state[i] = rng.random() < 0.4 ? 1 : 0;
  }

  // Birth/survival thresholds (B3/S23 variant, slightly tweaked)
  const birthMin = 3;
  const birthMax = 3;
  const surviveMin = 2;
  const surviveMax = 3;

  // Steps oscillate: 0 at t=0, maxSteps at t=0.5, 0 at t=1
  const maxSteps = 6;
  const steps = Math.round(loopTriangle(t) * maxSteps);

  const buf = new Uint8Array(size);

  for (let s = 0; s < steps; s++) {
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (x + dx + bw) % bw;
            const ny = (y + dy + bh) % bh;
            neighbors += state[ny * bw + nx];
          }
        }
        const alive = state[y * bw + x];
        if (alive) {
          buf[y * bw + x] = neighbors >= surviveMin && neighbors <= surviveMax ? 1 : 0;
        } else {
          buf[y * bw + x] = neighbors >= birthMin && neighbors <= birthMax ? 1 : 0;
        }
      }
    }
    state.set(buf);
  }

  bitmap.set(state);
}
