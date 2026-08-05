/**
 * 벽돌 엔티티 생성·피해 처리
 */

export function createBrick({
  x,
  y,
  w,
  h,
  color,
  hp = 1,
  pattern = "stripe",
  itemType = null,
  isBoss = false,
  vx = 0,
}) {
  return {
    x,
    y,
    w,
    h,
    color,
    baseColor: color,
    hp,
    maxHp: hp,
    pattern,
    itemType,
    isBoss,
    vx,
    alive: true,
  };
}

/**
 * @returns {{ destroyed: boolean, points: number }}
 */
export function damageBrick(brick, level, combo) {
  brick.hp -= 1;

  if (brick.isBoss) {
    const ratio = brick.hp / brick.maxHp;
    brick.color = ratio > 0.6 ? "#ff0040" : ratio > 0.3 ? "#ff7a00" : "#ffe600";
  }

  if (brick.hp <= 0) {
    brick.alive = false;
    const points = brick.isBoss
      ? 500
      : 10 * level + (combo > 1 ? combo * 2 : 0);
    return { destroyed: true, points };
  }

  if (!brick.isBoss) brick.color = "#c0a8d8";
  return { destroyed: false, points: brick.isBoss ? 10 : 5 };
}

export function allBricksCleared(bricks) {
  return bricks.length > 0 && bricks.every((b) => !b.alive);
}
