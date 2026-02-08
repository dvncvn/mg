import type { PRNGHelper } from './prng';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SubdivideConfig {
  /** Underlying grid cell size in pixels */
  gridStep: number;
  /** Minimum rectangle dimension in grid cells */
  minCells: number;
  /** Maximum recursion depth */
  maxDepth: number;
  /** Probability of stopping a split early */
  stopProb: number;
}

/**
 * BSP subdivision: recursively binary-split a region into axis-aligned
 * rectangles snapped to the grid.
 */
export function subdivide(
  region: Rect,
  config: SubdivideConfig,
  rng: PRNGHelper,
): Rect[] {
  const results: Rect[] = [];
  split(region, 0, results, config, rng);
  return results;
}

function split(
  r: Rect,
  depth: number,
  out: Rect[],
  cfg: SubdivideConfig,
  rng: PRNGHelper,
) {
  const { gridStep, minCells, maxDepth, stopProb } = cfg;
  const minPx = minCells * gridStep;

  // Stop conditions
  if (depth >= maxDepth || (depth > 1 && rng.random() < stopProb)) {
    out.push(r);
    return;
  }

  // Decide split direction: prefer splitting the longer side
  const canSplitH = r.w >= minPx * 2;
  const canSplitV = r.h >= minPx * 2;

  if (!canSplitH && !canSplitV) {
    out.push(r);
    return;
  }

  let horizontal: boolean;
  if (canSplitH && canSplitV) {
    // Bias toward splitting the longer axis
    horizontal = rng.random() < r.w / (r.w + r.h);
  } else {
    horizontal = canSplitH;
  }

  if (horizontal) {
    // Split along x-axis
    const minSplit = minPx;
    const maxSplit = r.w - minPx;
    const rawSplit = rng.randFloat(minSplit, maxSplit);
    const snap = Math.round(rawSplit / gridStep) * gridStep;
    const splitW = Math.max(minPx, Math.min(snap, maxSplit));

    split({ x: r.x, y: r.y, w: splitW, h: r.h }, depth + 1, out, cfg, rng);
    split(
      { x: r.x + splitW, y: r.y, w: r.w - splitW, h: r.h },
      depth + 1,
      out,
      cfg,
      rng,
    );
  } else {
    // Split along y-axis
    const minSplit = minPx;
    const maxSplit = r.h - minPx;
    const rawSplit = rng.randFloat(minSplit, maxSplit);
    const snap = Math.round(rawSplit / gridStep) * gridStep;
    const splitH = Math.max(minPx, Math.min(snap, maxSplit));

    split({ x: r.x, y: r.y, w: r.w, h: splitH }, depth + 1, out, cfg, rng);
    split(
      { x: r.x, y: r.y + splitH, w: r.w, h: r.h - splitH },
      depth + 1,
      out,
      cfg,
      rng,
    );
  }
}
