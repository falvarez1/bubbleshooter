import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { Bubble } from '../entities/Bubble.js';
import { ParticleFactory } from '../entities/Particle.js';
import { BubbleLifecycleManager } from '../managers/BubbleLifecycleManager.js';

/**
 * Game Logic System
 * Handles core game mechanics: matching, scoring, power-ups, etc.
 */
export class GameLogic {
    constructor(gameState, gameManager, scene) {
        this.gameState = gameState;
        this.gameManager = gameManager;
        this.scene = scene;
        this.bubbleInstances = null; // Will be set by main game
        this.collisionSystem = null; // Will be set by main game
        this.pauseSystem = null; // Will be set by main game
        
        // Set up event listeners for power-up effects
        this.setupEventListeners();
    }
    
    
    setupEventListeners() {
        // Only set up event listeners if gameManager has an eventBus
        if (!this.gameManager || !this.gameManager.eventBus) {
            console.log('GameLogic: No event bus available, skipping event listener setup');
            return;
        }
        
        // Chain Lightning destroy event
        this.gameManager.eventBus.on('chainLightningDestroy', (data) => {
            this.handleChainLightningDestroy(data.bubbles, data.points);
        });
        
        // Color Splash destroy event
        this.gameManager.eventBus.on('colorSplashDestroy', (data) => {
            this.handleColorSplashDestroy(data.bubbles, data.points);
        });
        
        // Bomb destroy event
        this.gameManager.eventBus.on('bombDestroy', (data) => {
            this.handleBombDestroy(data.bubbles, data.points);
        });
        
        // Check bubble matches event
        this.gameManager.eventBus.on('checkBubbleMatches', (data) => {
            this.checkMatches(data.bubble);
        });
        
        // Check floating bubbles event
        this.gameManager.eventBus.on('checkFloatingBubbles', () => {
            this.removeFloatingBubbles();
        });
        
        // Handle individual bubble destruction (e.g., from Chain Lightning)
        this.gameManager.eventBus.on('destroyBubble', (data) => {
            if (data.bubble && !data.bubble.isDestroyed) {
                this.destroyBubbleImmediately(data.bubble, data.skipAnimation);
            }
        });
    }
    
    handleChainLightningDestroy(bubbles, points) {
        // Calculate points per individual bubble
        const pointsPerBubble = Math.floor(points / bubbles.length);
        
        // Add score
        this.gameState.addScore(points);
        this.gameManager.eventBus.emit('scoreUpdated', { score: this.gameState.score });
        
        // Show individual floating score for each destroyed bubble
        bubbles.forEach((bubble, index) => {
            setTimeout(() => {
                // Only show score if not paused
                if (!this.pauseSystem || !this.pauseSystem.getIsPaused()) {
                    this.gameManager.showFloatingScore(bubble.position, pointsPerBubble);
                }
            }, index * 25); // Quick succession for lightning effect
        });
        
        // Bubbles have already been removed from grid and instanced renderer by the power-up
        // Clean up any remaining effects and dispose resources
        bubbles.forEach((bubble, index) => {
            setTimeout(() => {
                // Clean up effects for this bubble
                if (this.gameManager.effectsSystem) {
                    this.gameManager.effectsSystem.cleanupBubbleEffects(bubble.id);
                }
                
                // Dispose of individual mesh resources (not used for rendering but still allocated)
                if (bubble.mesh) {
                    if (bubble.mesh.geometry) bubble.mesh.geometry.dispose();
                    if (bubble.mesh.material) {
                        if (Array.isArray(bubble.mesh.material)) {
                            bubble.mesh.material.forEach(mat => mat.dispose());
                        } else {
                            bubble.mesh.material.dispose();
                        }
                    }
                }
            }, index * 50); // Stagger cleanup
        });
        
        // Check for floating bubbles after destruction
        setTimeout(() => {
            this.removeFloatingBubbles();
            setTimeout(() => this.checkVictory(), 500);
        }, bubbles.length * 50 + 400); // Allow extra time for effects cleanup
    }
    
    handleColorSplashDestroy(bubbles, points) {
        // Calculate points per individual bubble
        const pointsPerBubble = Math.floor(points / bubbles.length);
        
        // Add score
        this.gameState.addScore(points);
        if (this.gameManager && this.gameManager.eventBus) {
            this.gameManager.eventBus.emit('scoreUpdated', { score: this.gameState.score });
        }
        
        // Remove bubbles with individual point displays
        bubbles.forEach((bubble, index) => {
            setTimeout(() => {
                // Skip if already destroyed
                if (bubble.isDestroyed) return;
                
                // Show individual points for this bubble
                // Only show score if not paused
                if (this.gameManager && this.gameManager.showFloatingScore && 
                    (!this.pauseSystem || !this.pauseSystem.getIsPaused())) {
                    this.gameManager.showFloatingScore(bubble.position, pointsPerBubble);
                }
                
                this.createExplosionEffect(bubble, true);
                this.removeBubble(bubble);
            }, index * 30);
        });
        
        // Check for floating bubbles
        setTimeout(() => {
            this.removeFloatingBubbles();
        }, bubbles.length * 30 + 200);
    }
    
