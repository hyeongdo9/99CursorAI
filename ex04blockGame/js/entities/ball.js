import { BALL } from "../core/constants.js";

export function createBall(x, y, vx = 0, vy = 0) {
  return {
    x,
    y,
    r: BALL.radius,
    vx,
    vy,
    trail: [],
  };
}

/** 패들 위에 공을 붙인 상태로 생성 */
export function createBallOnPaddle(paddle) {
  return createBall(paddle.x + paddle.w / 2, paddle.y - BALL.radius - 2, 0, 0);
}

export function launchBall(ball, speed = BALL.baseSpeed) {
  const angle = -Math.PI / 2 + (Math.random() * 0.5 - 0.25);
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
}

export function moveBall(ball) {
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 8) ball.trail.shift();
  ball.x += ball.vx;
  ball.y += ball.vy;
}

export function stickBallToPaddle(ball, paddle) {
  ball.x = paddle.x + paddle.w / 2;
  ball.y = paddle.y - ball.r - 2;
  ball.vx = 0;
  ball.vy = 0;
  ball.trail.length = 0;
}
