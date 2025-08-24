import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Impact Resonance Effect System
 * Creates sophisticated visual and physical feedback for all collisions
 */
export class ImpactResonanceEffect {
    constructor(scene, gameManager) {
        this.scene = scene;
        this.gameManager = gameManager;
        this.eventBus = gameManager.eventBus;
        this.particlePool = null; // Will be set from gameState
        
        // Effect pools for performance
        this.harmonicRings = [];
        this.activeRings = new Set();
        this.maxRings = 50;
        
        // Friction spark particles
        this.frictionSparks = [];
        this.activeSparks = new Set();
        
        // Color exchange particles
        this.colorExchangeParticles = [];
        
        // Collision tracking for near-miss detection
        this.collisionPairs = new Map();
        this.nearMissThreshold = CONFIG.BUBBLE_RADIUS * 2.5;
        this.grazeThreshold = CONFIG.BUBBLE_RADIUS * 2.1;
        
        // Initialize ring pool
        this.initializeRingPool();
        
        // Sound variations cache
        this.impactSounds = this.generateSoundVariations();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    /**
     * Initialize the pool of harmonic rings
     */
    initializeRingPool() {
        const ringGeometry = new THREE.RingGeometry(
            CONFIG.BUBBLE_RADIUS * 0.8,
            CONFIG.BUBBLE_RADIUS * 1.0,
            32,
            1
        );
        
        for (let i = 0; i < this.maxRings; i++) {
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const ring = new THREE.Mesh(ringGeometry, material);
            ring.visible = false;
            this.scene.add(ring);
            
            this.harmonicRings.push({
                mesh: ring,
                material: material,
                active: false,
                scale: 1.0,
                opacity: 0,
                frequency: 1.0,
                lifetime: 0,
                maxLifetime: 1.0,
                color1: new THREE.Color(),
                color2: new THREE.Color(),
                pulsePhase: 0,
                baseScale: 1.0,
                expansionRate: 1.0
            });
        }
    }
    
    /**
     * Generate sound variation parameters
     */
    generateSoundVariations() {
        return {
            bubble: {
                pitchVariations: [0.8, 0.9, 1.0, 1.1, 1.2],
                volumeByVelocity: (velocity) => Math.min(1.0, 0.3 + velocity * 0.02),
                resonanceByColors: (color1, color2) => {
                    // Create unique resonance based on color combination
                    const hue1 = new THREE.Color(color1).getHSL({}).h;
                    const hue2 = new THREE.Color(color2).getHSL({}).h;
                    return 0.7 + Math.abs(hue1 - hue2) * 0.6;
                }
            },
            wall: {
                pitchVariations: [0.6, 0.7, 0.8, 0.9, 1.0],
                volumeByVelocity: (velocity) => Math.min(1.0, 0.4 + velocity * 0.015)
            },
            graze: {
                volume: 0.2,
                pitch: 1.5
            }
        };
    }
    
    /**
     * Setup event listeners for collision events
     */
    setupEventListeners() {
        // Bubble-to-bubble collision
        this.eventBus.on('bubbleCollision', (data) => {
            this.handleBubbleCollision(data);
        });
        
        // Bubble-to-wall collision
        this.eventBus.on('wallCollision', (data) => {
            this.handleWallCollision(data);
        });
        
        // Near-miss detection during movement
        this.eventBus.on('bubbleMoving', (data) => {
            this.checkNearMisses(data.bubble);
        });
    }
    
    /**
     * Handle bubble-to-bubble collision
     */
    handleBubbleCollision(data) {
        const { bubble1, bubble2, impactPoint, impactVelocity } = data;
        
        if (!bubble1 || !bubble2 || !impactPoint) return;
        
        // Calculate impact metrics
        const velocity = impactVelocity || bubble1.velocity.length();
        const impactScale = Math.min(2.0, 1.0 + velocity * 0.02);
        
        // Apply squash & stretch deformation
        this.applyElasticDeformation(bubble1, bubble2, impactPoint, velocity);
        
        // Create harmonic rings
        this.createHarmonicRings(impactPoint, bubble1.color, bubble2.color, velocity);
        
        // Exchange color particles
        this.createColorExchange(bubble1, bubble2, impactPoint, velocity);
        
        // Play impact sound with variation
        this.playImpactSound('bubble', bubble1.color, bubble2.color, velocity);
        
        // Trigger haptic feedback if available
        if (velocity > 10) {
            this.triggerHapticFeedback(velocity);
        }
    }
    
    /**
     * Apply elastic squash & stretch deformation
     */
    applyElasticDeformation(bubble1, bubble2, impactPoint, velocity) {
        // Validate inputs
        if (!bubble1?.position || !bubble2?.position || !impactPoint) return;
        
        // Calculate impact direction
        const direction1 = new THREE.Vector3()
            .subVectors(bubble1.position, impactPoint)
            .normalize();
        const direction2 = new THREE.Vector3()
            .subVectors(bubble2.position, impactPoint)
            .normalize();
        
        // Calculate deformation amount based on velocity
        const deformAmount = Math.min(0.3, velocity * 0.008);
        const squashFactor = 1.0 - deformAmount;
        const stretchFactor = 1.0 + deformAmount * 0.7;
        
        // Apply deformation to bubble1
        if (bubble1.deformationMatrix) {
            bubble1.deformationMatrix.identity();
        } else {
            bubble1.deformationMatrix = new THREE.Matrix4();
        }
        
        // Create squash along impact axis
        const squashMatrix1 = new THREE.Matrix4().makeScale(
            1.0 - Math.abs(direction1.x) * deformAmount,
            1.0 - Math.abs(direction1.y) * deformAmount,
            stretchFactor
        );
        
        // Apply deformation
        bubble1.squashAmount = squashFactor;
        bubble1.squashDirection = direction1.clone();
        bubble1.deformationTime = 0;
        bubble1.deformationDuration = 0.3 + velocity * 0.01;
        
        // Apply deformation to bubble2
        if (bubble2.deformationMatrix) {
            bubble2.deformationMatrix.identity();
        } else {
            bubble2.deformationMatrix = new THREE.Matrix4();
        }
        
        bubble2.squashAmount = squashFactor;
        bubble2.squashDirection = direction2.clone();
        bubble2.deformationTime = 0;
        bubble2.deformationDuration = 0.3 + velocity * 0.01;
        
        // Add elastic rebound velocity
        const rebound1 = direction1.clone().multiplyScalar(velocity * 0.1);
        const rebound2 = direction2.clone().multiplyScalar(velocity * 0.1);
        
        // Initialize impactVelocity if it doesn't exist
        if (!bubble1.impactVelocity) {
            bubble1.impactVelocity = new THREE.Vector3();
        }
        if (!bubble2.impactVelocity) {
            bubble2.impactVelocity = new THREE.Vector3();
        }
        
        bubble1.impactVelocity.add(rebound1);
        bubble2.impactVelocity.add(rebound2);
        
        // Add rotational impact
        bubble1.rotationalImpact = new THREE.Vector3(
            (Math.random() - 0.5) * velocity * 0.01,
            (Math.random() - 0.5) * velocity * 0.01,
            direction1.cross(new THREE.Vector3(0, 1, 0)).z * velocity * 0.02
        );
        
        bubble2.rotationalImpact = new THREE.Vector3(
            (Math.random() - 0.5) * velocity * 0.01,
            (Math.random() - 0.5) * velocity * 0.01,
            direction2.cross(new THREE.Vector3(0, 1, 0)).z * velocity * 0.02
        );
    }
    
    /**
     * Create harmonic rings that pulse outward
     */
    createHarmonicRings(position, color1, color2, velocity) {
        const numRings = Math.min(3, Math.floor(1 + velocity * 0.03));
        
        for (let i = 0; i < numRings; i++) {
            const ring = this.getInactiveRing();
            if (!ring) continue;
            
            // Setup ring properties
            ring.mesh.position.copy(position);
            ring.mesh.position.z = 0.1 + i * 0.05; // Layer rings
            ring.mesh.visible = true;
            ring.active = true;
            
            // Color based on bubble colors
            ring.color1.set(color1);
            ring.color2.set(color2);
            
            // Frequency based on color difference
            const hue1 = ring.color1.getHSL({}).h;
            const hue2 = ring.color2.getHSL({}).h;
            ring.frequency = 2.0 + Math.abs(hue1 - hue2) * 3.0;
            
            // Initial properties
            ring.scale = 1.0;
            ring.baseScale = 1.0 + i * 0.3;
            ring.opacity = 0.8 - i * 0.2;
            ring.lifetime = 0;
            ring.maxLifetime = 0.8 + i * 0.1;
            ring.pulsePhase = i * Math.PI * 0.5;
            ring.expansionRate = 2.0 + velocity * 0.05 - i * 0.3;
            
            // Set initial appearance
            ring.material.color.copy(ring.color1);
            ring.material.opacity = ring.opacity;
            ring.mesh.scale.setScalar(ring.baseScale);
            
            this.activeRings.add(ring);
        }
    }
    
    /**
     * Create color particle exchange at contact point
     */
    createColorExchange(bubble1, bubble2, impactPoint, velocity) {
        if (!this.particlePool && this.gameManager.gameState) {
            this.particlePool = this.gameManager.gameState.particlePool;
        }
        
        // Also try window.gameState as fallback
        if (!this.particlePool && window.game && window.game.gameState) {
            this.particlePool = window.game.gameState.particlePool;
        }
        
        if (!this.particlePool) return;
        
        const numParticles = Math.floor(5 + velocity * 0.2);
        
        // Particles from bubble1 to bubble2
        for (let i = 0; i < numParticles; i++) {
            const angle = (Math.PI * 2 * i) / numParticles + Math.random() * 0.5;
            const speed = 2 + Math.random() * velocity * 0.1;
            
            const direction = new THREE.Vector3(
                Math.cos(angle),
                Math.sin(angle),
                (Math.random() - 0.5) * 0.5
            ).normalize();
            
            // Particles with bubble1's color moving toward bubble2
            const particle1 = this.particlePool.spawn(
                impactPoint.x + direction.x * 0.1,
                impactPoint.y + direction.y * 0.1,
                impactPoint.z,
                bubble1.color,
                0.05 + Math.random() * 0.05,
                direction.clone().multiplyScalar(speed),
                'collisionParticles'
            );
            
            // Particles with bubble2's color moving toward bubble1
            const particle2 = this.particlePool.spawn(
                impactPoint.x - direction.x * 0.1,
                impactPoint.y - direction.y * 0.1,
                impactPoint.z,
                bubble2.color,
                0.05 + Math.random() * 0.05,
                direction.clone().multiplyScalar(-speed),
                'collisionParticles'
            );
            
            // Make particles curve toward opposite bubble
            if (particle1) {
                particle1.targetPosition = bubble2.position.clone();
                particle1.curveStrength = 0.3;
            }
            if (particle2) {
                particle2.targetPosition = bubble1.position.clone();
                particle2.curveStrength = 0.3;
            }
        }
    }
    
    /**
     * Check for near-misses and create friction sparks
     */
    checkNearMisses(movingBubble) {
        if (!movingBubble || !movingBubble.isMoving || !movingBubble.position) return;
        
        // Get nearby bubbles from spatial grid if available
        const nearbyBubbles = this.getNearbyBubbles(movingBubble);
        
        nearbyBubbles.forEach(bubble => {
            if (bubble === movingBubble || bubble.isDestroyed) return;
            
            const distance = movingBubble.position.distanceTo(bubble.position);
            const pairKey = `${movingBubble.id}_${bubble.id}`;
            
            // Check for grazing collision
            if (distance < this.grazeThreshold && distance > CONFIG.BUBBLE_RADIUS * 2) {
                if (!this.collisionPairs.has(pairKey)) {
                    this.collisionPairs.set(pairKey, { grazing: true, lastDistance: distance });
                    this.createFrictionSparks(movingBubble, bubble, distance);
                    this.playGrazeSound(movingBubble.velocity.length());
                }
            } else if (distance > this.nearMissThreshold) {
                // Clear the pair when they separate
                this.collisionPairs.delete(pairKey);
            }
        });
    }
    
    /**
     * Create friction sparks for grazing collisions
     */
    createFrictionSparks(bubble1, bubble2, distance) {
        // Validate inputs
        if (!bubble1?.position || !bubble2?.position) return;
        
        if (!this.particlePool && this.gameManager.gameState) {
            this.particlePool = this.gameManager.gameState.particlePool;
        }
        
        // Also try window.gameState as fallback
        if (!this.particlePool && window.game && window.game.gameState) {
            this.particlePool = window.game.gameState.particlePool;
        }
        
        if (!this.particlePool) return;
        
        // Calculate contact point
        const midpoint = new THREE.Vector3()
            .addVectors(bubble1.position, bubble2.position)
            .multiplyScalar(0.5);
        
        // Calculate tangent direction
        const normal = new THREE.Vector3()
            .subVectors(bubble2.position, bubble1.position)
            .normalize();
        const tangent = new THREE.Vector3(-normal.y, normal.x, 0);
        
        // Create sparks
        const numSparks = Math.floor(3 + Math.random() * 4);
        const sparkColor = 0xffaa00; // Orange sparks
        
        for (let i = 0; i < numSparks; i++) {
            const sparkVelocity = tangent.clone()
                .multiplyScalar(5 + Math.random() * 10)
                .add(new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    Math.random() * 2
                ));
            
            const spark = this.particlePool.spawn(
                midpoint.x + (Math.random() - 0.5) * 0.2,
                midpoint.y + (Math.random() - 0.5) * 0.2,
                midpoint.z + 0.1,
                sparkColor,
                0.02 + Math.random() * 0.03,
                sparkVelocity,
                'collisionParticles'
            );
            
            if (spark) {
                spark.decay = 0.08; // Faster decay for sparks
                spark.emissive = true;
                // MeshBasicMaterial doesn't have emissiveIntensity
                // Instead, make the sparks brighter by adjusting the material properties
                if (spark.material) {
                    // Increase brightness for spark effect
                    spark.material.color.setHex(0xffdd00); // Bright yellow-orange
                    spark.material.opacity = 1.0;
                }
            }
        }
    }
    
