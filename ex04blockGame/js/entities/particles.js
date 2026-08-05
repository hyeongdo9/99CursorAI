export function spawnParticles(particles, x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = Math.random() * 4 + 1.5;
    particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 1,
      life: 1,
      decay: Math.random() * 0.03 + 0.02,
      size: Math.random() * 3.5 + 1.5,
      color,
    });
  }
}

export function updateParticles(particles) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.12;
    pt.life -= pt.decay;
    if (pt.life <= 0) particles.splice(i, 1);
  }
}
