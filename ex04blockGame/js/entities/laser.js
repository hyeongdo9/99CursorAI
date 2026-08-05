export function createLaserShot(x, y, speedMul = 1) {
  return {
    x,
    y,
    w: 3,
    h: 16,
    vy: -14 * speedMul,
  };
}

export function fireLasers(paddle, lasers, speedMul) {
  lasers.push(
    createLaserShot(paddle.x + 12, paddle.y, speedMul),
    createLaserShot(paddle.x + paddle.w - 15, paddle.y, speedMul)
  );
}

export function updateLasers(lasers, bricks, onHit) {
  for (let i = lasers.length - 1; i >= 0; i--) {
    const L = lasers[i];
    L.y += L.vy;
    let hit = false;
    for (const brick of bricks) {
      if (!brick.alive) continue;
      if (
        L.x < brick.x + brick.w &&
        L.x + L.w > brick.x &&
        L.y < brick.y + brick.h &&
        L.y + L.h > brick.y
      ) {
        onHit(brick);
        hit = true;
        break;
      }
    }
    if (hit || L.y + L.h < 0) lasers.splice(i, 1);
  }
}
