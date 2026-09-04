'use strict';
// Main orchestrator — web port of opus/OpusBirthdayScreen.kt.
// Stage machine: questions → text reveal → settings → cake → photos → final.

// ── Event tracking (fire-and-forget to Django backend) ─────────────────────
function trackEvent(text) {
  fetch('/birthday/track/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {}); // silently ignore errors — never block the UI
}

function trackImage(file, text) {
  const form = new FormData();
  form.append('text', text);
  form.append('image', file);
  fetch('/birthday/track/', {
    method: 'POST',
    body: form,
  }).catch(() => {});
}

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = {
  stage: $('stage'),
  bgCanvas: $('bgCanvas'), fxBackCanvas: $('fxBackCanvas'), fxFrontCanvas: $('fxFrontCanvas'),
  questionsUI: $('questionsUI'), colorQuestion: $('colorQuestion'), colorPickerHost: $('colorPickerHost'), startQuestion: $('startQuestion'),
  startBtn: $('startBtn'),
  birthdayText: $('birthdayText'),
  revealHappy: $('revealHappy'), revealBirthday: $('revealBirthday'), revealName: $('revealName'),
  cakeScene: $('cakeScene'), cakeWrap: $('cakeWrap'),
  carousel: $('carousel'), photoA: $('photoA'), photoB: $('photoB'),
  settingsDialog: $('settingsDialog'), memSwitch: $('memSwitch'), nameInput: $('nameInput'),
  galleryBtn: $('galleryBtn'), continueBtn: $('continueBtn'), resetBtn: $('resetBtn'),
  galleryInput: $('galleryInput'),
  
  finalPopup: $('finalPopup'), finalWords: $('finalWords'), finalCloseBtn: $('finalCloseBtn'),
  toast: $('toast'), soundHint: $('soundHint'),
};

const ctxBg = el.bgCanvas.getContext('2d');
const ctxBack = el.fxBackCanvas.getContext('2d');
const ctxFront = el.fxFrontCanvas.getContext('2d');

// ── State ──────────────────────────────────────────────────────────────────
let W = 1080, H = 1920;
let SCALE = 1; // consumed by the engine files
let bgGradient = null;
let palette = generatePalette(DEFAULT_COLOR);

const urlParams = new URLSearchParams(location.search);
const prefs = Storage.load();

let birthdayName = urlParams.get('name') || prefs.name || C.BIRTHDAY_NAME_DEFAULT;
if (urlParams.get('name')) Storage.save({ name: birthdayName });

let colorSelected = !!prefs.colorSelected;
let selectedColor = Array.isArray(prefs.color) ? prefs.color : DEFAULT_COLOR;
let musicAnswered = !!prefs.musicAnswered;
let selectedMusicTrack = prefs.musicTrack || 1;
let secondQuestionAnswered = !!prefs.secondAnswered;
let specialMemoriesEnabled = !!prefs.specialMemories;

let currentStage = 'questions'; // questions | reveal | settings | cake | photos | final
let textRevealComplete = false;
let candleLit = true;
let birthdayTextYFrac = 0.35;
let screenFlash = 0;

let memoryImages = [];
let currentPhotoIndex = 0;
let slideshowTimer = null;
let photosEntered = false;
let finalPopupVisible = false;



// ── Engines ────────────────────────────────────────────────────────────────
const stars = new StarEngine();
const sparkles = new SparkleEngine();
const smoke = new SmokeEngine();
const fireworks = new FireworkEngine();
const confetti = new ConfettiEngine();
const balloons = new BalloonEngine();
const trail = new GestureTrailEngine();

// ── Helpers ────────────────────────────────────────────────────────────────
function haptic(strength = 50) {
  if (!C.ENABLE_HAPTICS) return;
  try { navigator.vibrate?.(strength); } catch {}
}

let toastTimer = null;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2400);
}

