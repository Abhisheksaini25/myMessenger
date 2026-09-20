/* =============================================
   ✨ COSMIC BIRTHDAY EXPERIENCE — MAIN SCRIPT
   =============================================
   Animation timeline:
     Entry overlay → User taps → 5-second delay
     0–5 s   → Cosmic starfield + shooting stars
     5 s     → Music starts, constellation text forms
     ~10 s   → Delivery star → Full-page scratch popup
     Scratch → Big image revealed → Settles to final view
   ============================================= */

// ─────────────────────────────────────────────
//  🎯 CONFIGURATION — Change these to customise
// ─────────────────────────────────────────────
const CONFIG = {
    // ✏️  Birthday name (displayed in constellation)
    birthdayName: "Aditya",

    // 🎵  Media files (same folder)
    musicFile: "med.mp3",
    imageFile: "img.png",

    // ⏱️  Timing
    initialDelay: 5000,            // ms before anything appears
    constellationDuration: 5000,   // ms to fully form the text

    // 🌟  Background starfield
    staticStarCount: 280,
    maxShootingStars: 3,
    shootingStarSpawnChance: 0.015, // per-frame probability

    // ✨  Constellation
    starPointCount: 1200,          // dots forming the text
    starBaseSize: 1.8,             // base radius of each dot
    glowRadius: 6,                 // glow size around dots

    // 🖼️  Scratch card
    brushSize: 50,                 // scratch brush radius (bigger for fullpage)
    revealThreshold: 40,           // % scratched → auto-reveal
};

// ─────────────────────────────────────────────
//  UTILITY HELPERS
// ─────────────────────────────────────────────
const rand = (lo, hi) => Math.random() * (hi - lo) + lo;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─────────────────────────────────────────────
//  DOM REFERENCES
// ─────────────────────────────────────────────
const entryOverlay = document.getElementById("entry-overlay");

const starfieldCanvas = document.getElementById("starfield");
const starfieldCtx = starfieldCanvas.getContext("2d");

const constellationCanvas = document.getElementById("constellation");
const constellationCtx = constellationCanvas.getContext("2d");

// Full-page scratch elements
const fullpageScratch = document.getElementById("fullpage-scratch");
const fullpageInner = document.getElementById("fullpage-inner");
const fullpageImage = document.getElementById("fullpage-image");
const fullpageCanvas = document.getElementById("fullpage-canvas");
const fullpageCtx = fullpageCanvas.getContext("2d");
const fullpageHint = document.getElementById("fullpage-hint");

// Second scratch elements
const secondScratch = document.getElementById("second-scratch");
const secondInner = document.getElementById("second-inner");
const secondImage = document.getElementById("second-image");
const secondCanvas = document.getElementById("second-canvas");
const secondCtx = secondCanvas.getContext("2d");
const secondHint = document.getElementById("second-hint");

// Settled images view
const smallImageContainer = document.getElementById("small-image-container");
const secondSmallImageContainer = document.getElementById("second-small-image-container");

const bgMusic = document.getElementById("bg-music");

// ─────────────────────────────────────────────
//  GLOBAL STATE
// ─────────────────────────────────────────────
let phase = "entry";            // entry | waiting | constellation | delivery | scratch | revealed
let constellationStars = [];    // star objects forming the text
let constellationT0 = 0;     // timestamp when constellation started
let staticStars = [];    // background twinkling stars
let shootingStars = [];    // active shooting stars
let mouseTrail = [];    // sparkle trail particles
let confetti = [];    // celebration confetti particles
let deliveryStar = null;  // the big star that delivers the image
let musicStarted = false;
let experienceStarted = false;

// ─────────────────────────────────────────────
//  CANVAS RESIZE
// ─────────────────────────────────────────────
function resizeFullscreenCanvases() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    starfieldCanvas.width = w; starfieldCanvas.height = h;
    constellationCanvas.width = w; constellationCanvas.height = h;
    generateStaticStars();
}
window.addEventListener("resize", resizeFullscreenCanvases);

// ═════════════════════════════════════════════
//  🌌  STATIC STARS
// ═════════════════════════════════════════════
function generateStaticStars() {
    staticStars = [];
    const w = starfieldCanvas.width;
    const h = starfieldCanvas.height;
    for (let i = 0; i < CONFIG.staticStarCount; i++) {
        staticStars.push({
            x: rand(0, w),
            y: rand(0, h),
            r: rand(0.4, 2.4),
            baseAlpha: rand(0.25, 1),
            speed: rand(0.6, 3.2),
            offset: rand(0, Math.PI * 2),
        });
    }
}

