'use strict';
// Port of opus/OpusColorConstants.kt — colors are [r,g,b] arrays (0-255).

const DEFAULT_COLOR = [0x4A, 0x90, 0xE2];

const AVAILABLE_COLORS = [
  [0x4A, 0x90, 0xE2], // blue
  [0x00, 0xBC, 0xD4], // cyan
  [0x9C, 0x27, 0xB0], // purple
  [0xE9, 0x1E, 0x63], // pink
  [0xF4, 0x43, 0x36], // red
  [0xFF, 0x98, 0x00], // orange
  [0xFF, 0xEB, 0x3B], // yellow
  [0x4C, 0xAF, 0x50], // green
  [0x00, 0x96, 0x88], // teal
];

const GOLD = [0xFF, 0xD7, 0x00];
const WHITE = [255, 255, 255];

function rgbToHsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60)       [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else              [rp, gp, bp] = [c, 0, x];
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255),
  ];
}

function hsv(h, s, v) { return hsvToRgb(h, s, clamp(v, 0, 1)); }

function css(rgb, alpha = 1) {
  const [r, g, b] = rgb;
  return `rgba(${r},${g},${b},${alpha})`;
}

function rgbToHex(rgb) {
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

// Port of OpusColorConstants.generatePalette
function generatePalette(baseColor) {
  const [h, s, v] = rgbToHsv(baseColor);

  const darkColor = hsv(h, s, v * 0.5);
  const lightColor = hsv(h, Math.max(0, s * 0.5), Math.min(1, v * 1.2));
  const glowColor = baseColor; // used with 0.5 alpha in draw calls
  const surfaceColor = hsv(h, s * 0.8, 0.1);
  const accentColor = hsv(h + 60, s, v);

  const cardColor = surfaceColor;
  const cardBorderColor = lightColor;

  const gradientStart = surfaceColor;
  const gradientEnd = darkColor;

  const sparkleColor = lightColor;
  const trailColor = baseColor;
  const trailGlowColor = glowColor;

  const fireworkColors = [
    baseColor,
    lightColor,
    WHITE,
    accentColor,
    hsv(h - 30, s, v), // analogous
  ];

  const confettiColors = [
    baseColor,
    lightColor,
    WHITE,
    accentColor,
    GOLD,
    hsv(h + 180, s, v), // complementary
  ];

  // Monochromatic scale: Darker -> Dark -> Base -> Light -> Lighter
  const balloonColors = [
    hsv(h, Math.min(1, s * 1.2), v * 0.5),
    hsv(h, Math.min(1, s * 1.1), v * 0.75),
    baseColor,
    hsv(h, Math.max(0, s * 0.7), Math.min(1, v * 1.1)),
    hsv(h, Math.max(0, s * 0.4), Math.min(1, v * 1.2)),
  ];

  return {
    baseColor, darkColor, lightColor, glowColor, surfaceColor,
    accentColor, cardColor, cardBorderColor,
    gradientStart, gradientEnd,
    fireworkColors, confettiColors, balloonColors,
    sparkleColor, trailColor, trailGlowColor,
  };
}

function applyPaletteVars(palette) {
  const root = document.documentElement.style;
  root.setProperty('--base', css(palette.baseColor));
  root.setProperty('--dark', css(palette.darkColor));
  root.setProperty('--light', css(palette.lightColor));
  root.setProperty('--accent', css(palette.accentColor));
  root.setProperty('--glow', css(palette.glowColor, 0.5));
  root.setProperty('--cardBg', css(palette.surfaceColor, 0.85));
  root.setProperty('--cardBorder', css(palette.lightColor, 0.2));
}
