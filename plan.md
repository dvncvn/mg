# Execution Plan

## Phase 0 — Scaffold
- [ ] `npm create vite@latest . -- --template vanilla-ts` (in current dir)
- [ ] Set up folder structure:
  ```
  src/
    prng.ts          # mulberry32 PRNG
    subdivide.ts     # BSP rectangle partitioning
    rules/
      noise.ts       # thresholded noise fill
      automata.ts    # cellular automata fill
      dither.ts      # ordered dithering fill
      reaction.ts    # cheap reaction-diffusion fill
    renderer.ts      # canvas drawing loop
    variant.ts       # seed → config mapping (256 editions)
    events.ts        # rect-level invert pulse, scanline, rule swap
    loop.ts          # looping time (t ∈ [0,1)), periodic helpers
    ui.ts            # overlay controls, keyboard shortcuts
    export.ts        # PNG save + WebM/GIF recording
    main.ts          # entry point
  index.html
  ```
- [ ] Minimal CSS: full-screen canvas, no scroll, overlay positioned top-left

## Phase 1 — Core Math
- [ ] **prng.ts** — Implement `mulberry32(seed)` returning `() => number` in [0,1). Add helpers: `randInt`, `randBool`, `randChoice`, `shuffle`.
- [ ] **loop.ts** — Looping time utilities:
  - `getLoopT(frameTime, periodMs)` → t in [0,1)
  - Periodic helpers: `loopSin(t)`, `loopCos(t)`
  - 4D looping noise coordinates: `loopNoise2D(x, y, t, radius)` → maps t onto a circle in 2 extra dims
- [ ] **subdivide.ts** — BSP subdivision:
  - Input: bounding rect, grid resolution, PRNG, config (min size, max depth)
  - Output: flat array of axis-aligned rects snapped to grid
  - Split direction alternates or is random-weighted; stop on min area / depth / random threshold

## Phase 2 — Fill Rules
Each rule takes a rect, grid resolution, PRNG, and loop-t, writes into a `Uint8Array` bitmap (1 = black, 0 = white).

- [ ] **noise.ts** — Threshold a 2D value-noise field; animate threshold with `loopSin(t)`. Use looping noise coordinates so it wraps.
- [ ] **dither.ts** — Bayer ordered dithering over a gradient that sweeps with t. Strict B/W output.
- [ ] **automata.ts** — Seed a random initial state, run N steps of a 1D/2D rule (e.g., Rule 30 / Game of Life variant). Step count oscillates with t for seamless loop (interpolate between step N and step 0).
- [ ] **reaction.ts** — Cheap Gray-Scott approximation: precompute a short cycle of frames, crossfade index with t for looping.

## Phase 3 — Variant Mapping
- [ ] **variant.ts** — `getVariantConfig(seed: number)`:
  - `gridRes`: derive from seed bits → 64 | 96 | 128 | 192
  - `subdivDepth`, `minRectSize`
  - `activeRules`: pick 2–3 of 4 rules
  - `tempo`: loop period in ms (6000–12000)
  - `eventSchedule`: deterministic list of (t, rectIndex, eventType)
  - `flickerProb`, `invertProb`
  - Ensure visual coherence: group seeds into 4 "families" of 64, each with a dominant rule palette

## Phase 4 — Renderer
- [ ] **renderer.ts**:
  - On init: run subdivide, assign a rule to each rect (from variant config + PRNG)
  - Each frame: compute loop-t, call each rect's rule to get its bitmap, blit to canvas
  - Draw margins (black or white border)
  - Use `requestAnimationFrame`; track dt for speed multiplier
  - Optimise: only recompute rects that need it (dirty flag / staggered updates for 60fps)

## Phase 5 — Events
- [ ] **events.ts**:
  - `invertPulse(rect, t)` — smoothly invert a rect's bitmap for a short window around a scheduled t
  - `scanline(y, t)` — horizontal line that flips pixels it crosses, sweeps top→bottom over a t range
  - `ruleSwap(rect, t)` — switch a rect's fill rule at a scheduled t (crossfade bitmaps for clean transition)
  - All driven by variant's `eventSchedule`

## Phase 6 — UI & Controls
- [ ] **ui.ts**:
  - Overlay: seed display + prev/next, play/pause btn, speed slider, noise slider, grid size dropdown, regenerate btn
  - Style: minimal, monochrome, semi-transparent, top-left
  - Keyboard: Space (play/pause), ←/→ (seed), S (save PNG), R (record)
- [ ] **URL params**: parse `?seed=&speed=&grid=` on load; update URL on change (replaceState)

## Phase 7 — Export
- [ ] **export.ts**:
  - PNG: `canvas.toDataURL('image/png')` → download
  - WebM: use `MediaRecorder` on `canvas.captureStream(30)`, record one full loop, download blob
  - (Stretch) GIF: use a lightweight lib like `gif.js` if trivial to add

## Phase 8 — Polish & Acceptance
- [ ] Verify determinism: reload with same seed, compare pixel output
- [ ] Check all 256 seeds render without error (automated loop)
- [ ] Confirm B/W only (no gray pixels)
- [ ] Confirm seamless loop (visual check on several seeds)
- [ ] Confirm 60fps on a normal laptop (performance profiling)
- [ ] Responsive layout (resize handler re-centers canvas)
- [ ] Save 6 example screenshots to `/examples`
- [ ] Write README (run instructions, determinism explanation, looping explanation)

## Dependency Notes
- No runtime deps beyond Vite/TS toolchain
- Optional: `gif.js` for GIF export (can skip in favour of WebM)
- All noise/PRNG is hand-rolled (no external libs) to keep bundle tiny

## Execution Order
Phases 0–3 can be built and unit-tested independently. Phase 4 integrates them. Phases 5–7 layer on top. Phase 8 is QA.