    /**
     * Handle wall collision
     */
    handleWallCollision(data) {
        const { bubble, impactPoint, velocity } = data;
        
        if (!bubble || !bubble.position) return;
        
        // Create wall impact rings
        const position = impactPoint || bubble.position;
        this.createWallImpactRings(position, bubble.color, velocity);
        
        // Apply wall squash deformation
        this.applyWallDeformation(bubble, velocity);
        
        // Create wall impact particles
        this.createWallImpactParticles(position, bubble.color, velocity);
        
        // Play wall impact sound
        this.playImpactSound('wall', bubble.color, null, velocity);
    }
    
    /**
     * Create wall impact rings
     */
    createWallImpactRings(position, color, velocity) {
        const ring = this.getInactiveRing();
        if (!ring) return;
        
        ring.mesh.position.copy(position);
        ring.mesh.position.z = 0.1;
        ring.mesh.visible = true;
        ring.active = true;
        
        ring.color1.set(color);
        ring.color2.set(0xffffff); // White for wall
        ring.frequency = 4.0; // Higher frequency for wall impact
        
        ring.scale = 0.5;
        ring.baseScale = 0.5;
        ring.opacity = 1.0;
        ring.lifetime = 0;
        ring.maxLifetime = 0.5;
        ring.pulsePhase = 0;
        ring.expansionRate = 4.0 + velocity * 0.1;
        
        ring.material.color.copy(ring.color1);
        ring.material.opacity = ring.opacity;
        ring.mesh.scale.setScalar(ring.baseScale);
        
        this.activeRings.add(ring);
    }
    
