'use strict';
// Port of opus/OpusConfettiEngine.kt — rectangles, strips and circles that
// launch upwards, sway and fall with rotation.

class ConfettiEngine {
  constructor() {
    this.pool = Array.from({ length: 180 }, () => ({ active: false }));
  }

  burst(x, y, count, palette, spreadX = 200, spreadY = 100) {
    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= count) break;
      if (!p.active) {
        this.activateParticle(p, x, y, palette, spreadX * SCALE, spreadY * SCALE);
        spawned++;
      }
    }
  }

  burstFromTop(screenWidth, count, palette) {
    let spawned = 0;
    for (const p of this.pool) {
      if (spawned >= count) break;
      if (!p.active) {
        const startX = Math.random() * screenWidth;
        const startY = -50 - Math.random() * 100;
        this.activateParticle(p, startX, startY, palette, 0, 0);
        p.vy = (Math.random() * 200 + 100) * SCALE;
        p.vx = (Math.random() - 0.5) * 150 * SCALE;
        spawned++;
      }
    }
  }

  heavyBurst(screenWidth, screenHeight, palette) {
    const numBursts = 3;
    const particlesPerBurst = Math.floor(randInt(40, 60) / numBursts); // int division like Kotlin
    for (let i = 0; i < numBursts; i++) {
      const startX = screenWidth * (i + 1) / (numBursts + 1);
      const startY = screenHeight * 0.4 + Math.random() * screenHeight * 0.2;
      this.burst(startX, startY, particlesPerBurst, palette);
    }
  }

  activateParticle(p, centerX, centerY, palette, spreadX, spreadY) {
    p.active = true;
    p.x = centerX + (Math.random() - 0.5) * spreadX;
    p.y = centerY + (Math.random() - 0.5) * spreadY;

    p.vx = (Math.random() - 0.5) * 400 * SCALE;
    p.vy = -(Math.random() * 400 + 200) * SCALE; // upward initial velocity

    p.gravity = (150 + Math.random() * 200) * SCALE;

    p.rotation = Math.random() * 360;
    p.rotationSpeed = (Math.random() - 0.5) * 360;

    p.size = (4 + Math.random() * 6) * SCALE;
    p.shape = randInt(0, 2); // 0 RECTANGLE, 1 STRIP, 2 CIRCLE

    if (p.shape === 0) { p.w = p.size * 1.5; p.h = p.size * 1.5; }
    else if (p.shape === 1) { p.w = p.size * 0.8; p.h = p.size * 2.5; }
    else { p.w = p.size; p.h = p.size; }

    const colors = palette.confettiColors;
    p.color = colors.length ? colors[randInt(0, colors.length - 1)] : WHITE;

    p.alpha = 1;
    p.lifetime = 0;
    p.maxLifetime = 2 + Math.random() * 2; // seconds

    p.swayPhase = Math.random() * Math.PI * 2;
    p.swaySpeed = 1 + Math.random() * 3;
    p.swayAmplitude = (50 + Math.random() * 100) * SCALE;
  }

  update(deltaMs, screenHeight = 3000) {
    const dt = deltaMs / 1000;
    for (const p of this.pool) {
      if (!p.active) continue;

      p.vy += p.gravity * dt;
      p.vx += Math.sin(p.swayPhase) * p.swayAmplitude * dt;
      p.swayPhase += p.swaySpeed * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.rotation += p.rotationSpeed * dt;
      p.lifetime += dt;

      const fadeThreshold = p.maxLifetime * 0.7;
      if (p.lifetime > fadeThreshold) {
        const fadeProgress = (p.lifetime - fadeThreshold) / (p.maxLifetime - fadeThreshold);
        p.alpha = 1 - fadeProgress;
      }

      if (p.lifetime >= p.maxLifetime || p.y > screenHeight + 50 || p.alpha <= 0) {
        p.active = false;
      }
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = clamp(p.alpha, 0, 1);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = css(p.color);
      if (p.shape === 2) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
  }
}
