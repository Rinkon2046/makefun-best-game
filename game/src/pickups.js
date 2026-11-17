// The salvage: energy cores and the shield orb. Cores drift gently and fade if nobody hauls
// them in time; the orb is rare — one early, then one every so often — and grants the shield
// that eats the next hit. Both pools are allocated once, and spawning keeps its distance from
// the drone so a prize never appears inside a hazard's lap by surprise.
import { CORE, FIELD, SHIELD, SPAWN_CLEARANCE } from './config.js';
import { randomPointClearOf } from './random.js';

const CORE_POOL = 24;

export function createCache(random) {
  const cores = [];
  for (let index = 0; index < CORE_POOL; index += 1) {
    cores.push({ active: false, x: 0, y: 0, homeX: 0, homeY: 0, radius: CORE.radius, age: 0, phase: 0 });
  }
  const orb = { active: false, x: 0, y: 0, radius: SHIELD.radius, age: 0, phase: 0 };
  let coreTimer = 0.3;
  let orbTimer = SHIELD.firstAt;

  function reset() {
    for (const core of cores) core.active = false;
    orb.active = false;
    coreTimer = 0.3;
    orbTimer = SHIELD.firstAt;
  }

  function spawnCore(player) {
    const core = cores.find((item) => !item.active);
    if (!core) return;
    const point = randomPointClearOf(random, SPAWN_CLEARANCE * 0.6, player.x, player.y, FIELD.width, FIELD.height);
    core.active = true;
    core.homeX = point.x;
    core.homeY = point.y;
    core.x = point.x;
    core.y = point.y;
    core.age = 0;
    core.phase = random() * Math.PI * 2;
  }

  function spawnOrb(player) {
    if (orb.active) return;
    const point = randomPointClearOf(random, SPAWN_CLEARANCE, player.x, player.y, FIELD.width, FIELD.height);
    orb.active = true;
    orb.x = point.x;
    orb.y = point.y;
    orb.age = 0;
    orb.phase = random() * Math.PI * 2;
  }

  /** Advance the salvage one step: timers spawn, cores bob on their anchor, old prizes fade away. */
  function update(dt, level, player) {
    coreTimer -= dt;
    if (coreTimer <= 0) {
      spawnCore(player);
      coreTimer += Math.max(CORE.minInterval, CORE.interval * CORE.intervalScale ** (level - 1));
    }
    orbTimer -= dt;
    if (orbTimer <= 0) {
      spawnOrb(player);
      orbTimer += SHIELD.interval;
    }
    for (const core of cores) {
      if (!core.active) continue;
      core.age += dt;
      core.phase += dt * 2;
      core.x = core.homeX + Math.sin(core.phase * 0.7) * CORE.drift;
      core.y = core.homeY + Math.cos(core.phase * 0.9) * CORE.drift * 0.6;
      if (core.age >= CORE.life) core.active = false;
    }
    if (orb.active) {
      orb.age += dt;
      orb.phase += dt * 2.4;
      if (orb.age >= SHIELD.life) orb.active = false;
    }
  }

  reset();
  return { cores, orb, reset, update };
}