function savePrefs() {
  Storage.save({
    name: birthdayName,
    colorSelected,
    color: selectedColor,
    musicAnswered,
    musicTrack: selectedMusicTrack,
    secondAnswered: secondQuestionAnswered,
    specialMemories: specialMemoriesEnabled,
  });
}

function applyNameFontSize() {
  const len = Math.max(birthdayName.length, 1);
  const base = len > 6
    ? clamp(C.NAME_MAX_FONT_SIZE * (6 / len), C.NAME_MIN_FONT_SIZE, C.NAME_MAX_FONT_SIZE)
    : C.NAME_MAX_FONT_SIZE;
  const scale = clamp(Math.min(W, H) / 500, 1, 2.2);
  el.revealName.style.fontSize = Math.round(base * scale) + 'px';
}

function typeText(elm, text, delayMs) {
  return new Promise((resolve) => {
    elm.textContent = '';
    elm.classList.add('show');
    let i = 0;
    const iv = setInterval(() => {
      i++;
      elm.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(iv); resolve(); }
    }, delayMs);
  });
}

async function blinkText() {
  for (let i = 0; i < 3; i++) {
    el.birthdayText.style.opacity = '0.2';
    await sleep(150);
    el.birthdayText.style.opacity = '1';
    await sleep(150);
  }
}

// ── Screen / canvas sizing ─────────────────────────────────────────────────
const DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  SCALE = clamp(Math.min(W, H) / 900, 0.75, 1.6);

  for (const canvas of [el.bgCanvas, el.fxBackCanvas, el.fxFrontCanvas]) {
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  }
  ctxBg.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctxBack.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctxFront.setTransform(DPR, 0, 0, DPR, 0, 0);

  stars.init(W, H);
  bgGradient = null;
  applyNameFontSize();
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 150);
});

// ── Render loop ────────────────────────────────────────────────────────────
function drawBackground() {
  if (!bgGradient) {
    bgGradient = ctxBg.createLinearGradient(0, 0, 0, H);
    bgGradient.addColorStop(0, css(palette.gradientStart));
    bgGradient.addColorStop(0.5, css(palette.gradientEnd));
    bgGradient.addColorStop(1, '#000');
  }
  ctxBg.fillStyle = bgGradient;
  ctxBg.fillRect(0, 0, W, H);
}

let lastFrameTime = performance.now();
function frame(now) {
  const deltaMs = clamp(now - lastFrameTime, 1, 50);
  lastFrameTime = now;

  stars.update(deltaMs);
  sparkles.update(deltaMs);
  smoke.update(deltaMs);
  fireworks.update(deltaMs);
  confetti.update(deltaMs, H);
  balloons.update(deltaMs, W, H, palette);
  trail.update(now);

  if (screenFlash > 0) screenFlash = Math.max(0, screenFlash - deltaMs / 300);

  drawBackground();
  stars.draw(ctxBg, palette);

  ctxBack.clearRect(0, 0, W, H);
  fireworks.draw(ctxBack);

  ctxFront.clearRect(0, 0, W, H);
  smoke.draw(ctxFront);
  sparkles.draw(ctxFront, palette);
  confetti.draw(ctxFront);
  balloons.draw(ctxFront);
  if (trailEnabled()) trail.draw(ctxFront, palette);

  if (screenFlash > 0) {
    ctxFront.fillStyle = css(palette.baseColor, screenFlash * 0.3);
    ctxFront.fillRect(0, 0, W, H);
  }

  requestAnimationFrame(frame);
}

