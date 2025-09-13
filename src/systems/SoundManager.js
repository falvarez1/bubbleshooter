import { CONFIG } from '../core/Config.js';

/**
 * Sound Manager
 * Advanced sound system for managing all game sound effects
 */
export class SoundManager {
    constructor() {
        this.sounds = new Map();
        
        // Separate enable/disable for music and effects
        this.musicEnabled = CONFIG.MUSIC_ENABLED !== undefined ? CONFIG.MUSIC_ENABLED : true;
        this.effectsEnabled = CONFIG.SOUND_ENABLED !== undefined ? CONFIG.SOUND_ENABLED : true;
        
        // Master volumes for music and effects
        this.musicVolume = CONFIG.MUSIC_VOLUME !== undefined ? CONFIG.MUSIC_VOLUME : 0.5;
        this.effectsVolume = CONFIG.SOUND_VOLUME !== undefined ? CONFIG.SOUND_VOLUME : 0.5;
        
        // Audio throttling for performance
        this.lastPlayTimes = new Map();
        this.minPlayInterval = 30; // Minimum ms between same sound
        this.maxConcurrentSounds = 10; // Limit concurrent sounds
        this.activeSounds = new Set();
        
        // Performance monitoring
        this.performanceStats = {
            throttledSounds: 0,
            skippedDueToLimit: 0,
            skippedDueToPoolFull: 0,
            totalPlayed: 0,
            lastReset: Date.now()
        };
        
        // Category volume multipliers (relative to master volumes)
        this.soundCategories = {
            effects: 1.0,
            music: 1.0,
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
            bombExplode: { category: 'effects', volume: 0.3, file: 'sounds/bomb-explode.mp3' },
            lightningStrike: { category: 'effects', volume: 1.0, file: 'sounds/lightning-strike.wav' },
            chainLightningThrow: { category: 'effects', volume: 0.9, file: 'sounds/chain-lightning-throw.m4a' },
            precisionActivate: { category: 'effects', volume: 0.8, file: 'sounds/precision-activate.wav' },
            precisionTick: { category: 'effects', volume: 0.5, file: 'sounds/precision-tick.wav' },
            colorSplash: { category: 'effects', volume: 0.9, file: 'sounds/color-splash.wav' },
            powerUpSpawn: { category: 'effects', volume: 0.7, file: 'sounds/powerup-spawn.wav' },
            powerUpCollect: { category: 'effects', volume: 0.8, file: 'sounds/powerup-collect.wav' },
            powerUpActivate: { category: 'effects', volume: 0.9, file: 'sounds/powerup-activate.wav' },
            
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
            rowsDescending: { category: 'effects', volume: 0.7, file: 'sounds/rows-descending.m4a' },
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
            const masterVolume = soundDef.category === 'music' ? this.musicVolume : this.effectsVolume;
            audio.volume = soundDef.volume * this.soundCategories[soundDef.category] * masterVolume;
            
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
        const soundData = this.sounds.get(soundName);
        
        // Check if sound exists and is enabled based on category
        if (!soundData) {
            // Try to load it if not yet loaded (and not failed)
            if (!this.failedSounds.has(soundName) && !this.loadingSounds.has(soundName)) {
                this.loadSound(soundName);
            }
            return;
        }
        
        // Check if this category is enabled
        const category = soundData.definition.category;
        if (category === 'music' && !this.musicEnabled) return;
        if ((category === 'effects' || category === 'ui') && !this.effectsEnabled) return;
        
        // Skip if this sound previously failed to load
        if (this.failedSounds.has(soundName)) {
            return;
        }
        
        // Throttle check - prevent same sound playing too frequently
        const now = Date.now();
        const lastPlayTime = this.lastPlayTimes.get(soundName) || 0;
        if (now - lastPlayTime < this.minPlayInterval && !options.force) {
            this.performanceStats.throttledSounds++;
            return; // Skip this sound
        }
        
        // Check concurrent sound limit
        if (this.activeSounds.size >= this.maxConcurrentSounds) {
            // Skip non-priority sounds when at limit
            if (!options.priority) {
                this.performanceStats.skippedDueToLimit++;
                return;
            }
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
            // Check pool size limit (prevent unbounded growth)
            const maxPoolSize = 3; // Maximum instances per sound
            if (soundData.pool.length < maxPoolSize) {
                // Create a new instance if under limit
                audio = soundData.audio.cloneNode();
                soundData.pool.push(audio);
            } else {
                // Pool is full, skip this sound to prevent performance issues
                this.performanceStats.skippedDueToPoolFull++;
                console.debug(`Sound pool full for ${soundName}, skipping`);
                return;
            }
        }
        
        // Apply volume settings based on category
        const categoryMultiplier = this.soundCategories[category];
        const masterVolume = category === 'music' ? this.musicVolume : this.effectsVolume;
        const finalVolume = (options.volume || soundData.definition.volume) * categoryMultiplier * masterVolume;
        audio.volume = Math.max(0, Math.min(1, finalVolume));
        
        // Apply playback rate if specified
        if (options.rate) {
            audio.playbackRate = options.rate;
        }
        
        // Reset and play
        audio.currentTime = 0;
        
        // Track this sound as active
        this.lastPlayTimes.set(soundName, Date.now());
        this.activeSounds.add(audio);
        this.performanceStats.totalPlayed++;
        
        // Remove from active sounds when finished
        audio.onended = () => {
            this.activeSounds.delete(audio);
        };
        
        audio.play().catch(err => {
            console.warn(`Failed to play sound: ${soundName}`, err);
            this.activeSounds.delete(audio);
        });
        
        return audio;
    }
    
    playWithVariation(soundName, options = {}) {
        // Skip variation for performance during batch operations
        if (options.skipVariation || this.activeSounds.size > 5) {
            return this.play(soundName, options);
        }
        // Add slight pitch variation for repeated sounds
        const variation = 0.1;
        const rate = 1 + (Math.random() - 0.5) * variation;
        return this.play(soundName, { ...options, rate });
    }
    
    /**
     * Play a batched sound for chain lightning or similar effects
     * @param {number} count - Number of bubbles being destroyed
     */
    playChainLightningBatch(count) {
        // Play a single sound for all bubbles instead of individual pops
        // Use the multiple pop sound with adjusted volume based on count
        this.play('bubblePopMultiple', {
            force: true, // Force play even if throttled
            priority: true, // High priority
            volume: Math.min(1.0, 0.6 + count * 0.01),
            rate: 0.9 // Slightly lower pitch for impact
        });
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
        // Stop all sounds in pools
        for (const [soundName, soundData] of this.sounds) {
            for (const audio of soundData.pool) {
                audio.pause();
                audio.currentTime = 0;
            }
        }
        
        // Clear active sounds tracking
        this.activeSounds.clear();
        this.lastPlayTimes.clear();
    }
    
    /**
     * Clean up stuck active sounds (sounds that should have ended)
     * Call this periodically or when performance issues are detected
     */
    cleanupActiveSounds() {
        const stuckSounds = [];
        for (const audio of this.activeSounds) {
            // Check if sound should have ended (duration > 10 seconds is likely stuck)
            if (audio.currentTime > 0 && audio.duration && audio.currentTime >= audio.duration - 0.1) {
                stuckSounds.push(audio);
            }
        }
        
        // Remove stuck sounds
        stuckSounds.forEach(audio => {
            this.activeSounds.delete(audio);
            console.debug('Cleaned up stuck sound');
        });
        
        return stuckSounds.length;
    }
    
    setMusicEnabled(enabled) {
        this.musicEnabled = enabled;
        if (!enabled) {
            this.stopCategory('music');
        }
    }
    
    setEffectsEnabled(enabled) {
        this.effectsEnabled = enabled;
        if (!enabled) {
            this.stopCategory('effects');
            this.stopCategory('ui');
        }
    }
    
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.updateCategoryVolumes('music');
    }
    
