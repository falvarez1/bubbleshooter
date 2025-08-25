import * as THREE from 'three';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Electrical Distortion Pass
 * Creates screen-space warping effects around electrical objects
 */
export class ElectricalDistortionPass extends Pass {
    constructor() {
        super();
        
        // Distortion targets (positions in world space)
        this.distortionTargets = [];
        
        // Create shader material
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                time: { value: 0 },
                distortionStrength: { value: 0.1 },
                distortionTargets: { value: [] }, // Array of vec4 (xyz = position, w = strength)
                targetCount: { value: 0 },
                resolution: { value: new THREE.Vector2() }
            },
            
            vertexShader: `
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float time;
                uniform float distortionStrength;
                uniform vec4 distortionTargets[10]; // Max 10 distortion sources
                uniform int targetCount;
                uniform vec2 resolution;
                
                varying vec2 vUv;
                
                // Noise function for organic distortion
                float noise(vec2 p) {
                    return sin(p.x * 10.0 + time * 2.0) * cos(p.y * 10.0 + time * 1.5);
                }
                
                // Calculate distortion from a single source
                vec2 calculateDistortion(vec2 uv, vec3 targetPos, float strength) {
                    vec2 center = targetPos.xy;
                    float dist = distance(uv, center);
                    
                    if (dist < 0.3) { // Distortion radius
                        float factor = 1.0 - (dist / 0.3);
                        factor = pow(factor, 2.0);
                        
                        // Radial distortion with electrical noise
                        vec2 dir = normalize(uv - center);
                        float noiseVal = noise(uv * 20.0);
                        
                        // Create warping effect
                        vec2 distortion = dir * factor * strength * 0.1;
                        
                        // Add electrical jitter
                        distortion += vec2(
                            sin(time * 30.0 + uv.y * 50.0) * factor * 0.002,
                            cos(time * 25.0 + uv.x * 50.0) * factor * 0.002
                        );
                        
                        // Add spiral distortion for electrical vortex effect
                        float angle = atan(dir.y, dir.x) + time * 2.0 * factor;
                        distortion += vec2(
                            cos(angle) * factor * strength * 0.02,
                            sin(angle) * factor * strength * 0.02
                        );
                        
                        return distortion;
                    }
                    
                    return vec2(0.0);
                }
                
                void main() {
                    vec2 uv = vUv;
                    vec2 totalDistortion = vec2(0.0);
                    
                    // Apply distortion from all active targets
                    for (int i = 0; i < 10; i++) {
                        if (i >= targetCount) break;
                        
                        vec3 targetPos = distortionTargets[i].xyz;
                        float strength = distortionTargets[i].w;
                        
                        totalDistortion += calculateDistortion(uv, targetPos, strength);
                    }
                    
                    // Apply chromatic aberration for electrical effect
                    vec2 uvR = uv + totalDistortion * 1.0;
                    vec2 uvG = uv + totalDistortion * 0.9;
                    vec2 uvB = uv + totalDistortion * 0.8;
                    
                    // Sample with distortion
                    float r = texture2D(tDiffuse, uvR).r;
                    float g = texture2D(tDiffuse, uvG).g;
                    float b = texture2D(tDiffuse, uvB).b;
                    
                    vec3 color = vec3(r, g, b);
                    
                    // Add slight color shift for electrical atmosphere
                    if (length(totalDistortion) > 0.001) {
                        color.b += 0.05 * length(totalDistortion) * 10.0;
                        color.g += 0.02 * length(totalDistortion) * 10.0;
                    }
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });
        
        // Create full-screen quad
        this.fsQuad = new Pass.FullScreenQuad(this.material);
    }
    
    /**
     * Add a distortion target
     * @param {THREE.Vector3} worldPosition - Position in world space
     * @param {number} strength - Distortion strength (0-1)
     * @param {string} id - Unique identifier for this target
     */
    addDistortionTarget(worldPosition, strength = 0.1, id = null) {
        const target = {
            position: worldPosition.clone(),
            strength: strength,
            id: id || `distortion_${Date.now()}_${Math.random()}`
        };
        
        this.distortionTargets.push(target);
        this.updateUniforms();
        
        return target.id;
    }
    
    /**
     * Update distortion target position
     * @param {string} id - Target identifier
     * @param {THREE.Vector3} newPosition - New world position
     */
    updateDistortionTarget(id, newPosition) {
        const target = this.distortionTargets.find(t => t.id === id);
        if (target) {
            target.position.copy(newPosition);
            this.updateUniforms();
        }
    }
    
    /**
     * Remove a distortion target
     * @param {string} id - Target identifier
     */
    removeDistortionTarget(id) {
        const index = this.distortionTargets.findIndex(t => t.id === id);
        if (index !== -1) {
            this.distortionTargets.splice(index, 1);
            this.updateUniforms();
        }
    }
    
    /**
     * Clear all distortion targets
     */
    clearDistortionTargets() {
        this.distortionTargets = [];
        this.updateUniforms();
    }
    
    /**
     * Update shader uniforms with current targets
     */
    updateUniforms() {
        const maxTargets = 10;
        const targetsArray = [];
        
        // Convert world positions to screen space and pack into vec4 array
        for (let i = 0; i < Math.min(this.distortionTargets.length, maxTargets); i++) {
            const target = this.distortionTargets[i];
            
            // For now, use normalized positions (you'd convert world to screen space here)
            // This is simplified - in production you'd project world positions to screen
            targetsArray.push(new THREE.Vector4(
                target.position.x / 10 + 0.5, // Normalize to 0-1 range
                target.position.y / 10 + 0.5,
                target.position.z,
                target.strength
            ));
        }
        
        // Fill remaining slots with zero vectors
        while (targetsArray.length < maxTargets) {
            targetsArray.push(new THREE.Vector4(0, 0, 0, 0));
        }
        
        this.material.uniforms.distortionTargets.value = targetsArray;
        this.material.uniforms.targetCount.value = Math.min(this.distortionTargets.length, maxTargets);
    }
    
    /**
     * Set render size
     */
    setSize(width, height) {
        this.material.uniforms.resolution.value.set(width, height);
    }
    
    /**
     * Render the distortion pass
     */
    render(renderer, writeBuffer, readBuffer, deltaTime) {
        // Update time uniform
        this.material.uniforms.time.value += deltaTime;
        
        // Set input texture
        this.material.uniforms.tDiffuse.value = readBuffer.texture;
        
        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
            this.fsQuad.render(renderer);
        } else {
            renderer.setRenderTarget(writeBuffer);
            if (this.clear) renderer.clear();
            this.fsQuad.render(renderer);
        }
    }
}

/**
 * Helper class to manage electrical distortion effects for Chain Lightning
 */
export class ChainLightningDistortionManager {
    constructor(distortionPass) {
        this.distortionPass = distortionPass;
        this.activeDistortions = new Map(); // bubbleId -> distortionId
    }
    
    /**
     * Add distortion for a Chain Lightning bubble
     */
    addChainLightningDistortion(bubble) {
        if (!bubble.distortionField) return;
        
        const distortionId = this.distortionPass.addDistortionTarget(
            bubble.position,
            bubble.distortionField.strength || 0.1,
            `chain_lightning_${bubble.id}`
        );
        
        this.activeDistortions.set(bubble.id, distortionId);
        
        // Set up auto-update for moving bubbles
        if (!bubble.distortionUpdateInterval) {
            bubble.distortionUpdateInterval = setInterval(() => {
                if (bubble.position && this.activeDistortions.has(bubble.id)) {
                    this.distortionPass.updateDistortionTarget(
                        this.activeDistortions.get(bubble.id),
                        bubble.position
                    );
                }
            }, 16); // Update at 60fps
        }
    }
    
    /**
     * Remove distortion for a bubble
     */
    removeChainLightningDistortion(bubble) {
        const distortionId = this.activeDistortions.get(bubble.id);
        if (distortionId) {
            this.distortionPass.removeDistortionTarget(distortionId);
            this.activeDistortions.delete(bubble.id);
            
            // Clear update interval
            if (bubble.distortionUpdateInterval) {
                clearInterval(bubble.distortionUpdateInterval);
                bubble.distortionUpdateInterval = null;
            }
        }
    }
    
    /**
     * Update distortion strength dynamically
     */
    pulseDistortion(bubble, duration = 200) {
        const distortionId = this.activeDistortions.get(bubble.id);
        if (!distortionId || !bubble.distortionField) return;
        
        const originalStrength = bubble.distortionField.strength;
        const pulseStrength = originalStrength * 2;
        
        // Increase strength
        bubble.distortionField.strength = pulseStrength;
        this.distortionPass.updateDistortionTarget(distortionId, bubble.position);
        
        // Restore after duration
        setTimeout(() => {
            if (bubble.distortionField) {
                bubble.distortionField.strength = originalStrength;
                this.distortionPass.updateDistortionTarget(distortionId, bubble.position);
            }
        }, duration);
    }
}