'use strict';
// Port of opus/OpusBalloonEngine.kt — floating balloons with sway, 3D-ish
// shading, tap-to-pop with particles, and continuous recycling.

class BalloonEngine {
  constructor() {
    this.balloons = Array.from({ length: C.BALLOON_COUNT + 10 }, () => ({ active: false }));
    this.popParticles = Array.from({ length: 60 }, () => ({ active: false }));
    this.popCount = 0;
    this.nextId = 1;
    this.isInitialized = false;
  }

  init(screenWidth, screenHeight, palette) {
    if (this.isInitialized) return;
    this.isInitialized = true;
    for (let i = 0; i < C.BALLOON_COUNT; i++) {
      const balloon = this.balloons[i];
      this.resetBalloon(balloon, screenWidth, screenHeight, palette);
      // Spread them vertically for the initial state
      balloon.y = screenHeight * 0.2 + Math.random() * (screenHeight * 0.8);
      balloon.active = true;
    }
  }

  spawnBalloon(screenWidth, screenHeight, palette) {
    const balloon = this.balloons.find((b) => !b.active);
    if (!balloon) return;
    this.resetBalloon(balloon, screenWidth, screenHeight, palette);
    balloon.y = screenHeight + balloon.radius * 2;
    balloon.active = true;
  }

  resetBalloon(balloon, screenWidth, screenHeight, palette) {
    balloon.id = this.nextId++;
    balloon.radius = (C.BALLOON_MIN_RADIUS + Math.random() * (C.BALLOON_MAX_RADIUS - C.BALLOON_MIN_RADIUS)) * SCALE;
    balloon.x = balloon.radius + Math.random() * Math.max(1, screenWidth - balloon.radius * 2);
    const speed = C.BALLOON_MIN_SPEED + Math.random() * (C.BALLOON_MAX_SPEED - C.BALLOON_MIN_SPEED);
    balloon.velocityY = -speed; // px per frame @60fps
    balloon.horizontalPhase = Math.random() * Math.PI * 2;
    balloon.horizontalSpeed = 0.5 + Math.random() * 1.5;
    balloon.horizontalAmplitude = C.BALLOON_SWAY_AMPLITUDE * SCALE * (0.5 + Math.random() * 0.5);

    const colors = palette.balloonColors;
    balloon.color = colors.length ? colors[randInt(0, colors.length - 1)] : [255, 0, 0];
    balloon.scale = 1;
    balloon.alpha = 1;
    balloon.rotation = Math.random() * 20 - 10;
    balloon.rotationSpeed = Math.random() * 2 - 1;
    balloon.popping = false;
    balloon.popTimer = 0;
    balloon.popParticlesSpawned = false;
  }

  update(deltaMs, screenWidth, screenHeight, palette) {
    const dt = deltaMs / 1000;

    for (const balloon of this.balloons) {
      if (!balloon.active) continue;

      if (balloon.popping) {
        balloon.popTimer += dt;
        if (!balloon.popParticlesSpawned) {
          this.spawnPopParticles(balloon);
          balloon.popParticlesSpawned = true;
        }
        const popProgress = balloon.popTimer / 0.2;
        if (popProgress >= 1) {
          balloon.active = false;
          this.spawnBalloon(screenWidth, screenHeight, palette);
        } else {
          balloon.scale = 1 + popProgress * 0.5;
          balloon.alpha = 1 - popProgress;
        }
      } else {
        balloon.y += balloon.velocityY * dt * 60;
        balloon.horizontalPhase += balloon.horizontalSpeed * dt;
        balloon.rotation += balloon.rotationSpeed * dt * 10;

        if (balloon.y < -balloon.radius * 3) {
          balloon.active = false;
          this.spawnBalloon(screenWidth, screenHeight, palette);
        }
      }
    }

    for (const particle of this.popParticles) {
      if (!particle.active) continue;
      particle.lifetime += dt;
      if (particle.lifetime >= particle.maxLifetime) {
        particle.active = false;
      } else {
        particle.x += particle.vx * dt * 60;
        particle.y += particle.vy * dt * 60;
        particle.vy += 0.5 * dt * 60; // gravity effect
        const progress = particle.lifetime / particle.maxLifetime;
        particle.alpha = 1 - progress;
        particle.size = 4 * SCALE * (1 - progress * 0.5);
      }
    }
  }

  handleTap(tapX, tapY) {
    for (const balloon of this.balloons) {
      if (balloon.active && !balloon.popping) {
        const swayX = balloon.horizontalAmplitude * Math.sin(balloon.horizontalPhase);
        const actualX = balloon.x + swayX;
        const dx = tapX - actualX;
        const dy = tapY - balloon.y;
        const r = balloon.radius * balloon.scale;
        if (dx * dx + dy * dy <= r * r) {
          this.pop(balloon);
          return true;
        }
      }
    }
    return false;
  }

  pop(balloon) {
    balloon.popping = true;
    balloon.popTimer = 0;
    this.popCount++;
  }

  spawnPopParticles(balloon) {
    const swayX = balloon.horizontalAmplitude * Math.sin(balloon.horizontalPhase);
    const actualX = balloon.x + swayX;

    let spawned = 0;
    const count = 8 + randInt(0, 4);
    for (const particle of this.popParticles) {
      if (particle.active) continue;
      particle.active = true;
      particle.x = actualX;
      particle.y = balloon.y;

      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 5) * SCALE;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;

      particle.color = balloon.color;
      particle.lifetime = 0;
      particle.maxLifetime = 0.3 + Math.random() * 0.3;
      particle.alpha = 1;
      particle.size = (3 + Math.random() * 3) * SCALE;

      if (++spawned >= count) break;
    }
  }

  draw(ctx) {
    for (const balloon of this.balloons) {
      if (!balloon.active) continue;

      const swayX = balloon.horizontalAmplitude * Math.sin(balloon.horizontalPhase);
      const bx = balloon.x + swayX;
      const by = balloon.y;
      const r = balloon.radius * balloon.scale;

      if (balloon.alpha > 0) {
        // String
        ctx.strokeStyle = `rgba(255,255,255,${0.6 * balloon.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by + r * 0.9);
        ctx.lineTo(bx + Math.sin(balloon.horizontalPhase * 1.5) * r * 0.3, by + r * 2.5);
        ctx.stroke();

        // Shadow
        ctx.fillStyle = `rgba(0,0,0,${0.1 * balloon.alpha})`;
        ctx.beginPath();
        ctx.arc(bx + r * 0.15, by + r * 0.15, r, 0, Math.PI * 2);
        ctx.fill();

        // Main body with 3D gradient
        const d = 0.6;
        const darkColor = [
          Math.round(balloon.color[0] * d),
          Math.round(balloon.color[1] * d),
          Math.round(balloon.color[2] * d),
        ];
        const hx = bx - r * 0.25, hy = by - r * 0.25;
        const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, r + 0.1);
        grad.addColorStop(0, `rgba(255,255,255,${0.6 * balloon.alpha})`);
        grad.addColorStop(0.55, css(balloon.color, balloon.alpha));
        grad.addColorStop(1, css(darkColor, balloon.alpha));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();

        // Specular highlight
        ctx.fillStyle = `rgba(255,255,255,${0.4 * balloon.alpha})`;
        ctx.beginPath();
        ctx.arc(bx - r * 0.3, by - r * 0.35, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const particle of this.popParticles) {
      if (!particle.active || particle.alpha <= 0) continue;
      ctx.globalAlpha = clamp(particle.alpha, 0, 1);
      ctx.fillStyle = css(particle.color);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
