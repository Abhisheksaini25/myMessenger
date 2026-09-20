'use strict';
// Port of OpusColorWheelPicker (in opus/OpusBirthdayScreen.kt):
// an HSV wheel — hue by angle, saturation by radius — plus a brightness
// slider and a confirm button whose colors follow the current selection.

class ColorWheelPicker {
  /**
   * @param {HTMLElement} host container element
   * @param {[number,number,number]} initialColor RGB
   * @param {{showConfirm?: boolean, onChanged?: Function, onSelected?: Function}} opts
   */
  constructor(host, initialColor, opts = {}) {
    this.opts = opts;
    const [h, s, v] = rgbToHsv(initialColor);
    this.hsv = [h, s, v];

    host.innerHTML = `
      <div class="wheel-wrap interactive">
        <canvas id="colorWheel"></canvas>
      </div>
      <div class="brightness-label">Brightness</div>
      <input id="brightnessSlider" class="interactive" type="range" min="0" max="1" step="0.01">
      ${opts.showConfirm === false ? '' : '<button id="confirmColorBtn" class="btn interactive">Confirm</button>'}
    `;

    this.canvas = host.querySelector('#colorWheel');
    this.slider = host.querySelector('#brightnessSlider');
    this.confirmBtn = host.querySelector('#confirmColorBtn');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.slider.value = String(v);
    this.renderWheel();
    this.updateThumb();
    this.emitChanged();

    this.slider.addEventListener('input', () => {
      this.hsv[2] = parseFloat(this.slider.value);
      this.renderWheel();
      this.updateThumb();
      this.emitChanged();
    });

    if (this.confirmBtn) {
      this.confirmBtn.addEventListener('click', () => {
        this.opts.onSelected?.(this.currentColor());
      });
    }

    // Pointer handling on the wheel
    let dragging = false;
    const pick = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const cx = rect.width / 2, cy = rect.height / 2;
      const dx = e.clientX - rect.left - cx;
      const dy = e.clientY - rect.top - cy;
      const radius = Math.min(cx, cy);
      const distance = Math.hypot(dx, dy);
      const sat = clamp(distance / radius, 0, 1);
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      this.hsv = [angle, sat, this.hsv[2]];
      this.updateThumb();
      this.emitChanged();
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      pick(e);
    });
    this.canvas.addEventListener('pointermove', (e) => { if (dragging) pick(e); });
    this.canvas.addEventListener('pointerup', () => { dragging = false; });
    this.canvas.addEventListener('pointercancel', () => { dragging = false; });
  }

  currentColor() {
    return hsvToRgb(this.hsv[0], this.hsv[1], this.hsv[2]);
  }

  emitChanged() {
    this.opts.onChanged?.(this.currentColor());
  }

  updateThumb() {
    // Redraw is cheap; includes thumb
    this.renderWheel();
  }

  renderWheel() {
    const size = this.canvas.clientWidth || 260;
    this.canvas.width = size * this.dpr;
    this.canvas.height = size * this.dpr;
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const r = size / 2;

    // 1. Hue layer (sweep gradient)
    if (ctx.createConicGradient) {
      const grad = ctx.createConicGradient(0, r, r);
      const stops = [0, 60, 120, 180, 240, 300, 360];
      stops.forEach((deg, i) => {
        grad.addColorStop(i / 6, css(hsv(deg, 1, 1)));
      });
      ctx.fillStyle = grad;
    } else {
      // Fallback: 360 thin wedges
      for (let a = 0; a < 360; a++) {
        ctx.fillStyle = css(hsv(a, 1, 1));
        ctx.beginPath();
        ctx.moveTo(r, r);
        ctx.arc(r, r, r, ((a - 0.7) * Math.PI) / 180, ((a + 0.7) * Math.PI) / 180);
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();

    // 2. Saturation layer (white center to transparent)
    const satGrad = ctx.createRadialGradient(r, r, 0, r, r, r);
    satGrad.addColorStop(0, 'rgba(255,255,255,1)');
    satGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = satGrad;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();

    // 3. Value/brightness layer (black overlay)
    ctx.fillStyle = `rgba(0,0,0,${1 - this.hsv[2]})`;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();

    // 4. Selection thumb
    const [h, s] = this.hsv;
    const angleRad = (h * Math.PI) / 180;
    const dist = s * r;
    const tx = r + dist * Math.cos(angleRad);
    const ty = r + dist * Math.sin(angleRad);
    const color = this.currentColor();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = css(color);
    ctx.beginPath();
    ctx.arc(tx, ty, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Keep the confirm button readable, matching the Android logic
    if (this.confirmBtn) {
      this.confirmBtn.style.background = css(color);
      this.confirmBtn.style.color = this.hsv[2] > 0.6 && this.hsv[1] < 0.6 ? '#000' : '#fff';
      this.slider.style.setProperty('--base', css(color));
      this.slider.style.background =
        `linear-gradient(90deg, #000, ${css(color)})`;
    }
  }
}