    setEffectsVolume(volume) {
        this.effectsVolume = Math.max(0, Math.min(1, volume));
        this.updateCategoryVolumes('effects');
        this.updateCategoryVolumes('ui');
    }
    
    updateCategoryVolumes(category) {
        const masterVolume = category === 'music' ? this.musicVolume : this.effectsVolume;
        for (const [soundName, soundData] of this.sounds) {
            if (soundData.definition.category === category) {
                const categoryMultiplier = this.soundCategories[category];
                for (const audio of soundData.pool) {
                    audio.volume = soundData.definition.volume * categoryMultiplier * masterVolume;
                }
            }
        }
    }
    
    stopCategory(category) {
        for (const [soundName, soundData] of this.sounds) {
            if (soundData.definition.category === category) {
                for (const audio of soundData.pool) {
                    audio.pause();
                    audio.currentTime = 0;
                }
            }
        }
    }
    
    setCategoryVolume(category, volume) {
        this.soundCategories[category] = Math.max(0, Math.min(1, volume));
        // Update affected sounds
        const masterVolume = category === 'music' ? this.musicVolume : this.effectsVolume;
        for (const [soundName, soundData] of this.sounds) {
            if (soundData.definition.category === category) {
                for (const audio of soundData.pool) {
                    audio.volume = soundData.definition.volume * this.soundCategories[category] * masterVolume;
                }
            }
        }
    }
    
    // Getter methods for UI
    getMusicEnabled() {
        return this.musicEnabled;
    }
    
    getEffectsEnabled() {
        return this.effectsEnabled;
    }
    
    getMusicVolume() {
        return this.musicVolume;
    }
    
    getEffectsVolume() {
        return this.effectsVolume;
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
     * Get performance statistics
     * @returns {Object} Performance stats including throttled and skipped sounds
     */
    getPerformanceStats() {
        const now = Date.now();
        const duration = (now - this.performanceStats.lastReset) / 1000; // in seconds
        
        return {
            ...this.performanceStats,
            duration: duration,
            activeSounds: this.activeSounds.size,
            soundsPerSecond: duration > 0 ? this.performanceStats.totalPlayed / duration : 0,
            throttleRate: this.performanceStats.totalPlayed > 0 
                ? (this.performanceStats.throttledSounds / this.performanceStats.totalPlayed) * 100 
                : 0
        };
    }
    
    /**
     * Reset performance statistics
     */
    resetPerformanceStats() {
        this.performanceStats = {
            throttledSounds: 0,
            skippedDueToLimit: 0,
            skippedDueToPoolFull: 0,
            totalPlayed: 0,
            lastReset: Date.now()
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