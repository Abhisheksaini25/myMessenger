'use strict';

const SoundManager = {
  bgMusic: new Audio((window.STATIC_ASSETS_BASE || 'assets/') + 'bg_music.mp3'),
  popSfx: new Audio((window.STATIC_ASSETS_BASE || 'assets/') + 'pop.mp3'),
  revealSfx: new Audio((window.STATIC_ASSETS_BASE || 'assets/') + 'reveal.mp3'),
  celebrationSfx: new Audio((window.STATIC_ASSETS_BASE || 'assets/') + 'celebration.mp3'),
  isMusicStarted: false,

  init() {
    this.bgMusic.loop = true;
    this.bgMusic.volume = 0.5; // Default from constants
  },

  ensure() { return true; },
  resume() { 
    if (this.isMusicStarted && this.bgMusic.paused) {
      this.bgMusic.play().catch(e => console.log('Audio play failed', e));
    }
  },

  playBalloonPop() {
    if (!C.ENABLE_SOUND_EFFECTS) return;
    const a = this.popSfx.cloneNode();
    a.play().catch(e => {});
  },

  playFirework() {
    if (!C.ENABLE_SOUND_EFFECTS) return;
    const a = this.popSfx.cloneNode();
    a.volume = 0.4;
    a.play().catch(e => {});
  },

  playCelebration() {
    if (!C.ENABLE_SOUND_EFFECTS) return;
    const a = this.celebrationSfx.cloneNode();
    a.play().catch(e => {});
  },

  playReveal() {
    if (!C.ENABLE_SOUND_EFFECTS) return;
    const a = this.revealSfx.cloneNode();
    a.play().catch(e => {});
  },

  changeMusicTrack(trackNumber) {
    // Left empty since we only have one background music track now
  },

  startMusic() {
    if (!C.ENABLE_MUSIC) return;
    this.isMusicStarted = true;
    this.bgMusic.play().catch(e => console.log('Audio play failed', e));
  },

  pauseMusic() {
    this.bgMusic.pause();
  },

  resumeMusic() {
    if (this.isMusicStarted) {
      this.bgMusic.play().catch(e => console.log('Audio play failed', e));
    }
  },
};

SoundManager.init();
