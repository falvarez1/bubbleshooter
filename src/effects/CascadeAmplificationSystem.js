import * as THREE from 'three';
import { ParticleFactory } from '../entities/Particle.js';

/**
 * Cascade Amplification System
 * Creates progressive visual effects that scale with combo size
 * 
 * Effect Tiers:
 * - Combo 1-3: Basic particle bursts
 * - Combo 4-6: Orbiting light sprites
 * - Combo 7-9: Sacred geometry patterns
 * - Combo 10+: TRANSCENDENCE MODE
 */
export class CascadeAmplificationSystem {
    constructor(scene, camera, renderer, particlePool, soundManager) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.particlePool = particlePool;
        this.soundManager = soundManager;
        
        // Track current combo state
        this.currentCombo = 0;
        this.isTranscendenceActive = false;
        this.activeEffects = [];
        
        // Visual components
        this.orbitingLights = [];
        this.geometryPatterns = [];
        this.auroraEffect = null;
        this.mandalaPattern = null;
        this.breathingGlows = new Map();
        
        // Chain tracking
        this.chainConnections = [];
        this.chainStartTime = 0;
        
        // Configuration
        this.config = {
            tier1: { min: 1, max: 3, particleMultiplier: 1 },
            tier2: { min: 4, max: 6, particleMultiplier: 1.5, orbitCount: 3 },
            tier3: { min: 7, max: 9, particleMultiplier: 2, orbitCount: 5, geometryComplexity: 1 },
            transcendence: { min: 10, particleMultiplier: 3, orbitCount: 8, geometryComplexity: 3 }
        };
        
        // Initialize shaders for advanced effects
        this.initializeShaders();
        
