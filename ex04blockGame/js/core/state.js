import { MODE, GAME, SPEED_PRESETS } from "./constants.js";

/**
 * 단일 게임 상태 (Step 3)
 */
export function createInitialState() {
  return {
    mode: MODE.START,
    score: 0,
    level: 1,
    lives: GAME.initialLives,
    combo: 0,
    attached: true,
    paddle: null,
    balls: [],
    bricks: [],
    powers: [],
    lasers: [],
    particles: [],
    wideTimer: 0,
    slowTimer: 0,
    laserTimer: 0,
    laserCooldown: 0,
    speedIndex: 1,
    speedMul: SPEED_PRESETS[1],
    bossTriggered: false,
    isBossStage: false,
    returnLevel: 1,
    flipTimer: 0,
    rankSaved: false,
    levelClearMsg: "",
    input: {
      left: false,
      right: false,
      mouseX: null,
      launchPressed: false,
      spacePressed: false,
      firePressed: false,
    },
  };
}

export function setMode(state, mode) {
  state.mode = mode;
}

export function setSpeedIndex(state, index) {
  const prev = state.speedMul;
  const len = SPEED_PRESETS.length;
  state.speedIndex = ((index % len) + len) % len;
  state.speedMul = SPEED_PRESETS[state.speedIndex];
  const ratio = state.speedMul / prev;

  if (!state.attached) {
    state.balls.forEach((b) => {
      b.vx *= ratio;
      b.vy *= ratio;
    });
  }
  state.lasers.forEach((L) => {
    L.vy *= ratio;
  });
  state.bricks.forEach((b) => {
    if (b.isBoss && b.vx) b.vx *= ratio;
  });
}

export function cycleSpeed(state) {
  setSpeedIndex(state, state.speedIndex + 1);
}
