import { CANVAS_WIDTH, CANVAS_HEIGHT, PADDLE } from "../core/constants.js";

export function createPaddle() {
  return {
    w: PADDLE.width,
    h: PADDLE.height,
    baseW: PADDLE.width,
    x: CANVAS_WIDTH / 2 - PADDLE.width / 2,
    y: CANVAS_HEIGHT - PADDLE.marginBottom,
    speed: PADDLE.speed,
  };
}

export function updatePaddle(paddle, input, speedMul = 1) {
  if (input.left) paddle.x -= paddle.speed * speedMul;
  if (input.right) paddle.x += paddle.speed * speedMul;
  if (input.mouseX !== null) {
    paddle.x = input.mouseX - paddle.w / 2;
  }

  const pad = PADDLE.wallPadding;
  paddle.x = Math.max(pad, Math.min(CANVAS_WIDTH - paddle.w - pad, paddle.x));
}
