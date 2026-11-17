// The rules of Neon Salvage, with no drawing and no browser in it: it composes the drone, the
// hazards and the salvage, moves them all one fixed step at a time, and settles what touches
// what. Scoring lives here — a core is worth its points times the combo it lands in — and so do
// the level, the win and the loss. step() returns the step's events as small objects, so the
// caller can answer them with sound and sparks without the world knowing about either.
import { CORE, CORES_PER_LEVEL, MAX_LEVEL, WIN_SCORE } from './config.js';
import { createPlayer } from './player.js';
import { createSwarm } from './enemies.js';
import { createCache } from './pickups.js';

function touches(a, b, slack) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = a.radius + b.radius - slack;
  return dx * dx + dy * dy < reach * reach;
}

export function createWorld(random) {
  const drone = createPlayer();
  const swarm = createSwarm(random);
  const cache = createCache(random);
  const state = {
    score: 0,
    level: 1,
    combo: 0,
    comboTimer: 0,
    coresCollected: 0,
    elapsed: 0,
    over: false,
    won: false,
  };

  function reset() {
    drone.reset();
    swarm.reset();
    cache.reset();
    state.score = 0;
    state.level = 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.coresCollected = 0;
    state.elapsed = 0;
    state.over = false;
    state.won = false;
  }

  /** On the title screen the drone idles after the nearest core, so the backdrop is a game in miniature. */
  function ambientMove() {
    let nearest = null;
    let nearestDist = Infinity;
    for (const core of cache.cores) {
      if (!core.active) continue;
      const dist = (core.x - drone.state.x) ** 2 + (core.y - drone.state.y) ** 2;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = core;
      }
    }
    if (nearest === null) return { x: 0, y: 0 };
    const dx = nearest.x - drone.state.x;
    const dy = nearest.y - drone.state.y;
    const dist = Math.hypot(dx, dy) || 1;
    return { x: (dx / dist) * 0.45, y: (dy / dist) * 0.45 };
  }

  function collectCore(core, events) {
    core.active = false;
    state.combo = state.comboTimer > 0 ? Math.min(state.combo + 1, CORE.comboMax) : 1;
    state.comboTimer = CORE.comboWindow;
    const gained = CORE.points * state.combo;
    state.score += gained;
    state.coresCollected += 1;
    events.push({ type: 'core', x: core.x, y: core.y, gained, combo: state.combo });
    const level = Math.min(MAX_LEVEL, 1 + Math.floor(state.coresCollected / CORES_PER_LEVEL));
    if (level > state.level) {
      state.level = level;
      events.push({ type: 'level', level });
    }
  }

  function settleHit(hazard, events) {
    const outcome = drone.takeHit(hazard.x, hazard.y);
    if (outcome === 'ignored') return;
    hazard.active = false;
    if (outcome === 'shield') events.push({ type: 'shieldbreak', x: drone.state.x, y: drone.state.y });
    else {
      events.push({ type: 'hit', x: drone.state.x, y: drone.state.y });
      if (outcome === 'down') {
        state.over = true;
        events.push({ type: 'over' });
      }
    }
  }

  /**
   * One fixed step. `move` is the steering direction (each axis -1..1). With `harmless` set
   * (the title screen's backdrop) everything drifts and spawns, but nothing is collected and
   * nothing can be hit: the loop, not a recording of it.
   */
  function step(dt, move, harmless) {
    const events = [];
    if (state.over || state.won) {
      swarm.update(dt, state.level, drone.state);
      cache.update(dt, state.level, drone.state);
      return events;
    }
    state.elapsed += dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    drone.update(dt, harmless ? ambientMove() : move);
    swarm.update(dt, state.level, drone.state);
    cache.update(dt, state.level, drone.state);
    if (harmless) return events;

    for (const core of cache.cores) {
      if (core.active && touches(drone.state, core, 0)) collectCore(core, events);
    }
    if (cache.orb.active && touches(drone.state, cache.orb, 0)) {
      cache.orb.active = false;
      drone.state.shield = true;
      events.push({ type: 'shield', x: drone.state.x, y: drone.state.y });
    }
    for (const mine of swarm.mines) {
      if (mine.active && touches(drone.state, mine, 3)) settleHit(mine, events);
      if (state.over) break;
    }
    if (!state.over) {
      for (const wisp of swarm.wisps) {
        if (wisp.active && touches(drone.state, wisp, 3)) settleHit(wisp, events);
        if (state.over) break;
      }
    }
    if (!state.over && state.score >= WIN_SCORE) {
      state.won = true;
      events.push({ type: 'win' });
    }
    return events;
  }

  reset();
  return { state, drone, swarm, cache, reset, step };
}
