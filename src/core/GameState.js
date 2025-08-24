import * as THREE from 'three';
import { CONFIG } from './Config.js';

/**
 * Game State Management
 * Manages all game state data and provides methods for state manipulation
 */
export class GameState {
    constructor() {
        this.reset();
    }
    
    reset() {
        // Game status
        this.score = 0;
        this.level = 1;
        this.combo = 0;
        this.bestCombo = 0;
        this.comboTimer = null;
        this.isGameOver = false;
        this.isPaused = false;
        
        // Progressive game mechanics
        this.dangerZone = {
            active: false,
            level: 0,
            timeSlowFactor: 1.0,
            warningAnimationTime: 0
        };
        
        // Bubble management
        this.currentBubble = null;
        this.nextBubbleColor = null;
        this.bubbleGrid = this.initializeBubbleGrid();
        
        // Shooting mechanics
        this.shootingPower = 0;
        this.isCharging = false;
        this.mousePosition = new THREE.Vector2();
        this.trajectory = [];
        
        // Visual effects
        this.particles = [];
        this.particlePool = null; // Will be initialized by game manager
        this.animations = [];
        
        // Time scale for slow motion effects
        this.timeScale = 1.0;
        
        // Power-up states
        this.precisionAimActive = false;
        this.precisionAimTime = 0;
        this.extendedTrajectory = false;
        
        // Collected power-ups
        this.collectedPowerUps = [];
        this.activePowerUp = null;
        
        // Starfield and background effects
        this.starfieldLayers = [];
        this.shootingStars = [];
        this.nebula = null;
        this.heatHaze = null;
        this.dangerField = null;
    }
    
