import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Game Board
 * Creates and manages the visual game board elements (starfield, walls, danger line)
 */
export class GameBoard {
    constructor(scene, gameState) {
        this.scene = scene;
        this.gameState = gameState;
        this.starfieldLayers = [];
        this.shootingStars = [];
        this.nebula = null;
        this.heatHaze = null;
        this.dangerField = null;
    }
    
    create() {
        this.createStarfield();
        this.createNebula();
        this.createHeatHaze();
        this.createShootingStars();
        this.createWalls();
        this.createCeiling();
        this.createDangerLine();
    }
    
    createStarfield() {
        // Create multi-layer starfield
        this.starfieldLayers = [
            new StarfieldLayer(this.scene, 100, 2.0, 0.5, 20),  // Far background
            new StarfieldLayer(this.scene, 75, 1.5, 1.0, 15),   // Middle layer
            new StarfieldLayer(this.scene, 50, 1.0, 1.5, 10)    // Near layer
        ];
        this.gameState.starfieldLayers = this.starfieldLayers;
    }
    
    createNebula() {
        const nebulaGeometry = new THREE.PlaneGeometry(60, 40);
        const nebulaMaterial = new THREE.MeshBasicMaterial({
            map: this.createNebulaTexture(),
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        this.nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
        this.nebula.position.z = -30;
        this.scene.add(this.nebula);
        this.gameState.nebula = this.nebula;
    }
    
    createNebulaTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Create multiple gradients for nebula effect
        const gradient1 = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        gradient1.addColorStop(0, 'rgba(100, 50, 200, 0.2)');
        gradient1.addColorStop(0.5, 'rgba(50, 30, 150, 0.1)');
        gradient1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, 512, 512);
        
        const gradient2 = ctx.createRadialGradient(384, 384, 0, 384, 384, 150);
        gradient2.addColorStop(0, 'rgba(200, 50, 100, 0.2)');
        gradient2.addColorStop(0.5, 'rgba(150, 30, 50, 0.1)');
        gradient2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient2;
        ctx.fillRect(0, 0, 512, 512);
        
        // Add some noise
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const radius = Math.random() * 50 + 10;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, `rgba(${Math.random() * 100 + 100}, ${Math.random() * 100 + 50}, ${Math.random() * 100 + 150}, 0.1)`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }
    
    createHeatHaze() {
        const heatHazeGeometry = new THREE.PlaneGeometry(50, 35);
        const heatHazeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                distortionStrength: { value: 0.02 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform float distortionStrength;
                varying vec2 vUv;
                
                void main() {
                    vec2 distortion = vec2(
                        sin(vUv.y * 10.0 + time * 0.5) * distortionStrength,
                        cos(vUv.x * 10.0 + time * 0.3) * distortionStrength
                    );
                    
                    float alpha = 0.05 * (0.5 + 0.5 * sin(time * 0.2));
                    gl_FragColor = vec4(0.5, 0.5, 1.0, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        
        const heatHaze = new THREE.Mesh(heatHazeGeometry, heatHazeMaterial);
        heatHaze.position.z = -25;
        this.scene.add(heatHaze);
        this.gameState.heatHaze = { mesh: heatHaze, material: heatHazeMaterial };
    }
    
    createShootingStars() {
        // Create a few shooting stars
        this.shootingStars = [];
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const star = new ShootingStar(this.scene);
                this.shootingStars.push(star);
            }, i * 3000 + Math.random() * 5000);
        }
        this.gameState.shootingStars = this.shootingStars;
    }
    
    createWalls() {
        const wallGeometry = new THREE.PlaneGeometry(0.5, 20);
        const wallMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x001133,
            metalness: 0.8,
            roughness: 0.2,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
        leftWall.position.set(-6, 0, -1);
        leftWall.rotation.y = Math.PI / 2;
        this.scene.add(leftWall);
        
        const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
        rightWall.position.set(6, 0, -1);
        rightWall.rotation.y = Math.PI / 2;
        this.scene.add(rightWall);
    }
    
    createCeiling() {
        const ceilingGeometry = new THREE.PlaneGeometry(12, 0.5);
        const ceilingMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x001133,
            metalness: 0.8,
            roughness: 0.2,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.position.set(0, CONFIG.CEILING_Y + 0.5, -1);
        this.scene.add(ceiling);
    }
    
