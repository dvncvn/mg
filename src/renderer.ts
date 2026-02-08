import { createPRNG, type PRNGHelper } from './prng';
import { subdivide, type Rect } from './subdivide';
import { getLoopT } from './loop';
import { getVariantConfig, type RuleType, type VariantConfig, type EventDef } from './variant';
import { fillNoise } from './rules/noise';
import { fillDither } from './rules/dither';
import { fillAutomata } from './rules/automata';
import { fillReaction } from './rules/reaction';
import {
  isInvertActive,
  scanlineY,
  isRuleSwapped,
  applyScanline,
  invertBitmap,
} from './events';

/** Per-rectangle state */
interface RectState {
  rect: Rect;
  rule: RuleType;
  altRule: RuleType;
  bw: number; // bitmap width in cells
  bh: number;
  bitmap: Uint8Array;
  rng: PRNGHelper; // dedicated per-rect PRNG (reset each frame for determinism)
  rngSeed: number;
  events: EventDef[];
}

export interface RendererState {
  config: VariantConfig;
  rects: RectState[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Pixel buffer for the grid area (gridRes × gridRes, 1=white 0=black) */
  gridBuffer: Uint8Array;
  gridRes: number;
  /** Cached ImageData for blitting (avoids allocation per frame) */
  imageData: ImageData;
  canvasSize: number;
  margin: number;
  gridStep: number;
  dpr: number;
  playing: boolean;
  speed: number;
  noiseAmount: number;
  startTime: number;
  pauseOffset: number;
}

const FILL_FNS: Record<
  RuleType,
  (
    bitmap: Uint8Array,
    bw: number,
    bh: number,
    rect: Rect,
    t: number,
    rng: PRNGHelper,
    noiseAmount: number,
  ) => void
> = {
  noise: fillNoise,
  dither: fillDither,
  automata: fillAutomata,
  reaction: fillReaction,
};

/**
 * Initialise or reinitialise the renderer for a given seed.
 */
export function initRenderer(
  canvas: HTMLCanvasElement,
  seed: number,
  overrideGrid?: number,
): RendererState {
  const config = getVariantConfig(seed);
  if (overrideGrid) {
    (config as any).gridRes = overrideGrid;
  }

  const dpr = window.devicePixelRatio || 1;
  const viewSize = Math.min(window.innerWidth, window.innerHeight);
  const canvasSize = Math.floor(viewSize * 0.92);

  canvas.style.width = canvasSize + 'px';
  canvas.style.height = canvasSize + 'px';
  canvas.width = canvasSize * dpr;
  canvas.height = canvasSize * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const margin = Math.floor(canvasSize * 0.04);
  const innerSize = canvasSize - margin * 2;
  const gridStep = Math.floor(innerSize / config.gridRes);

  // Subdivide
  const rng = createPRNG(seed);
  const region: Rect = { x: 0, y: 0, w: config.gridRes, h: config.gridRes };
  const subRects = subdivide(region, {
    gridStep: 1, // work in grid-cell coordinates
    minCells: config.minRectCells,
    maxDepth: config.subdivDepth,
    stopProb: config.stopProb,
  }, rng);

  // Assign rules + events to rects
  const rects: RectState[] = subRects.map((rect, i) => {
    const ruleIdx = i % config.activeRules.length;
    const rule = config.activeRules[ruleIdx];
    const altRule = config.activeRules[(ruleIdx + 1) % config.activeRules.length];
    const bw = rect.w;
    const bh = rect.h;
    const rngSeed = seed * 1000 + i * 37;
    const events = config.events.filter(
      (e) => e.rectIndex % subRects.length === i,
    );
    return {
      rect,
      rule,
      altRule,
      bw,
      bh,
      bitmap: new Uint8Array(bw * bh),
      rng: createPRNG(rngSeed),
      rngSeed,
      events,
    };
  });

  const gridBuffer = new Uint8Array(config.gridRes * config.gridRes);
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  return {
    config,
    rects,
    canvas,
    ctx,
    gridBuffer,
    gridRes: config.gridRes,
    imageData,
    canvasSize,
    margin,
    gridStep,
    dpr,
    playing: true,
    speed: 1,
    noiseAmount: 0.5,
    startTime: performance.now(),
    pauseOffset: 0,
  };
}

/**
 * Render one frame. Call from requestAnimationFrame.
 * Uses ImageData for fast pixel-level blitting.
 */
export function renderFrame(state: RendererState): void {
  const { canvas, ctx, canvasSize, margin, gridStep, dpr, config, rects, gridBuffer, gridRes, noiseAmount } = state;

  const elapsed = state.playing
    ? (performance.now() - state.startTime) * state.speed + state.pauseOffset
    : state.pauseOffset;
  const t = getLoopT(elapsed, config.periodMs);

  // Clear grid buffer
  gridBuffer.fill(0);

  // Fill each rect's bitmap and write into gridBuffer
  for (const rs of rects) {
    // Reset per-rect PRNG for determinism each frame
    rs.rng = createPRNG(rs.rngSeed);

    // Determine active rule (may be swapped by event)
    let currentRule = rs.rule;
    for (const ev of rs.events) {
      if (ev.type === 'ruleSwap' && isRuleSwapped(ev, t)) {
        currentRule = rs.altRule;
        break;
      }
    }

    // Fill bitmap
    FILL_FNS[currentRule](rs.bitmap, rs.bw, rs.bh, rs.rect, t, rs.rng, noiseAmount);

    // Apply events
    for (const ev of rs.events) {
      if (ev.type === 'invert' && isInvertActive(ev, t)) {
        invertBitmap(rs.bitmap);
      }
      if (ev.type === 'scanline') {
        const sy = scanlineY(ev, t);
        if (sy >= 0) applyScanline(rs.bitmap, rs.bw, rs.bh, sy);
      }
    }

    // Occasional flicker
    if (config.flickerProb > 0 && Math.random() < config.flickerProb) {
      invertBitmap(rs.bitmap);
    }

    // Write bitmap into grid buffer
    const rx = rs.rect.x;
    const ry = rs.rect.y;
    for (let y = 0; y < rs.bh; y++) {
      for (let x = 0; x < rs.bw; x++) {
        gridBuffer[(ry + y) * gridRes + (rx + x)] = rs.bitmap[y * rs.bw + x];
      }
    }
  }

  // Blit grid buffer to canvas via cached ImageData
  const pxWidth = canvas.width;   // physical pixels
  const pxHeight = canvas.height;
  const { imageData } = state;
  const data = imageData.data;

  // Reset to black (R=0, G=0, B=0, A=255)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  // Scale margin and gridStep to physical pixels
  const pxMargin = Math.round(margin * dpr);
  const pxStep = Math.round(gridStep * dpr);

  for (let gy = 0; gy < gridRes; gy++) {
    for (let gx = 0; gx < gridRes; gx++) {
      if (!gridBuffer[gy * gridRes + gx]) continue; // black = default, skip
      const px0 = pxMargin + gx * pxStep;
      const py0 = pxMargin + gy * pxStep;
      const px1 = px0 + pxStep;
      const py1 = py0 + pxStep;
      for (let py = py0; py < py1 && py < pxHeight; py++) {
        const rowOff = py * pxWidth * 4;
        for (let px = px0; px < px1 && px < pxWidth; px++) {
          const off = rowOff + px * 4;
          data[off] = 255;     // R
          data[off + 1] = 255; // G
          data[off + 2] = 255; // B
          // alpha already 255
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
