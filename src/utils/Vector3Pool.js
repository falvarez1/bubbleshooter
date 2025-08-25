import * as THREE from 'three';

/**
 * Object pool for THREE.Vector3 to reduce garbage collection pressure
 * Reuses Vector3 instances instead of creating new ones
 */
export class Vector3Pool {
    static pool = [];
    static maxSize = 200; // Increased pool size for heavy usage
    static inUse = new Set(); // Track vectors in use for debugging
    
    /**
     * Get a Vector3 from the pool or create a new one if pool is empty
     * @returns {THREE.Vector3} A Vector3 instance (may be reused)
     */
    static get() {
        let vector = this.pool.pop();
        if (!vector) {
            vector = new THREE.Vector3();
        }
        this.inUse.add(vector);
        return vector;
    }
    
    /**
     * Return a Vector3 to the pool for reuse
     * @param {THREE.Vector3} vector - The vector to return to the pool
     */
    static release(vector) {
        if (!vector) return;
        
        // Only return to pool if not already there and pool isn't full
        if (this.inUse.has(vector) && this.pool.length < this.maxSize) {
            vector.set(0, 0, 0); // Reset to prevent data leakage
            this.pool.push(vector);
            this.inUse.delete(vector);
        }
    }
    
    /**
     * Get a temporary vector, copy from source, and auto-release after use
     * @param {THREE.Vector3} source - Source vector to copy from
     * @returns {THREE.Vector3} Temporary vector that should be released after use
     */
    static getTempFrom(source) {
        const temp = this.get();
        if (source) {
            temp.copy(source);
        }
        return temp;
    }
    
    /**
     * Clear the pool (useful for cleanup)
     */
    static clear() {
        this.pool.length = 0;
        this.inUse.clear();
    }
    
    /**
     * Get pool statistics for debugging
     * @returns {Object} Pool statistics
     */
    static getStats() {
        return {
            poolSize: this.pool.length,
            inUse: this.inUse.size,
            maxSize: this.maxSize
        };
    }
}

// Pre-warm the pool with some vectors
for (let i = 0; i < 50; i++) {
    Vector3Pool.pool.push(new THREE.Vector3());
}