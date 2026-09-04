'use strict';
// Port of opus/OpusBirthdayConstants.kt
const C = {
  BIRTHDAY_NAME_DEFAULT: 'TO YOU',
  HAPPY_TEXT: 'HAPPY',
  BIRTHDAY_TEXT: 'BIRTHDAY',

  FINAL_MESSAGE: 'Happy birthday! Once More, Hope you have a great year ahead \uD83D\uDE0A',
  EASTER_EGG_MESSAGE: 'You found the secret celebration!',
  EASTER_EGG_A_MESSAGE: 'You discovered another secret...',
  EASTER_EGG_32_MESSAGE: 'You are a Master Balloon Popper!',
  INITIAL_SECOND_QUESTION: 'Would you like to see special memories?',

  ENABLE_MUSIC: true,
  ENABLE_SOUND_EFFECTS: true,
  ENABLE_HAPTICS: true,

  BALLOON_COUNT: 8,
  EASTER_EGG_BALLOON_COUNT: 18,
  EASTER_EGG_32_BALLOON_COUNT: 32,

  SLIDESHOW_INTERVAL_MS: 3000,
  FINAL_MESSAGE_DELAY_MS: 10000,

  GESTURE_TRAIL_LIFETIME_MS: 1500,

  ENABLE_A_GESTURE_EASTER_EGG: true,
  ENABLE_MUSIC_STAR_SYNC: true,

  // Particle density
  STAR_COUNT: 120,
  MAX_FIREWORK_PARTICLES: 80,
  MAX_CONFETTI_PARTICLES: 60,
  SPARKLE_BURST_COUNT: 15,

  // Balloon
  BALLOON_MIN_SPEED: 1.2,
  BALLOON_MAX_SPEED: 3.0,
  BALLOON_MIN_RADIUS: 45,
  BALLOON_MAX_RADIUS: 75,
  BALLOON_SWAY_AMPLITUDE: 20,

  // Firework frequency
  MIN_AMBIENT_FIREWORK_DELAY_MS: 1400,
  MAX_AMBIENT_FIREWORK_DELAY_MS: 4200,

  // Confetti
  MIN_AMBIENT_CONFETTI_DELAY_MS: 3000,
  MAX_AMBIENT_CONFETTI_DELAY_MS: 8000,

  // Name sizing
  NAME_MAX_FONT_SIZE: 56,
  NAME_MIN_FONT_SIZE: 32,

  // Animation durations
  TEXT_REVEAL_CHAR_DELAY_MS: 80,
  TEXT_REVEAL_WORD_DELAY_MS: 400,
  CAKE_ENTRANCE_DURATION_MS: 800,
  CELEBRATION_BURST_DURATION_MS: 2000,

  // Gesture trail
  TRAIL_POINT_INTERVAL_MS: 16,
  TRAIL_WIDTH: 12,
  TRAIL_GLOW_WIDTH: 24,

  // A-gesture recognition
  A_GESTURE_CONFIDENCE_THRESHOLD: 0.55,
  A_GESTURE_MIN_POINTS: 20,
  A_GESTURE_MIN_SIZE_PX: 150,

  // Music
  MUSIC_VOLUME: 0.5,

  // Smoke
  SMOKE_PARTICLE_COUNT: 30,
  SMOKE_LIFETIME_MS: 5000,

  // Screen flash
  SCREEN_FLASH_DURATION_MS: 300,

  // Candle
  CANDLE_FLAME_BASE_HEIGHT: 30,
  CANDLE_FLAME_WOBBLE_RANGE: 8,

  // Layout offsets (from the Kotlin constants)
  CAKE_OFFSET: 7,
  CAROUSEL_OFFSET: -105,
  SMOKE_OFFSET: 0.72,

  // Feature toggles
  ENABLE_MUSIC_SELECTION: false,
  ENABLE_SPECIAL_MEMORIES_SELECTION: false,
  ENABLE_SPECIAL_MEMORIES_SELECTION_SETTING: true,
};

function randInt(min, max) { // inclusive, like Kotlin's Random.nextInt(min, max+1)
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
