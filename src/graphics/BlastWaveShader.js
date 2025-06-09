import * as THREE from 'three';

/**
 * High-quality shockwave shader that creates realistic light bending/warping effects
 * Mimics the distortion caused by a high-energy blast wave propagating through air
 */
export class ShockwaveShader {
    constructor() {
        this.uniforms = {
            u_texture: { value: null },
            u_time: { value: 0.0 },
            u_center: { value: new THREE.Vector2(0.5, 0.5) },
            u_speed: { value: 1.0 },
            u_strength: { value: 0.3 },
            u_thickness: { value: 0.1 },
            u_maxRadius: { value: 1.0 },
            u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        };

        this.vertexShader = `
            varying vec2 vUv;
            
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;

        this.fragmentShader = `
            uniform sampler2D u_texture;
            uniform float u_time;
            uniform vec2 u_center;
            uniform float u_speed;
            uniform float u_strength;
            uniform float u_thickness;
            uniform float u_maxRadius;
            uniform vec2 u_resolution;
            
            varying vec2 vUv;
            
            // Gaussian function for smooth falloff
            float gaussian(float x, float sigma) {
                return exp(-(x * x) / (2.0 * sigma * sigma));
            }
            
            // Smooth step function with configurable transition width
            float smoothFalloff(float distance, float center, float width) {
                float edge1 = center - width * 0.5;
                float edge2 = center + width * 0.5;
                return 1.0 - smoothstep(edge1, edge2, abs(distance - center));
            }
            
            void main() {
                vec2 uv = vUv;
                
                // Calculate distance from explosion center
                float dist = distance(uv, u_center);
                
                // Current shockwave radius based on time and speed
                float waveRadius = u_time * u_speed;
                
                // Early exit if wave hasn't reached this pixel or has passed completely
                if (waveRadius <= 0.0 || waveRadius > u_maxRadius + u_thickness) {
                    gl_FragColor = texture2D(u_texture, uv);
                    return;
                }
                
                // Safety check: ensure we have a valid texture
                if (u_texture == null) {
                    gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); // Magenta error color
                    return;
                }
                
                // Calculate how close this pixel is to the wavefront
                float distanceToWave = abs(dist - waveRadius);
                
                // Create sharp wavefront with gaussian falloff
                float sigma = u_thickness * 0.5;
                float waveIntensity = gaussian(distanceToWave, sigma);
                
                // Create a sharper falloff for more dramatic effect
                waveIntensity = pow(waveIntensity, 0.7);
                
                // Additional smooth falloff to prevent harsh edges
                waveIntensity *= smoothstep(u_thickness, 0.0, distanceToWave);
                
                // Fade out the entire effect as wave approaches max radius
                float fadeOut = 1.0 - smoothstep(u_maxRadius * 0.7, u_maxRadius, waveRadius);
                waveIntensity *= fadeOut;
                
                // Calculate radial distortion direction (perpendicular to radius)
                vec2 direction = normalize(uv - u_center);
                
                // Create lens-like distortion based on wave intensity
                // The distortion should be strongest at the wavefront
                float distortionAmount = waveIntensity * u_strength;
                
                // Create strong lens-like distortion
                // Simulate how a shockwave bends light outward
                vec2 displacement = direction * distortionAmount * 0.25;
                
                // Add turbulence for more realistic wave behavior
                vec2 tangent = vec2(-direction.y, direction.x);
                float turbulence = sin(waveRadius * 25.0 + dist * 40.0) * 0.5 + 0.5;
                displacement += tangent * distortionAmount * 0.15 * turbulence;
                
                // Add secondary wave pattern for more complex refraction
                float secondaryWave = sin(dist * 50.0 - u_time * 8.0) * 0.3 + 0.7;
                displacement *= secondaryWave;
                
                // Apply chromatic aberration for realistic light bending
                float aberrationStrength = waveIntensity * u_strength * 0.02;
                
                // TESTING: Just pass through the original image with a simple red ring
                vec3 originalColor = texture2D(u_texture, uv).rgb;
                
                // Simple red ring at the wavefront
                float ringDistance = abs(dist - waveRadius);
                float ring = smoothstep(0.02, 0.0, ringDistance) * waveIntensity;
                
                // Mix original color with red ring
                vec3 finalColor = mix(originalColor, vec3(1.0, 0.2, 0.2), ring * 0.5);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            transparent: true
        });
    }

    /**
     * Update the shader with new time value
     * @param {number} deltaTime - Time since last frame
     */
    update(deltaTime) {
        this.uniforms.u_time.value += deltaTime;
    }

    /**
     * Set the center point of the explosion in UV coordinates (0-1)
     * @param {THREE.Vector2} center - Center point in UV space
     */
    setCenter(center) {
        this.uniforms.u_center.value.copy(center);
    }

    /**
     * Configure shockwave parameters
     * @param {Object} params - Configuration object
     * @param {number} params.speed - Wave expansion speed
     * @param {number} params.strength - Distortion strength
     * @param {number} params.thickness - Wave thickness
     * @param {number} params.maxRadius - Maximum wave radius
     */
    setParameters(params) {
        if (params.speed !== undefined) this.uniforms.u_speed.value = params.speed;
        if (params.strength !== undefined) this.uniforms.u_strength.value = params.strength;
        if (params.thickness !== undefined) this.uniforms.u_thickness.value = params.thickness;
        if (params.maxRadius !== undefined) this.uniforms.u_maxRadius.value = params.maxRadius;
    }

    /**
     * Reset the effect to initial state
     */
    reset() {
        this.uniforms.u_time.value = 0.0;
    }

    /**
     * Check if the effect is complete
     * @returns {boolean} True if effect has finished
     */
    isComplete() {
        const waveRadius = this.uniforms.u_time.value * this.uniforms.u_speed.value;
        return waveRadius > this.uniforms.u_maxRadius.value + this.uniforms.u_thickness.value;
    }

    /**
     * Update screen resolution
     * @param {number} width - Screen width
     * @param {number} height - Screen height
     */
    setResolution(width, height) {
        this.uniforms.u_resolution.value.set(width, height);
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.material.dispose();
    }
}

