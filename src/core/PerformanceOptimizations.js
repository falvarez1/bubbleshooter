/**
 * Performance Optimizations Module
 * Provides optimized implementations for critical game systems
 */

import * as THREE from 'three';
import { CONFIG } from './Config.js';

/**
 * Optimized Animation Loop Manager
 * Reduces unnecessary updates and calculations
 */
export class OptimizedAnimationLoop {
    constructor() {
        // Frame skipping for non-critical updates
        this.frameCounters = {
            trajectoryUpdate: 0,
            gridBubbleUpdate: 0,
            uiUpdate: 0,
            audioUpdate: 0,
            collisionCacheUpdate: 0
        };
        
        // Update intervals (in frames)
        this.updateIntervals = {
            trajectory: 3,        // Update every 3 frames (~20 FPS)
            gridBubbles: 2,       // Update every 2 frames (~30 FPS)
            ui: 3,                // Update UI every 3 frames (~20 FPS)
            audio: 6,             // Update audio every 6 frames (~10 FPS)
            collisionCache: 30    // Update cache every 30 frames (~2 FPS)
        };
        
        // Dirty flags for optimization
        this.dirtyFlags = {
            trajectoryNeedsUpdate: false,
            gridChanged: false,
            uiNeedsUpdate: false
        };
        
        // Cache for expensive calculations
        this.calculationCache = new Map();
        this.cacheTimeout = 100; // ms
    }
    
    shouldUpdate(system) {
        this.frameCounters[system]++;
        if (this.frameCounters[system] >= this.updateIntervals[system]) {
            this.frameCounters[system] = 0;
            return true;
        }
        return false;
    }
    
    markDirty(flag) {
        this.dirtyFlags[flag] = true;
    }
    
    clearDirty(flag) {
        this.dirtyFlags[flag] = false;
    }
    
    isDirty(flag) {
        return this.dirtyFlags[flag];
    }
    
    getCached(key, calculator) {
        const cached = this.calculationCache.get(key);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            return cached.value;
        }
        
        const value = calculator();
        this.calculationCache.set(key, { value, timestamp: now });
        return value;
    }
}

/**
 * Optimized Bubble Update System
 * Only updates bubbles that are actually animating
 */
export class OptimizedBubbleUpdater {
    constructor() {
        this.animatingBubbles = new Set();
        this.lastUpdateTime = 0;
        this.updateThreshold = 16; // ms (60 FPS)
    }
    
    registerAnimatingBubble(bubble) {
        this.animatingBubbles.add(bubble);
    }
    
    unregisterAnimatingBubble(bubble) {
        this.animatingBubbles.delete(bubble);
    }
    
    updateBubbles(gameState, deltaTime, bubbleInstances) {
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateThreshold) {
            return false; // Skip update
        }
        this.lastUpdateTime = now;
        
        let updatedCount = 0;
        
        // Only update bubbles that are animating
        for (const bubble of this.animatingBubbles) {
            if (!bubble || bubble.isDestroyed) {
                this.animatingBubbles.delete(bubble);
                continue;
            }
            
            bubble.update(deltaTime);
            
            // Check if animation finished
            if (!bubble.connectionAnimating && 
                bubble.impactVelocity.lengthSq() < 0.001 && 
                !bubble.powerUpAnimation) {
                this.animatingBubbles.delete(bubble);
            }
            
            // Update instanced renderer
            if (bubble.useInstancedRendering && bubbleInstances) {
                bubbleInstances.updateBubble(bubble);
            }
            
            updatedCount++;
        }
        
        // Also update the shooting bubble if it exists
        if (gameState.currentBubble) {
            gameState.currentBubble.update(deltaTime);
            if (gameState.currentBubble.useInstancedRendering && bubbleInstances) {
                bubbleInstances.updateBubble(gameState.currentBubble);
            }
            updatedCount++;
        }
        
        return updatedCount > 0;
    }
    
    addImpactedBubbles(bubbles) {
        for (const bubble of bubbles) {
            if (bubble && !bubble.isDestroyed) {
                this.animatingBubbles.add(bubble);
            }
        }
    }
}

/**
 * Optimized Trajectory System
 * Reduces redundant calculations
 */
export class OptimizedTrajectory {
    constructor(trajectorySystem) {
        this.trajectorySystem = trajectorySystem;
        this.lastMousePosition = new THREE.Vector2();
        this.lastBubblePosition = new THREE.Vector3();
        this.lastPrecisionMode = false;
        this.trajectoryValid = false;
    }
    