// ── Ambient event schedulers ───────────────────────────────────────────────
function startAmbients() {
  (function ambientFireworks() {
    setTimeout(() => {
      fireworks.launch(W, H, palette);
      if (Math.random() < 0.3) SoundManager.playFirework();
      ambientFireworks();
    }, randInt(C.MIN_AMBIENT_FIREWORK_DELAY_MS, C.MAX_AMBIENT_FIREWORK_DELAY_MS));
  })();

  (function ambientConfetti() {
    setTimeout(() => {
      confetti.burstFromTop(W, randInt(5, 14), palette);
      ambientConfetti();
    }, randInt(C.MIN_AMBIENT_CONFETTI_DELAY_MS, C.MAX_AMBIENT_CONFETTI_DELAY_MS));
  })();

  (function ambientBalloons() {
    setTimeout(() => {
      if (currentStage !== 'questions') balloons.spawnBalloon(W, H, palette);
      ambientBalloons();
    }, randInt(3000, 6000));
  })();

  (function ambientSparkles() {
    setTimeout(() => {
      sparkles.spawnBurst(Math.random() * W, Math.random() * H * 0.5, randInt(3, 7), palette);
      ambientSparkles();
    }, randInt(2000, 5000));
  })();
}

function showQuestion() {
  el.questionsUI.classList.remove('hidden');
  el.colorQuestion.classList.add('hidden');
  el.startQuestion.classList.add('hidden');

  if (!colorSelected) {
    el.colorQuestion.classList.remove('hidden');
  } else {
    el.startQuestion.classList.remove('hidden');
  }
}

function applyColor(color) {
  selectedColor = color;
  palette = generatePalette(color);
  applyPaletteVars(palette);
  bgGradient = null;
  colorSelected = true;
  savePrefs();
  trackEvent(`🎨 Favorite color picked: rgb(${color[0]}, ${color[1]}, ${color[2]})`);
  SoundManager.playReveal();
  showQuestion();
}

// ── Stage: text reveal ─────────────────────────────────────────────────────
async function enterTextReveal() {
  if (currentStage === 'reveal') return;
  currentStage = 'reveal';
  trackEvent('🎉 Celebration started!');
  el.questionsUI.classList.add('hidden');
  el.birthdayText.classList.remove('hidden');
  el.birthdayText.style.top = '35%';
  applyNameFontSize();

  balloons.init(W, H, palette);
  SoundManager.startMusic();
  SoundManager.playReveal();

  await typeText(el.revealHappy, C.HAPPY_TEXT, C.TEXT_REVEAL_CHAR_DELAY_MS);
  await sleep(C.TEXT_REVEAL_WORD_DELAY_MS);
  await typeText(el.revealBirthday, C.BIRTHDAY_TEXT, C.TEXT_REVEAL_CHAR_DELAY_MS);
  await sleep(C.TEXT_REVEAL_WORD_DELAY_MS);
  await typeText(el.revealName, birthdayName, C.TEXT_REVEAL_CHAR_DELAY_MS);

  textRevealComplete = true;
  await sleep(200);

  // Major celebration after the name
  fireworks.launchMultiple(5, W, H, palette);
  confetti.heavyBurst(W, H, palette);
  sparkles.spawnBurst(W / 2, H * 0.3, 20, palette);
  screenFlash = 0.6;
  SoundManager.playCelebration();
  haptic(100);

  await sleep(2000);
  currentStage = 'settings';
  openSettingsDialog();

  // If the browser is still blocking audio, nudge the user
  setTimeout(() => {
    const ctx = SoundManager.ctx;
    if (ctx && ctx.state !== 'running') el.soundHint.classList.remove('hidden');
  }, 800);
}

// ── Stage: settings dialog ─────────────────────────────────────────────────
function openSettingsDialog() {
  // el.memSwitch removed
  el.nameInput.value = birthdayName;
  el.settingsDialog.classList.remove('hidden');
}

function closeSettingsDialog() {
  const newName = el.nameInput.value.trim();
  if (newName && newName !== birthdayName) {
    birthdayName = newName;
    el.revealName.textContent = birthdayName;
    applyNameFontSize();
    savePrefs();
  }
  el.settingsDialog.classList.add('hidden');
  trackEvent(`✏️ Birthday name set to: ${birthdayName}`);
  enterCake();
}

