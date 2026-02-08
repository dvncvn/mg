import { initRenderer, renderFrame, type RendererState } from './renderer';
import { savePNG, recordWebM } from './export';

export function setupUI(canvas: HTMLCanvasElement): void {
  // Parse URL params
  const params = new URLSearchParams(window.location.search);
  let seed = parseInt(params.get('seed') ?? '0', 10) & 0xff;
  let speedVal = parseFloat(params.get('speed') ?? '1');
  let gridOverride: number | undefined = params.has('grid')
    ? parseInt(params.get('grid')!, 10)
    : undefined;

  // DOM elements
  const seedLabel = document.getElementById('seedLabel')!;
  const prevBtn = document.getElementById('prevSeed')!;
  const nextBtn = document.getElementById('nextSeed')!;
  const playPauseBtn = document.getElementById('playPause')!;
  const regenBtn = document.getElementById('regenerate')!;
  const speedSlider = document.getElementById('speed') as HTMLInputElement;
  const noiseSlider = document.getElementById('noise') as HTMLInputElement;
  const gridSelect = document.getElementById('gridSize') as HTMLSelectElement;
  const savePngBtn = document.getElementById('savePng')!;
  const recBtn = document.getElementById('recordWebm')!;

  speedSlider.value = String(speedVal);

  let state: RendererState;
  let recording = false;
  let rafId = 0;

  function updateURL() {
    const p = new URLSearchParams();
    p.set('seed', String(seed));
    p.set('speed', String(state.speed));
    if (gridOverride) p.set('grid', String(gridOverride));
    history.replaceState(null, '', '?' + p.toString());
  }

  function regenerate() {
    cancelAnimationFrame(rafId);
    state = initRenderer(canvas, seed, gridOverride);
    state.speed = speedVal;
    state.noiseAmount = parseFloat(noiseSlider.value);
    seedLabel.textContent = String(seed).padStart(3, '0');
    if (gridOverride) {
      gridSelect.value = String(gridOverride);
    } else {
      gridSelect.value = String(state.config.gridRes);
    }
    updateURL();
    loop();
  }

  function loop() {
    renderFrame(state);
    rafId = requestAnimationFrame(loop);
  }

  function setSeed(s: number) {
    seed = ((s % 256) + 256) % 256;
    regenerate();
  }

  function togglePlay() {
    if (state.playing) {
      state.pauseOffset += (performance.now() - state.startTime) * state.speed;
      state.playing = false;
      playPauseBtn.textContent = '▶';
    } else {
      state.startTime = performance.now();
      state.playing = true;
      playPauseBtn.textContent = '❚❚';
    }
  }

  // Button handlers
  prevBtn.addEventListener('click', () => setSeed(seed - 1));
  nextBtn.addEventListener('click', () => setSeed(seed + 1));
  playPauseBtn.addEventListener('click', togglePlay);
  regenBtn.addEventListener('click', regenerate);

  speedSlider.addEventListener('input', () => {
    speedVal = parseFloat(speedSlider.value);
    state.speed = speedVal;
    updateURL();
  });

  noiseSlider.addEventListener('input', () => {
    state.noiseAmount = parseFloat(noiseSlider.value);
  });

  gridSelect.addEventListener('change', () => {
    gridOverride = parseInt(gridSelect.value, 10);
    regenerate();
  });

  savePngBtn.addEventListener('click', () => savePNG(canvas, seed));

  recBtn.addEventListener('click', () => {
    if (recording) return;
    recording = true;
    recBtn.textContent = '⏹ REC…';
    recordWebM(canvas, state.config.periodMs, seed, undefined, () => {
      recording = false;
      recBtn.textContent = '⏺ REC';
    });
  });

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        setSeed(seed - 1);
        break;
      case 'ArrowRight':
        setSeed(seed + 1);
        break;
      case 's':
      case 'S':
        savePNG(canvas, seed);
        break;
      case 'r':
      case 'R':
        if (!recording) {
          recording = true;
          recBtn.textContent = '⏹ REC…';
          recordWebM(canvas, state.config.periodMs, seed, undefined, () => {
            recording = false;
            recBtn.textContent = '⏺ REC';
          });
        }
        break;
    }
  });

  // Resize handler
  window.addEventListener('resize', () => {
    const wasPlaying = state.playing;
    const offset = state.playing
      ? (performance.now() - state.startTime) * state.speed + state.pauseOffset
      : state.pauseOffset;
    cancelAnimationFrame(rafId);
    state = initRenderer(canvas, seed, gridOverride);
    state.speed = speedVal;
    state.noiseAmount = parseFloat(noiseSlider.value);
    state.pauseOffset = offset;
    state.playing = wasPlaying;
    if (!wasPlaying) {
      playPauseBtn.textContent = '▶';
    }
    loop();
  });

  // Boot
  regenerate();
}
