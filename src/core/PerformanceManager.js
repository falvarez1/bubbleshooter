import { BubbleInstances } from '../graphics/BubbleInstances.js';
import { GPUParticleSystem } from '../graphics/GPUParticles.js';
import { SIMDUtils } from '../math/SIMDUtils.js';
import { WebGPUCompute } from '../graphics/WebGPUCompute.js';

/**
 * Performance Manager
 * Detects capabilities and chooses optimal rendering paths
 */
export class PerformanceManager {
    constructor() {
        this.capabilities = {};
        this.renderingMode = 'standard';
        this.performanceProfile = 'medium';
    }
    
    async initialize() {
        await this.detectCapabilities();
        this.chooseOptimalSettings();
        console.log('Performance Manager initialized:', this.capabilities);
    }
    
    async detectCapabilities() {
        // Detect WebGL capabilities
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        
        this.capabilities = {
            webgl2: !!canvas.getContext('webgl2'),
            webgpu: await WebGPUCompute.initialize(),
            simd: SIMDUtils.isSupported,
            instancedArrays: !!gl?.getExtension('ANGLE_instanced_arrays'),
            floatTextures: !!gl?.getExtension('OES_texture_float'),
            maxTextureSize: gl?.getParameter(gl.MAX_TEXTURE_SIZE) || 1024,
            maxInstancedCount: gl?.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) * 4 || 256,
            devicePixelRatio: window.devicePixelRatio || 1,
            hardwareConcurrency: navigator.hardwareConcurrency || 4
        };
        
        // Performance profiling
        const start = performance.now();
        const testArray = new Float32Array(10000);
        for (let i = 0; i < testArray.length; i++) {
            testArray[i] = Math.sin(i * 0.01) * Math.cos(i * 0.02);
        }
        const computeTime = performance.now() - start;
        
        this.capabilities.computePerformance = computeTime;
        
        canvas.remove();
    }
    
    chooseOptimalSettings() {
        // Determine performance profile based on capabilities
        if (this.capabilities.webgpu && this.capabilities.simd) {
            this.performanceProfile = 'ultra';
            this.renderingMode = 'webgpu';
        } else if (this.capabilities.webgl2 && this.capabilities.instancedArrays) {
            this.performanceProfile = 'high';
            this.renderingMode = 'instanced';
        } else if (this.capabilities.webgl2) {
            this.performanceProfile = 'medium';
            this.renderingMode = 'optimized';
        } else {
            this.performanceProfile = 'low';
            this.renderingMode = 'standard';
        }
        
        // Adjust based on device characteristics
        if (this.capabilities.devicePixelRatio > 2) {
            this.performanceProfile = this.lowerProfile(this.performanceProfile);
        }
        
        if (this.capabilities.computePerformance > 10) {
            this.performanceProfile = this.lowerProfile(this.performanceProfile);
        }
    }
    
    lowerProfile(profile) {
        const profiles = ['low', 'medium', 'high', 'ultra'];
        const index = profiles.indexOf(profile);
        return profiles[Math.max(0, index - 1)];
    }
    
    createOptimalBubbleRenderer(scene, maxBubbles) {
        switch (this.renderingMode) {
            case 'instanced':
                console.log('Using instanced bubble rendering');
                return new BubbleInstances(scene, maxBubbles);
            
            case 'webgpu':
                console.log('Using WebGPU bubble rendering');
                // Would return WebGPU-based renderer
                return new BubbleInstances(scene, maxBubbles);
            
            default:
                console.log('Using standard bubble rendering');
                return null; // Use existing individual mesh system
        }
    }
    
    createOptimalParticleSystem(scene) {
        if (this.capabilities.webgl2 && this.performanceProfile !== 'low') {
            console.log('Using GPU particle system');
            return new GPUParticleSystem(scene);
        } else {
            console.log('Using CPU particle system');
            return null; // Use existing CPU particles
        }
    }
    
    getOptimalCollisionSettings() {
        return {
            useSIMD: this.capabilities.simd && this.performanceProfile !== 'low',
            batchSize: this.capabilities.hardwareConcurrency * 4,
            maxChecksPerFrame: this.performanceProfile === 'ultra' ? 1000 : 
                              this.performanceProfile === 'high' ? 500 : 
                              this.performanceProfile === 'medium' ? 250 : 100,
            useWebWorkers: this.capabilities.hardwareConcurrency > 2
        };
    }
    
    getOptimalRenderSettings() {
        const baseSettings = {
            antialias: true,
            shadowMap: true,
            particleCount: 1000,
            maxLights: 8
        };
        
        switch (this.performanceProfile) {
            case 'ultra':
                return {
                    ...baseSettings,
                    antialias: true,
                    shadowMapSize: 2048,
                    particleCount: 5000,
                    maxLights: 12,
                    postProcessing: true
                };
                
            case 'high':
                return {
                    ...baseSettings,
                    shadowMapSize: 1024,
                    particleCount: 2000,
                    maxLights: 8
                };
                
            case 'medium':
                return {
                    ...baseSettings,
                    shadowMapSize: 512,
                    particleCount: 1000,
                    maxLights: 6
                };
                
            case 'low':
                return {
                    antialias: false,
                    shadowMap: false,
                    shadowMapSize: 256,
                    particleCount: 500,
                    maxLights: 4,
                    postProcessing: false
                };
        }
    }
    
    /**
     * Monitor performance during runtime
     */
    startPerformanceMonitoring() {
        let frameCount = 0;
        let totalFrameTime = 0;
        let lastTime = performance.now();
        
        const monitor = () => {
            const now = performance.now();
            const deltaTime = now - lastTime;
            lastTime = now;
            
            frameCount++;
            totalFrameTime += deltaTime;
            
            // Check every 60 frames
            if (frameCount >= 60) {
                const avgFrameTime = totalFrameTime / frameCount;
                const fps = 1000 / avgFrameTime;
                
                // Auto-adjust quality if performance is poor
                if (fps < 30 && this.performanceProfile !== 'low') {
                    console.log('Performance degraded, lowering quality');
                    this.performanceProfile = this.lowerProfile(this.performanceProfile);
                    this.chooseOptimalSettings();
                }
                
                frameCount = 0;
                totalFrameTime = 0;
            }
            
            requestAnimationFrame(monitor);
        };
        
        requestAnimationFrame(monitor);
    }
}