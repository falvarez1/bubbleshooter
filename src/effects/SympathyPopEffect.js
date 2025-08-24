import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Sympathy Pop Effect System
 * Creates anticipation and energy buildup in bubbles about to be destroyed
 * Manages wave propagation and visual telegraphing of chain reactions
 */
export class SympathyPopEffect {
    constructor(gameManager, scene) {
        this.gameManager = gameManager;
        this.scene = scene;
        
        // Track affected bubbles and their states
        this.affectedBubbles = new Map(); // bubble.id -> effect state
        this.destructionWaves = []; // Active wave propagations
        
        // Effect configuration
        this.config = {
            // Wave propagation
            waveSpeed: 8.0, // Bubbles per second
            waveDelay: 50, // ms between wave levels
            maxWaveDistance: 5, // Max propagation distance in grid units
            
            // Vibration settings
            baseVibration: 0.02,
            maxVibration: 0.15,
            vibrationRampUp: 3.0, // Speed of vibration increase
            
            // Glow settings
            baseGlow: 0.1,
            maxGlow: 0.8,
            glowPulseSpeed: 8.0,
            glowColor: new THREE.Color(1.5, 1.5, 1.5), // Bright white glow
            
            // Particle settings
            particleRate: 2, // Particles per second at max intensity
            particleColors: [0xffffff, 0xffff00, 0xff00ff],
            particleSize: 0.1,
            
            // Scale pulsing
            baseScale: 1.0,
            maxScale: 1.15,
            scaleOscillation: 12.0, // Oscillations per second
            
            // Mexican wave effect
            waveHeight: 0.3,
            waveOscillation: 6.0
        };
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Animation frame tracking
        this.animationTime = 0;
    }
    
    setupEventListeners() {
        if (!this.gameManager?.eventBus) return;
        
        const eventBus = this.gameManager.eventBus;
        
        // Listen for chain reaction starts
        eventBus.on('chainReactionStart', (data) => {
            this.startChainReaction(data.bubbles, data.epicenter, data.type);
        });
        
        // Listen for pre-destruction analysis
        eventBus.on('analyzeDestructionChain', (data) => {
            this.analyzeAndPrepareChain(data.bubbles, data.source, data.type);
        });
        
        // Listen for match found events
        eventBus.on('matchesFound', (data) => {
            this.prepareMatchDestruction(data.matches, data.source);
        });
        
        // Listen for bomb activation
        eventBus.on('bombActivating', (data) => {
            this.prepareBombDestruction(data.center, data.radius, data.affected);
        });
        
        // Listen for lightning activation
        eventBus.on('lightningActivating', (data) => {
            this.prepareLightningDestruction(data.bubbles, data.isRow);
        });
        
        // Clean up when bubbles are actually destroyed
        eventBus.on('bubbleDestroyed', (data) => {
            this.cleanupBubble(data.bubble);
        });
    }
    
    /**
     * Analyze and prepare bubbles for chain destruction
     * This is called BEFORE the actual destruction begins
     */
    analyzeAndPrepareChain(bubbles, source, type = 'match') {
        if (!bubbles || bubbles.length === 0) return;
        
        // Calculate wave propagation order based on distance from source
        const waveGroups = this.calculateWaveGroups(bubbles, source);
        
        // Create destruction wave
        const wave = {
            id: `wave_${Date.now()}`,
            type: type,
            groups: waveGroups,
            currentGroup: 0,
            startTime: Date.now(),
            epicenter: source ? source.position.clone() : bubbles[0].position.clone(),
            epicenterBubbleId: source ? source.id : (bubbles[0] ? bubbles[0].id : null)
        };
        
        this.destructionWaves.push(wave);
        
        // Start the wave effect
        this.processWaveGroup(wave, 0);
    }
    
    /**
     * Calculate wave groups based on distance from source
     */
    calculateWaveGroups(bubbles, source) {
        const groups = [];
        const processed = new Set();
        
        if (!source) {
            // No source, treat all as one group
            return [bubbles];
        }
        
        // Group by grid distance from source
        const sourcePos = source.gridX !== undefined ? 
            { x: source.gridX, y: source.gridY } : 
            { x: 0, y: 0 };
        
        // Calculate distances
        const bubblesWithDistance = bubbles.map(bubble => ({
            bubble: bubble,
            distance: this.calculateGridDistance(
                sourcePos.x, sourcePos.y,
                bubble.gridX, bubble.gridY
            )
        }));
        
        // Sort by distance
        bubblesWithDistance.sort((a, b) => a.distance - b.distance);
        
        // Group by distance levels
        let currentDistance = -1;
        let currentGroup = [];
        
        for (const item of bubblesWithDistance) {
            if (Math.floor(item.distance) !== currentDistance) {
                if (currentGroup.length > 0) {
                    groups.push(currentGroup);
                }
                currentDistance = Math.floor(item.distance);
                currentGroup = [item.bubble];
            } else {
                currentGroup.push(item.bubble);
            }
        }
        
        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }
        
