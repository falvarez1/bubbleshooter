import * as THREE from 'three';
import { PARTICLE_CONFIG } from '../core/Config.js';

const DEFAULT_ROCKET_EXHAUST_CONFIG = {
    sparkBaseSize: 0.05,
    sparkTaper: { base: 0.3, tip: 0.1 },
    sparkLength: 4.0,
    sparkSegments: 4,
    opacity: 0.9,
    blending: 'additive',
    depthWrite: false,
    decay: 0.04,
    shrinkRate: 0.97,
    orientToVelocity: true,
    minVelocityForOrientation: 0.1
};

const getRocketExhaustConfig = () => PARTICLE_CONFIG?.rocketExhaust || DEFAULT_ROCKET_EXHAUST_CONFIG;

/**
 * Particle Pool for performance
 * Pre-creates and reuses particle objects to avoid garbage collection
 */
export class ParticlePool {
    constructor(size = 200, postProcessing = null) {
        this.pool = [];
        this.activeParticles = [];
        this.geometryCache = new Map();
        this.materialCache = new Map();
        this.postProcessing = postProcessing;
        this._tempDirection = new THREE.Vector3();
        this._tempLookTarget = new THREE.Vector3();
        this._cachedConfig = null;
        this._cachedMinVelocity = 0;
        this._cachedMinVelocitySq = 0;
        
        // Pre-create particles
        for (let i = 0; i < size; i++) {
            const particle = this.createParticle();
            particle.mesh.visible = false;
            this.pool.push(particle);
        }
    }
    
    _getConfigWithCache() {
        const config = getRocketExhaustConfig();
        const minVelocity = config.minVelocityForOrientation ?? 0;
        
        if (config !== this._cachedConfig || minVelocity !== this._cachedMinVelocity) {
            this._cachedConfig = config;
            this._cachedMinVelocity = minVelocity;
            this._cachedMinVelocitySq = minVelocity * minVelocity;
        }
        
        return this._cachedConfig;
    }
    
    createParticle() {
        // Use shared geometry - create spark-like elongated shape
        const config = this._getConfigWithCache();
        const size = config.sparkBaseSize;
        let geometry = this.geometryCache.get(size);
        if (!geometry) {
            // Create elongated spark geometry instead of sphere
            geometry = new THREE.CylinderGeometry(
                size * config.sparkTaper.base, 
                size * config.sparkTaper.tip, 
                size * config.sparkLength, 
                config.sparkSegments, 
                1
            );
            this.geometryCache.set(size, geometry);
        }
        
        // Create spark-like material for rocket exhaust effect
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: config.opacity,
            blending: config.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
            depthWrite: config.depthWrite,
            side: THREE.DoubleSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        return {
            mesh,
            material,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            life: 1.0,
            decay: 0.02,
            active: false
        };
    }
    
    spawn(x, y, z, color, size, velocity = null, category = 'collisionParticles') {
        let particle = this.pool.pop();
        
        if (!particle) {
            // Pool exhausted, reuse oldest active particle
            if (this.activeParticles.length > 0) {
                particle = this.activeParticles.shift();
                this.reset(particle);
            } else {
                return null; // Cannot spawn
            }
        }
        
        // Initialize particle
        particle.position.set(x, y, z);
        particle.mesh.position.copy(particle.position);
        
        if (velocity) {
            particle.velocity.copy(velocity);
        } else {
            particle.velocity.set(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 5
            );
        }
        
        const config = this._getConfigWithCache();
        const minVelocitySq = this._cachedMinVelocitySq;
        
        particle.life = 1.0;
        particle.decay = config.decay;
        particle.material.color.set(color);
        particle.material.opacity = config.opacity;
        
        // Orient spark along velocity direction for realistic exhaust
        if (config.orientToVelocity && velocity && velocity.lengthSq() > minVelocitySq) {
            this._tempDirection.copy(velocity).normalize();
            this._tempLookTarget.copy(particle.position).add(this._tempDirection);
            particle.mesh.lookAt(this._tempLookTarget);
        }
        
        particle.mesh.scale.setScalar(size / config.sparkBaseSize);
        particle.mesh.visible = true;
        particle.active = true;
        
        // Only register with bloom if not already registered
        if (particle.category !== category) {
            // Remove from old category if exists
            if (particle.category && this.postProcessing && particle.mesh) {
                this.postProcessing.removeBloomObject(particle.mesh, particle.category);
            }
            
            particle.category = category;
            
            // Register with bloom system if available
            if (this.postProcessing && particle.mesh) {
                this.postProcessing.addBloomObject(particle.mesh, category);
            }
        }
        
        this.activeParticles.push(particle);
        return particle;
    }
    
