/**
 * Impact Freeze System
 * Handles micro-pauses and game feel enhancements on bubble impacts
 */
export class ImpactFreezeSystem {
    constructor() {
        this.freezeActive = false;
        this.freezeStartTime = 0;
        this.freezeDuration = 0;
        this.freezeCallback = null;
        
        // Configuration
        this.config = {
            bubbleAttach: {
                duration: 50,      // 3 frames at 60fps
                intensity: 1.0
            },
            powerUpActivation: {
                duration: 100,     // 6 frames at 60fps
                intensity: 1.5
            },
            bombExplosion: {
                duration: 150,     // 9 frames at 60fps
                intensity: 2.0
            },
            comboAchieved: {
                duration: 80,      // 5 frames at 60fps
                intensity: 1.2
            }
        };
    }
    
    /**
     * Trigger an impact freeze
     * @param {string} type - Type of impact (bubbleAttach, powerUpActivation, etc.)
     * @param {function} callback - Optional callback when freeze ends
     */
    triggerFreeze(type, callback = null) {
        const config = this.config[type];
        if (!config) return;
        
        this.freezeActive = true;
        this.freezeStartTime = performance.now();
        this.freezeDuration = config.duration;
        this.freezeCallback = callback;
        
        // Notify other systems about the freeze
        return {
            duration: config.duration,
            intensity: config.intensity
        };
    }
    
    /**
     * Update the freeze system
     * @param {number} deltaTime - Time since last frame
     * @returns {boolean} Whether the game should be frozen this frame
     */
    update(deltaTime) {
        if (!this.freezeActive) {
            return false;
        }
        
        const elapsed = performance.now() - this.freezeStartTime;
        
        if (elapsed >= this.freezeDuration) {
            this.freezeActive = false;
            
            if (this.freezeCallback) {
                this.freezeCallback();
                this.freezeCallback = null;
            }
            
            return false;
        }
        
        // Return true to indicate the game should pause this frame
        return true;
    }
    
    /**
     * Check if freeze is currently active
     * @returns {boolean}
     */
    isActive() {
        return this.freezeActive;
    }
    
    /**
     * Get freeze progress (0 to 1)
     * @returns {number}
     */
    getProgress() {
        if (!this.freezeActive) return 0;
        
        const elapsed = performance.now() - this.freezeStartTime;
        return Math.min(elapsed / this.freezeDuration, 1);
    }
    
    /**
     * Force end the current freeze
     */
    forceEnd() {
        this.freezeActive = false;
        
        if (this.freezeCallback) {
            this.freezeCallback();
            this.freezeCallback = null;
        }
    }
}