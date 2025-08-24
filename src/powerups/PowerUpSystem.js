/**
 * Power-Up System Manager
 * Manages all power-ups in the game
 */
export class PowerUpSystem {
    constructor(eventBus, soundManager) {
        this.eventBus = eventBus;
        this.soundManager = soundManager;
        this.powerUps = new Map();
        this.activePowerUps = [];
        this.totalSpawnRate = 0;
    }
    
    /**
     * Register a power-up type
     * @param {PowerUp} powerUp - The power-up instance to register
     */
    registerPowerUp(powerUp) {
        this.powerUps.set(powerUp.type, powerUp);
        this.totalSpawnRate += powerUp.spawnRate;
    }
    
    /**
     * Check if a power-up should spawn
     * @returns {boolean} Whether to spawn a power-up
     */
    shouldSpawnPowerUp() {
        return Math.random() < this.totalSpawnRate;
    }
    
    /**
     * Get a random power-up based on spawn rates
     * @returns {PowerUp} A random power-up instance
     */
    getRandomPowerUp() {
        const rand = Math.random() * this.totalSpawnRate;
        let accumulator = 0;
        
        for (const [type, powerUp] of this.powerUps) {
            accumulator += powerUp.spawnRate;
            if (rand < accumulator) {
                return powerUp;
            }
        }
        
        // Fallback to first power-up
        return this.powerUps.values().next().value;
    }
    
    /**
     * Apply a power-up to a bubble
     * @param {Bubble} bubble - The bubble to apply the power-up to
     * @returns {PowerUp|null} The applied power-up or null
     */
    applyPowerUpToBubble(bubble) {
        if (this.shouldSpawnPowerUp()) {
            const powerUp = this.getRandomPowerUp();
            powerUp.createVisualEffect(bubble);
            this.soundManager.play('powerUpSpawn');
            console.log(`Created ${powerUp.type} power-up`);
            return powerUp;
        }
        return null;
    }
    
    /**
     * Activate a power-up from a bubble
     * @param {Bubble} bubble - The bubble with the power-up
     * @param {GameState} gameState - Current game state
     * @param {GameManager} gameManager - Game manager instance
     * @returns {boolean} Whether the activation was successful
     */
    activatePowerUp(bubble, gameState, gameManager) {
        if (bubble.isPowerUp && bubble.powerUpType) {
            const powerUp = this.powerUps.get(bubble.powerUpType);
            if (powerUp) {
                // Pass the bubble object for all power-ups to allow proper cleanup
                return powerUp.activate(bubble, gameState, gameManager);
            }
        }
        return false;
    }
    
    /**
     * Update active power-ups
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Update active power-ups
        this.activePowerUps = this.activePowerUps.filter(powerUp => {
            powerUp.duration -= deltaTime;
            return powerUp.duration > 0;
        });
        
        // Update all registered power-ups (for particle pools, etc.)
        for (const powerUp of this.powerUps.values()) {
            if (powerUp.update) {
                powerUp.update(deltaTime);
            }
        }
    }
    
    /**
     * Get all registered power-ups
     * @returns {Map} Map of all power-ups
     */
    getAllPowerUps() {
        return this.powerUps;
    }
    
    /**
     * Get a specific power-up by type
     * @param {string} type - Power-up type
     * @returns {PowerUp|undefined} The power-up instance
     */
    getPowerUp(type) {
        return this.powerUps.get(type);
    }
    
    /**
     * Clear all active power-ups
     */
    clearActivePowerUps() {
        this.activePowerUps = [];
    }
}