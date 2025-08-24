import * as THREE from 'three';
import { CONFIG, PARTICLE_CONFIG } from '../core/Config.js';
import { PowerUp } from './PowerUp.js';
import { ParticleFactory } from '../entities/Particle.js';
import { ChainLightningVisuals } from '../graphics/ChainLightningVisuals.js';

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
            // Chain Lightning: No bubble found for activation
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
                
                // Find secondary targets for each primary
                const secondaryTargets = this.findNearestBubbles(
                    target,
                    this.secondaryArcCount,
                    gameState,
                    this.hitBubbles
                );
                
                // Create secondary lightning arcs
                secondaryTargets.forEach((secondary, secIndex) => {
                    setTimeout(() => {
                        this.createLightningArc(
                            target.position,
                            secondary.position,
                            false, // not primary
                            gameState,
                            gameManager
                        );
                        
                        this.hitBubbles.add(secondary);
                        bubblesDestroyed.push(secondary);
                        
                        // Create destruction effect for secondary bubble
                        this.createElectricDestructionEffect(secondary, gameState);
                    }, (secIndex + 1) * 30);
                });
                
                // Create destruction effect for primary bubble
                this.createElectricDestructionEffect(target, gameState);
            }, (index + 1) * 50);
        });
        
        // Destroy all affected bubbles after visual effects
        setTimeout(() => {
            // New approach: Destroy bubbles immediately for atomicity
            bubblesDestroyed.forEach((bubble, index) => {
                setTimeout(() => {
                    // Create final destruction visual effects at bubble position
                    this.createElectricCoursingEffect(bubble, gameState, gameManager);
                    
                    // Add chain lightning specific effects
                    if (gameManager.effectsSystem) {
                        gameManager.effectsSystem.createElectricArcs(bubble.position, bubble.id, 400);
                        gameManager.effectsSystem.createElectricSparks(bubble.position, bubble.id, 15);
                        gameManager.effectsSystem.createElectricField(bubble.position, bubble.id);
                    }
                    
                    // Simple jitter effect without complex interval management
                    // The effect system handles the visual jitter through particles
                    
                    // Create additional visual effects
                    this.createBubbleElectricFlash(bubble.position, gameManager);
                    this.createBubbleFlickerEffect(bubble);
                    
                    // Don't mark as destroyed here - let destroyBubbleImmediately handle it atomically
                    // bubble.isDestroyed = true; // REMOVED - this was causing ghost bubbles!
                    
                    // Schedule proper destruction after electrical effects
                    setTimeout(() => {
                        // Use event bus to trigger destruction through GameLogic
                        if (!bubble.isDestroyed) {
                            // Emit event for GameLogic to handle destruction
                            gameManager.eventBus.emit('destroyBubble', {
                                bubble: bubble,
                                skipAnimation: true
                            });
                        }
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
                        0.12,
                        null,
                        'powerUpEffects'
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
                    position.x + (Math.random() - 0.5) * 0.2,
                    position.y + (Math.random() - 0.5) * 0.2,
                    position.z,
                    Math.random() > 0.3 ? 0x00ddff : 0xffffff,
                    0.08
                );
                
                if (particle) {
                    particle.decay = 0.05;
                }
            }, Math.random() * 100);
        }
    }
    
    createImpactLighting(position, gameManager) {
        // Create dramatic electrical lighting at impact
        const impactLight = new THREE.PointLight(0x00ddff, 15, 6);
        impactLight.position.copy(position);
        impactLight.position.z = 2;
        if (gameManager.scene) gameManager.scene.add(impactLight);
        
        // Secondary white flash
        const flashLight = new THREE.PointLight(0xffffff, 10, 4);
        flashLight.position.copy(position);
        flashLight.position.z = 2.5;
        if (gameManager.scene) gameManager.scene.add(flashLight);
        
        // Animate and remove lights
        let intensity = 15;
        const fadeInterval = setInterval(() => {
            intensity *= 0.85;
            impactLight.intensity = intensity;
            flashLight.intensity = intensity * 0.67;
            
            if (intensity < 0.1) {
                clearInterval(fadeInterval);
                if (gameManager.scene) {
                    gameManager.scene.remove(impactLight);
                    gameManager.scene.remove(flashLight);
                }
                impactLight.dispose();
                flashLight.dispose();
            }
        }, 30);
    }
    
    createLightningArc(startPos, endPos, isPrimary, gameState, gameManager) {
        // Visual lightning arc effect
        this.createLightningLine(startPos, endPos, isPrimary, gameState, gameManager);
        this.createLightningParticleTrail(startPos, endPos, isPrimary, gameState);
        this.createLightningEndEffect(endPos, isPrimary, gameState);
        
        // Add electrical sound
        gameManager.playSound('electricZap');
    }
    
    createLightningLine(startPos, endPos, isPrimary, gameState, gameManager) {
        // Create segmented lightning arc geometry with enhanced visuals
        const segments = isPrimary ? 7 : 4;
        const points = this.generateLightningPath(startPos, endPos, segments);
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Main lightning line
        const material = new THREE.LineBasicMaterial({
            color: isPrimary ? 0x00ddff : 0x88ccff,
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
        
        // Store reference to this for animation
        const self = this;
        
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
                    const newPoints = self.generateLightningPath(startPos, endPos, isPrimary ? 7 : 4);
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
            }
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
                
                if (particle && typeof particle === 'object') {
                    particle.decay = 0.06; // Quick sparks
                    
                    // Add electrical jitter to movement only if particle has velocity and update
                    if (particle.velocity && typeof particle.update === 'function') {
                        const originalUpdate = particle.update;
                        particle.update = function(deltaTime) {
                            // Electrical jitter
                            if (this.velocity) {
                                this.velocity.x += (Math.random() - 0.5) * 0.8;
                                this.velocity.y += (Math.random() - 0.5) * 0.8;
                                this.velocity.z += (Math.random() - 0.5) * 0.5;
                            }
                            
                            return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                        };
                    }
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
            
            if (particle && typeof particle === 'object' && particle.velocity) {
                if (!gameState.particlePool.spawnPower) {
                    particle.decay = 0.04;
                }
                
                // Add electrical jitter only if particle has update method
                if (typeof particle.update === 'function') {
                    const originalUpdate = particle.update;
                    particle.update = function(deltaTime) {
                        if (this.velocity) {
                            this.velocity.x += (Math.random() - 0.5) * 0.6;
                            this.velocity.y += (Math.random() - 0.5) * 0.6;
                            this.velocity.z += (Math.random() - 0.5) * 0.4;
                        }
                        
                        return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                    };
                }
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
                
                if (particle && typeof particle === 'object') {
                    particle.decay = 0.07;
                    
                    // Add gravity and electrical behavior only if particle has velocity and update
                    if (particle.velocity && typeof particle.update === 'function') {
                        const originalUpdate = particle.update;
                        particle.update = function(deltaTime) {
                            if (this.velocity) {
                                this.velocity.y -= 10 * deltaTime; // Gravity
                                
                                // Electrical jitter
                                if (Math.random() < 0.3) {
                                    this.velocity.x += (Math.random() - 0.5) * 0.4;
                                    this.velocity.y += (Math.random() - 0.5) * 0.4;
                                }
                            }
                            
                            return originalUpdate ? originalUpdate.call(this, deltaTime) : true;
                        };
                    }
                }
            }, Math.random() * 50);
        }
    }
    
    createElectricCoursingEffect(bubble, gameState, gameManager) {
        // Legacy method - effects now handled by BubbleEffectsSystem
        // Keep for compatibility but most effects moved to world-space system
        // Creating electric coursing effect for bubble
        
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
        flash2.position.z = 2.2;
        if (gameManager.scene) gameManager.scene.add(flash2);
        
        // Strobe effect
        let strobeCount = 0;
        const strobeInterval = setInterval(() => {
            flashLight.intensity = strobeCount % 2 === 0 ? 0 : 12;
            flash2.intensity = strobeCount % 2 === 0 ? 0 : 8;
            strobeCount++;
            
            if (strobeCount > 5) {
                clearInterval(strobeInterval);
                // Fade out
                let fadeIntensity = 12;
                const fadeInterval = setInterval(() => {
                    fadeIntensity *= 0.7;
                    flashLight.intensity = fadeIntensity;
                    flash2.intensity = fadeIntensity * 0.67;
                    
                    if (fadeIntensity < 0.1) {
                        clearInterval(fadeInterval);
                        if (gameManager.scene) {
                            gameManager.scene.remove(flashLight);
                            gameManager.scene.remove(flash2);
                        }
                        flashLight.dispose();
                        flash2.dispose();
                    }
                }, 50);
            }
        }, 60);
    }
    
    createBubbleFlickerEffect(bubble) {
        // Simplified flicker effect - just a visual hint without performance impact
        // The actual electrical destruction is handled by particles and lighting
        if (bubble && !bubble.isDestroyed) {
            bubble.electricGlow = 1.0;
            setTimeout(() => {
                if (bubble && !bubble.isDestroyed) {
                    bubble.electricGlow = 0;
                }
            }, 300);
        }
    }
    
    // createTemporaryElectricArcs method removed - effects now handled by BubbleEffectsSystem
    // This eliminates the dependency on individual bubble meshes and works with instanced rendering
    
    /**
     * Creates an advanced electrical storm material with custom shader
     */
    createElectricalStormMaterial() {
        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                baseColor: { value: new THREE.Color(0x001133) }, // Dark storm core
                glowColor: { value: new THREE.Color(0x00ddff) }, // Electric blue glow
                hotColor: { value: new THREE.Color(0xffffff) },  // White-hot accents
                electricIntensity: { value: 1.0 },
                distortionAmount: { value: 0.1 },
                plasmaSpeed: { value: 2.0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec2 vUv;
                varying vec3 vViewPosition;
                
                uniform float time;
                uniform float distortionAmount;
                
                // Noise function for vertex displacement
                float noise(vec3 p) {
                    return sin(p.x * 10.0 + time) * sin(p.y * 10.0 + time * 1.3) * sin(p.z * 10.0 + time * 0.7);
                }
                
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    
                    // Add electrical distortion to vertices
                    vec3 displaced = position;
                    float distortion = noise(position * 5.0) * distortionAmount;
                    displaced += normal * distortion;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    vPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 baseColor;
                uniform vec3 glowColor;
                uniform vec3 hotColor;
                uniform float electricIntensity;
                uniform float plasmaSpeed;
                
                varying vec3 vNormal;
                varying vec3 vPosition;
                varying vec2 vUv;
                varying vec3 vViewPosition;
                
                // Enhanced noise for plasma effect
                float noise(vec2 p) {
                    return sin(p.x * 15.0 + time * plasmaSpeed) * 
                           cos(p.y * 15.0 + time * plasmaSpeed * 0.8);
                }
                
                // Electrical discharge pattern
                float electricPattern(vec2 uv) {
                    float pattern = 0.0;
                    for(float i = 0.0; i < 3.0; i++) {
                        vec2 offset = vec2(sin(time * (1.0 + i)), cos(time * (1.5 + i))) * 0.1;
                        float d = length(uv - vec2(0.5) + offset);
                        pattern += 1.0 / (1.0 + exp(50.0 * (d - 0.2 - noise(uv + time) * 0.1)));
                    }
                    return pattern;
                }
                
                void main() {
                    // Calculate fresnel for rim lighting
                    vec3 viewDir = normalize(vViewPosition);
                    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.0);
                    
                    // Create plasma effect
                    float plasma = noise(vUv * 10.0 + time * plasmaSpeed);
                    plasma = smoothstep(-0.5, 0.5, plasma);
                    
                    // Electrical discharge effect
                    float electric = electricPattern(vUv);
                    
                    // Combine colors
                    vec3 color = baseColor;
                    color = mix(color, glowColor, plasma * 0.7);
                    color = mix(color, hotColor, electric * electricIntensity);
                    
                    // Add rim glow
                    color += glowColor * fresnel * 2.0;
                    
                    // Random electrical flashes
                    float flash = step(0.98, noise(vUv * 50.0 + time * 10.0));
                    color = mix(color, hotColor, flash);
                    
                    gl_FragColor = vec4(color, 0.95);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
    }
    
    /**
     * Creates visual effect for shooting bubble (compatible with instanced rendering)
     */
    createVisualEffect(bubble, gameState) {
        super.createVisualEffect(bubble);
        
        // For instanced rendering, we can't modify individual materials
        // Instead, we'll create visual effects that work with the instanced system
        
        // Mark bubble as electric type for instanced renderer
        bubble.isElectric = true;
        bubble.electricGlow = 0.5;
        bubble.electricTime = 0;
        
        // Update color to electric blue and enable special shader effects
        if (bubble.useInstancedRendering && window.game?.bubbleInstances) {
            window.game.bubbleInstances.setElectricEffect(bubble);
            
            // Enable distortion and other electrical effects in the shader
            // These effects are already built into the BubbleInstances shader
            const bubbleInstances = window.game.bubbleInstances;
            if (bubbleInstances.instancedMesh && bubbleInstances.instancedMesh.material.uniforms) {
                // Store original effect states to restore later
                bubble.originalEffects = {
                    enableDistortion: bubbleInstances.instancedMesh.material.uniforms.enableDistortion.value,
                    enableSparkles: bubbleInstances.instancedMesh.material.uniforms.enableSparkles.value,
                    enableColorShift: bubbleInstances.instancedMesh.material.uniforms.enableColorShift.value,
                    enablePulse: bubbleInstances.instancedMesh.material.uniforms.enablePulse.value
                };
                
                // Enable electrical effects for all instances (will only affect the electric bubble)
                bubbleInstances.instancedMesh.material.uniforms.enableDistortion.value = 1.0;
                bubbleInstances.instancedMesh.material.uniforms.enableSparkles.value = 1.0;
                bubbleInstances.instancedMesh.material.uniforms.enableColorShift.value = 1.0;
                bubbleInstances.instancedMesh.material.uniforms.enablePulse.value = 1.0;
            }
        }
        
        // Create additional visual effects using ChainLightningVisuals
        if (window.game && window.game.scene) {
            if (!window.game.chainLightningVisuals) {
                window.game.chainLightningVisuals = new ChainLightningVisuals(window.game.scene);
            }
            window.game.chainLightningVisuals.createElectricField(bubble);
            bubble.hasChainLightningVisuals = true;
        }
        
        // Create particle-based electrical effects around the bubble
        bubble.powerUpAnimation.createElectricParticles = () => {
            if (!gameState.particlePool) return;
            
            // Create orbiting electric sparks
            const sparkCount = 8;
            for (let i = 0; i < sparkCount; i++) {
                const angle = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.5;
                const radius = CONFIG.BUBBLE_RADIUS * (1.2 + Math.random() * 0.3);
                
                const particle = gameState.particlePool.spawn(
                    bubble.position.x + Math.cos(angle) * radius,
                    bubble.position.y + Math.sin(angle) * radius,
                    bubble.position.z,
                    Math.random() > 0.5 ? 0x00ddff : 0xffffff,
                    0.06,
                    new THREE.Vector3(
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2,
                        (Math.random() - 0.5) * 2
                    )
                );
                
                if (particle) {
                    particle.decay = 0.08;
                }
            }
        };
        
        // Enhanced animation that works with instanced rendering
        const originalUpdate = bubble.powerUpAnimation.update;
        bubble.powerUpAnimation.update = function(deltaTime) {
            originalUpdate.call(this, deltaTime);
            
            bubble.electricTime += deltaTime;
            
            // Update electric glow intensity
            bubble.electricGlow = 0.5 + Math.sin(bubble.electricTime * 5) * 0.3;
            
            // Random electrical discharge effect
            if (Math.random() < 0.02) {
                bubble.electricGlow = 1.0;
                // Create discharge particles
                bubble.powerUpAnimation.createElectricParticles();
                setTimeout(() => {
                    bubble.electricGlow = 0.5;
                }, 100);
            }
            
            // Create periodic sparks
            if (Math.random() < 0.1) {
                bubble.powerUpAnimation.createElectricParticles();
            }
            
            // Update instanced renderer if available
            if (bubble.useInstancedRendering && window.game?.bubbleInstances) {
                const mapping = window.game.bubbleInstances.getBubbleMapping(bubble);
                if (mapping) {
                    // Apply jitter effect occasionally
                    if (Math.random() < 0.05) {
                        window.game.bubbleInstances.setJitterEffect(bubble, 0.02);
                    }
                }
            }
            
            // Cleanup on deactivation
            if (!this.active) {
                bubble.isElectric = false;
                bubble.electricGlow = 0;
                
                // Remove visual effects
                if (bubble.hasChainLightningVisuals && window.game?.chainLightningVisuals) {
                    window.game.chainLightningVisuals.removeEffects(bubble.id);
                    bubble.hasChainLightningVisuals = false;
                }
                
                // Restore original shader effects
                if (bubble.originalEffects && window.game?.bubbleInstances) {
                    const bubbleInstances = window.game.bubbleInstances;
                    if (bubbleInstances.instancedMesh && bubbleInstances.instancedMesh.material.uniforms) {
                        bubbleInstances.instancedMesh.material.uniforms.enableDistortion.value = bubble.originalEffects.enableDistortion;
                        bubbleInstances.instancedMesh.material.uniforms.enableSparkles.value = bubble.originalEffects.enableSparkles;
                        bubbleInstances.instancedMesh.material.uniforms.enableColorShift.value = bubble.originalEffects.enableColorShift;
                        bubbleInstances.instancedMesh.material.uniforms.enablePulse.value = bubble.originalEffects.enablePulse;
                    }
                    bubble.originalEffects = null;
                }
            }
        };
        
        gameState.animations.push(bubble.powerUpAnimation);
    }
}