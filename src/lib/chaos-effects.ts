// Chaos Effects Library - For when things need to go sideways (literally and metaphorically)

export interface ChaosEffectsConfig {
  mouseTrail?: boolean;
  clickEffects?: boolean;
  hoverChaos?: boolean;
  soundEffects?: boolean;
  vibrationEffects?: boolean;
  timeBasedChanges?: boolean;
  hourlyColorShift?: boolean;
  chaosMode?: boolean;
  chaosIntensity?: number;
  backgroundMusic?: string;
}

class ChaosEffectsManager {
  private config: ChaosEffectsConfig = {};
  private mouseTrailElements: HTMLElement[] = [];
  private audioContext: AudioContext | null = null;
  private backgroundAudio: HTMLAudioElement | null = null;
  private colorShiftInterval: number | null = null;
  private chaosInterval: number | null = null;

  init(config: ChaosEffectsConfig) {
    this.config = config;
    this.cleanup(); // Clean up any existing effects
    
    if (config.mouseTrail) this.initMouseTrail();
    if (config.clickEffects) this.initClickEffects();
    if (config.hoverChaos) this.initHoverChaos();
    if (config.soundEffects) this.initSoundEffects();
    if (config.backgroundMusic) this.initBackgroundMusic();
    if (config.hourlyColorShift) this.initColorShift();
    if (config.chaosMode) this.initChaosMode();
    if (config.timeBasedChanges) this.initTimeBasedChanges();
  }

