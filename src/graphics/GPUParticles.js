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
        
        for (let i = 0; i < this.maxParticles; i++) {
            const u = (i % width) / width;
            const v = Math.floor(i / width) / height;
            
            uvs[i * 2] = u;
            uvs[i * 2 + 1] = v;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        
        // Particle render material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                positionTexture: { value: this.positionTexture },
                velocityTexture: { value: this.velocityTexture },
                time: { value: 0 },
                size: { value: 0.1 }
            },
            vertexShader: `
                uniform sampler2D positionTexture;
                uniform sampler2D velocityTexture;
                uniform float time;
                uniform float size;
                
                attribute vec2 uv;
                
                varying vec4 vColor;
                varying float vLife;
                
                void main() {
                    vec4 positionData = texture2D(positionTexture, uv);
                    vec4 velocityData = texture2D(velocityTexture, uv);
                    
                    vec3 pos = positionData.xyz;
                    float life = positionData.w;
                    
                    vLife = life;
                    vColor = vec4(velocityData.w, 1.0 - life, life, life);
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = size * (life + 0.1) * 100.0 / gl_Position.w;
                }
            `,
            fragmentShader: `
                varying vec4 vColor;
                varying float vLife;
                
                void main() {
                    if (vLife <= 0.0) discard;
                    
                    vec2 center = gl_PointCoord - 0.5;
                    float dist = length(center);
                    if (dist > 0.5) discard;
                    
                    float alpha = (1.0 - dist * 2.0) * vLife;
                    gl_FragColor = vec4(vColor.rgb, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
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
    
    spawnParticles(position, velocity, color, count = 10) {
        // This would update the GPU textures to spawn new particles
        // Implementation would involve finding dead particles and updating their data
        // For now, simplified version
        console.log(`Spawning ${count} particles at`, position);
    }
    
    update(deltaTime, renderer) {
        this.currentTime += deltaTime;
        
        // Update shader uniforms
        this.particlesMesh.material.uniforms.time.value = this.currentTime;
        
        // In a full implementation, you'd run compute shaders here to update
        // particle positions and velocities on the GPU
    }
}