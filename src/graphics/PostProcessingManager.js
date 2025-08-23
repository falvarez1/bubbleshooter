import * as THREE from 'three';

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
        
        // UnrealBloomPass for the glow effect
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(size.x, size.y),
            1.5,     // strength
            0.4,     // radius
            0.0      // threshold - set to 0 for full bloom
        );
        this.bloomPass.renderToScreen = false;
        
        // Configure bloom parameters for best visual effect
        this.bloomPass.strength = 3.0; // Increased for better visibility
        this.bloomPass.radius = 1.0;
        this.bloomPass.threshold = 0.0;
        
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
     * Add an object to bloom selection
     */
    addBloomObject(object) {
        if (!object) return;
        
        if (object.isMesh || object.isLine) {
            // Add to bloom layer (keep default layer too for normal rendering)
            object.layers.enable(this.BLOOM_LAYER);
            this.bloomObjects.add(object);
            console.log(`Added bloom object: ${object.name || 'unnamed'}, Total bloom objects: ${this.bloomObjects.size}`);
            
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
                    this.addBloomObject(child);
                }
            });
        }
    }
    
    /**
     * Remove an object from bloom selection
     */
    removeBloomObject(object) {
        if (!object) return;
        
        if (object.isMesh || object.isLine) {
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
                    this.removeBloomObject(child);
                }
            });
        }
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
    }
    
    /**
     * Configure for trajectory (optimized settings)
     */
    configureForTrajectory() {
        this.bloomPass.strength = 2.5;
        this.bloomPass.radius = 0.85;
        this.bloomPass.threshold = 0.0;
    }
    
    /**
     * Darken non-bloom objects for bloom pass
     */
    darkenNonBloomObjects() {
        this.materialCache.clear();
        
        this.scene.traverse((obj) => {
            if (obj.isMesh && !this.bloomObjects.has(obj)) {
                this.materialCache.set(obj, obj.material);
                obj.material = this.darkMaterial;
            }
        });
    }
    
    /**
     * Restore original materials after bloom pass
     */
    restoreMaterials() {
        this.materialCache.forEach((material, obj) => {
            obj.material = material;
        });
        this.materialCache.clear();
    }
    
    /**
     * Render the scene with selective bloom
     */
    render(deltaTime = 0) {
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
        return this.enabled;
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