    /**
     * Apply wall deformation
     */
    applyWallDeformation(bubble, velocity) {
        if (!bubble || !bubble.position) return;
        
        const deformAmount = Math.min(0.4, velocity * 0.01);
        
        bubble.squashAmount = 1.0 - deformAmount;
        bubble.squashDirection = new THREE.Vector3(
            Math.sign(bubble.position.x),
            0,
            0
        );
        bubble.deformationTime = 0;
        bubble.deformationDuration = 0.2;
        
        // Add bounce rotation
        bubble.rotationalImpact = new THREE.Vector3(
            0,
            0,
            Math.sign(bubble.position.x) * velocity * 0.03
        );
    }
    
    /**
     * Create wall impact particles
     */
    createWallImpactParticles(position, color, velocity) {
        if (!this.particlePool && this.gameManager.gameState) {
            this.particlePool = this.gameManager.gameState.particlePool;
        }
        
        // Also try window.gameState as fallback
        if (!this.particlePool && window.game && window.game.gameState) {
            this.particlePool = window.game.gameState.particlePool;
        }
        
        if (!this.particlePool) return;
        
        const numParticles = Math.floor(8 + velocity * 0.3);
        const wallX = Math.sign(position.x) * CONFIG.WALL_LIMIT;
        
        for (let i = 0; i < numParticles; i++) {
            const angle = Math.random() * Math.PI - Math.PI / 2; // Hemisphere away from wall
            const speed = 3 + Math.random() * velocity * 0.15;
            
            const direction = new THREE.Vector3(
                -Math.sign(position.x) * Math.abs(Math.cos(angle)),
                Math.sin(angle),
                (Math.random() - 0.5) * 0.5
            ).normalize();
            
            this.particlePool.spawn(
                wallX - Math.sign(position.x) * 0.1,
                position.y + (Math.random() - 0.5) * 0.5,
                position.z,
                color,
                0.03 + Math.random() * 0.05,
                direction.multiplyScalar(speed),
                'wallImpact'
            );
        }
    }
    