        // Audio progression tracking
        this.lastAudioTier = 0;
    }
    
    /**
     * Initialize custom shaders for advanced effects
     */
    initializeShaders() {
        // Aurora shader for background in transcendence mode
        this.auroraShader = {
            uniforms: {
                time: { value: 0 },
                opacity: { value: 0 },
                color1: { value: new THREE.Color(0x00ffff) },
                color2: { value: new THREE.Color(0xff00ff) },
                color3: { value: new THREE.Color(0xffff00) }
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
                uniform float opacity;
                uniform vec3 color1;
                uniform vec3 color2;
                uniform vec3 color3;
                varying vec2 vUv;
                
                void main() {
                    // Create flowing aurora effect
                    float wave1 = sin(vUv.x * 4.0 + time * 0.5) * 0.5 + 0.5;
                    float wave2 = sin(vUv.x * 6.0 - time * 0.7) * 0.5 + 0.5;
                    float wave3 = sin(vUv.y * 3.0 + time * 0.3) * 0.5 + 0.5;
                    
                    vec3 color = mix(color1, color2, wave1);
                    color = mix(color, color3, wave2 * wave3);
                    
                    float alpha = (wave1 + wave2) * 0.5 * opacity;
                    alpha *= smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `
        };
        
        // Mandala shader for expanding patterns
        this.mandalaShader = {
            uniforms: {
                time: { value: 0 },
                scale: { value: 1 },
                rotation: { value: 0 },
                opacity: { value: 1 },
                color: { value: new THREE.Color(0xffffff) }
            },
            vertexShader: `
                varying vec2 vUv;
                uniform float scale;
                uniform float rotation;
                
                void main() {
                    vUv = uv;
                    vec3 pos = position * scale;
                    
                    // Apply rotation
                    float s = sin(rotation);
                    float c = cos(rotation);
                    pos.xy = mat2(c, -s, s, c) * pos.xy;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform float opacity;
                uniform vec3 color;
                varying vec2 vUv;
                
                float mandala(vec2 p, float n) {
                    float a = atan(p.y, p.x);
                    float r = length(p);
                    float v = sin(n * a + time) * 0.5 + 0.5;
                    v *= smoothstep(0.5, 0.0, r);
                    return v;
                }
                
                void main() {
                    vec2 p = (vUv - 0.5) * 2.0;
                    
                    float m1 = mandala(p, 6.0);
                    float m2 = mandala(p * 1.5, 8.0);
                    float m3 = mandala(p * 2.0, 12.0);
                    
                    float pattern = (m1 + m2 * 0.7 + m3 * 0.5) / 2.2;
                    pattern = pow(pattern, 1.5);
                    
                    gl_FragColor = vec4(color, pattern * opacity);
                }
            `
        };
    }
    
    /**
     * Update combo level and trigger appropriate effects
     * @param {number} comboCount - Current combo count
     * @param {Array} bubbles - Bubbles involved in the combo
     * @param {Vector3} epicenter - Center point of the combo
     */
    updateCombo(comboCount, bubbles, epicenter) {
        const previousCombo = this.currentCombo;
        this.currentCombo = comboCount;
        
        // Determine effect tier
        const tier = this.getEffectTier(comboCount);
        
        // Trigger appropriate effects based on tier
        if (tier >= 1) {
            this.createBasicBurst(bubbles, epicenter, tier);
        }
        
        if (tier >= 2) {
            this.createOrbitingLights(epicenter, comboCount);
        }
        
        if (tier >= 3) {
            this.createSacredGeometry(bubbles, epicenter, comboCount);
        }
        
        if (comboCount >= this.config.transcendence.min && !this.isTranscendenceActive) {
            this.activateTranscendenceMode(epicenter);
        } else if (comboCount < this.config.transcendence.min && this.isTranscendenceActive) {
            this.deactivateTranscendenceMode();
        }
        
        // Create chain connections between bubbles
        if (bubbles.length > 1) {
            this.createChainConnections(bubbles, tier);
        }
        
        // Audio progression
        this.updateAudioProgression(tier);
        
        // Track chain timing for time dilation effect
        this.chainStartTime = Date.now();
    }
    
    /**
     * Get effect tier based on combo count
     * @param {number} comboCount - Current combo count
     * @returns {number} Effect tier (1-4)
     */
    getEffectTier(comboCount) {
        if (comboCount >= this.config.transcendence.min) return 4;
        if (comboCount >= this.config.tier3.min) return 3;
        if (comboCount >= this.config.tier2.min) return 2;
        if (comboCount >= this.config.tier1.min) return 1;
        return 0;
    }
    
    /**
     * Create basic particle burst (Tier 1)
     * @param {Array} bubbles - Bubbles to burst
     * @param {Vector3} epicenter - Center of effect
     * @param {number} tier - Effect tier
     */
    createBasicBurst(bubbles, epicenter, tier) {
        const multiplier = this.getParticleMultiplier(tier);
        
        bubbles.forEach((bubble, index) => {
            setTimeout(() => {
                const particleCount = Math.floor(15 * multiplier);
                const colors = [
                    bubble.color,
                    0xffffff,
                    this.getLuminousColor(bubble.color)
                ];
                
                colors.forEach((color, colorIndex) => {
                    setTimeout(() => {
                        ParticleFactory.createExplosion(
                            bubble.position,
                            color,
                            Math.floor(particleCount / 3),
                            this.particlePool,
                            {
                                velocityMultiplier: 1 + tier * 0.3,
                                lifetime: 1 + tier * 0.2,
                                size: 0.2 + tier * 0.05
                            }
                        );
                    }, colorIndex * 50);
                });
                
                // Add cascade particles that flow toward next bubble
                if (index < bubbles.length - 1) {
                    this.createCascadeFlow(bubble.position, bubbles[index + 1].position, tier);
                }
            }, index * (100 - tier * 20)); // Faster cascade at higher tiers
        });
    }
    
    /**
     * Create orbiting light sprites (Tier 2)
     * @param {Vector3} center - Center of orbit
     * @param {number} comboCount - Current combo
     */
    createOrbitingLights(center, comboCount) {
        const orbitCount = Math.min(3 + Math.floor(comboCount / 2), 8);
        
        // Clear old orbits
        this.clearOrbitingLights();
        
        for (let i = 0; i < orbitCount; i++) {
            const angle = (Math.PI * 2 * i) / orbitCount;
            const radius = 2 + Math.sin(Date.now() * 0.001 + i) * 0.5;
            
            // Create light sprite
            const spriteMaterial = new THREE.SpriteMaterial({
                map: this.createLightTexture(),
                color: this.getComboColor(comboCount),
                blending: THREE.AdditiveBlending,
                opacity: 0.8
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(0.5, 0.5, 1);
            
            // Position in orbit
            sprite.position.set(
                center.x + Math.cos(angle) * radius,
                center.y + Math.sin(angle) * radius,
                center.z + 0.5
            );
            
            this.scene.add(sprite);
            this.orbitingLights.push({
                sprite: sprite,
                center: center.clone(),
                angle: angle,
                radius: radius,
                speed: 1 + comboCount * 0.1,
                lifetime: 3
            });
        }
    }
    
    /**
     * Create sacred geometry patterns (Tier 3)
     * @param {Array} bubbles - Bubbles in the combo
     * @param {Vector3} center - Center of pattern
     * @param {number} comboCount - Current combo
     */
    createSacredGeometry(bubbles, center, comboCount) {
        const complexity = Math.min(Math.floor(comboCount / 3), 5);
        
        // Create connecting lines between all bubbles (sacred web)
        const lineMaterial = new THREE.LineBasicMaterial({
            color: this.getComboColor(comboCount),
            opacity: 0.6,
            transparent: true,
            blending: THREE.AdditiveBlending,
            linewidth: 2
        });
        
        // Create geometric patterns
        for (let i = 0; i < bubbles.length; i++) {
            for (let j = i + 1; j < bubbles.length; j++) {
                const points = [
                    bubbles[i].position,
                    bubbles[j].position
                ];
                
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, lineMaterial);
                
                this.scene.add(line);
                this.geometryPatterns.push({
                    mesh: line,
                    lifetime: 2,
                    fadeSpeed: 0.5
                });
            }
        }
        
        // Add sacred shapes (triangles, hexagons, etc.)
        if (complexity >= 2) {
            this.createSacredShape(center, 'hexagon', comboCount);
        }
        if (complexity >= 3) {
            this.createSacredShape(center, 'star', comboCount);
        }
        if (complexity >= 4) {
            this.createSacredShape(center, 'flower', comboCount);
        }
    }
    
    /**
     * Activate TRANSCENDENCE MODE (Tier 4 - Combo 10+)
     * @param {Vector3} epicenter - Center of transcendence
     */
    activateTranscendenceMode(epicenter) {
        console.log('🌟 TRANSCENDENCE MODE ACTIVATED! 🌟');
        this.isTranscendenceActive = true;
        
        // Create aurora borealis background
        this.createAurora();
        
        // Apply breathing glow to all bubbles
        this.applyBreathingGlow();
        
        // Create expanding mandala from epicenter
        this.createMandala(epicenter);
        
        // Enhanced audio
        if (this.soundManager) {
            this.soundManager.play('transcendence', { volume: 0.8, loop: true });
        }
        
        // Time dilation effect
        this.startTimeDilation();
        
        // Screen-wide particle rain
        this.createTranscendenceParticles();
    }
    
    /**
     * Create aurora borealis effect
     */
    createAurora() {
        const geometry = new THREE.PlaneGeometry(30, 20);
        const material = new THREE.ShaderMaterial({
            uniforms: this.auroraShader.uniforms,
            vertexShader: this.auroraShader.vertexShader,
            fragmentShader: this.auroraShader.fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.auroraEffect = new THREE.Mesh(geometry, material);
        this.auroraEffect.position.z = -10;
        this.scene.add(this.auroraEffect);
        
        // Fade in animation
        const fadeIn = {
            progress: 0,
            update: (deltaTime) => {
                this.auroraShader.uniforms.opacity.value = Math.min(0.3, fadeIn.progress);
                fadeIn.progress += deltaTime * 0.5;
                return fadeIn.progress < 1;
            }
        };
        this.activeEffects.push(fadeIn);
    }
    
    /**
     * Apply breathing glow to all bubbles
     */
    applyBreathingGlow() {
        // Get all bubbles from the game state
        if (window.game && window.game.gameState) {
            const bubbles = window.game.gameState.getAllBubbles();
            
            bubbles.forEach(bubble => {
                if (!bubble.isDestroyed && bubble.mesh) {
                    // Store original emissive settings
                    this.breathingGlows.set(bubble.id, {
                        bubble: bubble,
                        originalEmissive: bubble.mesh.material.emissive ? 
                            bubble.mesh.material.emissive.clone() : new THREE.Color(0x000000),
                        phase: Math.random() * Math.PI * 2
                    });
                    
                    // Enable emissive on material
                    if (bubble.mesh.material) {
                        bubble.mesh.material.emissive = new THREE.Color(bubble.color);
                        bubble.mesh.material.emissiveIntensity = 0;
                    }
                }
            });
        }
    }
    
    /**
     * Create expanding mandala pattern
     * @param {Vector3} center - Center of mandala
     */
    createMandala(center) {
        const geometry = new THREE.PlaneGeometry(10, 10);
        const material = new THREE.ShaderMaterial({
            uniforms: this.mandalaShader.uniforms,
            vertexShader: this.mandalaShader.vertexShader,
            fragmentShader: this.mandalaShader.fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.mandalaPattern = new THREE.Mesh(geometry, material);
        this.mandalaPattern.position.copy(center);
        this.mandalaPattern.position.z += 1;
        this.scene.add(this.mandalaPattern);
        
        // Expansion animation
        const expand = {
            scale: 0.1,
            rotation: 0,
            update: (deltaTime) => {
                expand.scale = Math.min(3, expand.scale + deltaTime * 0.5);
                expand.rotation += deltaTime * 0.3;
                
                this.mandalaShader.uniforms.scale.value = expand.scale;
                this.mandalaShader.uniforms.rotation.value = expand.rotation;
                this.mandalaShader.uniforms.opacity.value = Math.max(0, 1 - expand.scale / 3);
                
                if (expand.scale >= 3) {
                    this.scene.remove(this.mandalaPattern);
                    this.mandalaPattern = null;
                    return false;
                }
                return true;
            }
        };
        this.activeEffects.push(expand);
    }
    
    /**
     * Start time dilation effect for transcendence mode
     */
    startTimeDilation() {
        // This would ideally slow down game time, but for visual effect
        // we'll create a ripple distortion
        const timeDilation = {
            time: 0,
            update: (deltaTime) => {
                timeDilation.time += deltaTime;
                
                // Create periodic time ripples
                if (Math.floor(timeDilation.time) % 2 === 0 && 
                    Math.floor(timeDilation.time - deltaTime) % 2 !== 0) {
                    this.createTimeRipple();
                }
                
                return this.isTranscendenceActive;
            }
        };
        this.activeEffects.push(timeDilation);
    }
    
    /**
     * Create time ripple effect
     */
    createTimeRipple() {
        const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        
        const ripple = new THREE.Mesh(geometry, material);
        ripple.position.z = 1;
        this.scene.add(ripple);
        
        const rippleAnim = {
            scale: 1,
            opacity: 0.8,
            update: (deltaTime) => {
                rippleAnim.scale += deltaTime * 10;
                rippleAnim.opacity = Math.max(0, 0.8 - (rippleAnim.scale - 1) / 20);
                
                ripple.scale.set(rippleAnim.scale, rippleAnim.scale, 1);
                material.opacity = rippleAnim.opacity;
                
                if (rippleAnim.opacity <= 0) {
                    this.scene.remove(ripple);
                    geometry.dispose();
                    material.dispose();
                    return false;
                }
                return true;
            }
        };
        this.activeEffects.push(rippleAnim);
    }
    
    /**
     * Create transcendence particle rain
     */
    createTranscendenceParticles() {
        const particleRain = {
            lastSpawn: 0,
            update: (deltaTime) => {
                particleRain.lastSpawn += deltaTime;
                
                if (particleRain.lastSpawn > 0.05) {
                    particleRain.lastSpawn = 0;
                    
                    // Spawn particles at top of screen
                    for (let i = 0; i < 3; i++) {
                        const x = (Math.random() - 0.5) * 20;
                        const y = 10;
                        const z = Math.random() * 2;
                        
                        const particle = this.particlePool.spawn(
                            x, y, z,
                            this.getTranscendenceColor(),
                            0.3,
                            new THREE.Vector3(
                                (Math.random() - 0.5) * 2,
                                -Math.random() * 5 - 5,
                                0
                            )
                        );
                        
                        if (particle) {
                            particle.decay = 0.01;
                        }
                    }
                }
                
                return this.isTranscendenceActive;
            }
        };
        this.activeEffects.push(particleRain);
    }
    
    /**
     * Deactivate transcendence mode
     */
    deactivateTranscendenceMode() {
        console.log('Transcendence mode deactivating...');
        this.isTranscendenceActive = false;
        
        // Fade out aurora
        if (this.auroraEffect) {
            const fadeOut = {
                update: (deltaTime) => {
                    this.auroraShader.uniforms.opacity.value = 
                        Math.max(0, this.auroraShader.uniforms.opacity.value - deltaTime * 0.5);
                    
                    if (this.auroraShader.uniforms.opacity.value <= 0) {
                        this.scene.remove(this.auroraEffect);
                        this.auroraEffect = null;
                        return false;
                    }
                    return true;
                }
            };
            this.activeEffects.push(fadeOut);
        }
        
        // Remove breathing glows
        this.breathingGlows.forEach((glow, bubbleId) => {
            if (glow.bubble.mesh && glow.bubble.mesh.material) {
                glow.bubble.mesh.material.emissive = glow.originalEmissive;
                glow.bubble.mesh.material.emissiveIntensity = 0;
            }
        });
        this.breathingGlows.clear();
        
        // Stop transcendence audio
        if (this.soundManager) {
            this.soundManager.stop('transcendence');
        }
    }
    
    /**
     * Create chain connections between bubbles
     * @param {Array} bubbles - Bubbles to connect
     * @param {number} tier - Effect tier
     */
    createChainConnections(bubbles, tier) {
        // Clear old connections
        this.clearChainConnections();
        
        const connectionMaterial = new THREE.LineBasicMaterial({
            color: this.getComboColor(this.currentCombo),
            opacity: 0.3 + tier * 0.15,
            transparent: true,
            blending: THREE.AdditiveBlending,
            linewidth: 1 + tier
        });
        
        // Create lightning-style connections
        for (let i = 0; i < bubbles.length - 1; i++) {
            const start = bubbles[i].position;
            const end = bubbles[i + 1].position;
            
            // Create segmented lightning bolt
            const segments = 5 + tier * 2;
            const points = this.createLightningPath(start, end, segments);
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, connectionMaterial);
            
            this.scene.add(line);
            this.chainConnections.push({
                mesh: line,
                lifetime: 1 + tier * 0.5,
                material: connectionMaterial
            });
        }
    }
    
    /**
     * Create lightning bolt path between two points
     * @param {Vector3} start - Start point
     * @param {Vector3} end - End point
     * @param {number} segments - Number of segments
     * @returns {Array} Array of points forming the lightning path
     */
    createLightningPath(start, end, segments) {
        const points = [start];
        const direction = new THREE.Vector3().subVectors(end, start);
        const segmentLength = direction.length() / segments;
        direction.normalize();
        
        const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
        
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const basePoint = new THREE.Vector3().lerpVectors(start, end, t);
            
            // Add random offset perpendicular to direction
            const offset = perpendicular.clone().multiplyScalar(
                (Math.random() - 0.5) * 0.5
            );
            
            points.push(basePoint.add(offset));
        }
        
        points.push(end);
        return points;
    }
    
    /**
     * Create cascade flow particles between bubbles
     * @param {Vector3} from - Start position
     * @param {Vector3} to - End position
     * @param {number} tier - Effect tier
     */
    createCascadeFlow(from, to, tier) {
        const particleCount = 5 + tier * 3;
        const direction = new THREE.Vector3().subVectors(to, from).normalize();
        
        for (let i = 0; i < particleCount; i++) {
            setTimeout(() => {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.3,
                    (Math.random() - 0.5) * 0.3,
                    0
                );
                
                const particle = this.particlePool.spawn(
                    from.x + offset.x,
                    from.y + offset.y,
                    from.z + offset.z,
                    this.getComboColor(this.currentCombo),
                    0.15 + tier * 0.05,
                    direction.clone().multiplyScalar(8 + tier * 2)
                );
                
                if (particle) {
                    particle.decay = 0.02;
                }
            }, i * 30);
        }
    }
    
    /**
     * Create sacred shape
     * @param {Vector3} center - Center of shape
     * @param {string} shapeType - Type of shape
     * @param {number} comboCount - Current combo
     */
    createSacredShape(center, shapeType, comboCount) {
        let geometry;
        
        switch(shapeType) {
            case 'hexagon':
                geometry = new THREE.RingGeometry(1, 1.2, 6);
                break;
            case 'star':
                geometry = this.createStarGeometry(1.5, 0.7, 8);
                break;
            case 'flower':
                geometry = this.createFlowerGeometry(1.5, 12);
                break;
            default:
                geometry = new THREE.CircleGeometry(1, 32);
        }
        
        const material = new THREE.MeshBasicMaterial({
            color: this.getComboColor(comboCount),
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        
        const shape = new THREE.Mesh(geometry, material);
        shape.position.copy(center);
        shape.position.z += 0.5;
        this.scene.add(shape);
        
        // Rotation and fade animation
        const shapeAnim = {
            rotation: 0,
            scale: 0.1,
            opacity: 0.5,
            update: (deltaTime) => {
                shapeAnim.rotation += deltaTime * 2;
                shapeAnim.scale = Math.min(2, shapeAnim.scale + deltaTime * 2);
                shapeAnim.opacity = Math.max(0, 0.5 - (shapeAnim.scale - 0.1) / 4);
                
                shape.rotation.z = shapeAnim.rotation;
                shape.scale.set(shapeAnim.scale, shapeAnim.scale, 1);
                material.opacity = shapeAnim.opacity;
                
                if (shapeAnim.opacity <= 0) {
                    this.scene.remove(shape);
                    geometry.dispose();
                    material.dispose();
                    return false;
                }
                return true;
            }
        };
        this.activeEffects.push(shapeAnim);
    }
    
    /**
     * Create star geometry
     * @param {number} outerRadius - Outer radius
     * @param {number} innerRadius - Inner radius
     * @param {number} points - Number of points
     * @returns {THREE.BufferGeometry} Star geometry
     */
    createStarGeometry(outerRadius, innerRadius, points) {
        const shape = new THREE.Shape();
        const angle = Math.PI / points;
        
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(i * angle) * radius;
            const y = Math.sin(i * angle) * radius;
            
            if (i === 0) {
                shape.moveTo(x, y);
            } else {
                shape.lineTo(x, y);
            }
        }
        
        shape.closePath();
        return new THREE.ShapeGeometry(shape);
    }
    
    /**
     * Create flower geometry
     * @param {number} radius - Flower radius
     * @param {number} petals - Number of petals
     * @returns {THREE.BufferGeometry} Flower geometry
     */
    createFlowerGeometry(radius, petals) {
        const shape = new THREE.Shape();
        const angleStep = (Math.PI * 2) / petals;
        
        for (let i = 0; i < petals; i++) {
            const angle = i * angleStep;
            const petalRadius = radius * 0.5;
            const cx = Math.cos(angle) * radius * 0.5;
            const cy = Math.sin(angle) * radius * 0.5;
            
            if (i === 0) {
                shape.moveTo(cx + petalRadius, cy);
            }
            
            // Draw petal using quadratic curves
            shape.quadraticCurveTo(
                cx + Math.cos(angle - angleStep/2) * petalRadius * 1.5,
                cy + Math.sin(angle - angleStep/2) * petalRadius * 1.5,
                cx + Math.cos(angle) * petalRadius,
                cy + Math.sin(angle) * petalRadius
            );
        }
        
        shape.closePath();
        return new THREE.ShapeGeometry(shape);
    }
    
    /**
     * Update audio progression based on tier
     * @param {number} tier - Current effect tier
     */
    updateAudioProgression(tier) {
        if (!this.soundManager || tier === this.lastAudioTier) return;
        
        this.lastAudioTier = tier;
        
        // Play tier-specific sounds
        switch(tier) {
            case 1:
                this.soundManager.play('combo1', { volume: 0.5 });
                break;
            case 2:
                this.soundManager.play('combo2', { volume: 0.6 });
                break;
            case 3:
                this.soundManager.play('combo3', { volume: 0.7 });
                break;
            case 4:
                // Transcendence audio handled separately
                break;
        }
    }
    
    /**
     * Create light texture for sprites
     * @returns {THREE.Texture} Light texture
     */
    createLightTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    /**
     * Get color based on combo level
     * @param {number} combo - Combo level
     * @returns {THREE.Color} Color for combo
     */
    getComboColor(combo) {
        const colors = [
            0x00ff00, // Green
            0x00ffff, // Cyan
            0xffff00, // Yellow
            0xff00ff, // Magenta
            0xff0000, // Red
            0xffffff  // White
        ];
        
        const index = Math.min(Math.floor(combo / 2), colors.length - 1);
        return colors[index];
    }
    
    /**
     * Get luminous version of a color
     * @param {number} color - Base color
     * @returns {number} Luminous color
     */
    getLuminousColor(color) {
        const c = new THREE.Color(color);
        c.r = Math.min(1, c.r + 0.5);
        c.g = Math.min(1, c.g + 0.5);
        c.b = Math.min(1, c.b + 0.5);
        return c.getHex();
    }
    
    /**
     * Get transcendence color (rainbow cycling)
     * @returns {number} Transcendence color
     */
    getTranscendenceColor() {
        const hue = (Date.now() * 0.001) % 1;
        const color = new THREE.Color();
        color.setHSL(hue, 1, 0.5);
        return color.getHex();
    }
    
    /**
     * Get particle multiplier for tier
     * @param {number} tier - Effect tier
     * @returns {number} Particle multiplier
     */
    getParticleMultiplier(tier) {
        switch(tier) {
            case 1: return this.config.tier1.particleMultiplier;
            case 2: return this.config.tier2.particleMultiplier;
            case 3: return this.config.tier3.particleMultiplier;
            case 4: return this.config.transcendence.particleMultiplier;
            default: return 1;
        }
    }
    
    /**
     * Clear orbiting lights
     */
    clearOrbitingLights() {
        this.orbitingLights.forEach(light => {
            this.scene.remove(light.sprite);
            light.sprite.material.dispose();
        });
        this.orbitingLights = [];
    }
    
    /**
     * Clear chain connections
     */
    clearChainConnections() {
        this.chainConnections.forEach(connection => {
            this.scene.remove(connection.mesh);
            connection.mesh.geometry.dispose();
            connection.material.dispose();
        });
        this.chainConnections = [];
    }
    
    /**
     * Clear geometry patterns
     */
    clearGeometryPatterns() {
        this.geometryPatterns.forEach(pattern => {
            this.scene.remove(pattern.mesh);
            pattern.mesh.geometry.dispose();
            pattern.mesh.material.dispose();
        });
        this.geometryPatterns = [];
    }
    
    /**
     * Update all active effects
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Update shader uniforms
        if (this.auroraEffect) {
            this.auroraShader.uniforms.time.value += deltaTime;
        }
        
        if (this.mandalaPattern) {
            this.mandalaShader.uniforms.time.value += deltaTime;
        }
        
        // Update breathing glows
        if (this.isTranscendenceActive) {
            const breathingSpeed = 2;
            const time = Date.now() * 0.001 * breathingSpeed;
            
            this.breathingGlows.forEach((glow, bubbleId) => {
                if (glow.bubble.mesh && glow.bubble.mesh.material) {
                    const intensity = (Math.sin(time + glow.phase) * 0.5 + 0.5) * 0.3;
                    glow.bubble.mesh.material.emissiveIntensity = intensity;
                }
            });
        }
        
        // Update orbiting lights
        this.orbitingLights = this.orbitingLights.filter(light => {
            light.angle += light.speed * deltaTime;
            light.radius += Math.sin(Date.now() * 0.001) * 0.01;
            
            light.sprite.position.x = light.center.x + Math.cos(light.angle) * light.radius;
            light.sprite.position.y = light.center.y + Math.sin(light.angle) * light.radius;
            
            light.lifetime -= deltaTime;
            light.sprite.material.opacity = Math.min(0.8, light.lifetime);
            
            if (light.lifetime <= 0) {
                this.scene.remove(light.sprite);
                light.sprite.material.dispose();
                return false;
            }
            return true;
        });
        
        // Update chain connections
        this.chainConnections = this.chainConnections.filter(connection => {
            connection.lifetime -= deltaTime;
            connection.material.opacity = Math.min(0.6, connection.lifetime);
            
            if (connection.lifetime <= 0) {
                this.scene.remove(connection.mesh);
                connection.mesh.geometry.dispose();
                connection.material.dispose();
                return false;
            }
            return true;
        });
        
        // Update geometry patterns
        this.geometryPatterns = this.geometryPatterns.filter(pattern => {
            pattern.lifetime -= deltaTime;
            pattern.mesh.material.opacity = Math.min(0.6, pattern.lifetime * pattern.fadeSpeed);
            
            if (pattern.lifetime <= 0) {
                this.scene.remove(pattern.mesh);
                pattern.mesh.geometry.dispose();
                pattern.mesh.material.dispose();
                return false;
            }
            return true;
        });
        
        // Update active effects
        this.activeEffects = this.activeEffects.filter(effect => effect.update(deltaTime));
    }
    
    /**
     * Reset combo state
     */
    resetCombo() {
        this.currentCombo = 0;
        this.lastAudioTier = 0;
        
        if (this.isTranscendenceActive) {
            this.deactivateTranscendenceMode();
        }
        
        this.clearOrbitingLights();
        this.clearChainConnections();
        this.clearGeometryPatterns();
    }
    
    /**
     * Cleanup all effects
     */
    cleanup() {
        this.resetCombo();
        this.activeEffects = [];
        
        // Cleanup any remaining meshes
        if (this.auroraEffect) {
            this.scene.remove(this.auroraEffect);
            this.auroraEffect.geometry.dispose();
            this.auroraEffect.material.dispose();
            this.auroraEffect = null;
        }
        
        if (this.mandalaPattern) {
            this.scene.remove(this.mandalaPattern);
            this.mandalaPattern.geometry.dispose();
            this.mandalaPattern.material.dispose();
            this.mandalaPattern = null;
        }
    }
}