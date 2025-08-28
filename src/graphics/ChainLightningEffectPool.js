import * as THREE from 'three';

/**
 * ChainLightningEffectPool - Manages pooled resources for chain lightning effects
 * Dramatically reduces object creation/destruction overhead
 */
export class ChainLightningEffectPool {
    constructor() {
        // Lightning bolt geometry pool
        this.boltGeometries = [];
        this.availableBolts = [];
        this.activeBolts = new Map();
        
        // Light pool
        this.lights = [];
        this.availableLights = [];
        this.activeLights = new Map();
        
        // Material pool
        this.materials = new Map();
        
        // Geometry templates
        this.geometryTemplates = new Map();
        
        // Pre-generated lightning patterns
        this.lightningPatterns = [];
        
        this.initialize();
    }
    
    initialize() {
        // Pre-create bolt geometries - increased for chain reactions
        const BOLT_POOL_SIZE = 30;
        for (let i = 0; i < BOLT_POOL_SIZE; i++) {
            const geometry = new THREE.BufferGeometry();
            // Pre-allocate vertex buffer for maximum segments
            const maxSegments = 8;
            const positions = new Float32Array(maxSegments * 3);
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setDrawRange(0, 0); // Initially hidden
            
            this.boltGeometries.push(geometry);
            this.availableBolts.push(geometry);
        }
        
        // Pre-create lights - increased pool size for chain reactions
        const LIGHT_POOL_SIZE = 20;
        for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
            const light = new THREE.PointLight(0xffffff, 0, 0);
            light.visible = false;
            this.lights.push(light);
            this.availableLights.push(light);
        }
        
        // Pre-create materials
        this.createMaterials();
        
        // Pre-generate lightning patterns
        this.generateLightningPatterns();
        
