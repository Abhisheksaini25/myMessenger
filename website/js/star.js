'use strict';
// Port of opus/OpusParticleEngine.kt — Star, Sparkle and Smoke engines.
// deltaMs is in milliseconds; positions/sizes are CSS px scaled by global SCALE.

class StarEngine {
  constructor() {
    this.stars = Array.from({ length: C.STAR_COUNT }, () => ({}));
    this.width = 0;
    this.height = 0;
    this.timeMs = 0;
  }

  init(width, height) {
    this.width = width;
    this.height = height;
    for (const star of this.stars) {
      star.x = Math.random() * width;
      star.y = Math.random() * height;
      star.baseRadius = (Math.random() * 3 + 1) * SCALE;
      star.baseAlpha = Math.random() * 0.5 + 0.3;
      star.twinkleSpeed = Math.random() * 0.005 + 0.001;
      star.twinklePhase = Math.random() * Math.PI * 2;
      star.driftX = (Math.random() - 0.5) * 0.1;
      star.driftY = (Math.random() - 0.5) * 0.1;
      star.alpha = star.baseAlpha;
      star.currentRadius = star.baseRadius;
    }
  }

  update(deltaMs) {
    this.timeMs += deltaMs;
    const t = this.timeMs;
    for (const star of this.stars) {
      star.x += star.driftX * deltaMs;
      star.y += star.driftY * deltaMs;
      if (star.x < 0) star.x += this.width;
      if (star.x > this.width) star.x -= this.width;
      if (star.y < 0) star.y += this.height;
      if (star.y > this.height) star.y -= this.height;

      const twinkle = (Math.sin(star.twinklePhase + t * star.twinkleSpeed) + 1) / 2;
      star.alpha = Math.min(1, star.baseAlpha + twinkle * 0.5);
      star.currentRadius = star.baseRadius + twinkle * star.baseRadius * 0.5;
    }
  }

  draw(ctx, palette) {
    for (const star of this.stars) {
      ctx.globalAlpha = clamp(star.alpha * 0.4, 0, 1);
      ctx.fillStyle = css(palette.glowColor);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.currentRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = clamp(star.alpha, 0, 1);
      ctx.fillStyle = '#fafafa'; // palette.textColor
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.currentRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

class SparkleEngine {
  constructor() {
    this.sparkles = Array.from({ length: 50 }, () => ({ active: false }));
  }

  spawnBurst(x, y, count, palette) {
    let spawned = 0;
    for (const sp of this.sparkles) {
      if (sp.active) continue;
      const angle = Math.random() * 2 * Math.PI;
      const speed = (Math.random() * 0.5 + 0.1) * SCALE;
      sp.x = x; sp.y = y;
      sp.vx = Math.cos(angle) * speed;
      sp.vy = Math.sin(angle) * speed;
      sp.size = (Math.random() * 4 + 2) * SCALE;
      sp.maxLifetime = randInt(500, 1500);
      sp.lifetime = sp.maxLifetime;
      sp.active = true;
      if (++spawned >= count) break;
    }
  }

  update(deltaMs) {
    for (const sp of this.sparkles) {
      if (!sp.active) continue;
      sp.x += sp.vx * deltaMs;
      sp.y += sp.vy * deltaMs;
      sp.lifetime -= deltaMs;
      if (sp.lifetime <= 0) sp.active = false;
      else sp.alpha = sp.lifetime / sp.maxLifetime;
    }
  }

  draw(ctx, palette) {
    for (const sp of this.sparkles) {
      if (!sp.active) continue;
      ctx.globalAlpha = clamp(sp.alpha, 0, 1);
      ctx.fillStyle = css(palette.sparkleColor);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

class SmokeEngine {
  constructor() {
    this.particles = Array.from({ length: C.SMOKE_PARTICLE_COUNT }, () => ({ active: false }));
    this.timeMs = 0;
  }

  emit(x, y, count) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.x = x; p.y = y;
      p.vx = (Math.random() - 0.5) * 0.05 * SCALE;
      p.vy = -(Math.random() * 0.1 + 0.05) * SCALE; // rises upwards
      p.size = (Math.random() * 30 + 20) * SCALE;
      p.baseAlpha = Math.random() * 0.3 + 0.5;
      p.maxLifetime = C.SMOKE_LIFETIME_MS;
      p.lifetime = p.maxLifetime;
      p.seed = Math.random() * 1000;
      p.active = true;
      if (++spawned >= count) break;
    }
  }

  update(deltaMs) {
    this.timeMs += deltaMs;
    for (const p of this.particles) {
      if (!p.active) continue;
      const wobble = Math.sin(this.timeMs * 0.005 + p.seed) * 0.02 * SCALE;
      p.x += (p.vx + wobble) * deltaMs;
      p.y += p.vy * deltaMs;
      p.size += deltaMs * 0.05 * SCALE; // expands
      p.lifetime -= deltaMs;
      if (p.lifetime <= 0) p.active = false;
      else p.alpha = p.baseAlpha * Math.pow(p.lifetime / p.maxLifetime, 1.5);
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = clamp(p.alpha, 0, 1);
      ctx.fillStyle = 'rgba(170,170,170,1)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