    createDangerLine() {
        const dangerFieldGroup = new THREE.Group();
        
        // Main energy field plane
        const dangerGeometry = new THREE.PlaneGeometry(12, 0.5);
        const dangerMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(0xff0066) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color;
                varying vec2 vUv;
                
                void main() {
                    float wave = sin(vUv.x * 10.0 + time * 2.0) * 0.5 + 0.5;
                    float pulse = sin(time * 3.0) * 0.3 + 0.7;
                    float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
                    
                    vec3 fieldColor = mix(color, vec3(1.0, 0.0, 0.3), wave);
                    float alpha = edge * pulse * 0.8;
                    
                    gl_FragColor = vec4(fieldColor, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const dangerField = new THREE.Mesh(dangerGeometry, dangerMaterial);
        dangerField.position.set(0, CONFIG.DANGER_LINE, 0);
        dangerFieldGroup.add(dangerField);
        
        // Add energy particles
        const particleCount = 50;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleSizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            particlePositions[i * 3] = (Math.random() - 0.5) * 12;
            particlePositions[i * 3 + 1] = CONFIG.DANGER_LINE + (Math.random() - 0.5) * 0.5;
            particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 2;
            particleSizes[i] = Math.random() * 0.1 + 0.05;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xff00aa,
            size: 0.1,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        const dangerParticles = new THREE.Points(particleGeometry, particleMaterial);
        dangerFieldGroup.add(dangerParticles);
        
        this.scene.add(dangerFieldGroup);
        this.dangerField = { 
            group: dangerFieldGroup, 
            material: dangerMaterial, 
            particles: dangerParticles,
            particleCount: particleCount
        };
        this.gameState.dangerField = this.dangerField;
    }
    
    update(deltaTime, currentTime, mousePosition) {
        // Update starfield
        this.starfieldLayers.forEach(layer => {
            layer.update(deltaTime, mousePosition.x * 0.02, mousePosition.y * 0.02);
        });
        
        // Animate nebula
        if (this.nebula) {
            this.nebula.rotation.z = currentTime * 0.00005;
            this.nebula.material.opacity = 0.3 + Math.sin(currentTime * 0.0002) * 0.1;
        }
        
        // Update shooting stars
        this.shootingStars.forEach(star => {
            star.update(deltaTime);
        });
        
        // Update heat haze effect
        if (this.gameState.heatHaze) {
            this.gameState.heatHaze.material.uniforms.time.value = currentTime * 0.001;
        }
        
        // Animate danger field
        if (this.dangerField) {
            this.dangerField.material.uniforms.time.value = currentTime * 0.001;
            
            // Move particles
            const positions = this.dangerField.particles.geometry.attributes.position.array;
            for (let i = 0; i < this.dangerField.particleCount; i++) {
                positions[i * 3] += (Math.random() - 0.5) * 0.02;
                if (positions[i * 3] > 6) positions[i * 3] = -6;
                if (positions[i * 3] < -6) positions[i * 3] = 6;
            }
            this.dangerField.particles.geometry.attributes.position.needsUpdate = true;
        }
    }
}

/**
 * Starfield Layer
 */
class StarfieldLayer {
    constructor(scene, count, size, speed, depth, color = 0xffffff) {
        this.scene = scene;
        this.speed = speed;
        this.time = 0;
        
        // Create geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const twinklePhases = new Float32Array(count);
        
        // Color variations
        const colorVariations = [
            new THREE.Color(0xffffff), // White
            new THREE.Color(0xffffff), // White (more common)
            new THREE.Color(0xaaccff), // Blue
            new THREE.Color(0xffccaa), // Orange
            new THREE.Color(0xffaaaa)  // Red
        ];
        
        for (let i = 0; i < count; i++) {
            // Position
            positions[i * 3] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
            positions[i * 3 + 2] = -depth - Math.random() * 10;
            
            // Color
            const starColor = colorVariations[Math.floor(Math.random() * colorVariations.length)];
            colors[i * 3] = starColor.r;
            colors[i * 3 + 1] = starColor.g;
            colors[i * 3 + 2] = starColor.b;
            
            // Size
            sizes[i] = size * (0.5 + Math.random() * 1.5);
            
            // Twinkle phase
            twinklePhases[i] = Math.random() * Math.PI * 2;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Store attributes for animation
        this.positions = positions;
        this.sizes = sizes;
        this.baseSizes = new Float32Array(sizes);
        this.twinklePhases = twinklePhases;
        
        // Create material with vertex colors
        const material = new THREE.PointsMaterial({
            size: 1,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.9,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            map: this.createStarTexture()
        });
        
        this.points = new THREE.Points(geometry, material);
        scene.add(this.points);
    }
    
    createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        // Create gradient
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.4, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    update(deltaTime, mouseX, mouseY) {
        this.time += deltaTime;
        
        // Parallax movement based on mouse
        const parallaxX = mouseX * this.speed * 0.1;
        const parallaxY = mouseY * this.speed * 0.1;
        
        // Update positions for parallax
        for (let i = 0; i < this.positions.length / 3; i++) {
            // Gentle drift
            this.positions[i * 3] += Math.sin(this.time * 0.1 + i) * this.speed * deltaTime * 0.1;
            this.positions[i * 3 + 1] += Math.cos(this.time * 0.1 + i) * this.speed * deltaTime * 0.05;
            
            // Wrap around edges
            if (this.positions[i * 3] > 25) this.positions[i * 3] = -25;
            if (this.positions[i * 3] < -25) this.positions[i * 3] = 25;
            if (this.positions[i * 3 + 1] > 20) this.positions[i * 3 + 1] = -20;
            if (this.positions[i * 3 + 1] < -20) this.positions[i * 3 + 1] = 20;
            
            // Twinkle effect
            const twinkle = Math.sin(this.time * 3 + this.twinklePhases[i]) * 0.3 + 0.7;
            this.sizes[i] = this.baseSizes[i] * twinkle;
        }
        
        // Apply parallax to entire layer
        this.points.position.x = parallaxX;
        this.points.position.y = parallaxY;
        
        // Update buffers
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.size.needsUpdate = true;
    }
}

/**
 * Shooting Star
 */
class ShootingStar {
    constructor(scene) {
        this.scene = scene;
        this.reset();
    }
    
    reset() {
        this.position = new THREE.Vector3(
            (Math.random() - 0.5) * 60,
            10 + Math.random() * 20,
            -15 - Math.random() * 5
        );
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            -10 - Math.random() * 10,
            0
        );
        this.life = 1.0;
        this.trail = [];
        
        // Create shooting star mesh
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1
        });
        
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.scene.remove(this.mesh);
        }
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
        