    needsUpdate(currentBubble, mousePosition, precisionMode) {
        if (!currentBubble || currentBubble.isMoving) {
            return false;
        }
        
        // Check if anything changed
        const mouseChanged = !this.lastMousePosition.equals(mousePosition);
        const bubbleChanged = !this.lastBubblePosition.equals(currentBubble.position);
        const precisionChanged = this.lastPrecisionMode !== precisionMode;
        
        if (mouseChanged || bubbleChanged || precisionChanged || !this.trajectoryValid) {
            this.lastMousePosition.copy(mousePosition);
            this.lastBubblePosition.copy(currentBubble.position);
            this.lastPrecisionMode = precisionMode;
            this.trajectoryValid = true;
            return true;
        }
        
        return false;
    }
    
    invalidate() {
        this.trajectoryValid = false;
    }
}

/**
 * Optimized Particle Pool Manager
 * Reduces bloom registration overhead
 */
export class OptimizedParticlePool {
    constructor(originalPool) {
        this.originalPool = originalPool;
        this.bloomRegistrationQueue = [];
        this.bloomUnregistrationQueue = [];
        this.processingInterval = 100; // ms
        this.lastProcessTime = 0;
    }
    
    spawn(x, y, z, color, size, velocity, category) {
        const particle = this.originalPool.spawn(x, y, z, color, size, velocity, category);
        
        // Queue bloom registration instead of doing it immediately
        if (particle && particle.mesh) {
            this.bloomRegistrationQueue.push({ particle, category });
        }
        
        return particle;
    }
    
    processBloomQueues(postProcessing) {
        const now = Date.now();
        if (now - this.lastProcessTime < this.processingInterval) {
            return;
        }
        this.lastProcessTime = now;
        
        // Process registrations in batch
        if (this.bloomRegistrationQueue.length > 0 && postProcessing) {
            const batch = this.bloomRegistrationQueue.splice(0, 10); // Process 10 at a time
            for (const { particle, category } of batch) {
                if (particle.mesh && particle.active) {
                    postProcessing.addBloomObject(particle.mesh, category);
                }
            }
        }
        
        // Process unregistrations in batch
        if (this.bloomUnregistrationQueue.length > 0 && postProcessing) {
            const batch = this.bloomUnregistrationQueue.splice(0, 10);
            for (const { particle, category } of batch) {
                if (particle.mesh) {
                    postProcessing.removeBloomObject(particle.mesh, category);
                }
            }
        }
    }
    
    update(deltaTime) {
        this.originalPool.update(deltaTime);
    }
}

/**
 * Optimized Shader System
 * Reduces shader complexity dynamically
 */
export class OptimizedShaderManager {
    constructor() {
        this.qualityLevel = 'high'; // 'low', 'medium', 'high', 'ultra'
        this.dynamicQuality = true;
        this.frameTimeHistory = [];
        this.historySize = 60;
        this.targetFrameTime = 16.67; // 60 FPS
    }
    
    updateFrameTime(deltaTime) {
        if (!this.dynamicQuality) return;
        
        const frameTime = deltaTime * 1000;
        this.frameTimeHistory.push(frameTime);
        
        if (this.frameTimeHistory.length > this.historySize) {
            this.frameTimeHistory.shift();
        }
        
        // Calculate average frame time
        const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
        
        // Adjust quality based on performance
        if (avgFrameTime > this.targetFrameTime * 1.5) {
            this.decreaseQuality();
        } else if (avgFrameTime < this.targetFrameTime * 0.8) {
            this.increaseQuality();
        }
    }
    
    decreaseQuality() {
        const levels = ['low', 'medium', 'high', 'ultra'];
        const currentIndex = levels.indexOf(this.qualityLevel);
        if (currentIndex > 0) {
            this.qualityLevel = levels[currentIndex - 1];
            console.log(`Decreasing quality to: ${this.qualityLevel}`);
            return true;
        }
        return false;
    }
    
    increaseQuality() {
        const levels = ['low', 'medium', 'high', 'ultra'];
        const currentIndex = levels.indexOf(this.qualityLevel);
        if (currentIndex < levels.length - 1) {
            this.qualityLevel = levels[currentIndex + 1];
            console.log(`Increasing quality to: ${this.qualityLevel}`);
            return true;
        }
        return false;
    }
    
