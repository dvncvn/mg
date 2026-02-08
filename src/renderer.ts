import { createPRNG, type PRNGHelper } from './prng';
import { subdivide, type Rect } from './subdivide';
import { getLoopT, valueNoise2D } from './loop';
import { getVariantConfig, type RuleType, type VariantConfig, type EventDef } from './variant';
import type { FillParams } from './rules/types';
import { fillNoise } from './rules/noise';
import { fillDither } from './rules/dither';
import { fillAutomata } from './rules/automata';
import { fillReaction } from './rules/reaction';
import { fillLines } from './rules/lines';
import { fillStreak } from './rules/streak';
import { fillColumns } from './rules/columns';
import { fillGradient } from './rules/gradient';
import {
  isInvertActive,
  scanlineY,
  isRuleSwapped,
  applyScanline,
  invertBitmap,
} from './events';

/* ── Colour helpers ── */

function hslToABGR(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return 0xFF000000
    | (Math.round((b + m) * 255) << 16)
    | (Math.round((g + m) * 255) << 8)
    | Math.round((r + m) * 255);
}

function generatePalette(seed: number): number[] {
  const rng = createPRNG(seed * 7 + 13);
  const baseHue = rng.random() * 360;
  const sat = 0.6 + rng.random() * 0.35;   // 0.60–0.95
  const lit = 0.45 + rng.random() * 0.2;    // 0.45–0.65
  const scheme = rng.randInt(0, 5);
  const hues: number[] = [];
  switch (scheme) {
    case 0: // complementary
      hues.push(baseHue, (baseHue + 180) % 360);
      break;
    case 1: // triadic
      hues.push(baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360);
      break;
    case 2: // analogous
      hues.push(baseHue, (baseHue + 30) % 360, (baseHue + 60) % 360, (baseHue + 90) % 360);
      break;
    case 3: // split-complementary
      hues.push(baseHue, (baseHue + 150) % 360, (baseHue + 210) % 360);
      break;
    default: // tetradic
      hues.push(baseHue, (baseHue + 90) % 360, (baseHue + 180) % 360, (baseHue + 270) % 360);
      break;
  }
  return hues.map(h => hslToABGR(h, sat, lit));
}

/* ── Rect state ── */

interface RectState {
  rect: Rect;
  rule: RuleType;
  altRule: RuleType;
  bw: number;
  bh: number;
  bitmap: Uint8Array;
  rng: PRNGHelper;
  rngSeed: number;
  events: EventDef[];
  fgColor: number;  // ABGR packed
}

export interface RendererState {
  config: VariantConfig;
  rects: RectState[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  gridBuffer: Uint8Array;
  warpBuffer: Uint8Array;
  colorBuffer: Uint32Array;
  warpColorBuffer: Uint32Array;
  gridW: number;
  gridH: number;
  imageData: ImageData;
  cssW: number;
  cssH: number;
  gridStep: number;
  dpr: number;
  playing: boolean;
  speed: number;
  noiseAmount: number;
  scale: number;
  density: number;
  warp: number;
  colorMode: boolean;
  eventsEnabled: boolean;
  mouseGX: number;  // grid-space mouse coords, -1 = inactive
  mouseGY: number;
  startTime: number;
  pauseOffset: number;
}

type FillFn = (
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
) => void;

const FILL_FNS: Record<RuleType, FillFn> = {
  noise: fillNoise,
  dither: fillDither,
  automata: fillAutomata,
  reaction: fillReaction,
  lines: fillLines,
  streak: fillStreak,
  columns: fillColumns,
  gradient: fillGradient,
};

export interface InitOptions {
  gridOverride?: number;
  subdivOverride?: number;
  periodOverride?: number;
}

export function initRenderer(
  canvas: HTMLCanvasElement,
  seed: number,
  opts: InitOptions = {},
): RendererState {
  const config = getVariantConfig(seed);
  if (opts.gridOverride) {
    (config as any).gridRes = opts.gridOverride;
  }
  if (opts.subdivOverride !== undefined) {
    (config as any).subdivDepth = opts.subdivOverride;
  }
  if (opts.periodOverride !== undefined) {
    (config as any).periodMs = opts.periodOverride;
  }

  const cssW = window.innerWidth;
  const cssH = window.innerHeight;

  // Grid cells are square. gridRes controls the short axis cell count.
  const shortSide = Math.min(cssW, cssH);
  const gridStep = Math.max(1, Math.floor(shortSide / config.gridRes));
  const gridW = Math.floor(cssW / gridStep);
  const gridH = Math.floor(cssH / gridStep);

  // Canvas at grid resolution — CSS image-rendering: pixelated handles upscale
  canvas.width = gridW;
  canvas.height = gridH;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Subdivide a rectangular region
  const rng = createPRNG(seed);
  const region: Rect = { x: 0, y: 0, w: gridW, h: gridH };
  const subRects = subdivide(region, {
    gridStep: 1,
    minCells: config.minRectCells,
    maxDepth: config.subdivDepth,
    stopProb: config.stopProb,
  }, rng);

  const palette = generatePalette(seed);

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
    const fgColor = palette[i % palette.length];
    return {
      rect, rule, altRule, bw, bh,
      bitmap: new Uint8Array(bw * bh),
      rng: createPRNG(rngSeed),
      rngSeed, events, fgColor,
    };
  });

  const totalPixels = gridW * gridH;
  const gridBuffer = new Uint8Array(totalPixels);
  const warpBuffer = new Uint8Array(totalPixels);
  const colorBuffer = new Uint32Array(totalPixels);
  const warpColorBuffer = new Uint32Array(totalPixels);
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  return {
    config, rects, canvas, ctx,
    gridBuffer, warpBuffer, colorBuffer, warpColorBuffer,
    gridW, gridH, imageData,
    cssW, cssH, gridStep, dpr: 1,
    playing: true,
    speed: 1,
    noiseAmount: 0.5,
    scale: 1.0,
    density: 0.5,
    warp: 0,
    colorMode: false,
    eventsEnabled: true,
    mouseGX: -1,
    mouseGY: -1,
    startTime: performance.now(),
    pauseOffset: 0,
  };
}

