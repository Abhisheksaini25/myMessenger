/**
 * ============================================================================
 * HAPPY PRIMARY BIRTHDAY - CINEMATIC INTERACTIVE CELEBRATION
 * ============================================================================
 * Architecture:
 * - Central Configuration & State Machine
 * - Audio & Autoplay Manager
 * - Starfield & Shooting Star Canvas Engine
 * - Physics-based Fireworks Engine
 * - 3D Tumbling Confetti Engine
 * - 3D Glossy Interactive Balloon System & Popping Mechanics
 * - Organic Candle Flame & Smoke Engine
 * - Gesture Trail & Uppercase 'A' Pattern Recognizer
 * - Local Memory Storage Manager (IndexedDB)
 * - Polaroid Crossfade Slideshow
 * - Easter Egg Concurrency & Celebration Queues
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
   1. Central Configuration
   ---------------------------------------------------------------------------- */
const OpusBirthdayConstants = {
    // Word reveal sequence
    BIRTHDAY_WORDS: ["Happy", "Primary", "Birthday"],
    WORD_REVEAL_DELAY: 1200,      // ms between each word reveal
    POST_WORDS_PAUSE: 1400,       // ms pause before transitioning to cake

    // Slideshow
    SLIDESHOW_INTERVAL: 3000,     // 3 seconds per photo

    // Easter Egg Milestones
    BALLOON_EASTER_EGG_COUNT: 22, // Pop exactly 22 balloons
    TIME_EASTER_EGG_DELAY: 12000, // 12 seconds after carousel appears

    // Gesture Trail
    GESTURE_TRAIL_LIFETIME: 1500, // 1.5 seconds fading trail

    // Easter Egg Messages (Easily configurable)
    EASTER_EGG_1_TITLE: "Some Balloons Popped",
    EASTER_EGG_1_MESSAGE: "it feels nice to have a friend like you, to whom i think i can call whenever some thing might feel off or i need some clarity",

    EASTER_EGG_2_TITLE: "Waited for sometime",
    EASTER_EGG_2_MESSAGE: "Happy Birthday once again, Hope you have an amazing year ahead",

    EASTER_EGG_3_TITLE: "HIDDEN PATH FOUND!",
    EASTER_EGG_3_MESSAGE: "Why make 'A' to discover a hidden path! The 'A' Star Constellation 🌟",

    BALLOON_EASTER_EGG_32_COUNT: 32,
    EASTER_EGG_32_TITLE: "Some more Balloons Popped",
    EASTER_EGG_32_MESSAGE: "Somehow I ended up with just these two weirdly complementing images in a random folder. Should I switch their order or its nice this way?",
    EASTER_EGG_32_IMAGE: "easterimg.png",

    // Fireworks Timing (increased frequency)
    FIREWORK_MIN_DELAY: 700,      // ms
    FIREWORK_MAX_DELAY: 2200,     // ms

    // Balloons Density
    BALLOON_TARGET_COUNT: 15,

    // Media Asset Paths with Fallbacks (Supabase root /aku26/ with assets/ fallback)
    BUILT_IN_MEMORIES: [
        "memory-01.jpg",
        "memory-02.png",
        "assets/memory-01.jpg",
        "assets/memory-02.png"
    ],
    FALLBACK_MEMORIES: [
        "assets/image_1.jpeg",
        "assets/image_2.jpeg",
        "assets/birthday_photo.jpg"
    ],
    AUDIO_ASSETS: {
        bg: "bg.mp3",
        pop: "pop.mp3",
        reveal: "reveal.mp3",
        burst: "burst.mp3",
        celebration: "celebration.mp3",
        eightteen: "eightteen.mp3",
        nineteen: "nineteen.mp3"
    },

    // Chat & Memos API Configuration for Aku
    CHAT_CONFIG: {
        userId: "aku",
        apiKey: "apk-key-aku-209"
    },

    // Coordinated Blue Color Palette
    COLORS: {
        navyDeep: "#020617",
        navyMidnight: "#060e24",
        blueSpace: "#0a1936",
        blueRoyal: "#1d4ed8",
        blueElectric: "#2563eb",
        blueVivid: "#3b82f6",
        blueGlow: "#60a5fa",
        cyanElectric: "#06b6d4",
        cyanNeon: "#38bdf8",
        skyLight: "#7dd3fc",
        white: "#ffffff",
        silver: "#e2e8f0"
    }
};

/* ----------------------------------------------------------------------------
   2. Central State Machine
   ---------------------------------------------------------------------------- */
const BirthdayStage = {
    INTRO: "intro",
    TEXT_REVEAL: "text-reveal",
    CAKE: "cake",
    CAROUSEL: "carousel"
};

const birthdayState = {
    stage: BirthdayStage.INTRO,
    balloonPopCount: 0,
    easterEgg22Triggered: false,
    easterEgg12Triggered: false,
    easterEggATriggered: false,
    easterEgg32Triggered: false,
    currentImageIndex: 0,
    carouselStarted: false,
    candleExtinguished: false,
    musicEnabled: true,
    audioUnlocked: false,
    builtInLoadedImages: [],
    userMemoryBlobs: [],
    combinedMemories: [],
    modalQueue: []
};

/* ----------------------------------------------------------------------------
   3. Audio Engine & Autoplay Handler
   ---------------------------------------------------------------------------- */
class AudioEngine {
    constructor() {
        this.bgAudio = document.getElementById("bg-audio");
        this.toggleBtn = document.getElementById("music-toggle-btn");
        this.iconEl = document.getElementById("music-icon");
        this.textEl = document.getElementById("music-text");

        this.sfxPool = {};
        this.lastSfxTime = {};
        this.audioContext = null;

        this.init();
    }

    init() {
        // Fallback for background audio source
        if (this.bgAudio) {
            this.bgAudio.addEventListener("error", () => {
                const srcEl = this.bgAudio.querySelector("source");
                if (srcEl && !srcEl.src.includes("assets/")) {
                    srcEl.src = "assets/bg.mp3";
                    this.bgAudio.load();
                }
            }, { once: true });
        }

        // Pre-instantiate SFX audio elements with fallback
        for (const [key, path] of Object.entries(OpusBirthdayConstants.AUDIO_ASSETS)) {
            if (key !== "bg") {
                this.sfxPool[key] = [];
                for (let i = 0; i < 4; i++) {
                    const audio = new Audio(path);
                    audio.preload = "auto";
                    audio.addEventListener("error", function fallbackAudio() {
                        this.removeEventListener("error", fallbackAudio);
                        if (!this.src.includes("assets/")) {
                            this.src = "assets/" + path;
                        }
                    }, { once: true });
                    this.sfxPool[key].push(audio);
                }
            }
        }

        // Toggle button listener
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleMusic();
            });
        }

        // Passive user interaction unlock
        const unlockHandler = () => {
            this.unlockAudio();
            window.removeEventListener("pointerdown", unlockHandler);
            window.removeEventListener("keydown", unlockHandler);
            window.removeEventListener("touchstart", unlockHandler);
        };
        window.addEventListener("pointerdown", unlockHandler, { once: true });
        window.addEventListener("keydown", unlockHandler, { once: true });
        window.addEventListener("touchstart", unlockHandler, { once: true });
    }

    unlockAudio() {
        if (birthdayState.audioUnlocked) return;
        birthdayState.audioUnlocked = true;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext && !this.audioContext) {
                this.audioContext = new AudioContext();
                if (this.audioContext.state === "suspended") {
                    this.audioContext.resume();
                }
            }
        } catch (e) {
            // Web Audio not essential
        }

        if (birthdayState.musicEnabled && this.bgAudio) {
            this.bgAudio.volume = 0.55;
            this.bgAudio.play().then(() => {
                this.updateUI(true);
            }).catch(() => { });
        }
    }

    toggleMusic() {
        birthdayState.musicEnabled = !birthdayState.musicEnabled;
        if (birthdayState.musicEnabled) {
            this.bgAudio.play().catch(() => { });
            this.updateUI(true);
        } else {
            this.bgAudio.pause();
            this.updateUI(false);
        }
    }

    updateUI(isPlaying) {
        if (this.iconEl) this.iconEl.textContent = isPlaying ? "🔊" : "🔇";
        if (this.textEl) this.textEl.textContent = isPlaying ? "Music ON" : "Music OFF";
    }

    playSfx(key, volume = 0.6) {
        if (!birthdayState.musicEnabled) return;
        const now = Date.now();
        if (key !== "eightteen" && key !== "nineteen" && this.lastSfxTime[key] && now - this.lastSfxTime[key] < 80) return; // Throttle bursts
        this.lastSfxTime[key] = now;

        const pool = this.sfxPool[key];
        if (pool && pool.length > 0) {
            // Find available audio element or take oldest
            const audio = pool.find(a => a.paused || a.ended) || pool[0];
            audio.volume = volume;
            audio.currentTime = 0;
            audio.play().catch(() => { });

            // If voice clip, temporarily dip bg music volume so voice is crystal clear
            if ((key === "eightteen" || key === "nineteen") && this.bgAudio && birthdayState.musicEnabled) {
                const prevVol = this.bgAudio.volume;
                this.bgAudio.volume = 0.15;
                const restoreVol = () => {
                    if (this.bgAudio) this.bgAudio.volume = prevVol;
                    audio.removeEventListener("ended", restoreVol);
                };
                audio.addEventListener("ended", restoreVol);
                setTimeout(restoreVol, key === "eightteen" ? 2600 : 1600);
            }
        }
    }
}

