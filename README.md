# mg

A grid breathes. Rectangles split and fill with texture — noise, dither, cellular life, diffusion — all collapsing to one bit. Black or white. Nothing else.

256 seeds. 256 compositions. Each one loops forever.

---

This project exists in conversation with [Kim Asendorf](https://kimasendorf.com/)'s work — particularly the formal language of Monogrid: the strictness of the grid, the monochrome constraint, the aliveness that emerges from simple binary fields. That work opened a door. This walks through a different room.

Nothing here is sourced from, derived from, or attempting to reproduce Asendorf's algorithms or output. The system is original: its subdivision logic, its fill rules, its looping mechanism, its event scheduling. What's shared is a sensibility — that a grid of black and white pixels, given the right rules, can feel like it's thinking.

This is an experiment. A sketch. A study in constraints.

---

## Run

```bash
npm install
npm run dev
```

`http://localhost:5173/?seed=37&speed=1.2&grid=128`

## Controls

| | |
|---|---|
| `Space` | pause / resume |
| `← →` | walk through seeds |
| `S` | capture still |
| `R` | record one loop |

Sliders for speed, noise influence, grid density. All state reflected in the URL.

## How It Works

A seed determines everything. Same number, same image, same motion — always.

The canvas subdivides into rectangles via recursive binary splits. Each rectangle receives a fill rule: thresholded noise, ordered dithering, cellular automata, or a reaction-diffusion approximation. Time loops on a circle so nothing jumps. Events — inversions, scanlines, rule swaps — fire at predetermined moments within each cycle.

All randomness flows from a single 32-bit PRNG. No `Math.random()` in the render path. The animation breathes because time is periodic, not because anything is actually random.

## Structure

```
src/
  prng.ts          deterministic randomness
  loop.ts          periodic time, looping noise
  subdivide.ts     recursive partitioning
  variant.ts       seed → configuration
  events.ts        scheduled disruptions
  renderer.ts      pixel-level blitting
  ui.ts            controls
  export.ts        png + webm
  rules/
    noise.ts       threshold fields
    dither.ts      bayer patterns
    automata.ts    cellular life
    reaction.ts    diffusion approximation
```

## Build

```bash
npm run build
npm run preview
```