    /**
     * Get inactive ring from pool
     */
    getInactiveRing() {
        for (let ring of this.harmonicRings) {
            if (!ring.active) {
                return ring;
            }
        }
        // Reuse oldest ring if all active
        const oldestRing = this.harmonicRings[0];
        this.activeRings.delete(oldestRing);
        oldestRing.active = false;
        oldestRing.mesh.visible = false;
        return oldestRing;
    }
    
    /**
     * Get nearby bubbles for collision detection
     */
    getNearbyBubbles(bubble) {
        // Use collision system's spatial grid if available
        if (this.gameManager.collisionSystem && this.gameManager.collisionSystem.spatialGrid) {
            return this.gameManager.collisionSystem.spatialGrid.getNearby(
                bubble.position.x,
                bubble.position.y,
                this.nearMissThreshold
            );
        }
        
        // Fallback to checking all grid bubbles
        const nearby = [];
        if (this.gameManager.gameState && this.gameManager.gameState.bubbleGrid) {
            const grid = this.gameManager.gameState.bubbleGrid;
            for (let row of grid) {
                for (let b of row) {
                    if (b && !b.isDestroyed && b !== bubble) {
                        const dist = bubble.position.distanceTo(b.position);
                        if (dist < this.nearMissThreshold) {
                            nearby.push(b);
                        }
                    }
                }
            }
        }
        return nearby;
    }
    
