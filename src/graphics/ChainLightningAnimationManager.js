import * as THREE from 'three';
import { getChainLightningEffectPool } from './ChainLightningEffectPool.js';

/**
 * ChainLightningAnimationManager - Unified animation system for all chain lightning effects
 * Replaces 100+ individual timers with a single efficient update loop
 */
export class ChainLightningAnimationManager {
    constructor() {
        this.effectPool = getChainLightningEffectPool();
        this.activeEffects = new Map();
        this.timeline = [];
        this.time = 0;
        this.isActive = false;
        
        // Performance monitoring
        this.frameTime = 0;
        this.effectCount = 0;
        this.performanceMode = 'high'; // 'high', 'medium', 'low'
        
        // Effect queues
        this.pendingEffects = [];
        this.particleEffects = [];
        this.lightEffects = [];
        this.boltEffects = [];
    }
    
    /**
     * Start a new chain lightning sequence
     */
    startSequence(impactPosition, targets) {
        this.reset();
        this.isActive = true;
        this.time = 0;
        
        // Build timeline of effects
        this.buildTimeline(impactPosition, targets);
        
        return this;
    }
    
    /**
     * Build the effect timeline based on targets
     */
    buildTimeline(impactPosition, targets) {
        const timeline = [];
        
        // T=0ms: Initial impact
        timeline.push({
            time: 0,
            type: 'impact',
            position: impactPosition,
            intensity: 1.0
        });
        
        // T=0ms: Screen shake
        timeline.push({
            time: 0,
            type: 'screenShake',
            intensity: 0.4,
            duration: 12
        });
        
        // T=50-150ms: Primary bolts
        targets.primary.forEach((target, index) => {
            timeline.push({
                time: 50 + index * 30,
                type: 'bolt',
                from: impactPosition,
                to: target.position,
                isPrimary: true,
                targetId: target.id
            });
            
            // T=100-200ms: Primary impact
            timeline.push({
                time: 100 + index * 30,
                type: 'bubbleImpact',
                position: target.position,
                intensity: 0.8
            });
        });
        
        // T=150-300ms: Secondary bolts
        targets.secondary.forEach((target, index) => {
            timeline.push({
                time: 150 + index * 20,
                type: 'bolt',
                from: target.from,
                to: target.position,
                isPrimary: false,
                targetId: target.id
            });
            
            // T=180-330ms: Secondary impact
            timeline.push({
                time: 180 + index * 20,
                type: 'bubbleImpact',
                position: target.position,
                intensity: 0.5
            });
        });
        
        // T=400ms: Destruction wave
        timeline.push({
            time: 400,
            type: 'destructionWave',
            bubbles: [...targets.primary, ...targets.secondary]
        });
        
        // T=600ms: Cleanup
        timeline.push({
            time: 600,
            type: 'cleanup'
        });
        
        this.timeline = timeline;
    }
    
    /**
     * Main update loop - called every frame
     */
    update(deltaTime) {
        if (!this.isActive) return;
        
        const startTime = performance.now();
        
        // Update time
        this.time += deltaTime * 1000; // Convert to ms
        
        // Process timeline events
        this.processTimeline();
        
        // Update active effects
        this.updateBolts(deltaTime);
        this.updateLights(deltaTime);
        this.updateParticles(deltaTime);
        
        // Performance monitoring
        this.frameTime = performance.now() - startTime;
        
        // Auto-adjust quality if needed
        if (this.frameTime > 8) { // More than 8ms = potential frame drop
            this.adjustQuality('down');
        }
        
        // Check if sequence is complete
        if (this.time > 700 && this.activeEffects.size === 0) {
            this.complete();
        }
    }
    
    /**
     * Process timeline events
     */
    processTimeline() {
        const currentEvents = this.timeline.filter(event => {
            return event.time <= this.time && !event.processed;
        });
        
        currentEvents.forEach(event => {
            event.processed = true;
            this.executeEvent(event);
        });
    }
    
