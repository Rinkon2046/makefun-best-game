// The hazards: drift mines and hunter wisps. Mines are dead cargo pods on a slow tumble — they
// drift in straight lines and bounce off the field's walls, harmless to predict and fatal to
// touch. Wisps are rogue signal ghosts that steer after the drone with a limited turn rate, so a
// sharp change of direction shakes them off. Both pools are allocated once; spawning is a timer
// whose interval and cap tighten as the level rises.
import { FIELD, MINE, SPAWN_CLEARANCE, WISP } from './config.js';
import { randomPointClearOf } from './random.js';

const MINE_POOL = 26;
const WISP_POOL = 6;

export function createSwarm(random) {
  const mines = [];
  for (let index = 0; index < MINE_POOL; index += 1) {
    mines.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: MINE.radius, pulse: 0, spin: 0 });
  }
  const wisps = [];
  for (let index = 0; index < WISP_POOL; index += 1) {
    wisps.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: WISP.radius, pulse: 0 });
  }
  let mineTimer = MINE.interval;
  let wispTimer = WISP.interval;

  function reset() {
    for (const mine of mines) mine.active = false;
    for (const wisp of wisps) wisp.active = false;
    mineTimer = MINE.interval;
    wispTimer = WISP.interval;
  }

  function activeCount(pool) {
    let count = 0;
    for (const item of pool) if (item.active) count += 1;
    return count;
  }

  function spawnMine(level, player) {
    if (activeCount(mines) >= Math.min(MINE.cap, MINE.maxActive + MINE.maxActivePerLevel * (level - 1))) return;
    const mine = mines.find((item) => !item.active);
    if (!mine) return;
    const point = randomPointClearOf(random, SPAWN_CLEARANCE, player.x, player.y, FIELD.width, FIELD.height);
    const speed = MINE.speed + MINE.speedPerLevel * (level - 1) + random() * 34;
    const heading = random() * Math.PI * 2;
    mine.active = true;
    mine.x = point.x;
    mine.y = point.y;
    mine.vx = Math.cos(heading) * speed;
    mine.vy = Math.sin(heading) * speed;
    mine.pulse = random() * Math.PI * 2;
    mine.spin = (random() - 0.5) * 1.4;
  }

  function spawnWisp(level, player) {
    if (activeCount(wisps) >= Math.min(WISP.cap, WISP.maxActive + WISP.maxActivePerLevel * (level - 1))) return;
    const wisp = wisps.find((item) => !item.active);
    if (!wisp) return;
    const point = randomPointClearOf(random, SPAWN_CLEARANCE + 60, player.x, player.y, FIELD.width, FIELD.height);
    wisp.active = true;
    wisp.x = point.x;
    wisp.y = point.y;
    wisp.vx = 0;
    wisp.vy = 0;
    wisp.pulse = random() * Math.PI * 2;
  }

  /** Advance every hazard one step. Wisps hunt `player`; mines only drift and bounce. */
  function update(dt, level, player) {
    mineTimer -= dt;
    if (mineTimer <= 0) {
      spawnMine(level, player);
      mineTimer += Math.max(MINE.minInterval, MINE.interval * MINE.intervalScale ** (level - 1));
    }
    if (level >= WISP.firstLevel) {
      wispTimer -= dt;
      if (wispTimer <= 0) {
        spawnWisp(level, player);
        wispTimer += WISP.interval;
      }
    }
    for (const mine of mines) {
      if (!mine.active) continue;
      mine.x += mine.vx * dt;
      mine.y += mine.vy * dt;
      mine.pulse += dt * 3;
      if (mine.x < mine.radius) { mine.x = mine.radius; mine.vx = Math.abs(mine.vx); }
      if (mine.x > FIELD.width - mine.radius) { mine.x = FIELD.width - mine.radius; mine.vx = -Math.abs(mine.vx); }
      if (mine.y < mine.radius) { mine.y = mine.radius; mine.vy = Math.abs(mine.vy); }
      if (mine.y > FIELD.height - mine.radius) { mine.y = FIELD.height - mine.radius; mine.vy = -Math.abs(mine.vy); }
    }
    const wispSpeed = WISP.speed + WISP.speedPerLevel * (level - 1);
    for (const wisp of wisps) {
      if (!wisp.active) continue;
      const want = Math.atan2(player.y - wisp.y, player.x - wisp.x);
      const now = Math.atan2(wisp.vy, wisp.vx);
      let turn = want - now;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const maxTurn = WISP.turnRate * dt;
      const heading = now + Math.max(-maxTurn, Math.min(maxTurn, turn));
      const blend = Math.min(1, dt * 3);
      wisp.vx += (Math.cos(heading) * wispSpeed - wisp.vx) * blend;
      wisp.vy += (Math.sin(heading) * wispSpeed - wisp.vy) * blend;
      wisp.x += wisp.vx * dt;
      wisp.y += wisp.vy * dt;
      wisp.pulse += dt * 5;
      if (wisp.x < wisp.radius) wisp.x = wisp.radius;
      if (wisp.x > FIELD.width - wisp.radius) wisp.x = FIELD.width - wisp.radius;
      if (wisp.y < wisp.radius) wisp.y = wisp.radius;
      if (wisp.y > FIELD.height - wisp.radius) wisp.y = FIELD.height - wisp.radius;
    }
  }

  reset();
  return { mines, wisps, reset, update };
}
