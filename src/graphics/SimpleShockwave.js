import * as THREE from 'three';

/**
 * Enhanced shockwave effect using a custom shader material
 * Creates realistic light-bending distortion without hijacking the render pipeline
 */
export class SimpleShockwaveEffect {
    constructor(scene, renderer, camera) {
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;
        this.isActive = false;
        this.shockwaveMesh = null;
        this.startTime = 0;
        this.duration = 2.0;
        this.maxRadius = 15.0;
        this.position = new THREE.Vector3();
        
        this.createShockwaveMesh();
    }
    
    createShockwaveMesh() {
        // Create a larger ring geometry for better coverage
        const innerRadius = 0.85;
        const outerRadius = 1.15;
        const segments = 128;
        
        const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
        
        // Create custom shader material for distortion effect
        const shaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                opacity: { value: 1.0 },
                distortionStrength: { value: 0.3 },
                waveIntensity: { value: 1.0 },
                centerPosition: { value: new THREE.Vector2(0.5, 0.5) },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vWorldPosition;
                varying vec4 vScreenPosition;
                
                void main() {
                    vUv = uv;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    vScreenPosition = gl_Position;
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform float opacity;
                uniform float distortionStrength;
                uniform float waveIntensity;
                uniform vec2 centerPosition;
                uniform vec2 resolution;
                
                varying vec2 vUv;
                varying vec3 vWorldPosition;
                varying vec4 vScreenPosition;
                
                // Heat distortion function
                float distortion(vec2 uv, float strength) {
                    return sin(uv.x * 20.0 + time * 8.0) * sin(uv.y * 15.0 + time * 6.0) * strength;
                }
                
                void main() {
                    vec2 uv = vUv;
                    
                    // Calculate distance from ring center for wave intensity
                    float distFromCenter = distance(uv, vec2(0.5, 0.5));
                    
                    // Create sharp wavefront effect
                    float ringEffect = smoothstep(0.15, 0.05, abs(distFromCenter - 0.5));
                    
                    // Add heat shimmer distortion
                    float shimmer = distortion(uv, distortionStrength) * ringEffect;
                    
                    // Create color based on wave intensity and time
                    float hue = 0.6 + sin(time * 3.0) * 0.2; // Blue to cyan oscillation
                    vec3 color = vec3(
                        0.3 + shimmer * 0.5,
                        0.7 + shimmer * 0.3,
                        1.0 + shimmer * 0.2
                    );
                    
                    // Add bright flash at the wave edge
                    float flash = ringEffect * waveIntensity;
                    color += vec3(flash * 0.8, flash * 0.9, flash);
                    
                    // Add energy ripples
                    float ripple = sin(distFromCenter * 30.0 - time * 12.0) * 0.5 + 0.5;
                    color += vec3(ripple * ringEffect * 0.3);
                    
                    // Final opacity combines ring effect with overall opacity
                    float finalOpacity = ringEffect * opacity * waveIntensity;
                    
                    gl_FragColor = vec4(color, finalOpacity);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.shockwaveMesh = new THREE.Mesh(geometry, shaderMaterial);
        this.shockwaveMesh.visible = false;
        
        // Store reference to material for easy updates
        this.shaderMaterial = shaderMaterial;
    }
    
    trigger(worldPosition, params = {}) {
        // Simple shockwave triggered
        
        this.position.copy(worldPosition);
        this.startTime = 0;
        this.duration = params.duration || 2.0;
        this.maxRadius = params.maxRadius || 15.0;
        this.isActive = true;
        
        // Position the mesh
        this.shockwaveMesh.position.copy(worldPosition);
        this.shockwaveMesh.scale.setScalar(0.1);
        this.shockwaveMesh.visible = true;
        
        // Add to scene if not already there
        if (!this.scene.children.includes(this.shockwaveMesh)) {
            this.scene.add(this.shockwaveMesh);
        }
    }
    
    update(deltaTime) {
        if (!this.isActive) return;
        
        this.startTime += deltaTime;
        const progress = this.startTime / this.duration;
        
        if (progress >= 1.0) {
            this.isActive = false;
            this.shockwaveMesh.visible = false;
            // Enhanced shockwave completed
            return;
        }
        
        // Update shader uniforms for animation
        this.shaderMaterial.uniforms.time.value = this.startTime;
        
        // Animate the ring expansion with easing
        const easedProgress = 1.0 - Math.pow(1.0 - progress, 3); // Ease out cubic
        const scale = easedProgress * this.maxRadius;
        this.shockwaveMesh.scale.setScalar(scale);
        
        // Fade out over time with non-linear curve
        const fadeStart = 0.3; // Start fading after 30% of duration
        let opacity = 1.0;
        if (progress > fadeStart) {
            const fadeProgress = (progress - fadeStart) / (1.0 - fadeStart);
            opacity = 1.0 - fadeProgress * fadeProgress; // Quadratic fade
        }
        this.shaderMaterial.uniforms.opacity.value = opacity;
        
        // Increase distortion strength over time then fade
        const distortionPeak = 0.6; // Peak distortion at 60% of duration
        let distortionStrength;
        if (progress < distortionPeak) {
            distortionStrength = (progress / distortionPeak) * 0.8;
        } else {
            distortionStrength = 0.8 * (1.0 - (progress - distortionPeak) / (1.0 - distortionPeak));
        }
        this.shaderMaterial.uniforms.distortionStrength.value = distortionStrength;
        
        // Wave intensity pulses
        const waveIntensity = 0.8 + 0.4 * Math.sin(this.startTime * 8.0);
        this.shaderMaterial.uniforms.waveIntensity.value = waveIntensity;
        
        // Debug output for first few frames
        if (this.startTime < 0.5) {
            // Shockwave animation in progress
        }
    }
    
    /**
     * Dispose of all resources to prevent memory leaks
     */
    dispose() {
        // Remove from scene
        if (this.shockwaveMesh) {
            if (this.shockwaveMesh.parent) {
                this.shockwaveMesh.parent.remove(this.shockwaveMesh);
            }
            
            // Dispose geometry
            if (this.shockwaveMesh.geometry) {
                this.shockwaveMesh.geometry.dispose();
            }
            
            // Dispose material
            if (this.shaderMaterial) {
                this.shaderMaterial.dispose();
            }
            
            this.shockwaveMesh = null;
        }
        
        // Clear references
        this.shaderMaterial = null;
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.position = null;
        this.isActive = false;
    }
}