    /**
     * Execute a timeline event
     */
    executeEvent(event) {
        switch (event.type) {
            case 'impact':
                this.createImpactEffect(event.position, event.intensity);
                break;
                
            case 'bolt':
                this.createBoltEffect(event.from, event.to, event.isPrimary, event.targetId);
                break;
                
            case 'bubbleImpact':
                this.createBubbleImpactEffect(event.position, event.intensity);
                break;
                
            case 'screenShake':
                this.triggerScreenShake(event.intensity, event.duration);
                break;
                
            case 'destructionWave':
                this.createDestructionWave(event.bubbles);
                break;
                
            case 'cleanup':
                this.beginCleanup();
                break;
        }
    }
    
    /**
     * Create impact effect at position
     */
    createImpactEffect(position, intensity) {
        // Acquire light from pool
        const light = this.effectPool.acquireLight(0x00ddff, 15 * intensity, 6);
        light.position.copy(position);
        light.position.z = 2;
        
        // Add to scene if available and light is valid
        if (window.game && window.game.scene && light instanceof THREE.Light) {
            window.game.scene.add(light);
        }
        
        // Create light effect data
        const lightEffect = {
            id: `impact_${Date.now()}`,
            light: light,
            startIntensity: 15 * intensity,
            age: 0,
            lifetime: 0.3,
            fadeStart: 0.1
        };
        
        this.lightEffects.push(lightEffect);
        this.activeEffects.set(lightEffect.id, lightEffect);
        
        // Trigger particle burst (optimized)
        if (this.performanceMode !== 'low') {
            this.createOptimizedParticleBurst(position, intensity);
        }
    }
    
    /**
     * Create bolt effect between two positions
     */
    createBoltEffect(from, to, isPrimary, targetId) {
        // Acquire bolt geometry from pool
        const boltGeometry = this.effectPool.acquireBolt();
        
        // Update path using pre-generated pattern
        const pattern = this.effectPool.getRandomPattern();
        this.effectPool.updateBoltPath(boltGeometry, from, to, pattern);
        
        // Get appropriate material
        const material = this.effectPool.getMaterial(isPrimary ? 'bolt' : 'boltSecondary');
        
        // Create line mesh
        const boltMesh = new THREE.Line(boltGeometry, material);
        boltMesh.position.z = 1.5;
        
        // Add to scene
        if (window.game && window.game.scene) {
            window.game.scene.add(boltMesh);
        }
        
        // Create bolt effect data
        const boltEffect = {
            id: `bolt_${targetId}`,
            mesh: boltMesh,
            geometry: boltGeometry,
            from: from,
            to: to,
            isPrimary: isPrimary,
            age: 0,
            lifetime: 0.4,
            flickerTime: 0,
            pattern: pattern
        };
        
        this.boltEffects.push(boltEffect);
        this.activeEffects.set(boltEffect.id, boltEffect);
        
        // Add glow if high performance
        if (this.performanceMode === 'high' && isPrimary) {
            this.addBoltGlow(boltEffect);
        }
    }
    
    /**
     * Add glow effect to bolt
     */
    addBoltGlow(boltEffect) {
        const glowMaterial = this.effectPool.getMaterial('boltGlow');
        const glowMesh = new THREE.Line(boltEffect.geometry, glowMaterial);
        glowMesh.position.z = 1.4;
        
        if (window.game && window.game.scene) {
            window.game.scene.add(glowMesh);
        }
        
        boltEffect.glowMesh = glowMesh;
    }
    
    /**
     * Create bubble impact effect
     */
    createBubbleImpactEffect(position, intensity) {
        // Flash light
        const light = this.effectPool.acquireLight(0xffffff, 8 * intensity, 3);
        light.position.copy(position);
        light.position.z = 2.2;
        
        if (window.game && window.game.scene && light instanceof THREE.Light) {
            window.game.scene.add(light);
        }
        
        const lightEffect = {
            id: `bubble_impact_${Date.now()}_${Math.random()}`,
            light: light,
            startIntensity: 8 * intensity,
            age: 0,
            lifetime: 0.2,
            fadeStart: 0.05,
            strobe: true,
            strobeCount: 0
        };
        
        this.lightEffects.push(lightEffect);
        this.activeEffects.set(lightEffect.id, lightEffect);
    }
    