function drawStaticStars(time) {
    const ctx = starfieldCtx;
    for (const s of staticStars) {
        const twinkle = Math.sin(time * 0.001 * s.speed + s.offset);
        const a = s.baseAlpha * (0.65 + 0.35 * twinkle);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
    }
}

// ═════════════════════════════════════════════
//  💫  SHOOTING STARS
// ═════════════════════════════════════════════
function spawnShootingStar() {
    const w = starfieldCanvas.width;
    const h = starfieldCanvas.height;

    // Spawn from top or right edge
    const fromTop = Math.random() > 0.3;
    const x = fromTop ? rand(w * 0.1, w * 0.95) : w + 10;
    const y = fromTop ? -10 : rand(0, h * 0.35);

    const angle = rand(0.2, 0.55) * Math.PI;   // diagonal downward-left
    const speed = rand(9, 18);

    shootingStars.push({
        x, y,
        vx: -Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        tailLen: rand(180, 350),
        alpha: 1,
        maxLife: rand(50, 90),
        age: 0,
        thickness: rand(1.6, 3.2),
    });
}

function updateShootingStars(ctx) {
    // Maybe spawn
    if (shootingStars.length < CONFIG.maxShootingStars &&
        Math.random() < CONFIG.shootingStarSpawnChance) {
        spawnShootingStar();
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += s.vx;
        s.y += s.vy;
        s.age++;
        s.alpha = clamp(1 - s.age / s.maxLife, 0, 1);

        if (s.alpha <= 0) { shootingStars.splice(i, 1); continue; }

        // Normalised direction for tail
        const mag = Math.hypot(s.vx, s.vy);
        const nx = s.vx / mag, ny = s.vy / mag;
        const tx = s.x - nx * s.tailLen;
        const ty = s.y - ny * s.tailLen;

        // Gradient trail
        const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
        grad.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
        grad.addColorStop(0.15, `rgba(220,230,255,${s.alpha * 0.75})`);
        grad.addColorStop(0.45, `rgba(180,200,255,${s.alpha * 0.35})`);
        grad.addColorStop(1, `rgba(120,150,255,0)`);

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.thickness;
        ctx.lineCap = "round";
        ctx.stroke();

        // Bright head glow
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.thickness + 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.alpha * 0.9})`;
        ctx.fill();
    }
}

// ═════════════════════════════════════════════
//  🖱️  MOUSE TRAIL SPARKLES
// ═════════════════════════════════════════════
document.addEventListener("mousemove", (e) => {
    for (let i = 0; i < 2; i++) {
        mouseTrail.push({
            x: e.clientX + rand(-4, 4),
            y: e.clientY + rand(-4, 4),
            r: rand(0.8, 2.4),
            alpha: rand(0.6, 1),
            hue: rand(210, 290),
            decay: rand(0.02, 0.04),
        });
    }
    if (mouseTrail.length > 80) mouseTrail.splice(0, mouseTrail.length - 80);
});

function drawMouseTrail(ctx) {
    for (let i = mouseTrail.length - 1; i >= 0; i--) {
        const p = mouseTrail[i];
        p.alpha -= p.decay;
        p.r *= 0.97;
        if (p.alpha <= 0) { mouseTrail.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},80%,78%,${p.alpha})`;
        ctx.fill();
    }
}

// ═════════════════════════════════════════════
//  ✨  CONSTELLATION TEXT ANIMATION
// ═════════════════════════════════════════════

/**
 * Convert "Happy Birthday\nName" into an array of { x, y } points
 * by rendering text to an off-screen canvas and sampling opaque pixels.
 */