        return groups;
    }
    
    /**
     * Calculate grid distance between two positions
     */
    calculateGridDistance(x1, y1, x2, y2) {
        // Hexagonal grid distance calculation
        const dx = x2 - x1;
        const dy = y2 - y1;
        
        // Account for hexagonal offset
        const isOddRow1 = y1 % 2 === 1;
        const isOddRow2 = y2 % 2 === 1;
        
        let adjustedDx = dx;
        if (isOddRow1 !== isOddRow2) {
            adjustedDx += isOddRow2 ? 0.5 : -0.5;
        }
        
        return Math.sqrt(adjustedDx * adjustedDx + dy * dy);
    }
    
    /**
     * Process a wave group with sympathy effects
     */
    processWaveGroup(wave, groupIndex) {
        if (groupIndex >= wave.groups.length) {
            // Wave complete, remove from active waves
            const index = this.destructionWaves.indexOf(wave);
            if (index > -1) {
                this.destructionWaves.splice(index, 1);
            }
            return;
        }
        
        const group = wave.groups[groupIndex];
        const intensity = 1.0 - (groupIndex / wave.groups.length) * 0.5; // Decrease intensity with distance
        
        // Apply sympathy effects to this group
        group.forEach((bubble, index) => {
            // Stagger the effect slightly within the group
            setTimeout(() => {
                this.applySymptomEffect(bubble, wave, groupIndex, intensity);
            }, index * 10);
        });
        
        // Schedule next wave group
        setTimeout(() => {
            this.processWaveGroup(wave, groupIndex + 1);
        }, this.config.waveDelay);
    }
    
    /**
     * Apply sympathy effect to a single bubble
     */
    applySymptomEffect(bubble, wave, waveLevel, intensity) {
        if (!bubble || bubble.isDestroyed) return;
        
        // Create or update effect state
        const effectState = this.affectedBubbles.get(bubble.id) || {
            bubble: bubble,
            startTime: Date.now(),
            waveLevel: waveLevel,
            intensity: 0,
            targetIntensity: intensity,
            vibrationPhase: Math.random() * Math.PI * 2,
            glowIntensity: 0,
            scaleOffset: 0,
            particleTimer: 0,
            originalEmissive: bubble.material?.emissive?.clone() || new THREE.Color(0),
            originalEmissiveIntensity: bubble.material?.emissiveIntensity || 0
        };
        
        // Update target intensity if this is stronger
        effectState.targetIntensity = Math.max(effectState.targetIntensity, intensity);
        effectState.waveLevel = Math.min(effectState.waveLevel, waveLevel);
        
        this.affectedBubbles.set(bubble.id, effectState);
        
        // Start vibration
        this.startVibration(bubble, effectState);
        
        // Start glow buildup
        this.startGlowEffect(bubble, effectState);
        
        // Add to mexican wave if close to epicenter
        if (waveLevel < 3) {
            this.addToMexicanWave(bubble, wave.epicenter, waveLevel);
        }
    }
    
    /**
     * Start vibration effect on bubble
     */
    startVibration(bubble, effectState) {
        if (!bubble.sympathyVibration) {
            bubble.sympathyVibration = {
                amplitude: 0,
                frequency: 1,
                phase: effectState.vibrationPhase
            };
        }
        
        // Set target vibration based on intensity
        bubble.sympathyVibration.targetAmplitude = 
            this.config.baseVibration + 
            (this.config.maxVibration - this.config.baseVibration) * effectState.targetIntensity;
        
        bubble.sympathyVibration.frequency = 5 + effectState.waveLevel * 2;
    }
    
    /**
     * Start glow effect on bubble
     */
    startGlowEffect(bubble, effectState) {
        if (!bubble.material) return;
        
        // Store original material properties if not already stored
        if (!effectState.originalEmissive) {
            effectState.originalEmissive = bubble.material.emissive.clone();
            effectState.originalEmissiveIntensity = bubble.material.emissiveIntensity;
        }
        
        // Enable emissive glow
        bubble.material.emissive = this.config.glowColor;
        bubble.sympathyGlow = true;
    }
    
    /**
     * Add bubble to mexican wave effect
     */
    addToMexicanWave(bubble, epicenter, waveLevel) {
        if (!bubble.mexicanWave) {
            const distance = bubble.position.distanceTo(epicenter);
            bubble.mexicanWave = {
                active: true,
                phase: distance * 0.5, // Phase based on distance
                amplitude: this.config.waveHeight * (1 - waveLevel * 0.2),
                originalY: bubble.position.y
            };
        }
    }
    
    /**
     * Handle bubble repositioning events (e.g., when rows are added)
     */
    handleBubblesRepositioned(data) {
        const { movements, reason } = data;
        
        // Update effect states for repositioned bubbles
        this.affectedBubbles.forEach((state, bubbleId) => {
            const movement = movements.get(bubbleId);
            if (movement && movement.bubble) {
                // The bubble position has already been updated by setGridPosition
                // Just ensure our state tracking is aware of the new position
                // Most effects are applied directly to the bubble's properties
                // so they will automatically follow the bubble
                
                // Update mexicanWave originalY if it exists
                if (movement.bubble.mexicanWave) {
                    movement.bubble.mexicanWave.originalY = movement.bubble.position.y;
                }
            }
        });
        
        // Update destruction wave positions if needed
        this.destructionWaves.forEach(wave => {
            if (wave.epicenter && wave.epicenterBubbleId) {
                const movement = movements.get(wave.epicenterBubbleId);
                if (movement) {
                    // Update wave epicenter to follow the bubble
                    const delta = new THREE.Vector3().subVectors(
                        movement.bubble.position,
                        movement.oldPosition
                    );
                    wave.epicenter.add(delta);
                }
            }
        });
    }
    
    /**
     * Update all active sympathy effects
     */
    update(deltaTime) {
        this.animationTime += deltaTime;
        
        // Update each affected bubble
        for (const [bubbleId, effectState] of this.affectedBubbles) {
            const bubble = effectState.bubble;
            
            if (!bubble || bubble.isDestroyed) {
                this.affectedBubbles.delete(bubbleId);
                continue;
            }
            
            // Ramp up intensity
            effectState.intensity = THREE.MathUtils.lerp(
                effectState.intensity,
                effectState.targetIntensity,
                deltaTime * this.config.vibrationRampUp
            );
            
            // Update vibration
            this.updateVibration(bubble, effectState, deltaTime);
            
            // Update glow
            this.updateGlow(bubble, effectState, deltaTime);
            
            // Update scale pulsing
            this.updateScalePulse(bubble, effectState, deltaTime);
            
            // Update mexican wave
            this.updateMexicanWave(bubble, deltaTime);
            
            // Spawn anticipation particles
            this.spawnAnticipationParticles(bubble, effectState, deltaTime);
        }
    }
    
    /**
     * Update vibration effect
     */
    updateVibration(bubble, effectState, deltaTime) {
        if (!bubble.sympathyVibration) return;
        
        const vibration = bubble.sympathyVibration;
        
        // Smooth amplitude transition
        vibration.amplitude = THREE.MathUtils.lerp(
            vibration.amplitude || 0,
            vibration.targetAmplitude,
            deltaTime * 5
        );
        
        // Apply vibration offset
        const time = this.animationTime;
        const offsetX = Math.sin(time * vibration.frequency + vibration.phase) * vibration.amplitude;
        const offsetY = Math.cos(time * vibration.frequency * 1.3 + vibration.phase) * vibration.amplitude * 0.7;
        
        // Store vibration offset for rendering
        bubble.vibrationOffset = new THREE.Vector3(offsetX, offsetY, 0);
        
        // Apply to mesh if not using instanced rendering
        if (!bubble.useInstancedRendering && bubble.mesh) {
            bubble.mesh.position.x = bubble.position.x + offsetX;
            bubble.mesh.position.y = bubble.position.y + offsetY;
        }
    }
    
    /**
     * Update glow effect
     */
    updateGlow(bubble, effectState, deltaTime) {
        if (!bubble.material || !bubble.sympathyGlow) return;
        
        // Pulsing glow intensity
        const pulsePhase = this.animationTime * this.config.glowPulseSpeed;
        const basePulse = (Math.sin(pulsePhase) + 1) * 0.5;
        
        // Combine with intensity ramp
        const glowIntensity = this.config.baseGlow + 
            (this.config.maxGlow - this.config.baseGlow) * effectState.intensity * basePulse;
        
        bubble.material.emissiveIntensity = glowIntensity;
        
        // Store for instanced rendering
        bubble.sympathyGlowIntensity = glowIntensity;
    }
    
    /**
     * Update scale pulsing
     */
    updateScalePulse(bubble, effectState, deltaTime) {
        const pulsePhase = this.animationTime * this.config.scaleOscillation + effectState.vibrationPhase;
        const scalePulse = Math.sin(pulsePhase) * 0.5 + 0.5;
        
        const targetScale = this.config.baseScale + 
            (this.config.maxScale - this.config.baseScale) * effectState.intensity * scalePulse;
        
        // Store scale for both rendering methods
        bubble.sympathyScale = targetScale;
        
        // Apply to mesh if not using instanced rendering
        if (!bubble.useInstancedRendering && bubble.mesh) {
            bubble.mesh.scale.setScalar(targetScale);
        }
    }
    
    /**
     * Update mexican wave effect
     */
    updateMexicanWave(bubble, deltaTime) {
        if (!bubble.mexicanWave || !bubble.mexicanWave.active) return;
        
        const wave = bubble.mexicanWave;
        const wavePhase = this.animationTime * this.config.waveOscillation - wave.phase;
        const waveOffset = Math.sin(wavePhase) * wave.amplitude;
        
        // Apply wave offset
        bubble.waveOffset = waveOffset;
        
        // Decay amplitude over time
        wave.amplitude *= (1 - deltaTime * 0.5);
        
        if (wave.amplitude < 0.01) {
            wave.active = false;
            bubble.waveOffset = 0;
        }
    }
    
    /**
     * Spawn anticipation particles
     */
    spawnAnticipationParticles(bubble, effectState, deltaTime) {
        effectState.particleTimer += deltaTime;
        
        const particleInterval = 1.0 / (this.config.particleRate * effectState.intensity);
        
        if (effectState.particleTimer >= particleInterval && effectState.intensity > 0.3) {
            effectState.particleTimer = 0;
            
            // Spawn a particle
            const color = this.config.particleColors[
                Math.floor(Math.random() * this.config.particleColors.length)
            ];
            
            const particle = this.gameManager.gameState.particlePool.spawn(
                bubble.position.x + (Math.random() - 0.5) * 0.3,
                bubble.position.y + (Math.random() - 0.5) * 0.3,
                bubble.position.z,
                color,
                this.config.particleSize * (0.5 + Math.random() * 0.5),
                new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    Math.random() * 3 + 1,
                    (Math.random() - 0.5) * 2
                )
            );
            
            if (particle) {
                particle.decay = 0.02;
                particle.glowing = true; // Mark for bloom effect
            }
        }
    }
    
    /**
     * Prepare bubbles for match destruction
     */
    prepareMatchDestruction(matches, source) {
        // Emit event for chain analysis
        this.gameManager.eventBus.emit('analyzeDestructionChain', {
            bubbles: matches,
            source: source,
            type: 'match'
        });
    }
    
    /**
     * Prepare bubbles for bomb destruction
     */
    prepareBombDestruction(center, radius, affectedBubbles) {
        // Create shockwave effect from center
        this.gameManager.eventBus.emit('analyzeDestructionChain', {
            bubbles: affectedBubbles,
            source: center,
            type: 'bomb'
        });
        
        // Add extra intensity for bomb
        affectedBubbles.forEach(bubble => {
            const state = this.affectedBubbles.get(bubble.id);
            if (state) {
                state.targetIntensity = 1.0; // Max intensity for bomb
            }
        });
    }
    
    /**
     * Prepare bubbles for lightning destruction
     */
    prepareLightningDestruction(bubbles, isRow) {
        // Lightning travels in a line, so order by position
        const ordered = [...bubbles].sort((a, b) => {
            return isRow ? a.gridX - b.gridX : a.gridY - b.gridY;
        });
        
        // Create wave groups for sequential destruction
        const groups = [];
        const groupSize = 2;
        for (let i = 0; i < ordered.length; i += groupSize) {
            groups.push(ordered.slice(i, i + groupSize));
        }
        
        const wave = {
            id: `lightning_${Date.now()}`,
            type: 'lightning',
            groups: groups,
            currentGroup: 0,
            startTime: Date.now(),
            epicenter: ordered[0].position.clone()
        };
        
        this.destructionWaves.push(wave);
        this.processWaveGroup(wave, 0);
    }
    
    /**
     * Clean up effects for a destroyed bubble
     */
    cleanupBubble(bubble) {
        if (!bubble) return;
        
        const effectState = this.affectedBubbles.get(bubble.id);
        if (effectState) {
            // Restore original material properties
            if (bubble.material && effectState.originalEmissive) {
                bubble.material.emissive = effectState.originalEmissive;
                bubble.material.emissiveIntensity = effectState.originalEmissiveIntensity;
            }
            
            // Clear effect properties
            delete bubble.sympathyVibration;
            delete bubble.sympathyGlow;
            delete bubble.sympathyGlowIntensity;
            delete bubble.sympathyScale;
            delete bubble.vibrationOffset;
            delete bubble.mexicanWave;
            delete bubble.waveOffset;
            
            // Remove from tracking
            this.affectedBubbles.delete(bubble.id);
        }
    }
    
    /**
     * Clean up all effects
     */
    cleanup() {
        // Clean up all affected bubbles
        for (const [bubbleId, effectState] of this.affectedBubbles) {
            this.cleanupBubble(effectState.bubble);
        }
        
        this.affectedBubbles.clear();
        this.destructionWaves = [];
    }
}