    /**
     * Create optimized particle burst
     */
    createOptimizedParticleBurst(position, intensity) {
        // Use GPU particles if available
        if (window.game && window.game.particlePool) {
            const particleCount = this.performanceMode === 'high' ? 8 : 4;
            const colors = [0x00ddff, 0xffffff, 0x88ccff];
            
            for (let i = 0; i < particleCount; i++) {
                const angle = (Math.PI * 2 * i) / particleCount;
                const speed = (6 + Math.random() * 8) * intensity;
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                const velocity = new THREE.Vector3(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    (Math.random() - 0.5) * 4
                );
                
                window.game.particlePool.spawn(
                    position.x,
                    position.y,
                    position.z,
                    color,
                    0.12 * intensity,
                    velocity
                );
            }
        }
    }
    
    /**
     * Update bolt effects
     */
    updateBolts(deltaTime) {
        const boltsToRemove = [];
        
        this.boltEffects.forEach(bolt => {
            bolt.age += deltaTime;
            
            // Flicker effect
            bolt.flickerTime += deltaTime;
            const flicker = Math.random() > 0.2 ? 1 : 0.3;
            const electricFlicker = 1 + Math.sin(bolt.flickerTime * 30) * 0.3;
            const opacity = (1 - bolt.age / bolt.lifetime) * flicker * electricFlicker;
            
            bolt.mesh.material.opacity = Math.max(0, opacity);
            
            if (bolt.glowMesh) {
                bolt.glowMesh.material.opacity = Math.max(0, opacity * 0.3);
            }
            
            // Regenerate path for first 100ms (reduced from 250ms)
            if (bolt.age < 0.1 && Math.random() < 0.3) {
                const newPattern = this.effectPool.getRandomPattern();
                this.effectPool.updateBoltPath(bolt.geometry, bolt.from, bolt.to, newPattern);
            }
            
            // Check if expired
            if (bolt.age >= bolt.lifetime) {
                boltsToRemove.push(bolt);
            }
        });
        
        // Remove expired bolts
        boltsToRemove.forEach(bolt => {
            this.removeBoltEffect(bolt);
        });
    }
    
    /**
     * Update light effects
     */
    updateLights(deltaTime) {
        const lightsToRemove = [];
        
        this.lightEffects.forEach(effect => {
            effect.age += deltaTime;
            
            // Handle strobe effect
            if (effect.strobe && effect.strobeCount < 3) {
                const strobeOn = Math.floor(effect.age * 20) % 2 === 0;
                effect.light.intensity = strobeOn ? effect.startIntensity : 0;
                
                if (effect.age > 0.15) {
                    effect.strobe = false;
                }
            } else {
                // Fade out
                const fadeProgress = Math.max(0, (effect.age - effect.fadeStart) / (effect.lifetime - effect.fadeStart));
                effect.light.intensity = effect.startIntensity * (1 - fadeProgress);
            }
            
            // Check if expired
            if (effect.age >= effect.lifetime) {
                lightsToRemove.push(effect);
            }
        });
        
        // Remove expired lights
        lightsToRemove.forEach(effect => {
            this.removeLightEffect(effect);
        });
    }
    
    /**
     * Update particle effects (delegated to particle system)
     */
    updateParticles(deltaTime) {
        // Particles are handled by the main particle system
        // This is just for tracking/monitoring
    }
    
