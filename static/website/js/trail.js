'use strict';
// Port of opus/OpusGestureTrailEngine.kt + opus/OpusPatternRecognitionEngine.kt

class TrailPoint { constructor() { this.active = false; } }

class GestureTrailEngine {
  constructor() {
    this.maxPoints = 200;
    this.points = Array.from({ length: this.maxPoints }, () => new TrailPoint());
    this.headIndex = 0;
    this.isDrawing = false;
    this.lastCompletedGesture = null;
    this.currentGesture = [];
  }

  onTouchDown(x, y) {
    this.isDrawing = true;
    this.currentGesture = [];
    this.addPoint(x, y);
  }

  onTouchMove(x, y) {
    if (this.isDrawing) this.addPoint(x, y);
  }

  onTouchUp() {
    this.isDrawing = false;
    if (this.currentGesture.length > 0) {
      this.lastCompletedGesture = this.currentGesture.slice();
    }
  }

  addPoint(x, y) {
    this.headIndex = (this.headIndex + 1) % this.maxPoints;
    const point = this.points[this.headIndex];
    point.x = x;
    point.y = y;
    point.timestamp = performance.now();
    point.active = true;
    this.currentGesture.push([x, y]);
  }

  getCompletedGesture() {
    const gesture = this.lastCompletedGesture;
    this.lastCompletedGesture = null;
    return gesture;
  }

  update(currentTimeMs) {
    for (const point of this.points) {
      if (point.active && currentTimeMs - point.timestamp > C.GESTURE_TRAIL_LIFETIME_MS) {
        point.active = false;
      }
    }
  }

