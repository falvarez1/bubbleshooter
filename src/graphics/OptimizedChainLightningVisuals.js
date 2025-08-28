import * as THREE from 'three';
import { getChainLightningEffectPool } from './ChainLightningEffectPool.js';
import { getChainLightningAnimationManager } from './ChainLightningAnimationManager.js';

/**
 * OptimizedChainLightningVisuals - Optimized visual effects for chain lightning
 * Replaces the original ChainLightningVisuals with pooled resources and unified animation
 */
export class OptimizedChainLightningVisuals {
    constructor(scene) {
        this.scene = scene;
        this.effectPool = getChainLightningEffectPool();
        this.animationManager = getChainLightningAnimationManager();
        
        // Track active visual effects
        this.activeEffects = new Map();
        
        // Performance settings
        this.quality = this.detectQualityLevel();
        
        // Shader uniforms for electric effects
        this.electricUniforms = {
            time: { value: 0 },
            intensity: { value: 1.0 },
            electricColor: { value: new THREE.Color(0x00ddff) }
        };
        
        // Initialize shader materials
        this.initializeShaders();
    }
    
    /**
     * Detect appropriate quality level based on device
     */
    detectQualityLevel() {
        // Simple detection based on renderer capabilities
        if (window.game && window.game.renderer) {
            const gl = window.game.renderer.getContext();
            const maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
            
            if (maxTextures >= 16) {
                return 'high';
            } else if (maxTextures >= 8) {
                return 'medium';
            }
        }
        return 'low';
    }
    
