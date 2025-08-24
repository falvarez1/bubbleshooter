import * as THREE from 'three';
import { CONFIG, PARTICLE_CONFIG } from '../core/Config.js';
import { PowerUp } from './PowerUp.js';
import { ParticleFactory, ParticlePool } from '../entities/Particle.js';

/**
 * Color Splash Power-Up
 * Changes colors of nearby bubbles to create matches
 */
export class ColorSplashPowerUp extends PowerUp {
    constructor() {
        super('colorSplash', {
            name: 'Color Splash',
            rarity: 'rare',
            spawnRate: 0.10,
            color: 0xff00ff,
            glowColor: 0xff66ff
        });
        this.clusterSize = 2; // Radius of 2 for cluster detection
        // Create a dedicated CPU particle pool for color effects
        // GPU particles don't support individual colors properly
        this.colorParticlePool = null;
    }
    
    initColorParticlePool(scene) {
        if (!this.colorParticlePool) {
            this.colorParticlePool = new ParticlePool(200); // Dedicated pool for color effects
            this.colorParticlePool.addToScene(scene);
        }
    }
    
    activate(powerUpBubble, gameState, gameManager) {
        // Initialize color particle pool if needed
        this.initColorParticlePool(gameManager.scene);
        
        // Find all bubbles on the board
        const allBubbles = [];
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = gameState.getBubbleAt(x, y);
                // Exclude power-ups, destroyed bubbles, and the power-up bubble itself
                if (bubble && !bubble.isPowerUp && !bubble.isDestroyed && bubble !== powerUpBubble) {
                    allBubbles.push(bubble);
                }
            }
        }
        
        if (allBubbles.length === 0) return false;
        
        // Randomly select a center bubble
        const centerBubble = allBubbles[Math.floor(Math.random() * allBubbles.length)];
        
        // Find cluster of bubbles around the center - OPTIMIZED
        const cluster = [centerBubble];
        const maxDistance = this.clusterSize * CONFIG.HEX_WIDTH;
        const maxClusterSize = PARTICLE_CONFIG.colorSplash.maxClusterSize;
        
        for (let y = 0; y < CONFIG.GRID_HEIGHT && cluster.length < maxClusterSize; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH && cluster.length < maxClusterSize; x++) {
                const bubble = gameState.getBubbleAt(x, y);
                // Exclude power-up bubble and already destroyed bubbles
                if (bubble && bubble !== centerBubble && !bubble.isPowerUp && 
                    !bubble.isDestroyed && bubble !== powerUpBubble) {
                    const distance = centerBubble.position.distanceTo(bubble.position);
                    if (distance <= maxDistance) {
                        cluster.push(bubble);
                    }
                }
            }
        }
        
        // Get all active colors from the board
        const activeColors = new Set();
        allBubbles.forEach(bubble => {
            activeColors.add(bubble.color);
        });
        
        // Randomly select a color from active colors
        const colorsArray = Array.from(activeColors);
        const selectedColor = colorsArray[Math.floor(Math.random() * colorsArray.length)];
        
        // Create visual effect before color change
        this.createSplashEffect(centerBubble, cluster, selectedColor, gameState, gameManager);
        
        // Change colors of all bubbles in cluster after delay - OPTIMIZED
        setTimeout(() => {
            // Process bubbles in smaller batches
            const batchSize = PARTICLE_CONFIG.colorSplash.batchSize;
            for (let i = 0; i < cluster.length; i += batchSize) {
                const batch = cluster.slice(i, i + batchSize);
                setTimeout(() => {
                    batch.forEach((bubble, batchIndex) => {
                        setTimeout(() => {
                            this.transformBubbleColor(bubble, selectedColor, gameState, gameManager);
                        }, batchIndex * PARTICLE_CONFIG.colorSplash.transformDelay);
                    });
                }, i * 100); // Delay between batches
            }
            
            // Check for matches after all transformations (if enabled)
            const totalTransformTime = Math.ceil(cluster.length / batchSize) * 100 + batchSize * PARTICLE_CONFIG.colorSplash.transformDelay;
            
            if (PARTICLE_CONFIG.colorSplash.checkForMatches) {
                setTimeout(() => {
                    // Find all matches in the transformed cluster
                    const allMatches = new Set();
                    cluster.forEach(bubble => {
                        if (!allMatches.has(bubble)) {
                            const matches = this.findConnectedBubbles(bubble, gameState);
                            if (matches.length >= 3) {
                                matches.forEach(m => allMatches.add(m));
                            }
                        }
                    });
                    
                    if (allMatches.size > 0) {
                        // Emit event to handle matched bubbles
                        gameManager.eventBus.emit('colorSplashDestroy', {
                            bubbles: Array.from(allMatches),
                            points: allMatches.size * 20
                        });
                    } else {
                        // No matches, just check for floating bubbles
                        setTimeout(() => {
                            gameManager.eventBus.emit('checkFloatingBubbles');
                        }, 500);
                    }
                }, totalTransformTime + 200);
            } else {
                // When match checking is disabled, just check for floating bubbles after transformation
                setTimeout(() => {
                    gameManager.eventBus.emit('checkFloatingBubbles');
                }, totalTransformTime + 700);
            }
        }, 800);
        
        // Remove the power-up bubble itself
        setTimeout(() => {
            if (powerUpBubble && !powerUpBubble.isDestroyed) {
                // Use GameLogic's unified destruction method
                if (gameManager.gameLogic) {
                    gameManager.gameLogic.destroyBubbleImmediately(powerUpBubble);
                } else {
                    // Fallback
                    gameState.removeBubbleAt(powerUpBubble.gridX, powerUpBubble.gridY);
                    powerUpBubble.destroy();
                }
            }
        }, 100);
        
        return true;
    }
    
    findConnectedBubbles(startBubble, gameState) {
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
                const neighbors = this.getNeighbors(current.gridX, current.gridY, gameState);
                neighbors.forEach(neighbor => {
                    if (neighbor && !visited.has(`${neighbor.gridX},${neighbor.gridY}`)) {
                        queue.push(neighbor);
                    }
                });
            }
        }
        
        return connected;
    }
    
    getNeighbors(x, y, gameState) {
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
            const neighbor = gameState.getBubbleAt(x + dx, y + dy);
            if (neighbor) {
                neighbors.push(neighbor);
            }
        });
        
        return neighbors;
    }
    
    createSplashEffect(centerBubble, cluster, targetColor, gameState, gameManager) {
        // Create multiple expanding rings for a more magical effect
        const numRings = 3;
        for (let i = 0; i < numRings; i++) {
            setTimeout(() => {
                // Use a flat ring geometry for better transparency
                const innerRadius = 0.3 + i * 0.1;
                const outerRadius = innerRadius + 0.4;
                const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64, 1);
                
                // Use MeshBasicMaterial with additive blending for magical glow effect
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: targetColor,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false // Prevent z-fighting and ensure transparency
                });
                
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.position.copy(centerBubble.position);
                ring.position.z = 1 + i * 0.1; // Slight z-offset for each ring
                
                // Add slight random rotation for variety
                ring.rotation.z = Math.random() * Math.PI;
                
                if (gameManager.scene) gameManager.scene.add(ring);
                
                // Create inner glow ring for enhanced effect
                const glowGeometry = new THREE.RingGeometry(innerRadius * 0.8, outerRadius * 1.2, 64, 1);
                const glowMaterial = new THREE.MeshBasicMaterial({
                    color: targetColor,
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                
                const glowRing = new THREE.Mesh(glowGeometry, glowMaterial);
                glowRing.position.copy(ring.position);
                glowRing.position.z -= 0.05;
                if (gameManager.scene) gameManager.scene.add(glowRing);
                
                // Animate expanding rings with shimmer effect
                const ringAnimation = {
                    scale: 1,
                    opacity: 0.6,
                    rotation: 0,
                    time: 0,
                    update: function(deltaTime) {
                        this.time += deltaTime;
                        this.scale += 25 * deltaTime; // Expand at 25 units per second
                        this.opacity -= 0.8 * deltaTime; // Fade out over ~0.75 seconds
                        this.rotation += deltaTime * 0.5; // Gentle rotation
                        
                        // Apply transformations
                        ring.scale.set(this.scale, this.scale, 1);
                        glowRing.scale.set(this.scale * 1.1, this.scale * 1.1, 1);
                        ring.rotation.z += deltaTime * 0.3;
                        glowRing.rotation.z -= deltaTime * 0.2;
                        
                        // Shimmer effect - oscillate opacity slightly
                        const shimmer = Math.sin(this.time * 10) * 0.1;
                        ringMaterial.opacity = Math.max(0, this.opacity + shimmer);
                        glowMaterial.opacity = Math.max(0, this.opacity * 0.5);
                        
                        // Pulse the color intensity
                        const pulse = 0.5 + Math.sin(this.time * 8) * 0.5;
                        const r = ((targetColor >> 16) & 255) / 255;
                        const g = ((targetColor >> 8) & 255) / 255;
                        const b = (targetColor & 255) / 255;
                        ringMaterial.color.setRGB(r * (1 + pulse * 0.3), g * (1 + pulse * 0.3), b * (1 + pulse * 0.3));
                        
                        if (this.opacity <= 0) {
                            if (gameManager.scene) {
                                gameManager.scene.remove(ring);
                                gameManager.scene.remove(glowRing);
                            }
                            ringGeometry.dispose();
                            ringMaterial.dispose();
                            glowGeometry.dispose();
                            glowMaterial.dispose();
                            return false; // Remove from animations
                        }
                        return true; // Keep animating
                    }
                };
                gameState.addAnimation(ringAnimation);
            }, i * 150); // Stagger each ring by 150ms
        }
        
        // Create color wave particles - Use dedicated color pool
        ParticleFactory.createColorWave(
            centerBubble.position,
            targetColor,
            PARTICLE_CONFIG.colorSplash.waveParticles,
            this.colorParticlePool  // Use dedicated pool for proper color support
        );
        
        // Add screen flash effect
        const flashLight = new THREE.PointLight(targetColor, 8, 20);
        flashLight.position.copy(centerBubble.position);
        flashLight.position.z = 5;
        if (gameManager.scene) gameManager.scene.add(flashLight);
        
        // Fade flash - OPTIMIZED
        const flashAnimation = {
            intensity: 8,
            update: function(deltaTime) {
                this.intensity -= 6 * deltaTime; // Fade in ~1.3 seconds
                flashLight.intensity = Math.max(0, this.intensity);
                
                if (this.intensity <= 0) {
                    if (gameManager.scene) gameManager.scene.remove(flashLight);
                    flashLight.dispose();
                    return false;
                }
                return true;
            }
        };
        gameState.addAnimation(flashAnimation);
        
        // Screen shake for impact
        gameManager.addScreenShake(0.3, 6);
        
        // Create spiral effect around each bubble in cluster - OPTIMIZED
        cluster.forEach((bubble, index) => {
            // Only create spiral for every Nth bubble based on config
            if (index % PARTICLE_CONFIG.colorSplash.spiralEveryNth === 0) {
                setTimeout(() => {
                    this.createSpiralEffect(bubble, targetColor, gameState);
                }, index * 50); // Increased delay
            }
        });
    }
    
    createSpiralEffect(bubble, targetColor, gameState) {
        // Create spiral particles around bubble - Use dedicated color pool
        ParticleFactory.createColorSpiral(
            bubble.position,
            targetColor,
            PARTICLE_CONFIG.colorSplash.spiralParticles,
            this.colorParticlePool  // Use dedicated pool for proper color support
        );
    }
    
    transformBubbleColor(bubble, newColor, gameState, gameManager) {
        // Skip if bubble is destroyed
        if (!bubble || bubble.isDestroyed) return;
        
        // Store old color for transition effect
        const oldColor = bubble.color;
        
        // Create transformation particles - Use dedicated color pool
        ParticleFactory.createColorTransform(
            bubble.position,
            oldColor,
            newColor,
            PARTICLE_CONFIG.colorSplash.transformParticles,
            this.colorParticlePool  // Use dedicated pool for proper color support
        );
        
        // Update bubble color property
        bubble.color = newColor;
        
        // Update visual representation based on rendering type
        if (bubble.useInstancedRendering) {
            // For instanced bubbles, update through the instance manager
            if (gameManager.bubbleInstances) {
                const success = gameManager.bubbleInstances.updateBubbleColor(bubble, newColor);
                if (!success) {
                    console.warn('Failed to update bubble color for instanced bubble:', bubble.id);
                }
            }
        } else {
            // For regular bubbles, update material directly
            if (bubble.material) {
                bubble.material.color.set(newColor);
                bubble.material.emissive.set(newColor);
            }
            if (bubble.glowMesh && bubble.glowMesh.material) {
                bubble.glowMesh.material.color.set(newColor);
            }
        }
        
        // Add transformation pulse
        bubble.connectionAnimating = 1.5;
        
        // Create flash effect
        const flash = new THREE.PointLight(newColor, 3, 3);
        flash.position.copy(bubble.position);
        if (gameManager.scene) gameManager.scene.add(flash);
        
        setTimeout(() => {
            if (gameManager.scene) gameManager.scene.remove(flash);
            flash.dispose();
        }, 200);
    }
    
    update(deltaTime) {
        // Update the dedicated color particle pool
        if (this.colorParticlePool) {
            this.colorParticlePool.update(deltaTime);
        }
    }
    
    createVisualEffect(bubble) {
        super.createVisualEffect(bubble);
        
        // Multicolor swirling material - OPTIMIZED
        bubble.mesh.material = new THREE.MeshPhongMaterial({
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 0.5,
            shininess: 100,
            specular: 0x00ffff
        });
        
        // Add swirling color particles
        const particleCount = 5;
        bubble.colorParticles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const particleColor = CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
            const particleMaterial = new THREE.MeshStandardMaterial({
                color: particleColor,
                transparent: true,
                opacity: 0.8,
                emissive: particleColor,
                emissiveIntensity: 2
            });
            
            const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
            bubble.mesh.add(particleMesh);
            bubble.colorParticles.push({
                mesh: particleMesh,
                angle: (Math.PI * 2 * i) / particleCount,
                radius: CONFIG.BUBBLE_RADIUS * 0.8,
                speed: 2 + Math.random(),
                color: particleColor
            });
        }
        
        // Enhanced animation with swirling particles
        const originalUpdate = bubble.powerUpAnimation.update;
        bubble.powerUpAnimation.update = function(deltaTime) {
            originalUpdate.call(this, deltaTime);
            
            // Animate color shift
            const hue = (this.time * 0.2) % 1;
            bubble.mesh.material.color.setHSL(hue, 1, 0.5);
            bubble.mesh.material.emissive.setHSL(hue, 1, 0.5);
            
            // Animate swirling particles
            bubble.colorParticles.forEach((particle, index) => {
                particle.angle += particle.speed * deltaTime;
                const wobble = Math.sin(this.time * 3 + index) * 0.1;
                const r = particle.radius + wobble;
                
                particle.mesh.position.x = Math.cos(particle.angle) * r;
                particle.mesh.position.y = Math.sin(particle.angle) * r;
                particle.mesh.position.z = Math.sin(this.time * 2 + index) * 0.2;
                
                // Pulse opacity
                particle.mesh.material.opacity = 0.5 + Math.sin(this.time * 4 + index) * 0.3;
            });
        };
    }
}