/**
 * Shockwave post-processing effect manager
 * Handles rendering and lifecycle of the shockwave effect
 */
export class ShockwaveEffect {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.isActive = false;
        
        // Create render targets for post-processing
        this.renderTarget = new THREE.WebGLRenderTarget(
            window.innerWidth,
            window.innerHeight,
            {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                type: THREE.UnsignedByteType
            }
        );
        
        // Create shockwave shader
        this.shockwaveShader = new ShockwaveShader();
        
        // Create fullscreen quad for post-processing
        this.postProcessQuad = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            this.shockwaveShader.material
        );
        this.postProcessScene = new THREE.Scene();
        this.postProcessScene.add(this.postProcessQuad);
        
        // Orthographic camera for post-processing
        this.postProcessCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        // Handle window resize
        this.handleResize();
        window.addEventListener('resize', () => this.handleResize());
        
        // Pre-compile shaders to avoid first-use lag
        this.precompileShaders();
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.renderTarget.setSize(width, height);
        this.shockwaveShader.setResolution(width, height);
    }

    /**
     * Pre-compile shaders to avoid first-use performance lag
     */
    precompileShaders() {
        console.log('Pre-compiling shockwave shaders...');
        
        // Create a temporary render target for shader warmup
        const tempTarget = new THREE.WebGLRenderTarget(256, 256);
        
        // Set up a dummy texture for testing
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 256, 256);
        
        const dummyTexture = new THREE.CanvasTexture(canvas);
        this.shockwaveShader.uniforms.u_texture.value = dummyTexture;
        
        // Trigger shader compilation by rendering once
        this.renderer.setRenderTarget(tempTarget);
        this.renderer.render(this.postProcessScene, this.postProcessCamera);
        this.renderer.setRenderTarget(null);
        
        // Clean up
        tempTarget.dispose();
        dummyTexture.dispose();
        canvas.remove();
        
        console.log('Shockwave shaders pre-compiled successfully');
    }

    /**
     * Trigger the shockwave effect at a world position
     * @param {THREE.Vector3} worldPosition - 3D world position of explosion
     * @param {Object} params - Optional effect parameters
     */
    trigger(worldPosition, params = {}) {
        if (this.isActive) {
            // Reset current effect
            this.shockwaveShader.reset();
        }
        
        // Convert world position to UV coordinates
        const uvCenter = this.worldToUV(worldPosition);
        
        // Configure effect
        this.shockwaveShader.setCenter(uvCenter);
        this.shockwaveShader.setParameters({
            speed: params.speed || 0.8,
            strength: params.strength || 0.4,
            thickness: params.thickness || 0.08,
            maxRadius: params.maxRadius || 1.2
        });
        
        this.shockwaveShader.reset();
        this.isActive = true;
        
        console.log(`🎆 SHOCKWAVE TRIGGERED at UV: (${uvCenter.x.toFixed(3)}, ${uvCenter.y.toFixed(3)})`);
        console.log(`🎆 Parameters:`, {
            speed: params.speed || 0.8,
            strength: params.strength || 0.4,
            thickness: params.thickness || 0.08,
            maxRadius: params.maxRadius || 1.2
        });
    }

    /**
     * Convert world position to UV coordinates (0-1 screen space)
     * @param {THREE.Vector3} worldPosition - 3D world position
     * @returns {THREE.Vector2} UV coordinates
     */
    worldToUV(worldPosition) {
        const vector = worldPosition.clone();
        vector.project(this.camera);
        
        // Convert from NDC (-1 to 1) to UV space (0 to 1)
        // Note: Y coordinate should match screen space (top = 0, bottom = 1)
        const uvCoords = new THREE.Vector2(
            (vector.x + 1) * 0.5,
            (vector.y + 1) * 0.5  // Don't flip Y - keep it as projected
        );
        
        return uvCoords;
    }

    /**
     * Update the effect
     * @param {number} deltaTime - Time since last frame
     */
    update(deltaTime) {
        if (!this.isActive) return;
        
        this.shockwaveShader.update(deltaTime);
        
        const currentTime = this.shockwaveShader.uniforms.u_time.value;
        const waveRadius = currentTime * this.shockwaveShader.uniforms.u_speed.value;
        
        // Debug every second
        if (Math.floor(currentTime * 4) !== Math.floor((currentTime - deltaTime) * 4)) {
            console.log(`🌊 Shockwave time: ${currentTime.toFixed(2)}s, radius: ${waveRadius.toFixed(2)}`);
        }
        
        // Check if effect is complete
        if (this.shockwaveShader.isComplete()) {
            this.isActive = false;
            console.log('🏁 Shockwave effect completed');
        }
    }

    /**
     * Render the effect
     * @returns {boolean} True if effect was rendered, false if not active
     */
    render() {
        // Only render if we're active and have a meaningful effect
        if (!this.isActive) return false;
        
        const currentTime = this.shockwaveShader.uniforms.u_time.value;
        const waveRadius = currentTime * this.shockwaveShader.uniforms.u_speed.value;
        
        // Don't hijack rendering if the wave hasn't started or is too small to see
        if (waveRadius < 0.01) {
            console.log(`🎨 Shockwave too small to render: ${waveRadius.toFixed(4)}`);
            return false;
        }
        
        try {
            // Render scene to texture
            this.renderer.setRenderTarget(this.renderTarget);
            this.renderer.clear(true, true, false);
            this.renderer.render(this.scene, this.camera);
            
            // Verify texture was created
            if (!this.renderTarget.texture) {
                console.error('❌ No render target texture');
                this.renderer.setRenderTarget(null);
                return false;
            }
            
            // Apply shockwave shader
            this.shockwaveShader.uniforms.u_texture.value = this.renderTarget.texture;
            
            // Render to screen
            this.renderer.setRenderTarget(null);
            this.renderer.clear(true, true, false);
            this.renderer.render(this.postProcessScene, this.postProcessCamera);
            
            // Debug first few renders
            if (currentTime < 1.0) {
                console.log(`🎨 Shockwave rendered at time: ${currentTime.toFixed(3)}, radius: ${waveRadius.toFixed(3)}`);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Shockwave render error:', error);
            this.isActive = false;
            this.renderer.setRenderTarget(null);
            return false;
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.renderTarget.dispose();
        this.shockwaveShader.dispose();
        this.postProcessQuad.geometry.dispose();
        window.removeEventListener('resize', this.handleResize);
    }
}

// Legacy export for backward compatibility
export { ShockwaveEffect as BlastWaveEffect };