function generateConstellationPoints() {
    const w = constellationCanvas.width;
    const h = constellationCanvas.height;

    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const oc = off.getContext("2d");

    // ── Calculate responsive font size ──
    const line1 = "Happy Birthday";
    const line2 = CONFIG.birthdayName;

    let fontSize = Math.min(w / 6.5, h / 5.5, 110);

    // Fit line1 within 88 % of canvas width
    oc.font = `bold ${fontSize}px Georgia, serif`;
    let tw = oc.measureText(line1).width;
    while (tw > w * 0.88 && fontSize > 14) {
        fontSize -= 2;
        oc.font = `bold ${fontSize}px Georgia, serif`;
        tw = oc.measureText(line1).width;
    }

    const nameFontSize = Math.min(fontSize * 1.5, w * 0.32);

    // ── Draw text onto off-screen canvas ──
    oc.fillStyle = "#fff";
    oc.textAlign = "center";
    oc.textBaseline = "middle";

    oc.font = `bold ${fontSize}px Georgia, serif`;
    oc.fillText(line1, w / 2, h * 0.24);

    oc.font = `bold ${nameFontSize}px Georgia, serif`;
    oc.fillText(line2, w / 2, h * 0.42);

    // ── Sample opaque pixel positions ──
    const imgData = oc.getImageData(0, 0, w, h).data;
    const candidates = [];
    const step = Math.max(2, Math.floor(Math.sqrt((w * h) / 12000)));

    for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
            if (imgData[(y * w + x) * 4 + 3] > 120) {
                candidates.push({ x, y });
            }
        }
    }

    // Shuffle & pick
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const picked = candidates.slice(0, Math.min(CONFIG.starPointCount, candidates.length));

    // Sort with organic randomness for a sweep-reveal effect
    picked.forEach(p => { p._k = p.x * 0.35 + p.y * 0.55 + rand(-80, 80); });
    picked.sort((a, b) => a._k - b._k);

    // Build star objects
    constellationStars = picked.map((p, i) => ({
        x: p.x,
        y: p.y,
        targetR: rand(0.8, CONFIG.starBaseSize + 0.8),
        r: 0,
        alpha: 0,
        targetAlpha: rand(0.7, 1),
        delay: (i / picked.length) * CONFIG.constellationDuration,
        twinkleSpd: rand(0.8, 3.5),
        twinkleOff: rand(0, Math.PI * 2),
        hue: rand(205, 275),
    }));
}