/**
 * Scanning warp: a band of horizontal displacement that sweeps
 * vertically through the grid, snapping in and out.
 */
function applyWarp(
  src: Uint8Array,
  dst: Uint8Array,
  gridW: number,
  gridH: number,
  t: number,
  warpAmount: number,
  seed: number,
): void {
  if (warpAmount <= 0) {
    dst.set(src);
    return;
  }

  const maxShift = warpAmount * gridW * 0.35;

  // Scanning band: center sweeps up and down over the loop
  // Band width is ~30% of the grid height
  const bandWidth = gridH * 0.3;
  const bandCenter = (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * gridH;

  // Secondary band for more complexity
  const band2Center = (Math.cos(t * Math.PI * 2 + 1.0) * 0.5 + 0.5) * gridH;
  const band2Width = gridH * 0.15;

  for (let y = 0; y < gridH; y++) {
    // Distance from band center, normalized to [0,1] within band
    const d1 = Math.abs(y - bandCenter) / (bandWidth * 0.5);
    const d2 = Math.abs(y - band2Center) / (band2Width * 0.5);

    // Sharp falloff: snap in/out with a steep curve
    const intensity1 = d1 < 1 ? Math.pow(1 - d1, 0.3) : 0;
    const intensity2 = d2 < 1 ? Math.pow(1 - d2, 0.3) : 0;
    const intensity = Math.min(1, intensity1 + intensity2 * 0.6);

    if (intensity < 0.01) {
      // No warp — copy row directly
      const rowStart = y * gridW;
      for (let x = 0; x < gridW; x++) {
        dst[rowStart + x] = src[rowStart + x];
      }
      continue;
    }

    // Displacement within the band
    const wave1 = Math.sin(y * 0.03 + t * Math.PI * 2) * 0.7;
    const wave2 = Math.sin(y * 0.11 + t * Math.PI * 6 + 2.0) * 0.3;
    const noise = valueNoise2D(y * 0.025 + seed * 7.1, t * 3 + seed) * 2 - 1;
    const rawShift = (wave1 + wave2 + noise * 0.5) * maxShift * intensity;
    const shift = Math.round(rawShift);

    const rowStart = y * gridW;
    for (let x = 0; x < gridW; x++) {
      let sx = x - shift;
      sx = ((sx % gridW) + gridW) % gridW;
      dst[rowStart + x] = src[rowStart + sx];
    }
  }
}

/**
 * Warp for the Uint32 color buffer — same displacement logic, 32-bit values.
 */
function applyWarpColor(
  src: Uint32Array,
  dst: Uint32Array,
  gridW: number,
  gridH: number,
  t: number,
  warpAmount: number,
  seed: number,
): void {
  if (warpAmount <= 0) {
    dst.set(src);
    return;
  }
  const maxShift = warpAmount * gridW * 0.35;
  const bandWidth = gridH * 0.3;
  const bandCenter = (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * gridH;
  const band2Center = (Math.cos(t * Math.PI * 2 + 1.0) * 0.5 + 0.5) * gridH;
  const band2Width = gridH * 0.15;

  for (let y = 0; y < gridH; y++) {
    const d1 = Math.abs(y - bandCenter) / (bandWidth * 0.5);
    const d2 = Math.abs(y - band2Center) / (band2Width * 0.5);
    const intensity1 = d1 < 1 ? Math.pow(1 - d1, 0.3) : 0;
    const intensity2 = d2 < 1 ? Math.pow(1 - d2, 0.3) : 0;
    const intensity = Math.min(1, intensity1 + intensity2 * 0.6);

    const rowStart = y * gridW;
    if (intensity < 0.01) {
      for (let x = 0; x < gridW; x++) dst[rowStart + x] = src[rowStart + x];
      continue;
    }
    const wave1 = Math.sin(y * 0.03 + t * Math.PI * 2) * 0.7;
    const wave2 = Math.sin(y * 0.11 + t * Math.PI * 6 + 2.0) * 0.3;
    const noise = valueNoise2D(y * 0.025 + seed * 7.1, t * 3 + seed) * 2 - 1;
    const shift = Math.round((wave1 + wave2 + noise * 0.5) * maxShift * intensity);
    for (let x = 0; x < gridW; x++) {
      dst[rowStart + x] = src[rowStart + ((x - shift) % gridW + gridW) % gridW];
    }
  }
}

export function renderFrame(state: RendererState): void {
  const {
    ctx, config, rects, gridBuffer, warpBuffer,
    colorBuffer, warpColorBuffer, gridW, gridH,
  } = state;

  const elapsed = state.playing
    ? (performance.now() - state.startTime) * state.speed + state.pauseOffset
    : state.pauseOffset;
  const t = getLoopT(elapsed, config.periodMs);

  const params: FillParams = {
    noiseAmount: state.noiseAmount,
    scale: state.scale,
    density: state.density,
  };

  const BLACK = 0xFF000000;
  const isColor = state.colorMode;

  gridBuffer.fill(0);
  if (isColor) colorBuffer.fill(BLACK);

  for (const rs of rects) {
    rs.rng = createPRNG(rs.rngSeed);

    let currentRule = rs.rule;
    if (state.eventsEnabled) {
      for (const ev of rs.events) {
        if (ev.type === 'ruleSwap' && isRuleSwapped(ev, t)) {
          currentRule = rs.altRule;
          break;
        }
      }
    }

    FILL_FNS[currentRule](rs.bitmap, rs.bw, rs.bh, rs.rect, t, rs.rng, params);

    if (state.eventsEnabled) {
      for (const ev of rs.events) {
        if (ev.type === 'invert' && isInvertActive(ev, t)) {
          invertBitmap(rs.bitmap);
        }
        if (ev.type === 'scanline') {
          const sy = scanlineY(ev, t);
          if (sy >= 0) applyScanline(rs.bitmap, rs.bw, rs.bh, sy);
        }
      }
    }

    const rx = rs.rect.x;
    const ry = rs.rect.y;
    const fg = rs.fgColor;
    for (let y = 0; y < rs.bh; y++) {
      const srcRow = y * rs.bw;
      const dstRow = (ry + y) * gridW + rx;
      for (let x = 0; x < rs.bw; x++) {
        const val = rs.bitmap[srcRow + x];
        gridBuffer[dstRow + x] = val;
        if (isColor) colorBuffer[dstRow + x] = val ? fg : BLACK;
      }
    }
  }

  // Apply scanning warp
  applyWarp(gridBuffer, warpBuffer, gridW, gridH, t, state.warp, config.seed);
  if (isColor) {
    applyWarpColor(colorBuffer, warpColorBuffer, gridW, gridH, t, state.warp, config.seed);
  }

  // Blit 1:1 with optional mouse distortion
  const { imageData } = state;
  const data32 = new Uint32Array(imageData.data.buffer);
  const totalPixels = gridW * gridH;

  const finalMono = state.warp > 0 ? warpBuffer : gridBuffer;
  const finalColor = state.warp > 0 ? warpColorBuffer : colorBuffer;

  const mx = state.mouseGX;
  const my = state.mouseGY;
  const mouseActive = mx >= 0 && my >= 0;

  if (!mouseActive) {
    // Fast path — no distortion
    if (isColor) {
      for (let i = 0; i < totalPixels; i++) data32[i] = finalColor[i];
    } else {
      const WHITE = 0xFFFFFFFF;
      for (let i = 0; i < totalPixels; i++) {
        data32[i] = finalMono[i] ? WHITE : BLACK;
      }
    }
  } else {
    // Distortion lens around cursor
    const radius = Math.min(gridW, gridH) * 0.18;
    const r2 = radius * radius;
    const strength = 0.7;
    const WHITE = 0xFFFFFFFF;

    for (let gy = 0; gy < gridH; gy++) {
      const dy = gy - my;
      const dy2 = dy * dy;
      for (let gx = 0; gx < gridW; gx++) {
        const dx = gx - mx;
        const d2 = dx * dx + dy2;
        let srcIdx: number;
        if (d2 < r2 && d2 > 0) {
          const dist = Math.sqrt(d2);
          const falloff = 1 - dist / radius;
          const push = falloff * falloff * strength * radius;
          const sx = Math.round(gx + (dx / dist) * push);
          const sy = Math.round(gy + (dy / dist) * push);
          const cx = Math.max(0, Math.min(gridW - 1, sx));
          const cy = Math.max(0, Math.min(gridH - 1, sy));
          srcIdx = cy * gridW + cx;
        } else {
          srcIdx = gy * gridW + gx;
        }
        const dstIdx = gy * gridW + gx;
        data32[dstIdx] = isColor
          ? finalColor[srcIdx]
          : (finalMono[srcIdx] ? WHITE : BLACK);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
