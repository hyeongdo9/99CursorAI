const el = {
  score: document.getElementById("score"),
  level: document.getElementById("level"),
  lives: document.getElementById("lives"),
};

export function syncHud(state) {
  if (!el.score) return;
  el.score.textContent = String(state.score);
  el.level.textContent = state.isBossStage ? "BOSS" : String(state.level);
  el.lives.textContent =
    state.lives > 0 ? "♥".repeat(Math.min(state.lives, 5)) : "—";
}
