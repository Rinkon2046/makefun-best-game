// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 field is
// scaled to fit the window and centred, the margin filled with the backdrop colour. Everything
// is drawn with canvas paths — a neon salvage field of grid, stars and glow — and the renderer
// also keeps the purely visual dressing the rules do not need: pickup sparks, floating score
// text, the drone's engine trail and the screen shake when a hit lands.
import { CORE, CORES_PER_LEVEL, FIELD, FONT, PALETTE, PLAYER, WIN_SCORE } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas, seed) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };
  const starRandom = createRandom((seed ^ 0x9e3779b9) | 0);
  const stars = [];
  for (let index = 0; index < 130; index += 1) {
    stars.push({ x: starRandom() * FIELD.width, y: starRandom() * FIELD.height, r: 0.8 + starRandom() * 1.6, phase: starRandom() * Math.PI * 2 });
  }
  const particles = [];
  const floaters = [];
  let gradient = null;
  let shakeMag = 0;
  let lastPaint = performance.now();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.ratio = ratio;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
    gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.spaceTop);
    gradient.addColorStop(1, PALETTE.spaceBottom);
  }

  /** Window pixel coordinates (a pointer event's clientX/Y) as field coordinates. */
  function toField(clientX, clientY) {
    return {
      x: (clientX * view.ratio - view.x) / view.scale,
      y: (clientY * view.ratio - view.y) / view.scale,
    };
  }

  function burst(x, y, color, count = 14, speed = 260) {
    for (let index = 0; index < count; index += 1) {
      const heading = Math.random() * Math.PI * 2;
      const pace = speed * (0.3 + Math.random() * 0.7);
      particles.push({
        x, y,
        vx: Math.cos(heading) * pace,
        vy: Math.sin(heading) * pace,
        life: 0.45 + Math.random() * 0.3,
        age: 0,
        size: 2 + Math.random() * 2.5,
        color,
      });
    }
  }

  function floater(x, y, text, color) {
    floaters.push({ x, y, text, color, age: 0, life: 1.1 });
  }

  function shake(magnitude) {
    shakeMag = Math.max(shakeMag, magnitude);
  }

  function text(value, x, y, size, color, align, weight = 400) {
    context.font = `${weight} ${size}px ${FONT}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(now) {
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
    context.fillStyle = PALETTE.text;
    for (const star of stars) {
      context.globalAlpha = 0.3 + 0.3 * Math.sin(now * 1.4 + star.phase);
      context.fillRect(star.x, star.y, star.r, star.r);
    }
    context.globalAlpha = 1;
    context.strokeStyle = PALETTE.frame;
    context.lineWidth = 3;
    context.strokeRect(4, 4, FIELD.width - 8, FIELD.height - 8);
  }

  function drawCore(core, now) {
    const fade = core.age > CORE.life - 2 ? Math.max(0, (CORE.life - core.age) / 2) : 1;
    const scale = 1 + 0.16 * Math.sin(core.phase * 2);
    context.save();
    context.translate(core.x, core.y);
    context.rotate(Math.PI / 4 + Math.sin(core.phase) * 0.2);
    context.scale(scale, scale);
    context.globalAlpha = fade;
    context.shadowColor = PALETTE.core;
    context.shadowBlur = 16;
    context.fillStyle = PALETTE.core;
    const half = core.radius * 0.95;
    context.fillRect(-half, -half, half * 2, half * 2);
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.droneCore;
    const inner = half * 0.42;
    context.fillRect(-inner, -inner, inner * 2, inner * 2);
    context.restore();
  }

  function drawOrb(orb, now) {
    context.save();
    context.translate(orb.x, orb.y);
    context.strokeStyle = PALETTE.shield;
    context.lineWidth = 3;
    context.shadowColor = PALETTE.shield;
    context.shadowBlur = 14;
    context.setLineDash([9, 7]);
    context.lineDashOffset = -now * 26;
    context.beginPath();
    context.arc(0, 0, orb.radius + 3, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.shield;
    context.globalAlpha = 0.3 + 0.12 * Math.sin(orb.phase * 2);
    context.beginPath();
    context.arc(0, 0, orb.radius - 2, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.droneCore;
    context.beginPath();
    context.arc(0, 0, 3.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawMine(mine, now) {
    context.save();
    context.translate(mine.x, mine.y);
    context.rotate(now * mine.spin + mine.pulse * 0.4);
    context.shadowColor = PALETTE.mine;
    context.shadowBlur = 12;
    context.fillStyle = PALETTE.mine;
    context.beginPath();
    const spikes = 8;
    for (let index = 0; index < spikes * 2; index += 1) {
      const angle = (index / (spikes * 2)) * Math.PI * 2;
      const reach = index % 2 === 0 ? mine.radius + 5 : mine.radius * 0.68;
      const px = Math.cos(angle) * reach;
      const py = Math.sin(angle) * reach;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = '#57122b';
    context.beginPath();
    context.arc(0, 0, mine.radius * 0.58, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.mineCore;
    context.beginPath();
    context.arc(0, 0, 2.6 + Math.sin(mine.pulse) * 1.1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWisp(wisp, now) {
    context.save();
    context.translate(wisp.x, wisp.y);
    const speed = Math.hypot(wisp.vx, wisp.vy) || 1;
    const ux = wisp.vx / speed;
    const uy = wisp.vy / speed;
    context.fillStyle = PALETTE.wisp;
    for (let trail = 3; trail >= 1; trail -= 1) {
      context.globalAlpha = 0.1 * (4 - trail);
      context.beginPath();
      context.arc(-ux * trail * 9, -uy * trail * 9, wisp.radius * (1 - trail * 0.2), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.shadowColor = PALETTE.wisp;
    context.shadowBlur = 14;
    const scale = 1 + 0.08 * Math.sin(wisp.pulse);
    context.scale(scale, scale);
    context.beginPath();
    context.arc(0, 0, wisp.radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.wispEye;
    const ex = ux * 4;
    const ey = uy * 4;
    context.beginPath();
    context.arc(ex - uy * 4.4, ey + ux * 4.4, 2.1, 0, Math.PI * 2);
    context.arc(ex + uy * 4.4, ey - ux * 4.4, 2.1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawDrone(drone, now) {
    context.save();
    context.translate(drone.x, drone.y);
    if (drone.speed > 130) {
      const tailX = Math.cos(drone.angle) * -drone.radius;
      const tailY = Math.sin(drone.angle) * -drone.radius;
      particles.push({
        x: drone.x + tailX, y: drone.y + tailY,
        vx: -drone.vx * 0.25, vy: -drone.vy * 0.25,
        life: 0.3, age: 0, size: 2.6, color: PALETTE.drone,
      });
    }
    context.rotate(drone.angle);
    if (drone.speed > 40) {
      const flame = 10 + (drone.speed / PLAYER.maxSpeed) * 12 + Math.sin(now * 41) * 3;
      context.fillStyle = PALETTE.flame;
      context.globalAlpha = 0.85;
      context.beginPath();
      context.moveTo(-13, 5);
      context.lineTo(-13 - flame, 0);
      context.lineTo(-13, -5);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    }
    if (drone.invulnerable > 0 && Math.floor(now * 12) % 2 === 0) context.globalAlpha = 0.35;
    context.shadowColor = PALETTE.drone;
    context.shadowBlur = 16;
    context.fillStyle = PALETTE.drone;
    context.beginPath();
    context.moveTo(21, 0);
    context.lineTo(-8, 7);
    context.lineTo(-15, 13);
    context.lineTo(-11, 0);
    context.lineTo(-15, -13);
    context.lineTo(-8, -7);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.droneCore;
    context.beginPath();
    context.arc(4, 0, 5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (drone.shield) {
      context.save();
      context.translate(drone.x, drone.y);
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 2.5;
      context.globalAlpha = 0.75 + 0.25 * Math.sin(now * 5);
      context.setLineDash([11, 8]);
      context.lineDashOffset = -now * 34;
      context.beginPath();
      context.arc(0, 0, drone.radius + 10, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }

  function drawParticles(dt) {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.age += dt;
      if (particle.age >= particle.life) {
        particles.splice(index, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      context.globalAlpha = 1 - particle.age / particle.life;
      context.fillStyle = particle.color;
      context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    context.globalAlpha = 1;
  }

  function drawFloaters(dt) {
    context.textAlign = 'center';
    for (let index = floaters.length - 1; index >= 0; index -= 1) {
      const floater = floaters[index];
      floater.age += dt;
      if (floater.age >= floater.life) {
        floaters.splice(index, 1);
        continue;
      }
      context.globalAlpha = 1 - floater.age / floater.life;
      text(floater.text, floater.x, floater.y - floater.age * 36, 22, floater.color, 'center', 700);
    }
    context.globalAlpha = 1;
  }

  function drawHud(world, muted) {
    const state = world.state;
    const drone = world.drone.state;
    context.textBaseline = 'top';
    text('SCORE', 26, 18, 15, PALETTE.muted, 'left', 700);
    text(String(state.score), 26, 38, 34, PALETTE.text, 'left', 700);
    if (state.combo >= 2) {
      text(`COMBO x${state.combo}`, 26, 80, 20, PALETTE.accent, 'left', 700);
      context.fillStyle = PALETTE.panelEdge;
      context.fillRect(26, 106, 120, 5);
      context.fillStyle = PALETTE.accent;
      context.fillRect(26, 106, 120 * Math.max(0, state.comboTimer / CORE.comboWindow), 5);
    }
    text(`LEVEL ${state.level}`, FIELD.width / 2, 18, 22, PALETTE.text, 'center', 700);
    text(`TARGET ${WIN_SCORE}`, FIELD.width / 2, 46, 14, PALETTE.muted, 'center');
    const intoLevel = state.coresCollected % CORES_PER_LEVEL;
    for (let pip = 0; pip < CORES_PER_LEVEL; pip += 1) {
      context.fillStyle = pip < intoLevel ? PALETTE.core : PALETTE.panelEdge;
      context.fillRect(FIELD.width / 2 - CORES_PER_LEVEL * 9 + pip * 18, 68, 12, 6);
    }
    text('HULL', FIELD.width - 26, 18, 15, PALETTE.muted, 'right', 700);
    for (let hull = 0; hull < PLAYER.hull; hull += 1) {
      const cx = FIELD.width - 44 - hull * 30;
      context.save();
      context.translate(cx, 52);
      context.rotate(-Math.PI / 2);
      context.fillStyle = hull < drone.hull ? PALETTE.drone : PALETTE.panelEdge;
      context.beginPath();
      context.moveTo(11, 0);
      context.lineTo(-7, 6);
      context.lineTo(-7, -6);
      context.closePath();
      context.fill();
      context.restore();
    }
    if (drone.shield) text('SHIELD UP', FIELD.width - 26, 74, 16, PALETTE.shield, 'right', 700);
    if (muted) text('MUTED', FIELD.width - 26, FIELD.height - 34, 14, PALETTE.muted, 'right');
    context.textBaseline = 'alphabetic';
  }

  function roundRectPath(x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.arcTo(x + width, y, x + width, y + radius, radius);
    context.lineTo(x + width, y + height - radius);
    context.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    context.lineTo(x + radius, y + height);
    context.arcTo(x, y + height, x, y + height - radius, radius);
    context.lineTo(x, y + radius);
    context.arcTo(x, y, x + radius, y, radius);
    context.closePath();
  }

  function drawPanel(title, titleColor, lines, prompt, now) {
    const width = 660;
    const height = 118 + lines.length * 32 + 74;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRectPath(x, y, width, height, 18);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    context.shadowColor = titleColor;
    context.shadowBlur = 22;
    text(title, FIELD.width / 2, y + 76, 54, titleColor, 'center', 800);
    context.shadowBlur = 0;
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + 122 + index * 32, 20, PALETTE.text, 'center');
    }
    context.globalAlpha = 0.65 + 0.35 * Math.sin(now * 3.4);
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.accent, 'center', 700);
    context.globalAlpha = 1;
  }

  function statsLines(world, best) {
    const state = world.state;
    const seconds = Math.floor(state.elapsed);
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    return [
      `Final haul ${state.score}   ·   Best ${best}`,
      `Cores hauled ${state.coresCollected}   ·   Level ${state.level}   ·   Time ${time}`,
    ];
  }

  /** Paint one frame: the field and everything in it, then the HUD or the screen's panel. */
  function draw(world, screen, best, muted) {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, (performance.now() - lastPaint) / 1000);
    lastPaint = performance.now();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const offsetX = shakeMag > 0.2 ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const offsetY = shakeMag > 0.2 ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    shakeMag *= Math.exp(-7 * dt);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + offsetX * view.scale, view.y + offsetY * view.scale);
    drawBackground(now);
    for (const core of world.cache.cores) if (core.active) drawCore(core, now);
    if (world.cache.orb.active) drawOrb(world.cache.orb, now);
    for (const mine of world.swarm.mines) if (mine.active) drawMine(mine, now);
    for (const wisp of world.swarm.wisps) if (wisp.active) drawWisp(wisp, now);
    drawDrone(world.drone.state, now);
    drawParticles(dt);
    drawFloaters(dt);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(world, muted);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Pilot the Moth. Haul the cores. Mind the mines.',
        'Steer with WASD, the arrow keys, or hold the mouse down.',
        `Cores pay 25 x your combo — chain them fast, reach ${WIN_SCORE} to win.`,
        'Drift mines wander. Hunter wisps hunt. Three hull is all you get.',
        'P pauses · M mutes',
      ];
      if (best > 0) lines.push(`Best haul so far: ${best}`);
      drawPanel('NEON SALVAGE', PALETTE.drone, lines, 'Press SPACE or click to launch', now);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', PALETTE.text, ['The field will wait for you.'], 'Press P to resume', now);
    } else if (screen === SCREEN_OVER) {
      drawPanel('DRONE DOWN', PALETTE.danger, statsLines(world, best), 'Press SPACE or click to fly again', now);
    } else if (screen === SCREEN_WIN) {
      drawPanel('CONTRACT COMPLETE', PALETTE.core, statsLines(world, best), 'Press SPACE or click to fly again', now);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, burst, floater, shake, toField };
}
