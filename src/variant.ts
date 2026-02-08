import { createPRNG } from './prng';

export type RuleType = 'noise' | 'dither' | 'automata' | 'reaction';

export interface EventDef {
  /** Normalised time in [0, 1) when event fires */
  t: number;
  /** Which rect index (mod actual rect count) */
  rectIndex: number;
  /** Event type */
  type: 'invert' | 'scanline' | 'ruleSwap';
}

export interface VariantConfig {
  seed: number;
  gridRes: 64 | 96 | 128 | 192;
  subdivDepth: number;
  minRectCells: number;
  activeRules: RuleType[];
  periodMs: number;
  events: EventDef[];
  flickerProb: number;
  invertProb: number;
  stopProb: number;
}

const GRID_OPTIONS: (64 | 96 | 128 | 192)[] = [64, 96, 128, 192];
const ALL_RULES: RuleType[] = ['noise', 'dither', 'automata', 'reaction'];

/**
 * Deterministically derive a complete variant config from a seed (0–255).
 * Seeds are grouped into 4 families of 64, each biased toward a dominant rule.
 */
export function getVariantConfig(seed: number): VariantConfig {
  const rng = createPRNG(seed * 7919 + 31); // spread seeds

  // Family determines dominant rule
  const family = (seed >> 6) & 3; // 0–3
  const dominantRule = ALL_RULES[family];

  // Pick 2–3 active rules, always including the dominant one
  const others = ALL_RULES.filter((r) => r !== dominantRule);
  rng.shuffle(others);
  const ruleCount = rng.randInt(2, 4); // 2 or 3
  const activeRules: RuleType[] = [dominantRule, ...others.slice(0, ruleCount - 1)];

  // Grid resolution — weighted by seed bits
  const gridRes = GRID_OPTIONS[rng.randInt(0, 4)];

  // Subdivision
  const subdivDepth = rng.randInt(3, 7); // 3–6
  const minRectCells = rng.randInt(2, 6); // 2–5
  const stopProb = rng.randFloat(0.05, 0.3);

  // Timing
  const periodMs = rng.randInt(6000, 12001); // 6–12s

  // Events (4–8 per loop)
  const eventCount = rng.randInt(4, 9);
  const events: EventDef[] = [];
  const eventTypes: EventDef['type'][] = ['invert', 'scanline', 'ruleSwap'];
  for (let i = 0; i < eventCount; i++) {
    events.push({
      t: rng.random(),
      rectIndex: rng.randInt(0, 100), // mod'd at runtime
      type: rng.randChoice(eventTypes),
    });
  }
  events.sort((a, b) => a.t - b.t);

  // Flicker / inversion
  const flickerProb = rng.randFloat(0, 0.08);
  const invertProb = rng.randFloat(0, 0.15);

  return {
    seed,
    gridRes,
    subdivDepth,
    minRectCells,
    activeRules,
    periodMs,
    events,
    flickerProb,
    invertProb,
    stopProb,
  };
}
