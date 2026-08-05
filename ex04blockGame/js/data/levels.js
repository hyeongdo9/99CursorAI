import {
  CANVAS_WIDTH,
  BRICK_PALETTE,
  BRICK_PATTERNS,
  GAME,
} from "../core/constants.js";
import { createBrick } from "../entities/brick.js";

/**
 * 레이아웃 셀:
 * 0 = 빈칸
 * 1~7 = 일반
 * 8 = 단단한 벽돌
 * 9 = WIDE 아이템
 * 10 = MULTI(×3) 아이템
 * 11 = LASER 아이템
 */
function levelLayout(level) {
  const rows = Math.min(4 + level, 9);
  const cols = 11;
  const grid = [];

  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      let cell = (r % 7) + 1;

      if (level >= 3 && (r + c) % 5 === 0) cell = 8;
      if (level >= 5 && r === 0) cell = 8;
      if (level === 2 && (c < 2 || c > cols - 3)) cell = 0;
      if (level === 4 && r % 2 === 1 && c % 2 === 0) cell = 0;
      if (level === 6 && Math.abs(c - 5) + Math.abs(r - 3) > 6) cell = 0;

      if (c === 2 && r === Math.floor(rows / 2)) cell = 9;
      if (c === 8 && r === Math.floor(rows / 2)) cell = 10;
      if (c === 5 && r === 1) cell = 11;
      if (level >= 3 && c === 5 && r === rows - 1) cell = 10;

      row.push(cell);
    }
    grid.push(row);
  }

  return grid;
}

function itemTypeFromCell(cell) {
  if (cell === 9) return "wide";
  if (cell === 10) return "multi";
  if (cell === 11) return "laser";
  return null;
}

export function buildLevelBricks(level) {
  const grid = levelLayout(level);
  const cols = grid[0].length;
  const gap = 6;
  const top = 56;
  const side = 28;
  const bw = (CANVAS_WIDTH - side * 2 - gap * (cols - 1)) / cols;
  const bh = 22;
  const bricks = [];

  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return;
      const tough = cell === 8;
      const itemType = itemTypeFromCell(cell);
      let color = tough
        ? "#fff5ff"
        : itemType === "wide"
          ? "#00f0ff"
          : itemType === "multi"
            ? "#ff2bd6"
            : itemType === "laser"
              ? "#ff0040"
              : BRICK_PALETTE[(r + c) % BRICK_PALETTE.length];

      bricks.push(
        createBrick({
          x: side + c * (bw + gap),
          y: top + r * (bh + gap),
          w: bw,
          h: bh,
          color,
          hp: tough ? 2 : 1,
          pattern: itemType ? "circuit" : BRICK_PATTERNS[(r * 3 + c) % BRICK_PATTERNS.length],
          itemType,
        })
      );
    });
  });

  return bricks;
}

export function buildBossBrick() {
  return [
    createBrick({
      x: CANVAS_WIDTH / 2 - 160,
      y: 80,
      w: 320,
      h: 120,
      color: "#ff0040",
      hp: GAME.bossHp,
      pattern: "boss",
      isBoss: true,
      vx: 2.2,
    }),
  ];
}