  private initMouseTrail() {
    let trailIndex = 0;
    const trailLength = 20;
    const emojis = ['✨', '🌟', '💫', '⭐', '🎆', '🎇', '💥', '🔥', '⚡', '🌈'];
    
    document.addEventListener('mousemove', (e) => {
      const trail = document.createElement('div');
      trail.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      trail.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        pointer-events: none;
        z-index: 9999;
        font-size: ${Math.random() * 20 + 10}px;
        animation: fadeOut 1s ease-out forwards;
        transform: rotate(${Math.random() * 360}deg);
      `;
      
      document.body.appendChild(trail);
      this.mouseTrailElements.push(trail);
      
      // Remove old trail elements
      if (this.mouseTrailElements.length > trailLength) {
        const oldTrail = this.mouseTrailElements.shift();
        if (oldTrail && oldTrail.parentNode) {
          oldTrail.parentNode.removeChild(oldTrail);
        }
      }
      
      // Auto-remove after animation
      setTimeout(() => {
        if (trail.parentNode) {
          trail.parentNode.removeChild(trail);
        }
      }, 1000);
    });

    // Add CSS animation
    if (!document.getElementById('chaos-trail-styles')) {
      const style = document.createElement('style');
      style.id = 'chaos-trail-styles';
      style.textContent = `
        @keyframes fadeOut {
          0% { opacity: 1; transform: scale(1) rotate(0deg); }
          100% { opacity: 0; transform: scale(0.5) rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private initClickEffects() {
    const effects = ['💥', '🎉', '🎊', '✨', '💫', '🌟', '🔥', '⚡', '💢', '💯'];
    
    document.addEventListener('click', (e) => {
      // Create multiple explosion effects
      for (let i = 0; i < 8; i++) {
        const effect = document.createElement('div');
        effect.textContent = effects[Math.floor(Math.random() * effects.length)];
        effect.style.cssText = `
          position: fixed;
          left: ${e.clientX}px;
          top: ${e.clientY}px;
          pointer-events: none;
          z-index: 9999;
          font-size: ${Math.random() * 30 + 15}px;
          animation: explode 0.8s ease-out forwards;
          transform: rotate(${Math.random() * 360}deg);
        `;
        
        document.body.appendChild(effect);
        
        setTimeout(() => {
          if (effect.parentNode) {
            effect.parentNode.removeChild(effect);
          }
        }, 800);
      }

      // Screen shake effect
      document.body.style.animation = 'screenShake 0.3s ease-in-out';
      setTimeout(() => {
        document.body.style.animation = '';
      }, 300);

      // Vibration if supported
      if (this.config.vibrationEffects && navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
    });

    // Add explosion animation
    if (!document.getElementById('chaos-click-styles')) {
      const style = document.createElement('style');
      style.id = 'chaos-click-styles';
      style.textContent = `
        @keyframes explode {
          0% { 
            opacity: 1; 
            transform: scale(1) translate(0, 0) rotate(0deg); 
          }
          100% { 
            opacity: 0; 
            transform: scale(2) translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) rotate(720deg); 
          }
        }
        @keyframes screenShake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          10% { transform: translate(-2px, -2px) rotate(-1deg); }
          20% { transform: translate(2px, -2px) rotate(1deg); }
          30% { transform: translate(-2px, 2px) rotate(0deg); }
          40% { transform: translate(2px, 2px) rotate(1deg); }
          50% { transform: translate(-2px, -2px) rotate(-1deg); }
          60% { transform: translate(2px, -2px) rotate(0deg); }
          70% { transform: translate(-2px, 2px) rotate(-1deg); }
          80% { transform: translate(2px, 2px) rotate(1deg); }
          90% { transform: translate(-2px, -2px) rotate(0deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private initHoverChaos() {
    const originalStyles = new Map<Element, string>();
    
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement;
      if (!target || target === document.body || target === document.documentElement) return;
      
      // Store original styles
      if (!originalStyles.has(target)) {
        originalStyles.set(target, target.style.cssText);
      }
      
      // Apply chaos
      const chaosStyles = `
        transform: rotate(${Math.random() * 20 - 10}deg) scale(${Math.random() * 0.4 + 0.8}) !important;
        background-color: hsl(${Math.random() * 360}, 70%, 80%) !important;
        color: hsl(${Math.random() * 360}, 70%, 20%) !important;
        border: 2px solid hsl(${Math.random() * 360}, 70%, 50%) !important;
        transition: all 0.3s ease !important;
        animation: chaosHover 0.5s ease-in-out !important;
      `;
      
      target.style.cssText += chaosStyles;
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target as HTMLElement;
      if (!target || !originalStyles.has(target)) return;
      
      // Restore original styles
      target.style.cssText = originalStyles.get(target) || '';
    });

    // Add hover animation
    if (!document.getElementById('chaos-hover-styles')) {
      const style = document.createElement('style');
      style.id = 'chaos-hover-styles';
      style.textContent = `
        @keyframes chaosHover {
          0%, 100% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(180deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  private initSoundEffects() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      return;
    }

    // Sound effect for clicks
    document.addEventListener('click', () => {
      this.playTone(Math.random() * 800 + 200, 0.1);
    });

    // Sound effect for hovers
    document.addEventListener('mouseover', () => {
      if (Math.random() < 0.1) { // Only 10% of hovers to avoid chaos
        this.playTone(Math.random() * 400 + 400, 0.05);
      }
    });
  }

  private playTone(frequency: number, duration: number) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  private initBackgroundMusic() {
    if (!this.config.backgroundMusic) return;

    this.backgroundAudio = new Audio(this.config.backgroundMusic);
    this.backgroundAudio.loop = true;
    this.backgroundAudio.volume = 0.3;
    
    // Auto-play (may be blocked by browser)
    this.backgroundAudio.play().catch(() => {
      console.warn('Background music autoplay blocked by browser');
    });
  }

  private initColorShift() {
    this.colorShiftInterval = window.setInterval(() => {
      const hue = (Date.now() / 1000) % 360;
      document.documentElement.style.filter = `hue-rotate(${hue}deg)`;
    }, 100);
  }

  private initChaosMode() {
    if (!this.config.chaosMode) return;

    const intensity = this.config.chaosIntensity || 1;
    
    this.chaosInterval = window.setInterval(() => {
      // Random element chaos
      const elements = document.querySelectorAll('*');
      const randomElement = elements[Math.floor(Math.random() * elements.length)] as HTMLElement;
      
      if (randomElement && Math.random() < 0.1 * intensity) {
        const originalTransform = randomElement.style.transform;
        randomElement.style.transform = `rotate(${Math.random() * 360}deg) scale(${Math.random() * 0.5 + 0.75})`;
        
        setTimeout(() => {
          randomElement.style.transform = originalTransform;
        }, 1000);
      }

      // Random color changes
      if (Math.random() < 0.05 * intensity) {
        document.documentElement.style.filter = `hue-rotate(${Math.random() * 360}deg) saturate(${Math.random() * 2 + 0.5})`;
        
        setTimeout(() => {
          document.documentElement.style.filter = '';
        }, 2000);
      }
    }, 500 / intensity);
  }

  private initTimeBasedChanges() {
    const updateBasedOnTime = () => {
      const hour = new Date().getHours();
      const minute = new Date().getMinutes();
      
      // Different effects based on time of day
      if (hour >= 0 && hour < 6) {
        // Night mode - darker, mysterious
        document.documentElement.style.filter = 'brightness(0.7) contrast(1.2) hue-rotate(240deg)';
      } else if (hour >= 6 && hour < 12) {
        // Morning - bright, energetic
        document.documentElement.style.filter = 'brightness(1.1) saturate(1.3) hue-rotate(60deg)';
      } else if (hour >= 12 && hour < 18) {
        // Afternoon - warm
        document.documentElement.style.filter = 'brightness(1.0) saturate(1.1) hue-rotate(30deg)';
      } else {
        // Evening - cool
        document.documentElement.style.filter = 'brightness(0.9) saturate(1.2) hue-rotate(200deg)';
      }

      // Minute-based micro-changes
      const minuteHue = (minute / 60) * 360;
      document.documentElement.style.setProperty('--time-hue', `${minuteHue}deg`);
    };

    updateBasedOnTime();
    setInterval(updateBasedOnTime, 60000); // Update every minute
  }

  cleanup() {
    // Remove mouse trail elements
    this.mouseTrailElements.forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this.mouseTrailElements = [];

    // Stop audio
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio = null;
    }

    // Clear intervals
    if (this.colorShiftInterval) {
      clearInterval(this.colorShiftInterval);
      this.colorShiftInterval = null;
    }

    if (this.chaosInterval) {
      clearInterval(this.chaosInterval);
      this.chaosInterval = null;
    }

    // Remove style sheets
    const styleSheets = ['chaos-trail-styles', 'chaos-click-styles', 'chaos-hover-styles'];
    styleSheets.forEach(id => {
      const style = document.getElementById(id);
      if (style) style.remove();
    });

    // Reset filters
    document.documentElement.style.filter = '';
    document.body.style.animation = '';
  }
}

export const chaosEffects = new ChaosEffectsManager();