# Project: Monogrid-inspired Generative Grid Animations (Original)

Build an original, browser-based generative artwork inspired by the *idea* of Kim Asendorf’s Monogrid:
- strict monochrome aesthetic
- grid / pixel logic
- rectangular subdivision + filled pixel fields
- realtime, looping, “alive” motion
BUT: do NOT reproduce Monogrid’s exact algorithm or visuals. Create an original system that evokes similar constraints.

## Output
A single-page web app that renders to a full-screen canvas:
- 256 deterministic variants (seeded)
- each variant is a looping realtime animation (no video files)
- export: still PNG + short GIF/WebM recording
- controls: seed selector (0–255), play/pause, speed, noise amount, grid size, “regenerate”
- URL params: `?seed=37&speed=1.2&grid=128`

## Tech constraints
- Use TypeScript + Vite (or plain ES modules if simpler).
- Rendering: Canvas2D preferred (WebGL optional but not required).
- Deterministic PRNG (e.g., mulberry32/sfc32) so seed always matches.
- Keep it fast: aim for 60fps on a normal laptop.

## Visual system (must be original but same *family*)
### Core composition
1) Start with a square canvas region with margins.
2) Create a **partition map** by subdividing the region into rectangles:
   - Use a stochastic binary-split (like BSP), or a weighted recursive split.
   - Stop splitting based on min area + random thresholds.
   - Keep the rectangles aligned to an underlying grid.

3) For each rectangle, fill it with a **pixel field**:
   - Represent each rect as a mini bitmap at a chosen resolution.
   - Fill using rules (choose 2–4 rules and switch by seed):
     - thresholded noise
     - cellular automata step or two
     - dither patterns (ordered dithering)
     - simple reaction-diffusion-esque iteration (cheap approximation)
   - Output is strictly black/white (no gray), but allow temporal flicker/inversion.

### Animation / “alive” behavior
- The image should evolve continuously:
  - either by updating pixel fields per rect each frame
  - or by periodically re-simulating only parts of the grid
- Must loop seamlessly in 6–12 seconds:
  - use a looping time variable `t` in [0,1) and periodic functions
  - ensure any noise sampling loops (e.g., use sin/cos domain warping or 4D looping noise technique)

### Global motion constraints
- No camera movement; the grid is stable.
- Motion comes from local pixel rule updates and occasional “events”:
  - rect-level invert pulse
  - swap fill rule in a rect
  - “scanline” that flips pixels it touches
- Keep events deterministic from seed.

## Variant definition (256 editions)
Define a stable mapping from seed 0–255 to:
- base grid resolution (64/96/128/192)
- subdivision depth / min rectangle size
- rule palette (which fill rules are active)
- animation tempo + event schedule
- probability of inversion / flicker
Make sure the 256 outputs feel like a coherent set.

## UX / UI
- Minimal overlay UI (top-left): seed, play, export, sliders.
- Keyboard shortcuts:
  - [space] play/pause
  - [←/→] prev/next seed
  - [s] save PNG
  - [r] record 5s WebM (or GIF if easy)

## Deliverables
1) Working app with responsive layout.
2) Clean code structure:
   - `prng.ts`, `subdivide.ts`, `rules/*`, `renderer.ts`, `ui.ts`
3) README that explains:
   - how to run
   - how determinism works
   - how looping is achieved
4) Include 6 example screenshots (saved to `/examples`).

## Acceptance criteria
- Seeded determinism: seed 37 always matches.
- 256 distinct variants.
- Black/white only.
- Subdivided rectangles clearly present.
- Continuous, pleasing evolution; no random flashing chaos.
- Loop feels intentional (no jump cuts).