    initializeBubbleGrid() {
        const grid = [];
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            grid[y] = [];
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                grid[y][x] = null;
            }
        }
        return grid;
    }
    
    // Score management
    addScore(points) {
        this.score += points;
        
        // Check level progression
        const newLevel = Math.floor(this.score / 1000) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            return true; // Level increased
        }
        return false;
    }
    
    // Combo management
    incrementCombo() {
        this.combo++;
        if (this.combo > this.bestCombo) {
            this.bestCombo = this.combo;
        }
        
        // Reset combo timer
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
        }
        
        this.comboTimer = setTimeout(() => {
            this.combo = 0;
            // Emit combo end event for progressive timer system
            if (window.game && window.game.gameManager) {
                window.game.gameManager.eventBus.emit('comboEnd');
            }
        }, CONFIG.COMBO_TIMEOUT);
        
        return this.combo + 1; // Return display combo (1-based)
    }
    
    resetCombo() {
        this.combo = 0;
        if (this.comboTimer) {
            clearTimeout(this.comboTimer);
            this.comboTimer = null;
        }
    }
    
    // Grid management
    getBubbleAt(x, y) {
        if (y >= 0 && y < CONFIG.GRID_HEIGHT) {
            // All rows now have the same width
            if (x >= 0 && x < CONFIG.GRID_WIDTH) {
                return this.bubbleGrid[y][x];
            }
        }
        return null;
    }
    
    setBubbleAt(x, y, bubble) {
        if (y >= 0 && y < CONFIG.GRID_HEIGHT) {
            // All rows now have the same width
            if (x >= 0 && x < CONFIG.GRID_WIDTH) {
                this.bubbleGrid[y][x] = bubble;
                if (bubble) {
                    bubble.gridX = x;
                    bubble.gridY = y;
                }
                return true;
            }
        }
        return false;
    }
    
    removeBubbleAt(x, y) {
        const bubble = this.getBubbleAt(x, y);
        if (bubble) {
            this.setBubbleAt(x, y, null);
            return bubble;
        }
        return null;
    }
    
    // Get all bubbles in the grid
    getAllBubbles() {
        const bubbles = [];
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            // All rows now have the same width
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = this.bubbleGrid[y][x];
                // Only include non-destroyed bubbles
                if (bubble && !bubble.isDestroyed) {
                    bubbles.push(bubble);
                }
            }
        }
        return bubbles;
    }
    
    // Count bubbles
    countBubbles(filterFn = null) {
        let count = 0;
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            // All rows now have the same width
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = this.bubbleGrid[y][x];
                // Only count non-destroyed bubbles
                if (bubble && !bubble.isDestroyed && (!filterFn || filterFn(bubble))) {
                    count++;
                }
            }
        }
        return count;
    }
    
    // Check if position is valid grid position
    isValidGridPosition(x, y) {
        if (y < 0 || y >= CONFIG.GRID_HEIGHT) return false;
        // All rows now have the same width
        return x >= 0 && x < CONFIG.GRID_WIDTH;
    }
    
    // Shift all rows down (for adding new rows)
    shiftRowsDown() {
        // Much simpler now that all rows have the same width!
        // Create a new grid to avoid reference issues
        const newGrid = Array(CONFIG.GRID_HEIGHT).fill(null).map(() => Array(CONFIG.GRID_WIDTH).fill(null));
        
        // Copy bubbles to their new positions (one row down)
        for (let y = 0; y < CONFIG.GRID_HEIGHT - 1; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = this.bubbleGrid[y][x];
                if (bubble) {
                    // Place bubble in new position (one row down)
                    newGrid[y + 1][x] = bubble;
                    // Update bubble's grid coordinates
                    bubble.gridX = x;
                    bubble.gridY = y + 1;
                }
            }
        }
        
        // Top row stays empty (will be filled with new bubbles)
        // Already null from initialization
        
        // Replace the old grid with the new one
        this.bubbleGrid = newGrid;
    }
    
    // Animation management
    addAnimation(animation) {
        this.animations.push(animation);
    }
    
    updateAnimations(deltaTime) {
        // Skip if no animations
        if (this.animations.length === 0) return;
        
        this.animations = this.animations.filter(animation => {
            return animation.update(deltaTime);
        });
    }
    
    // Particle management
    addParticle(particle) {
        this.particles.push(particle);
    }
    
    updateParticles(deltaTime) {
        // Update particle pool if it exists
        if (this.particlePool) {
            this.particlePool.update(deltaTime);
        }
        
        // Update legacy particles only if there are any
        if (this.particles.length > 0) {
            this.particles = this.particles.filter(particle => {
                return particle.update(deltaTime);
            });
        }
    }
    
    // Power-up state management
    activatePrecisionAim(duration) {
        this.precisionAimActive = true;
        this.precisionAimTime = duration;
        this.extendedTrajectory = true;
    }
    
    deactivatePrecisionAim() {
        this.precisionAimActive = false;
        this.precisionAimTime = 0;
        this.extendedTrajectory = false;
    }
    
    updatePrecisionAim(deltaTime) {
        if (this.precisionAimActive) {
            this.precisionAimTime -= deltaTime;
            if (this.precisionAimTime <= 0) {
                this.deactivatePrecisionAim();
                return false;
            }
            return true;
        }
        return false;
    }
    
    // Game over
    setGameOver() {
        this.isGameOver = true;
        this.resetCombo();
    }
    
    // Pause/Resume
    pause() {
        this.isPaused = true;
    }
    
    resume() {
        this.isPaused = false;
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }
    
    // Power-up collection management
    collectPowerUp(powerUpType, powerUpInfo) {
        // Allow up to 3 power-ups to be collected
        const MAX_COLLECTED_POWERUPS = 3;
        if (this.collectedPowerUps.length < MAX_COLLECTED_POWERUPS) {
            this.collectedPowerUps.push({ type: powerUpType, info: powerUpInfo });
            return true;
        }
        return false;
    }
    
    hasCollectedPowerUp() {
        return this.collectedPowerUps.length > 0;
    }
    
    getCollectedPowerUps() {
        return this.collectedPowerUps;
    }
    
    getCollectedPowerUpAt(index) {
        return this.collectedPowerUps[index] || null;
    }
    
    consumeCollectedPowerUpAt(index) {
        if (index >= 0 && index < this.collectedPowerUps.length) {
            return this.collectedPowerUps.splice(index, 1)[0];
        }
        return null;
    }
    
    clearCollectedPowerUps() {
        this.collectedPowerUps = [];
        this.activePowerUp = null;
    }
}