// The screenshot scenes behind ?shot=title|play|frenzy|end. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot — seek the nearest core, lean away
// from hazards that come close — so the frame is what a short game really looks like, and the
// same seed always deals the same scene. The end scene's pilot is a reckless one: it hauls
// cores with barely a glance at the mines, and is caught, as a hurried player is.
import { STEP, WIN_SCORE } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './ui.js';

const TITLE_SECONDS = 4;
const PLAY_SECONDS = 16;
const FRENZY_SECONDS = 50;
const END_LIMIT_SECONDS = 360;

/** The autopilot's steering for one step: toward the salvage, away from trouble, as one vector. */
function pilot(world, caution) {
  const drone = world.drone.state;
  let target = null;
  let targetDist = Infinity;
  for (const core of world.cache.cores) {
    if (!core.active) continue;
    const dist = (core.x - drone.x) ** 2 + (core.y - drone.y) ** 2;
    if (dist < targetDist) {
      targetDist = dist;
      target = core;
    }
  }
  if (!drone.shield && world.cache.orb.active) target = world.cache.orb;
  let mx = 0;
  let my = 0;
  if (target !== null) {
    const dx = target.x - drone.x;
    const dy = target.y - drone.y;
    const dist = Math.hypot(dx, dy) || 1;
    mx = dx / dist;
    my = dy / dist;
  }
  const threats = [];
  for (const mine of world.swarm.mines) if (mine.active) threats.push(mine);
  for (const wisp of world.swarm.wisps) if (wisp.active) threats.push(wisp);
  for (const threat of threats) {
    const dx = drone.x - threat.x;
    const dy = drone.y - threat.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 150) {
      const weight = ((150 - dist) / 150) * caution;
      mx += (dx / dist) * weight;
      my += (dy / dist) * weight;
    }
  }
  const length = Math.hypot(mx, my);
  if (length > 1) {
    mx /= length;
    my /= length;
  }
  return { x: mx, y: my };
}

function playFor(world, seconds, caution, maxScore = Infinity) {
  const steps = Math.round(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    world.step(STEP, pilot(world, caution), false);
    if (world.state.over || world.state.won || world.state.score >= maxScore) break;
  }
}

/**
 * Set `world` to the named scene (title, play, frenzy or end; any other name is title) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play' || name === 'frenzy') {
    // The frenzy scene stops at two thirds of the contract: late, busy and still in the balance.
    playFor(world, name === 'play' ? PLAY_SECONDS : FRENZY_SECONDS, 2.4, name === 'frenzy' ? WIN_SCORE * 0.65 : Infinity);
    if (world.state.over || world.state.won) {
      // The pilot had a bad field: deal a shorter, sparser one so the scene is a game in progress.
      world.reset();
      playFor(world, 7, 2.4);
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    playFor(world, END_LIMIT_SECONDS, 0.15);
    if (!world.state.over) {
      // Still flying: end it the direct way, nose first into the nearest mine, until the hull goes.
      for (let index = 0; index < 60 / STEP && !world.state.over; index += 1) {
        const drone = world.drone.state;
        let mine = null;
        let mineDist = Infinity;
        for (const item of world.swarm.mines) {
          if (!item.active) continue;
          const dist = (item.x - drone.x) ** 2 + (item.y - drone.y) ** 2;
          if (dist < mineDist) {
            mineDist = dist;
            mine = item;
          }
        }
        if (mine === null) {
          world.step(STEP, { x: 0, y: 0 }, false);
          continue;
        }
        const dx = mine.x - drone.x;
        const dy = mine.y - drone.y;
        const dist = Math.hypot(dx, dy) || 1;
        world.step(STEP, { x: dx / dist, y: dy / dist }, false);
      }
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  for (let index = 0; index < TITLE_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
