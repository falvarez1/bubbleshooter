/**
 * Sound Manager
 * Advanced sound system for managing all game sound effects
 */
export class SoundManager {
    constructor() {
        this.sounds = new Map();
        this.enabled = true;
        this.volume = 0.7;
        this.soundCategories = {
            effects: 1.0,
            music: 0.8,
            ui: 0.9
        };
        
        // Sound definitions with categories and settings
        this.soundDefinitions = {
            // Bubble Actions
            bubbleShoot: { category: 'effects', volume: 0.8, file: 'sounds/bubble-shoot.wav' },
            bubbleBounce: { category: 'effects', volume: 0.6, file: 'sounds/bubble-bounce.wav' },
            bubbleAttach: { category: 'effects', volume: 0.7, file: 'sounds/bubble-attach.wav' },
            bubblePopSingle: { category: 'effects', volume: 0.8, file: 'sounds/bubble-pop-single.wav' },
            bubblePopMultiple: { category: 'effects', volume: 0.9, file: 'sounds/bubble-pop-multiple.wav' },
            bubbleFloat: { category: 'effects', volume: 0.6, file: 'sounds/bubble-float.wav' },
            
            // Power-Up Sounds
            rainbowActivate: { category: 'effects', volume: 1.0, file: 'sounds/rainbow-activate.wav' },
            bombExplode: { category: 'effects', volume: 1.0, file: 'sounds/bomb-explode.mp3' },
            lightningStrike: { category: 'effects', volume: 1.0, file: 'sounds/lightning-strike.wav' },
            precisionActivate: { category: 'effects', volume: 0.8, file: 'sounds/precision-activate.wav' },
            precisionTick: { category: 'effects', volume: 0.5, file: 'sounds/precision-tick.wav' },
            colorSplash: { category: 'effects', volume: 0.9, file: 'sounds/color-splash.wav' },
            powerUpSpawn: { category: 'effects', volume: 0.7, file: 'sounds/powerup-spawn.wav' },
            
            // UI/Feedback
            uiHover: { category: 'ui', volume: 0.3, file: 'sounds/ui-hover.wav' },
            uiClick: { category: 'ui', volume: 0.5, file: 'sounds/ui-click.wav' },
            chargePower: { category: 'effects', volume: 0.6, file: 'sounds/charge-power.wav' },
            trajectoryWoosh: { category: 'effects', volume: 0.2, file: 'sounds/trajectory-woosh.wav' },
            
            // Combo/Scoring
            combo2x: { category: 'effects', volume: 0.8, file: 'sounds/combo-2x.wav' },
            combo3x: { category: 'effects', volume: 0.9, file: 'sounds/combo-3x.wav' },
            combo4x: { category: 'effects', volume: 1.0, file: 'sounds/combo-4x.wav' },
            scoreTick: { category: 'ui', volume: 0.4, file: 'sounds/score-tick.wav' },
            bonusPoints: { category: 'effects', volume: 0.9, file: 'sounds/bonus-points.wav' },
            
            // Game State
            gameStart: { category: 'ui', volume: 0.8, file: 'sounds/game-start.wav' },
            levelComplete: { category: 'ui', volume: 1.0, file: 'sounds/level-complete.wav' },
            gameOver: { category: 'ui', volume: 0.9, file: 'sounds/game-over.wav' },
            warning: { category: 'ui', volume: 0.8, file: 'sounds/warning.wav' },
            pause: { category: 'ui', volume: 0.6, file: 'sounds/pause.wav' },
            resume: { category: 'ui', volume: 0.6, file: 'sounds/resume.wav' },
            
            // Particle/Effect Sounds
            particleSparkle: { category: 'effects', volume: 0.3, file: 'sounds/particle-sparkle.wav' },
            screenShake: { category: 'effects', volume: 0.7, file: 'sounds/screen-shake.wav' },
            electricArc: { category: 'effects', volume: 0.6, file: 'sounds/electric-arc.wav' }
        };
        
        this.loadingSounds = new Set();
        this.loadedSounds = new Set();
        this.failedSounds = new Set(); // Cache failed sound loads to prevent repeated requests
    }
    
    async init() {
        // Pre-load critical sounds
        const criticalSounds = [
            'bubbleShoot', 'bubbleAttach', 'bubblePopSingle', 'bubblePopMultiple',
            'uiClick', 'gameStart'
        ];
        
        for (const soundName of criticalSounds) {
            await this.loadSound(soundName);
        }
        
        // Load remaining sounds asynchronously without blocking
        setTimeout(() => {
            for (const soundName in this.soundDefinitions) {
                if (!criticalSounds.includes(soundName)) {
                    this.loadSound(soundName); // Errors are already handled in loadSound()
                }
            }
        }, 100); // Small delay to let the game start first
    }
    
