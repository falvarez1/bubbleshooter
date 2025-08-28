import { CONFIG } from '../core/Config.js';

/**
 * Optimized Sound Manager for handling high-frequency audio events
 * Implements audio throttling, batching, and pooling for performance
 */
export class OptimizedSoundManager {
    constructor() {
        this.sounds = new Map();
        
        // Audio settings
        this.musicEnabled = CONFIG.MUSIC_ENABLED !== undefined ? CONFIG.MUSIC_ENABLED : true;
        this.effectsEnabled = CONFIG.SOUND_ENABLED !== undefined ? CONFIG.SOUND_ENABLED : true;
        this.musicVolume = CONFIG.MUSIC_VOLUME !== undefined ? CONFIG.MUSIC_VOLUME : 0.5;
        this.effectsVolume = CONFIG.SOUND_VOLUME !== undefined ? CONFIG.SOUND_VOLUME : 0.5;
        
        // Performance optimization settings
        this.maxConcurrentSounds = 8; // Limit concurrent audio instances
        this.soundThrottleMs = 50; // Minimum ms between same sound
        this.batchWindowMs = 100; // Window for batching similar sounds
        
        // Tracking for throttling and batching
        this.lastPlayTime = new Map(); // Track last play time per sound
        this.activeSounds = new Set(); // Currently playing sounds
        this.batchQueue = new Map(); // Queue for batched sounds
        this.batchTimers = new Map(); // Timers for batch processing
        
        // Sound pool limits (prevent unbounded growth)
        this.maxPoolSize = 3; // Max instances per sound in pool
        
        // Category volumes
        this.soundCategories = {
            effects: 1.0,
            music: 1.0,
            ui: 0.9
        };
        
        // Sound definitions
        this.soundDefinitions = {
            // Bubble Actions
            bubbleShoot: { category: 'effects', volume: 0.8, priority: 2 },
            bubbleBounce: { category: 'effects', volume: 0.6, priority: 1 },
            bubbleAttach: { category: 'effects', volume: 0.7, priority: 2 },
            bubblePopSingle: { category: 'effects', volume: 0.8, priority: 3, batchable: true },
            bubblePopMultiple: { category: 'effects', volume: 0.9, priority: 4, batchable: true },
            bubbleFloat: { category: 'effects', volume: 0.6, priority: 1 },
            
            // Power-Ups (high priority, no batching)
            rainbowActivate: { category: 'effects', volume: 1.0, priority: 5 },
            bombExplode: { category: 'effects', volume: 0.3, priority: 5 },
            lightningStrike: { category: 'effects', volume: 1.0, priority: 5 },
            chainLightningBatch: { category: 'effects', volume: 0.9, priority: 5 }, // New batched sound
            
            // UI
            uiClick: { category: 'ui', volume: 0.5, priority: 2 },
            warning: { category: 'ui', volume: 0.8, priority: 4 }
        };
        
        this.loadedSounds = new Set();
        this.failedSounds = new Set();
    }
    
    /**
     * Play a sound with optimizations
     */
    play(soundName, options = {}) {
        // Skip if disabled
        if (!this.effectsEnabled) return;
        
        const soundDef = this.soundDefinitions[soundName];
        if (!soundDef) return;
        
        // Check if this sound is batchable and should be queued
        if (soundDef.batchable && !options.immediate) {
            return this.queueBatchedSound(soundName, options);
        }
        
        // Throttle check - prevent same sound playing too frequently
        const now = Date.now();
        const lastPlay = this.lastPlayTime.get(soundName) || 0;
        if (now - lastPlay < this.soundThrottleMs && !options.force) {
            return; // Skip this sound
        }
        
        // Check concurrent sound limit
        if (this.activeSounds.size >= this.maxConcurrentSounds) {
            // Remove lowest priority sound if this one is higher priority
            const lowestPriority = this.findLowestPrioritySound();
            if (lowestPriority && soundDef.priority > lowestPriority.priority) {
                this.stopSound(lowestPriority.soundName);
            } else {
                return; // Skip this sound
            }
        }
        
        // Play the sound
        this.playImmediate(soundName, options);
        this.lastPlayTime.set(soundName, now);
    }
    