    handleBombDestroy(bubbles, points) {
        // Add score with combo multiplier
        const comboMultiplier = Math.min(this.gameState.combo + 1, 5);
        const totalPoints = points * comboMultiplier;
        
        // Calculate points per individual bubble
        const pointsPerBubble = Math.floor(totalPoints / bubbles.length);
        
        this.gameState.addScore(totalPoints);
        
        // Emit combo start if this is the first in a combo chain
        if (this.gameState.combo === 0) {
            this.gameManager.eventBus.emit('comboStart');
        }
        
        this.gameState.incrementCombo();
        
        // Emit bubbles destroyed event for timer system
        this.gameManager.eventBus.emit('bubblesDestroyed', { 
            count: bubbles.length,
            combo: this.gameState.combo
        });
        
        if (this.gameManager && this.gameManager.eventBus) {
            this.gameManager.eventBus.emit('scoreUpdated', { score: this.gameState.score });
        }
        
        // Remove bubbles with enhanced explosion effects and individual point displays
        bubbles.forEach((bubble, index) => {
            setTimeout(() => {
                // Skip if already destroyed
                if (bubble.isDestroyed) return;
                
                // Show individual points for this bubble
                // Only show score if not paused
                if (this.gameManager && this.gameManager.showFloatingScore && 
                    (!this.pauseSystem || !this.pauseSystem.getIsPaused())) {
                    this.gameManager.showFloatingScore(bubble.position, pointsPerBubble);
                }
                
                this.createExplosionEffect(bubble, true); // Enhanced explosion for bomb
                this.removeBubble(bubble);
            }, index * 20); // Faster destruction for bomb
        });
        
        // Check for floating bubbles after destruction
        setTimeout(() => {
            this.removeFloatingBubbles();
            setTimeout(() => this.checkVictory(), 500);
        }, bubbles.length * 20 + 200);
    }
    
    /**
     * Check for matches after bubble attachment
     * @param {Bubble} bubble - The newly attached bubble
     */
    checkMatches(bubble) {
        // Check if bubble is a power-up (except rainbow, which uses normal matching)
        if (bubble.isPowerUp && bubble.powerUpType !== 'rainbow') {
            this.handlePowerUpActivation(bubble);
            return;
        }
        
        const matches = this.findConnectedBubbles(bubble);
        
        // Rainbow bubbles only need 1+ matches, regular bubbles need 3+
        const isRainbowMatch = bubble.isPowerUp && bubble.powerUpType === 'rainbow';
        const minMatches = isRainbowMatch ? 1 : 3;
        
        if (matches.length >= minMatches) {
            // Calculate base points and modifiers
            let basePoints = matches.length * 10;
            
            // Bonus points for rainbow bubble matches
            const hasRainbow = matches.some(b => b.isPowerUp && b.powerUpType === 'rainbow');
            if (hasRainbow) {
                basePoints *= 2; // Double points for rainbow matches
                this.gameManager.eventBus.emit('rainbowActivated', { position: bubble.position });
            }
            
            const comboMultiplier = Math.min(this.gameState.combo + 1, 5);
            const totalPoints = basePoints * comboMultiplier;
            
            // Calculate points per individual bubble
            const pointsPerBubble = Math.floor(totalPoints / matches.length);
            
            this.gameState.addScore(totalPoints);
            this.gameState.incrementCombo();
            this.gameManager.eventBus.emit('scoreUpdated', { score: this.gameState.score });
            
            // Update UI - combo size should be the current combo value
            this.gameManager.eventBus.emit('comboAchieved', { comboSize: this.gameState.combo });
            
            // Show mega clear text for large matches
            if (matches.length >= 7) {
                this.gameManager.showEffectText('megaClear');
            }
            
            // Remove bubbles with animation and individual point displays
            matches.forEach((matchedBubble, index) => {
                setTimeout(() => {
                    // Skip if already destroyed
                    if (matchedBubble.isDestroyed) return;
                    
                    // Show individual points for this bubble
                    if (this.gameManager && this.gameManager.showFloatingScore) {
                        this.gameManager.showFloatingScore(matchedBubble.position, pointsPerBubble);
                    }
                    
                    this.removeBubble(matchedBubble);
                    // Use enhanced explosion for large matches
                    this.createExplosionEffect(matchedBubble, matches.length >= 5);
                }, index * 50);
            });
            
            // Check for floating bubbles
            setTimeout(() => {
                this.removeFloatingBubbles();
                
                // Check victory condition
                setTimeout(() => this.checkVictory(), 500);
            }, matches.length * 50 + 100);
        } else {
            // No match - emit miss event for timer speed up
            this.gameManager.eventBus.emit('bubbleMiss');
            this.gameState.resetCombo();
        }
    }
    