        // Create geometry templates
        this.createGeometryTemplates();
    }
    
    createMaterials() {
        // Main bolt material
        this.materials.set('bolt', new THREE.LineBasicMaterial({
            color: 0x00ddff,
            transparent: true,
            opacity: 1,
            linewidth: 3
        }));
        
        // Core bolt material (white center)
        this.materials.set('boltCore', new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            linewidth: 2
        }));
        
        // Glow material
        this.materials.set('boltGlow', new THREE.LineBasicMaterial({
            color: 0x00ddff,
            transparent: true,
            opacity: 0.3,
            linewidth: 6
        }));
        
        // Secondary bolt materials (less intense)
        this.materials.set('boltSecondary', new THREE.LineBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
        }));
        
        // Electric field material
        this.materials.set('electricField', new THREE.MeshBasicMaterial({
            color: 0x00ddff,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        }));
    }
    
    createGeometryTemplates() {
        // Create reusable ring geometry
        const ringGeometry = new THREE.RingGeometry(0.8, 1.2, 16);
        this.geometryTemplates.set('ring', ringGeometry);
        
        // Create reusable sphere geometry for glows
        const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 6);
        this.geometryTemplates.set('sphere', sphereGeometry);
        
        // Create reusable plane for shockwave
        const planeGeometry = new THREE.PlaneGeometry(2, 2);
        this.geometryTemplates.set('plane', planeGeometry);
    }
    
    generateLightningPatterns() {
        // Pre-generate 10 different lightning path patterns
        const PATTERN_COUNT = 10;
        
        for (let p = 0; p < PATTERN_COUNT; p++) {
            const pattern = [];
            const segments = 7;
            
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                
                // Generate offset perpendicular to main direction
                let offset = 0;
                if (i > 0 && i < segments) {
                    // Create natural-looking lightning shape
                    const amplitude = 0.3 * Math.sin(t * Math.PI); // Stronger in middle
                    offset = (Math.random() - 0.5) * amplitude;
                }
                
                pattern.push({
                    t: t,
                    offset: offset,
                    jitter: Math.random() * 0.1 - 0.05
                });
            }
            
            this.lightningPatterns.push(pattern);
        }
    }
    
    /**
     * Acquire a bolt geometry from the pool
     */
    acquireBolt() {
        if (this.availableBolts.length === 0) {
            console.warn('ChainLightningEffectPool: No available bolts, creating new one');
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(8 * 3);
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            this.boltGeometries.push(geometry);
            return geometry;
        }
        
        const bolt = this.availableBolts.pop();
        this.activeBolts.set(bolt, true);
        return bolt;
    }
    
    /**
     * Release a bolt geometry back to the pool
     */
    releaseBolt(bolt) {
        if (!this.activeBolts.has(bolt)) {
            console.warn('ChainLightningEffectPool: Attempting to release unknown bolt');
            return;
        }
        
        this.activeBolts.delete(bolt);
        bolt.setDrawRange(0, 0); // Hide the geometry
        this.availableBolts.push(bolt);
    }
    
    /**
     * Acquire a light from the pool
     */
    acquireLight(color = 0x00ddff, intensity = 10, distance = 5) {
        if (this.availableLights.length === 0) {
            console.warn('ChainLightningEffectPool: No available lights');
            // Return a proper THREE.PointLight that is invisible
            const dummyLight = new THREE.PointLight(color, 0, 0);
            dummyLight.visible = false;
            return dummyLight;
        }
        
        const light = this.availableLights.pop();
        light.color.setHex(color);
        light.intensity = intensity;
        light.distance = distance;
        light.visible = true;
        
        this.activeLights.set(light, true);
        return light;
    }
    
    /**
     * Release a light back to the pool
     */
    releaseLight(light) {
        if (!this.activeLights.has(light)) {
            return;
        }
        
        this.activeLights.delete(light);
        light.visible = false;
        light.intensity = 0;
        this.availableLights.push(light);
    }
    
    /**
     * Get a material from the pool
     */
    getMaterial(type) {
        return this.materials.get(type);
    }
    
    /**
     * Get a geometry template
     */
    getGeometryTemplate(type) {
        return this.geometryTemplates.get(type);
    }
    
    /**
     * Get a random lightning pattern
     */
    getRandomPattern() {
        const index = Math.floor(Math.random() * this.lightningPatterns.length);
        return this.lightningPatterns[index];
    }
    
    /**
     * Update bolt geometry with new path
     */
    updateBoltPath(geometry, startPos, endPos, pattern = null) {
        if (!pattern) {
            pattern = this.getRandomPattern();
        }
        
        const positions = geometry.attributes.position.array;
        const segmentCount = Math.min(pattern.length, positions.length / 3);
        
        // Calculate perpendicular vector for offsets
        const direction = new THREE.Vector3().subVectors(endPos, startPos);
        const perpX = -direction.y;
        const perpY = direction.x;
        const perpLength = Math.sqrt(perpX * perpX + perpY * perpY);
        
        if (perpLength > 0) {
            const normalizedPerpX = perpX / perpLength;
            const normalizedPerpY = perpY / perpLength;
            
            for (let i = 0; i < segmentCount; i++) {
                const point = pattern[i];
                const x = startPos.x + direction.x * point.t + normalizedPerpX * point.offset;
                const y = startPos.y + direction.y * point.t + normalizedPerpY * point.offset;
                const z = startPos.z + direction.z * point.t + 0.5;
                
                positions[i * 3] = x + point.jitter;
                positions[i * 3 + 1] = y + point.jitter;
                positions[i * 3 + 2] = z;
            }
        } else {
            // Straight line if no perpendicular
            for (let i = 0; i < segmentCount; i++) {
                const point = pattern[i];
                positions[i * 3] = startPos.x + direction.x * point.t;
                positions[i * 3 + 1] = startPos.y + direction.y * point.t;
                positions[i * 3 + 2] = startPos.z + direction.z * point.t + 0.5;
            }
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.setDrawRange(0, segmentCount);
        geometry.computeBoundingSphere();
        
        return segmentCount;
    }
    
    /**
     * Reset all active effects (emergency cleanup)
     */
    resetAll() {
        // Return all active bolts to pool
        for (const bolt of this.activeBolts.keys()) {
            this.releaseBolt(bolt);
        }
        
        // Return all active lights to pool
        for (const light of this.activeLights.keys()) {
            this.releaseLight(light);
        }
    }
    
    /**
     * Get pool statistics
     */
    getStats() {
        return {
            bolts: {
                total: this.boltGeometries.length,
                available: this.availableBolts.length,
                active: this.activeBolts.size
            },
            lights: {
                total: this.lights.length,
                available: this.availableLights.length,
                active: this.activeLights.size
            }
        };
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        // Dispose geometries
        for (const geometry of this.boltGeometries) {
            geometry.dispose();
        }
        
        // Dispose lights
        for (const light of this.lights) {
            light.dispose();
        }
        
        // Dispose materials
        for (const material of this.materials.values()) {
            material.dispose();
        }
        
        // Dispose geometry templates
        for (const geometry of this.geometryTemplates.values()) {
            geometry.dispose();
        }
        
        // Clear all arrays and maps
        this.boltGeometries = [];
        this.availableBolts = [];
        this.activeBolts.clear();
        this.lights = [];
        this.availableLights = [];
        this.activeLights.clear();
        this.materials.clear();
        this.geometryTemplates.clear();
        this.lightningPatterns = [];
    }
}

// Singleton instance
let instance = null;

export function getChainLightningEffectPool() {
    if (!instance) {
        instance = new ChainLightningEffectPool();
    }
    return instance;
}