    /**
     * Remove bolt effect
     */
    removeBoltEffect(bolt) {
        // Remove from scene
        if (window.game && window.game.scene) {
            window.game.scene.remove(bolt.mesh);
            if (bolt.glowMesh) {
                window.game.scene.remove(bolt.glowMesh);
            }
        }
        
        // Release geometry back to pool
        this.effectPool.releaseBolt(bolt.geometry);
        
        // Remove from tracking
        const index = this.boltEffects.indexOf(bolt);
        if (index > -1) {
            this.boltEffects.splice(index, 1);
        }
        this.activeEffects.delete(bolt.id);
    }
    
    /**
     * Remove light effect
     */
    removeLightEffect(effect) {
        // Remove from scene
        if (window.game && window.game.scene) {
            window.game.scene.remove(effect.light);
        }
        
        // Release light back to pool
        this.effectPool.releaseLight(effect.light);
        
        // Remove from tracking
        const index = this.lightEffects.indexOf(effect);
        if (index > -1) {
            this.lightEffects.splice(index, 1);
        }
        this.activeEffects.delete(effect.id);
    }
    
    /**
     * Trigger screen shake
     */
    triggerScreenShake(intensity, duration) {
        if (window.game && window.game.addScreenShake) {
            window.game.addScreenShake(intensity, duration);
        }
    }
    
    /**
     * Create destruction wave effect
     */
    createDestructionWave(bubbles) {
        // Simplified destruction effect
        bubbles.forEach((bubble, index) => {
            setTimeout(() => {
                if (window.game && window.game.eventBus) {
                    window.game.eventBus.emit('destroyBubble', {
                        bubble: bubble,
                        skipAnimation: true
                    });
                }
            }, index * 30); // Staggered destruction
        });
    }
    
    /**
     * Begin cleanup phase
     */
    beginCleanup() {
        // Start fading all remaining effects
        this.boltEffects.forEach(bolt => {
            bolt.lifetime = Math.min(bolt.lifetime, bolt.age + 0.1);
        });
        
        this.lightEffects.forEach(effect => {
            effect.lifetime = Math.min(effect.lifetime, effect.age + 0.1);
        });
    }
    
    /**
     * Adjust quality based on performance
     */
    adjustQuality(direction) {
        if (direction === 'down') {
            if (this.performanceMode === 'high') {
                this.performanceMode = 'medium';
                console.log('ChainLightning: Reducing quality to medium');
            } else if (this.performanceMode === 'medium') {
                this.performanceMode = 'low';
                console.log('ChainLightning: Reducing quality to low');
            }
        } else if (direction === 'up') {
            if (this.performanceMode === 'low') {
                this.performanceMode = 'medium';
            } else if (this.performanceMode === 'medium') {
                this.performanceMode = 'high';
            }
        }
    }
    
    /**
     * Complete the sequence
     */
    complete() {
        this.isActive = false;
        this.reset();
        
        // Emit completion event
        if (window.game && window.game.eventBus) {
            window.game.eventBus.emit('chainLightningComplete');
        }
    }
    
    /**
     * Reset all effects
     */
    reset() {
        // Remove all active effects
        this.boltEffects.forEach(bolt => this.removeBoltEffect(bolt));
        this.lightEffects.forEach(effect => this.removeLightEffect(effect));
        
        // Clear arrays
        this.boltEffects = [];
        this.lightEffects = [];
        this.particleEffects = [];
        this.activeEffects.clear();
        this.timeline = [];
        this.time = 0;
        
        // Reset pool if needed
        this.effectPool.resetAll();
    }
    
    /**
     * Force stop all effects
     */
    forceStop() {
        this.isActive = false;
        this.reset();
    }
    
    /**
     * Get performance stats
     */
    getStats() {
        return {
            activeEffects: this.activeEffects.size,
            bolts: this.boltEffects.length,
            lights: this.lightEffects.length,
            frameTime: this.frameTime,
            performanceMode: this.performanceMode,
            poolStats: this.effectPool.getStats()
        };
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        this.reset();
        this.effectPool.dispose();
    }
}

// Singleton instance
let instance = null;

export function getChainLightningAnimationManager() {
    if (!instance) {
        instance = new ChainLightningAnimationManager();
    }
    return instance;
}