    /**
     * Handle power-up activation
     * @param {Bubble} bubble - The power-up bubble
     */
    handlePowerUpActivation(bubble) {
        // Use the PowerUpSystem to handle all power-up activations
        const activated = this.gameManager.activatePowerUp(bubble, this.gameState);
        
        if (activated) {
            console.log(`Power-up ${bubble.powerUpType} activated successfully`);
            
            // For new power-ups (chainLightning, colorSplash, bomb), remove the power-up bubble and create new bubble
            if (bubble.powerUpType === 'chainLightning' || bubble.powerUpType === 'colorSplash' || bubble.powerUpType === 'bomb') {
                // Remove the power-up bubble from the grid
                this.removeBubble(bubble);
                setTimeout(() => this.createNewShootingBubble(), 500);
            }
        } else {
            // Fallback for legacy power-ups
            this.handleLegacyPowerUp(bubble);
        }
    }
    
    /**
     * Handle legacy power-ups (bomb only - rainbow now uses normal matching)
     * @param {Bubble} bubble - The power-up bubble
     */
    handleLegacyPowerUp(bubble) {
        if (bubble.powerUpType === 'bomb') {
            // Bomb bubble destroys 3x3 area
            const bombRadius = 1.5;
            const destroyed = [bubble];
            
            // Find all bubbles within explosion radius
            for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
                for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                    const target = this.gameState.getBubbleAt(x, y);
                    if (target && target !== bubble) {
                        const distance = bubble.position.distanceTo(target.position);
                        if (distance <= bombRadius * CONFIG.HEX_WIDTH) {
                            destroyed.push(target);
                        }
                    }
                }
            }
            
            // Create explosion effect
            const explosionLight = new THREE.PointLight(0xff0000, 5, 10);
            explosionLight.position.copy(bubble.position);
            this.scene.add(explosionLight);
            
            // Fade out explosion light
            let explosionIntensity = 5;
            const explosionFade = setInterval(() => {
                explosionIntensity -= 0.5;
                explosionLight.intensity = explosionIntensity;
                if (explosionIntensity <= 0) {
                    this.scene.remove(explosionLight);
                    clearInterval(explosionFade);
                }
            }, 50);
            
            // Remove destroyed bubbles
            let points = destroyed.length * 30; // Triple points for bomb
            this.gameState.addScore(points);
            this.gameState.incrementCombo();
            
            // Only show score if not paused
            if (!this.pauseSystem || !this.pauseSystem.getIsPaused()) {
                this.gameManager.showFloatingScore(bubble.position, points);
            }
            
            destroyed.forEach((b, index) => {
                setTimeout(() => {
                    // Skip if already destroyed
                    if (b.isDestroyed) return;
                    
                    this.removeBubble(b);
                    this.createExplosionEffect(b, true);
                }, index * 20);
            });
            
