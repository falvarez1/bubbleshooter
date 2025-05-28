import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { ParticleFactory } from '../entities/Particle.js';

/**
 * Game Logic System
 * Handles core game mechanics: matching, scoring, power-ups, etc.
 */
export class GameLogic {
    constructor(gameState, gameManager, scene) {
        this.gameState = gameState;
        this.gameManager = gameManager;
        this.scene = scene;
        
        // Set up event listeners for power-up effects
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Chain Lightning destroy event
        this.gameManager.eventBus.on('chainLightningDestroy', (data) => {
            this.handleChainLightningDestroy(data.bubbles, data.points);
        });
        
        // Color Splash destroy event
        this.gameManager.eventBus.on('colorSplashDestroy', (data) => {
            this.handleColorSplashDestroy(data.bubbles, data.points);
        });
        
        // Check bubble matches event
        this.gameManager.eventBus.on('checkBubbleMatches', (data) => {
            this.checkMatches(data.bubble);
        });
        
        // Check floating bubbles event
        this.gameManager.eventBus.on('checkFloatingBubbles', () => {
            this.removeFloatingBubbles();
        });
    }
    
    handleChainLightningDestroy(bubbles, points) {
        // Add score
        this.gameState.addScore(points);
        this.gameManager.eventBus.emit('scoreUpdated', { score: this.gameState.score });
        
        // Show floating score at center of destruction
        const centerX = bubbles.reduce((sum, b) => sum + b.position.x, 0) / bubbles.length;
        const centerY = bubbles.reduce((sum, b) => sum + b.position.y, 0) / bubbles.length;
        this.gameManager.showFloatingScore(new THREE.Vector3(centerX, centerY, 0), points);
        
        // Remove bubbles (electric effects are already handled by the power-up)
        bubbles.forEach((bubble, index) => {
            setTimeout(() => {
                this.removeBubble(bubble);
            }, index * 15); // Faster removal since effects are pre-created
        });
        
        // Check for floating bubbles after destruction
        setTimeout(() => {
            this.removeFloatingBubbles();
            setTimeout(() => this.checkVictory(), 500);
        }, bubbles.length * 15 + 200);
    }
    
    handleColorSplashDestroy(bubbles, points) {
        // Add score
        this.gameState.addScore(points);
        this.gameManager.eventBus.emit('scoreUpdated', { score: this.gameState.score });
        
        // Show floating score
        const centerX = bubbles.reduce((sum, b) => sum + b.position.x, 0) / bubbles.length;
        const centerY = bubbles.reduce((sum, b) => sum + b.position.y, 0) / bubbles.length;
        this.gameManager.showFloatingScore(new THREE.Vector3(centerX, centerY, 0), points);
        
        // Remove bubbles
        bubbles.forEach((bubble, index) => {
            setTimeout(() => {
                this.createExplosionEffect(bubble, true);
                this.removeBubble(bubble);
            }, index * 30);
        });
        
        // Check for floating bubbles
        setTimeout(() => {
            this.removeFloatingBubbles();
        }, bubbles.length * 30 + 200);
    }
    
