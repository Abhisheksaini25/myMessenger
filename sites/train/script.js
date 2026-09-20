document.addEventListener('DOMContentLoaded', () => {
    // Generate Stars
    const sky = document.getElementById('sky');
    const starCount = 150;
    
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.classList.add('star');
        star.style.width = `${Math.random() * 3 + 1}px`;
        star.style.height = star.style.width;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 80}%`;
        star.style.animationDuration = `${Math.random() * 3 + 1}s`;
        star.style.animationDelay = `${Math.random() * 2}s`;
        sky.appendChild(star);
    }

    // Shooting Stars Logic
    function spawnShootingStar() {
        const star = document.createElement('div');
        star.classList.add('shooting-star');
        star.style.left = `${Math.random() * 60 + 40}%`; 
        star.style.top = `${Math.random() * -20}%`;
        sky.appendChild(star);
        
        setTimeout(() => {
            if(star.parentNode) star.remove();
        }, 1500);

        setTimeout(spawnShootingStar, Math.random() * 5000 + 2000); 
    }
    spawnShootingStar();

    // Mouse Trail Effect
    document.addEventListener('mousemove', (e) => {
        const trail = document.createElement('div');
        trail.classList.add('mouse-trail');
        trail.style.left = `${e.pageX}px`;
        trail.style.top = `${e.pageY}px`;
        document.body.appendChild(trail);
        
        setTimeout(() => {
            if(trail.parentNode) trail.remove();
        }, 600);
    });

    // Scratch Card Logic
    function initScratchCard() {
        const canvas = document.getElementById('scratch-canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const squadText = document.getElementById('squad-text');
        
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        // Metallic gradient overlay
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#555');
        gradient.addColorStop(0.5, '#bbb');
        gradient.addColorStop(1, '#555');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Instruction Text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px Montserrat';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Scratch Here!', canvas.width/2, canvas.height/2);

        let isDrawing = false;
        let isScratched = false;
        ctx.globalCompositeOperation = 'destination-out';
        
        function getMousePos(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }
        
        function scratch(e) {
            if (!isDrawing) return;
            e.preventDefault(); 
            const pos = getMousePos(e);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
            ctx.fill();
        }

        // Check how much is scratched
        function checkScratchPercent() {
            if (isScratched) return;
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let transparentPixels = 0;
            // imageData is an array of [r,g,b,a, r,g,b,a...]
            for (let i = 3; i < imageData.length; i += 4) {
                if (imageData[i] < 128) { // if alpha is less than 50%
                    transparentPixels++;
                }
            }
            const totalPixels = imageData.length / 4;
            if (transparentPixels / totalPixels > 0.4) { // 40% scratched is enough
                isScratched = true;
                squadText.classList.add('visible');
            }
        }
        
        canvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(e); });
        canvas.addEventListener('mousemove', scratch);
        window.addEventListener('mouseup', () => { 
            isDrawing = false; 
            checkScratchPercent();
        });
        
        canvas.addEventListener('touchstart', (e) => { isDrawing = true; scratch(e); }, {passive: false});
        canvas.addEventListener('touchmove', scratch, {passive: false});
        window.addEventListener('touchend', () => { 
            isDrawing = false; 
            checkScratchPercent();
        });
    }

    // Rockets / Fireworks Logic
    const rocketsContainer = document.getElementById('rockets-container');
    let rocketsActive = false;

    function launchRocket() {
        if (!rocketsActive) return;
        
        const rocket = document.createElement('div');
        rocket.classList.add('rocket');
        rocket.style.left = `${Math.random() * 80 + 10}%`; 
        rocketsContainer.appendChild(rocket);
        
        setTimeout(() => {
            const rect = rocket.getBoundingClientRect();
            createExplosion(rect.left, window.innerHeight * 0.3 + (Math.random() * 100 - 50));
            if(rocket.parentNode) rocket.remove();
        }, 1400);

        setTimeout(launchRocket, Math.random() * 1500 + 500);
    }

    function createExplosion(x, y) {
        const colors = ['#00e5ff', '#b000ff', '#ff00ff', '#f9d71c', '#ffffff'];
        const particlesCount = 40;
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        for(let i=0; i<particlesCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('explosion-particle');
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            particle.style.backgroundColor = color;
            particle.style.boxShadow = `0 0 10px ${color}`;
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = 50 + Math.random() * 120;
            const tx = Math.cos(angle) * velocity;
            const ty = Math.sin(angle) * velocity;
            
            particle.style.setProperty('--tx', `${tx}px`);
            particle.style.setProperty('--ty', `${ty}px`);
            
            rocketsContainer.appendChild(particle);
            
            setTimeout(() => {
                if(particle.parentNode) particle.remove();
            }, 1000);
        }
    }

    // Click Fireworks
    document.addEventListener('click', (e) => {
        // Prevent launching fireworks if clicking start button or scratch canvas
        if (e.target.id === 'start-btn' || e.target.id === 'scratch-canvas') return;
        
        // Launch 3 explosions sequentially near the click point for a grand effect
        for(let i=0; i<3; i++) {
            setTimeout(() => {
                createExplosion(
                    e.clientX + (Math.random() * 60 - 30), 
                    e.clientY + (Math.random() * 60 - 30)
                );
            }, i * 200);
        }
    });

    // Main UI Elements
    const startBtn = document.getElementById('start-btn');
    const startScreen = document.getElementById('start-screen');
    const train = document.getElementById('train-container');
    const greeting = document.getElementById('greeting-container');
    const audio = document.getElementById('bday-audio');
    const wheels = document.querySelectorAll('.wheel');
    
    startBtn.addEventListener('click', () => {
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
        }).catch(e => console.log("Audio auto-unlock may be restricted:", e));

        startScreen.style.opacity = '0';
        setTimeout(() => {
            startScreen.classList.add('hidden');
        }, 1000);

        const trainRect = train.getBoundingClientRect();
        const stationRect = document.getElementById('station-container').getBoundingClientRect();
        
        // Move to station
        const distanceToMove = (stationRect.left + 180) - trainRect.right;
        
        setTimeout(() => {
            train.style.transform = `translateX(${distanceToMove}px)`;
        }, 500);

        // Train Arrives
        setTimeout(() => {
            wheels.forEach(w => w.style.animationPlayState = 'paused');
            
            audio.play().catch(e => console.log("Audio play failed.", e));

            greeting.classList.remove('hidden');
            document.title = "Happy Birthday!"; // Dynamically change the title
            
            setTimeout(() => {
                greeting.classList.add('visible');
                
                // Animate subtext words one by one
                const words = document.querySelectorAll('#bday-subtext span');
                words.forEach((word, index) => {
                    setTimeout(() => {
                        word.style.transition = 'opacity 0.6s ease-in, transform 0.6s ease-out';
                        word.style.opacity = '1';
                        word.style.transform = 'translateY(0)';
                    }, 400 + (index * 300)); // Delay between each word
                });
                
                rocketsActive = true;
                launchRocket();
            }, 50);

            // Wait 13 seconds, then train leaves
            setTimeout(() => {
                wheels.forEach(w => w.style.animationPlayState = 'running');
                train.style.transition = 'transform 8s ease-in';
                const screenWidth = window.innerWidth;
                
                // Move off-screen completely to the right
                train.style.transform = `translateX(${screenWidth + 1500}px)`;

                // Show Scratch Card shortly after train starts leaving
                setTimeout(() => {
                    const scratchContainer = document.getElementById('scratch-container');
                    scratchContainer.classList.remove('hidden');
                    setTimeout(() => {
                        scratchContainer.classList.add('visible');
                        initScratchCard();
                    }, 50);
                }, 2000);

            }, 13000);

        }, 14500); 
    });
});