    async loadSound(soundName) {
        // Skip if already loading, loaded, or failed
        if (this.loadingSounds.has(soundName) || this.loadedSounds.has(soundName) || this.failedSounds.has(soundName)) {
            return;
        }
        
        this.loadingSounds.add(soundName);
        const soundDef = this.soundDefinitions[soundName];
        
        if (!soundDef) {
            console.warn(`Sound definition not found: ${soundName}`);
            this.failedSounds.add(soundName);
            this.loadingSounds.delete(soundName);
            return;
        }
        
        try {
            const audio = new Audio(soundDef.file);
            audio.volume = soundDef.volume * this.soundCategories[soundDef.category] * this.volume;
            
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Sound load timeout'));
                }, 5000); // 5 second timeout
                
                audio.addEventListener('canplaythrough', () => {
                    clearTimeout(timeout);
                    resolve();
                }, { once: true });
                
                audio.addEventListener('error', (e) => {
                    clearTimeout(timeout);
                    reject(e);
                }, { once: true });
                
                audio.load();
            });
            
            this.sounds.set(soundName, {
                audio: audio,
                definition: soundDef,
                pool: [audio] // Pool for overlapping sounds
            });
            
            this.loadedSounds.add(soundName);
            console.log(`Successfully loaded sound: ${soundName}`);
        } catch (error) {
            console.warn(`Failed to load sound ${soundName} (will not retry):`, error.message);
            this.failedSounds.add(soundName); // Cache the failure to prevent future attempts
        } finally {
            this.loadingSounds.delete(soundName);
        }
    }
    
    play(soundName, options = {}) {
        if (!this.enabled) return;
        
        // Skip if this sound previously failed to load
        if (this.failedSounds.has(soundName)) {
            return;
        }
        
        const soundData = this.sounds.get(soundName);
        if (!soundData) {
            // Try to load it if not yet loaded (and not failed)
            if (!this.loadingSounds.has(soundName)) {
                this.loadSound(soundName);
            }
            return;
        }
        
        // Get audio from pool or clone if all are playing
        let audio = null;
        for (const pooledAudio of soundData.pool) {
            if (pooledAudio.paused || pooledAudio.ended) {
                audio = pooledAudio;
                break;
            }
        }
        
        if (!audio) {
            // All pool instances are playing, create a new one
            audio = soundData.audio.cloneNode();
            soundData.pool.push(audio);
        }
        
        // Apply volume settings
        const categoryVolume = this.soundCategories[soundData.definition.category];
        const finalVolume = (options.volume || soundData.definition.volume) * categoryVolume * this.volume;
        audio.volume = Math.max(0, Math.min(1, finalVolume));
        
        // Apply playback rate if specified
        if (options.rate) {
            audio.playbackRate = options.rate;
        }
        
        // Reset and play
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.warn(`Failed to play sound: ${soundName}`, err);
        });
        
        return audio;
    }
    
    playWithVariation(soundName, options = {}) {
        // Add slight pitch variation for repeated sounds
        const variation = 0.1;
        const rate = 1 + (Math.random() - 0.5) * variation;
        return this.play(soundName, { ...options, rate });
    }
    
    playCombo(comboLevel) {
        if (comboLevel === 2) {
            this.play('combo2x');
        } else if (comboLevel === 3) {
            this.play('combo3x');
        } else if (comboLevel >= 4) {
            this.play('combo4x', { rate: 1 + (comboLevel - 4) * 0.1 });
        }
    }
    
    stopAll() {
        for (const [soundName, soundData] of this.sounds) {
            for (const audio of soundData.pool) {
                audio.pause();
                audio.currentTime = 0;
            }
        }
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.stopAll();
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        // Update all loaded sounds
        for (const [soundName, soundData] of this.sounds) {
            const categoryVolume = this.soundCategories[soundData.definition.category];
            for (const audio of soundData.pool) {
                audio.volume = soundData.definition.volume * categoryVolume * this.volume;
            }
        }
    }
    
    setCategoryVolume(category, volume) {
        this.soundCategories[category] = Math.max(0, Math.min(1, volume));
        // Update affected sounds
        for (const [soundName, soundData] of this.sounds) {
            if (soundData.definition.category === category) {
                for (const audio of soundData.pool) {
                    audio.volume = soundData.definition.volume * this.soundCategories[category] * this.volume;
                }
            }
        }
    }
    
    /**
     * Get status of all sounds for debugging
     * @returns {Object} Status object with loaded/failed/pending counts
     */
    getStatus() {
        const total = Object.keys(this.soundDefinitions).length;
        const loaded = this.loadedSounds.size;
        const failed = this.failedSounds.size;
        const loading = this.loadingSounds.size;
        const pending = total - loaded - failed - loading;
        
        return {
            total,
            loaded,
            failed,
            loading,
            pending,
            failedSounds: Array.from(this.failedSounds),
            loadedSounds: Array.from(this.loadedSounds)
        };
    }
    
    /**
     * Manually mark a sound as failed (for testing)
     * @param {string} soundName - Name of sound to mark as failed
     */
    markSoundAsFailed(soundName) {
        this.failedSounds.add(soundName);
        this.loadingSounds.delete(soundName);
        console.warn(`Manually marked sound as failed: ${soundName}`);
    }
}