    // Power-based spawning method for enhanced effects
    spawnPower(x, y, z, color, size, velocity = null, power = 0, category = 'collisionParticles') {
        let particle = this.pool.pop();
        
        if (!particle) {
            // Pool exhausted, reuse oldest active particle
            if (this.activeParticles.length > 0) {
                particle = this.activeParticles.shift();
                this.reset(particle);
            } else {
                return null; // Cannot spawn
            }
        }
        
        // Initialize particle with power-based properties
        particle.position.set(x, y, z);
        particle.mesh.position.copy(particle.position);
        
        if (velocity) {
            // Scale velocity by power
            const powerMultiplier = 1 + power * 2; // 1x to 3x velocity
            particle.velocity.set(
                velocity.x * powerMultiplier,
                velocity.y * powerMultiplier,
                velocity.z * powerMultiplier
            );
        } else {
            // Default velocity with power scaling
            const baseSpeed = 10 * (1 + power);
            particle.velocity.set(
                (Math.random() - 0.5) * baseSpeed,
                (Math.random() - 0.5) * baseSpeed,
                (Math.random() - 0.5) * baseSpeed * 0.5
            );
        }
        
        // Power affects life and size
        particle.life = 1.0 + power * 0.5; // Longer lasting for higher power
        particle.decay = 0.02 / (1 + power * 0.5); // Slower decay for higher power
        
        // Power-based color enhancement
        if (power > 0.5) {
            // Mix in hot colors for high power
            const baseColor = new THREE.Color(color);
            const hotness = power * 0.3;
            const hotColor = new THREE.Color(
                Math.min(1, baseColor.r + hotness),
                Math.min(1, baseColor.g + hotness * 0.5),
                Math.max(0, baseColor.b - hotness * 0.5)
            );
            particle.material.color.copy(hotColor);
        } else {
            particle.material.color.set(color);
        }
        
        const config = this._getConfigWithCache();
        const minVelocitySq = this._cachedMinVelocitySq;
        
        // Power-based spark intensity
        const sparkIntensity = 0.7 + power * 0.3; // Brighter sparks for more power
        particle.material.opacity = sparkIntensity;
        
        // Orient spark along velocity direction for realistic exhaust
        if (velocity) {
            const speedSq = velocity.lengthSq();
            if (speedSq > minVelocitySq) {
                this._tempDirection.copy(velocity).normalize();
                this._tempLookTarget.copy(particle.position).add(this._tempDirection);
                particle.mesh.lookAt(this._tempLookTarget);
            }
        }
        
        // Power affects size - sparks get longer and brighter with more power
        const powerSizeMultiplier = 1 + power * 0.8; // Up to 1.8x size for dramatic effect
        particle.mesh.scale.setScalar((size / config.sparkBaseSize) * powerSizeMultiplier);
        particle.mesh.visible = true;
        particle.active = true;
        
        // Only register with bloom if not already registered
        if (particle.category !== category) {
            // Remove from old category if exists
            if (particle.category && this.postProcessing && particle.mesh) {
                this.postProcessing.removeBloomObject(particle.mesh, particle.category);
            }
            
            particle.category = category;
            
            // Register with bloom system if available
            if (this.postProcessing && particle.mesh) {
                this.postProcessing.addBloomObject(particle.mesh, category);
            }
        }
        
        this.activeParticles.push(particle);
        return particle;
    }
    
    update(deltaTime) {
        const config = this._getConfigWithCache();
        const minVelocitySq = this._cachedMinVelocitySq;
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const particle = this.activeParticles[i];
            
            // Update physics
            particle.velocity.y -= 9.8 * deltaTime;
            particle.position.x += particle.velocity.x * deltaTime;
            particle.position.y += particle.velocity.y * deltaTime;
            particle.position.z += particle.velocity.z * deltaTime;
            particle.mesh.position.copy(particle.position);
            
            // Update life
            particle.life -= particle.decay;
            
            // Spark-like fading with intensity
            particle.material.opacity = config.opacity * particle.life;
            
            // Maintain spark orientation along velocity
            if (config.orientToVelocity && particle.velocity) {
                const speedSq = particle.velocity.lengthSq();
                if (speedSq > minVelocitySq) {
                    this._tempDirection.copy(particle.velocity).normalize();
                    this._tempLookTarget.copy(particle.position).add(this._tempDirection);
                    particle.mesh.lookAt(this._tempLookTarget);
                }
            }
            
            // Sparks shrink as they fade
            particle.mesh.scale.multiplyScalar(config.shrinkRate);
            
            // Return to pool if dead
            if (particle.life <= 0) {
                this.reset(particle);
                this.activeParticles.splice(i, 1);
                this.pool.push(particle);
            }
        }
    }
    
    reset(particle) {
        particle.mesh.visible = false;
        particle.active = false;
        particle.life = 0;
        
        // Remove from bloom system if it was registered
        if (this.postProcessing && particle.mesh && particle.category) {
            try {
                this.postProcessing.removeBloomObject(particle.mesh, particle.category);
            } catch (e) {
                console.warn('Error removing particle from bloom:', e);
            }
        }
        
        // Clear the category to prevent double-removal
        particle.category = null;
    }
    
    clear() {
        while (this.activeParticles.length > 0) {
            const particle = this.activeParticles.pop();
            this.reset(particle);
            this.pool.push(particle);
        }
    }
    
    // Add all particle meshes to scene
    addToScene(scene) {
        for (const particle of this.pool) {
            scene.add(particle.mesh);
        }
        for (const particle of this.activeParticles) {
            scene.add(particle.mesh);
        }
    }
    
    // Remove all particle meshes from scene
    removeFromScene(scene) {
        for (const particle of this.pool) {
            scene.remove(particle.mesh);
        }
        for (const particle of this.activeParticles) {
            scene.remove(particle.mesh);
        }
    }
}