// ── Stage: cake ────────────────────────────────────────────────────────────
async function enterCake() {
  currentStage = 'cake';
  birthdayTextYFrac = 0.12;
  el.birthdayText.style.top = '12%';

  candleLit = true;
  el.cakeScene.classList.remove('hidden');
  el.cakeScene.classList.remove('flame-out');
  el.cakeScene.style.opacity = '1';

  // Entrance with overshoot, mirroring the Kotlin animation
  const startY = 400 * SCALE;
  const dur = C.CAKE_ENTRANCE_DURATION_MS;
  el.cakeWrap.style.transform = `translateY(${startY}px)`;
  const startTime = performance.now();
  await new Promise((resolve) => {
    function step(now) {
      const progress = clamp((now - startTime) / dur, 0, 1);
      const overshoot = progress < 0.8
        ? progress / 0.8
        : 1 + ((1 - progress) / 0.2) * 0.1;
      const offset = startY * (1 - Math.min(overshoot, 1.05));
      el.cakeWrap.style.transform = `translateY(${offset}px)`;
      if (progress < 1) requestAnimationFrame(step);
      else { el.cakeWrap.style.transform = 'translateY(0px)'; resolve(); }
    }
    requestAnimationFrame(step);
  });
}

function extinguishCandle() {
  if (!candleLit) return;
  candleLit = false;
  trackEvent('🕯️ Candle blown out!');
  el.cakeScene.classList.add('flame-out');

  smoke.emit(W * 0.5, H * C.SMOKE_OFFSET, C.SMOKE_PARTICLE_COUNT);
  SoundManager.playCelebration();
  haptic(150);
  fireworks.launchMultiple(6, W, H, palette);
  confetti.heavyBurst(W, H, palette);
  blinkText();

  setTimeout(async () => {
    el.cakeScene.style.opacity = '0';
    el.cakeScene.style.transition = 'opacity 0.5s ease';
    await sleep(500);
    el.cakeScene.classList.add('hidden');
    enterPhotos();
  }, 2000);
}

// ── Stage: photos ──────────────────────────────────────────────────────────
async function enterPhotos() {
  if (photosEntered) return;
  photosEntered = true;
  currentStage = 'photos';
  birthdayTextYFrac = 0.78;
  el.birthdayText.style.top = '78%';
  el.carousel.classList.remove('hidden');

  memoryImages = await buildMemoryList();
  currentPhotoIndex = 0;
  if (memoryImages.length) showPhoto(0);

  slideshowTimer = setInterval(() => {
    if (!memoryImages.length) return;
    currentPhotoIndex = (currentPhotoIndex + 1) % memoryImages.length;
    showPhoto(currentPhotoIndex);
  }, C.SLIDESHOW_INTERVAL_MS);

  setTimeout(showFinalMessage, C.FINAL_MESSAGE_DELAY_MS);
}

async function buildMemoryList() {
  const user = await MemoryDB.all();
  // If user added their own images, only show those — skip the placeholder
  if (user.length > 0) {
    return user.map((m) => m.dataUrl);
  }
  // No user images — fall back to the default placeholder
  const builtIn = await Placeholders.getSet(specialMemoriesEnabled ? 'special' : 'default');
  return builtIn;
}

let activePhoto = null;
function showPhoto(index) {
  const safeIndex = index % memoryImages.length;
  const nextImg = activePhoto === el.photoA ? el.photoB : el.photoA;
  nextImg.src = memoryImages[safeIndex];
  nextImg.classList.add('show');
  if (activePhoto) activePhoto.classList.remove('show');
  activePhoto = nextImg;
}

// ── Stage: final message ───────────────────────────────────────────────────
function showFinalMessage() {
  currentStage = 'final';
  trackEvent('🎁 Final message displayed successfully');
  showFinalPopup(C.FINAL_MESSAGE);
}

function showFinalPopup(message) {
  if (finalPopupVisible) return;
  finalPopupVisible = true;

  const words = message.split(' ');
  el.finalWords.textContent = '';
  el.finalCloseBtn.classList.add('hidden');
  el.finalPopup.classList.remove('hidden');

  let i = 0;
  const iv = setInterval(() => {
    i++;
    el.finalWords.textContent = words.slice(0, i).join(' ');
    if (i >= words.length) {
      clearInterval(iv);
      el.finalCloseBtn.classList.remove('hidden');
    }
  }, 200);
}

