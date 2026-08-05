import { CANVAS_WIDTH, CANVAS_HEIGHT, MODE } from "../core/constants.js";

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = hex.replace("#", "");
  const num = parseInt(n, 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function drawBackground(ctx, isBoss) {
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  if (isBoss) {
    grad.addColorStop(0, "#2a0510");
    grad.addColorStop(0.5, "#1a0218");
    grad.addColorStop(1, "#0a0108");
  } else {
    grad.addColorStop(0, "#1a0a2e");
    grad.addColorStop(0.5, "#12061f");
    grad.addColorStop(1, "#05010d");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = isBoss ? "rgba(255,0,64,0.5)" : "rgba(0, 240, 255, 0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, CANVAS_WIDTH - 16, CANVAS_HEIGHT - 16);
}

function drawBrickPattern(ctx, brick) {
  const { x, y, w, h, pattern } = brick;
  ctx.save();
  roundRect(ctx, x, y, w, h, brick.isBoss ? 10 : 4);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;

  if (pattern === "stripe") {
    for (let i = -h; i < w + h; i += 7) {
      ctx.beginPath();
      ctx.moveTo(x + i, y);
      ctx.lineTo(x + i + h, y + h);
      ctx.stroke();
    }
  } else if (pattern === "diamond") {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 3);
    ctx.lineTo(x + w - 4, y + h / 2);
    ctx.lineTo(x + w / 2, y + h - 3);
    ctx.lineTo(x + 4, y + h / 2);
    ctx.closePath();
    ctx.stroke();
  } else if (pattern === "dots") {
    for (let dy = 6; dy < h; dy += 7) {
      for (let dx = 6; dx < w; dx += 8) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === "chevron") {
    for (let row = 0; row < 3; row++) {
      const yy = y + 5 + row * 6;
      ctx.beginPath();
      ctx.moveTo(x + 4, yy + 4);
      ctx.lineTo(x + w / 2, yy);
      ctx.lineTo(x + w - 4, yy + 4);
      ctx.stroke();
    }
  } else if (pattern === "circuit") {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + h / 2);
    ctx.lineTo(x + w * 0.4, y + h / 2);
    ctx.lineTo(x + w * 0.4, y + 4);
    ctx.lineTo(x + w - 4, y + 4);
    ctx.stroke();
  } else if (pattern === "hex") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rad = Math.min(w, h) * 0.28;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else if (pattern === "wave") {
    ctx.beginPath();
    for (let i = 0; i <= w; i += 2) {
      const py = y + h / 2 + Math.sin(i * 0.35) * (h * 0.22);
      if (i === 0) ctx.moveTo(x + i, py);
      else ctx.lineTo(x + i, py);
    }
    ctx.stroke();
  } else if (pattern === "boss") {
    ctx.fillStyle = "rgba(255,230,0,0.85)";
    ctx.beginPath();
    ctx.arc(x + w * 0.35, y + h * 0.42, 12, 0, Math.PI * 2);
    ctx.arc(x + w * 0.65, y + h * 0.42, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#12001a";
    ctx.beginPath();
    ctx.arc(x + w * 0.35, y + h * 0.42, 5, 0, Math.PI * 2);
    ctx.arc(x + w * 0.65, y + h * 0.42, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,230,0,0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 22);
    ctx.lineTo(x + 55, y + 8);
    ctx.lineTo(x + w / 2, y + 24);
    ctx.lineTo(x + w - 55, y + 8);
    ctx.lineTo(x + w - 30, y + 22);
    ctx.stroke();
    const ratio = Math.max(0, brick.hp / brick.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x + 24, y + h - 22, w - 48, 10);
    ctx.fillStyle = ratio > 0.3 ? "#ff0040" : "#ffe600";
    ctx.fillRect(x + 24, y + h - 22, (w - 48) * ratio, 10);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`BOSS ${brick.hp}/${brick.maxHp}`, x + w / 2, y + h - 36);
  }

  if (brick.itemType && brick.alive) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.font = "bold 10px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label =
      brick.itemType === "wide" ? "W" : brick.itemType === "multi" ? "×3" : "L";
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  ctx.restore();
}

function drawBrick(ctx, brick) {
  if (!brick.alive) return;
  ctx.save();
  ctx.shadowColor = brick.color;
  ctx.shadowBlur = brick.isBoss ? 28 : 14;
  roundRect(ctx, brick.x, brick.y, brick.w, brick.h, brick.isBoss ? 10 : 4);
  const g = ctx.createLinearGradient(
    brick.x,
    brick.y,
    brick.x + brick.w,
    brick.y + brick.h
  );
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.3, brick.color);
  g.addColorStop(1, shade(brick.color, -40));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  drawBrickPattern(ctx, brick);

  if (brick.maxHp > 1 && !brick.isBoss) {
    ctx.fillStyle = "rgba(20,0,40,0.45)";
    ctx.font = "bold 11px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(brick.hp), brick.x + brick.w / 2, brick.y + brick.h / 2 + 1);
  }
  ctx.restore();
}

