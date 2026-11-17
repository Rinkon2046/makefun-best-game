// Keyboard and pointer input. Held keys give a steering direction on two axes; one-shot presses
// (launch or restart, pause, mute) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The pointer steers while it is held
// down: the loop asks where it is and flies the drone at it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  const pointer = { down: false, clientX: 0, clientY: 0 };

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    pointer.down = false;
  });
  target.addEventListener('pointerdown', (event) => {
    pointer.down = true;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });

  return {
    /** Steering from the held keys: each axis is -1, 0 or 1, the pair not normalised. */
    axes() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (LEFT.has(code)) x -= 1;
        else if (RIGHT.has(code)) x += 1;
        else if (UP.has(code)) y -= 1;
        else if (DOWN.has(code)) y += 1;
      }
      return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    },
    /** Where the pointer is, in window pixels, and whether it is held down. */
    pointer,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
