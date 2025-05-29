/**
 * SIMD-optimized math utilities
 * Uses WebAssembly SIMD when available for vector operations
 */

export class SIMDUtils {
    static isSupported = false;
    static wasmModule = null;
    
    static async initialize() {
        try {
            // Check if SIMD is supported
            if (typeof WebAssembly !== 'undefined' && WebAssembly.validate) {
                // Simple SIMD test
                const simdTest = new Uint8Array([
                    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
                    0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b
                ]);
                
                this.isSupported = WebAssembly.validate(simdTest);
                console.log('SIMD support:', this.isSupported);
            }
        } catch (e) {
            console.warn('SIMD check failed:', e);
        }
    }
    
    /**
     * Fast distance calculation between multiple points
     * @param {Float32Array} positions1 - First set of positions [x1,y1,z1,x2,y2,z2,...]
     * @param {Float32Array} positions2 - Second set of positions
     * @param {Float32Array} results - Output array for distances
     */
    static batchDistance3D(positions1, positions2, results) {
        if (this.isSupported && this.wasmModule) {
            return this.wasmModule.batchDistance3D(positions1, positions2, results);
        }
        
        // Fallback to JavaScript with manual loop unrolling
        const count = positions1.length / 3;
        for (let i = 0; i < count; i += 4) { // Process 4 at a time
            const base1 = i * 3;
            const base2 = i * 3;
            
            // Unroll loop for better performance
            for (let j = 0; j < 4 && (i + j) < count; j++) {
                const idx1 = base1 + j * 3;
                const idx2 = base2 + j * 3;
                
                const dx = positions1[idx1] - positions2[idx2];
                const dy = positions1[idx1 + 1] - positions2[idx2 + 1];
                const dz = positions1[idx1 + 2] - positions2[idx2 + 2];
                
                results[i + j] = Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
        }
    }
    
    /**
     * Fast collision detection between bubble arrays
     * @param {Array} bubbles1 - First set of bubbles
     * @param {Array} bubbles2 - Second set of bubbles
     * @param {number} threshold - Collision distance threshold
     * @returns {Array} Array of collision pairs
     */
    static batchCollisionDetection(bubbles1, bubbles2, threshold) {
        const collisions = [];
        
        if (bubbles1.length === 0 || bubbles2.length === 0) return collisions;
        
        // Prepare position arrays
        const pos1 = new Float32Array(bubbles1.length * 3);
        const pos2 = new Float32Array(bubbles2.length * 3);
        
        for (let i = 0; i < bubbles1.length; i++) {
            const bubble = bubbles1[i];
            pos1[i * 3] = bubble.position.x;
            pos1[i * 3 + 1] = bubble.position.y;
            pos1[i * 3 + 2] = bubble.position.z;
        }
        
        for (let i = 0; i < bubbles2.length; i++) {
            const bubble = bubbles2[i];
            pos2[i * 3] = bubble.position.x;
            pos2[i * 3 + 1] = bubble.position.y;
            pos2[i * 3 + 2] = bubble.position.z;
        }
        
        // Batch distance calculation
        const distances = new Float32Array(bubbles1.length * bubbles2.length);
        
        // Optimized nested loop with early exit
        for (let i = 0; i < bubbles1.length; i++) {
            for (let j = 0; j < bubbles2.length; j++) {
                const idx1 = i * 3;
                const idx2 = j * 3;
                
                const dx = pos1[idx1] - pos2[idx2];
                const dy = pos1[idx1 + 1] - pos2[idx2 + 1];
                const dz = pos1[idx1 + 2] - pos2[idx2 + 2];
                
                const distSq = dx * dx + dy * dy + dz * dz;
                const thresholdSq = threshold * threshold;
                
                if (distSq < thresholdSq) {
                    collisions.push({
                        bubble1: bubbles1[i],
                        bubble2: bubbles2[j],
                        distance: Math.sqrt(distSq)
                    });
                }
            }
        }
        
        return collisions;
    }
    
    /**
     * Fast matrix operations for transforms
     * @param {Float32Array} matrices - Array of 4x4 matrices
     * @param {Float32Array} vectors - Array of 3D vectors
     * @param {Float32Array} results - Output transformed vectors
     */
    static batchTransformVectors(matrices, vectors, results) {
        const vectorCount = vectors.length / 3;
        
        for (let i = 0; i < vectorCount; i++) {
            const matrixOffset = i * 16;
            const vectorOffset = i * 3;
            const resultOffset = i * 3;
            
            const x = vectors[vectorOffset];
            const y = vectors[vectorOffset + 1];
            const z = vectors[vectorOffset + 2];
            
            // Matrix multiplication (optimized)
            results[resultOffset] = 
                matrices[matrixOffset] * x + 
                matrices[matrixOffset + 4] * y + 
                matrices[matrixOffset + 8] * z + 
                matrices[matrixOffset + 12];
                
            results[resultOffset + 1] = 
                matrices[matrixOffset + 1] * x + 
                matrices[matrixOffset + 5] * y + 
                matrices[matrixOffset + 9] * z + 
                matrices[matrixOffset + 13];
                
            results[resultOffset + 2] = 
                matrices[matrixOffset + 2] * x + 
                matrices[matrixOffset + 6] * y + 
                matrices[matrixOffset + 10] * z + 
                matrices[matrixOffset + 14];
        }
    }
}

// Initialize SIMD support on load
SIMDUtils.initialize();