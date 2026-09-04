'use strict';
// Port of opus/OpusFireworkEngine.kt — rockets rise from the bottom and
// explode into particle bursts. Pool of 12 simultaneous fireworks.

class FireworkEngine {
  constructor() {
    this.poolSize = 12;
    this.fireworks = Array.from({ length: this.poolSize }, () => ({
      active: false,
      particles: Array.from({ length: C.MAX_FIREWORK_PARTICLES }, () => ({ active: false })),
      activeParticleCount: 0,
    }));
  }

  launch(screenWidth, screenHeight, palette, x = -1) {
    const fw = this.fireworks.find((f) => !f.active);
    if (!fw) return;

    fw.x = x < 0 ? Math.random() * screenWidth : x;
    fw.y = screenHeight + 20;

    const targetMin = screenHeight * 0.15;
    const targetMax = screenHeight * 0.45;
    fw.targetY = targetMin + Math.random() * (targetMax - targetMin);

    fw.velocityY = -(screenHeight * 0.8 + Math.random() * screenHeight * 0.4);

    const colors = palette.fireworkColors;
    fw.color = colors.length ? colors[randInt(0, colors.length - 1)] : WHITE;

    fw.phase = 'RISING';
    fw.active = true;
    fw.activeParticleCount = 0;
  }

  launchMultiple(count, screenWidth, screenHeight, palette) {
    const activeCount = this.fireworks.filter((f) => f.active).length;
    const actual = Math.min(count, this.poolSize - activeCount);
    for (let i = 0; i < actual; i++) this.launch(screenWidth, screenHeight, palette);
  }

  update(deltaMs) {
    const dt = deltaMs / 1000;
    const dragStep = Math.pow(0.98, (deltaMs / 1000) * 60);

    for (const fw of this.fireworks) {
      if (!fw.active) continue;

      if (fw.phase === 'RISING') {
        fw.y += fw.velocityY * dt;
        fw.velocityY += 150 * dt; // gravity pulling on the rocket
        if (fw.y <= fw.targetY || fw.velocityY >= 0) this.explode(fw);
      } else if (fw.phase === 'FADING') {
        let anyActive = false;
        for (let i = 0; i < fw.activeParticleCount; i++) {
          const p = fw.particles[i];
          if (!p.active) continue;

          p.lifetime += deltaMs;
          if (p.lifetime >= p.maxLifetime) { p.active = false; continue; }
          anyActive = true;

          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += p.gravity * dt;
          p.vx *= dragStep;
          p.vy *= dragStep;

          p.alpha = 1 - p.lifetime / p.maxLifetime;
        }
        if (!anyActive) fw.active = false;
      }
    }
  }

  explode(fw) {
    fw.phase = 'FADING';
    const numParticles = C.MAX_FIREWORK_PARTICLES;
    fw.activeParticleCount = numParticles;

    for (let i = 0; i < numParticles; i++) {
      const p = fw.particles[i];
      p.active = true;
      p.x = fw.x;
      p.y = fw.y;

      const angle = Math.random() * 2 * Math.PI;
      const velocityMag = (50 + Math.random() * 150) * SCALE;

      p.vx = Math.cos(angle) * velocityMag;
      p.vy = Math.sin(angle) * velocityMag;

      p.alpha = 1;
      p.size = (2 + Math.random() * 2) * SCALE;
      p.color = fw.color;

      p.lifetime = 0;
      p.maxLifetime = 800 + Math.random() * 700;

      p.gravity = 80 * SCALE;
    }
  }

  draw(ctx) {
    for (const fw of this.fireworks) {
      if (!fw.active) continue;

      if (fw.phase === 'RISING') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = css(fw.color, 1);
        ctx.beginPath(); ctx.arc(fw.x, fw.y, 4 * SCALE, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = css(fw.color, 0.6);
        ctx.beginPath(); ctx.arc(fw.x, fw.y + 10, 3 * SCALE, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = css(fw.color, 0.3);
        ctx.beginPath(); ctx.arc(fw.x, fw.y + 20, 2 * SCALE, 0, Math.PI * 2); ctx.fill();
      } else if (fw.phase === 'FADING') {
        for (let i = 0; i < fw.activeParticleCount; i++) {
          const p = fw.particles[i];
          if (!p.active) continue;
          ctx.globalAlpha = clamp(p.alpha, 0, 1);
          ctx.fillStyle = css(p.color);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
