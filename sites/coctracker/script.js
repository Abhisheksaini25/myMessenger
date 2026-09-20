document.addEventListener('DOMContentLoaded', () => {
    const startScreen = document.getElementById('start-screen');
    const wishingScreen = document.getElementById('wishing-screen');
    const bgm = document.getElementById('bgm');
    
    let audioContextStarted = false;

    // --- Audio Handling ---
    const initAudio = () => {
        if (!audioContextStarted) {
            bgm.volume = 0.5;
            bgm.play().catch(e => console.log("Audio autoplay prevented"));
            audioContextStarted = true;
        }
    };

    // --- Start Sequence ---
    startScreen.addEventListener('click', () => {
        initAudio();
        document.title = "Happy Birthday Chief!";
        
        // Hide Start Screen
        startScreen.classList.add('opacity-0');
        setTimeout(() => {
            startScreen.classList.remove('active');
            // Show Wishing Screen
            wishingScreen.classList.remove('hidden');
            initEffects();
        }, 1000);
    });

    // --- Particle Effects (DOM & Canvas) ---
    const initEffects = () => {
        generateStars(100);
        setInterval(() => createAmbientSparks(), 1000);
        setInterval(() => {
            createFireworks(
                Math.random() * window.innerWidth,
                window.innerHeight * 0.8,
                30
            );
        }, 3000); // Shoot fireworks every 3 seconds
        
        // Start spawning troops
        setInterval(spawnTroop, 2500); // Every 2.5 seconds spawn a troop
        
        // Shooting stars
        setInterval(createShootingStar, 4000); // Every 4 seconds
    };

    const createShootingStar = () => {
        const sky = document.getElementById('night-sky');
        const star = document.createElement('div');
        star.className = 'shooting-star';
        star.style.left = (Math.random() * 100 + 20) + 'vw'; // Start further right
        star.style.top = (Math.random() * -20) + 'vh'; // Start slightly above
        star.style.setProperty('--duration', (Math.random() * 1 + 1) + 's'); // 1-2s duration
        sky.appendChild(star);
        setTimeout(() => star.remove(), 2000);
    };

    // --- Troops Logic ---
    const barbarianSVG = `<svg viewBox="0 0 50 50" width="100%" height="100%">
        <circle cx="25" cy="15" r="8" fill="#111" />
        <rect x="18" y="25" width="14" height="20" rx="3" fill="#111" />
        <rect x="30" y="20" width="18" height="4" transform="rotate(-45 30 20)" fill="#111" />
    </svg>`;
    const archerSVG = `<svg viewBox="0 0 50 50" width="100%" height="100%">
        <circle cx="25" cy="15" r="7" fill="#111" />
        <polygon points="20,25 30,25 28,45 22,45" fill="#111" />
        <path d="M 25 20 Q 40 20 40 35 Q 40 50 25 50" fill="none" stroke="#111" stroke-width="2"/>
    </svg>`;
    const troopTypes = [barbarianSVG, archerSVG];

    const spawnTroop = () => {
        const troopLayer = document.getElementById('troop-layer');
        if (!troopLayer) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'troop-wrapper';
        
        const direction = Math.random() > 0.5 ? 'right' : 'left';
        wrapper.classList.add(direction === 'right' ? 'walk-right' : 'walk-left');
        
        const duration = Math.random() * 5 + 8; // 8 to 13 seconds
        wrapper.style.setProperty('--duration', duration + 's');
        wrapper.style.bottom = (Math.random() * 20 + 5) + 'px'; // Random depth
        
        const flipper = document.createElement('div');
        flipper.className = 'troop-flipper';
        if (direction === 'left') flipper.classList.add('face-left');
        
        const sprite = document.createElement('div');
        sprite.className = 'troop-sprite';
        sprite.innerHTML = troopTypes[Math.floor(Math.random() * troopTypes.length)];
        
        flipper.appendChild(sprite);
        wrapper.appendChild(flipper);
        troopLayer.appendChild(wrapper);
        
        // Remove after walk finishes
        setTimeout(() => wrapper.remove(), duration * 1000);
    };

    const generateStars = (count) => {
        const sky = document.getElementById('night-sky');
        for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.width = Math.random() * 3 + 'px';
            star.style.height = star.style.width;
            star.style.left = Math.random() * 100 + 'vw';
            star.style.top = Math.random() * 100 + 'vh';
            star.style.setProperty('--duration', (Math.random() * 3 + 1) + 's');
            sky.appendChild(star);
        }
    };

    const createAmbientSparks = () => {
        const sparkLayer = document.getElementById('spark-layer');
        const spark = document.createElement('div');
        spark.className = 'spark';
        spark.style.left = Math.random() * window.innerWidth + 'px';
        spark.style.top = window.innerHeight + 'px';
        spark.style.setProperty('--duration', (Math.random() * 3 + 2) + 's');
        sparkLayer.appendChild(spark);
        
        setTimeout(() => spark.remove(), 5000);
    };

    // --- Simple Canvas Fireworks ---
    const canvas = document.getElementById('fireworks-canvas');
    const ctx = canvas.getContext('2d');
    
    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let particles = [];

    const createFireworks = (x, y, count) => {
        const baseHue = Math.random() > 0.5 ? 45 : 300; // Gold or Elixir (Pink)
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x,
                y: y,
                vx: Math.random() * 12 - 6,
                vy: Math.random() * -15 - 5, // Shoot upwards
                life: 1,
                color: `hsl(${baseHue + Math.random() * 20 - 10}, 100%, 50%)`
            });
        }
    };

    const animateFireworks = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particles.length - 1; i >= 0; i--) {
            let p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // gravity
            p.life -= 0.015;
            
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();

            if (p.life <= 0) particles.splice(i, 1);
        }
        requestAnimationFrame(animateFireworks);
    };
    animateFireworks();

    // --- Confetti on Click ---
    const createConfetti = (x, y, count) => {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x,
                y: y,
                vx: Math.random() * 14 - 7,
                vy: Math.random() * 14 - 7,
                life: 1,
                color: `hsl(${Math.random() * 360}, 100%, 50%)`
            });
        }
    };

    document.body.addEventListener('click', (e) => {
        createConfetti(e.clientX, e.clientY, 40);
    });
});
