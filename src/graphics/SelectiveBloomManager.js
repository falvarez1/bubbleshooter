import * as THREE from 'three';
import { 
    EffectComposer,
    RenderPass,
    EffectPass,
    BloomEffect,
    BlendFunction,
    KernelSize
} from 'postprocessing';

/**
 * SelectiveBloomManager
 * Implements true selective bloom using dual render passes
 */
export class SelectiveBloomManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        // Layers
        this.BLOOM_LAYER = 1;
        this.DEFAULT_LAYER = 0;
        
        // Materials cache
        this.originalMaterials = new Map();
        this.blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        
        // Bloom objects tracking
        this.bloomObjects = new Set();
        
        // Initialize composers
        this.initComposers();
    }
    
    initComposers() {
        // Get render target size
        const renderTargetSize = new THREE.Vector2();
        this.renderer.getSize(renderTargetSize);
        
        // Render target for bloom pass
        const bloomRenderTarget = new THREE.WebGLRenderTarget(
            renderTargetSize.x,
            renderTargetSize.y,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat
            }
        );
        
        // Main composer - renders everything normally
        this.finalComposer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.finalComposer.addPass(renderPass);
        
        // Bloom composer - only renders bloom objects
        this.bloomComposer = new EffectComposer(this.renderer, bloomRenderTarget);
        this.bloomComposer.renderToScreen = false;
        
        // Bloom render pass with custom setup
        this.bloomRenderPass = new RenderPass(this.scene, this.camera);
        this.bloomRenderPass.clear = true;
        this.bloomComposer.addPass(this.bloomRenderPass);
        
        // Bloom effect
        this.bloomEffect = new BloomEffect({
            blendFunction: BlendFunction.ADD,
            kernelSize: KernelSize.LARGE,
            luminanceThreshold: 0.0, // No threshold since we're selective
            luminanceSmoothing: 0.0,
            intensity: 2.0,
            radius: 0.8,
            levels: 8,
            mipmapBlur: true
        });
        
        const bloomEffectPass = new EffectPass(this.camera, this.bloomEffect);
        bloomEffectPass.renderToScreen = false;
        this.bloomComposer.addPass(bloomEffectPass);
        
        // Final blend pass - combines normal + bloom
        this.mixPass = new EffectPass(this.camera);
        this.mixPass.renderToScreen = true;
        this.finalComposer.addPass(this.mixPass);
    }
    
    /**
     * Add object to selective bloom
     */
    addBloomObject(object) {
        if (!object) return;
        this.bloomObjects.add(object);
        
        // Mark children too if it's a group
        if (object.type === 'Group') {
            object.traverse(child => {
                if (child.isMesh) {
                    this.bloomObjects.add(child);
                }
            });
        }
    }
    
    /**
     * Remove object from selective bloom
     */
    removeBloomObject(object) {
        if (!object) return;
        this.bloomObjects.delete(object);
        
        // Remove children too if it's a group
        if (object.type === 'Group') {
            object.traverse(child => {
                if (child.isMesh) {
                    this.bloomObjects.delete(child);
                }
            });
        }
    }
    
    /**
     * Prepare scene for bloom-only render
     */
    prepareBloomScene() {
        // Hide all non-bloom objects
        this.scene.traverse(obj => {
            if (obj.isMesh && !this.bloomObjects.has(obj)) {
                this.originalMaterials.set(obj, obj.material);
                obj.material = this.blackMaterial;
            }
        });
    }
    
    /**
     * Restore scene after bloom render
     */
    restoreScene() {
        // Restore original materials
        this.originalMaterials.forEach((material, obj) => {
            obj.material = material;
        });
        this.originalMaterials.clear();
    }
    
    /**
     * Render with selective bloom
     */
    render(deltaTime = 0) {
        // 1. Prepare scene for bloom pass (black out non-bloom objects)
        this.prepareBloomScene();
        
        // 2. Render bloom pass
        this.bloomComposer.render(deltaTime);
        
        // 3. Restore scene
        this.restoreScene();
        
        // 4. Render final composite
        this.renderer.autoClear = false;
        this.renderer.clear();
        this.finalComposer.render(deltaTime);
        this.renderer.autoClear = true;
        
        // 5. Blend bloom on top
        this.renderer.autoClear = false;
        this.renderer.setRenderTarget(null);
        
        // Copy bloom result
        const bloomTexture = this.bloomComposer.outputBuffer.texture;
        this.blendBloom(bloomTexture);
        
        this.renderer.autoClear = true;
    }
    
    /**
     * Blend bloom texture on top of scene
     */
    blendBloom(bloomTexture) {
        if (!this.blendMaterial) {
            this.blendMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    baseTexture: { value: null },
                    bloomTexture: { value: null }
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
                    varying vec2 vUv;
                    
                    void main() {
                        vec4 base = texture2D(baseTexture, vUv);
                        vec4 bloom = texture2D(bloomTexture, vUv);
                        gl_FragColor = base + bloom;
                    }
                `,
                blending: THREE.AdditiveBlending,
                depthTest: false,
                depthWrite: false,
                transparent: true
            });
            
            this.blendQuad = new THREE.Mesh(
                new THREE.PlaneGeometry(2, 2),
                this.blendMaterial
            );
            this.blendScene = new THREE.Scene();
            this.blendCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            this.blendScene.add(this.blendQuad);
        }
        
        this.blendMaterial.uniforms.bloomTexture.value = bloomTexture;
        this.renderer.render(this.blendScene, this.blendCamera);
    }
    
    /**
     * Handle resize
     */
    handleResize() {
        const width = this.renderer.domElement.width;
        const height = this.renderer.domElement.height;
        this.finalComposer.setSize(width, height);
        this.bloomComposer.setSize(width, height);
    }
    
    /**
     * Update bloom settings
     */
    updateSettings(settings) {
        if (settings.intensity !== undefined) {
            this.bloomEffect.intensity = settings.intensity;
        }
        if (settings.radius !== undefined) {
            this.bloomEffect.radius = settings.radius;
        }
    }
    
    /**
     * Dispose
     */
    dispose() {
        this.finalComposer.dispose();
        this.bloomComposer.dispose();
        this.bloomObjects.clear();
        this.originalMaterials.clear();
        
        if (this.blendQuad) {
            this.blendQuad.geometry.dispose();
            this.blendMaterial.dispose();
        }
    }
}