  draw(ctx, palette) {
    const currentTimeMs = performance.now();
    let prevPoint = null;

    for (let i = 1; i <= this.maxPoints; i++) {
      const idx = (this.headIndex + i) % this.maxPoints;
      const point = this.points[idx];

      if (point.active) {
        if (prevPoint && prevPoint.active) {
          const age = currentTimeMs - point.timestamp;
          const ageFactor = clamp(1 - age / C.GESTURE_TRAIL_LIFETIME_MS, 0, 1);

          if (ageFactor > 0) {
            // Outer glow
            ctx.strokeStyle = css(palette.trailGlowColor, ageFactor * 0.5);
            ctx.lineWidth = C.TRAIL_GLOW_WIDTH * SCALE * ageFactor;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(prevPoint.x, prevPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();

            // Bright core
            ctx.strokeStyle = css(palette.trailColor, ageFactor);
            ctx.lineWidth = C.TRAIL_WIDTH * SCALE * ageFactor;
            ctx.beginPath();
            ctx.moveTo(prevPoint.x, prevPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();

            // Small glowing sparkle dot
            ctx.fillStyle = css(palette.trailColor, ageFactor * 0.8);
            ctx.beginPath();
            ctx.arc(point.x, point.y, (C.TRAIL_WIDTH / 2) * SCALE * ageFactor, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        prevPoint = point;
      } else {
        prevPoint = null;
      }
    }
  }
}

// ── Pattern recognition ("draw an A" gesture) ──────────────────────────────

const StrokeDirection = {
  UP_LEFT: 0, UP_RIGHT: 1, DOWN_LEFT: 2, DOWN_RIGHT: 3,
  LEFT: 4, RIGHT: 5, UP: 6, DOWN: 7,
};

const PatternRecognitionEngine = {
  recognizeA(points) {
    if (points.length < C.A_GESTURE_MIN_POINTS) return 0;

    const bounds = this.boundingBox(points);
    const minSize = C.A_GESTURE_MIN_SIZE_PX * SCALE;
    if (bounds.width < minSize && bounds.height < minSize) return 0;

    const normalized = this.normalizePoints(points, bounds);
    const resampled = this.resamplePoints(normalized, 32);
    if (resampled.length < 5) return 0;

    // Find apex (topmost point)
    let apexIdx = 0;
    let minY = Infinity;
    for (let i = 0; i < resampled.length; i++) {
      if (resampled[i][1] < minY) { minY = resampled[i][1]; apexIdx = i; }
    }
    const apex = resampled[apexIdx];

    // Apex should be roughly centered horizontally and near the top
    const apexHorizScore = 1 - clamp(Math.abs(apex[0] - 0.5) * 2, 0, 1);
    const apexVertScore = 1 - clamp(apex[1] * 2, 0, 1);
    const apexScore = (apexHorizScore + apexVertScore) / 2;

    // Start and end should be near the bottom
    const startBottomScore = resampled[0][1] > 0.5 ? 1 : 0;
    const endBottomScore = resampled[resampled.length - 1][1] > 0.5 ? 1 : 0;
    const bottomScore = (startBottomScore + endBottomScore) / 2;

    // Must have both up and down strokes
    const directions = this.analyzeDirections(resampled);
    let hasUpStroke = false, hasDownStroke = false;
    for (const dir of directions) {
      if (dir === StrokeDirection.UP_LEFT || dir === StrokeDirection.UP_RIGHT) hasUpStroke = true;
      if (dir === StrokeDirection.DOWN_LEFT || dir === StrokeDirection.DOWN_RIGHT) hasDownStroke = true;
    }
    const strokeScore = hasUpStroke && hasDownStroke ? 1 : 0.5;

    // Crossbar detection
    const crossbarScore = this.hasHorizontalCrossbar(resampled) ? 1 : 0;

    // Aspect ratio: taller than wide, roughly 0.5 to 2.5
    const aspectRatio = bounds.height / Math.max(bounds.width, 0.001);
    const aspectScore = aspectRatio >= 0.5 && aspectRatio <= 2.5 ? 1 : 0.5;

    const confidence = (apexScore * 1.5 + bottomScore + strokeScore * 1.5 + crossbarScore * 2 + aspectScore) / 7;

    return confidence >= C.A_GESTURE_CONFIDENCE_THRESHOLD ? confidence : 0;
  },

  boundingBox(points) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const [x, y] of points) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  },

  normalizePoints(points, bounds) {
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    return points.map(([x, y]) => [(x - bounds.left) / width, (y - bounds.top) / height]);
  },

  pathLength(points) {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    }
    return len;
  },

  resamplePoints(points, count) {
    const I = this.pathLength(points) / (count - 1);
    let D = 0;
    const resampled = [points[0]];
    const current = points.slice();
    let i = 1;

    while (i < current.length) {
      const p1 = current[i - 1], p2 = current[i];
      const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      if (d === 0) { i++; continue; }

      if (D + d >= I) {
        const qx = p1[0] + ((I - D) / d) * (p2[0] - p1[0]);
        const qy = p1[1] + ((I - D) / d) * (p2[1] - p1[1]);
        resampled.push([qx, qy]);
        current.splice(i, 0, [qx, qy]);
        D = 0;
      } else {
        D += d;
      }
      i++;
    }

    if (resampled.length < count) resampled.push(points[points.length - 1]);
    return resampled;
  },

  analyzeDirections(points) {
    const directions = [];
    const segmentLength = 3;
    for (let i = 0; i < points.length - segmentLength; i += segmentLength) {
      const p1 = points[i];
      const p2 = points[Math.min(i + segmentLength, points.length - 1)];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1]; // positive dy is DOWN
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      let dir;
      if (angle >= -22.5 && angle <= 22.5) dir = StrokeDirection.RIGHT;
      else if (angle > 22.5 && angle < 67.5) dir = StrokeDirection.DOWN_RIGHT;
      else if (angle >= 67.5 && angle <= 112.5) dir = StrokeDirection.DOWN;
      else if (angle > 112.5 && angle < 157.5) dir = StrokeDirection.DOWN_LEFT;
      else if (angle <= -157.5 || angle >= 157.5) dir = StrokeDirection.LEFT;
      else if (angle >= -157.5 && angle < -112.5) dir = StrokeDirection.UP_LEFT;
      else if (angle >= -112.5 && angle < -67.5) dir = StrokeDirection.UP;
      else if (angle >= -67.5 && angle < -22.5) dir = StrokeDirection.UP_RIGHT;
      else dir = StrokeDirection.RIGHT;
      directions.push(dir);
    }
    return directions;
  },

  hasHorizontalCrossbar(points) {
    // Horizontal segments in the middle Y region (0.3 to 0.7)
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1], p2 = points[i];
      const yMid = (p1[1] + p2[1]) / 2;
      if (yMid >= 0.3 && yMid <= 0.7) {
        const dx = Math.abs(p2[0] - p1[0]);
        const dy = Math.abs(p2[1] - p1[1]);
        if (dx > dy * 2 && dx > 0.15) return true;
      }
    }
    // Non-adjacent points forming a horizontal line across the shape
    for (let i = 0; i < points.length - 5; i++) {
      for (let j = i + 5; j < points.length; j++) {
        const p1 = points[i], p2 = points[j];
        const yAvg = (p1[1] + p2[1]) / 2;
        const yDiff = Math.abs(p2[1] - p1[1]);
        const xDiff = Math.abs(p2[0] - p1[0]);
        if (yAvg >= 0.3 && yAvg <= 0.7 && yDiff < 0.1 && xDiff > 0.2) return true;
      }
    }
    return false;
  },
};