function drawConstellation(time) {
    if (phase !== "constellation" && phase !== "delivery" && phase !== "scratch" && phase !== "revealed") return;

    const ctx = constellationCtx;
    const elapsed = time - constellationT0;

    // Constellation stays fully visible at all times
    const dimFactor = 1;

    ctx.clearRect(0, 0, constellationCanvas.width, constellationCanvas.height);

    let allDone = true;

    for (const s of constellationStars) {
        if (elapsed < s.delay) { allDone = false; continue; }

        const prog = clamp((elapsed - s.delay) / 600, 0, 1);
        // Ease-out for smooth appearance
        const ease = 1 - Math.pow(1 - prog, 3);

        s.alpha = s.targetAlpha * ease;
        s.r = s.targetR * ease;
        if (prog < 1) allDone = false;

        // Twinkle after fully appeared
        const twinkle = prog >= 1
            ? 0.7 + 0.3 * Math.sin(time * 0.001 * s.twinkleSpd + s.twinkleOff)
            : 1;

        // Slight flash on appearance (overshoot)
        const flash = prog < 0.25 ? 1 + (1 - prog / 0.25) * 0.6 : 1;

        const fa = clamp(s.alpha * twinkle * flash * dimFactor, 0, 1);

        // Outer glow
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + CONFIG.glowRadius * ease, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue},75%,72%,${fa * 0.12})`;
        ctx.fill();

        // Inner glow
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + 2.5 * ease, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${s.hue},60%,82%,${fa * 0.25})`;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${fa})`;
        ctx.fill();
    }

    // Transition: constellation done → launch delivery star
    if (allDone && phase === "constellation") {
        phase = "delivery";
        setTimeout(launchDeliveryStar, 800);
    }
}

// ═════════════════════════════════════════════
//  🌠  DELIVERY STAR (big shooting star → brings the image)
// ═════════════════════════════════════════════
function launchDeliveryStar() {
    const w = starfieldCanvas.width;
    const h = starfieldCanvas.height;

    deliveryStar = {
        // Start top-right corner
        sx: w * 0.88, sy: -30,
        // Control point (creates a graceful arc)
        cx: w * 0.35, cy: h * 0.08,
        // End: where the image will appear (center at 72% height)
        ex: w / 2, ey: h * 0.72,
        t: 0,
        duration: 180,   // frames (~3s at 60fps) to make it much slower
        x: 0, y: 0,
        trail: [],
    };
}

function drawDeliveryStar(ctx) {
    if (!deliveryStar) return;
    const d = deliveryStar;
    d.t += 1 / d.duration;

    if (d.t >= 1) {
        // Arrived → show the full-page scratch
        deliveryStar = null;
        showFullpageScratch();
        return;
    }

    // Ease-in-out for graceful arc
    const t = d.t < 0.5
        ? 4 * d.t * d.t * d.t
        : 1 - Math.pow(-2 * d.t + 2, 3) / 2;

    // Quadratic Bézier curve
    d.x = (1 - t) * (1 - t) * d.sx + 2 * (1 - t) * t * d.cx + t * t * d.ex;
    d.y = (1 - t) * (1 - t) * d.sy + 2 * (1 - t) * t * d.cy + t * t * d.ey;

    // Store trail points
    d.trail.push({ x: d.x, y: d.y, a: 1 });

    // ── Draw sparkling trail ──
    for (let i = d.trail.length - 1; i >= 0; i--) {
        const p = d.trail[i];
        p.a -= 0.018;
        if (p.a <= 0) { d.trail.splice(i, 1); continue; }

        const sz = 3.5 * p.a;
        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140,160,255,${p.a * 0.1})`;
        ctx.fill();
        // Core
        ctx.beginPath();
        ctx.arc(p.x + rand(-1.5, 1.5), p.y + rand(-1.5, 1.5), sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,215,255,${p.a * 0.55})`;
        ctx.fill();
    }

    // ── Sparkle particles flying off the head ──
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(d.x + rand(-16, 16), d.y + rand(-16, 16), rand(0.4, 1.8), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${rand(0.25, 0.65)})`;
        ctx.fill();
    }

    // ── Large glowing head ──
    // Outer halo
    ctx.beginPath();
    ctx.arc(d.x, d.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100,120,255,0.08)";
    ctx.fill();
    // Middle glow
    ctx.beginPath();
    ctx.arc(d.x, d.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(180,200,255,0.25)";
    ctx.fill();
    // Bright core
    ctx.beginPath();
    ctx.arc(d.x, d.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
}

// ═════════════════════════════════════════════
//  🖼️  FULL-PAGE SCRATCH REVEAL
// ═════════════════════════════════════════════

function showFullpageScratch() {
    phase = "scratch";

    // Pre-fill canvas with dark overlay BEFORE container is visible
    // This prevents the image from flashing during the pop animation
    fullpageCanvas.width = 800;
    fullpageCanvas.height = 600;
    fullpageCtx.fillStyle = "#0f1025";
    fullpageCtx.fillRect(0, 0, 800, 600);

    fullpageScratch.classList.add("visible");

    // Wait for pop animation to settle (700ms animation + buffer)
    setTimeout(() => {
        if (fullpageImage.complete && fullpageImage.naturalWidth > 0) {
            setupFullpageScratch();
        } else {
            fullpageImage.addEventListener("load", setupFullpageScratch, { once: true });
        }
    }, 900);
}

function setupFullpageScratch() {
    // Measure the canvas's displayed size (CSS 100% x 100% of inner container)
    const rect = fullpageCanvas.getBoundingClientRect();
    const cw = Math.round(rect.width);
    const ch = Math.round(rect.height);

    fullpageCanvas.width = cw;
    fullpageCanvas.height = ch;

    const ctx = fullpageCtx;

    // ── Draw cosmic scratch overlay ──
    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, "#0f1025");
    grad.addColorStop(0.4, "#141833");
    grad.addColorStop(0.7, "#10163a");
    grad.addColorStop(1, "#0b0e22");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Subtle radial highlight
    const rGrad = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw * 0.6);
    rGrad.addColorStop(0, "rgba(80,70,150,0.15)");
    rGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rGrad;
    ctx.fillRect(0, 0, cw, ch);

    // Sparkle dots scattered across the overlay
    for (let i = 0; i < 160; i++) {
        ctx.beginPath();
        ctx.arc(rand(0, cw), rand(0, ch), rand(0.3, 2.2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${rand(0.05, 0.35)})`;
        ctx.fill();
    }

    // ── Scratch interaction ──
    let hintVisible = true;
    let scratching = false;
    let lastCheck = 0;

    function getPos(e) {
        const r = fullpageCanvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (cx - r.left) * (fullpageCanvas.width / r.width),
            y: (cy - r.top) * (fullpageCanvas.height / r.height),
        };
    }

    function doScratch(pos) {
        // Hide the hint on first scratch
        if (hintVisible) {
            hintVisible = false;
            fullpageHint.classList.add("hidden");
        }

        ctx.globalCompositeOperation = "destination-out";

        // Soft-edged circular brush
        const rg = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, CONFIG.brushSize);
        rg.addColorStop(0, "rgba(0,0,0,1)");
        rg.addColorStop(0.6, "rgba(0,0,0,0.8)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, CONFIG.brushSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = "source-over";

        // Throttled progress check
        const now = performance.now();
        if (now - lastCheck > 400) {
            lastCheck = now;
            checkFullpageProgress();
        }
    }

    // Mouse
    fullpageCanvas.addEventListener("mousedown", (e) => { scratching = true; doScratch(getPos(e)); });
    fullpageCanvas.addEventListener("mousemove", (e) => { if (scratching) doScratch(getPos(e)); });
    fullpageCanvas.addEventListener("mouseup", () => { scratching = false; });
    fullpageCanvas.addEventListener("mouseleave", () => { scratching = false; });

    // Touch
    fullpageCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); scratching = true; doScratch(getPos(e)); });
    fullpageCanvas.addEventListener("touchmove", (e) => { e.preventDefault(); if (scratching) doScratch(getPos(e)); });
    fullpageCanvas.addEventListener("touchend", () => { scratching = false; });
}

/** Checks how much of the overlay has been erased */
function checkFullpageProgress() {
    const w = fullpageCanvas.width, h = fullpageCanvas.height;
    const data = fullpageCtx.getImageData(0, 0, w, h).data;
    let transparent = 0;
    const total = data.length / 4;
    // Sample every 4th pixel for speed
    for (let i = 3; i < data.length; i += 16) {
        if (data[i] === 0) transparent++;
    }
    const sampled = Math.ceil(total / 4);
    const pct = (transparent / sampled) * 100;

    if (pct >= CONFIG.revealThreshold) {
        completeReveal();
    }
}

/**
 * Reveal flow:
 *  1. Fade out scratch canvas → big image fully visible
 *  2. Pause to appreciate → fade out fullpage overlay
 *  3. Show small image + constellation → confetti burst
 */
function completeReveal() {
    if (phase === "revealed") return;
    phase = "revealed";

    // Step 1: Fade out scratch canvas → reveals full image at large size
    fullpageCanvas.style.transition = "opacity 1s ease";
    fullpageCanvas.style.opacity = "0";
    fullpageHint.classList.add("hidden");

    // Step 2: After a moment to appreciate, dismiss the fullpage overlay
    setTimeout(() => {
        fullpageScratch.style.transition = "opacity 1s ease";
        fullpageScratch.style.opacity = "0";

        // Step 3: Fullpage gone → show small image + confetti
        setTimeout(() => {
            fullpageScratch.style.display = "none";
            smallImageContainer.classList.add("visible");
            spawnConfetti();

            // After 7 seconds, show the second scratch picture
            setTimeout(showSecondFullpage, 7000);
        }, 1000);
    }, 1800);
}

// ═════════════════════════════════════════════
//  🖼️  SECOND FULL-PAGE SCRATCH REVEAL
// ═════════════════════════════════════════════

function showSecondFullpage() {
    // Pre-fill canvas with dark overlay BEFORE container is visible
    secondCanvas.width = 800;
    secondCanvas.height = 600;
    secondCtx.fillStyle = "#0f1025";
    secondCtx.fillRect(0, 0, 800, 600);

    secondScratch.classList.add("visible");

    // Wait for pop animation to settle
    setTimeout(() => {
        if (secondImage.complete && secondImage.naturalWidth > 0) {
            setupSecondFullpage();
        } else {
            secondImage.addEventListener("load", setupSecondFullpage, { once: true });
        }
    }, 900);
}

function setupSecondFullpage() {
    const rect = secondCanvas.getBoundingClientRect();
    const cw = Math.round(rect.width);
    const ch = Math.round(rect.height);

    secondCanvas.width = cw;
    secondCanvas.height = ch;

    const ctx = secondCtx;

    // ── Draw cosmic scratch overlay ──
    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, "#0f1025");
    grad.addColorStop(0.4, "#141833");
    grad.addColorStop(0.7, "#10163a");
    grad.addColorStop(1, "#0b0e22");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Subtle radial highlight
    const rGrad = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw * 0.6);
    rGrad.addColorStop(0, "rgba(80,70,150,0.15)");
    rGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rGrad;
    ctx.fillRect(0, 0, cw, ch);

    // Sparkle dots scattered across the overlay
    for (let i = 0; i < 160; i++) {
        ctx.beginPath();
        ctx.arc(rand(0, cw), rand(0, ch), rand(0.3, 2.2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${rand(0.05, 0.35)})`;
        ctx.fill();
    }

    // ── Scratch interaction ──
    let hintVisible = true;
    let scratching = false;
    let lastCheck = 0;

    function getPos(e) {
        const r = secondCanvas.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (cx - r.left) * (secondCanvas.width / r.width),
            y: (cy - r.top) * (secondCanvas.height / r.height),
        };
    }

    function doScratch(pos) {
        if (hintVisible) {
            hintVisible = false;
            secondHint.classList.add("hidden");
        }

        ctx.globalCompositeOperation = "destination-out";

        const rg = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, CONFIG.brushSize);
        rg.addColorStop(0, "rgba(0,0,0,1)");
        rg.addColorStop(0.6, "rgba(0,0,0,0.8)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, CONFIG.brushSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = "source-over";

        const now = performance.now();
        if (now - lastCheck > 400) {
            lastCheck = now;
            checkSecondProgress();
        }
    }

    // Mouse
    secondCanvas.addEventListener("mousedown", (e) => { scratching = true; doScratch(getPos(e)); });
    secondCanvas.addEventListener("mousemove", (e) => { if (scratching) doScratch(getPos(e)); });
    secondCanvas.addEventListener("mouseup", () => { scratching = false; });
    secondCanvas.addEventListener("mouseleave", () => { scratching = false; });

    // Touch
    secondCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); scratching = true; doScratch(getPos(e)); });
    secondCanvas.addEventListener("touchmove", (e) => { e.preventDefault(); if (scratching) doScratch(getPos(e)); });
    secondCanvas.addEventListener("touchend", () => { scratching = false; });
}

