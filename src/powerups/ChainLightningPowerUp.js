import * as THREE from 'three';
import { CONFIG, PARTICLE_CONFIG } from '../core/Config.js';
import { PowerUp } from './PowerUp.js';
import { ParticleFactory } from '../entities/Particle.js';

/**
 * Chain Lightning Power-Up
 * Creates arcing lightning that jumps between nearby bubbles
 */
export class ChainLightningPowerUp extends PowerUp {
    constructor() {
        super('chainLightning', {
            name: 'Chain Lightning Bubble',
            rarity: 'rare',
            spawnRate: 0.08,
            color: 0x00aaff,
            glowColor: 0x00ddff
        });
        this.primaryArcCount = 3; // 2-3 primary arcs
        this.secondaryArcCount = 2; // 1-2 secondary arcs per primary
        this.hitBubbles = new Set(); // Track bubbles already hit
    }
    
    activate(targetBubbleOrPosition, gameState, gameManager) {
        // Clear hit tracking for this activation
        this.hitBubbles.clear();
        
        let impactBubble = null;
        let impactPos = null;
        
        // Handle both bubble object and position input
        if (targetBubbleOrPosition.position) {
            // It's a bubble object
            impactBubble = targetBubbleOrPosition;
            impactPos = targetBubbleOrPosition.position;
        } else {
            // It's a position, find the bubble at that position
            impactPos = targetBubbleOrPosition;
            let minDistance = Infinity;
            
            // Check all grid bubbles to find the one at impact position
            for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
                for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                    const bubble = gameState.getBubbleAt(x, y);
                    if (bubble) {
                        const distance = bubble.position.distanceTo(impactPos);
                        if (distance < minDistance) {
                            minDistance = distance;
                            impactBubble = bubble;
                        }
                    }
                }
            }
        }
        
        if (!impactBubble) {
            console.log('Chain Lightning: No bubble found for activation');
            return false;
        }
        
        // Emit event for visual/audio feedback
        gameManager.eventBus.emit('chainLightningActivated', {
            position: impactPos,
            bubble: impactBubble
        });
        
        // Start the chain lightning effect
        this.executeChainLightning(impactBubble, gameState, gameManager);
        
        return true;
    }
    
    executeChainLightning(impactBubble, gameState, gameManager) {
        const bubblesDestroyed = [];
        
        // 1. Destroy the initial impact bubble
        this.hitBubbles.add(impactBubble);
        bubblesDestroyed.push(impactBubble);
        
        // Create initial impact effect
        this.createLightningImpactEffect(impactBubble.position, gameState, gameManager);
        
        // 2. Find and destroy primary arc targets
        const primaryTargets = this.findNearestBubbles(
            impactBubble,
            this.primaryArcCount,
            gameState,
            this.hitBubbles
        );
        
        // Create primary lightning arcs with delay
        primaryTargets.forEach((target, index) => {
            setTimeout(() => {
                this.createLightningArc(
                    impactBubble.position,
                    target.position,
                    true, // isPrimary
                    gameState,
                    gameManager
                );
                this.hitBubbles.add(target);
                bubblesDestroyed.push(target);
                
                // Play electric arc sound
                gameManager.playSound('electricArc');
                
                // 3. For each primary target, find secondary targets
                const secondaryTargets = this.findNearestBubbles(
                    target,
                    Math.floor(Math.random() * 2) + 1, // 1-2 secondary arcs
                    gameState,
                    this.hitBubbles
                );
                
                // Create secondary arcs with additional delay
                secondaryTargets.forEach((secondaryTarget, secondaryIndex) => {
                    setTimeout(() => {
                        this.createLightningArc(
                            target.position,
                            secondaryTarget.position,
                            false, // not primary
                            gameState,
                            gameManager
                        );
                        this.hitBubbles.add(secondaryTarget);
                        bubblesDestroyed.push(secondaryTarget);
                        
                        // Play quieter arc sound for secondary
                        gameManager.playSound('electricArc');
                    }, 50 + secondaryIndex * 30);
                });
            }, 100 + index * 50);
        });
        
        // Destroy all hit bubbles after all arcs are shown (unified instanced approach)
        setTimeout(() => {
            bubblesDestroyed.forEach((bubble, index) => {
                setTimeout(() => {
                    // Create world-space electrical effects (independent of bubble mesh)
                    if (gameManager.effectsSystem) {
                        gameManager.effectsSystem.createElectricArcs(bubble.position, bubble.id, 400);
                        gameManager.effectsSystem.createElectricSparks(bubble.position, bubble.id, 15);
                        gameManager.effectsSystem.createElectricField(bubble.position, bubble.id);
                    }
                    
                    // Apply visual jitter effect to bubble mesh
                    if (bubble.mesh) {
                        const originalPos = bubble.mesh.position.clone();
                        let jitterCount = 0;
                        const jitterInterval = setInterval(() => {
                            if (bubble.mesh && bubble.mesh.parent) {
                                const jitterAmount = 0.1;
                                bubble.mesh.position.x = originalPos.x + (Math.random() - 0.5) * jitterAmount;
                                bubble.mesh.position.y = originalPos.y + (Math.random() - 0.5) * jitterAmount;
                                jitterCount++;
                                if (jitterCount > 20) { // ~320ms of jitter
                                    clearInterval(jitterInterval);
                                    if (bubble.mesh && bubble.mesh.parent) {
                                        bubble.mesh.position.copy(originalPos);
                                    }
                                }
                            } else {
                                clearInterval(jitterInterval);
                            }
                        }, 16);
                    }
                    
                    // Create additional visual effects
                    this.createBubbleElectricFlash(bubble.position, gameManager);
                    this.createBubbleFlickerEffect(bubble);
                    
                    // CRITICAL FIX: Remove bubble from grid IMMEDIATELY to prevent collision
                    const gridPos = this.findBubbleGridPosition(bubble, gameState);
                    if (gridPos) {
                        gameState.setBubbleAt(gridPos.x, gridPos.y, null);
                    }
                    
                    // Also mark the bubble as destroyed to prevent any collision detection
                    bubble.isDestroyed = true;
                    
                    // Remove mesh from scene after electrical effects
                    setTimeout(() => {
                        if (bubble.mesh && bubble.mesh.parent) {
                            bubble.mesh.parent.remove(bubble.mesh);
                        }
                        bubble.destroy();
                    }, 450); // Remove after effects complete
                    
                }, index * 50); // Stagger the destruction
            });
            
            // Emit event to handle cleanup and scoring after all bubbles are processed
            setTimeout(() => {
                gameManager.eventBus.emit('chainLightningDestroy', {
                    bubbles: bubblesDestroyed,
                    points: bubblesDestroyed.length * 25
                });
            }, bubblesDestroyed.length * 50 + 200);
            
        }, primaryTargets.length * 50 + 300);
    }
    
    findBubbleGridPosition(bubble, gameState) {
        // Find the grid position of a bubble
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                if (gameState.getBubbleAt(x, y) === bubble) {
                    return { x, y };
                }
            }
        }
        return null;
    }
    
    findNearestBubbles(centerBubble, count, gameState, excludeSet) {
        const candidates = [];
        
        // Find all valid neighbor bubbles
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = gameState.getBubbleAt(x, y);
                if (bubble && bubble !== centerBubble && !excludeSet.has(bubble) && !bubble.isPowerUp) {
                    const distance = centerBubble.position.distanceTo(bubble.position);
                    candidates.push({ bubble, distance });
                }
            }
        }
        
        // Sort by distance and return the nearest ones
        candidates.sort((a, b) => a.distance - b.distance);
        return candidates.slice(0, count).map(c => c.bubble);
    }
    
    createLightningImpactEffect(position, gameState, gameManager) {
        // Enhanced impact effect using GPU particles
        this.createMainImpactBurst(position, gameState);
        this.createElectricRingWave(position, gameState);
        this.createSparkShower(position, gameState);
        
        // Create temporary intense lighting
        this.createImpactLighting(position, gameManager);
        
        // Screen shake with electrical jitter
        gameManager.addScreenShake(0.4, 12);
    }
    
    createMainImpactBurst(position, gameState) {
        // Main electrical explosion at impact point (reduced for performance)
        const burstCount = 15;
        const colors = [0x00ddff, 0xffffff, 0x88ccff, 0x0088ff];
        
        for (let i = 0; i < burstCount; i++) {
            const angle = (Math.PI * 2 * i) / burstCount;
            const speed = 8 + Math.random() * 12;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                (Math.random() - 0.5) * 8
            );
            
            // Use power-based spawning for enhanced GPU effects
            const particle = gameState.particlePool.spawnPower ? 
                gameState.particlePool.spawnPower(
                    position.x,
                    position.y,
                    position.z,
                    color,
                    0.15,
                    velocity,
                    0.8 // High power for dramatic effect
                ) :
                gameState.particlePool.spawn(
                    position.x,
                    position.y,
                    position.z,
                    color,
                    0.15,
                    velocity
                );
            
            if (particle && !gameState.particlePool.spawnPower) {
                particle.decay = 0.03; // Slower decay for impact
            }
        }
    }
    
    createElectricRingWave(position, gameState) {
        // Expanding ring of electrical particles (reduced for performance)
        const ringParticles = 12;
        const rings = 2;
        
        for (let ring = 0; ring < rings; ring++) {
            setTimeout(() => {
                for (let i = 0; i < ringParticles; i++) {
                    const angle = (Math.PI * 2 * i) / ringParticles;
                    const radius = 0.5 + ring * 0.3;
                    const speed = 6 + ring * 2;
                    
                    const startX = position.x + Math.cos(angle) * radius;
                    const startY = position.y + Math.sin(angle) * radius;
                    
                    const velocity = new THREE.Vector3(
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        (Math.random() - 0.5) * 3
                    );
                    
                    const particle = gameState.particlePool.spawn(
                        startX,
                        startY,
                        position.z + 0.2,
                        ring === 0 ? 0xffffff : 0x00ddff,
                        0.12
                    );
                    
                    if (particle) {
                        particle.decay = 0.04;
                    }
                }
            }, ring * 50);
        }
    }
    
    createSparkShower(position, gameState) {
        // Upward shower of electrical sparks (reduced for performance)
        const sparkCount = 10;
        
        for (let i = 0; i < sparkCount; i++) {
            setTimeout(() => {
                const angle = Math.random() * Math.PI * 2;
                const upwardBias = 2; // Bias towards upward movement
                const speed = 5 + Math.random() * 8;
                
                const velocity = new THREE.Vector3(
                    Math.cos(angle) * speed * 0.6,
                    Math.sin(angle) * speed * 0.6 + upwardBias,
                    Math.random() * 4
                );
                
                const particle = gameState.particlePool.spawn(
                    position.x + (Math.random() - 0.5) * 0.4,
                    position.y + (Math.random() - 0.5) * 0.4,
                    position.z + 0.1,
                    Math.random() > 0.3 ? 0x00ddff : 0xffffff,
                    0.08
                );
                
                if (particle) {
                    particle.decay = 0.05;
                    // Add gravity for realistic arc
                    const originalUpdate = particle.update;
                    particle.update = function(deltaTime) {
                        this.velocity.y -= 15 * deltaTime; // Gravity
                        return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                    };
                }
            }, Math.random() * 100);
        }
    }
    
    createImpactLighting(position, gameManager) {
        // Bright flash light
        const flashLight = new THREE.PointLight(0x00ddff, 15, 6);
        flashLight.position.copy(position);
        flashLight.position.z = 3;
        if (gameManager.scene) gameManager.scene.add(flashLight);
        
        // Pulsing decay
        let intensity = 15;
        const fadeInterval = setInterval(() => {
            intensity *= 0.85;
            flashLight.intensity = intensity + Math.random() * 2; // Electrical flicker
            
            if (intensity < 0.1) {
                if (gameManager.scene) gameManager.scene.remove(flashLight);
                clearInterval(fadeInterval);
            }
        }, 16);
    }
    
    createLightningArc(startPos, endPos, isPrimary, gameState, gameManager) {
        // Enhanced lightning arc with particle trail
        this.createLightningGeometry(startPos, endPos, isPrimary, gameState, gameManager);
        this.createLightningParticleTrail(startPos, endPos, isPrimary, gameState);
        this.createLightningEndEffect(endPos, isPrimary, gameState);
    }
    
    createLightningGeometry(startPos, endPos, isPrimary, gameState, gameManager) {
        // Create animated lightning bolt geometry with multiple layers
        const points = this.generateLightningPath(startPos, endPos, isPrimary ? 7 : 4);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Main lightning bolt
        const material = new THREE.LineBasicMaterial({
            color: isPrimary ? 0x00ddff : 0x66ccff,
            transparent: true,
            opacity: 1,
            linewidth: isPrimary ? 4 : 2
        });
        
        const lightning = new THREE.Line(geometry, material);
        lightning.position.z = 1.5; // Above bubbles
        if (gameManager.scene) gameManager.scene.add(lightning);
        
        // Inner white core
        const coreMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            linewidth: isPrimary ? 2 : 1
        });
        const coreLine = new THREE.Line(geometry, coreMaterial);
        coreLine.position.z = 1.6;
        if (gameManager.scene) gameManager.scene.add(coreLine);
        
        // Outer glow effect
        const glowMaterial = new THREE.LineBasicMaterial({
            color: isPrimary ? 0x00ddff : 0x88ccff,
            transparent: true,
            opacity: 0.3,
            linewidth: isPrimary ? 8 : 5
        });
        const glowLine = new THREE.Line(geometry, glowMaterial);
        glowLine.position.z = 1.4;
        if (gameManager.scene) gameManager.scene.add(glowLine);
        
        // Animate the lightning with enhanced effects
        const lightningAnimation = {
            time: 0,
            opacity: 1,
            update: function(deltaTime) {
                this.time += deltaTime;
                
                // Enhanced flicker effect with electrical intensity
                const baseFlicker = Math.random() > 0.2 ? 1 : 0.3;
                const electricFlicker = 1 + Math.sin(this.time * 30) * 0.3;
                const flicker = baseFlicker * electricFlicker;
                
                material.opacity = this.opacity * flicker;
                coreMaterial.opacity = this.opacity * 0.9 * flicker;
                glowMaterial.opacity = this.opacity * 0.3 * flicker;
                
                // Update path for dynamic movement with more segments
                if (this.time < 0.25) {
                    const newPoints = this.generateLightningPath(startPos, endPos, isPrimary ? 7 : 4);
                    geometry.setFromPoints(newPoints);
                }
                
                // Fade out
                if (this.time > 0.4) {
                    this.opacity -= deltaTime * 1.5;
                    if (this.opacity <= 0) {
                        if (gameManager.scene) {
                            gameManager.scene.remove(lightning);
                            gameManager.scene.remove(coreLine);
                            gameManager.scene.remove(glowLine);
                        }
                        geometry.dispose();
                        material.dispose();
                        coreMaterial.dispose();
                        glowMaterial.dispose();
                        return false;
                    }
                }
                return true;
            }.bind(this)
        };
        
        gameState.addAnimation(lightningAnimation);
    }
    
    createLightningParticleTrail(startPos, endPos, isPrimary, gameState) {
        // Create particle trail along the lightning path (reduced for performance)
        const trailParticles = isPrimary ? 8 : 4;
        const colors = [0x00ddff, 0xffffff, 0x88ccff];
        
        for (let i = 0; i < trailParticles; i++) {
            setTimeout(() => {
                const t = i / (trailParticles - 1);
                const x = startPos.x + (endPos.x - startPos.x) * t;
                const y = startPos.y + (endPos.y - startPos.y) * t;
                const z = startPos.z + (endPos.z - startPos.z) * t + 0.5;
                
                // Add electrical jitter
                const jitterX = (Math.random() - 0.5) * 0.3;
                const jitterY = (Math.random() - 0.5) * 0.3;
                
                const velocity = new THREE.Vector3(
                    jitterX + (Math.random() - 0.5) * 2,
                    jitterY + (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 3
                );
                
                const color = colors[Math.floor(Math.random() * colors.length)];
                const particle = gameState.particlePool.spawn(
                    x + jitterX,
                    y + jitterY,
                    z,
                    color,
                    isPrimary ? 0.12 : 0.08
                );
                
                if (particle) {
                    particle.decay = 0.06; // Quick sparks
                    
                    // Add electrical jitter to movement
                    const originalUpdate = particle.update;
                    particle.update = function(deltaTime) {
                        // Electrical jitter
                        this.velocity.x += (Math.random() - 0.5) * 0.8;
                        this.velocity.y += (Math.random() - 0.5) * 0.8;
                        this.velocity.z += (Math.random() - 0.5) * 0.5;
                        
                        return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                    };
                }
            }, i * 10); // Staggered timing for trail effect
        }
    }
    
    createLightningEndEffect(endPos, isPrimary, gameState) {
        // Create impact burst at the end of the lightning arc
        const burstCount = isPrimary ? 12 : 6;
        const colors = [0x00ddff, 0xffffff, 0x88ccff];
        
        for (let i = 0; i < burstCount; i++) {
            const angle = (Math.PI * 2 * i) / burstCount;
            const speed = 3 + Math.random() * 4;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                (Math.random() - 0.5) * 4
            );
            
            const particle = gameState.particlePool.spawn(
                endPos.x,
                endPos.y,
                endPos.z + 0.3,
                color,
                isPrimary ? 0.1 : 0.08
            );
            
            if (particle) {
                particle.decay = 0.05;
            }
        }
    }
    
    generateLightningPath(start, end, segments) {
        const points = [];
        points.push(new THREE.Vector3(start.x, start.y, start.z + 0.5));
        
        // Generate intermediate points with random offset
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const x = start.x + (end.x - start.x) * t;
            const y = start.y + (end.y - start.y) * t;
            const z = start.z + (end.z - start.z) * t + 0.5;
            
            // Add random offset perpendicular to the line
            const perpX = -(end.y - start.y);
            const perpY = end.x - start.x;
            const length = Math.sqrt(perpX * perpX + perpY * perpY);
            const normalizedPerpX = perpX / length;
            const normalizedPerpY = perpY / length;
            
            const offset = (Math.random() - 0.5) * 0.3;
            points.push(new THREE.Vector3(
                x + normalizedPerpX * offset,
                y + normalizedPerpY * offset,
                z
            ));
        }
        
        points.push(new THREE.Vector3(end.x, end.y, end.z + 0.5));
        return points;
    }
    
    createElectricDestructionEffect(bubble, gameState) {
        // Enhanced electrical "short-circuit" destruction effect
        this.createElectricExplosion(bubble.position, gameState);
        this.createElectricShockwave(bubble.position, gameState);
        this.createElectricFragments(bubble.position, gameState);
    }
    
    createElectricExplosion(position, gameState) {
        // Main electrical explosion when bubble is destroyed (reduced for performance)
        const explosionCount = 12;
        const colors = [0x00ddff, 0xffffff, 0x88ccff, 0x0088ff];
        
        for (let i = 0; i < explosionCount; i++) {
            const angle = (Math.PI * 2 * i) / explosionCount;
            const speed = 6 + Math.random() * 8;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                (Math.random() - 0.5) * 6
            );
            
            // Use power-based spawning for enhanced effects
            const particle = gameState.particlePool.spawnPower ? 
                gameState.particlePool.spawnPower(
                    position.x,
                    position.y,
                    position.z,
                    color,
                    0.12,
                    velocity,
                    0.7 // High power for electrical destruction
                ) :
                gameState.particlePool.spawn(
                    position.x,
                    position.y,
                    position.z,
                    color,
                    0.12,
                    velocity
                );
            
            if (particle) {
                if (!gameState.particlePool.spawnPower) {
                    particle.decay = 0.04;
                }
                
                // Add electrical jitter
                const originalUpdate = particle.update;
                particle.update = function(deltaTime) {
                    this.velocity.x += (Math.random() - 0.5) * 0.6;
                    this.velocity.y += (Math.random() - 0.5) * 0.6;
                    this.velocity.z += (Math.random() - 0.5) * 0.4;
                    
                    return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                };
            }
        }
    }
    
    createElectricShockwave(position, gameState) {
        // Expanding electrical shockwave
        const waveCount = 16;
        const waves = 2;
        
        for (let wave = 0; wave < waves; wave++) {
            setTimeout(() => {
                for (let i = 0; i < waveCount; i++) {
                    const angle = (Math.PI * 2 * i) / waveCount;
                    const radius = 0.3 + wave * 0.2;
                    const speed = 8 + wave * 3;
                    
                    const startX = position.x + Math.cos(angle) * radius;
                    const startY = position.y + Math.sin(angle) * radius;
                    
                    const velocity = new THREE.Vector3(
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        (Math.random() - 0.5) * 2
                    );
                    
                    const particle = gameState.particlePool.spawn(
                        startX,
                        startY,
                        position.z + 0.1,
                        wave === 0 ? 0xffffff : 0x00ddff,
                        0.1
                    );
                    
                    if (particle) {
                        particle.decay = 0.06;
                    }
                }
            }, wave * 30);
        }
    }
    
    createElectricFragments(position, gameState) {
        // Electrical fragments flying off
        const fragmentCount = 15;
        
        for (let i = 0; i < fragmentCount; i++) {
            setTimeout(() => {
                const angle = Math.random() * Math.PI * 2;
                const speed = 4 + Math.random() * 6;
                const upwardBias = Math.random() * 2;
                
                const velocity = new THREE.Vector3(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed + upwardBias,
                    Math.random() * 3
                );
                
                const particle = gameState.particlePool.spawn(
                    position.x + (Math.random() - 0.5) * 0.3,
                    position.y + (Math.random() - 0.5) * 0.3,
                    position.z,
                    Math.random() > 0.5 ? 0x00ddff : 0xffffff,
                    0.08
                );
                
                if (particle) {
                    particle.decay = 0.07;
                    
                    // Add gravity and electrical behavior
                    const originalUpdate = particle.update;
                    particle.update = function(deltaTime) {
                        this.velocity.y -= 10 * deltaTime; // Gravity
                        
                        // Electrical jitter
                        if (Math.random() < 0.3) {
                            this.velocity.x += (Math.random() - 0.5) * 0.4;
                            this.velocity.y += (Math.random() - 0.5) * 0.4;
                        }
                        
                        return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                    };
                }
            }, Math.random() * 50);
        }
    }
    
    createElectricCoursingEffect(bubble, gameState, gameManager) {
        // Legacy method - effects now handled by BubbleEffectsSystem
        // Keep for compatibility but most effects moved to world-space system
        console.log('Creating electric coursing effect for bubble:', bubble.position);
        
        this.createBubbleElectricFlash(bubble.position, gameManager);
        this.createBubbleFlickerEffect(bubble);
        
        // Note: Electric sparks, field, and arcs now handled by BubbleEffectsSystem
        // in the main Chain Lightning execution for better performance and consistency
    }
    
    createBubbleElectricFlash(position, gameManager) {
        // Intense electric flash at bubble position  
        const flashLight = new THREE.PointLight(0x00ddff, 12, 5);
        flashLight.position.copy(position);
        flashLight.position.z = 2;
        if (gameManager.scene) gameManager.scene.add(flashLight);
        
        // Secondary flash for depth
        const flash2 = new THREE.PointLight(0xffffff, 8, 3);
        flash2.position.copy(position);
        flash2.position.z = 2.5;
        if (gameManager.scene) gameManager.scene.add(flash2);
        
        // Animated fade with electrical flicker
        let intensity1 = 12;
        let intensity2 = 8;
        const fadeInterval = setInterval(() => {
            intensity1 *= 0.9;
            intensity2 *= 0.9;
            
            // Add electrical flicker
            flashLight.intensity = intensity1 + Math.random() * 3;
            flash2.intensity = intensity2 + Math.random() * 2;
            
            if (intensity1 < 0.1) {
                if (gameManager.scene) {
                    gameManager.scene.remove(flashLight);
                    gameManager.scene.remove(flash2);
                }
                clearInterval(fadeInterval);
            }
        }, 16);
    }
    
    createElectricSparks(bubble, gameState) {
        // Enhanced electrical sparks coursing around the bubble (reduced for performance)
        const sparkCount = 15;
        const colors = [0x00ddff, 0xffffff, 0x88ccff, 0x0088ff];
        
        for (let i = 0; i < sparkCount; i++) {
            setTimeout(() => {
                const angle = Math.random() * Math.PI * 2;
                const radius = CONFIG.BUBBLE_RADIUS * (0.6 + Math.random() * 0.6);
                const speed = 4 + Math.random() * 6;
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                // Start position around the bubble
                const startX = bubble.position.x + Math.cos(angle) * radius;
                const startY = bubble.position.y + Math.sin(angle) * radius;
                
                const velocity = new THREE.Vector3(
                    Math.cos(angle + Math.PI) * speed * 0.3, // Slight inward movement
                    Math.sin(angle + Math.PI) * speed * 0.3,
                    (Math.random() - 0.5) * 3
                );
                
                const particle = gameState.particlePool.spawn(
                    startX,
                    startY,
                    bubble.position.z + 0.3,
                    color,
                    0.1
                );
                
                if (particle) {
                    particle.decay = 0.08; // Quick spark decay
                    
                    // Enhanced electrical jitter movement
                    const originalUpdate = particle.update;
                    particle.update = function(deltaTime) {
                        // Strong electrical jitter
                        this.velocity.x += (Math.random() - 0.5) * 1.2;
                        this.velocity.y += (Math.random() - 0.5) * 1.2;
                        this.velocity.z += (Math.random() - 0.5) * 0.8;
                        
                        // Occasional random direction changes
                        if (Math.random() < 0.1) {
                            const newAngle = Math.random() * Math.PI * 2;
                            const newSpeed = 2 + Math.random() * 3;
                            this.velocity.x = Math.cos(newAngle) * newSpeed;
                            this.velocity.y = Math.sin(newAngle) * newSpeed;
                        }
                        
                        return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                    };
                }
            }, i * 8); // Staggered spark creation
        }
    }
    
    createElectricField(position, gameState) {
        // Create electrical field particles around the bubble (reduced for performance)
        const fieldParticles = 10;
        const fieldRadius = CONFIG.BUBBLE_RADIUS * 1.5;
        
        for (let i = 0; i < fieldParticles; i++) {
            setTimeout(() => {
                const angle = (Math.PI * 2 * i) / fieldParticles;
                const radius = fieldRadius * (0.8 + Math.random() * 0.4);
                
                const particle = gameState.particlePool.spawn(
                    position.x + Math.cos(angle) * radius,
                    position.y + Math.sin(angle) * radius,
                    position.z + (Math.random() - 0.5) * 0.5,
                    Math.random() > 0.7 ? 0xffffff : 0x00ddff,
                    0.06
                );
                
                if (particle) {
                    particle.decay = 0.12; // Very quick fade
                    
                    // Orbital movement with electrical distortion
                    const originalUpdate = particle.update;
                    particle.update = function(deltaTime) {
                        // Orbit around the bubble center
                        const dx = this.position.x - position.x;
                        const dy = this.position.y - position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance > 0) {
                            const orbitalSpeed = 8;
                            this.velocity.x = -dy / distance * orbitalSpeed;
                            this.velocity.y = dx / distance * orbitalSpeed;
                            
                            // Add electrical distortion
                            this.velocity.x += (Math.random() - 0.5) * 3;
                            this.velocity.y += (Math.random() - 0.5) * 3;
                        }
                        
                        return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                    };
                }
            }, i * 5);
        }
    }
    
    createBubbleFlickerEffect(bubble) {
        // Enhanced bubble electrical flicker effect
        if (bubble.mesh && bubble.mesh.material) {
            const originalEmissive = bubble.mesh.material.emissive ? bubble.mesh.material.emissive.clone() : new THREE.Color(0x000000);
            const originalIntensity = bubble.mesh.material.emissiveIntensity || 0;
            const originalColor = bubble.mesh.material.color ? bubble.mesh.material.color.clone() : new THREE.Color(0xffffff);
            
            // Enhanced electric flicker effect
            let flickerTime = 0;
            const flickerInterval = setInterval(() => {
                flickerTime += 16;
                
                if (bubble.mesh && bubble.mesh.material) {
                    // More varied intensity patterns
                    const baseIntensity = Math.random() > 0.3 ? 1.8 : 0.2;
                    const electricFlicker = 1 + Math.sin(flickerTime * 0.1) * 0.5;
                    const intensity = baseIntensity * electricFlicker;
                    
                    // Alternate between blue and white electrical colors
                    const electricColor = Math.random() > 0.6 ? 0xffffff : 0x00ddff;
                    bubble.mesh.material.emissive.setHex(electricColor);
                    bubble.mesh.material.emissiveIntensity = intensity;
                    
                    // Occasionally change the base color to simulate electrical charge
                    if (Math.random() < 0.1) {
                        const chargeColor = new THREE.Color(originalColor).lerp(new THREE.Color(0x00ddff), 0.3);
                        bubble.mesh.material.color.copy(chargeColor);
                    }
                    
                    // Stop flickering after a longer time for more dramatic effect
                    if (flickerTime > 400) {
                        bubble.mesh.material.emissive.copy(originalEmissive);
                        bubble.mesh.material.emissiveIntensity = originalIntensity;
                        bubble.mesh.material.color.copy(originalColor);
                        clearInterval(flickerInterval);
                    }
                }
            }, 16);
        }
    }
    
    // createTemporaryElectricArcs method removed - effects now handled by BubbleEffectsSystem
    // This eliminates the dependency on individual bubble meshes and works with instanced rendering
    
    createVisualEffect(bubble, gameState) {
        super.createVisualEffect(bubble);
        
        // Enhanced dark stormy bubble with electric core
        bubble.mesh.material = new THREE.MeshPhysicalMaterial({
            color: 0x000a1a,          // Darker base color
            emissive: 0x0088ff,       // Brighter electric blue emission
            emissiveIntensity: 0.8,   // Higher intensity
            metalness: 0.95,          // More metallic for electrical appearance
            roughness: 0.05,          // Smoother for better electrical reflection
            clearcoat: 1,
            clearcoatRoughness: 0,
            transmission: 0.7,        // More transparent for internal effects
            thickness: 0.3,           // Thinner for better light transmission
            ior: 1.6,                 // Higher index for more dramatic refraction
            envMapIntensity: 1.5      // Enhanced environment reflections
        });
        
        // Add internal lightning core
        const coreGeometry = new THREE.SphereGeometry(CONFIG.BUBBLE_RADIUS * 0.3, 8, 8);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ddff,
            transparent: true,
            opacity: 0.8
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        bubble.mesh.add(core);
        bubble.lightningCore = core;
        
        // Add crackling electric arcs around the bubble
        const arcCount = 4;
        bubble.electricArcs = [];
        
        for (let i = 0; i < arcCount; i++) {
            const arcGeometry = new THREE.BufferGeometry();
            const arcPositions = new Float32Array(6 * 3);
            arcGeometry.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
            
            const arcMaterial = new THREE.LineBasicMaterial({
                color: 0x00ddff,
                transparent: true,
                opacity: 0.8,
                linewidth: 2
            });
            
            const arc = new THREE.Line(arcGeometry, arcMaterial);
            bubble.mesh.add(arc);
            bubble.electricArcs.push({
                mesh: arc,
                phase: Math.random() * Math.PI * 2,
                speed: 2 + Math.random() * 2
            });
        }
        
        // Enhanced animation with pulsing core, dynamic arcs, and GPU particle effects
        const originalUpdate = bubble.powerUpAnimation.update;
        bubble.powerUpAnimation.update = function(deltaTime) {
            originalUpdate.call(this, deltaTime);
            
            // Pulse the core with more dramatic effects
            const corePulse = 0.6 + Math.sin(this.time * 6) * 0.4;
            const coreFlicker = Math.random() > 0.1 ? 1 : 0.3;
            bubble.lightningCore.scale.setScalar(corePulse * coreFlicker);
            bubble.lightningCore.material.opacity = (0.5 + Math.sin(this.time * 4) * 0.5) * coreFlicker;
            
            // Enhanced core material properties
            const coreIntensity = 0.3 + Math.sin(this.time * 8) * 0.7;
            if (bubble.lightningCore.material.emissive) {
                bubble.lightningCore.material.emissive.setHex(Math.random() > 0.3 ? 0x00ddff : 0xffffff);
            }
            
            // Update electric arcs with more chaotic movement
            bubble.electricArcs.forEach((arc, index) => {
                const positions = arc.mesh.geometry.attributes.position.array;
                const time = this.time * arc.speed + arc.phase;
                
                for (let j = 0; j < 6; j++) {
                    const t = j / 5;
                    const angle = time + t * Math.PI * 2 + index * Math.PI * 0.5;
                    const baseRadius = CONFIG.BUBBLE_RADIUS * 0.8;
                    const radiusVariation = Math.sin(time * 4 + j + index) * 0.3;
                    const radius = baseRadius + radiusVariation;
                    
                    // Enhanced erratic movement with electrical behavior
                    const electricJitter = Math.sin(time * 15 + j * 3) * 0.15;
                    const randomJitter = (Math.random() - 0.5) * 0.25;
                    const totalJitterX = electricJitter + randomJitter;
                    const totalJitterY = electricJitter * 0.8 + randomJitter;
                    
                    positions[j * 3] = Math.cos(angle) * radius + totalJitterX;
                    positions[j * 3 + 1] = Math.sin(angle) * radius + totalJitterY;
                    positions[j * 3 + 2] = (j - 2.5) * 0.4 + Math.sin(time * 6 + j) * 0.2;
                }
                
                arc.mesh.geometry.attributes.position.needsUpdate = true;
                
                // Enhanced arc opacity with electrical flicker
                const baseOpacity = 0.4 + Math.sin(time * 2 + index) * 0.3;
                const electricFlicker = Math.random() > 0.15 ? 1 : 0.2;
                arc.mesh.material.opacity = baseOpacity * electricFlicker;
                
                // Occasionally change arc color for more dynamic effect
                if (Math.random() < 0.05) {
                    arc.mesh.material.color.setHex(Math.random() > 0.5 ? 0x00ddff : 0xffffff);
                }
            });
            
            // Note: Particle effects now handled by BubbleEffectsSystem for instanced bubbles
            // Individual mesh particle effects disabled for consistency
            
            // Enhanced bright flash (without particle burst for instanced bubbles)
            if (Math.random() < 0.02) {
                bubble.mesh.material.emissiveIntensity = 2.0;
                
                setTimeout(() => {
                    if (bubble.mesh && bubble.mesh.material) {
                        bubble.mesh.material.emissiveIntensity = 0.8;
                    }
                }, 80);
            }
        };
        
        // Particle effect methods disabled for instanced rendering compatibility
        // Effects are now handled by BubbleEffectsSystem at world positions
        if (false && bubble.powerUpAnimation) { // Disabled
            bubble.powerUpAnimation.createCoreParticleEmission = (bubble, gameState) => {
                // Enhanced core particle emission
                const corePos = bubble.position.clone();
                const velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 4
                );
                
                const colors = [0x00ddff, 0xffffff, 0x88ccff, 0x0088ff];
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                const particle = gameState.particlePool.spawnPower ? 
                    gameState.particlePool.spawnPower(
                        corePos.x, corePos.y, corePos.z,
                        color, 0.08, velocity, 0.6
                    ) :
                    gameState.particlePool.spawn(
                        corePos.x, corePos.y, corePos.z,
                        color, 0.08, velocity
                    );
                
                if (particle && !gameState.particlePool.spawnPower) {
                    particle.decay = 0.06;
                }
            };
            
            bubble.powerUpAnimation.createPeriodicElectricSparks = (bubble, gameState) => {
                // Create sparks around the bubble perimeter
                const sparkCount = 2 + Math.floor(Math.random() * 3);
                for (let i = 0; i < sparkCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const radius = CONFIG.BUBBLE_RADIUS * (0.9 + Math.random() * 0.3);
                    const sparkPos = new THREE.Vector3(
                        bubble.position.x + Math.cos(angle) * radius,
                        bubble.position.y + Math.sin(angle) * radius,
                        bubble.position.z + (Math.random() - 0.5) * 0.4
                    );
                    
                    const velocity = new THREE.Vector3(
                        Math.cos(angle) * (2 + Math.random() * 4),
                        Math.sin(angle) * (2 + Math.random() * 4),
                        (Math.random() - 0.5) * 3
                    );
                    
                    const colors = [0x00ddff, 0xffffff, 0x88ccff];
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    
                    const particle = gameState.particlePool.spawn(
                        sparkPos.x, sparkPos.y, sparkPos.z,
                        color, 0.06, velocity
                    );
                    
                    if (particle) {
                        particle.decay = 0.08;
                        
                        // Add electrical jitter to spark movement
                        const originalUpdate = particle.update;
                        particle.update = function(deltaTime) {
                            // Electrical jitter
                            this.velocity.x += (Math.random() - 0.5) * 0.6;
                            this.velocity.y += (Math.random() - 0.5) * 0.6;
                            this.velocity.z += (Math.random() - 0.5) * 0.4;
                            
                            return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                        };
                    }
                }
            };
            
            bubble.powerUpAnimation.createFlashParticleBurst = (bubble, gameState) => {
                // Create intense particle burst during flash (reduced for performance)
                const burstCount = 5;
                const colors = [0xffffff, 0x00ddff, 0x88ccff];
                
                for (let i = 0; i < burstCount; i++) {
                    const angle = (Math.PI * 2 * i) / burstCount;
                    const speed = 5 + Math.random() * 8;
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    
                    const velocity = new THREE.Vector3(
                        Math.cos(angle) * speed,
                        Math.sin(angle) * speed,
                        (Math.random() - 0.5) * 6
                    );
                    
                    const particle = gameState.particlePool.spawnPower ? 
                        gameState.particlePool.spawnPower(
                            bubble.position.x, bubble.position.y, bubble.position.z,
                            color, 0.1, velocity, 0.8
                        ) :
                        gameState.particlePool.spawn(
                            bubble.position.x, bubble.position.y, bubble.position.z,
                            color, 0.1, velocity
                        );
                    
                    if (particle && !gameState.particlePool.spawnPower) {
                        particle.decay = 0.04;
                    }
                }
            };
        }
    }
}