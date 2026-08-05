import { MODE, GAME, BALL, PADDLE } from "../core/constants.js";
import { setMode } from "../core/state.js";
import { updatePaddle } from "../entities/paddle.js";
import {
  launchBall,
  moveBall,
  stickBallToPaddle,
  createBallOnPaddle,
} from "../entities/ball.js";
import { damageBrick, allBricksCleared } from "../entities/brick.js";
import { maybeDropFromBrick, updatePowerups } from "../entities/powerup.js";
import { fireLasers, updateLasers } from "../entities/laser.js";
import { spawnParticles, updateParticles } from "../entities/particles.js";
import {
  collideBallWithWalls,
  collideBallWithPaddle,
  collideBallWithBricks,
} from "./collision.js";
import { SFX } from "./audio.js";

function ballSpeed(state) {
  const base = BALL.baseSpeed + (state.level - 1) * 0.35;
  const slow = state.slowTimer > 0 ? 0.7 : 1;
  return base * slow * state.speedMul;
}

function tryTriggerBoss(state) {
  if (
    !state.bossTriggered &&
    !state.isBossStage &&
    state.score >= GAME.bossScoreTrigger &&
    state.mode === MODE.PLAYING
  ) {
    state.bossTriggered = true;
    state.flipTimer = 70;
    setMode(state, MODE.BOSS_INTRO);
    SFX.bossAppear();
    const stage = document.getElementById("stage");
    if (stage) {
      stage.classList.add("flipping");
      setTimeout(() => stage.classList.remove("flipping"), 1100);
    }
    return true;
  }
  return false;
}

function handleBrickDamage(state, brick, fromLaser = false) {
  const nextCombo = fromLaser ? state.combo : state.combo + 1;
  const result = damageBrick(brick, state.level, nextCombo);
  state.score += result.points;

  if (brick.isBoss) SFX.bossHit();
  else if (result.destroyed) SFX.brick();
  else if (!fromLaser) SFX.bounce();

  if (result.destroyed) {
    if (!brick.isBoss) state.combo = nextCombo;
    spawnParticles(
      state.particles,
      brick.x + brick.w / 2,
      brick.y + brick.h / 2,
      brick.color,
      brick.isBoss ? 36 : 12
    );
    maybeDropFromBrick(brick, state.powers);
  } else {
    spawnParticles(
      state.particles,
      brick.x + brick.w / 2,
      brick.y + brick.h / 2,
      brick.color,
      5
    );
  }

  tryTriggerBoss(state);
  return result;
}

/**
 * Step 3 갱신 — 아이템·레이저·보스·속도 배율
 */
export function update(state) {
  // 보스 인트로 플립 대기
  if (state.mode === MODE.BOSS_INTRO) {
    if (state.flipTimer > 0) state.flipTimer--;
    if (state.flipTimer <= 0) setMode(state, MODE.BOSS);
    return;
  }

  if (state.input.spacePressed) {
    if (state.mode === MODE.PLAYING && !state.attached) {
      setMode(state, MODE.PAUSED);
      return;
    }
    if (state.mode === MODE.PAUSED) {
      setMode(state, MODE.PLAYING);
      return;
    }
  }

  if (state.mode !== MODE.PLAYING) return;

  const { paddle, balls, bricks, input } = state;
  if (!paddle) return;

  const sm = state.speedMul;

  // 타이머
  if (state.wideTimer > 0) {
    state.wideTimer--;
    if (state.wideTimer === 0) paddle.w = paddle.baseW || PADDLE.width;
  }
  if (state.slowTimer > 0) state.slowTimer--;
  if (state.laserTimer > 0) state.laserTimer--;
  if (state.laserCooldown > 0) state.laserCooldown--;

  updatePaddle(paddle, input, sm);

  // 발사 / 레이저
  if (state.attached && balls[0]) {
    stickBallToPaddle(balls[0], paddle);
    if (input.launchPressed || input.spacePressed) {
      launchBall(balls[0], ballSpeed(state));
      state.attached = false;
      SFX.launch();
    }
  } else if (
    !state.attached &&
    state.laserTimer > 0 &&
    state.laserCooldown <= 0 &&
    (input.firePressed || input.launchPressed)
  ) {
    fireLasers(paddle, state.lasers, sm);
    state.laserCooldown = 10;
    SFX.laser();
  }

  // 보스 이동
  if (state.isBossStage) {
    const boss = bricks.find((b) => b.isBoss && b.alive);
    if (boss) {
      const dir = boss.vx >= 0 ? 1 : -1;
      boss.x += dir * 2.2 * sm;
      if (boss.x < 20 || boss.x + boss.w > 880) boss.vx *= -1;
      boss.y = 80 + Math.sin(performance.now() * 0.004) * 18;
    }
  }

  // 레이저
  updateLasers(state.lasers, bricks, (brick) => {
    handleBrickDamage(state, brick, true);
  });
  if (state.mode !== MODE.PLAYING) {
    updateParticles(state.particles);
    return;
  }

  // 멀티볼
  if (!state.attached) {
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      moveBall(ball);

      // 속도 배율이 이미 속도에 반영되어 있으므로 이동은 vx/vy 그대로
      // (속도 변경 시 rescale 함)

      if (collideBallWithPaddle(ball, paddle)) {
        const spd = ballSpeed(state);
        const mag = Math.hypot(ball.vx, ball.vy) || spd;
        ball.vx = (ball.vx / mag) * spd;
        ball.vy = (ball.vy / mag) * spd;
        state.combo = 0;
        SFX.bounce();
      }

      const hitBrick = collideBallWithBricks(ball, bricks);
      if (hitBrick) {
        handleBrickDamage(state, hitBrick, false);
        if (state.mode !== MODE.PLAYING) break;
      }

      if (collideBallWithWalls(ball)) {
        balls.splice(i, 1);
      }
    }

    if (balls.length === 0) {
      state.lives -= 1;
      state.combo = 0;
      SFX.lose();
      if (state.lives <= 0) {
        setMode(state, MODE.OVER);
        return;
      }
      balls.push(createBallOnPaddle(paddle));
      state.attached = true;
      paddle.w = paddle.baseW || PADDLE.width;
      state.wideTimer = 0;
    }
  }

  updatePowerups(state, SFX);
  updateParticles(state.particles);

  // 클리어 판정
  if (state.mode === MODE.PLAYING && allBricksCleared(bricks)) {
    SFX.clear();
    if (state.isBossStage) {
      state.isBossStage = false;
      state.score += 200;
      const stage = document.getElementById("stage");
      if (stage) stage.classList.remove("boss-mode");
      if (state.returnLevel >= GAME.maxLevel) {
        setMode(state, MODE.WIN);
      } else {
        state.level = state.returnLevel;
        state.levelClearMsg = `보스 처치! 레벨 ${state.level + 1} 로 · 점수 ${state.score}`;
        setMode(state, MODE.LEVEL_CLEAR);
      }
    } else if (state.level >= GAME.maxLevel) {
      setMode(state, MODE.WIN);
    } else {
      state.levelClearMsg = `레벨 ${state.level} 클리어! 점수 ${state.score}`;
      setMode(state, MODE.LEVEL_CLEAR);
    }
  }
}