        // Create trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(30 * 3);
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        
        const trailMaterial = new THREE.LineBasicMaterial({
            color: 0xaaccff,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });
        
        if (this.trailMesh) {
            this.trailMesh.geometry.dispose();
            this.trailMesh.material.dispose();
            this.scene.remove(this.trailMesh);
        }
        
        this.trailMesh = new THREE.Line(trailGeometry, trailMaterial);
        this.scene.add(this.trailMesh);
    }
    
    update(deltaTime) {
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.mesh.position.copy(this.position);
        
        // Update trail
        this.trail.unshift(this.position.clone());
        if (this.trail.length > 10) {
            this.trail.pop();
        }
        
        const positions = this.trailMesh.geometry.attributes.position.array;
        for (let i = 0; i < this.trail.length; i++) {
            positions[i * 3] = this.trail[i].x;
            positions[i * 3 + 1] = this.trail[i].y;
            positions[i * 3 + 2] = this.trail[i].z;
        }
        this.trailMesh.geometry.attributes.position.needsUpdate = true;
        
        // Fade out
        this.life -= deltaTime * 0.5;
        this.mesh.material.opacity = this.life;
        this.trailMesh.material.opacity = this.life * 0.6;
        
        // Reset if off screen or faded
        if (this.position.y < -20 || this.life <= 0) {
            this.reset();
        }
    }
    
    destroy() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        if (this.trailMesh) {
            this.scene.remove(this.trailMesh);
            this.trailMesh.geometry.dispose();
            this.trailMesh.material.dispose();
        }
    }
}