/* ----------------------------------------------------------------------------
   4. Starfield & Shooting Stars Engine (Canvas)
   ---------------------------------------------------------------------------- */
class StarfieldEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.stars = [];
        this.shootingStars = [];
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.nextShootingStarTime = Date.now() + 1000;

        this.resize();
        this.initStars(280);
        window.addEventListener("resize", () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initStars(count) {
        this.stars = [];
        const colors = ["#ffffff", "#e2e8f0", "#7dd3fc", "#38bdf8", "#bae6fd"];
        for (let i = 0; i < count; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: Math.random() * 1.6 + 0.5,
                color: colors[Math.floor(Math.random() * colors.length)],
                baseAlpha: Math.random() * 0.5 + 0.3,
                twinkleSpeed: Math.random() * 0.03 + 0.01,
                twinklePhase: Math.random() * Math.PI * 2,
                driftY: Math.random() * 0.08 + 0.02
            });
        }
    }

    spawnShootingStar() {
        const createStar = () => {
            const startX = Math.random() * this.width * 0.85;
            const startY = Math.random() * this.height * 0.35;
            const angle = (Math.random() * 22 + 28) * (Math.PI / 180);
            const speed = Math.random() * 14 + 11;
            const length = Math.random() * 90 + 90;

            this.shootingStars.push({
                x: startX,
                y: startY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                length: length,
                alpha: 1,
                life: 1,
                decay: Math.random() * 0.016 + 0.012
            });
        };

        createStar();
        // 35% chance to spawn a twin shooting star across the sky
        if (Math.random() < 0.35) {
            setTimeout(createStar, Math.random() * 200 + 100);
        }

        this.nextShootingStarTime = Date.now() + Math.random() * 2000 + 1200;
    }

    render(time) {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw Normal Stars
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            star.twinklePhase += star.twinkleSpeed;
            const alpha = star.baseAlpha + Math.sin(star.twinklePhase) * 0.3;
            star.y -= star.driftY;
            if (star.y < 0) star.y = this.height;

            this.ctx.fillStyle = star.color;
            this.ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Spawn shooting stars periodically
        if (Date.now() > this.nextShootingStarTime) {
            this.spawnShootingStar();
        }

        // Draw Shooting Stars
        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
            const ss = this.shootingStars[i];
            ss.x += ss.vx;
            ss.y += ss.vy;
            ss.life -= ss.decay;
            ss.alpha = Math.max(0, ss.life);

            if (ss.life <= 0) {
                this.shootingStars.splice(i, 1);
                continue;
            }

            const tailX = ss.x - (ss.vx / Math.hypot(ss.vx, ss.vy)) * ss.length;
            const tailY = ss.y - (ss.vy / Math.hypot(ss.vx, ss.vy)) * ss.length;

            const grad = this.ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
            grad.addColorStop(0, `rgba(255, 255, 255, ${ss.alpha})`);
            grad.addColorStop(0.3, `rgba(56, 189, 248, ${ss.alpha * 0.8})`);
            grad.addColorStop(1, "rgba(37, 99, 235, 0)");

            this.ctx.strokeStyle = grad;
            this.ctx.lineWidth = 2.2;
            this.ctx.globalAlpha = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(tailX, tailY);
            this.ctx.lineTo(ss.x, ss.y);
            this.ctx.stroke();

            // Glowing head
            this.ctx.fillStyle = `rgba(255, 255, 255, ${ss.alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(ss.x, ss.y, 2.5, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1;
    }
}

/* ----------------------------------------------------------------------------
   5. Fireworks Engine (Canvas)
   ---------------------------------------------------------------------------- */
class FireworksEngine {
    constructor(canvasId, audioEngine) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.audio = audioEngine;
        this.rockets = [];
        this.particles = [];
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.nextFireworkTime = Date.now() + 1500;
        this.resize();
        window.addEventListener("resize", () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    launchRocket(startX, targetX, targetY, colorType = "blue") {
        const x = startX || Math.random() * (this.width * 0.7) + this.width * 0.15;
        const ty = targetY || Math.random() * (this.height * 0.45) + this.height * 0.12;
        const tx = targetX || x + (Math.random() - 0.5) * 80;

        const distanceY = ty - this.height;
        const speed = Math.sqrt(2 * 0.22 * Math.abs(distanceY));
        const duration = speed / 0.22;
        const vx = (tx - x) / duration;

        this.rockets.push({
            x: x,
            y: this.height,
            vx: vx,
            vy: -speed,
            gravity: 0.22,
            targetY: ty,
            colorType: colorType,
            trail: []
        });

        this.audio.playSfx("reveal", 0.25);
    }

    explode(x, y, colorType = "blue") {
        const shapes = ["SPHERE", "RING", "STARBURST", "DOUBLE", "CASCADE"];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const particleCount = Math.floor(Math.random() * 50 + 90);

        const bluePalettes = [
            ["#38bdf8", "#0284c7", "#ffffff", "#bae6fd"],
            ["#2563eb", "#60a5fa", "#ffffff", "#06b6d4"],
            ["#00d2ff", "#3a7bd5", "#ffffff", "#e2e8f0"],
            ["#7dd3fc", "#38bdf8", "#ffffff", "#93c5fd"]
        ];
        const colors = bluePalettes[Math.floor(Math.random() * bluePalettes.length)];

        this.audio.playSfx("burst", 0.45);

        for (let i = 0; i < particleCount; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 7 + 1.8;
            let gravity = 0.08;
            let drag = 0.96;
            let life = 1;
            let decay = Math.random() * 0.018 + 0.01;

            if (shape === "RING") {
                speed = 4.5 + Math.random() * 0.5;
            } else if (shape === "CASCADE") {
                gravity = 0.14;
                drag = 0.975;
                decay = 0.009;
            } else if (shape === "STARBURST") {
                const arms = 6;
                const armAngle = (Math.floor(Math.random() * arms) * (Math.PI * 2)) / arms;
                angle = armAngle + (Math.random() - 0.5) * 0.25;
            }

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: gravity,
                drag: drag,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                life: life,
                decay: decay,
                size: Math.random() * 2.8 + 1.2,
                trail: []
            });
        }

        if (shape === "DOUBLE") {
            setTimeout(() => {
                if (this.particles) {
                    for (let j = 0; j < 35; j++) {
                        const a = Math.random() * Math.PI * 2;
                        const s = Math.random() * 4.5 + 1;
                        this.particles.push({
                            x: x + (Math.random() - 0.5) * 20,
                            y: y + (Math.random() - 0.5) * 20,
                            vx: Math.cos(a) * s,
                            vy: Math.sin(a) * s,
                            gravity: 0.06,
                            drag: 0.95,
                            color: "#ffffff",
                            alpha: 1,
                            life: 0.8,
                            decay: 0.02,
                            size: 2,
                            trail: []
                        });
                    }
                }
            }, 250);
        }
    }

    launchCelebrationBurst(count = 6) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const x = Math.random() * (this.width * 0.8) + this.width * 0.1;
                const y = Math.random() * (this.height * 0.45) + this.height * 0.1;
                this.launchRocket(x, x + (Math.random() - 0.5) * 100, y);
            }, i * 220);
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Ambient random firework scheduler (increased frequency + dual launches)
        if (Date.now() > this.nextFireworkTime) {
            this.launchRocket();
            if (Math.random() < 0.40) {
                setTimeout(() => {
                    this.launchRocket();
                }, Math.random() * 200 + 100);
            }
            const delay = Math.random() *
                (OpusBirthdayConstants.FIREWORK_MAX_DELAY - OpusBirthdayConstants.FIREWORK_MIN_DELAY) +
                OpusBirthdayConstants.FIREWORK_MIN_DELAY;
            this.nextFireworkTime = Date.now() + delay;
        }

        // Update & Render Rockets
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const r = this.rockets[i];
            r.trail.push({ x: r.x, y: r.y });
            if (r.trail.length > 5) r.trail.shift();

            r.x += r.vx;
            r.y += r.vy;
            r.vy += r.gravity;

            // Rocket spark trail
            this.ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            for (let t = 0; t < r.trail.length; t++) {
                if (t === 0) this.ctx.moveTo(r.trail[t].x, r.trail[t].y);
                else this.ctx.lineTo(r.trail[t].x, r.trail[t].y);
            }
            this.ctx.stroke();

            // Rocket head
            this.ctx.fillStyle = "#ffffff";
            this.ctx.beginPath();
            this.ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
            this.ctx.fill();

            if (r.vy >= 0 || r.y <= r.targetY) {
                this.explode(r.x, r.y, r.colorType);
                this.rockets.splice(i, 1);
            }
        }

        // Update & Render Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.vy += p.gravity;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            p.alpha = Math.max(0, p.life);

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
    }
}

/* ----------------------------------------------------------------------------
   6. 3D Tumbling Confetti Engine (Canvas)
   ---------------------------------------------------------------------------- */
class ConfettiEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.particles = [];
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.colors = [
            "#2563eb", "#38bdf8", "#06b6d4", "#7dd3fc",
            "#ffffff", "#e2e8f0", "#1d4ed8", "#bae6fd"
        ];

        this.resize();
        this.seedAmbientConfetti(35);
        window.addEventListener("resize", () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    createParticle(x, y, isBurst = false) {
        const shapes = ["rect", "strip", "circle"];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];

        const vx = isBurst ? (Math.random() - 0.5) * 14 : (Math.random() - 0.5) * 2;
        const vy = isBurst ? -(Math.random() * 10 + 3) : Math.random() * 2 + 1.2;

        return {
            x: x !== undefined ? x : Math.random() * this.width,
            y: y !== undefined ? y : -20,
            vx: vx,
            vy: vy,
            gravity: 0.12,
            drag: isBurst ? 0.94 : 0.99,
            shape: shape,
            size: Math.random() * 8 + 6,
            color: color,
            rotationX: Math.random() * Math.PI * 2,
            rotationY: Math.random() * Math.PI * 2,
            rotSpeedX: (Math.random() - 0.5) * 0.08,
            rotSpeedY: (Math.random() - 0.5) * 0.08,
            swayPhase: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.04 + 0.02,
            alpha: 1,
            isAmbient: !isBurst
        };
    }

    seedAmbientConfetti(count) {
        for (let i = 0; i < count; i++) {
            const p = this.createParticle(Math.random() * this.width, Math.random() * this.height, false);
            this.particles.push(p);
        }
    }

    burst(x, y, count = 120) {
        const posX = x !== undefined ? x : this.width * 0.5;
        const posY = y !== undefined ? y : this.height * 0.45;
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle(posX, posY, true));
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Maintain ambient count
        const ambientCount = this.particles.filter(p => p.isAmbient).length;
        if (ambientCount < 30) {
            this.particles.push(this.createParticle(undefined, undefined, false));
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            p.vx *= p.drag;
            p.vy += p.gravity;
            p.x += p.vx + Math.sin(p.swayPhase) * 0.6;
            p.y += p.vy;

            p.swayPhase += p.swaySpeed;
            p.rotationX += p.rotSpeedX;
            p.rotationY += p.rotSpeedY;

            if (!p.isAmbient) {
                p.alpha -= 0.005;
                if (p.alpha <= 0 || p.y > this.height + 30) {
                    this.particles.splice(i, 1);
                    continue;
                }
            } else {
                if (p.y > this.height + 20) {
                    p.y = -15;
                    p.x = Math.random() * this.width;
                    p.vy = Math.random() * 2 + 1.2;
                }
            }

            // 3D perspective tumbling
            const scaleX = Math.cos(p.rotationX);
            const scaleY = Math.sin(p.rotationY);

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.scale(scaleX, scaleY);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

            if (p.shape === "rect") {
                this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
            } else if (p.shape === "strip") {
                this.ctx.fillRect(-p.size / 2, -p.size * 0.2, p.size * 1.5, p.size * 0.35);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        }
        this.ctx.globalAlpha = 1;
    }
}

/* ----------------------------------------------------------------------------
   7. 3D Glossy Interactive Balloons Engine (Canvas)
   ---------------------------------------------------------------------------- */
class BalloonEngine {
    constructor(canvasId, audioEngine, onEasterEgg22, onEasterEgg32) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.audio = audioEngine;
        this.onEasterEgg22 = onEasterEgg22;
        this.onEasterEgg32 = onEasterEgg32;
        this.balloons = [];
        this.popParticles = [];
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.isPoppingPaused = false;

        this.balloonPalettes = [
            { primary: "#2563eb", highlight: "#93c5fd", dark: "#1e3a8a" }, // Royal Blue
            { primary: "#0284c7", highlight: "#bae6fd", dark: "#0c4a6e" }, // Sky Blue
            { primary: "#06b6d4", highlight: "#cffafe", dark: "#164e63" }, // Cyan
            { primary: "#1d4ed8", highlight: "#bfdbfe", dark: "#172554" }, // Midnight Navy
            { primary: "#38bdf8", highlight: "#ffffff", dark: "#0369a1" }, // Electric Blue
            { primary: "#f8fafc", highlight: "#ffffff", dark: "#94a3b8" }  // Glossy Silver
        ];

        this.resize();
        this.seedBalloons(OpusBirthdayConstants.BALLOON_TARGET_COUNT);
        window.addEventListener("resize", () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    createBalloon(yPos) {
        const radius = Math.random() * 12 + 26; // 26 - 38px
        const palette = this.balloonPalettes[Math.floor(Math.random() * this.balloonPalettes.length)];
        const x = Math.random() * (this.width - radius * 4) + radius * 2;
        const y = yPos !== undefined ? yPos : this.height + radius * 3 + Math.random() * 200;

        return {
            id: Math.random().toString(36).substring(2, 9),
            x: x,
            baseX: x,
            y: y,
            radiusX: radius * 0.85,
            radiusY: radius * 1.15,
            vy: -(Math.random() * 0.9 + 0.9),
            swayAmplitude: Math.random() * 25 + 15,
            swaySpeed: Math.random() * 0.02 + 0.015,
            swayPhase: Math.random() * Math.PI * 2,
            palette: palette,
            stringLength: radius * 1.8,
            popping: false,
            scale: 1,
            alpha: 1
        };
    }

    seedBalloons(count) {
        for (let i = 0; i < count; i++) {
            const y = Math.random() * this.height;
            this.balloons.push(this.createBalloon(y));
        }
    }

    hitTest(px, py) {
        // Ignore taps during pause periods (e.g. 18th and 19th balloon audio)
        if (this.isPoppingPaused) return false;

        // Test from top-most balloon downwards
        for (let i = this.balloons.length - 1; i >= 0; i--) {
            const b = this.balloons[i];
            if (b.popping) continue;

            const dx = (px - b.x) / b.radiusX;
            const dy = (py - b.y) / b.radiusY;
            if (dx * dx + dy * dy <= 1.35) {
                this.pop(b, i);
                return true;
            }
        }
        return false;
    }

    pop(balloon, index) {
        balloon.popping = true;
        this.audio.playSfx("pop", 0.65);

        // Spawn pop particles (skin shards + sparkles)
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            this.popParticles.push({
                x: balloon.x,
                y: balloon.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: Math.random() > 0.3 ? balloon.palette.primary : "#ffffff",
                size: Math.random() * 3.5 + 1.5,
                alpha: 1,
                decay: Math.random() * 0.03 + 0.02,
                gravity: 0.15
            });
        }

        // Increment count
        birthdayState.balloonPopCount++;
        const currentPop = birthdayState.balloonPopCount;

        // 18th Balloon: play eightteen.mp3 and pause popping for 2 seconds
        if (currentPop === 18) {
            this.isPoppingPaused = true;
            this.audio.playSfx("eightteen", 0.95);
            setTimeout(() => {
                this.isPoppingPaused = false;
            }, 2000);
        }

        // 19th Balloon: play nineteen.mp3 and pause popping for 1 second
        if (currentPop === 19) {
            this.isPoppingPaused = true;
            this.audio.playSfx("nineteen", 0.95);
            setTimeout(() => {
                this.isPoppingPaused = false;
            }, 1000);
        }

        // Check Easter Egg #1 (exactly 22 balloons)
        if (currentPop === OpusBirthdayConstants.BALLOON_EASTER_EGG_COUNT &&
            !birthdayState.easterEgg22Triggered) {
            birthdayState.easterEgg22Triggered = true;
            if (typeof this.onEasterEgg22 === "function") {
                this.onEasterEgg22();
            }
        }

        // Check Easter Egg (exactly 32 balloons)
        if (currentPop === OpusBirthdayConstants.BALLOON_EASTER_EGG_32_COUNT &&
            !birthdayState.easterEgg32Triggered) {
            birthdayState.easterEgg32Triggered = true;
            if (typeof this.onEasterEgg32 === "function") {
                this.onEasterEgg32();
            }
        }

        // Remove and replace
        this.balloons.splice(index, 1);
        setTimeout(() => {
            if (this.balloons.length < OpusBirthdayConstants.BALLOON_TARGET_COUNT) {
                this.balloons.push(this.createBalloon());
            }
        }, Math.random() * 800 + 400);
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Render Balloons
        for (let i = this.balloons.length - 1; i >= 0; i--) {
            const b = this.balloons[i];

            b.swayPhase += b.swaySpeed;
            b.x = b.baseX + Math.sin(b.swayPhase) * b.swayAmplitude;
            b.y += b.vy;

            // Recycle balloon when it floats off screen top
            if (b.y < -b.radiusY * 3) {
                this.balloons[i] = this.createBalloon();
                continue;
            }

            const tilt = Math.cos(b.swayPhase) * 0.12;

            this.ctx.save();
            this.ctx.translate(b.x, b.y);
            this.ctx.rotate(tilt);

            // 1. Balloon String (curved wavy line)
            this.ctx.beginPath();
            this.ctx.moveTo(0, b.radiusY);
            const stringWiggle = Math.sin(b.swayPhase * 1.5) * 8;
            this.ctx.quadraticCurveTo(stringWiggle, b.radiusY + b.stringLength * 0.5, 0, b.radiusY + b.stringLength);
            this.ctx.strokeStyle = "rgba(226, 232, 240, 0.65)";
            this.ctx.lineWidth = 1.2;
            this.ctx.stroke();

            // 2. Balloon Knot (Triangle)
            this.ctx.beginPath();
            this.ctx.moveTo(-4, b.radiusY + 4);
            this.ctx.lineTo(4, b.radiusY + 4);
            this.ctx.lineTo(0, b.radiusY - 1);
            this.ctx.closePath();
            this.ctx.fillStyle = b.palette.dark;
            this.ctx.fill();

            // 3. 3D Glossy Balloon Body (Radial Gradient)
            this.ctx.beginPath();
            this.ctx.ellipse(0, 0, b.radiusX, b.radiusY, 0, 0, Math.PI * 2);

            const grad = this.ctx.createRadialGradient(
                -b.radiusX * 0.3, -b.radiusY * 0.35, b.radiusX * 0.1,
                0, 0, b.radiusY
            );
            grad.addColorStop(0, b.palette.highlight);
            grad.addColorStop(0.35, b.palette.primary);
            grad.addColorStop(0.85, b.palette.dark);
            grad.addColorStop(1, "#030712");

            this.ctx.fillStyle = grad;
            this.ctx.shadowBlur = 14;
            this.ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // 4. Specular White Highlight
            this.ctx.beginPath();
            this.ctx.ellipse(-b.radiusX * 0.38, -b.radiusY * 0.4, b.radiusX * 0.28, b.radiusY * 0.18, -0.3, 0, Math.PI * 2);
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
            this.ctx.fill();

            this.ctx.restore();
        }

        // Render Pop Particles
        for (let i = this.popParticles.length - 1; i >= 0; i--) {
            const p = this.popParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                this.popParticles.splice(i, 1);
                continue;
            }

            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
    }
}

/* ----------------------------------------------------------------------------
   8. Organic Candle Flame & Smoke Engine (Canvas)
   ---------------------------------------------------------------------------- */
class CandleFlameEngine {
    constructor(canvasId, audioEngine) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.audio = audioEngine;
        this.isLit = true;
        this.smokeParticles = [];
        this.flickerPhase = 0;

        this.canvas.width = 120;
        this.canvas.height = 160;
    }

    extinguish() {
        if (!this.isLit) return;
        this.isLit = false;
        this.audio.playSfx("burst", 0.5);

        // Spawn realistic rising smoke particles (scaled for cake)
        for (let i = 0; i < 26; i++) {
            this.smokeParticles.push({
                x: 60 + (Math.random() - 0.5) * 5,
                y: 130,
                vx: (Math.random() - 0.5) * 1.2,
                vy: -(Math.random() * 1.6 + 1.0),
                radius: Math.random() * 3 + 2,
                maxRadius: Math.random() * 17 + 12,
                alpha: 0.68,
                decay: Math.random() * 0.012 + 0.008,
                swaySpeed: Math.random() * 0.05 + 0.02,
                swayPhase: Math.random() * Math.PI * 2
            });
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.isLit) {
            this.flickerPhase += 0.14;
            const wobbleX = Math.sin(this.flickerPhase) * 2.2;
            const wobbleY = Math.cos(this.flickerPhase * 1.3) * 2.5;
            const baseFlameHeight = 38 + wobbleY;
            const baseFlameWidth = 15 + Math.sin(this.flickerPhase * 1.8) * 1.4;

            const centerX = 60;
            const baseY = 138;

            // 1. Soft Outer Atmospheric Glow Halo
            this.ctx.save();
            const haloGrad = this.ctx.createRadialGradient(centerX, baseY - 20, 5, centerX, baseY - 20, 55);
            haloGrad.addColorStop(0, "rgba(56, 189, 248, 0.45)");
            haloGrad.addColorStop(0.5, "rgba(37, 99, 235, 0.2)");
            haloGrad.addColorStop(1, "rgba(2, 6, 23, 0)");
            this.ctx.fillStyle = haloGrad;
            this.ctx.beginPath();
            this.ctx.arc(centerX, baseY - 20, 55, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            // 2. Outer Blue/Cyan Flame Body
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - baseFlameWidth * 0.5, baseY);
            this.ctx.quadraticCurveTo(
                centerX - baseFlameWidth * 0.85, baseY - baseFlameHeight * 0.5,
                centerX + wobbleX, baseY - baseFlameHeight
            );
            this.ctx.quadraticCurveTo(
                centerX + baseFlameWidth * 0.85, baseY - baseFlameHeight * 0.5,
                centerX + baseFlameWidth * 0.5, baseY
            );
            this.ctx.closePath();

            const outerGrad = this.ctx.createLinearGradient(centerX, baseY, centerX, baseY - baseFlameHeight);
            outerGrad.addColorStop(0, "#1d4ed8");
            outerGrad.addColorStop(0.3, "#06b6d4");
            outerGrad.addColorStop(0.7, "#38bdf8");
            outerGrad.addColorStop(1, "#ffffff");

            this.ctx.fillStyle = outerGrad;
            this.ctx.shadowBlur = 22;
            this.ctx.shadowColor = "#38bdf8";
            this.ctx.fill();

            // 3. Inner White-Hot Golden/White Core
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - baseFlameWidth * 0.25, baseY);
            this.ctx.quadraticCurveTo(
                centerX - baseFlameWidth * 0.35, baseY - baseFlameHeight * 0.4,
                centerX + wobbleX * 0.5, baseY - baseFlameHeight * 0.75
            );
            this.ctx.quadraticCurveTo(
                centerX + baseFlameWidth * 0.35, baseY - baseFlameHeight * 0.4,
                centerX + baseFlameWidth * 0.25, baseY
            );
            this.ctx.closePath();

            const innerGrad = this.ctx.createLinearGradient(centerX, baseY, centerX, baseY - baseFlameHeight * 0.75);
            innerGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
            innerGrad.addColorStop(0.5, "rgba(186, 230, 253, 0.9)");
            innerGrad.addColorStop(1, "rgba(255, 255, 255, 0.98)");

            this.ctx.fillStyle = innerGrad;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = "#ffffff";
            this.ctx.fill();

            this.ctx.restore();
        } else {
            // Render Rising Smoke
            for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
                const s = this.smokeParticles[i];
                s.swayPhase += s.swaySpeed;
                s.x += s.vx + Math.sin(s.swayPhase) * 0.8;
                s.y += s.vy;
                s.radius += (s.maxRadius - s.radius) * 0.035;
                s.alpha -= s.decay;

                if (s.alpha <= 0) {
                    this.smokeParticles.splice(i, 1);
                    continue;
                }

                const grad = this.ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
                grad.addColorStop(0, `rgba(148, 163, 184, ${s.alpha * 0.6})`);
                grad.addColorStop(0.6, `rgba(100, 116, 139, ${s.alpha * 0.35})`);
                grad.addColorStop(1, "rgba(15, 23, 42, 0)");

                this.ctx.fillStyle = grad;
                this.ctx.beginPath();
                this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }
}

/* ----------------------------------------------------------------------------
   9. Gesture Trail & Uppercase 'A' Gesture Recognizer (Canvas)
   ---------------------------------------------------------------------------- */
class GestureEngine {
    constructor(canvasId, onRecognizeA) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        this.onRecognizeA = onRecognizeA;
        this.trailPoints = [];
        this.strokePoints = [];
        this.isPointerDown = false;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.resize();
        this.bindEvents();
        window.addEventListener("resize", () => this.resize());
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    bindEvents() {
        window.addEventListener("pointerdown", (e) => {
            this.isPointerDown = true;
            this.strokePoints = [{ x: e.clientX, y: e.clientY, time: Date.now() }];
            this.addTrailPoint(e.clientX, e.clientY);
        });

        window.addEventListener("pointermove", (e) => {
            this.addTrailPoint(e.clientX, e.clientY);
            if (this.isPointerDown) {
                this.strokePoints.push({ x: e.clientX, y: e.clientY, time: Date.now() });
            }
        });

        window.addEventListener("pointerup", () => {
            if (this.isPointerDown) {
                this.isPointerDown = false;
                this.evaluateStroke();
            }
        });
    }

    addTrailPoint(x, y) {
        this.trailPoints.push({
            x: x,
            y: y,
            time: Date.now(),
            size: Math.random() * 3 + 4
        });
    }

    evaluateStroke() {
        if (birthdayState.stage !== BirthdayStage.CAROUSEL || birthdayState.easterEggATriggered) return;
        if (this.strokePoints.length < 15) return;

        // Bounding box
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const pt of this.strokePoints) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        }

        const width = maxX - minX;
        const height = maxY - minY;

        // An 'A' should have reasonable size and aspect ratio
        if (width < 45 || height < 55 || width / height < 0.35 || width / height > 1.8) return;

        // Geometry characteristics of 'A':
        // Top 25% is narrow (apex)
        // Bottom 25% is wide (left and right legs)
        // Middle 40-70% has crossbar points
        const topPts = this.strokePoints.filter(p => p.y < minY + height * 0.28);
        const bottomPts = this.strokePoints.filter(p => p.y > maxY - height * 0.28);
        const midPts = this.strokePoints.filter(p => p.y >= minY + height * 0.35 && p.y <= minY + height * 0.65);

        if (topPts.length > 0 && bottomPts.length >= 4 && midPts.length >= 3) {
            let bMinX = Infinity, bMaxX = -Infinity;
            for (const p of bottomPts) {
                if (p.x < bMinX) bMinX = p.x;
                if (p.x > bMaxX) bMaxX = p.x;
            }
            const bottomSpread = bMaxX - bMinX;

            let tMinX = Infinity, tMaxX = -Infinity;
            for (const p of topPts) {
                if (p.x < tMinX) tMinX = p.x;
                if (p.x > tMaxX) tMaxX = p.x;
            }
            const topSpread = tMaxX - tMinX;

            // Apex is substantially narrower than bottom spread
            if (topSpread < bottomSpread * 0.7 && bottomSpread > width * 0.5) {
                birthdayState.easterEggATriggered = true;
                if (typeof this.onRecognizeA === "function") {
                    this.onRecognizeA();
                }
            }
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        const now = Date.now();
        const lifetime = OpusBirthdayConstants.GESTURE_TRAIL_LIFETIME;

        // Filter expired
        this.trailPoints = this.trailPoints.filter(p => now - p.time < lifetime);

        if (this.trailPoints.length < 2) return;

        for (let i = 1; i < this.trailPoints.length; i++) {
            const p0 = this.trailPoints[i - 1];
            const p1 = this.trailPoints[i];
            const age = now - p1.time;
            const alpha = 1 - age / lifetime;

            this.ctx.save();
            this.ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.85})`;
            this.ctx.lineWidth = Math.max(1, p1.size * alpha);
            this.ctx.lineCap = "round";
            this.ctx.shadowBlur = 12 * alpha;
            this.ctx.shadowColor = "#38bdf8";

            this.ctx.beginPath();
            this.ctx.moveTo(p0.x, p0.y);
            this.ctx.lineTo(p1.x, p1.y);
            this.ctx.stroke();

            // Core bright white dot
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            this.ctx.beginPath();
            this.ctx.arc(p1.x, p1.y, Math.max(0.5, p1.size * 0.35 * alpha), 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        }
    }
}