function drawPaddle(ctx, paddle, laserOn) {
  ctx.save();
  ctx.shadowColor = laserOn ? "#ff0040" : "#00f0ff";
  ctx.shadowBlur = 16;
  roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, 7);
  const g = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y);
  if (laserOn) {
    g.addColorStop(0, "#ff0040");
    g.addColorStop(0.5, "#ff2bd6");
    g.addColorStop(1, "#ff0040");
  } else {
    g.addColorStop(0, "#1ab8c4");
    g.addColorStop(0.5, "#00f0ff");
    g.addColorStop(1, "#1ab8c4");
  }
  ctx.fillStyle = g;
  ctx.fill();
  if (laserOn) {
    ctx.fillStyle = "#ffe600";
    ctx.fillRect(paddle.x + 8, paddle.y - 6, 6, 6);
    ctx.fillRect(paddle.x + paddle.w - 14, paddle.y - 6, 6, 6);
  }
  ctx.restore();
}

function drawBall(ctx, ball) {
  ball.trail.forEach((t, i) => {
    ctx.globalAlpha = ((i + 1) / ball.trail.length) * 0.35;
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.arc(t.x, t.y, ball.r * (0.4 + (i / ball.trail.length) * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.shadowColor = "#ff2bd6";
  ctx.shadowBlur = 14;
  const g = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.r);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.45, "#00f0ff");
  g.addColorStop(1, "#ff2bd6");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function render(ctx, state) {
  ctx.save();
  if (state.mode === MODE.BOSS_INTRO) {
    const t = 70 - state.flipTimer;
    ctx.filter = `hue-rotate(${t * 4}deg) invert(${Math.min(1, t / 40)})`;
  }

  drawBackground(ctx, state.isBossStage);

  state.bricks?.forEach((b) => drawBrick(ctx, b));

  state.powers?.forEach((pw) => {
    ctx.save();
    ctx.shadowColor = pw.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = pw.color;
    ctx.beginPath();
    ctx.arc(pw.x, pw.y, pw.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#041016";
    ctx.font = "bold 10px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pw.label, pw.x, pw.y + 1);
    ctx.restore();
  });

  state.lasers?.forEach((L) => {
    ctx.save();
    ctx.shadowColor = "#ff0040";
    ctx.shadowBlur = 12;
    const lg = ctx.createLinearGradient(L.x, L.y, L.x, L.y + L.h);
    lg.addColorStop(0, "#fff");
    lg.addColorStop(0.4, "#ff0040");
    lg.addColorStop(1, "#ff2bd6");
    ctx.fillStyle = lg;
    ctx.fillRect(L.x, L.y, L.w, L.h);
    ctx.restore();
  });

  if (state.paddle) drawPaddle(ctx, state.paddle, state.laserTimer > 0);
  state.balls?.forEach((ball) => drawBall(ctx, ball));

  state.particles?.forEach((pt) => {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * pt.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (state.mode === MODE.PLAYING && state.attached) {
    ctx.fillStyle = "rgba(244, 234, 255, 0.75)";
    ctx.font = "600 18px Rajdhani, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SPACE 또는 클릭으로 발사", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 80);
  }

  if (state.mode === MODE.PLAYING) {
    let badgeY = CANVAS_HEIGHT - 18;
    ctx.font = "bold 11px Orbitron, sans-serif";
    ctx.textAlign = "left";
    if (state.laserTimer > 0) {
      ctx.fillStyle = "#ff0040";
      ctx.fillText(`LASER ${Math.ceil(state.laserTimer / 60)}s  [Z]`, 16, badgeY);
      badgeY -= 16;
    }
    if (state.wideTimer > 0) {
      ctx.fillStyle = "#00f0ff";
      ctx.fillText(`WIDE ${Math.ceil(state.wideTimer / 60)}s`, 16, badgeY);
      badgeY -= 16;
    }
    if (state.slowTimer > 0) {
      ctx.fillStyle = "#ffe600";
      ctx.fillText(`SLOW ${Math.ceil(state.slowTimer / 60)}s`, 16, badgeY);
    }
    if (state.isBossStage) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#ff0040";
      ctx.font = "bold 14px Orbitron, sans-serif";
      ctx.fillText("★ BONUS BOSS STAGE ★", CANVAS_WIDTH / 2, 36);
    }
  }

  ctx.restore();
}
