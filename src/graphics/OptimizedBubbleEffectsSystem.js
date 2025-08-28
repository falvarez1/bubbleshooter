import * * THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { getChainLightningEffectPool } from './ChainLightningEffectPool.js';

/**
 * Optimized Bubble Effects System
 * Dramatically reduces resource usage for electric effects
 */
export class OptimizedBubbleEffectsSystem {
    constructor(scene) {
        this.scene = scene;
        this.effectPool = getChainLightningEffectPool();
        this.activeEffects = new Map();
        this.nextEffectId = 0;
        
        // Single update loop for all effects
        this.effectUpdates = [];
        this.isUpdating = false;
        
        // Performance settings
        this.maxConcurrentEffects = 5;
        this.qualityLevel = 'high';
        
        // Shared geometries
        this.sharedGeometries = {
            spark: new THREE.SphereGeometry(0.02, 4, 4),
            particle: new THREE.SphereGeometry(0.015, 4, 4)
        };
        
        // Shared materials pool
        this.materialPool = [];
        this.initializeMaterialPool();
    }
    
    /**
     * Initialize reusable materials
     */
    initializeMaterialPool() {
        // Create a pool of reusable materials
        for (let i = 0; i < 10; i++) {
            this.materialPool.push({
                electric: new THREE.MeshBasicMaterial({
                    color: 0x00ddff,
                    transparent: true,
                    opacity: 0.8
                }),
                white: new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.8
                }),
                inUse: false
            });
        }
    }
    
    /**
     * Get available material from pool
     */
    getMaterial(type = 'electric') {
        const available = this.materialPool.find(m => !m.inUse);
        if (available) {
            available.inUse = true;
            return type === 'white' ? available.white : available.electric;
        }
        
        // Fallback: create new material if pool exhausted
        return new THREE.MeshBasicMaterial({
            color: type === 'white' ? 0xffffff : 0x00ddff,
            transparent: true,
            opacity: 0.8
        });
    }
    
    /**
     * Release material back to pool
     */
    releaseMaterial(material) {
        const poolItem = this.materialPool.find(m => 
            m.electric === material || m.white === material
        );
        if (poolItem) {
            poolItem.inUse = false;
            // Reset material properties
            material.opacity = 0.8;
        }
    }
    
    /**
     * Optimized electric arcs using pooled resources
     */
    createElectricArcs(worldPosition, bubbleId, duration = 400) {
        // Limit concurrent effects
        if (this.activeEffects.size >= this.maxConcurrentEffects) {
            console.warn('Max concurrent effects reached, skipping electric arcs');
            return null;
        }
        
        const effectId = `electric_arcs_${bubbleId}_${this.nextEffectId++}`;
        
        // Use simplified arc effect for lower quality
        if (this.qualityLevel === 'low') {
            return this.createSimplifiedElectricEffect(worldPosition, effectId, duration);
        }
        
        // Use pooled bolt geometries
        const arcCount = this.qualityLevel === 'high' ? 3 : 2;
        const arcs = [];
        
        for (let i = 0; i < arcCount; i++) {
            const boltGeometry = this.effectPool.acquireBolt();
            const material = this.effectPool.getMaterial('bolt');
            
            const arc = new THREE.Line(boltGeometry, material);
            arc.position.copy(worldPosition);
            this.scene.add(arc);
            
            arcs.push({
                mesh: arc,
                geometry: boltGeometry,
                phase: Math.random() * Math.PI * 2,
                speed: 3 + Math.random() * 2,
                age: 0
            });
        }
        
        // Add to unified update loop
        const effect = {
            id: effectId,
            type: 'arcs',
            arcs: arcs,
            position: worldPosition.clone(),
            duration: duration,
            age: 0,
            update: (deltaTime) => this.updateArcs(effect, deltaTime)
        };
        
        this.activeEffects.set(effectId, effect);
        this.effectUpdates.push(effect);
        
        // Start update loop if needed
        this.startUpdateLoop();
        
        return effectId;
    }
    
    /**
     * Update arc effect
     */
    updateArcs(effect, deltaTime) {
        effect.age += deltaTime * 1000;
        
        if (effect.age >= effect.duration) {
            this.cleanupEffect(effect.id);
            return false;
        }
        
        const time = effect.age * 0.001;
        
        effect.arcs.forEach((arc, index) => {
            // Update arc path with simpler calculation
            const positions = arc.geometry.attributes.position.array;
            const segments = 6;
            
            for (let j = 0; j < segments; j++) {
                const t = j / (segments - 1);
                const angle = time * arc.speed + t * Math.PI * 2 + index * Math.PI * 0.67;
                const radius = CONFIG.BUBBLE_RADIUS * (0.8 + Math.sin(time * 4) * 0.2);
                
                positions[j * 3] = Math.cos(angle) * radius;
                positions[j * 3 + 1] = Math.sin(angle) * radius;
                positions[j * 3 + 2] = (j - 2.5) * 0.3;
            }
            
            arc.geometry.attributes.position.needsUpdate = true;
            arc.geometry.setDrawRange(0, segments);
            
            // Simple flicker
            arc.mesh.material.opacity = 0.5 + (Math.random() > 0.7 ? 0.5 : 0);
        });
        
        return true;
    }
    
    /**
     * Simplified electric effect for low-end devices
     */
    createSimplifiedElectricEffect(worldPosition, effectId, duration) {
        // Just create a glowing sphere that pulses
        const glowGeometry = new THREE.SphereGeometry(CONFIG.BUBBLE_RADIUS * 1.2, 8, 6);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ddff,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(worldPosition);
        this.scene.add(glow);
        
        const effect = {
            id: effectId,
            type: 'simple',
            mesh: glow,
            duration: duration,
            age: 0,
            update: (deltaTime) => {
                effect.age += deltaTime * 1000;
                
                if (effect.age >= effect.duration) {
                    this.scene.remove(glow);
                    glowGeometry.dispose();
                    glowMaterial.dispose();
                    this.cleanupEffect(effectId);
                    return false;
                }
                
                // Pulse effect
                const pulse = 0.3 + Math.sin(effect.age * 0.01) * 0.2;
                glow.material.opacity = pulse;
                glow.scale.setScalar(1 + Math.sin(effect.age * 0.005) * 0.1);
                
                return true;
            }
        };
        
        this.activeEffects.set(effectId, effect);
        this.effectUpdates.push(effect);
        this.startUpdateLoop();
        
        return effectId;
    }
    
    /**
     * Optimized electric sparks using GPU particles if available
     */
    createElectricSparks(worldPosition, bubbleId, sparkCount = 15) {
        // Use GPU particles if available
        if (window.game && window.game.particlePool) {
            const adjustedCount = this.qualityLevel === 'high' ? sparkCount : Math.floor(sparkCount / 2);
            
            for (let i = 0; i < adjustedCount; i++) {
                const angle = (Math.PI * 2 * i) / adjustedCount;
                const speed = 3 + Math.random() * 3;
                
                const velocity = new THREE.Vector3(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    (Math.random() - 0.5) * 2
                );
                
                window.game.particlePool.spawn(
                    worldPosition.x,
                    worldPosition.y,
                    worldPosition.z,
                    Math.random() > 0.5 ? 0x00ddff : 0xffffff,
                    0.08,
                    velocity
                );
            }
            
            return `sparks_gpu_${bubbleId}`;
        }
        
        // Fallback to CPU sparks (reduced count)
        return this.createCPUSparks(worldPosition, bubbleId, Math.floor(sparkCount / 3));
    }
    
    /**
     * CPU-based sparks (fallback, optimized)
     */
    createCPUSparks(worldPosition, bubbleId, sparkCount) {
        const effectId = `electric_sparks_${bubbleId}_${this.nextEffectId++}`;
        const sparks = [];
        
        // Create all sparks at once (no setTimeout)
        for (let i = 0; i < sparkCount; i++) {
            const angle = (Math.PI * 2 * i) / sparkCount;
            const radius = CONFIG.BUBBLE_RADIUS * (0.9 + Math.random() * 0.3);
            
            const spark = new THREE.Mesh(
                this.sharedGeometries.spark,
                this.getMaterial(Math.random() > 0.5 ? 'white' : 'electric')
            );
            
            spark.position.set(
                worldPosition.x + Math.cos(angle) * radius,
                worldPosition.y + Math.sin(angle) * radius,
                worldPosition.z
            );
            
            spark.userData = {
                velocity: new THREE.Vector3(
                    Math.cos(angle) * 3,
                    Math.sin(angle) * 3,
                    (Math.random() - 0.5) * 2
                ),
                age: 0,
                lifetime: 0.3 + Math.random() * 0.2
            };
            
            this.scene.add(spark);
            sparks.push(spark);
        }
        
        const effect = {
            id: effectId,
            type: 'sparks',
            sparks: sparks,
            update: (deltaTime) => this.updateSparks(effect, deltaTime)
        };
        
        this.activeEffects.set(effectId, effect);
        this.effectUpdates.push(effect);
        this.startUpdateLoop();
        
        return effectId;
    }
    
    /**
     * Update sparks
     */
    updateSparks(effect, deltaTime) {
        let allExpired = true;
        
        effect.sparks.forEach(spark => {
            if (!spark.userData) return;
            
            spark.userData.age += deltaTime;
            
            if (spark.userData.age < spark.userData.lifetime) {
                allExpired = false;
                
                // Move spark
                spark.position.add(
                    spark.userData.velocity.clone().multiplyScalar(deltaTime)
                );
                
                // Fade out
                const progress = spark.userData.age / spark.userData.lifetime;
                spark.material.opacity = (1 - progress) * 0.8;
            } else if (spark.visible) {
                spark.visible = false;
            }
        });
        
        if (allExpired) {
            this.cleanupSparks(effect);
            return false;
        }
        
        return true;
    }
    
    /**
     * Cleanup sparks effect
     */
    cleanupSparks(effect) {
        effect.sparks.forEach(spark => {
            this.scene.remove(spark);
            this.releaseMaterial(spark.material);
        });
        this.cleanupEffect(effect.id);
    }
    
    /**
     * Optimized electric field
     */
    createElectricField(worldPosition, bubbleId) {
        // For low quality, skip this effect
        if (this.qualityLevel === 'low') {
            return null;
        }
        
        // Use shader-based glow instead of particles
        return this.createSimplifiedElectricEffect(
            worldPosition,
            `field_${bubbleId}_${this.nextEffectId++}`,
            500
        );
    }
    
    /**
     * Start unified update loop
     */
    startUpdateLoop() {
        if (!this.isUpdating && this.effectUpdates.length > 0) {
            this.isUpdating = true;
        }
    }
    
    /**
     * Main update method - called every frame
     */
    update(deltaTime) {
        if (!this.isUpdating) return;
        
        // Update all effects
        this.effectUpdates = this.effectUpdates.filter(effect => {
            return effect.update(deltaTime);
        });
        
        // Stop updating if no effects
        if (this.effectUpdates.length === 0) {
            this.isUpdating = false;
        }
    }
    
    /**
     * Cleanup specific effect
     */
    cleanupEffect(effectId) {
        const effect = this.activeEffects.get(effectId);
        if (!effect) return;
        
        // Clean up based on effect type
        if (effect.type === 'arcs' && effect.arcs) {
            effect.arcs.forEach(arc => {
                this.scene.remove(arc.mesh);
                this.effectPool.releaseBolt(arc.geometry);
            });
        } else if (effect.type === 'simple' && effect.mesh) {
            this.scene.remove(effect.mesh);
            effect.mesh.geometry.dispose();
            effect.mesh.material.dispose();
        }
        
        // Remove from tracking
        this.activeEffects.delete(effectId);
        const index = this.effectUpdates.findIndex(e => e.id === effectId);
        if (index > -1) {
            this.effectUpdates.splice(index, 1);
        }
    }
    
    /**
     * Cleanup all effects for a bubble
     */
    cleanupBubbleEffects(bubbleId) {
        const effectsToClean = [];
        
        this.activeEffects.forEach((effect, id) => {
            if (id.includes(bubbleId)) {
                effectsToClean.push(id);
            }
        });
        
        effectsToClean.forEach(id => this.cleanupEffect(id));
    }
    
    /**
     * Set quality level
     */
    setQuality(level) {
        this.qualityLevel = level;
        this.maxConcurrentEffects = level === 'high' ? 5 : level === 'medium' ? 3 : 2;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        return {
            activeEffects: this.activeEffects.size,
            updateQueue: this.effectUpdates.length,
            quality: this.qualityLevel,
            poolStats: this.effectPool.getStats()
        };
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        // Clean all active effects
        this.activeEffects.forEach((effect, id) => {
            this.cleanupEffect(id);
        });
        
        // Dispose shared geometries
        Object.values(this.sharedGeometries).forEach(geometry => {
            geometry.dispose();
        });
        
        // Dispose material pool
        this.materialPool.forEach(item => {
            item.electric.dispose();
            item.white.dispose();
        });
        
        this.activeEffects.clear();
        this.effectUpdates = [];
    }
}

// Singleton instance
let instance = null;

export function getOptimizedBubbleEffectsSystem(scene) {
    if (!instance) {
        instance = new OptimizedBubbleEffectsSystem(scene);
    }
    return instance;
}