function checkSecondProgress() {
    const w = secondCanvas.width, h = secondCanvas.height;
    const data = secondCtx.getImageData(0, 0, w, h).data;
    let transparent = 0;
    const total = data.length / 4;
    for (let i = 3; i < data.length; i += 16) {
        if (data[i] === 0) transparent++;
    }
    const sampled = Math.ceil(total / 4);
    const pct = (transparent / sampled) * 100;

    if (pct >= CONFIG.revealThreshold && document.getElementById("second-scratch").classList.contains("visible")) {
        completeSecondReveal();
    }
}

function completeSecondReveal() {
    secondCanvas.style.transition = "opacity 1s ease";
    secondCanvas.style.opacity = "0";
    secondHint.classList.add("hidden");

    // After 5 seconds of appreciating the second image, dismiss it and slot it below the first.
    setTimeout(() => {
        secondScratch.style.transition = "opacity 1s ease";
        secondScratch.style.opacity = "0";

        setTimeout(() => {
            secondScratch.style.display = "none";
            secondSmallImageContainer.classList.add("visible");
            spawnConfetti();

            // After 10s of arriving next to first image, trigger the final Easter Egg
            setTimeout(showEasterEgg, 10000);
        }, 1000);
    }, 5000);
}

// ═════════════════════════════════════════════
//  🎁  EASTER EGG POPUP
// ═════════════════════════════════════════════
function showEasterEgg() {
    const popup = document.getElementById("easter-egg-popup");
    const container = document.getElementById("easter-egg-text");
    const img = document.getElementById("easter-egg-image");

    // User's exact text
    const eggText = "me koi birthday calendar/reminder wagera maintain nhi karta but pta nhi tera birthday kese 1-2 din pehle yaad aa hi jata h, isliye college ke har year kisi ka birthday yaad aya ho ya nhi but tera har baar yaad ajata h isliye, Happy birthday ab dekhte h next birthday yaad ata h ya nhi job / non college tym me";

    // Split text into words and wrap in spans
    const words = eggText.split(" ");
    container.innerHTML = "";
    words.forEach(w => {
        const span = document.createElement("span");
        span.textContent = w + " ";
        container.appendChild(span);
    });

    popup.classList.add("visible");
    const spans = container.querySelectorAll("span");
    let wordIndex = 0;

    // Give time (1s) for popup to fade in before we start tying the text
    setTimeout(() => {
        const printInterval = setInterval(() => {
            if (wordIndex < spans.length) {
                spans[wordIndex].style.opacity = "1";
                wordIndex++;
            } else {
                // Done printing text
                clearInterval(printInterval);

                // Start displaying the image
                setTimeout(() => {
                    img.style.opacity = "1";

                    // Box disappears 7 seconds after image is displayed
                    setTimeout(() => {
                        popup.classList.remove("visible");
                    }, 7000);
                }, 600); // small delay after text finishes
            }
        }, 250); // 250ms speed per word
    }, 1000);
}

