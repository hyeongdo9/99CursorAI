import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../core/constants.js";

/** 원-AABB 충돌 */
export function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
}

/** 좌우·상단 벽 반사. 하단 낙하 시 true 반환 */
export function collideBallWithWalls(ball) {
  let fell = false;

  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + ball.r > CANVAS_WIDTH) {
    ball.x = CANVAS_WIDTH - ball.r;
    ball.vx = -Math.abs(ball.vx);
  }

  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
  }

  if (ball.y - ball.r > CANVAS_HEIGHT + 20) {
    fell = true;
  }

  return fell;
}

/** 패들 충돌 — 맞은 위치에 따라 반사각 조절 */
export function collideBallWithPaddle(ball, paddle) {
  if (ball.vy <= 0) return false;
  if (!circleRect(ball.x, ball.y, ball.r, paddle.x, paddle.y, paddle.w, paddle.h)) {
    return false;
  }

  const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
  const clamped = Math.max(-1, Math.min(1, hit));
  const angle = clamped * (Math.PI / 3);
  const speed = Math.hypot(ball.vx, ball.vy) || 8;

  ball.vx = Math.sin(angle) * speed;
  ball.vy = -Math.cos(angle) * speed;
  ball.y = paddle.y - ball.r - 1;
  return true;
}

/** 사각형에서 공 반사 */
export function bounceBallOffRect(ball, rx, ry, rw, rh) {
  const nearestX = Math.max(rx, Math.min(ball.x, rx + rw));
  const nearestY = Math.max(ry, Math.min(ball.y, ry + rh));
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;

  if (Math.abs(dx) > Math.abs(dy)) {
    ball.vx *= -1;
    ball.x = dx > 0 ? rx + rw + ball.r : rx - ball.r;
  } else {
    ball.vy *= -1;
    ball.y = dy > 0 ? ry + rh + ball.r : ry - ball.r;
  }
}

/**
 * 살아 있는 벽돌과 충돌 시 해당 벽돌 반환 (호출측에서 피해 처리)
 */
export function collideBallWithBricks(ball, bricks) {
  for (const brick of bricks) {
    if (!brick.alive) continue;
    if (circleRect(ball.x, ball.y, ball.r, brick.x, brick.y, brick.w, brick.h)) {
      bounceBallOffRect(ball, brick.x, brick.y, brick.w, brick.h);
      return brick;
    }
  }
  return null;
}
