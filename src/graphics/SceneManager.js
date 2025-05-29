import * as THREE from 'three';

/**
 * Scene Manager
 * Handles Three.js scene setup, camera, renderer, and lighting
 */
export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.lights = {};
        
        this.initialize();
    }
    
    initialize() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000011, 10, 50);
        
        // Setup camera
        this.setupCamera();
        
        // Setup renderer
        this.setupRenderer();
        
        // Setup lighting
        this.setupLighting();
        
        // Setup environment map for refractive effects
        this.setupEnvironmentMap();
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        this.camera.position.set(0, 0, 20);
        this.camera.lookAt(0, 0, 0);
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    
    setupLighting() {
        // Ambient light
        this.lights.ambient = new THREE.AmbientLight(0x222244, 0.5);
        this.scene.add(this.lights.ambient);
        
        // Main directional light
        this.lights.main = new THREE.DirectionalLight(0xffffff, 1);
        this.lights.main.position.set(5, 10, 5);
        this.lights.main.castShadow = true;
        this.lights.main.shadow.mapSize.width = 2048;
        this.lights.main.shadow.mapSize.height = 2048;
        this.lights.main.shadow.camera.near = 0.5;
        this.lights.main.shadow.camera.far = 50;
        this.lights.main.shadow.camera.left = -15;
        this.lights.main.shadow.camera.right = 15;
        this.lights.main.shadow.camera.top = 15;
        this.lights.main.shadow.camera.bottom = -15;
        this.scene.add(this.lights.main);
        
        // Rim light
        this.lights.rim = new THREE.PointLight(0x00ffff, 0.5, 30);
        this.lights.rim.position.set(-10, 5, 10);
        this.scene.add(this.lights.rim);
        
        // Accent light
        this.lights.accent = new THREE.PointLight(0xff6b35, 0.3, 25);
        this.lights.accent.position.set(10, -5, 8);
        this.scene.add(this.lights.accent);
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * Animate lights
     * @param {number} time - Current time in seconds
     */
    animateLights(time) {
        this.lights.rim.position.x = Math.sin(time) * 10;
        this.lights.accent.position.y = Math.cos(time * 0.7) * 5;
    }
    
    /**
     * Render the scene
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Add object to scene
     * @param {THREE.Object3D} object - Object to add
     */
    add(object) {
        this.scene.add(object);
    }
    
    /**
     * Remove object from scene
     * @param {THREE.Object3D} object - Object to remove
     */
    remove(object) {
        this.scene.remove(object);
    }
    
    /**
     * Get the scene
     * @returns {THREE.Scene} The Three.js scene
     */
    getScene() {
        return this.scene;
    }
    
    /**
     * Get the camera
     * @returns {THREE.Camera} The Three.js camera
     */
    getCamera() {
        return this.camera;
    }
    
    /**
     * Get the renderer
     * @returns {THREE.WebGLRenderer} The Three.js renderer
     */
    getRenderer() {
        return this.renderer;
    }
    
    /**
     * Create a temporary light effect
     * @param {THREE.Vector3} position - Position for the light
     * @param {number} color - Light color
     * @param {number} intensity - Light intensity
     * @param {number} duration - Duration in milliseconds
     */
    createTemporaryLight(position, color, intensity, duration) {
        const light = new THREE.PointLight(color, intensity, 10);
        light.position.copy(position);
        this.scene.add(light);
        
        // Fade out and remove
        const fadeStep = intensity / (duration / 16);
        const fadeInterval = setInterval(() => {
            light.intensity -= fadeStep;
            if (light.intensity <= 0) {
                this.scene.remove(light);
                clearInterval(fadeInterval);
            }
        }, 16);
    }
    
    /**
     * Setup environment map for refractive effects
     */
    setupEnvironmentMap() {
        // Create a procedural cube texture for environment reflections
        const size = 512;
        const cubeTexture = new THREE.CubeTexture();
        
        // Create 6 faces for the cube texture with subtle gradients
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const faces = [];
        const colors = [
            ['#001122', '#003366'], // Right - Blue gradient
            ['#001122', '#003366'], // Left - Blue gradient  
            ['#000814', '#001d3d'], // Top - Dark blue gradient
            ['#000814', '#001122'], // Bottom - Darker gradient
            ['#001122', '#003366'], // Front - Blue gradient
            ['#001122', '#003366']  // Back - Blue gradient
        ];
        
        for (let i = 0; i < 6; i++) {
            // Create gradient for each face
            const gradient = ctx.createLinearGradient(0, 0, 0, size);
            gradient.addColorStop(0, colors[i][0]);
            gradient.addColorStop(1, colors[i][1]);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            
            // Add some subtle noise for more interesting reflections
            ctx.globalAlpha = 0.1;
            for (let x = 0; x < size; x += 8) {
                for (let y = 0; y < size; y += 8) {
                    if (Math.random() > 0.7) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(x, y, 2, 2);
                    }
                }
            }
            ctx.globalAlpha = 1.0;
            
            // Convert to texture
            const imageData = ctx.getImageData(0, 0, size, size);
            const texture = new THREE.DataTexture(
                imageData.data,
                size,
                size,
                THREE.RGBAFormat
            );
            texture.needsUpdate = true;
            faces.push(texture);
        }
        
        cubeTexture.image = faces;
        cubeTexture.needsUpdate = true;
        
        // Set as scene environment
        this.scene.environment = cubeTexture;
        this.scene.background = null; // Keep transparent background
        
        // Store reference for particle materials
        this.environmentMap = cubeTexture;
    }
}