    /**
     * Initialize optimized shader materials
     */
    initializeShaders() {
        // Electric glow shader - runs on existing geometry
        this.electricGlowShader = new THREE.ShaderMaterial({
            uniforms: this.electricUniforms,
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                uniform float time;
                uniform float intensity;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    
                    // Add electric jitter in vertex shader (more efficient)
                    vec3 pos = position;
                    float jitter = sin(time * 20.0 + position.y * 10.0) * 0.01 * intensity;
                    pos.x += jitter;
                    pos.y += jitter * 0.5;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 electricColor;
                uniform float time;
                uniform float intensity;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    // Electric pulse effect
                    float pulse = 0.5 + 0.5 * sin(time * 10.0 + vPosition.y * 5.0);
                    
                    // Lightning-like noise
                    float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
                    float electric = pulse * (0.7 + 0.3 * noise);
                    
                    // Color with electric intensity
                    vec3 color = electricColor * electric * intensity;
                    
                    // Add white core for intensity
                    color += vec3(1.0) * pow(electric, 3.0) * intensity * 0.5;
                    
                    gl_FragColor = vec4(color, electric * intensity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
    }
    
    /**
     * Trigger chain lightning visual sequence
     */
    triggerChainLightning(impactPosition, primaryTargets, secondaryTargets) {
        // Prepare target data for animation manager
        const targets = {
            primary: primaryTargets,
            secondary: secondaryTargets
        };
        
        // Start the optimized animation sequence
        this.animationManager.startSequence(impactPosition, targets);
        
        // Add electric field effects to affected bubbles (optimized)
        this.applyElectricFields(primaryTargets.concat(secondaryTargets));
        
        // Trigger GPU particle effects if available
        if (window.game && window.game.gpuParticles) {
            this.triggerGPUParticles(impactPosition);
        }
        
        return true;
    }
    
    /**
     * Apply electric field effects to bubbles using shaders
     */
    applyElectricFields(bubbles) {
        if (this.quality === 'low') return;
        
        bubbles.forEach(bubble => {
            if (!bubble || bubble.isDestroyed) return;
            
            // Mark bubble as electric for the instanced renderer
            bubble.isElectric = true;
            bubble.electricIntensity = 1.0;
            
            // If using instanced rendering
            if (bubble.useInstancedRendering && window.game?.bubbleInstances) {
                // Update instance attributes
                const mapping = window.game.bubbleInstances.getBubbleMapping(bubble);
                if (mapping) {
                    const instanceIndex = mapping.index;
                    const glowAttr = window.game.bubbleInstances.instancedMesh.geometry.getAttribute('instanceGlow');
                    if (glowAttr) {
                        glowAttr.setX(instanceIndex, 1.0);
                        glowAttr.needsUpdate = true;
                    }
                }
            }
            
            // Store effect data
            this.activeEffects.set(bubble.id, {
                bubble: bubble,
                startTime: Date.now(),
                duration: 500
            });
        });
    }
    
    /**
     * Trigger GPU-accelerated particles
     */
    triggerGPUParticles(position) {
        if (!window.game.gpuParticles) return;
        
        const particleCount = this.quality === 'high' ? 50 : 25;
        
        // Check if createBurst method exists, otherwise use spawn method
        if (window.game.gpuParticles.createBurst) {
            window.game.gpuParticles.createBurst({
                position: position,
                count: particleCount,
                color: new THREE.Color(0x00ddff),
                size: 0.1,
                speed: 10,
                lifetime: 0.5,
                spread: Math.PI * 2,
                gravity: 0,
                blending: THREE.AdditiveBlending
            });
        } else if (window.game.gpuParticles.spawn) {
            // Fallback to spawn method if available
            const color = new THREE.Color(0x00ddff);
            for (let i = 0; i < particleCount; i++) {
                const angle = (Math.PI * 2 * i) / particleCount;
                const velocity = new THREE.Vector3(
                    Math.cos(angle) * 10,
                    Math.sin(angle) * 10,
                    (Math.random() - 0.5) * 5
                );
                window.game.gpuParticles.spawn(
                    position.x,
                    position.y,
                    position.z,
                    color,
                    0.1,
                    velocity
                );
            }
        } else if (window.game.particlePool && window.game.particlePool.spawnPower) {
            // Fallback to particle pool
            const color = new THREE.Color(0x00ddff);
            const velocity = new THREE.Vector3(0, 0, 0);
            window.game.particlePool.spawnPower(
                position.x,
                position.y,
                position.z,
                color,
                0.1,
                velocity,
                particleCount / 10,
                'lightning'
            );
        }
    }
    
    /**
     * Create optimized lightning bolt between positions
     */
    createLightningBolt(startPos, endPos, isPrimary = true) {
        // This is now handled by the animation manager
        // Kept for API compatibility
        return this.animationManager.createBoltEffect(
            startPos,
            endPos,
            isPrimary,
            `manual_${Date.now()}`
        );
    }
    
    /**
     * Update method - called every frame
     */
    update(deltaTime) {
        // Update animation manager
        this.animationManager.update(deltaTime);
        
        // Update shader uniforms
        this.electricUniforms.time.value += deltaTime;
        
        // Update active electric field effects
        const now = Date.now();
        const effectsToRemove = [];
        
        this.activeEffects.forEach((effect, bubbleId) => {
            const elapsed = now - effect.startTime;
            
            if (elapsed > effect.duration) {
                effectsToRemove.push(bubbleId);
            } else {
                // Update electric intensity with fade
                const progress = elapsed / effect.duration;
                const intensity = 1.0 - progress;
                
                if (effect.bubble && !effect.bubble.isDestroyed) {
                    effect.bubble.electricIntensity = intensity;
                    
                    // Update instanced renderer
                    if (effect.bubble.useInstancedRendering && window.game?.bubbleInstances) {
                        const mapping = window.game.bubbleInstances.getBubbleMapping(effect.bubble);
                        if (mapping) {
                            const instanceIndex = mapping.index;
                            const glowAttr = window.game.bubbleInstances.instancedMesh.geometry.getAttribute('instanceGlow');
                            if (glowAttr) {
                                glowAttr.setX(instanceIndex, intensity);
                                glowAttr.needsUpdate = true;
                            }
                        }
                    }
                }
            }
        });
        
        // Remove expired effects
        effectsToRemove.forEach(id => {
            const effect = this.activeEffects.get(id);
            if (effect && effect.bubble) {
                effect.bubble.isElectric = false;
                effect.bubble.electricIntensity = 0;
            }
            this.activeEffects.delete(id);
        });
    }
    
    /**
     * Create electric field effect for a bubble (simplified)
     */
    createElectricField(bubble) {
        // Use shader-based effect instead of geometry
        this.applyElectricFields([bubble]);
    }
    
    /**
     * Remove effects for a specific bubble
     */
    removeEffects(bubbleId) {
        const effect = this.activeEffects.get(bubbleId);
        if (effect) {
            if (effect.bubble) {
                effect.bubble.isElectric = false;
                effect.bubble.electricIntensity = 0;
            }
            this.activeEffects.delete(bubbleId);
        }
    }
    
    /**
     * Clean up all effects
     */
    cleanup() {
        // Clear all active effects
        this.activeEffects.forEach(effect => {
            if (effect.bubble) {
                effect.bubble.isElectric = false;
                effect.bubble.electricIntensity = 0;
            }
        });
        this.activeEffects.clear();
        
        // Reset animation manager
        this.animationManager.reset();
    }
    
    /**
     * Get performance statistics
     */
    getStats() {
        return {
            activeEffects: this.activeEffects.size,
            quality: this.quality,
            animationStats: this.animationManager.getStats()
        };
    }
    
    /**
     * Set quality level
     */
    setQuality(level) {
        this.quality = level;
        console.log(`Chain Lightning quality set to: ${level}`);
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        this.cleanup();
        this.animationManager.dispose();
        
        if (this.electricGlowShader) {
            this.electricGlowShader.dispose();
        }
    }
}

// Factory function to create or get instance
export function createOptimizedChainLightningVisuals(scene) {
    return new OptimizedChainLightningVisuals(scene);
}