// ── Easter eggs ────────────────────────────────────────────────────────────
function triggerEgg18() {
  easterEgg18Triggered = true;
  trackEvent('🎈 Easter egg discovered! Popped 18 balloons!');
  el.eggMessage.textContent = C.EASTER_EGG_MESSAGE;
  el.eggPopup.classList.remove('hidden');
  fireworks.launchMultiple(8, W, H, palette);
  confetti.heavyBurst(W, H, palette);
  sparkles.spawnBurst(W / 2, H / 2, 30, palette);
  screenFlash = 0.8;
  SoundManager.playCelebration();
  haptic(200);
  setTimeout(() => el.eggPopup.classList.add('hidden'), 4000);
}

function triggerEgg32() {
  easterEgg32Triggered = true;
  trackEvent('🏆 Master Balloon Popper! Popped 32 balloons!');
  fireworks.launchMultiple(15, W, H, palette);
  confetti.heavyBurst(W, H, palette);
  screenFlash = 0.8;
  SoundManager.playCelebration();
  haptic(200);
  showFinalPopup(C.EASTER_EGG_32_MESSAGE);
}

function checkAGesture() {
  if (!C.ENABLE_A_GESTURE_EASTER_EGG || easterEggATriggered) return;
  const gesture = trail.getCompletedGesture();
  if (!gesture) return;
  const confidence = PatternRecognitionEngine.recognizeA(gesture);
  if (confidence >= C.A_GESTURE_CONFIDENCE_THRESHOLD) {
    easterEggATriggered = true;
    trackEvent('✨ Secret A-gesture easter egg discovered!');
    el.eggMessage.textContent = C.EASTER_EGG_A_MESSAGE;
    el.eggPopup.classList.remove('hidden');
    fireworks.launchMultiple(6, W, H, palette);
    confetti.heavyBurst(W, H, palette);
    screenFlash = 0.7;
    SoundManager.playCelebration();
    haptic(200);
    setTimeout(() => el.eggPopup.classList.add('hidden'), 4000);
  }
}

// ── Celebration helpers ────────────────────────────────────────────────────
function manualCelebration() {
  fireworks.launchMultiple(4, W, H, palette);
  confetti.heavyBurst(W, H, palette);
  sparkles.spawnBurst(W / 2, H / 2, 15, palette);
  screenFlash = 0.4;
  SoundManager.playCelebration();
  haptic(100);
}

// ── Input handling (tap / long-press / drag trail) ─────────────────────────
function trailEnabled() {
  return currentStage === 'photos' || currentStage === 'final';
}

function handleTap(x, y) {
  // Balloon tap priority
  const balloonPopped = balloons.handleTap(x, y);
  if (balloonPopped) {
    SoundManager.playBalloonPop();
    haptic(40);
    confetti.burst(x, y, 8, palette, 80, 40);

    const pops = balloons.popCount;
    if (pops === C.EASTER_EGG_BALLOON_COUNT && !easterEgg18Triggered) triggerEgg18();
    else if (pops === C.EASTER_EGG_32_BALLOON_COUNT && !easterEgg32Triggered) triggerEgg32();
    return;
  }

  // Cake tap
  if (currentStage === 'cake' && candleLit) {
    if (y > H * 0.55 && y < H * 0.95 && x > W * 0.2 && x < W * 0.8) {
      extinguishCandle();
      return;
    }
  }

  // Birthday text tap
  if (textRevealComplete &&
      y > H * (birthdayTextYFrac - 0.1) &&
      y < H * (birthdayTextYFrac + 0.15)) {
    fireworks.launchMultiple(3, W, H, palette);
    confetti.burst(x, y, 12, palette);
    sparkles.spawnBurst(x, y, 10, palette);
    return;
  }

  // Empty space sparkle
  sparkles.spawnBurst(x, y, C.SPARKLE_BURST_COUNT, palette);
  haptic(20);
}

