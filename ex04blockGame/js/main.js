import { MODE, GAME, SPEED_LABELS, PADDLE } from "./core/constants.js";
import { createInitialState, setMode, cycleSpeed } from "./core/state.js";
import { createPaddle } from "./entities/paddle.js";
import { createBallOnPaddle } from "./entities/ball.js";
import { buildLevelBricks, buildBossBrick } from "./data/levels.js";
import { bindInput, consumeFrameInputs } from "./systems/input.js";
import { update } from "./systems/update.js";
import { render } from "./systems/render.js";
import { bindOverlayButtons, syncOverlay } from "./ui/overlay.js";
import { syncHud } from "./ui/hud.js";
import { saveRank } from "./data/ranking.js";
import {
  ensureAudio,
  startBgm,
  stopBgm,
  toggleMute,
  isMuted,
  SFX,
} from "./systems/audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");
const btnMute = document.getElementById("btn-mute");
const btnSpeed = document.getElementById("btn-speed");

const state = createInitialState();
let prevMode = state.mode;

function resetCombatExtras() {
  state.powers = [];
  state.lasers = [];
  state.particles = [];
  state.wideTimer = 0;
  state.slowTimer = 0;
  state.laserTimer = 0;
  state.laserCooldown = 0;
  state.combo = 0;
  state.input.launchPressed = false;
  state.input.spacePressed = false;
  state.input.firePressed = false;
}

function setupLevel(level) {
  state.level = level;
  state.isBossStage = false;
  if (stage) stage.classList.remove("boss-mode");
  state.paddle = createPaddle();
  state.balls = [createBallOnPaddle(state.paddle)];
  state.bricks = buildLevelBricks(level);
  state.attached = true;
  resetCombatExtras();
}

function startBossFight() {
  ensureAudio();
  startBgm();
  state.isBossStage = true;
  state.returnLevel = state.level;
  state.paddle = createPaddle();
  state.paddle.w = PADDLE.width * 1.4;
  state.balls = [createBallOnPaddle(state.paddle)];
  state.bricks = buildBossBrick();
  state.attached = true;
  resetCombatExtras();
  state.laserTimer = 600;
  state.wideTimer = 300;
  if (stage) stage.classList.add("boss-mode");
  SFX.bossAppear();
  setMode(state, MODE.PLAYING);
}

function startGame() {
  ensureAudio();
  startBgm();
  state.score = 0;
  state.lives = GAME.initialLives;
  state.bossTriggered = false;
  state.isBossStage = false;
  state.rankSaved = false;
  setupLevel(1);
  setMode(state, MODE.PLAYING);
}

function resumeGame() {
  setMode(state, MODE.PLAYING);
}

function nextLevel() {
  setupLevel(state.level + 1);
  setMode(state, MODE.PLAYING);
}

function updateSpeedBtn() {
  if (!btnSpeed) return;
  btnSpeed.textContent = `⏩ ${SPEED_LABELS[state.speedIndex]}`;
  btnSpeed.dataset.speed = String(state.speedMul);
}

function updateMuteBtn() {
  if (!btnMute) return;
  btnMute.classList.toggle("muted", isMuted());
  btnMute.textContent = isMuted() ? "♪ MUTE" : "♪ BGM";
}

setupLevel(1);
setMode(state, MODE.START);

bindInput(canvas, state);
bindOverlayButtons({
  onStart: startGame,
  onResume: resumeGame,
  onNextLevel: nextLevel,
  onRetry: () => {
    stopBgm();
    startGame();
  },
  onBossFight: startBossFight,
  onSaveRank: () => {
    if (state.rankSaved) return;
    saveRank(document.getElementById("player-name")?.value, state.score);
    state.rankSaved = true;
    syncOverlay(state);
  },
  onSaveRankWin: () => {
    if (state.rankSaved) return;
    saveRank(document.getElementById("player-name-win")?.value, state.score);
    state.rankSaved = true;
    syncOverlay(state);
  },
});

btnMute?.addEventListener("click", () => {
  ensureAudio();
  const muted = toggleMute();
  updateMuteBtn();
  if (!muted && state.mode === MODE.PLAYING) startBgm();
});

btnSpeed?.addEventListener("click", () => {
  cycleSpeed(state);
  updateSpeedBtn();
});

window.addEventListener("keydown", (e) => {
  if (e.code !== "Space") return;
  e.preventDefault();
  if (state.mode === MODE.START || state.mode === MODE.OVER || state.mode === MODE.WIN) {
    startGame();
  } else if (state.mode === MODE.LEVEL_CLEAR) {
    nextLevel();
  } else if (state.mode === MODE.BOSS) {
    startBossFight();
  }
});

syncHud(state);
syncOverlay(state);
updateSpeedBtn();
updateMuteBtn();

function frame() {
  update(state);
  if (
    (state.mode === MODE.OVER || state.mode === MODE.WIN) &&
    prevMode !== state.mode
  ) {
    stopBgm();
    state.rankSaved = false;
  }
  prevMode = state.mode;
  render(ctx, state);
  syncHud(state);
  syncOverlay(state);
  consumeFrameInputs(state.input);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