    /**
     * Play impact sound with variations
     */
    playImpactSound(type, color1, color2, velocity) {
        if (!this.gameManager.soundManager) return;
        
        const soundConfig = this.impactSounds[type];
        if (!soundConfig) return;
        
        // Calculate volume based on velocity
        const volume = soundConfig.volumeByVelocity(velocity);
        
        // Calculate pitch variation
        let pitch = soundConfig.pitchVariations[
            Math.floor(Math.random() * soundConfig.pitchVariations.length)
        ];
        
        // Add resonance for bubble collisions
        if (type === 'bubble' && color2) {
            pitch *= soundConfig.resonanceByColors(color1, color2);
        }
        
        // Play sound with variations
        this.gameManager.soundManager.play('impact', {
            volume: volume,
            pitch: pitch,
            pan: (color1.position?.x || 0) / CONFIG.WALL_LIMIT * 0.5
        });
    }
    
    /**
     * Play graze sound
     */
    playGrazeSound(velocity) {
        if (!this.gameManager.soundManager) return;
        
        this.gameManager.soundManager.play('graze', {
            volume: this.impactSounds.graze.volume,
            pitch: this.impactSounds.graze.pitch
        });
    }
    
    /**
     * Trigger haptic feedback
     */
    triggerHapticFeedback(intensity) {
        if ('vibrate' in navigator) {
            const duration = Math.min(50, 10 + intensity);
            navigator.vibrate(duration);
        }
    }
    
    /**
     * Update all active effects
     */
    update(deltaTime) {
        // Update harmonic rings
        const ringsToDeactivate = [];
        
        this.activeRings.forEach(ring => {
            ring.lifetime += deltaTime;
            const progress = ring.lifetime / ring.maxLifetime;
            
            if (progress >= 1.0) {
                ringsToDeactivate.push(ring);
            } else {
                // Expand ring
                const scale = ring.baseScale + ring.expansionRate * progress;
                ring.mesh.scale.setScalar(scale);
                
                // Fade out
                const fadeIn = Math.min(1.0, progress * 4);
                const fadeOut = 1.0 - Math.pow(progress, 2);
                ring.material.opacity = ring.opacity * fadeIn * fadeOut;
                
                // Pulse color between the two colors
                const pulse = Math.sin(ring.pulsePhase + ring.lifetime * ring.frequency * Math.PI * 2);
                const colorMix = (pulse + 1) * 0.5;
                ring.material.color.lerpColors(ring.color1, ring.color2, colorMix);
                
                // Add rotation for visual interest
                ring.mesh.rotation.z = progress * Math.PI * 0.5;
            }
        });
        
        // Deactivate finished rings
        ringsToDeactivate.forEach(ring => {
            ring.active = false;
            ring.mesh.visible = false;
            this.activeRings.delete(ring);
        });
        
        // Clean up old collision pairs
        const now = Date.now();
        for (let [key, value] of this.collisionPairs.entries()) {
            if (now - value.timestamp > 1000) {
                this.collisionPairs.delete(key);
            }
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        // Clean up ring meshes
        this.harmonicRings.forEach(ring => {
            ring.mesh.geometry.dispose();
            ring.material.dispose();
            this.scene.remove(ring.mesh);
        });
        
        // Clear references
        this.harmonicRings = [];
        this.activeRings.clear();
        this.collisionPairs.clear();
    }
}