// ═════════════════════════════════════════════
//  🎉  CONFETTI
// ═════════════════════════════════════════════
function spawnConfetti() {
    const rect = smallImageContainer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < 120; i++) {
        confetti.push({
            x: cx + rand(-rect.width / 2, rect.width / 2),
            y: cy + rand(-rect.height / 3, 0),
            vx: rand(-8, 8),
            vy: rand(-16, -3),
            size: rand(3, 8),
            hue: rand(0, 360),
            alpha: 1,
            gravity: rand(0.12, 0.28),
            drag: rand(0.975, 0.995),
            spin: rand(-8, 8),
            angle: rand(0, 360),
        });
    }
}

function drawConfetti(ctx) {
    for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.x += c.vx;
        c.y += c.vy;
        c.vy += c.gravity;
        c.vx *= c.drag;
        c.alpha -= 0.006;
        c.angle += c.spin;

        if (c.alpha <= 0) { confetti.splice(i, 1); continue; }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle * Math.PI / 180);
        ctx.fillStyle = `hsla(${c.hue},85%,62%,${c.alpha})`;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.55);
        ctx.restore();
    }
}

// ═════════════════════════════════════════════
//  🎵  AUDIO CONTROLLER
// ═════════════════════════════════════════════
function startMusic() {
    if (musicStarted) return;
    bgMusic.volume = 0.5;

    // User already tapped the entry overlay, so autoplay should be unlocked
    bgMusic.play().then(() => {
        musicStarted = true;
    }).catch(() => {
        // Edge-case fallback: retry on any interaction
        const tryPlay = () => {
            if (musicStarted) return;
            bgMusic.play().then(() => {
                musicStarted = true;
                ["click", "touchstart", "mousemove"].forEach(e =>
                    document.removeEventListener(e, tryPlay));
            }).catch(() => { });
        };
        ["click", "touchstart", "mousemove"].forEach(e =>
            document.addEventListener(e, tryPlay));
    });
}

