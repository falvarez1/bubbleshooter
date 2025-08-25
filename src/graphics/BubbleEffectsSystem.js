import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Independent Bubble Effects System
 * Creates visual effects at world positions, independent of bubble meshes
 */
export class BubbleEffectsSystem {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = new Map(); // effectId -> effect objects
        this.nextEffectId = 0;
    }
    
    /**
     * Create electric arcs around a world position
     * @param {THREE.Vector3} worldPosition - Position to create arcs at
     * @param {string} bubbleId - ID for tracking and cleanup
     * @param {number} duration - How long the effect lasts (ms)
     */
    createElectricArcs(worldPosition, bubbleId, duration = 400) {
        const effectId = `electric_arcs_${bubbleId}_${this.nextEffectId++}`;
        const arcCount = 3;
        const arcs = [];
        
        for (let i = 0; i < arcCount; i++) {
            const arcGeometry = new THREE.BufferGeometry();
            const arcPositions = new Float32Array(6 * 3);
            arcGeometry.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
            
            const arcMaterial = new THREE.LineBasicMaterial({
                color: 0x00ddff,
                transparent: true,
                opacity: 0.9,
                linewidth: 3
            });
            
            const arc = new THREE.Line(arcGeometry, arcMaterial);
            arc.position.copy(worldPosition);
            this.scene.add(arc);
            
            arcs.push({
                mesh: arc,
                phase: Math.random() * Math.PI * 2,
                speed: 3 + Math.random() * 2
            });
        }
        
        // Animate the arcs
        let arcTime = 0;
        const arcInterval = setInterval(() => {
            arcTime += 16;
            
            arcs.forEach((arc, index) => {
                const positions = arc.mesh.geometry.attributes.position.array;
                const time = arcTime * 0.001 * arc.speed + arc.phase;
                
                for (let j = 0; j < 6; j++) {
                    const t = j / 5;
                    const angle = time + t * Math.PI * 2 + index * Math.PI * 0.67;
                    const radius = CONFIG.BUBBLE_RADIUS * (0.8 + Math.sin(time * 4 + j) * 0.3);
                    
                    // Electrical jitter
                    const jitterX = (Math.random() - 0.5) * 0.3;
                    const jitterY = (Math.random() - 0.5) * 0.3;
                    
                    positions[j * 3] = Math.cos(angle) * radius + jitterX;
                    positions[j * 3 + 1] = Math.sin(angle) * radius + jitterY;
                    positions[j * 3 + 2] = (j - 2.5) * 0.4;
                }
                
                arc.mesh.geometry.attributes.position.needsUpdate = true;
                
                // Flicker opacity
                arc.mesh.material.opacity = 0.5 + Math.random() * 0.5;
            });
            
            // Remove arcs after duration
            if (arcTime > duration) {
                this.cleanupEffect(effectId);
                clearInterval(arcInterval);
            }
        }, 16);
        
        // Store effect for cleanup
        this.activeEffects.set(effectId, { arcs, interval: arcInterval });
        
        console.log(`Created electric arcs effect ${effectId} at`, worldPosition);
        return effectId;
    }
    
    /**
     * Create electric sparks at world position
     * @param {THREE.Vector3} worldPosition - Position to create sparks at
     * @param {string} bubbleId - ID for tracking
     * @param {number} sparkCount - Number of sparks to create
     */
    createElectricSparks(worldPosition, bubbleId, sparkCount = 15) {
        const effectId = `electric_sparks_${bubbleId}_${this.nextEffectId++}`;
        const sparks = [];
        
        for (let i = 0; i < sparkCount; i++) {
            setTimeout(() => {
                const angle = Math.random() * Math.PI * 2;
                const radius = CONFIG.BUBBLE_RADIUS * (0.9 + Math.random() * 0.3);
                const sparkPos = new THREE.Vector3(
                    worldPosition.x + Math.cos(angle) * radius,
                    worldPosition.y + Math.sin(angle) * radius,
                    worldPosition.z + (Math.random() - 0.5) * 0.4
                );
                
                // Create spark geometry
                const sparkGeometry = new THREE.SphereGeometry(0.02, 4, 4);
                const sparkMaterial = new THREE.MeshBasicMaterial({
                    color: Math.random() > 0.5 ? 0x00ddff : 0xffffff,
                    transparent: true,
                    opacity: 0.8
                });
                
                const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
                spark.position.copy(sparkPos);
                this.scene.add(spark);
                sparks.push(spark);
                
                // Animate spark
                const velocity = new THREE.Vector3(
                    Math.cos(angle) * (2 + Math.random() * 4),
                    Math.sin(angle) * (2 + Math.random() * 4),
                    (Math.random() - 0.5) * 3
                );
                
                const sparkInterval = setInterval(() => {
                    // Move spark
                    spark.position.add(velocity.clone().multiplyScalar(0.016));
                    
                    // Add electrical jitter
                    spark.position.x += (Math.random() - 0.5) * 0.01;
                    spark.position.y += (Math.random() - 0.5) * 0.01;
                    
                    // Fade out
                    spark.material.opacity -= 0.02;
                    
                    if (spark.material.opacity <= 0) {
                        this.scene.remove(spark);
                        spark.geometry.dispose();
                        spark.material.dispose();
                        clearInterval(sparkInterval);
                    }
                }, 16);
                
            }, i * 8); // Stagger spark creation
        }
        
        // Store effect for cleanup
        this.activeEffects.set(effectId, { sparks });
        
        console.log(`Created electric sparks effect ${effectId} at`, worldPosition);
        return effectId;
    }
    
    /**
     * Create electric field particles around world position
     * @param {THREE.Vector3} worldPosition - Position to create field at
     * @param {string} bubbleId - ID for tracking
     */
    createElectricField(worldPosition, bubbleId) {
        const effectId = `electric_field_${bubbleId}_${this.nextEffectId++}`;
        const fieldParticles = 10;
        const fieldRadius = CONFIG.BUBBLE_RADIUS * 1.5;
        const particles = [];
        
        for (let i = 0; i < fieldParticles; i++) {
            setTimeout(() => {
                const angle = (Math.PI * 2 * i) / fieldParticles;
                const radius = fieldRadius * (0.8 + Math.random() * 0.4);
                
                // Create field particle
                const particleGeometry = new THREE.SphereGeometry(0.015, 4, 4);
                const particleMaterial = new THREE.MeshBasicMaterial({
                    color: Math.random() > 0.7 ? 0xffffff : 0x00ddff,
                    transparent: true,
                    opacity: 0.8
                });
                
                const particle = new THREE.Mesh(particleGeometry, particleMaterial);
                particle.position.set(
                    worldPosition.x + Math.cos(angle) * radius,
                    worldPosition.y + Math.sin(angle) * radius,
                    worldPosition.z + (Math.random() - 0.5) * 0.5
                );
                this.scene.add(particle);
                particles.push(particle);
                
                // Animate orbital movement
                const particleInterval = setInterval(() => {
                    // Orbit around the world position
                    const dx = particle.position.x - worldPosition.x;
                    const dy = particle.position.y - worldPosition.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 0) {
                        const orbitalSpeed = 8;
                        const newX = particle.position.x + (-dy / distance * orbitalSpeed * 0.016);
                        const newY = particle.position.y + (dx / distance * orbitalSpeed * 0.016);
                        
                        // Add electrical distortion
                        particle.position.x = newX + (Math.random() - 0.5) * 0.05;
                        particle.position.y = newY + (Math.random() - 0.5) * 0.05;
                    }
                    
                    // Fade out
                    particle.material.opacity -= 0.01;
                    
                    if (particle.material.opacity <= 0) {
                        this.scene.remove(particle);
                        particle.geometry.dispose();
                        particle.material.dispose();
                        clearInterval(particleInterval);
                    }
                }, 16);
                
            }, i * 5);
        }
        
        // Store effect for cleanup
        this.activeEffects.set(effectId, { particles });
        
        console.log(`Created electric field effect ${effectId} at`, worldPosition);
        return effectId;
    }
    
    /**
     * Clean up a specific effect
     * @param {string} effectId - ID of effect to clean up
     */
    cleanupEffect(effectId) {
        const effect = this.activeEffects.get(effectId);
        if (!effect) return;
        
        // Clean up arcs
        if (effect.arcs) {
            effect.arcs.forEach(arc => {
                this.scene.remove(arc.mesh);
                arc.mesh.geometry.dispose();
                arc.mesh.material.dispose();
            });
        }
        
        // Clean up sparks
        if (effect.sparks) {
            effect.sparks.forEach(spark => {
                if (spark.parent) {
                    this.scene.remove(spark);
                    spark.geometry.dispose();
                    spark.material.dispose();
                }
            });
        }
        
        // Clean up particles
        if (effect.particles) {
            effect.particles.forEach(particle => {
                if (particle.parent) {
                    this.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();
                }
            });
        }
        
        // Clear interval if exists
        if (effect.interval) {
            clearInterval(effect.interval);
        }
        
        this.activeEffects.delete(effectId);
        console.log(`Cleaned up effect ${effectId}`);
    }
    
    /**
     * Clean up all effects for a specific bubble
     * @param {string} bubbleId - Bubble ID to clean up effects for
     */
    cleanupBubbleEffects(bubbleId) {
        const effectsToCleanup = [];
        
        for (const [effectId, effect] of this.activeEffects) {
            if (effectId.includes(bubbleId)) {
                effectsToCleanup.push(effectId);
            }
        }
        
        effectsToCleanup.forEach(effectId => this.cleanupEffect(effectId));
    }
    
    /**
     * Clean up all active effects
     */
    cleanup() {
        const effectIds = Array.from(this.activeEffects.keys());
        effectIds.forEach(effectId => this.cleanupEffect(effectId));
    }
}