    getEffectSettings() {
        const settings = {
            low: {
                enablePBR: false,
                enableTransmission: false,
                enableClearcoat: false,
                enableSheen: false,
                enableEnvironmentMap: false,
                enablePulse: false,
                enableColorShift: false,
                enableDistortion: false,
                enableSparkles: false,
                enableRainbow: false,
                enableSubsurface: false,
                enableCaustics: false,
                enableFoam: false,
                enableWobble: false,
                enableHolographic: false
            },
            medium: {
                enablePBR: true,
                enableTransmission: true,
                enableClearcoat: false,
                enableSheen: false,
                enableEnvironmentMap: true,
                enablePulse: true,
                enableColorShift: false,
                enableDistortion: false,
                enableSparkles: false,
                enableRainbow: true,
                enableSubsurface: false,
                enableCaustics: false,
                enableFoam: false,
                enableWobble: false,
                enableHolographic: false
            },
            high: {
                enablePBR: true,
                enableTransmission: true,
                enableClearcoat: true,
                enableSheen: true,
                enableEnvironmentMap: true,
                enablePulse: true,
                enableColorShift: true,
                enableDistortion: true,
                enableSparkles: true,
                enableRainbow: true,
                enableSubsurface: false,
                enableCaustics: false,
                enableFoam: false,
                enableWobble: true,
                enableHolographic: false
            },
            ultra: {
                enablePBR: true,
                enableTransmission: true,
                enableClearcoat: true,
                enableSheen: true,
                enableEnvironmentMap: true,
                enablePulse: true,
                enableColorShift: true,
                enableDistortion: true,
                enableSparkles: true,
                enableRainbow: true,
                enableSubsurface: true,
                enableCaustics: true,
                enableFoam: true,
                enableWobble: true,
                enableHolographic: false // Always keep off for performance
            }
        };
        
        return settings[this.qualityLevel];
    }
}

/**
 * Memory Management Utilities
 */
export class MemoryOptimizer {
    constructor() {
        this.disposalQueue = [];
        this.disposalInterval = 500; // ms
        this.lastDisposalTime = 0;
    }
    
    queueForDisposal(object) {
        this.disposalQueue.push(object);
    }
    
    processDisposalQueue() {
        const now = Date.now();
        if (now - this.lastDisposalTime < this.disposalInterval) {
            return;
        }
        this.lastDisposalTime = now;
        
        const batch = this.disposalQueue.splice(0, 5); // Process 5 at a time
        for (const object of batch) {
            this.disposeObject(object);
        }
    }
    
    disposeObject(object) {
        if (!object) return;
        
        // Dispose geometry
        if (object.geometry) {
            object.geometry.dispose();
        }
        
        // Dispose material
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(mat => {
                    if (mat.map) mat.map.dispose();
                    if (mat.lightMap) mat.lightMap.dispose();
                    if (mat.bumpMap) mat.bumpMap.dispose();
                    if (mat.normalMap) mat.normalMap.dispose();
                    if (mat.specularMap) mat.specularMap.dispose();
                    if (mat.envMap) mat.envMap.dispose();
                    mat.dispose();
                });
            } else {
                if (object.material.map) object.material.map.dispose();
                if (object.material.lightMap) object.material.lightMap.dispose();
                if (object.material.bumpMap) object.material.bumpMap.dispose();
                if (object.material.normalMap) object.material.normalMap.dispose();
                if (object.material.specularMap) object.material.specularMap.dispose();
                if (object.material.envMap) object.material.envMap.dispose();
                object.material.dispose();
            }
        }
        
        // Remove from parent
        if (object.parent) {
            object.parent.remove(object);
        }
    }
}

/**
 * Performance Monitor
 * Tracks and reports performance metrics
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: 0,
            frameTime: 0,
            drawCalls: 0,
            triangles: 0,
            memory: 0
        };
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.updateInterval = 1000; // Update metrics every second
    }
    
    update(renderer) {
        this.frameCount++;
        const now = performance.now();
        const delta = now - this.lastTime;
        
        if (delta >= this.updateInterval) {
            this.metrics.fps = Math.round((this.frameCount * 1000) / delta);
            this.metrics.frameTime = delta / this.frameCount;
            
            if (renderer && renderer.info) {
                this.metrics.drawCalls = renderer.info.render.calls;
                this.metrics.triangles = renderer.info.render.triangles;
            }
            
            if (performance.memory) {
                this.metrics.memory = Math.round(performance.memory.usedJSHeapSize / 1048576); // MB
            }
            
            this.frameCount = 0;
            this.lastTime = now;
            
            // Log if performance is poor
            if (this.metrics.fps < 30) {
                console.warn('Low FPS detected:', this.metrics);
            }
        }
    }
    
    getMetrics() {
        return { ...this.metrics };
    }
}

// Export singleton instances
export const animationLoop = new OptimizedAnimationLoop();
export const bubbleUpdater = new OptimizedBubbleUpdater();
export const shaderManager = new OptimizedShaderManager();
export const memoryOptimizer = new MemoryOptimizer();
export const performanceMonitor = new PerformanceMonitor();