    /**
     * Check for matches after bubble attachment
     * @param {Bubble} bubble - The newly attached bubble
     */
    checkMatches(bubble) {
        // Check if bubble is a power-up and activate it
        if (bubble.isPowerUp) {
            this.handlePowerUpActivation(bubble);
            return;
        }
        
        const matches = this.findConnectedBubbles(bubble);
        
        if (matches.length >= 3) {
            // Remove matched bubbles
            let points = matches.length * 10;
            const comboMultiplier = Math.min(this.gameState.combo + 1, 5);
            points *= comboMultiplier;
            
            this.gameState.addScore(points);
            this.gameState.incrementCombo();
            this.gameManager.eventBus.emit('scoreUpdated', { score: this.gameState.score });
            
            // Update UI
            this.gameManager.eventBus.emit('comboAchieved', { comboSize: this.gameState.combo + 1 });
            
            // Show mega clear text for large matches
            if (matches.length >= 7) {
                this.gameManager.showEffectText('megaClear');
            }
            
            // Create floating score at center of match group
            const centerX = matches.reduce((sum, b) => sum + b.position.x, 0) / matches.length;
            const centerY = matches.reduce((sum, b) => sum + b.position.y, 0) / matches.length;
            this.gameManager.showFloatingScore(new THREE.Vector3(centerX, centerY, 0), points);
            
            // Remove bubbles with animation
            matches.forEach((matchedBubble, index) => {
                setTimeout(() => {
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
            
            // For new power-ups (chainLightning, colorSplash), remove the power-up bubble and create new bubble
            if (bubble.powerUpType === 'chainLightning' || bubble.powerUpType === 'colorSplash') {
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
     * Handle legacy power-ups (rainbow and bomb)
     * @param {Bubble} bubble - The power-up bubble
     */
    handleLegacyPowerUp(bubble) {
        if (bubble.powerUpType === 'rainbow') {
            // Rainbow bubble matches all adjacent bubbles
            const neighbors = this.getNeighbors(bubble.gridX, bubble.gridY);
            const bubblesRemoved = [bubble];
            
            neighbors.forEach(neighbor => {
                if (neighbor && !neighbor.isPowerUp) {
                    bubblesRemoved.push(neighbor);
                    // Find all connected bubbles of the same color
                    const connected = this.findConnectedBubbles(neighbor);
                    connected.forEach(b => {
                        if (!bubblesRemoved.includes(b)) {
                            bubblesRemoved.push(b);
                        }
                    });
                }
            });
            
            // Remove all affected bubbles
            let points = bubblesRemoved.length * 20; // Double points for rainbow
            this.gameState.addScore(points);
            this.gameState.incrementCombo();
            
            this.gameManager.showFloatingScore(bubble.position, points);
            
            bubblesRemoved.forEach((b, index) => {
                setTimeout(() => {
                    this.removeBubble(b);
                    this.createExplosionEffect(b, true);
                }, index * 30);
            });
            
            // Check for floating bubbles
            setTimeout(() => {
                this.removeFloatingBubbles();
            }, bubblesRemoved.length * 30 + 100);
            
        } else if (bubble.powerUpType === 'bomb') {
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
            
            this.gameManager.showFloatingScore(bubble.position, points);
            
            destroyed.forEach((b, index) => {
                setTimeout(() => {
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
     * Find connected bubbles of the same color
     * @param {Bubble} startBubble - The starting bubble
     * @returns {Array} Array of connected bubbles
     */
    findConnectedBubbles(startBubble) {
        const connected = [];
        const visited = new Set();
        const queue = [startBubble];
        const targetColor = startBubble.color;
        
        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.gridX},${current.gridY}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            
            if (current.color === targetColor) {
                connected.push(current);
                
                // Check neighbors
                const neighbors = this.getNeighbors(current.gridX, current.gridY);
                neighbors.forEach(neighbor => {
                    if (neighbor && !visited.has(`${neighbor.gridX},${neighbor.gridY}`)) {
                        queue.push(neighbor);
                    }
                });
            }
        }
        
        return connected;
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
                        this.removeBubble(bubble);
                        this.createFloatingEffect(bubble);
                    }, floatingCount * 30);
                }
            }
        }
        
        if (floatingCount > 0) {
            const floatingPoints = floatingCount * 20 * Math.min(this.gameState.combo + 1, 5);
            this.gameState.addScore(floatingPoints);
            
            // Show floating score effect
            if (floatingBubbles.length > 0) {
                const centerX = floatingBubbles.reduce((sum, b) => sum + b.position.x, 0) / floatingBubbles.length;
                const centerY = floatingBubbles.reduce((sum, b) => sum + b.position.y, 0) / floatingBubbles.length;
                setTimeout(() => {
                    this.gameManager.showFloatingScore(new THREE.Vector3(centerX, centerY, 0), floatingPoints);
                }, floatingCount * 15);
            }
            
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
     * Remove bubble from game
     * @param {Bubble} bubble - Bubble to remove
     */
    removeBubble(bubble) {
        this.gameState.removeBubbleAt(bubble.gridX, bubble.gridY);
        
        // Animate removal
        const removeAnimation = {
            bubble: bubble,
            progress: 0,
            update: function(deltaTime) {
                this.progress += deltaTime * 3;
                bubble.mesh.scale.setScalar(1 - this.progress);
                bubble.mesh.rotation.x += 0.3;
                bubble.mesh.rotation.y += 0.2;
                bubble.material.opacity = 1 - this.progress;
                
                if (this.progress >= 1) {
                    bubble.destroy();
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
            update: function(deltaTime) {
                this.progress += deltaTime;
                bubble.position.y -= deltaTime * 5;
                bubble.mesh.position.copy(bubble.position);
                bubble.mesh.rotation.z += 0.1;
                bubble.material.opacity = Math.max(0, 1 - this.progress);
                
                if (this.progress >= 1) {
                    bubble.destroy();
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
            this.gameManager.showFloatingScore(new THREE.Vector3(0, 0, 0), victoryBonus);
            
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
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => this.addNewRow(), i * 200);
                }
            }, 1500);
        }
    }
    
    /**
     * Add new row when level increases
     */
    addNewRow() {
        // Shift all bubbles down
        this.gameState.shiftRowsDown();
        
        // Update bubble positions
        const allBubbles = this.gameState.getAllBubbles();
        allBubbles.forEach(bubble => {
            bubble.setGridPosition(bubble.gridX, bubble.gridY);
            // Add drop-in effect
            bubble.applyImpact(new THREE.Vector3(0, -CONFIG.IMPACT_PHYSICS.NEW_ROW_DROP_FORCE, 0));
        });
        
        // Add new row at top
        const bubblesInRow = CONFIG.GRID_WIDTH;
        
        for (let x = 0; x < bubblesInRow; x++) {
            if (Math.random() > 0.2) { // 80% chance for bubble
                const color = CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
                const bubble = new Bubble(0, 0, color);
                bubble.setGridPosition(x, 0);
                
                this.scene.add(bubble.mesh);
                this.gameState.setBubbleAt(x, 0, bubble);
            }
        }
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
                    this.gameManager.eventBus.emit('gameOver');
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
}