import { GAME } from "../core/constants.js";

export function loadRanks() {
  try {
    return JSON.parse(localStorage.getItem(GAME.rankKey) || "[]");
  } catch {
    return [];
  }
}

export function saveRank(name, score) {
  const ranks = loadRanks();
  ranks.push({
    name: (name || "PLAYER").trim().slice(0, 8).toUpperCase() || "PLAYER",
    score,
    date: Date.now(),
  });
  ranks.sort((a, b) => b.score - a.score);
  const top = ranks.slice(0, GAME.rankLimit);
  localStorage.setItem(GAME.rankKey, JSON.stringify(top));
  return top;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderRankList(elementId) {
  const list = document.getElementById(elementId);
  if (!list) return;
  const ranks = loadRanks();
  if (!ranks.length) {
    list.innerHTML = '<li><span class="rank-name">—</span><span>NO DATA</span></li>';
    return;
  }
  list.innerHTML = ranks
    .map(
      (r, i) =>
        `<li><span class="rank-name">${i + 1}. ${escapeHtml(r.name)}</span><span>${r.score}</span></li>`
    )
    .join("");
}