/**
 * Legacy Particle class wrapper for compatibility
 * Wraps the particle pool for backward compatibility
 */
export class Particle {
    constructor(x, y, z, color, size, gameState) {
        // Use the global particle pool from gameState
        this._pooledParticle = gameState.particlePool.spawn(x, y, z, color, size);
        if (this._pooledParticle) {
            this.position = this._pooledParticle.position;
            this.velocity = this._pooledParticle.velocity;
            this.mesh = this._pooledParticle.mesh;
        }
    }
    
    update(deltaTime) {
        // Handled by pool
        return this._pooledParticle && this._pooledParticle.active;
    }
    
    destroy() {
        // Handled by pool
    }
}

/**
 * Particle Factory
 * Helper functions for creating specific particle effects
 */
export class ParticleFactory {
    static createExplosion(position, color, count, pool) {
        if (!pool) {
            console.warn('Particle pool not available for createExplosion');
            return [];
        }
        
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 8 + Math.random() * 4;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                (Math.random() - 0.5) * 4
            );
            
            const particle = pool.spawn(
                position.x,
                position.y,
                position.z,
                color,
                0.2,
                velocity,
                'explosionParticles'
            );
            
            if (particle) {
                particles.push(particle);
            }
        }
        return particles;
    }
    
    static createSpiral(position, color, count, pool) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const radius = CONFIG.BUBBLE_RADIUS;
            const velocity = new THREE.Vector3(
                Math.cos(angle + Math.PI / 2) * 3,
                Math.sin(angle + Math.PI / 2) * 3,
                2
            );
            
            const particle = pool.spawn(
                position.x + Math.cos(angle) * radius,
                position.y + Math.sin(angle) * radius,
                position.z,
                color,
                0.1,
                velocity
            );
            
            if (particle) {
                particle.decay = 0.04;
                particles.push(particle);
            }
        }
        return particles;
    }
    
    static createBurst(position, color, count, pool) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const particle = pool.spawn(
                position.x,
                position.y,
                position.z,
                color,
                0.15,
                null,
                'collisionParticles'
            );
            
            if (particle) {
                particle.decay = 0.05;
                particles.push(particle);
            }
        }
        return particles;
    }
    
    static createLightningBurst(position, color, count, pool) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 5 + Math.random() * 5;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                Math.random() * 2
            );
            
            const particle = pool.spawn(
                position.x,
                position.y,
                position.z + 0.5,
                color,
                0.2,
                velocity,
                'powerUpEffects'
            );
            
            if (particle) {
                particle.decay = 0.03;
                particles.push(particle);
            }
        }
        return particles;
    }
    
    static createElectricDestruction(position, color, count, pool) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                (Math.random() - 0.5) * 3
            );
            
            const particleColor = i % 3 === 0 ? 0xffffff : color;
            const particle = pool.spawn(
                position.x,
                position.y,
                position.z,
                particleColor,
                0.15,
                velocity,
                'powerUpEffects'
            );
            
            if (particle) {
                particle.decay = 0.04;
                particles.push(particle);
            }
        }
        return particles;
    }
    
    static createColorWave(position, color, count, pool) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 8 + Math.random() * 4;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                Math.random() * 2
            );
            
            const particle = pool.spawn(
                position.x,
                position.y,
                position.z + 0.5,
                color,
                0.2,
                velocity,
                'powerUpEffects'
            );
            
            if (particle) {
                particle.decay = 0.025; // Slightly faster decay
                particles.push(particle);
            }
        }
        return particles;
    }
    
    static createColorSpiral(position, color, count, pool) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const radius = 0.5; // CONFIG.BUBBLE_RADIUS
            const velocity = new THREE.Vector3(
                Math.cos(angle + Math.PI / 2) * 3,
                Math.sin(angle + Math.PI / 2) * 3,
                2
            );
            
            const particle = pool.spawn(
                position.x + Math.cos(angle) * radius,
                position.y + Math.sin(angle) * radius,
                position.z,
                color,
                0.1,
                velocity,
                'powerUpEffects'
            );
            
            if (particle) {
                particle.decay = 0.04; // Faster decay
                particles.push(particle);
            }
        }
        return particles;
    }
    
    static createColorTransform(position, oldColor, newColor, count, pool) {
        const particles = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                (Math.random() - 0.5) * 2
            );
            
            const particleColor = i < count / 2 ? oldColor : newColor;
            const particle = pool.spawn(
                position.x,
                position.y,
                position.z,
                particleColor,
                0.15,
                velocity,
                'powerUpEffects'
            );
            
            if (particle) {
                particle.decay = 0.05; // Faster decay
                particles.push(particle);
            }
        }
        return particles;
    }
}
