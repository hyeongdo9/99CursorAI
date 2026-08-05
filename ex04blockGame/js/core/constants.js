/** 공통 상수 — Step 3 확장 */

export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 600;

export const PADDLE = {
  width: 110,
  height: 14,
  speed: 9,
  marginBottom: 48,
  wallPadding: 8,
  wideScale: 1.65,
};

export const BALL = {
  radius: 8,
  baseSpeed: 8,
};

export const GAME = {
  maxLevel: 6,
  initialLives: 3,
  bossScoreTrigger: 1000,
  bossHp: 40,
  powerDropChance: 0.5,
  rankKey: "neonbreak_ranks_v1",
  rankLimit: 8,
};

export const SPEED_PRESETS = [0.5, 1, 1.5, 2];
export const SPEED_LABELS = ["0.5×", "1×", "1.5×", "2×"];

export const POWER_DEFS = {
  wide: { type: "wide", color: "#00f0ff", label: "W" },
  multi: { type: "multi", color: "#ff2bd6", label: "×3" },
  laser: { type: "laser", color: "#ff0040", label: "L" },
  slow: { type: "slow", color: "#ffe600", label: "S" },
  life: { type: "life", color: "#39ff14", label: "♥" },
};

export const RANDOM_POWERS = ["wide", "multi", "laser", "slow", "life"];

export const BRICK_PALETTE = [
  "#ff0040",
  "#ff7a00",
  "#ffe600",
  "#39ff14",
  "#00f0ff",
  "#2979ff",
  "#d500f9",
];

export const BRICK_PATTERNS = [
  "stripe",
  "diamond",
  "dots",
  "chevron",
  "circuit",
  "hex",
  "wave",
];

export const MODE = {
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  LEVEL_CLEAR: "levelClear",
  BOSS_INTRO: "bossIntro",
  BOSS: "boss",
  OVER: "over",
  WIN: "win",
};