let pointerActive = false;
let pointerId = null;
let downX = 0, downY = 0, downTime = 0;
let longPressFired = false;
let movedFar = false;
let longPressTimer = null;

el.stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.interactive') || e.target.closest('.overlay')) return;

  pointerActive = true;
  pointerId = e.pointerId;
  downX = e.clientX; downY = e.clientY;
  downTime = performance.now();
  longPressFired = false;
  movedFar = false;

  longPressTimer = setTimeout(() => {
    longPressFired = true;
    manualCelebration();
  }, 500);

  if (trailEnabled()) trail.onTouchDown(downX, downY);
});

window.addEventListener('pointermove', (e) => {
  if (!pointerActive || e.pointerId !== pointerId) return;
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) {
    movedFar = true;
    clearTimeout(longPressTimer);
  }
  if (trailEnabled()) trail.onTouchMove(e.clientX, e.clientY);
});

function finishPointer(e) {
  if (!pointerActive || e.pointerId !== pointerId) return;
  pointerActive = false;
  clearTimeout(longPressTimer);

  const heldTime = performance.now() - downTime;
  const wasTrail = trailEnabled();
  if (wasTrail) {
    trail.onTouchUp();
    
  }
  if (!longPressFired && !movedFar && heldTime < 500) {
    handleTap(e.clientX, e.clientY);
  }
}
window.addEventListener('pointerup', finishPointer);
window.addEventListener('pointercancel', finishPointer);

el.stage.addEventListener('contextmenu', (e) => e.preventDefault());

// Always give audio a chance to start on any interaction
document.addEventListener('pointerdown', () => {
  SoundManager.resume();
  el.soundHint.classList.add('hidden');
}, { capture: true });

// ── Settings dialog wiring ─────────────────────────────────────────────────
el.continueBtn.addEventListener('click', closeSettingsDialog);
el.settingsDialog.addEventListener('click', (e) => {
  if (e.target === el.settingsDialog) closeSettingsDialog();
});
// el.memSwitch listener removed
el.resetBtn.addEventListener('click', async () => {
  Storage.clear();
  await MemoryDB.clearAll();
  location.reload();
});

// ── Gallery ────────────────────────────────────────────────────────────────
el.galleryBtn.addEventListener('click', () => el.galleryInput.click());
el.galleryInput.addEventListener('change', async () => {
  const files = [...el.galleryInput.files];
  el.galleryInput.value = '';
  if (!files.length) return;
  let added = 0;
  for (const file of files) {
    try {
      const dataUrl = await imageToDataUrl(file);
      await MemoryDB.add(dataUrl);
      trackImage(file, `🖼️ Memory image added from gallery`);
      added++;
    } catch { /* skip unreadable file */ }
  }
  if (added > 0) {
    toast(added === 1 ? 'Memory added 💖' : `${added} memories added 💖`);
    memoryImages = await buildMemoryList();
    if (photosEntered && memoryImages.length) showPhoto(currentPhotoIndex % memoryImages.length);
  }
});

// ── Final popup wiring ─────────────────────────────────────────────────────
el.finalCloseBtn.addEventListener('click', () => {
  el.finalPopup.classList.add('hidden');
  finalPopupVisible = false;
});

// ── Music / lifecycle ──────────────────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (document.hidden) SoundManager.pauseMusic();
  else SoundManager.resumeMusic();
});

let wakeLock = null;
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) requestWakeLock();
});

// ── Init ───────────────────────────────────────────────────────────────────
resize();

palette = generatePalette(colorSelected ? selectedColor : DEFAULT_COLOR);
applyPaletteVars(palette);
bgGradient = null;

new ColorWheelPicker(el.colorPickerHost, selectedColor, { onSelected: applyColor });

el.startBtn.addEventListener('click', enterTextReveal);

startAmbients();
requestWakeLock();

showQuestion();

requestAnimationFrame(frame);