    /**
     * Queue a batchable sound
     */
    queueBatchedSound(soundName, options) {
        // Add to batch queue
        if (!this.batchQueue.has(soundName)) {
            this.batchQueue.set(soundName, []);
        }
        this.batchQueue.get(soundName).push(options);
        
        // Set up batch timer if not already set
        if (!this.batchTimers.has(soundName)) {
            const timer = setTimeout(() => {
                this.processBatchedSounds(soundName);
                this.batchTimers.delete(soundName);
            }, this.batchWindowMs);
            this.batchTimers.set(soundName, timer);
        }
    }
    
    /**
     * Process batched sounds
     */
    processBatchedSounds(soundName) {
        const batch = this.batchQueue.get(soundName);
        if (!batch || batch.length === 0) return;
        
        // Clear the queue
        this.batchQueue.delete(soundName);
        
        // For multiple pops, play a single "multiple" sound instead
        if (soundName === 'bubblePopSingle' && batch.length > 2) {
            this.playImmediate('bubblePopMultiple', {
                volume: Math.min(1.0, 0.7 + batch.length * 0.02) // Scale volume with count
            });
        } else {
            // Play single instance with averaged parameters
            const avgVolume = batch.reduce((sum, opt) => sum + (opt.volume || 1), 0) / batch.length;
            this.playImmediate(soundName, {
                volume: Math.min(1.0, avgVolume)
            });
        }
    }
    
    /**
     * Play sound immediately (internal method)
     */
    playImmediate(soundName, options = {}) {
        // This is a simplified version - in real implementation would use actual Audio objects
        // For now, we'll use a mock implementation
        const soundDef = this.soundDefinitions[soundName];
        const volume = (options.volume || soundDef.volume) * this.effectsVolume;
        
        // Track as active
        const soundInstance = {
            soundName,
            priority: soundDef.priority,
            startTime: Date.now()
        };
        this.activeSounds.add(soundInstance);
        
        // Auto-remove after typical sound duration (mock)
        setTimeout(() => {
            this.activeSounds.delete(soundInstance);
        }, 500);
        
        // In real implementation, would play actual audio here
        console.log(`Playing optimized sound: ${soundName} at volume ${volume}`);
    }
    
    /**
     * Find lowest priority active sound
     */
    findLowestPrioritySound() {
        let lowest = null;
        for (const sound of this.activeSounds) {
            if (!lowest || sound.priority < lowest.priority) {
                lowest = sound;
            }
        }
        return lowest;
    }
    
    /**
     * Stop a specific sound
     */
    stopSound(soundName) {
        // Remove from active sounds
        for (const sound of this.activeSounds) {
            if (sound.soundName === soundName) {
                this.activeSounds.delete(sound);
                break;
            }
        }
    }
    
    /**
     * Play special batched chain lightning sound
     */
    playChainLightningBatch(count) {
        // Play a single optimized sound for chain lightning
        // instead of individual pops
        this.play('chainLightningBatch', {
            immediate: true,
            force: true,
            volume: Math.min(1.0, 0.6 + count * 0.01)
        });
    }
    
    /**
     * Clear all batch queues (useful when game state changes)
     */
    clearBatchQueues() {
        // Clear all timers
        for (const timer of this.batchTimers.values()) {
            clearTimeout(timer);
        }
        this.batchTimers.clear();
        this.batchQueue.clear();
    }
    
    /**
     * Stop all sounds
     */
    stopAll() {
        this.activeSounds.clear();
        this.clearBatchQueues();
    }
    
    // Compatibility methods with existing SoundManager
    
    playWithVariation(soundName, options = {}) {
        // Skip pitch variation for performance
        return this.play(soundName, options);
    }
    
    setEffectsEnabled(enabled) {
        this.effectsEnabled = enabled;
        if (!enabled) {
            this.stopAll();
        }
    }
    
    setEffectsVolume(volume) {
        this.effectsVolume = Math.max(0, Math.min(1, volume));
    }
    
    getEffectsEnabled() {
        return this.effectsEnabled;
    }
    
    getEffectsVolume() {
        return this.effectsVolume;
    }
}