import * as THREE from 'three';

/**
 * GPU-based Particle System
 * Uses compute shaders for high-performance particle simulation
 */
export class GPUParticleSystem {
    constructor(scene, maxParticles = 10000) {
        this.scene = scene;
        this.maxParticles = maxParticles;
        this.currentTime = 0;
        
        this.initializeGPUParticles();
        this.setupRenderTarget();
    }
    
    initializeGPUParticles() {
        // Create texture to store particle data (position, velocity, life, etc.)
        const width = Math.ceil(Math.sqrt(this.maxParticles));
        const height = width;
        
        // Position texture (RGBA = x, y, z, life)
        this.positionTexture = this.createDataTexture(width, height);
        this.velocityTexture = this.createDataTexture(width, height);
        
        // Create geometry for particle rendering
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.maxParticles * 3);
        const uvs = new Float32Array(this.maxParticles * 2);
        const indices = new Float32Array(this.maxParticles);
        
        for (let i = 0; i < this.maxParticles; i++) {
            // Initial positions (will be overridden by shader)
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            // UV coordinates for texture lookup
            const u = (i % width) / width;
            const v = Math.floor(i / width) / height;
            
            uvs[i * 2] = u;
            uvs[i * 2 + 1] = v;
            
            indices[i] = i;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('particleUV', new THREE.BufferAttribute(uvs, 2));
        geometry.setAttribute('particleIndex', new THREE.BufferAttribute(indices, 1));
        
        // Particle render material with enhanced visuals
        const material = new THREE.ShaderMaterial({
            uniforms: {
                positionTexture: { value: this.positionTexture },
                velocityTexture: { value: this.velocityTexture },
                time: { value: 0 },
                size: { value: 2.0 },
                sparkleTexture: { value: this.createSparkleTexture() }
            },
            vertexShader: `
                uniform sampler2D positionTexture;
                uniform sampler2D velocityTexture;
                uniform float time;
                uniform float size;
                
                attribute vec2 particleUV;
                
                varying vec4 vColor;
                varying float vLife;
                varying vec2 vUv;
                varying float vIntensity;
                varying float vSpeed;
                
                // HSV to RGB conversion
                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }
                
                void main() {
                    vec4 positionData = texture2D(positionTexture, particleUV);
                    vec4 velocityData = texture2D(velocityTexture, particleUV);
                    
                    vec3 pos = positionData.xyz;
                    float life = positionData.w;
                    vec3 velocity = velocityData.xyz;
                    float hue = velocityData.w;
                    
                    vLife = life;
                    vUv = particleUV;
                    
                    // Calculate speed for intensity effects
                    vSpeed = length(velocity);
                    vIntensity = (vSpeed * 0.1) + (life * 0.8) + 0.2;
                    
                    // Enhanced color with saturation and brightness variations
                    float saturation = 0.8 + sin(time + hue * 10.0) * 0.2;
                    float brightness = 0.9 + cos(time * 2.0 + hue * 5.0) * 0.1;
                    vec3 baseColor = hsv2rgb(vec3(hue, saturation, brightness));
                    
                    // Add energy-based color shifts
                    float energy = vSpeed * 0.1;
                    vec3 energyColor = mix(baseColor, vec3(1.0, 0.8, 0.2), energy * 0.3);
                    
                    // Rainbow shimmer effect
                    float shimmer = sin(time * 8.0 + pos.x * 2.0 + pos.y * 3.0) * 0.5 + 0.5;
                    vec3 shimmerColor = hsv2rgb(vec3(fract(hue + shimmer * 0.2), 1.0, 1.0));
                    
                    vColor = vec4(mix(energyColor, shimmerColor, shimmer * 0.3), life);
                    
                    // Add particle movement and floating effect
                    vec3 animatedPos = pos;
                    animatedPos.y += sin(time * 3.0 + pos.x * 5.0) * 0.1 * life;
                    animatedPos.x += cos(time * 2.5 + pos.y * 4.0) * 0.05 * life;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(animatedPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Dynamic size with pulsing effect
                    float pulseSize = 1.0 + sin(time * 6.0 + hue * 10.0) * 0.3;
                    float lifeSize = smoothstep(0.0, 0.2, life) * smoothstep(1.0, 0.8, life);
                    float baseSize = size * pulseSize * (0.3 + lifeSize * 0.7);
                    
                    gl_PointSize = baseSize * vIntensity * 100.0 / (-mvPosition.z);
                    gl_PointSize = clamp(gl_PointSize, 8.0, 120.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform sampler2D sparkleTexture;
                
                varying vec4 vColor;
                varying float vLife;
                varying vec2 vUv;
                varying float vIntensity;
                varying float vSpeed;
                
                // Random function
                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
                }
                
                // Noise function
                float noise(vec2 st) {
                    vec2 i = floor(st);
                    vec2 f = fract(st);
                    float a = random(i);
                    float b = random(i + vec2(1.0, 0.0));
                    float c = random(i + vec2(0.0, 1.0));
                    float d = random(i + vec2(1.0, 1.0));
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
                }
                
                void main() {
                    if (vLife <= 0.0) discard;
                    
                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center);
                    
                    // Multiple ring effects
                    float outerRing = smoothstep(0.5, 0.45, dist);
                    float innerRing = smoothstep(0.35, 0.25, dist);
                    float core = smoothstep(0.2, 0.0, dist);
                    
                    if (outerRing == 0.0) discard;
                    
                    // Sparkle effect using noise
                    float sparkleNoise = noise(gl_PointCoord * 8.0 + time * 2.0);
                    float sparkle = step(0.7, sparkleNoise) * 0.8;
                    
                    // Energy ripples
                    float angle = atan(center.y, center.x);
                    float ripple = sin(dist * 20.0 - time * 8.0 + angle * 3.0) * 0.5 + 0.5;
                    ripple *= smoothstep(0.5, 0.3, dist);
                    
                    // Rotating energy beams
                    float beamAngle = mod(angle + time * 3.0, 6.28318530718);
                    float beam = abs(sin(beamAngle * 4.0)) * smoothstep(0.5, 0.2, dist);
                    
                    // Color composition
                    vec3 finalColor = vColor.rgb;
                    
                    // Add hot center
                    finalColor = mix(finalColor, vec3(1.0, 0.9, 0.7), core * 0.8);
                    
                    // Add energy effects
                    finalColor += vec3(0.2, 0.4, 1.0) * ripple * vIntensity;
                    finalColor += vec3(1.0, 0.6, 0.2) * beam * vSpeed * 0.5;
                    finalColor += vec3(1.0, 1.0, 1.0) * sparkle;
                    
                    // Outer glow
                    float glow = smoothstep(0.5, 0.3, dist) * vLife;
                    
                    // Fresnel-like edge lighting
                    float fresnel = 1.0 - smoothstep(0.0, 0.5, dist);
                    finalColor += vColor.rgb * fresnel * 0.3;
                    
                    // Final alpha with multiple layers - much more transparent
                    float alpha = outerRing * vLife * 0.3; // Reduced from 1.0 to 0.3
                    alpha += innerRing * vLife * 0.2; // Reduced from 0.8 to 0.2
                    alpha += core * vLife * 0.25; // Reduced from 0.9 to 0.25
                    alpha += glow * 0.15; // Reduced from 0.4 to 0.15
                    alpha += ripple * 0.1; // Reduced from 0.3 to 0.1
                    alpha += beam * 0.05; // Reduced from 0.2 to 0.05
                    
                    // Enhanced transparency for better bubble visibility
                    alpha *= 0.4; // Global transparency multiplier
                    
                    // Add refractive shimmer effect
                    float refractiveShimmer = sin(time * 5.0 + gl_PointCoord.x * 10.0) * 0.1;
                    alpha += refractiveShimmer * vLife * 0.1;
                    
                    // Clamp and apply intensity with enhanced transparency
                    alpha = clamp(alpha * vIntensity * 0.6, 0.0, 0.5); // Max alpha of 0.5
                    finalColor = clamp(finalColor, 0.0, 2.0);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.NormalBlending, // Changed from Additive to Normal for better transparency
            depthWrite: false,
            depthTest: true,
            alphaTest: 0.01, // Prevent z-fighting
            vertexColors: false
        });
        
        this.particlesMesh = new THREE.Points(geometry, material);
        this.scene.add(this.particlesMesh);
    }
    
    createDataTexture(width, height) {
        const size = width * height;
        const data = new Float32Array(size * 4);
        
        // Initialize with dead particles (life = 0)
        for (let i = 0; i < size; i++) {
            data[i * 4 + 3] = 0; // life = 0
        }
        
        const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
        texture.needsUpdate = true;
        return texture;
    }
    
    setupRenderTarget() {
        // Set up render targets for position/velocity updates
        const width = Math.ceil(Math.sqrt(this.maxParticles));
        const height = width;
        
        this.renderTargets = {
            position: [
                new THREE.WebGLRenderTarget(width, height, {
                    format: THREE.RGBAFormat,
                    type: THREE.FloatType,
                    minFilter: THREE.NearestFilter,
                    magFilter: THREE.NearestFilter
                }),
                new THREE.WebGLRenderTarget(width, height, {
                    format: THREE.RGBAFormat,
                    type: THREE.FloatType,
                    minFilter: THREE.NearestFilter,
                    magFilter: THREE.NearestFilter
                })
            ],
            velocity: [
                new THREE.WebGLRenderTarget(width, height, {
                    format: THREE.RGBAFormat,
                    type: THREE.FloatType,
                    minFilter: THREE.NearestFilter,
                    magFilter: THREE.NearestFilter
                }),
                new THREE.WebGLRenderTarget(width, height, {
                    format: THREE.RGBAFormat,
                    type: THREE.FloatType,
                    minFilter: THREE.NearestFilter,
                    magFilter: THREE.NearestFilter
                })
            ]
        };
        
        this.currentIndex = 0;
    }
    
    createSparkleTexture() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // Create sparkle pattern
        const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.3, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.7, 'rgba(255,255,255,0.2)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    
    spawnParticles(position, velocity, color, count = 10) {
        // Update position and velocity textures to spawn new particles
        const width = Math.ceil(Math.sqrt(this.maxParticles));
        const positionData = this.positionTexture.image.data;
        const velocityData = this.velocityTexture.image.data;
        
        let spawned = 0;
        
        // Find dead particles and spawn new ones
        for (let i = 0; i < this.maxParticles && spawned < count; i++) {
            const idx = i * 4;
            
            // Check if particle is dead (life <= 0)
            if (positionData[idx + 3] <= 0) {
                // Position with some spread
                const spread = 0.3;
                positionData[idx] = position.x + (Math.random() - 0.5) * spread;
                positionData[idx + 1] = position.y + (Math.random() - 0.5) * spread;
                positionData[idx + 2] = position.z + (Math.random() - 0.5) * spread;
                positionData[idx + 3] = 0.8 + Math.random() * 0.4; // varied initial life
                
                // Enhanced velocity with more variation
                let velX, velY, velZ;
                if (velocity) {
                    // Add more dramatic velocity variations
                    const speedMultiplier = 0.5 + Math.random() * 1.5;
                    const angle = Math.random() * Math.PI * 2;
                    const deviation = (Math.random() - 0.5) * Math.PI * 0.5;
                    
                    velX = velocity.x * speedMultiplier + Math.cos(angle) * 3;
                    velY = velocity.y * speedMultiplier + Math.sin(angle) * 3;
                    velZ = velocity.z * speedMultiplier + (Math.random() - 0.5) * 4;
                } else {
                    // Explosive pattern for default particles
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 5 + Math.random() * 10;
                    velX = Math.cos(angle) * speed;
                    velY = Math.sin(angle) * speed;
                    velZ = (Math.random() - 0.5) * 8;
                }
                
                velocityData[idx] = velX;
                velocityData[idx + 1] = velY;
                velocityData[idx + 2] = velZ;
                
                // Enhanced color with more vibrant hues
                const colorObj = new THREE.Color(color);
                const hsl = colorObj.getHSL({});
                // Add some color variation
                const hueVariation = (Math.random() - 0.5) * 0.2;
                const finalHue = (hsl.h + hueVariation + 1) % 1;
                velocityData[idx + 3] = finalHue;
                
                spawned++;
            }
        }
        
        this.positionTexture.needsUpdate = true;
        this.velocityTexture.needsUpdate = true;
        
        return spawned;
    }
    
    // Add compatibility method to match CPU particle interface
    spawn(x, y, z, color, size, velocity = null) {
        const pos = new THREE.Vector3(x, y, z);
        const vel = velocity || new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 5
        );
        
        this.spawnParticles(pos, vel, color, 1);
        
        // Return a dummy particle object for compatibility
        return {
            position: pos,
            velocity: vel,
            life: 1.0,
            active: true,
            decay: 0.02 // Default decay for compatibility
        };
    }
    
    // Enhanced spawning method for power-based effects
    spawnPowerParticles(position, velocity, color, count, power = 0) {
        // Enhanced spawning with power scaling
        const width = Math.ceil(Math.sqrt(this.maxParticles));
        const positionData = this.positionTexture.image.data;
        const velocityData = this.velocityTexture.image.data;
        
        let spawned = 0;
        
        // Find dead particles and spawn new ones
        for (let i = 0; i < this.maxParticles && spawned < count; i++) {
            const idx = i * 4;
            
            // Check if particle is dead (life <= 0)
            if (positionData[idx + 3] <= 0) {
                // Position with power-based spread
                const spread = 0.2 + power * 0.4;
                positionData[idx] = position.x + (Math.random() - 0.5) * spread;
                positionData[idx + 1] = position.y + (Math.random() - 0.5) * spread;
                positionData[idx + 2] = position.z + (Math.random() - 0.5) * spread;
                
                // Power-based initial life (higher power = longer lasting)
                positionData[idx + 3] = 0.7 + Math.random() * 0.3 + power * 0.5;
                
                // Enhanced velocity with power scaling
                let velX, velY, velZ;
                if (velocity) {
                    // Power multiplies base velocity
                    const speedMultiplier = (0.8 + Math.random() * 0.4) * (1 + power * 3);
                    const angle = Math.random() * Math.PI * 2;
                    const powerDeviation = power * Math.PI * 0.3;
                    
                    velX = velocity.x * speedMultiplier + Math.cos(angle) * (2 + power * 8);
                    velY = velocity.y * speedMultiplier + Math.sin(angle) * (2 + power * 8);
                    velZ = velocity.z * speedMultiplier + (Math.random() - 0.5) * (3 + power * 6);
                } else {
                    // Explosive pattern with power scaling
                    const angle = Math.random() * Math.PI * 2;
                    const speed = (5 + Math.random() * 10) * (1 + power * 2);
                    velX = Math.cos(angle) * speed;
                    velY = Math.sin(angle) * speed;
                    velZ = (Math.random() - 0.5) * speed;
                }
                
                velocityData[idx] = velX;
                velocityData[idx + 1] = velY;
                velocityData[idx + 2] = velZ;
                
                // Enhanced color with power-based intensity
                const colorObj = new THREE.Color(color);
                const hsl = colorObj.getHSL({});
                
                // Power affects color intensity and variation
                const hueVariation = (Math.random() - 0.5) * (0.1 + power * 0.3);
                const saturationBoost = power * 0.2;
                const brightnessBoost = power * 0.3;
                
                let finalHue = (hsl.h + hueVariation + 1) % 1;
                
                // For high power, shift towards hot colors (orange/yellow)
                if (power > 0.5) {
                    const hotShift = (power - 0.5) * 0.4;
                    finalHue = (finalHue + hotShift) % 1;
                }
                
                velocityData[idx + 3] = finalHue;
                
                spawned++;
            }
        }
        
        this.positionTexture.needsUpdate = true;
        this.velocityTexture.needsUpdate = true;
        
        return spawned;
    }
    
    update(deltaTime, renderer) {
        this.currentTime += deltaTime;
        
        // Update shader uniforms
        this.particlesMesh.material.uniforms.time.value = this.currentTime;
        
        // Update particles on CPU for now (WebGPU would use compute shaders)
        const positionData = this.positionTexture.image.data;
        const velocityData = this.velocityTexture.image.data;
        
        for (let i = 0; i < this.maxParticles; i++) {
            const idx = i * 4;
            
            // Only update alive particles
            if (positionData[idx + 3] > 0) {
                const life = positionData[idx + 3];
                
                // Update position
                positionData[idx] += velocityData[idx] * deltaTime;
                positionData[idx + 1] += velocityData[idx + 1] * deltaTime;
                positionData[idx + 2] += velocityData[idx + 2] * deltaTime;
                
                // Enhanced physics
                // Apply gravity with some variation
                const gravityStrength = 8.0 + Math.sin(this.currentTime + i * 0.1) * 2.0;
                velocityData[idx + 1] -= gravityStrength * deltaTime;
                
                // Add some turbulence
                const turbulence = 0.5;
                velocityData[idx] += Math.sin(this.currentTime * 3.0 + i * 0.2) * turbulence * deltaTime;
                velocityData[idx + 2] += Math.cos(this.currentTime * 2.5 + i * 0.3) * turbulence * deltaTime;
                
                // Variable decay rate based on speed
                const speed = Math.sqrt(velocityData[idx] * velocityData[idx] + 
                                      velocityData[idx + 1] * velocityData[idx + 1] + 
                                      velocityData[idx + 2] * velocityData[idx + 2]);
                const decayRate = 0.4 + speed * 0.02; // Faster particles decay faster
                positionData[idx + 3] -= deltaTime * decayRate;
                
                // Enhanced damping based on life
                const dampingFactor = 0.995 - (1.0 - life) * 0.02;
                velocityData[idx] *= dampingFactor;
                velocityData[idx + 1] *= dampingFactor;
                velocityData[idx + 2] *= dampingFactor;
            }
        }
        
        this.positionTexture.needsUpdate = true;
        this.velocityTexture.needsUpdate = true;
    }
    
    // Add method to clear all particles
    clear() {
        const positionData = this.positionTexture.image.data;
        
        for (let i = 0; i < this.maxParticles; i++) {
            positionData[i * 4 + 3] = 0; // Set life to 0
        }
        
        this.positionTexture.needsUpdate = true;
    }
    
    // Add scene management methods for compatibility
    addToScene(scene) {
        if (!this.particlesMesh.parent) {
            scene.add(this.particlesMesh);
        }
    }
    
    removeFromScene(scene) {
        scene.remove(this.particlesMesh);
    }
}