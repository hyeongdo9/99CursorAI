import { MODE } from "../core/constants.js";
import { renderRankList } from "../data/ranking.js";

const overlay = document.getElementById("overlay");
const panels = {
  start: document.getElementById("panel-start"),
  pause: document.getElementById("panel-pause"),
  level: document.getElementById("panel-level"),
  boss: document.getElementById("panel-boss"),
  over: document.getElementById("panel-over"),
  win: document.getElementById("panel-win"),
};

const levelMsg = document.getElementById("level-msg");
const finalScore = document.getElementById("final-score");
const winScore = document.getElementById("win-score");

function hideAllPanels() {
  Object.values(panels).forEach((p) => {
    if (p) p.classList.add("hidden");
  });
}

export function syncOverlay(state) {
  if (!overlay) return;

  const show =
    state.mode === MODE.START ||
    state.mode === MODE.PAUSED ||
    state.mode === MODE.LEVEL_CLEAR ||
    state.mode === MODE.BOSS ||
    state.mode === MODE.OVER ||
    state.mode === MODE.WIN;

  overlay.classList.toggle("hidden", !show);
  if (!show) return;

  hideAllPanels();

  if (state.mode === MODE.START && panels.start) {
    panels.start.classList.remove("hidden");
    renderRankList("rank-list-start");
  } else if (state.mode === MODE.PAUSED && panels.pause) {
    panels.pause.classList.remove("hidden");
  } else if (state.mode === MODE.LEVEL_CLEAR && panels.level) {
    panels.level.classList.remove("hidden");
    if (levelMsg) {
      levelMsg.textContent =
        state.levelClearMsg || `레벨 ${state.level} 클리어! 점수 ${state.score}`;
    }
  } else if (state.mode === MODE.BOSS && panels.boss) {
    panels.boss.classList.remove("hidden");
  } else if (state.mode === MODE.OVER && panels.over) {
    panels.over.classList.remove("hidden");
    if (finalScore) finalScore.textContent = String(state.score);
    renderRankList("rank-list-over");
  } else if (state.mode === MODE.WIN && panels.win) {
    panels.win.classList.remove("hidden");
    if (winScore) winScore.textContent = String(state.score);
    renderRankList("rank-list-win");
  }
}

/**
 * @param {{ onStart, onResume, onNextLevel, onRetry, onBossFight, onSaveRank, onSaveRankWin }} handlers
 */
export function bindOverlayButtons(handlers) {
  const map = [
    ["btn-start", handlers.onStart],
    ["btn-resume", handlers.onResume],
    ["btn-next", handlers.onNextLevel],
    ["btn-retry", handlers.onRetry],
    ["btn-again", handlers.onRetry],
    ["btn-boss", handlers.onBossFight],
    ["btn-save-rank", handlers.onSaveRank],
    ["btn-save-rank-win", handlers.onSaveRankWin],
  ];

  map.forEach(([id, fn]) => {
    const btn = document.getElementById(id);
    if (btn && fn) btn.addEventListener("click", fn);
  });
}