/* ----------------------------------------------------------------------------
   10. Local Memory Storage Manager (IndexedDB)
   ---------------------------------------------------------------------------- */
class OpusMemoryStorageManager {
    constructor() {
        this.dbName = "OpusBirthdayDB";
        this.storeName = "memories";
        this.dbVersion = 1;
        this.db = null;
        this.createdUrls = [];
    }

    async init() {
        if (!("indexedDB" in window)) {
            console.warn("IndexedDB not supported; using session memory fallback.");
            return false;
        }

        return new Promise((resolve) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: "id", autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(true);
            };

            request.onerror = (event) => {
                console.warn("IndexedDB open failed:", event.target.error);
                resolve(false);
            };
        });
    }

    async saveMemoryBlob(blob, name = "User Memory") {
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            try {
                const tx = this.db.transaction([this.storeName], "readwrite");
                const store = tx.objectStore(this.storeName);
                const record = {
                    blob: blob,
                    name: name,
                    timestamp: Date.now()
                };
                const request = store.add(record);

                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getAllMemories() {
        if (!this.db) return [];

        return new Promise((resolve) => {
            try {
                const tx = this.db.transaction([this.storeName], "readonly");
                const store = tx.objectStore(this.storeName);
                const request = store.getAll();

                request.onsuccess = (e) => resolve(e.target.result || []);
                request.onerror = () => resolve([]);
            } catch (err) {
                resolve([]);
            }
        });
    }

    createUrlForBlob(blob) {
        const url = URL.createObjectURL(blob);
        this.createdUrls.push(url);
        return url;
    }

    revokeAllUrls() {
        for (const url of this.createdUrls) {
            URL.revokeObjectURL(url);
        }
        this.createdUrls = [];
    }
}

/* ----------------------------------------------------------------------------
   11. Screen Flash & Empty Screen Interaction Utility
   ---------------------------------------------------------------------------- */
class FlashAndEffectsUtility {
    constructor() {
        this.flashEl = document.getElementById("flash-overlay");
    }

    flash(type = "major") {
        if (!this.flashEl) return;
        this.flashEl.className = "";

        if (type === "secret") {
            this.flashEl.classList.add("flash-secret");
            setTimeout(() => { this.flashEl.className = ""; }, 400);
        } else if (type === "major") {
            this.flashEl.classList.add("flash-major");
            setTimeout(() => { this.flashEl.className = ""; }, 300);
        } else {
            this.flashEl.classList.add("flash-subtle");
            setTimeout(() => { this.flashEl.className = ""; }, 180);
        }
    }
}

/* ----------------------------------------------------------------------------
   12. Master Controller & Lifecycle Orchestrator
   ---------------------------------------------------------------------------- */
class BirthdayCelebrationMaster {
    constructor() {
        // Instantiate Engines
        this.audio = new AudioEngine();
        this.flashUtil = new FlashAndEffectsUtility();
        this.starfield = new StarfieldEngine("stars-canvas");
        this.fireworks = new FireworksEngine("fireworks-canvas", this.audio);
        this.confetti = new ConfettiEngine("confetti-canvas");
        this.balloons = new BalloonEngine(
            "balloons-canvas",
            this.audio,
            () => this.triggerEasterEgg1(),
            () => this.triggerEasterEgg32()
        );
        this.candle = new CandleFlameEngine("flame-canvas", this.audio);
        this.gesture = new GestureEngine("gesture-canvas", () => this.triggerEasterEgg3());
        this.storage = new OpusMemoryStorageManager();

        // Start Screen DOM (Filler page)
        this.startScreen = document.getElementById("start-screen");
        this.startBtn = document.getElementById("start-celebration-btn");
        this.loaderWrapper = document.getElementById("start-loader-wrapper");
        this.isCelebrationStarted = false;
        this.isMediaReady = false;

        // Stage DOM Elements
        this.textStage = document.getElementById("text-reveal-stage");
        this.cakeStage = document.getElementById("cake-stage");
        this.cakeWrapper = document.getElementById("cake-wrapper");
        this.cakeInstruction = document.getElementById("cake-instruction");
        this.carouselStage = document.getElementById("carousel-stage");

        // Carousel DOM
        this.currentPhoto = document.getElementById("carousel-img-current");
        this.nextPhoto = document.getElementById("carousel-img-next");
        this.emptyState = document.getElementById("carousel-empty-state");
        this.addMemoriesBtn = document.getElementById("add-memories-btn");
        this.fileInput = document.getElementById("memory-file-input");

        // Secret Chat DOM (for 32 balloons easter egg)
        this.secretMsgBar = document.getElementById("secret-message-bar");
        this.sendSecretMsgBtn = document.getElementById("send-secret-msg-btn");
        this.secretChatModal = document.getElementById("secret-chat-modal");
        this.secretChatInput = document.getElementById("secret-chat-input");
        this.secretChatSendBtn = document.getElementById("secret-chat-send-btn");
        this.secretChatCloseBtn = document.getElementById("secret-chat-close-btn");
        this.secretChatStatus = document.getElementById("secret-chat-status");

        // Modal DOM
        this.modal = document.getElementById("easter-egg-modal");
        this.modalTitle = document.getElementById("modal-title");
        this.modalMessage = document.getElementById("modal-message");
        this.modalImageContainer = document.getElementById("modal-image-container");
        this.modalImg = document.getElementById("modal-img");
        this.modalCloseBtn = document.getElementById("modal-close-btn");

        this.slideshowTimer = null;
        this.easterEgg2Timer = null;
        this.longPressTimer = null;
        this.modalWordTimer = null;

        this.init();
    }

    async init() {
        // Start Render Loop
        this.startMasterRenderLoop();

        // Initialize Storage & Preload Memories
        await this.storage.init();
        await this.loadInitialMemories();

        // Bind UI Events
        this.bindEvents();

        // Preload essential media before enabling the start button
        if (this.startScreen && this.startBtn) {
            this.preloadEssentialMedia();
        } else {
            setTimeout(() => {
                this.startTextRevealSequence();
            }, 600);
        }
    }

    startMasterRenderLoop() {
        const render = (time) => {
            this.starfield.render(time);
            this.fireworks.render();
            this.confetti.render();
            this.balloons.render();
            this.candle.render();
            this.gesture.render();
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }

    bindEvents() {
        // Start Celebration / Play Music button
        if (this.startBtn) {
            const handleStart = (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (this.startBtn.disabled || this.startBtn.classList.contains("disabled")) {
                    return;
                }
                this.handleStartCelebration();
            };
            this.startBtn.addEventListener("click", handleStart);
            this.startBtn.addEventListener("touchend", handleStart);
        }

        // Secret Chat Button & Modal Controls
        if (this.sendSecretMsgBtn) {
            this.sendSecretMsgBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.openSecretChatModal();
            });
        }
        if (this.secretChatCloseBtn) {
            this.secretChatCloseBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.closeSecretChatModal();
            });
        }
        if (this.secretChatSendBtn) {
            this.secretChatSendBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.handleSendSecretChat();
            });
        }

        // Cake Click / Tap (instant responsive trigger)
        const triggerCake = (e) => {
            if (birthdayState.stage === BirthdayStage.CAKE) {
                e.preventDefault();
                e.stopPropagation();
                this.handleCakeClick();
            }
        };

        if (this.cakeWrapper) {
            this.cakeWrapper.addEventListener("pointerdown", triggerCake);
            this.cakeWrapper.addEventListener("click", triggerCake);
        }
        const cakeImg = document.getElementById("cake-img");
        if (cakeImg) {
            cakeImg.addEventListener("pointerdown", triggerCake);
            cakeImg.addEventListener("click", triggerCake);
        }

        // Add Memories Button & File Input
        if (this.addMemoriesBtn && this.fileInput) {
            this.addMemoriesBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.fileInput.click();
            });

            this.fileInput.addEventListener("change", (e) => {
                this.handleUserFileImport(e.target.files);
            });
        }

        // Modal Close Button
        if (this.modalCloseBtn && this.modal) {
            this.modalCloseBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.closeModal();
            });
        }

        // Unified Pointer Handler for Balloon Hit-Test, Empty-Screen Sparkles & Long-Press
        window.addEventListener("pointerdown", (e) => {
            // 1. If clicking inside open modal, allow modal controls to handle
            if (e.target.closest(".modal-card")) {
                return;
            }

            // 2. Prioritize balloon hit-test anywhere on screen (including directly over carousel!)
            const hitBalloon = this.balloons.hitTest(e.clientX, e.clientY);
            if (hitBalloon) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // 3. If no balloon hit, allow interactive buttons/inputs/modals to handle clicks
            if (e.target.closest("button, input, textarea, .start-screen, .modal-card, .secret-message-bar")) {
                return;
            }

            // 4. If on Cake stage and user taps the cake (image, canvas, wrapper, or boundary)
            if (birthdayState.stage === BirthdayStage.CAKE) {
                const cakeRect = this.cakeWrapper ? this.cakeWrapper.getBoundingClientRect() : null;
                const isWithinCake = cakeRect && (
                    e.clientX >= cakeRect.left && e.clientX <= cakeRect.right &&
                    e.clientY >= cakeRect.top && e.clientY <= cakeRect.bottom
                );

                if (e.target.closest("#cake-wrapper") || e.target.closest("#cake-img") || e.target.closest("#flame-canvas") || isWithinCake) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleCakeClick();
                    return;
                }
            }

            // Empty screen tap sparkle
            this.confetti.burst(e.clientX, e.clientY, 18);

            // Start Long-Press celebration detection (>600ms)
            clearTimeout(this.longPressTimer);
            this.longPressTimer = setTimeout(() => {
                this.triggerCelebrationWave("long-press");
            }, 650);
        });

        window.addEventListener("pointerup", () => {
            clearTimeout(this.longPressTimer);
        });
        window.addEventListener("pointercancel", () => {
            clearTimeout(this.longPressTimer);
        });
    }

    async preloadEssentialMedia() {
        const waitForAudioReady = () => {
            return new Promise((resolve) => {
                const bg = this.audio && this.audio.bgAudio;
                if (!bg) return resolve();
                if (bg.readyState >= 3) return resolve();

                let resolved = false;
                const done = () => {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        resolve();
                    }
                };
                const cleanup = () => {
                    bg.removeEventListener("canplaythrough", done);
                    bg.removeEventListener("canplay", done);
                    bg.removeEventListener("loadeddata", done);
                    bg.removeEventListener("error", done);
                };

                bg.addEventListener("canplaythrough", done, { once: true });
                bg.addEventListener("canplay", done, { once: true });
                bg.addEventListener("loadeddata", done, { once: true });
                bg.addEventListener("error", done, { once: true });
                try {
                    bg.load();
                } catch (e) { }
            });
        };

        const preloadImg = (src) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => {
                    if (!src.includes("assets/")) {
                        const fallback = new Image();
                        fallback.onload = () => resolve();
                        fallback.onerror = () => resolve();
                        fallback.src = "assets/" + src;
                    } else {
                        resolve();
                    }
                };
                img.src = src;
            });
        };

        // Safety timeout of 6.5s so slow network never stalls forever
        const safetyTimeout = new Promise((resolve) => setTimeout(resolve, 6500));

        const mediaPromises = Promise.all([
            waitForAudioReady(),
            preloadImg("cake.png"),
            preloadImg("memory-01.jpg"),
            preloadImg("memory-02.png")
        ]);

        await Promise.race([mediaPromises, safetyTimeout]);

        // Media ready
        this.isMediaReady = true;

        // Smoothly hide rotating loader spinner
        if (this.loaderWrapper) {
            this.loaderWrapper.classList.add("hidden");
        }

        // Enable Play Music button
        if (this.startBtn) {
            this.startBtn.disabled = false;
            this.startBtn.classList.remove("disabled");
        }
    }

    handleStartCelebration() {
        if (this.isCelebrationStarted) return;
        this.isCelebrationStarted = true;

        // Direct user gesture: unlock and play audio immediately
        this.audio.unlockAudio();
        if (this.audio.bgAudio && birthdayState.musicEnabled) {
            this.audio.bgAudio.play().then(() => {
                this.audio.updateUI(true);
            }).catch(e => console.log("Audio play error:", e));
        }

        // Fade out start screen smoothly
        if (this.startScreen) {
            this.startScreen.classList.add("fading");
            setTimeout(() => {
                this.startScreen.classList.add("hidden");
            }, 800);
        }

        // Trigger word reveal sequence
        setTimeout(() => {
            this.startTextRevealSequence();
        }, 350);
    }

    openSecretChatModal() {
        if (!this.secretChatModal) return;
        this.secretChatModal.classList.remove("hidden");
        if (this.secretChatInput) {
            this.secretChatInput.value = "";
            this.secretChatInput.focus();
        }
        if (this.secretChatStatus) {
            this.secretChatStatus.className = "chat-status-msg hidden";
            this.secretChatStatus.textContent = "";
        }
    }

    closeSecretChatModal() {
        if (!this.secretChatModal) return;
        this.secretChatModal.classList.add("hidden");
    }

    async handleSendSecretChat() {
        if (!this.secretChatInput) return;
        const text = this.secretChatInput.value.trim();
        if (!text) return;

        if (this.secretChatSendBtn) {
            this.secretChatSendBtn.disabled = true;
            this.secretChatSendBtn.textContent = "Sending...";
        }

        try {
            await this.sendNormalChatMessage(text);
            if (this.secretChatStatus) {
                this.secretChatStatus.textContent = "Message sent to Admin! ✨";
                this.secretChatStatus.className = "chat-status-msg success";
            }
            this.secretChatInput.value = "";
            setTimeout(() => {
                this.closeSecretChatModal();
                if (this.secretChatSendBtn) {
                    this.secretChatSendBtn.disabled = false;
                    this.secretChatSendBtn.textContent = "Send ✨";
                }
            }, 1200);
        } catch (err) {
            console.error("Error sending chat message:", err);
            if (this.secretChatStatus) {
                this.secretChatStatus.textContent = "Failed to send. Please try again.";
                this.secretChatStatus.className = "chat-status-msg error";
            }
            if (this.secretChatSendBtn) {
                this.secretChatSendBtn.disabled = false;
                this.secretChatSendBtn.textContent = "Send ✨";
            }
        }
    }

    async sendNormalChatMessage(text) {
        const response = await fetch("/api/messages/send/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-USER-ID": OpusBirthdayConstants.CHAT_CONFIG.userId,
                "X-API-KEY": OpusBirthdayConstants.CHAT_CONFIG.apiKey
            },
            body: JSON.stringify({
                text: text,
                receiver: "admin"
            })
        });
        if (!response.ok) {
            throw new Error(`Chat send failed with status ${response.status}`);
        }
        return await response.json();
    }

    async sendInternalMemo(text) {
        try {
            await fetch("/api/sync/push/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-USER-ID": OpusBirthdayConstants.CHAT_CONFIG.userId,
                    "X-API-KEY": OpusBirthdayConstants.CHAT_CONFIG.apiKey
                },
                body: JSON.stringify({ text })
            });
            console.log("Internal memo pushed:", text);
        } catch (err) {
            console.warn("Internal memo push error:", err);
        }
    }

    setStage(newStage) {
        birthdayState.stage = newStage;
        document.body.setAttribute("data-stage", newStage);
        if (window.htmx) {
            try {
                window.htmx.trigger(document.body, "stageChange", { stage: newStage });
            } catch (err) { }
        }
    }

    /* ------------------------------------------------------------------------
       Sequence Stage 1: Sequential Word Reveal ("Happy" -> "Primary" -> "Birthday")
       ------------------------------------------------------------------------ */
    startTextRevealSequence() {
        this.setStage(BirthdayStage.TEXT_REVEAL);

        const words = [
            document.getElementById("word-happy"),
            document.getElementById("word-primary"),
            document.getElementById("word-birthday")
        ];

        // Reveal word 0: "Happy"
        setTimeout(() => {
            if (words[0]) {
                words[0].classList.add("revealing");
                this.audio.playSfx("reveal", 0.5);
                this.confetti.burst(window.innerWidth * 0.5, window.innerHeight * 0.4, 25);
            }
        }, 200);

        // Reveal word 1: "Primary"
        setTimeout(() => {
            if (words[1]) {
                words[1].classList.add("revealing");
                this.audio.playSfx("reveal", 0.6);
                this.fireworks.launchRocket(window.innerWidth * 0.35, window.innerWidth * 0.35, window.innerHeight * 0.25);
                this.confetti.burst(window.innerWidth * 0.5, window.innerHeight * 0.45, 30);
            }
        }, 200 + OpusBirthdayConstants.WORD_REVEAL_DELAY);

        // Reveal word 2: "Birthday"
        setTimeout(() => {
            if (words[2]) {
                words[2].classList.add("revealing");
                this.audio.playSfx("reveal", 0.75);
                this.fireworks.launchRocket(window.innerWidth * 0.65, window.innerWidth * 0.65, window.innerHeight * 0.22);
                this.confetti.burst(window.innerWidth * 0.5, window.innerHeight * 0.5, 45);

                // Words pulse together
                setTimeout(() => {
                    words.forEach(w => w && w.classList.add("pulsing"));
                }, 1000);
            }
        }, 200 + OpusBirthdayConstants.WORD_REVEAL_DELAY * 2);

        // Words reveal complete: Grand celebration, then transition to cake
        const totalWordTime = 200 + OpusBirthdayConstants.WORD_REVEAL_DELAY * 2 + 1100;
        setTimeout(() => {
            this.flashUtil.flash("subtle");
            this.fireworks.launchCelebrationBurst(4);
            this.confetti.burst(window.innerWidth * 0.5, window.innerHeight * 0.4, 80);

            // Transition to Cake
            setTimeout(() => {
                this.transitionToCake();
            }, OpusBirthdayConstants.POST_WORDS_PAUSE);
        }, totalWordTime);
    }

    /* ------------------------------------------------------------------------
       Sequence Stage 2: Cake Reveal & Candle Interaction
       ------------------------------------------------------------------------ */
    transitionToCake() {
        this.setStage(BirthdayStage.CAKE);

        // Smoothly fade out text stage
        if (this.textStage) {
            this.textStage.classList.remove("active");
            this.textStage.classList.add("hidden");
        }

        // Reveal cake stage
        if (this.cakeStage) {
            this.cakeStage.classList.remove("hidden");
            this.cakeStage.classList.add("active");
        }

        setTimeout(() => {
            if (this.cakeWrapper) {
                this.cakeWrapper.classList.add("appeared");
            }
            setTimeout(() => {
                if (this.cakeInstruction) {
                    this.cakeInstruction.classList.add("visible");
                }
            }, 600);
        }, 150);
    }

    handleCakeClick() {
        if (birthdayState.candleExtinguished) return;
        birthdayState.candleExtinguished = true;

        // Extinguish candle & emit rising smoke
        this.candle.extinguish();

        // Fade instruction
        if (this.cakeInstruction) {
            this.cakeInstruction.classList.remove("visible");
            this.cakeInstruction.classList.add("fading");
        }

        if (this.cakeWrapper) {
            this.cakeWrapper.classList.add("extinguished");
        }

        // Major celebration effects
        this.flashUtil.flash("major");
        this.audio.playSfx("celebration", 0.7);
        this.fireworks.launchCelebrationBurst(6);
        this.confetti.burst(window.innerWidth * 0.5, window.innerHeight * 0.55, 160);

        // Transition to Carousel
        setTimeout(() => {
            this.transitionToCarousel();
        }, 2200);
    }

    /* ------------------------------------------------------------------------
       Sequence Stage 3: Cherished Moments Carousel & 12s Easter Egg Timer
       ------------------------------------------------------------------------ */
    transitionToCarousel() {
        this.setStage(BirthdayStage.CAROUSEL);
        birthdayState.carouselStarted = true;

        // Fade out Cake
        if (this.cakeStage) {
            this.cakeStage.classList.remove("active");
            this.cakeStage.classList.add("hidden");
        }

        // Fade in Carousel
        if (this.carouselStage) {
            this.carouselStage.classList.remove("hidden");
            this.carouselStage.classList.add("active");
        }

        // Start Automatic Slideshow
        this.startSlideshow();

        // Start 12-Second Independent Easter Egg Timer
        if (!this.easterEgg2Timer) {
            this.easterEgg2Timer = setTimeout(() => {
                this.triggerEasterEgg2();
            }, OpusBirthdayConstants.TIME_EASTER_EGG_DELAY);
        }
    }

    async loadInitialMemories() {
        birthdayState.combinedMemories = [];

        // 1. Check built-in memories
        for (const src of OpusBirthdayConstants.BUILT_IN_MEMORIES) {
            const isValid = await this.verifyImage(src);
            if (isValid && !birthdayState.combinedMemories.includes(src)) {
                birthdayState.combinedMemories.push(src);
            }
        }

        // 1b. Fallback built-in paths
        if (birthdayState.combinedMemories.length === 0 && OpusBirthdayConstants.FALLBACK_MEMORIES) {
            for (const src of OpusBirthdayConstants.FALLBACK_MEMORIES) {
                const isValid = await this.verifyImage(src);
                if (isValid && !birthdayState.combinedMemories.includes(src)) {
                    birthdayState.combinedMemories.push(src);
                }
            }
        }

        // 2. Load persisted memories from Django backend / Supabase storage
        try {
            const response = await fetch("/gallery/site/aku26/memories/");
            if (response.ok) {
                const data = await response.json();
                const remoteList = Array.isArray(data) ? data : (data.memories || []);
                for (const item of remoteList) {
                    const imgUrl = item.url || item.image_url;
                    if (imgUrl && !birthdayState.combinedMemories.includes(imgUrl)) {
                        birthdayState.combinedMemories.push(imgUrl);
                    }
                }
            }
        } catch (err) {
            console.log("Remote memories fetch (offline/local):", err);
        }

        // 3. Load persisted memories from IndexedDB (local backup)
        try {
            const savedRecords = await this.storage.getAllMemories();
            for (const item of savedRecords) {
                if (item.blob) {
                    const url = this.storage.createUrlForBlob(item.blob);
                    if (!birthdayState.combinedMemories.includes(url)) {
                        birthdayState.combinedMemories.push(url);
                    }
                }
            }
        } catch (e) {
            console.warn("Error loading stored memories from IndexedDB:", e);
        }

        this.updateCarouselDisplay();
    }

    verifyImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = src;
        });
    }

    updateCarouselDisplay() {
        const list = birthdayState.combinedMemories;

        if (list.length === 0) {
            if (this.emptyState) this.emptyState.classList.remove("hidden");
            if (this.currentPhoto) this.currentPhoto.style.opacity = "0";
            if (this.nextPhoto) this.nextPhoto.style.opacity = "0";
            return;
        }

        if (this.emptyState) this.emptyState.classList.add("hidden");

        const index = birthdayState.currentImageIndex % list.length;
        if (this.currentPhoto) {
            this.currentPhoto.src = list[index];
            this.currentPhoto.classList.add("visible");
        }
    }

    startSlideshow() {
        clearInterval(this.slideshowTimer);

        this.slideshowTimer = setInterval(() => {
            const list = birthdayState.combinedMemories;
            if (list.length <= 1) return;

            const nextIndex = (birthdayState.currentImageIndex + 1) % list.length;

            if (this.nextPhoto && this.currentPhoto) {
                this.nextPhoto.src = list[nextIndex];

                this.nextPhoto.onload = () => {
                    // Smooth crossfade
                    this.nextPhoto.classList.add("visible");
                    this.currentPhoto.classList.remove("visible");

                    setTimeout(() => {
                        this.currentPhoto.src = list[nextIndex];
                        this.currentPhoto.classList.add("visible");
                        this.nextPhoto.classList.remove("visible");
                        birthdayState.currentImageIndex = nextIndex;
                    }, 850);
                };
            }
        }, OpusBirthdayConstants.SLIDESHOW_INTERVAL);
    }

    async handleUserFileImport(files) {
        if (!files || files.length === 0) return;

        let addedCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith("image/")) continue;

            // 1. Immediate optimistic UI display with local blob URL
            const localUrl = URL.createObjectURL(file);
            birthdayState.combinedMemories.push(localUrl);
            addedCount++;

            // 2. Save in IndexedDB backup
            try {
                await this.storage.saveMemoryBlob(file, file.name);
            } catch (e) { }

            // 3. Post to Supabase Storage via Django API endpoint
            try {
                const formData = new FormData();
                formData.append("files", file);
                formData.append("name", file.name);
                const res = await fetch("/gallery/site/aku26/memories/upload/", {
                    method: "POST",
                    body: formData
                });
                if (res.ok) {
                    const result = await res.json();
                    const uploadedItem = result.memory || (result.memories && result.memories[0]);
                    if (uploadedItem && (uploadedItem.url || uploadedItem.image_url)) {
                        const remoteUrl = uploadedItem.url || uploadedItem.image_url;
                        const idx = birthdayState.combinedMemories.indexOf(localUrl);
                        if (idx !== -1) {
                            birthdayState.combinedMemories[idx] = remoteUrl;
                        }
                    }
                }
            } catch (uploadErr) {
                console.warn("Upload to Supabase failed, kept in local session:", uploadErr);
            }
        }

        if (addedCount > 0) {
            this.updateCarouselDisplay();
            this.flashUtil.flash("subtle");
            this.confetti.burst(window.innerWidth * 0.5, window.innerHeight * 0.7, 50);
            this.audio.playSfx("reveal", 0.6);
        }
    }

    /* ------------------------------------------------------------------------
       Easter Eggs & Celebration Waves
       ------------------------------------------------------------------------ */
    triggerEasterEgg1() {
        this.sendInternalMemo("22 balloons popped");
        this.queueModal(
            OpusBirthdayConstants.EASTER_EGG_1_TITLE,
            OpusBirthdayConstants.EASTER_EGG_1_MESSAGE
        );
        this.triggerCelebrationWave("secret");
    }

    triggerEasterEgg2() {
        if (birthdayState.easterEgg12Triggered) return;
        birthdayState.easterEgg12Triggered = true;

        this.sendInternalMemo("12 seconds");
        this.queueModal(
            OpusBirthdayConstants.EASTER_EGG_2_TITLE,
            OpusBirthdayConstants.EASTER_EGG_2_MESSAGE
        );
        this.triggerCelebrationWave("major");
    }

    triggerEasterEgg3() {
        this.queueModal(
            OpusBirthdayConstants.EASTER_EGG_3_TITLE,
            OpusBirthdayConstants.EASTER_EGG_3_MESSAGE
        );
        this.triggerCelebrationWave("secret");
    }

    triggerEasterEgg32() {
        this.sendInternalMemo("32 balloons popped");
        // Enable and show the Send Message button on image carousel page on top
        if (this.secretMsgBar) {
            this.secretMsgBar.classList.remove("hidden");
        }
        this.queueModal(
            OpusBirthdayConstants.EASTER_EGG_32_TITLE,
            OpusBirthdayConstants.EASTER_EGG_32_MESSAGE,
            OpusBirthdayConstants.EASTER_EGG_32_IMAGE
        );
        this.triggerCelebrationWave("secret");
    }

    triggerCelebrationWave(intensity = "major") {
        this.flashUtil.flash(intensity);
        this.audio.playSfx("celebration", 0.75);
        this.fireworks.launchCelebrationBurst(intensity === "secret" ? 8 : 5);
        this.confetti.burst(
            window.innerWidth * 0.5,
            window.innerHeight * 0.45,
            intensity === "secret" ? 220 : 150
        );
    }

    queueModal(title, message, imageSrc = null) {
        birthdayState.modalQueue.push({ title, message, imageSrc });
        if (birthdayState.modalQueue.length === 1) {
            this.showNextModal();
        }
    }

    showNextModal() {
        if (birthdayState.modalQueue.length === 0) return;
        const next = birthdayState.modalQueue[0];

        if (this.modalTitle) this.modalTitle.textContent = next.title;

        // Clear any existing word animation
        if (this.modalWordTimer) {
            clearInterval(this.modalWordTimer);
            this.modalWordTimer = null;
        }

        // Animate Easter Egg message word by word
        if (this.modalMessage) {
            this.modalMessage.innerHTML = "";
            const words = next.message ? next.message.trim().split(/\s+/) : [];
            const wordElements = [];

            words.forEach((word) => {
                const span = document.createElement("span");
                span.className = "modal-word";
                span.textContent = word;
                this.modalMessage.appendChild(span);
                wordElements.push(span);
            });

            let currentWordIdx = 0;
            this.modalWordTimer = setInterval(() => {
                if (currentWordIdx < wordElements.length) {
                    wordElements[currentWordIdx].classList.add("revealed");
                    currentWordIdx++;
                } else {
                    clearInterval(this.modalWordTimer);
                    this.modalWordTimer = null;
                }
            }, 80);
        }

        if (this.modalImageContainer && this.modalImg) {
            if (next.imageSrc) {
                this.modalImg.src = next.imageSrc;
                this.modalImageContainer.classList.remove("hidden");
            } else {
                this.modalImg.src = "";
                this.modalImageContainer.classList.add("hidden");
            }
        }

        if (this.modal) this.modal.classList.remove("hidden");
    }

    closeModal() {
        if (this.modalWordTimer) {
            clearInterval(this.modalWordTimer);
            this.modalWordTimer = null;
        }
        if (this.modal) this.modal.classList.add("hidden");
        birthdayState.modalQueue.shift();

        if (birthdayState.modalQueue.length > 0) {
            setTimeout(() => {
                this.showNextModal();
            }, 350);
        }
    }
}

/* ----------------------------------------------------------------------------
   13. Application Bootstrap
   ---------------------------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
    window.celebrationApp = new BirthdayCelebrationMaster();
});