            // Check for floating bubbles
            setTimeout(() => {
                this.removeFloatingBubbles();
            }, destroyed.length * 20 + 100);
        }
        
        // Create new bubble after power-up activation
        setTimeout(() => this.createNewShootingBubble(), 500);
    }
    
    /**
     * Find connected bubbles of the same color or rainbow bubbles
     * @param {Bubble} startBubble - The starting bubble
     * @returns {Array} Array of connected bubbles
     */
    findConnectedBubbles(startBubble) {
        const connected = [];
        const visited = new Set();
        const isRainbowStart = startBubble.isPowerUp && startBubble.powerUpType === 'rainbow';
        
        if (isRainbowStart) {
            // Rainbow bubble: find separate chains for each color it touches
            connected.push(startBubble);
            visited.add(`${startBubble.gridX},${startBubble.gridY}`);
            
            // Get immediate neighbors
            const neighbors = this.getNeighbors(startBubble.gridX, startBubble.gridY);
            
            // For each unique color touched, do a separate flood fill
            const colorGroups = new Map();
            neighbors.forEach(neighbor => {
                if (neighbor && !neighbor.isPowerUp) {
                    if (!colorGroups.has(neighbor.color)) {
                        colorGroups.set(neighbor.color, []);
                    }
                    colorGroups.get(neighbor.color).push(neighbor);
                }
            });
            
            // Process each color group separately
            colorGroups.forEach((startBubbles, color) => {
                startBubbles.forEach(bubble => {
                    const colorChain = this.findSameColorChain(bubble, color, visited);
                    connected.push(...colorChain);
                });
            });
        } else {
            // Normal bubble: standard flood fill for same color
            const queue = [startBubble];
            const targetColor = startBubble.color;
            
            while (queue.length > 0) {
                const current = queue.shift();
                const key = `${current.gridX},${current.gridY}`;
                
                if (visited.has(key)) continue;
                visited.add(key);
                
                const isRainbowCurrent = current.isPowerUp && current.powerUpType === 'rainbow';
                
                // Include if same color or rainbow
                if (current.color === targetColor || isRainbowCurrent) {
                    connected.push(current);
                    
                    // Add neighbors to queue
                    const neighbors = this.getNeighbors(current.gridX, current.gridY);
                    neighbors.forEach(neighbor => {
                        if (neighbor && !visited.has(`${neighbor.gridX},${neighbor.gridY}`)) {
                            queue.push(neighbor);
                        }
                    });
                }
            }
        }
        
        return connected;
    }
    
    /**
     * Find a chain of bubbles of the same color starting from a bubble
     * @param {Bubble} startBubble - The starting bubble
     * @param {number} targetColor - The color to match
     * @param {Set} visited - Set of already visited positions
     * @returns {Array} Array of connected bubbles of the same color
     */
    findSameColorChain(startBubble, targetColor, visited) {
        const chain = [];
        const queue = [startBubble];
        
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.gridX},${current.gridY}`;
            
            if (visited.has(key)) continue;
            
            // Only include bubbles of the target color (not rainbow bubbles in the chain)
            if (current.color === targetColor && !current.isPowerUp) {
                visited.add(key);
                chain.push(current);
                
                // Add neighbors of the same color
                const neighbors = this.getNeighbors(current.gridX, current.gridY);
                neighbors.forEach(neighbor => {
                    if (neighbor && !visited.has(`${neighbor.gridX},${neighbor.gridY}`)) {
                        queue.push(neighbor);
                    }
                });
            }
        }
        
        return chain;
    }
    
    /**
     * Get neighboring bubbles
     * @param {number} x - Grid x coordinate
     * @param {number} y - Grid y coordinate
     * @returns {Array} Array of neighboring bubbles
     */
    getNeighbors(x, y) {
        const neighbors = [];
        const isOddRow = y % 2 === 1;
        
        // Hexagonal grid neighbors
        const directions = isOddRow ? [
            [-1, 0], [1, 0],   // Left, Right
            [0, -1], [1, -1],  // Top-left, Top-right (for odd rows)
            [0, 1], [1, 1]     // Bottom-left, Bottom-right (for odd rows)
        ] : [
            [-1, 0], [1, 0],   // Left, Right
            [-1, -1], [0, -1], // Top-left, Top-right (for even rows)
            [-1, 1], [0, 1]    // Bottom-left, Bottom-right (for even rows)
        ];
        
        directions.forEach(([dx, dy]) => {
            const neighbor = this.gameState.getBubbleAt(x + dx, y + dy);
            if (neighbor) {
                neighbors.push(neighbor);
            }
        });
        
        return neighbors;
    }
    
    /**
     * Remove floating bubbles
     */
    removeFloatingBubbles() {
        const connected = new Set();
        
        // Find all bubbles connected to ceiling
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
            const topBubble = this.gameState.getBubbleAt(x, 0);
            if (topBubble) {
                this.findAllConnected(topBubble, connected);
            }
        }
        
        // Remove bubbles not connected to ceiling
        let floatingCount = 0;
        const floatingBubbles = [];
        
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = this.gameState.getBubbleAt(x, y);
                if (bubble && !connected.has(bubble)) {
                    floatingCount++;
                    floatingBubbles.push(bubble);
                    setTimeout(() => {
                        // Skip if already destroyed
                        if (bubble.isDestroyed) return;
                        
                        this.removeBubble(bubble);
                        this.createFloatingEffect(bubble);
                    }, floatingCount * 30);
                }
            }
        }
        
        if (floatingCount > 0) {
            const totalFloatingPoints = floatingCount * 20 * Math.min(this.gameState.combo + 1, 5);
            const pointsPerFloatingBubble = Math.floor(totalFloatingPoints / floatingCount);
            
            this.gameState.addScore(totalFloatingPoints);
            
            // Show individual floating score for each bubble
            floatingBubbles.forEach((bubble, index) => {
                setTimeout(() => {
                    // Only show score if not paused
                    if (!this.pauseSystem || !this.pauseSystem.getIsPaused()) {
                        this.gameManager.showFloatingScore(bubble.position, pointsPerFloatingBubble);
                    }
                }, index * 30 + 100); // Slight delay after the bubble starts floating
            });
            
            // Emit floating cleared event
            this.gameManager.eventBus.emit('floatingCleared', { count: floatingCount });
        }
    }
    
    /**
     * Find all connected bubbles
     * @param {Bubble} startBubble - Starting bubble
     * @param {Set} connected - Set to store connected bubbles
     */
    findAllConnected(startBubble, connected) {
        const queue = [startBubble];
        
        while (queue.length > 0) {
            const current = queue.shift();
            if (connected.has(current)) continue;
            
            connected.add(current);
            
            const neighbors = this.getNeighbors(current.gridX, current.gridY);
            neighbors.forEach(neighbor => {
                if (!connected.has(neighbor)) {
                    queue.push(neighbor);
                }
            });
        }
    }
    
    /**
     * Immediately destroy a bubble without animation
     * This is the ONLY method that should be used to destroy bubbles
     * Uses BubbleLifecycleManager for atomic operations
     * @param {Bubble} bubble - Bubble to destroy
     * @param {boolean} skipAnimation - Skip the removal animation (kept for compatibility)
     */
    destroyBubbleImmediately(bubble, skipAnimation = false) {
        if (!bubble) return;
        
        // Use BubbleLifecycleManager for atomic destruction
        const systems = {
            gameState: this.gameState,
            bubbleInstances: this.bubbleInstances,
            collisionSystem: this.collisionSystem
        };
        
        const transaction = BubbleLifecycleManager.destroyBubble(bubble, systems);
        
        if (!transaction.completed) {
            console.error('Failed to destroy bubble:', transaction.errors);
        }
        
        // Handle non-instanced mesh cleanup if needed
        if (!bubble.useInstancedRendering && bubble.mesh && bubble.mesh.parent) {
            this.scene.remove(bubble.mesh);
        }
        
        // Call bubble's destroy method to clean up resources
        // This is safe to call even if already destroyed
        bubble.destroy();
        
        // Log transaction details in development mode
        if (CONFIG.DEBUG_MODE) {
            console.log(`Bubble destruction transaction:`, {
                bubbleId: transaction.bubbleId,
                duration: transaction.duration,
                errors: transaction.errors
            });
        }
    }
    
    /**
     * Remove bubble from game with animation
     * @param {Bubble} bubble - Bubble to remove
     * @param {number} animationSpeed - Speed multiplier for animation (default 3)
     */
    removeBubble(bubble, animationSpeed = 3) {
        if (!bubble || bubble.isDestroyed) return;
        
        // For instanced bubbles, use atomic destruction immediately
        if (bubble.useInstancedRendering) {
            this.destroyBubbleImmediately(bubble, true);
            return;
        }
        
        // Mark as destroyed immediately to prevent collision detection
        bubble.isDestroyed = true;
        
        // Remove from collision system immediately
        if (this.collisionSystem && this.collisionSystem.spatialGrid) {
            this.collisionSystem.spatialGrid.remove(bubble);
            this.collisionSystem.lastCacheUpdate = 0;
        }
        
        // For non-instanced bubbles, animate then destroy
        const removeAnimation = {
            bubble: bubble,
            progress: 0,
            gameLogic: this,
            update: function(deltaTime) {
                this.progress += deltaTime * animationSpeed;
                
                if (bubble.mesh) {
                    bubble.mesh.scale.setScalar(1 - this.progress);
                    bubble.mesh.rotation.x += 0.3;
                    bubble.mesh.rotation.y += 0.2;
                    if (bubble.material) {
                        bubble.material.opacity = 1 - this.progress;
                    }
                }
                
                if (this.progress >= 1) {
                    this.gameLogic.destroyBubbleImmediately(bubble, true);
                    return false;
                }
                return true;
            }
        };
        
        this.gameState.addAnimation(removeAnimation);
    }
    
    /**
     * Create explosion effect
     * @param {Bubble} bubble - Bubble to explode
     * @param {boolean} enhanced - Whether to use enhanced effect
     */
    createExplosionEffect(bubble, enhanced = false) {
        const particleCount = enhanced ? CONFIG.PARTICLE_COUNT * 2 : CONFIG.PARTICLE_COUNT;
        const particleSize = enhanced ? 0.3 : 0.2;
        const color = enhanced ? 0xff0000 : bubble.color;
        
        // Play sound
        if (enhanced) {
            this.gameManager.playSound('bubblePopMultiple');
        } else {
            this.gameManager.playSound('bubblePopSingle');
        }
        
        // Create particles
        ParticleFactory.createExplosion(
            bubble.position,
            color,
            particleCount,
            this.gameState.particlePool
        );
        
        // Add screen shake for enhanced explosions
        if (enhanced) {
            this.gameManager.addScreenShake(0.3, 5);
        }
    }
    
    /**
     * Create floating effect
     * @param {Bubble} bubble - Bubble that's floating away
     */
    createFloatingEffect(bubble) {
        bubble.isFloating = true;
        
        const floatAnimation = {
            bubble: bubble,
            progress: 0,
            gameLogic: this,
            update: function(deltaTime) {
                this.progress += deltaTime;
                bubble.position.y -= deltaTime * 5;
                if (bubble.mesh) {
                    bubble.mesh.position.copy(bubble.position);
                    bubble.mesh.rotation.z += 0.1;
                }
                if (bubble.material) {
                    bubble.material.opacity = Math.max(0, 1 - this.progress);
                }
                
                if (this.progress >= 1) {
                    // Use the unified destruction method
                    this.gameLogic.destroyBubbleImmediately(bubble, true);
                    return false;
                }
                return true;
            }
        };
        
        this.gameState.addAnimation(floatAnimation);
        
        // Add sparkle particles
        ParticleFactory.createBurst(
            bubble.position,
            0xffffff,
            10,
            this.gameState.particlePool
        );
    }
    
    /**
     * Check victory condition
     */
    checkVictory() {
        const bubbleCount = this.gameState.countBubbles(bubble => !bubble.isPowerUp);
        
        if (bubbleCount === 0 && !this.gameState.isGameOver) {
            // Victory!
            const victoryBonus = 1000 * this.gameState.level;
            this.gameState.addScore(victoryBonus);
            // Only show score if not paused
            if (!this.pauseSystem || !this.pauseSystem.getIsPaused()) {
                this.gameManager.showFloatingScore(new THREE.Vector3(0, 0, 0), victoryBonus);
            }
            
            // Emit victory event
            this.gameManager.eventBus.emit('levelComplete');
            
            // Create celebration effect
            for (let i = 0; i < 50; i++) {
                setTimeout(() => {
                    const x = (Math.random() - 0.5) * 10;
                    const y = (Math.random() - 0.5) * 10;
                    const color = CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
                    
                    const particle = this.gameState.particlePool.spawn(
                        x, y, 0, color, 0.3,
                        new THREE.Vector3(
                            (Math.random() - 0.5) * 15,
                            Math.random() * 10 + 5,
                            (Math.random() - 0.5) * 5
                        )
                    );
                    
                    if (particle) {
                        particle.decay = 0.015;
                    }
                }, i * 20);
            }
            
            // Add new rows after celebration
            setTimeout(() => {
                // Add new rows with proper timing
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        this.addNewRow();
                        // Force immediate update of instanced renderer after each row
                        if (this.bubbleInstances) {
                            this.bubbleInstances.update(0, this.gameManager.camera);
                        }
                    }, i * 300); // Delay between rows
                }
                
                // Light cleanup after all rows are added - just in case
                setTimeout(() => {
                    const orphaned = this.cleanupOrphanedVisuals();
                    
                    // Log final state
                    const finalGrid = this.gameState.getAllBubbles().length;
                    const finalVisual = this.bubbleInstances ? this.bubbleInstances.activeBubbles.size : 0;
                    console.log(`Wave loading complete. Grid=${finalGrid}, Visual=${finalVisual}`);
                    if (orphaned > 0) {
                        console.log(`Cleaned up ${orphaned} orphaned visuals after wave load`);
                    }
                }, 1200);
            }, 1500);
        }
    }
    
    /**
     * Add new row when level increases
     */
    addNewRow() {
        // Play descending rows sound effect
        if (this.gameManager && this.gameManager.soundManager) {
            this.gameManager.soundManager.play('rowsDescending', {
                volume: 0.7,
                rate: 0.9 + Math.random() * 0.2 // Slight pitch variation
            });
        }
        
        // Also play a warning sound if getting close to danger
        const dangerCheck = this.checkDangerZone();
        if (dangerCheck && this.gameManager && this.gameManager.soundManager) {
            // Delay warning sound slightly so it doesn't overlap with rowsDescending
            setTimeout(() => {
                this.gameManager.soundManager.play('warning', {
                    volume: 0.6,
                    rate: 1.0
                });
            }, 200);
        }
        
        // Shift all bubbles down (much simpler now!)
        this.gameState.shiftRowsDown();
        
        // Update bubble positions after shift
        const allBubbles = this.gameState.getAllBubbles();
        allBubbles.forEach(bubble => {
            // The bubble's gridX and gridY have been updated by shiftRowsDown
            // Update its visual position to match
            bubble.setGridPosition(bubble.gridX, bubble.gridY);
            
            // Update instanced renderer for shifted bubbles
            if (bubble.useInstancedRendering && this.bubbleInstances) {
                this.bubbleInstances.updateBubble(bubble);
            }
            
            // Add drop-in effect
            bubble.applyImpact(new THREE.Vector3(0, -CONFIG.IMPACT_PHYSICS.NEW_ROW_DROP_FORCE, 0));
        });
        
        // Add new row at top (row 0 should be empty after shift)
        // All rows now have the same width
        const bubblesInRow = CONFIG.GRID_WIDTH;
        
        for (let x = 0; x < bubblesInRow; x++) {
            if (Math.random() > 0.2) { // 80% chance for bubble
                const color = CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
                const bubble = new Bubble(0, 0, color);
                
                // Set flag for instanced rendering BEFORE setGridPosition
                bubble.useInstancedRendering = true;
                bubble.setGridPosition(x, 0);
                
                // Add to grid
                this.gameState.setBubbleAt(x, 0, bubble);
                
                // Add to instanced renderer
                if (this.bubbleInstances) {
                    this.bubbleInstances.addBubble(bubble, 'grid');
                } else {
                    // Fallback to direct scene addition if instanced renderer not available
                    this.scene.add(bubble.mesh);
                }
                
                // Apply current effect combination settings from developer panel
                this.applyCurrentEffectSettings(bubble);
            }
        }
    }
    
    /**
     * Apply current effect combination settings to a bubble
     * @param {Bubble} bubble - The bubble to apply effects to
     */
    applyCurrentEffectSettings(bubble) {
        // Access the effects controller through the game manager
        if (this.gameManager && this.gameManager.eventBus) {
            // Emit event to notify that a new bubble was created and needs effects applied
            this.gameManager.eventBus.emit('bubbleCreated', bubble);
        }
    }
    
    /**
     * Check if bubbles are in danger zone (close to bottom)
     * @returns {boolean} Whether bubbles are in danger zone
     */
    checkDangerZone() {
        // Check if any bubble is within 3 rows of the bottom
        const dangerStartRow = CONFIG.GRID_HEIGHT - 4;
        for (let y = dangerStartRow; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                if (this.gameState.getBubbleAt(x, y)) {
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * Check game over condition
     * @returns {boolean} Whether game is over
     */
    checkGameOver() {
        // Check if any bubble is below danger line
        for (let y = CONFIG.GRID_HEIGHT - 2; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                if (this.gameState.getBubbleAt(x, y)) {
                    this.gameState.setGameOver();
                    this.gameManager.eventBus.emit('gameOver', { reason: 'Bubbles reached danger line' });
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * Notify that a new shooting bubble should be created
     */
    createNewShootingBubble() {
        this.gameManager.eventBus.emit('createShootingBubble');
    }
    
    /**
     * Clean up any ghost bubbles that might exist
     * This is a targeted cleanup that only removes actual ghost bubbles
     */
    cleanupGhostBubbles() {
        console.log('Running targeted ghost bubble cleanup...');
        
        // First, identify all valid bubbles in the grid
        const validBubbles = new Set();
        const ghostBubbles = [];
        
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = this.gameState.getBubbleAt(x, y);
                if (bubble) {
                    if (bubble.isDestroyed) {
                        // Found a destroyed bubble still in grid - it's a ghost
                        ghostBubbles.push({ bubble, x, y });
                        this.gameState.bubbleGrid[y][x] = null;
                        console.warn(`Removed destroyed ghost bubble at ${x},${y}`);
                    } else {
                        validBubbles.add(bubble.id);
                        // Ensure bubble knows its correct position
                        if (bubble.gridX !== x || bubble.gridY !== y) {
                            console.warn(`Bubble position mismatch at ${x},${y} - fixing`);
                            bubble.gridX = x;
                            bubble.gridY = y;
                        }
                    }
                }
            }
        }
        
        // Clean up visual instances - remove any that aren't in valid bubbles
        if (this.bubbleInstances && this.bubbleInstances.bubbleMap) {
            const visualIds = Array.from(this.bubbleInstances.bubbleMap.keys());
            for (const id of visualIds) {
                if (!validBubbles.has(id)) {
                    const bubble = this.bubbleInstances.bubbleMap.get(id);
                    if (bubble) {
                        console.warn(`Removing orphaned visual instance for bubble ${id}`);
                        this.bubbleInstances.removeBubble(bubble);
                    }
                }
            }
            
            // Force update the instanced renderer if it exists
            if (this.bubbleInstances.update && this.gameManager && this.gameManager.camera) {
                this.bubbleInstances.update(0, this.gameManager.camera);
            }
        }
        
        // Clean up collision system
        if (this.collisionSystem && this.collisionSystem.spatialGrid) {
            // Force rebuild the spatial grid cache
            this.collisionSystem.lastCacheUpdate = 0;
        }
        
        // Report cleanup results
        const cleanupCount = ghostBubbles.length;
        if (cleanupCount > 0) {
            console.log(`Cleaned up ${cleanupCount} ghost bubbles`);
        }
        
        // Validate final state
        const gridCount = this.gameState.getAllBubbles().filter(b => !b.isDestroyed).length;
        const visualCount = (this.bubbleInstances && this.bubbleInstances.activeBubbles) 
            ? this.bubbleInstances.activeBubbles.size 
            : 0;
        
        console.log(`Post-cleanup state: Grid=${gridCount}, Visual=${visualCount}`);
        
        if (gridCount !== visualCount && this.bubbleInstances && this.bubbleInstances.bubbleMap) {
            console.warn(`Mismatch after cleanup! Grid=${gridCount}, Visual=${visualCount}`);
            // Don't automatically sync - this can cause duplication
            // Just report the issue
            console.warn('Run window.cleanupGhosts() manually if needed');
        }
        
        return cleanupCount;
    }
    
    /**
     * Light cleanup to remove only orphaned visual instances
     * This is safer than full sync and won't cause duplicates
     */
    cleanupOrphanedVisuals() {
        if (!this.bubbleInstances || !this.bubbleInstances.bubbleMap) {
            return 0;
        }
        
        // Build set of all valid bubble IDs from grid
        const validIds = new Set();
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = this.gameState.getBubbleAt(x, y);
                if (bubble && !bubble.isDestroyed) {
                    validIds.add(bubble.id);
                }
            }
        }
        
        // Remove visual instances that don't have grid bubbles
        let removedCount = 0;
        const visualIds = Array.from(this.bubbleInstances.bubbleMap.keys());
        for (const id of visualIds) {
            if (!validIds.has(id)) {
                const bubble = this.bubbleInstances.bubbleMap.get(id);
                if (bubble) {
                    console.log(`Removing orphaned visual for bubble ${id}`);
                    this.bubbleInstances.removeBubble(bubble);
                    removedCount++;
                }
            }
        }
        
        if (removedCount > 0) {
            console.log(`Removed ${removedCount} orphaned visual instances`);
            if (this.bubbleInstances.update && this.gameManager && this.gameManager.camera) {
                this.bubbleInstances.update(0, this.gameManager.camera);
            }
        }
        
        return removedCount;
    }
    
    /**
     * Force sync between grid state and visual instances
     * NOTE: This should only be used as a last resort as it's destructive
     */
    syncBubbleInstances() {
        if (!this.bubbleInstances) {
            console.warn('BubbleInstances not initialized, skipping sync');
            return;
        }
        
        // Check if bubbleInstances is properly initialized
        if (!this.bubbleInstances.bubbleMap || !this.bubbleInstances.instancedMesh) {
            console.warn('BubbleInstances not fully initialized, skipping sync');
            return;
        }
        
        console.warn('Force syncing bubble instances - this is a destructive operation!');
        
        // Clear all visual instances
        this.bubbleInstances.clearAll();
        
        // Re-add all valid bubbles from grid
        const bubbles = this.gameState.getAllBubbles();
        let addedCount = 0;
        for (const bubble of bubbles) {
            if (!bubble.isDestroyed && bubble.useInstancedRendering) {
                // Make sure bubble knows its correct position before adding
                if (bubble.gridX !== undefined && bubble.gridY !== undefined) {
                    bubble.setGridPosition(bubble.gridX, bubble.gridY);
                    this.bubbleInstances.addBubble(bubble, 'grid');
                    addedCount++;
                }
            }
        }
        
        // Force update
        this.bubbleInstances.update(0, this.gameManager.camera);
        
        console.log(`Sync complete: ${addedCount} bubbles re-added to visual system`);
    }
}