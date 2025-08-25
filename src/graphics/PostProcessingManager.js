import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

// Import Three.js post-processing passes from examples
const EffectComposer = (await import('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/EffectComposer.js')).EffectComposer;
const RenderPass = (await import('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/RenderPass.js')).RenderPass;
const UnrealBloomPass = (await import('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/UnrealBloomPass.js')).UnrealBloomPass;
const ShaderPass = (await import('https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/postprocessing/ShaderPass.js')).ShaderPass;

/**
 * PostProcessingManager
 * Implements selective bloom using Three.js built-in post-processing with layer masking
 * Based on working examples from Three.js discourse
 */
export class PostProcessingManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        // Layers for selective bloom
        this.BLOOM_LAYER = 1; // Objects on this layer will bloom
        this.DEFAULT_LAYER = 0; // Objects on this layer won't bloom
        
        // Track bloom objects
        this.bloomObjects = new Set();
        
        // Bloom categories - track objects by type (more specific)
        // Use a Proxy to track modifications
        const categories = {
            trajectoryLine: new Set(),
            trajectoryGlow: new Set(),
            impactIndicator: new Set(),
            impactRing: new Set(),
            collisionParticles: new Set(),
            explosionParticles: new Set(),
            powerUpEffects: new Set(),
            wallImpact: new Set(),
            shootingParticles: new Set()
        };
        
        // Add proxy to track when categories are modified
        this.bloomCategories = new Proxy(categories, {
            set(target, prop, value) {
                console.warn(`BLOOM CATEGORY MODIFIED: ${prop} replaced with new Set (size: ${value?.size || 0})`);
                target[prop] = value;
                return true;
            }
        });
        
        // Category enable states from config
        this.categoryEnabled = { ...CONFIG.BLOOM.CATEGORIES };
        
        // Initialize bloom enabled state from config
        this.enabled = CONFIG.BLOOM.ENABLED;
        
        // Materials cache for darkening non-bloom objects
        this.materialCache = new Map();
        this.darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
        
        // Initialize composers
        this.initComposers();
    }
    
    initComposers() {
        // Get render target size
        const renderTargetParams = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType
        };
        
        const size = new THREE.Vector2();
        this.renderer.getSize(size);
        
        // Create render targets
        this.renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, renderTargetParams);
        
        // === BLOOM COMPOSER ===
        // This composer only renders objects on the bloom layer
        this.bloomComposer = new EffectComposer(this.renderer, this.renderTarget);
        this.bloomComposer.renderToScreen = false;
        
        const renderPass = new RenderPass(this.scene, this.camera);
        renderPass.clear = true;
        this.bloomComposer.addPass(renderPass);
        
        // UnrealBloomPass for the glow effect - use CONFIG values
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(size.x, size.y),
            CONFIG.BLOOM.STRENGTH,     // strength from config
            CONFIG.BLOOM.RADIUS,       // radius from config
            CONFIG.BLOOM.THRESHOLD     // threshold from config
        );
        this.bloomPass.renderToScreen = false;
        
        // Apply enabled state
        this.bloomPass.enabled = this.enabled;
        
        this.bloomComposer.addPass(this.bloomPass);
        
        // === FINAL COMPOSER ===
        // This composer combines the bloom result with the normal scene
        this.finalComposer = new EffectComposer(this.renderer);
        this.finalComposer.renderToScreen = true;
        
        const finalRenderPass = new RenderPass(this.scene, this.camera);
        finalRenderPass.clear = false; // Don't clear - we want to combine with bloom
        this.finalComposer.addPass(finalRenderPass);
        
        // Create shader to mix bloom texture with scene
        const mixShader = {
            uniforms: {
                baseTexture: { value: null },
                bloomTexture: { value: this.bloomComposer.renderTarget2.texture },
                bloomStrength: { value: 1.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D baseTexture;
                uniform sampler2D bloomTexture;
                uniform float bloomStrength;
                varying vec2 vUv;
                
                void main() {
                    vec4 base = texture2D(baseTexture, vUv);
                    vec4 bloom = texture2D(bloomTexture, vUv);
                    
                    // Additive blending for bloom
                    gl_FragColor = base + bloom * bloomStrength;
                    
                    // Ensure alpha is preserved
                    gl_FragColor.a = max(base.a, bloom.a);
                }
            `
        };
        
        this.mixPass = new ShaderPass(mixShader);
        this.mixPass.uniforms.baseTexture.value = this.finalComposer.readBuffer.texture;
        this.mixPass.needsSwap = true;
        this.mixPass.renderToScreen = true;
        
        // Store the final pass for later use
        this.finalPass = this.mixPass;
        
        // Enable bloom layer on camera so it can see bloom objects
        this.camera.layers.enable(this.BLOOM_LAYER);
        
        console.log('PostProcessingManager initialized with Three.js UnrealBloomPass');
        console.log('Bloom settings:', {
            strength: this.bloomPass.strength,
            radius: this.bloomPass.radius,
            threshold: this.bloomPass.threshold
        });
    }
    
    /**
     * Add an object to bloom selection with optional category
     * @param {THREE.Object3D} object - The object to add bloom to
     * @param {string} category - Optional category (trajectory, particles, impactIndicator, powerUps, explosions)
     */
    addBloomObject(object, category = null) {
        if (!object) return;
        
        if (object.isMesh || object.isLine) {
            // Store category info on object for tracking
            if (!object.userData.bloomCategory) {
                object.userData.bloomCategory = category;
            }
            
            // Add to category if specified
            if (category && this.bloomCategories[category] !== undefined) {
                // Remove from any other categories first
                Object.keys(this.bloomCategories).forEach(cat => {
                    if (cat !== category) {
                        this.bloomCategories[cat].delete(object);
                    }
                });
                
                this.bloomCategories[category].add(object);
                
                // Only add to bloom layer if category is enabled
                if (this.categoryEnabled[category]) {
                    object.layers.enable(this.BLOOM_LAYER);
                    this.bloomObjects.add(object);
                } else {
                    object.layers.disable(this.BLOOM_LAYER);
                    this.bloomObjects.delete(object);
                }
            } else {
                // No category, treat as always-on bloom
                object.layers.enable(this.BLOOM_LAYER);
                this.bloomObjects.add(object);
            }
            console.log(`Added bloom object: ${object.name || 'unnamed'}, Category: ${category || 'none'}, Enabled: ${category ? this.categoryEnabled[category] : true}, Total: ${this.bloomObjects.size}`);
            
            // Make material emissive for better bloom
            if (object.material) {
                // Store original properties
                if (!object.userData.originalEmissive) {
                    object.userData.originalEmissive = {
                        emissive: object.material.emissive ? object.material.emissive.clone() : new THREE.Color(0x000000),
                        emissiveIntensity: object.material.emissiveIntensity || 0,
                        toneMapped: object.material.toneMapped !== undefined ? object.material.toneMapped : true
                    };
                }
                
                // Set emissive properties
                if (object.material.emissive !== undefined) {
                    const baseColor = object.material.color || new THREE.Color(0xffffff);
                    object.material.emissive = baseColor.clone();
                    object.material.emissiveIntensity = 1.5;
                    object.material.toneMapped = false; // Disable tone mapping for bloom objects
                }
            }
        }
        
        // Handle groups recursively
        if (object.type === 'Group' || object.type === 'Object3D') {
            object.traverse(child => {
                if (child !== object && (child.isMesh || child.isLine)) {
                    this.addBloomObject(child, category);
                }
            });
        }
    }
    
    /**
     * Remove an object from bloom selection
     * @param {THREE.Object3D} object - The object to remove bloom from
     * @param {string} category - Optional category to remove from
     */
    removeBloomObject(object, category = null) {
        if (!object) return;
        
        if (object.isMesh || object.isLine) {
            // Use stored category if not specified
            const targetCategory = category || object.userData.bloomCategory;
            
            // Remove from specific category or all categories
            if (targetCategory && this.bloomCategories[targetCategory]) {
                this.bloomCategories[targetCategory].delete(object);
            } else {
                // Remove from all categories
                Object.values(this.bloomCategories).forEach(set => set.delete(object));
            }
            
            // Clear category tracking
            delete object.userData.bloomCategory;
            
            // Remove from bloom layer
            object.layers.disable(this.BLOOM_LAYER);
            this.bloomObjects.delete(object);
            
            // Restore original material properties
            if (object.userData.originalEmissive && object.material) {
                if (object.material.emissive !== undefined) {
                    object.material.emissive = object.userData.originalEmissive.emissive;
                    object.material.emissiveIntensity = object.userData.originalEmissive.emissiveIntensity;
                    object.material.toneMapped = object.userData.originalEmissive.toneMapped;
                }
                delete object.userData.originalEmissive;
            }
        }
        
        // Handle groups recursively
        if (object.type === 'Group' || object.type === 'Object3D') {
            object.traverse(child => {
                if (child !== object && (child.isMesh || child.isLine)) {
                    this.removeBloomObject(child, category);
                }
            });
        }
    }
    
    /**
     * Toggle a bloom category on/off
     * @param {string} category - Category name
     * @param {boolean} enabled - Enable state
     */
    setCategoryEnabled(category, enabled) {
        if (!this.bloomCategories[category]) {
            console.warn(`Bloom category '${category}' does not exist`);
            return;
        }
        
        this.categoryEnabled[category] = enabled;
        
        // Update all objects in this category
        this.bloomCategories[category].forEach(object => {
            // Double-check this object belongs to this category
            if (object.userData.bloomCategory === category) {
                if (enabled) {
                    object.layers.enable(this.BLOOM_LAYER);
                    this.bloomObjects.add(object);
                } else {
                    object.layers.disable(this.BLOOM_LAYER);
                    this.bloomObjects.delete(object);
                }
            }
        });
        
        console.log(`Bloom category '${category}' set to: ${enabled}, Objects affected: ${this.bloomCategories[category].size}`);
    }
    
    /**
     * Get current category states
     */
    getCategoryStates() {
        const states = {};
        Object.keys(this.bloomCategories).forEach(cat => {
            states[cat] = {
                enabled: this.categoryEnabled[cat],
                count: this.bloomCategories[cat].size
            };
        });
        return states;
    }
    
    /**
     * Clear all bloom objects
     */
    clearBloomObjects() {
        const objects = Array.from(this.bloomObjects);
        objects.forEach(obj => {
            this.removeBloomObject(obj);
        });
        this.bloomObjects.clear();
        // Also clear all categories
        Object.values(this.bloomCategories).forEach(set => set.clear());
    }
    
    /**
     * Configure for trajectory (optimized settings)
     */
    configureForTrajectory() {
        // Use CONFIG values instead of hardcoded values
        // These are already set in the constructor from CONFIG
        // No need to override them here
        console.log('Trajectory configuration using CONFIG values:', {
            strength: this.bloomPass.strength,
            radius: this.bloomPass.radius,
            threshold: this.bloomPass.threshold
        });
    }
    
    /**
     * Darken non-bloom objects for bloom pass
     */
    darkenNonBloomObjects() {
        this.materialCache.clear();
        
        this.scene.traverse((obj) => {
            // Skip if object is not a mesh or has no material
            if (!obj.isMesh || !obj.material) return;
            
            // Skip if object is in bloom set
            if (this.bloomObjects.has(obj)) return;
            
            // Store and replace material
            this.materialCache.set(obj, obj.material);
            obj.material = this.darkMaterial;
        });
    }
    
    /**
     * Restore original materials after bloom pass
     */
    restoreMaterials() {
        this.materialCache.forEach((material, obj) => {
            // Only restore if object still exists and has a material property
            if (obj && obj.material !== undefined) {
                obj.material = material;
            }
        });
        this.materialCache.clear();
    }
    
    /**
     * Render the scene with selective bloom
     */
    render(deltaTime = 0) {
        try {
            // Check if bloom is disabled
            if (!this.enabled || this.bloomObjects.size === 0) {
                // No bloom objects or bloom disabled, just render normally
                this.renderer.render(this.scene, this.camera);
                return;
            }
        
        // Store current state
        const currentBackground = this.scene.background;
        const currentClearAlpha = this.renderer.getClearAlpha();
        const currentAutoClear = this.renderer.autoClear;
        const currentRenderTarget = this.renderer.getRenderTarget();
        const currentToneMapping = this.renderer.toneMapping;
        
        // Prepare for bloom pass
        this.renderer.autoClear = false;
        this.renderer.setClearAlpha(0);
        this.scene.background = null;
        
        // === PASS 1: Render bloom objects only ===
        // Darken all non-bloom objects
        this.darkenNonBloomObjects();
        
        // Clear and render bloom pass
        this.renderer.setRenderTarget(this.bloomComposer.renderTarget1);
        this.renderer.clear();
        
        // Render bloom objects to bloom composer
        this.bloomComposer.render(deltaTime);
        
        // === PASS 2: Restore materials and render full scene ===
        this.restoreMaterials();
        
        // Clear the default framebuffer
        this.renderer.setRenderTarget(null);
        this.renderer.clear();
        
        // Render the normal scene
        this.renderer.render(this.scene, this.camera);
        
        // === PASS 3: Composite bloom on top ===
        // We need to manually blend the bloom texture
        this.renderer.autoClear = false;
        
        // Create a full-screen quad to render bloom texture
        if (!this.bloomQuad) {
            const geometry = new THREE.PlaneGeometry(2, 2);
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    bloomTexture: { value: null },
                    bloomStrength: { value: 1.0 }
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = vec4(position.xy, 0.0, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D bloomTexture;
                    uniform float bloomStrength;
                    varying vec2 vUv;
                    
                    void main() {
                        vec4 bloom = texture2D(bloomTexture, vUv);
                        gl_FragColor = bloom * bloomStrength;
                    }
                `,
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false,
                transparent: true
            });
            
            this.bloomQuad = new THREE.Mesh(geometry, material);
            this.bloomQuad.frustumCulled = false;
            
            this.bloomScene = new THREE.Scene();
            this.bloomCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            this.bloomScene.add(this.bloomQuad);
        }
        
        // Update bloom texture and render
        this.bloomQuad.material.uniforms.bloomTexture.value = this.bloomComposer.renderTarget2.texture;
        this.bloomQuad.material.uniforms.bloomStrength.value = 1.0;
        
        this.renderer.render(this.bloomScene, this.bloomCamera);
        
        // Restore renderer state
        this.renderer.autoClear = currentAutoClear;
        this.renderer.setClearAlpha(currentClearAlpha);
        this.renderer.setRenderTarget(currentRenderTarget);
        this.renderer.toneMapping = currentToneMapping;
        this.scene.background = currentBackground;
        } catch (error) {
            console.error('Error in bloom render:', error);
            console.error('Error details:', {
                bloomObjectsCount: this.bloomObjects.size,
                categoryCounts: this.getCategoryStates(),
                errorMessage: error.message,
                errorStack: error.stack
            });
            
            // Fallback to normal rendering
            try {
                this.renderer.render(this.scene, this.camera);
            } catch (fallbackError) {
                console.error('Fallback render also failed:', fallbackError);
            }
            
            // Don't automatically refresh bloom state - it loses all objects!
            // Instead, just log the error for debugging
            console.warn('Bloom render failed but not refreshing state to preserve objects');
        }
    }
    
    /**
     * Handle resize
     */
    handleResize() {
        const width = this.renderer.domElement.width;
        const height = this.renderer.domElement.height;
        
        this.bloomComposer.setSize(width, height);
        this.finalComposer.setSize(width, height);
        
        this.bloomPass.resolution.set(width, height);
    }
    
    /**
     * Update bloom settings dynamically
     */
    updateSettings(settings) {
        if (settings.bloomIntensity !== undefined || settings.bloomStrength !== undefined) {
            this.bloomPass.strength = settings.bloomIntensity || settings.bloomStrength;
        }
        if (settings.bloomRadius !== undefined) {
            this.bloomPass.radius = settings.bloomRadius;
        }
        if (settings.bloomThreshold !== undefined) {
            this.bloomPass.threshold = settings.bloomThreshold;
        }
    }
    
    /**
     * Enable/disable bloom effect
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.bloomPass) {
            this.bloomPass.enabled = enabled;
        }
        console.log('Bloom effect enabled:', enabled);
    }
    
    /**
     * Toggle bloom on/off
     * @returns {boolean} New enabled state
     */
    toggleBloom() {
        this.setEnabled(!this.enabled);
        
        // Refresh all categories when toggling bloom
        if (this.enabled) {
            Object.keys(this.categoryEnabled).forEach(cat => {
                if (this.categoryEnabled[cat]) {
                    this.setCategoryEnabled(cat, true);
                }
            });
        }
        
        return this.enabled;
    }
    
    /**
     * Refresh bloom state for all objects
     * Useful after changes to ensure consistency
     */
    refreshBloomState() {
        // console.log('Refreshing bloom state...');
        
        // Store current counts for debugging
        const beforeCounts = {};
        Object.keys(this.bloomCategories).forEach(cat => {
            beforeCounts[cat] = this.bloomCategories[cat].size;
        });
        
        // Build new bloom objects set first, THEN replace the old one
        const newBloomObjects = new Set();
        
        // Clean up any invalid objects from categories
        Object.keys(this.bloomCategories).forEach(cat => {
            const categorySet = this.bloomCategories[cat];
            const oldSize = categorySet.size;
            const toRemove = [];
            
            categorySet.forEach(object => {
                // Check if object is still valid (not disposed)
                // Note: We don't check for parent because objects might be temporarily detached
                if (!object) {
                    console.warn(`Category ${cat}: null object found`);
                    toRemove.push(object);
                } else if (!object.layers) {
                    console.warn(`Category ${cat}: object has no layers`, object);
                    toRemove.push(object);
                } else if (!object.geometry) {
                    console.warn(`Category ${cat}: object has no geometry`, object);
                    toRemove.push(object);
                } else if (object.geometry.disposed) {
                    console.warn(`Category ${cat}: object geometry is disposed`, object);
                    toRemove.push(object);
                }
            });
            
            // Remove invalid objects from the EXISTING Set instead of replacing it
            toRemove.forEach(obj => categorySet.delete(obj));
            
            if (toRemove.length > 0) {
                console.warn(`Category ${cat}: removed ${toRemove.length} invalid objects`);
            }
        });
        
        // Build new bloom objects set based on category states
        Object.keys(this.bloomCategories).forEach(cat => {
            if (this.categoryEnabled[cat]) {
                this.bloomCategories[cat].forEach(object => {
                    if (object && object.layers) {
                        object.layers.enable(this.BLOOM_LAYER);
                        newBloomObjects.add(object);
                    }
                });
            } else {
                this.bloomCategories[cat].forEach(object => {
                    if (object && object.layers) {
                        object.layers.disable(this.BLOOM_LAYER);
                    }
                });
            }
        });
        
        // Only now replace the bloom objects set
        this.bloomObjects = newBloomObjects;
        
        // Log what changed
        const afterCounts = {};
        Object.keys(this.bloomCategories).forEach(cat => {
            afterCounts[cat] = this.bloomCategories[cat].size;
            if (beforeCounts[cat] !== afterCounts[cat]) {
                console.warn(`Category ${cat} changed: ${beforeCounts[cat]} -> ${afterCounts[cat]}`);
            }
        });
        
        console.log('Bloom state refreshed. Active objects:', this.bloomObjects.size);
        console.log('Category states:', this.getCategoryStates());
    }
    
    /**
     * Debug method to check bloom system health
     */
    debugBloomState() {
        console.log('=== BLOOM SYSTEM DEBUG ===');
        console.log('Enabled:', this.enabled);
        console.log('Total bloom objects:', this.bloomObjects.size);
        console.log('Categories:');
        Object.keys(this.bloomCategories).forEach(cat => {
            console.log(`  ${cat}: ${this.bloomCategories[cat].size} objects, enabled: ${this.categoryEnabled[cat]}`);
        });
        
        // Check for orphaned objects
        let orphaned = 0;
        this.bloomObjects.forEach(obj => {
            let found = false;
            Object.values(this.bloomCategories).forEach(catSet => {
                if (catSet.has(obj)) found = true;
            });
            if (!found) {
                orphaned++;
                console.warn('Orphaned bloom object:', obj.name || 'unnamed', obj);
            }
        });
        if (orphaned > 0) {
            console.warn(`Found ${orphaned} orphaned bloom objects`);
        }
        
        return {
            enabled: this.enabled,
            totalObjects: this.bloomObjects.size,
            categories: this.getCategoryStates(),
            orphanedObjects: orphaned
        };
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        this.clearBloomObjects();
        this.bloomObjects.clear();
        
        if (this.bloomComposer) {
            this.bloomComposer.dispose();
        }
        if (this.finalComposer) {
            this.finalComposer.dispose();
        }
        if (this.bloomPass) {
            this.bloomPass.dispose();
        }
        if (this.bloomQuad) {
            this.bloomQuad.geometry.dispose();
            this.bloomQuad.material.dispose();
        }
        
        this.materialCache.clear();
        this.darkMaterial.dispose();
    }
}