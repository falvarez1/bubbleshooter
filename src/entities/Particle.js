import * as THREE from 'three';
import { PARTICLE_CONFIG } from '../core/Config.js';

/**
 * Particle Pool for performance
 * Pre-creates and reuses particle objects to avoid garbage collection
 */
export class ParticlePool {
    constructor(size = 200) {
        this.pool = [];
        this.activeParticles = [];
        this.geometryCache = new Map();
        this.materialCache = new Map();
        
        // Pre-create particles
        for (let i = 0; i < size; i++) {
            const particle = this.createParticle();
            particle.mesh.visible = false;
            this.pool.push(particle);
        }
    }
    
    createParticle() {
        // Use shared geometry
        const size = 0.15;
        let geometry = this.geometryCache.get(size);
        if (!geometry) {
            const segments = PARTICLE_CONFIG.quality.particleSegments;
            geometry = new THREE.SphereGeometry(size, segments, segments);
            this.geometryCache.set(size, geometry);
        }
        
        // Create unique material for each particle
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0
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
    
    spawn(x, y, z, color, size, velocity = null) {
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
        
        particle.life = 1.0;
        particle.decay = 0.02;
        particle.material.color.set(color);
        particle.material.opacity = 1.0;
        particle.mesh.scale.setScalar(size / 0.15); // Scale relative to base size
        particle.mesh.visible = true;
        particle.active = true;
        
        this.activeParticles.push(particle);
        return particle;
    }
    
    update(deltaTime) {
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
            particle.material.opacity = particle.life;
            particle.mesh.scale.multiplyScalar(0.98); // Gradual shrink
            
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
        if (gameState && gameState.particlePool) {
            this._pooledParticle = gameState.particlePool.spawn(x, y, z, color, size);
            if (this._pooledParticle) {
                this.position = this._pooledParticle.position;
                this.velocity = this._pooledParticle.velocity;
                this.mesh = this._pooledParticle.mesh;
            }
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
                velocity
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
                0.15
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
                velocity
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
                velocity
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
                velocity
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
                velocity
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
                velocity
            );
            
            if (particle) {
                particle.decay = 0.05; // Faster decay
                particles.push(particle);
            }
        }
        return particles;
    }
}