// ═════════════════════════════════════════════
//  🎬  MAIN RENDER LOOP
// ═════════════════════════════════════════════
function animate(time) {
    const ctx = starfieldCtx;
    const w = starfieldCanvas.width;
    const h = starfieldCanvas.height;

    // ── Background ──
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.85);
    bg.addColorStop(0, "#080518");
    bg.addColorStop(0.5, "#050310");
    bg.addColorStop(1, "#000000");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ── Stars ──
    drawStaticStars(time);
    updateShootingStars(ctx);

    // ── Delivery star ──
    if (deliveryStar) drawDeliveryStar(ctx);

    // ── Mouse trail ──
    drawMouseTrail(ctx);

    // ── Confetti ──
    if (confetti.length) drawConfetti(ctx);

    // ── Constellation ──
    drawConstellation(time);

    requestAnimationFrame(animate);
}

// ═════════════════════════════════════════════
//  🚀  INITIALISATION & TIMELINE
// ═════════════════════════════════════════════
function beginExperience() {
    if (experienceStarted) return;
    experienceStarted = true;

    // Fade out entry overlay
    entryOverlay.style.opacity = "0";
    setTimeout(() => { entryOverlay.style.display = "none"; }, 800);

    // Pre-load audio so it's ready when we need it
    bgMusic.load();

    // After the initial delay → music + constellation
    setTimeout(() => {
        document.title = "✨ Happy Birthday ✨";
        startMusic();
        generateConstellationPoints();
        constellationCanvas.classList.add("visible");
        phase = "constellation";
        constellationT0 = performance.now();
    }, CONFIG.initialDelay);
}

function init() {
    resizeFullscreenCanvases();

    // Start starfield immediately (visible through the entry overlay)
    requestAnimationFrame(animate);

    // Wait for user tap to begin the real experience
    entryOverlay.addEventListener("click", beginExperience);
    entryOverlay.addEventListener("touchstart", (e) => {
        e.preventDefault();
        beginExperience();
    });
}

document.addEventListener("DOMContentLoaded", init);
