// Every tuning number and colour of Neon Salvage in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the size of the screen the game happens to open on.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Reaching this score completes the salvage contract and wins the run. */
export const WIN_SCORE = 4000;

/** The drone the player flies: a salvage moth with three points of hull. */
export const PLAYER = {
  radius: 16,
  acceleration: 2500,
  maxSpeed: 435,
  damping: 6.0,
  hull: 3,
  invulnerable: 1.6,
  knockback: 330,
};

/** Energy cores: the salvage itself. Grabbed in quick succession they feed the combo. */
export const CORE = {
  radius: 11,
  points: 25,
  interval: 0.9,
  intervalScale: 0.93,
  minInterval: 0.36,
  life: 14,
  drift: 26,
  comboWindow: 2.6,
  comboMax: 5,
};

/** The shield orb: rare, and worth detouring for. It eats the next hit for you. */
export const SHIELD = {
  radius: 13,
  firstAt: 9,
  interval: 17,
  life: 10,
};

/** Drift mines: dead cargo pods on a slow tumble. They only drift, but there are more of them every level. */
export const MINE = {
  radius: 15,
  speed: 60,
  speedPerLevel: 9,
  interval: 1.2,
  intervalScale: 0.91,
  minInterval: 0.4,
  maxActive: 7,
  maxActivePerLevel: 1.6,
  cap: 22,
};

/** Hunter wisps: rogue signal ghosts that steer after the drone. They arrive at level 3. */
export const WISP = {
  radius: 12,
  speed: 94,
  speedPerLevel: 7,
  turnRate: 2.3,
  firstLevel: 3,
  interval: 5.5,
  maxActive: 1,
  maxActivePerLevel: 0.7,
  cap: 5,
};

/** Collecting this many cores raises the level, and with it the pressure. */
export const CORES_PER_LEVEL = 6;
export const MAX_LEVEL = 10;

/** How far from the drone a thing may appear when it spawns, so nothing lands on the player's nose. */
export const SPAWN_CLEARANCE = 190;

export const PALETTE = {
  backdrop: '#070812',
  spaceTop: '#0d1030',
  spaceBottom: '#070918',
  grid: '#1c2150',
  frame: '#39407e',
  drone: '#39e6ff',
  droneCore: '#eafcff',
  flame: '#ffb347',
  core: '#3dffb0',
  shield: '#7ab8ff',
  mine: '#ff3d71',
  mineCore: '#ffe3ec',
  wisp: '#b26bff',
  wispEye: '#f4ecff',
  text: '#eef4ff',
  muted: '#8f9bbd',
  accent: '#ffd166',
  danger: '#ff5d7a',
  panel: 'rgba(11, 14, 34, 0.88)',
  panelEdge: '#39407e',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-salvage.best';
