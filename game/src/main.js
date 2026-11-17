// Boot and the one loop of Neon Salvage: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between five screens — title, play, paused, game over and
// contract complete — and the loop answers the world's events with sound, sparks and shake.
//
// ?seed=N fixes the field the random generator deals. ?shot=title|play|frenzy|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, PALETTE, STEP, WIN_SCORE } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './ui.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, seed);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.resume();
    audio.click();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. Three hull. Reach ${WIN_SCORE} to complete the contract.`);
  }

  function endRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`Contract complete. Score ${world.state.score}.`);
    } else {
      audio.gameOver();
      announce(`Drone down. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.resume();
      announce(audio.toggleMute() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  /** The steering for this step: the pointer's pull while it is held, else the held keys. */
  function steering() {
    if (input.pointer.down) {
      const drone = world.drone.state;
      const target = renderer.toField(input.pointer.clientX, input.pointer.clientY);
      const dx = target.x - drone.x;
      const dy = target.y - drone.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 26) {
        const pull = Math.min(1, dist / 90);
        return { x: (dx / dist) * pull, y: (dy / dist) * pull };
      }
      return { x: 0, y: 0 };
    }
    return input.axes();
  }

  function answerEvents(events) {
    const drone = world.drone.state;
    for (const event of events) {
      if (event.type === 'core') {
        audio.pickup(event.combo);
        renderer.burst(event.x, event.y, PALETTE.core, 12, 240);
        renderer.floater(event.x, event.y - 16, `+${event.gained}`, PALETTE.accent);
      } else if (event.type === 'shield') {
        audio.shieldUp();
        renderer.floater(drone.x, drone.y - 30, 'SHIELD UP', PALETTE.shield);
      } else if (event.type === 'shieldbreak') {
        audio.shieldBreak();
        renderer.shake(5);
        renderer.burst(drone.x, drone.y, PALETTE.shield, 16, 300);
        announce('Shield down.');
      } else if (event.type === 'hit') {
        audio.hit();
        renderer.shake(11);
        renderer.burst(drone.x, drone.y, PALETTE.mine, 18, 320);
        announce(world.state.over ? 'Drone down.' : `Hit. ${drone.hull} hull left.`);
      } else if (event.type === 'level') {
        audio.levelUp();
        renderer.floater(drone.x, drone.y - 34, `LEVEL ${event.level}`, PALETTE.text);
        announce(`Level ${event.level}.`);
      } else if (event.type === 'over') endRun(false);
      else if (event.type === 'win') endRun(true);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, true);
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      world.step(STEP, { x: 0, y: 0 }, true);
      return;
    }
    answerEvents(world.step(STEP, steering(), false));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PAUSED) {
      accumulator = 0;
    } else {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen === SCREEN_PAUSED) break;
      }
    }
    renderer.draw(world, screen, best, audio.muted);
  }

  // Leaving the tab pauses a running game rather than letting the field drift unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Salvage. Press Space or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
