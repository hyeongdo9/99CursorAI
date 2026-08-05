import {
  POWER_DEFS,
  PADDLE,
  BALL,
  RANDOM_POWERS,
  GAME,
  CANVAS_HEIGHT,
} from "../core/constants.js";
import { createBall } from "./ball.js";

export function createPowerup(x, y, type) {
  const def = POWER_DEFS[type];
  if (!def) return null;
  return {
    x,
    y,
    r: 13,
    vy: 2.4,
    type: def.type,
    color: def.color,
    label: def.label,
  };
}

export function maybeDropFromBrick(brick, powers) {
  if (brick.isBoss) return;

  let type = brick.itemType || null;
  if (!type) {
    if (Math.random() > GAME.powerDropChance) return;
    type = RANDOM_POWERS[Math.floor(Math.random() * RANDOM_POWERS.length)];
  }

  const pu = createPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2, type);
  if (pu) powers.push(pu);
}

function ballSpeed(state) {
  const base = BALL.baseSpeed + (state.level - 1) * 0.35;
  const slow = state.slowTimer > 0 ? 0.7 : 1;
  return base * slow * state.speedMul;
}

/** 아이템 효과 적용 */
export function applyPower(state, type, sfx) {
  if (sfx?.power) sfx.power();

  if (type === "wide") {
    state.wideTimer = 480;
    state.paddle.w = PADDLE.width * PADDLE.wideScale;
    state.paddle.baseW = PADDLE.width;
  } else if (type === "multi") {
    const spd = ballSpeed(state);
    if (state.attached) {
      state.attached = false;
      const b = state.balls[0];
      state.balls = [
        createBall(b.x, b.y, -spd * 0.7, -spd * 0.75),
        createBall(b.x, b.y, 0, -spd),
        createBall(b.x, b.y, spd * 0.7, -spd * 0.75),
      ];
    } else {
      const base = state.balls[0] || { x: 450, y: 300 };
      while (state.balls.length < 3) {
        const ang = -Math.PI / 2 + (state.balls.length - 1) * 0.45;
        state.balls.push(
          createBall(base.x, base.y, Math.cos(ang) * spd, Math.sin(ang) * spd)
        );
      }
    }
  } else if (type === "laser") {
    state.laserTimer = 540;
  } else if (type === "slow") {
    state.slowTimer = 420;
    state.balls.forEach((b) => {
      if (state.attached) return;
      const spd = Math.hypot(b.vx, b.vy) || ballSpeed(state);
      const scale = ballSpeed(state) / spd;
      b.vx *= scale;
      b.vy *= scale;
    });
  } else if (type === "life") {
    state.lives = Math.min(state.lives + 1, 5);
  }
}

export function updatePowerups(state, sfx) {
  const { powers, paddle } = state;
  const sm = state.speedMul;

  for (let i = powers.length - 1; i >= 0; i--) {
    const pw = powers[i];
    pw.y += pw.vy * sm;
    if (
      pw.y + pw.r > paddle.y &&
      pw.y - pw.r < paddle.y + paddle.h &&
      pw.x > paddle.x &&
      pw.x < paddle.x + paddle.w
    ) {
      applyPower(state, pw.type, sfx);
      powers.splice(i, 1);
    } else if (pw.y - pw.r > CANVAS_HEIGHT) {
      powers.splice(i, 1);
    }
  }
}
