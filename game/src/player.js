// The salvage moth: the drone the player flies. It accelerates toward the steering direction,
// coasts with damping when the keys let go, and banks its nose into its own velocity. A hit is
// answered here too: a raised shield eats it, an invulnerable drone ignores it, anything else
// costs a point of hull and knocks the drone away from whatever struck it.
import { FIELD, PLAYER } from './config.js';

export function createPlayer() {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    shield: false,
    invulnerable: 0,
    angle: -Math.PI / 2,
    speed: 0,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.hull = PLAYER.hull;
    player.shield = false;
    player.invulnerable = 0;
    player.angle = -Math.PI / 2;
    player.speed = 0;
  }

  /** Advance one step. `move` is the steering direction, each axis -1..1 (a pointer's pull, already scaled). */
  function update(dt, move) {
    player.vx += move.x * PLAYER.acceleration * dt;
    player.vy += move.y * PLAYER.acceleration * dt;
    const damp = Math.exp(-PLAYER.damping * dt);
    player.vx *= damp;
    player.vy *= damp;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (player.x < player.radius) { player.x = player.radius; player.vx = 0; }
    if (player.x > FIELD.width - player.radius) { player.x = FIELD.width - player.radius; player.vx = 0; }
    if (player.y < player.radius) { player.y = player.radius; player.vy = 0; }
    if (player.y > FIELD.height - player.radius) { player.y = FIELD.height - player.radius; player.vy = 0; }
    player.speed = Math.hypot(player.vx, player.vy);
    if (player.speed > 24) player.angle = Math.atan2(player.vy, player.vx);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
  }

  /**
   * Something struck the drone at (fromX, fromY). Returns 'ignored' while invulnerable,
   * 'shield' when the shield ate the hit, 'hull' when it cost hull and 'down' when it was the last.
   */
  function takeHit(fromX, fromY) {
    if (player.invulnerable > 0) return 'ignored';
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    player.vx = (dx / dist) * PLAYER.knockback;
    player.vy = (dy / dist) * PLAYER.knockback;
    player.invulnerable = PLAYER.invulnerable;
    if (player.shield) {
      player.shield = false;
      return 'shield';
    }
    player.hull -= 1;
    return player.hull <= 0 ? 'down' : 'hull';
  }

  reset();
  return { state: player, reset, update, takeHit };
}
