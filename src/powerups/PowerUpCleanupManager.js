/**
 * PowerUp Cleanup Manager
 * Manages timeouts and intervals for power-ups to prevent memory leaks
 */
export class PowerUpCleanupManager {
    constructor() {
        this.activeTimeouts = new Map(); // powerUpId -> Set of timeout IDs
        this.activeIntervals = new Map(); // powerUpId -> Set of interval IDs
        this.activeLights = new Map(); // powerUpId -> Set of light objects
        this.activeMeshes = new Map(); // powerUpId -> Set of mesh objects
    }
    
    /**
     * Register a timeout for a power-up
     * @param {string} powerUpId - Unique identifier for the power-up instance
     * @param {function} callback - The callback to execute
     * @param {number} delay - Delay in milliseconds
     * @returns {number} The timeout ID
     */
    setTimeout(powerUpId, callback, delay) {
        const timeoutId = setTimeout(() => {
            callback();
            this.removeTimeout(powerUpId, timeoutId);
        }, delay);
        
        if (!this.activeTimeouts.has(powerUpId)) {
            this.activeTimeouts.set(powerUpId, new Set());
        }
        this.activeTimeouts.get(powerUpId).add(timeoutId);
        
        return timeoutId;
    }
    
    /**
     * Register an interval for a power-up
     * @param {string} powerUpId - Unique identifier for the power-up instance
     * @param {function} callback - The callback to execute
     * @param {number} interval - Interval in milliseconds
     * @returns {number} The interval ID
     */
    setInterval(powerUpId, callback, interval) {
        const intervalId = setInterval(callback, interval);
        
        if (!this.activeIntervals.has(powerUpId)) {
            this.activeIntervals.set(powerUpId, new Set());
        }
        this.activeIntervals.get(powerUpId).add(intervalId);
        
        return intervalId;
    }
    
    /**
     * Register a light for cleanup
     * @param {string} powerUpId - Unique identifier for the power-up instance
     * @param {THREE.Light} light - The light object
     * @param {THREE.Scene} scene - The scene containing the light
     */
    registerLight(powerUpId, light, scene) {
        if (!this.activeLights.has(powerUpId)) {
            this.activeLights.set(powerUpId, new Set());
        }
        this.activeLights.get(powerUpId).add({ light, scene });
    }
    
    /**
     * Register a mesh for cleanup
     * @param {string} powerUpId - Unique identifier for the power-up instance
     * @param {THREE.Mesh} mesh - The mesh object
     * @param {THREE.Scene} scene - The scene containing the mesh
     */
    registerMesh(powerUpId, mesh, scene) {
        if (!this.activeMeshes.has(powerUpId)) {
            this.activeMeshes.set(powerUpId, new Set());
        }
        this.activeMeshes.get(powerUpId).add({ mesh, scene });
    }
    
    /**
     * Remove a specific timeout
     * @param {string} powerUpId - Unique identifier for the power-up instance
     * @param {number} timeoutId - The timeout ID to remove
     */
    removeTimeout(powerUpId, timeoutId) {
        if (this.activeTimeouts.has(powerUpId)) {
            this.activeTimeouts.get(powerUpId).delete(timeoutId);
            if (this.activeTimeouts.get(powerUpId).size === 0) {
                this.activeTimeouts.delete(powerUpId);
            }
        }
    }
    
    /**
     * Remove a specific interval
     * @param {string} powerUpId - Unique identifier for the power-up instance
     * @param {number} intervalId - The interval ID to remove
     */
    removeInterval(powerUpId, intervalId) {
        clearInterval(intervalId);
        if (this.activeIntervals.has(powerUpId)) {
            this.activeIntervals.get(powerUpId).delete(intervalId);
            if (this.activeIntervals.get(powerUpId).size === 0) {
                this.activeIntervals.delete(powerUpId);
            }
        }
    }
    
    /**
     * Clean up all resources for a specific power-up
     * @param {string} powerUpId - Unique identifier for the power-up instance
     */
    cleanup(powerUpId) {
        // Clear all timeouts
        if (this.activeTimeouts.has(powerUpId)) {
            for (const timeoutId of this.activeTimeouts.get(powerUpId)) {
                clearTimeout(timeoutId);
            }
            this.activeTimeouts.delete(powerUpId);
        }
        
        // Clear all intervals
        if (this.activeIntervals.has(powerUpId)) {
            for (const intervalId of this.activeIntervals.get(powerUpId)) {
                clearInterval(intervalId);
            }
            this.activeIntervals.delete(powerUpId);
        }
        
        // Remove and dispose all lights
        if (this.activeLights.has(powerUpId)) {
            for (const { light, scene } of this.activeLights.get(powerUpId)) {
                if (light.parent) {
                    scene.remove(light);
                }
                light.dispose?.();
            }
            this.activeLights.delete(powerUpId);
        }
        
        // Remove and dispose all meshes
        if (this.activeMeshes.has(powerUpId)) {
            for (const { mesh, scene } of this.activeMeshes.get(powerUpId)) {
                if (mesh.parent) {
                    scene.remove(mesh);
                }
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach(mat => mat.dispose());
                    } else {
                        mesh.material.dispose();
                    }
                }
            }
            this.activeMeshes.delete(powerUpId);
        }
    }
    
    /**
     * Clean up all resources for all power-ups
     */
    cleanupAll() {
        for (const powerUpId of this.activeTimeouts.keys()) {
            this.cleanup(powerUpId);
        }
        for (const powerUpId of this.activeIntervals.keys()) {
            this.cleanup(powerUpId);
        }
        for (const powerUpId of this.activeLights.keys()) {
            this.cleanup(powerUpId);
        }
        for (const powerUpId of this.activeMeshes.keys()) {
            this.cleanup(powerUpId);
        }
    }
}

// Singleton instance
export const powerUpCleanupManager = new PowerUpCleanupManager();