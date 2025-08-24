import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Magnetic Attraction Field Effect
 * Creates visual attraction between same-colored bubbles when they get close
 * Features energy tendrils, warping effects, and satisfying snap animations
 */
export class MagneticFieldEffect {
    constructor(scene, eventBus, camera = null) {
        this.scene = scene;
        this.eventBus = eventBus;
        this.camera = camera;
        
        // Effect parameters
        this.DETECTION_RADIUS = CONFIG.BUBBLE_RADIUS * 3; // 3 bubble radii for detection
        this.ACTIVATION_RADIUS = CONFIG.BUBBLE_RADIUS * 2.5; // Start showing effects
        this.SNAP_RADIUS = CONFIG.BUBBLE_RADIUS * 1.8; // Strong attraction zone
        this.MAX_TENDRILS = 12; // Maximum number of energy tendrils
        this.TENDRIL_SEGMENTS = 20; // Segments per tendril for smoothness
        
        // Visual parameters
        this.TENDRIL_BASE_WIDTH = 0.08;
        this.TENDRIL_TIP_WIDTH = 0.02;
        this.GLOW_INTENSITY = 0.8;
        this.PULSE_SPEED = 3.0;
        this.WARP_STRENGTH = 0.15;
        
        // Active effects tracking
        this.activeTendrils = [];
        this.warpFields = [];
        this.snapRipples = [];
        this.attractionPairs = new Map(); // Track bubble pairs being attracted
        
        // Materials for effects
        this.createMaterials();
        
        // Geometry pools for performance
        this.tendrilGeometryPool = [];
        this.rippleGeometryPool = [];
        
        // Animation state
        this.time = 0;
        
        // Initialize geometry pools
        this.initializeGeometryPools();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    createMaterials() {
        // Energy tendril material with glow effect
        this.tendrilMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(0x00ffff) },
                intensity: { value: 1.0 },
                pulseSpeed: { value: this.PULSE_SPEED }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                uniform float time;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    
                    // Add subtle wave motion to tendrils
                    vec3 pos = position;
                    float wave = sin(position.x * 10.0 + time * 3.0) * 0.02;
                    pos.y += wave * (1.0 - uv.x); // Stronger at the tip
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float time;
                uniform float intensity;
                uniform float pulseSpeed;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    // Energy flow effect along the tendril
                    float energy = sin(vUv.x * 20.0 - time * pulseSpeed) * 0.5 + 0.5;
                    energy = pow(energy, 2.0);
                    
                    // Fade out at the edges for smooth blending
                    float edgeFade = 1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0);
                    
                    // Distance-based fade (stronger near source)
                    float distanceFade = 1.0 - vUv.x;
                    distanceFade = pow(distanceFade, 0.5);
                    
                    // Combine effects
                    float alpha = energy * edgeFade * distanceFade * intensity;
                    
                    // Add glow effect
                    vec3 glowColor = color * (1.0 + energy * 2.0);
                    
                    gl_FragColor = vec4(glowColor, alpha * 0.7);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        // Warp field material for distortion effect
        this.warpFieldMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                center: { value: new THREE.Vector3() },
                radius: { value: 1.0 },
                strength: { value: 0.1 }
            },
            vertexShader: `
                uniform float time;
                uniform vec3 center;
                uniform float radius;
                uniform float strength;
                varying vec2 vUv;
                varying float vDistortion;
                
                void main() {
                    vUv = uv;
                    
                    // Calculate distance from center
                    float dist = distance(position, center);
                    float normalizedDist = clamp(dist / radius, 0.0, 1.0);
                    
                    // Create warp effect
                    float warp = (1.0 - normalizedDist) * strength;
                    warp *= sin(time * 2.0) * 0.5 + 0.5;
                    
                    vec3 warped = position;
                    vec3 direction = normalize(position - center);
                    warped += direction * warp;
                    
                    vDistortion = warp;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(warped, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                varying vec2 vUv;
                varying float vDistortion;
                
                void main() {
                    // Subtle distortion visualization
                    float rings = sin(vDistortion * 50.0 + time * 3.0) * 0.5 + 0.5;
                    vec3 color = vec3(0.5, 0.8, 1.0) * rings;
                    float alpha = vDistortion * 0.3;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        // Snap ripple material for connection effect
        this.rippleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                progress: { value: 0 },
                color: { value: new THREE.Color(0xffffff) },
                innerRadius: { value: 0.0 },
                outerRadius: { value: 1.0 }
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
                uniform float progress;
                uniform vec3 color;
                uniform float innerRadius;
                uniform float outerRadius;
                varying vec2 vUv;
                
                void main() {
                    vec2 center = vec2(0.5, 0.5);
                    float dist = distance(vUv, center) * 2.0;
                    
                    // Create expanding ring
                    float ring = smoothstep(innerRadius, innerRadius + 0.05, dist) *
                                (1.0 - smoothstep(outerRadius - 0.05, outerRadius, dist));
                    
                    // Fade out over time
                    float alpha = ring * (1.0 - progress) * 0.8;
                    
                    // Add some shimmer
                    float shimmer = sin(dist * 30.0 - time * 5.0) * 0.3 + 0.7;
                    
                    gl_FragColor = vec4(color * shimmer, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });
    }
    
    initializeGeometryPools() {
        // Pre-create tendril geometries for reuse
        for (let i = 0; i < this.MAX_TENDRILS; i++) {
            const geometry = new THREE.PlaneGeometry(1, 0.3, this.TENDRIL_SEGMENTS, 1);
            this.tendrilGeometryPool.push(geometry);
        }
        
        // Pre-create ripple geometries
        for (let i = 0; i < 10; i++) {
            const geometry = new THREE.PlaneGeometry(
                CONFIG.BUBBLE_RADIUS * 4,
                CONFIG.BUBBLE_RADIUS * 4,
                32, 32
            );
            this.rippleGeometryPool.push(geometry);
        }
    }
    
    setupEventListeners() {
        // Listen for bubble movement updates
        this.eventBus.on('bubbleMoving', (data) => {
            this.checkMagneticAttraction(data.bubble);
        });
        
        // Listen for bubble attachment
        this.eventBus.on('bubbleAttached', (data) => {
            this.createSnapEffect(data.bubble);
        });
        
        // Clean up effects when bubbles are destroyed
        this.eventBus.on('bubbleDestroyed', (data) => {
            this.cleanupBubbleEffects(data.bubble);
        });
        
        // Listen for bubble repositioning (e.g., when rows are added)
        this.eventBus.on('bubblesRepositioned', (data) => {
            this.handleBubblesRepositioned(data);
        });
    }
    
    /**
     * Check for magnetic attraction between moving bubble and grid bubbles
     */
    checkMagneticAttraction(movingBubble) {
        if (!movingBubble || !movingBubble.isMoving) return;
        
        const attractions = [];
        const bubbleGrid = this.getBubbleGrid();
        
        // Find all same-colored bubbles within detection radius
        for (let y = 0; y < bubbleGrid.length; y++) {
            for (let x = 0; x < bubbleGrid[y].length; x++) {
                const gridBubble = bubbleGrid[y][x];
                if (!gridBubble || gridBubble.isDestroyed) continue;
                
                // Check color match (handle rainbow bubbles)
                const colorsMatch = this.doColorsMatch(movingBubble, gridBubble);
                if (!colorsMatch) continue;
                
                // Calculate distance
                const distance = movingBubble.position.distanceTo(gridBubble.position);
                
                // Check if within detection radius
                if (distance <= this.DETECTION_RADIUS) {
                    attractions.push({
                        bubble: gridBubble,
                        distance: distance,
                        strength: 1.0 - (distance / this.DETECTION_RADIUS)
                    });
                }
            }
        }
        
        // Update or create attraction effects
        this.updateAttractionEffects(movingBubble, attractions);
    }
    
    /**
     * Check if two bubbles have matching colors
     */
    doColorsMatch(bubble1, bubble2) {
        // Rainbow bubbles match everything
        if (bubble1.powerUpType === 'rainbow' || bubble2.powerUpType === 'rainbow') {
            return true;
        }
        
        // Compare color values
        return bubble1.color === bubble2.color;
    }
    
    /**
     * Update attraction effects for a moving bubble
     */
    updateAttractionEffects(movingBubble, attractions) {
        const bubbleId = movingBubble.id || `bubble_${movingBubble.position.x}_${movingBubble.position.y}`;
        
        // Remove existing effects if no attractions
        if (attractions.length === 0) {
            this.removeAttractionEffects(bubbleId);
            return;
        }
        
        // Sort by distance (closest first)
        attractions.sort((a, b) => a.distance - b.distance);
        
        // Calculate total potential combo size for intensity scaling
        const potentialCombo = this.calculatePotentialCombo(movingBubble, attractions);
        const intensityMultiplier = Math.min(2.0, 0.5 + potentialCombo * 0.15);
        
        // Get or create effect group for this bubble
        let effectGroup = this.attractionPairs.get(bubbleId);
        if (!effectGroup) {
            effectGroup = {
                movingBubble: movingBubble,
                tendrils: [],
                warpField: null,
                lastUpdate: Date.now()
            };
            this.attractionPairs.set(bubbleId, effectGroup);
        }
        
        // Update tendrils (limit to closest bubbles for performance)
        const maxTendrils = Math.min(this.MAX_TENDRILS, attractions.length);
        this.updateTendrils(effectGroup, attractions.slice(0, maxTendrils), intensityMultiplier);
        
        // Update warp field if close enough
        if (attractions[0].distance <= this.ACTIVATION_RADIUS) {
            this.updateWarpField(effectGroup, attractions[0], intensityMultiplier);
        }
        
        effectGroup.lastUpdate = Date.now();
    }
    
    /**
     * Calculate potential combo size for intensity scaling
     */
    calculatePotentialCombo(movingBubble, attractions) {
        // Simple estimation based on connected same-color bubbles
        const visited = new Set();
        let count = 1; // Include the moving bubble
        
        // Count directly attracted bubbles
        attractions.forEach(attr => {
            if (attr.distance <= this.ACTIVATION_RADIUS) {
                count++;
            }
        });
        
        // Estimate additional connected bubbles (simplified)
        return Math.min(15, count * 1.5); // Cap at 15 for performance
    }
    
    /**
     * Update energy tendrils between bubbles
     */
    updateTendrils(effectGroup, attractions, intensityMultiplier) {
        // Remove old tendrils
        effectGroup.tendrils.forEach(tendril => {
            this.scene.remove(tendril.mesh);
        });
        effectGroup.tendrils = [];
        
        // Create new tendrils
        attractions.forEach((attraction, index) => {
            if (attraction.distance > this.ACTIVATION_RADIUS) return;
            
            // Create tendril mesh
            const geometry = this.tendrilGeometryPool[index % this.tendrilGeometryPool.length].clone();
            const material = this.tendrilMaterial.clone();
            
            // Set color based on bubble color
            const color = new THREE.Color(effectGroup.movingBubble.color);
            material.uniforms.color.value = color;
            material.uniforms.intensity.value = attraction.strength * intensityMultiplier;
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position and orient tendril
            this.positionTendril(mesh, effectGroup.movingBubble.position, attraction.bubble.position);
            
            this.scene.add(mesh);
            
            effectGroup.tendrils.push({
                mesh: mesh,
                material: material,
                target: attraction.bubble,
                baseIntensity: attraction.strength
            });
        });
    }
    
    /**
     * Position and orient a tendril between two points
     */
    positionTendril(mesh, start, end) {
        const direction = new THREE.Vector3().subVectors(end, start);
        const distance = direction.length();
        direction.normalize();
        
        // Scale tendril to match distance
        mesh.scale.set(distance, this.TENDRIL_BASE_WIDTH, 1);
        
        // Position at midpoint
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mesh.position.copy(midpoint);
        
        // Orient towards target
        const quaternion = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 0, 1);
        quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
        mesh.quaternion.copy(quaternion);
    }
    
    /**
     * Update warp field effect
     */
    updateWarpField(effectGroup, closestAttraction, intensityMultiplier) {
        if (!effectGroup.warpField) {
            // Create warp field mesh
            const geometry = new THREE.SphereGeometry(
                this.ACTIVATION_RADIUS,
                32, 32
            );
            const material = this.warpFieldMaterial.clone();
            effectGroup.warpField = new THREE.Mesh(geometry, material);
            this.scene.add(effectGroup.warpField);
        }
        
        // Update warp field position and parameters
        const midpoint = new THREE.Vector3()
            .addVectors(effectGroup.movingBubble.position, closestAttraction.bubble.position)
            .multiplyScalar(0.5);
        
        effectGroup.warpField.position.copy(midpoint);
        effectGroup.warpField.material.uniforms.center.value.copy(midpoint);
        effectGroup.warpField.material.uniforms.radius.value = closestAttraction.distance;
        effectGroup.warpField.material.uniforms.strength.value = 
            this.WARP_STRENGTH * closestAttraction.strength * intensityMultiplier;
    }
    
    /**
     * Create snap effect when bubbles connect
     */
    createSnapEffect(bubble) {
        // Find and remove any active attraction effects for this bubble
        const bubbleId = bubble.id || `bubble_${bubble.position.x}_${bubble.position.y}`;
        const effectGroup = this.attractionPairs.get(bubbleId);
        
        if (effectGroup) {
            // Create dramatic snap ripple at connection point
            this.createSnapRipple(bubble.position, bubble.color);
            
            // Clean up attraction effects with a brief delay for visual continuity
            setTimeout(() => {
                this.removeAttractionEffects(bubbleId);
            }, 100);
        }
        
        // Emit event for additional effects and sound
        this.eventBus.emit('magneticSnap', {
            position: bubble.position,
            color: bubble.color,
            intensity: effectGroup ? effectGroup.tendrils.length : 1
        });
    }
    
    /**
     * Create expanding ripple effect at snap point
     */
    createSnapRipple(position, color) {
        const geometry = this.rippleGeometryPool[this.snapRipples.length % this.rippleGeometryPool.length].clone();
        const material = this.rippleMaterial.clone();
        
        material.uniforms.color.value = new THREE.Color(color);
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.position.z += 0.1; // Slightly in front of bubbles
        
        // Face camera if available
        if (this.camera) {
            mesh.lookAt(this.camera.position);
        }
        
        this.scene.add(mesh);
        
        const ripple = {
            mesh: mesh,
            material: material,
            startTime: Date.now(),
            duration: 800 // milliseconds
        };
        
        this.snapRipples.push(ripple);
    }
    
    /**
     * Remove attraction effects for a bubble
     */
    removeAttractionEffects(bubbleId) {
        const effectGroup = this.attractionPairs.get(bubbleId);
        if (!effectGroup) return;
        
        // Remove tendrils
        effectGroup.tendrils.forEach(tendril => {
            this.scene.remove(tendril.mesh);
            tendril.mesh.geometry.dispose();
            tendril.material.dispose();
        });
        
        // Remove warp field
        if (effectGroup.warpField) {
            this.scene.remove(effectGroup.warpField);
            effectGroup.warpField.geometry.dispose();
            effectGroup.warpField.material.dispose();
        }
        
        this.attractionPairs.delete(bubbleId);
    }
    
    /**
     * Clean up all effects for a destroyed bubble
     */
    cleanupBubbleEffects(bubble) {
        const bubbleId = bubble.id || `bubble_${bubble.position.x}_${bubble.position.y}`;
        this.removeAttractionEffects(bubbleId);
    }
    
    /**
     * Handle bubble repositioning events (e.g., when rows are added)
     */
    handleBubblesRepositioned(data) {
        const { movements, reason } = data;
        
        // No active effects to update
        if (this.attractionPairs.size === 0) return;
        
        // Update effect positions for repositioned bubbles
        this.attractionPairs.forEach((effectGroup, bubbleId) => {
            // Check if the moving bubble was repositioned
            const movingBubbleMovement = movements.get(effectGroup.movingBubble.id);
            if (movingBubbleMovement) {
                // The moving bubble position has already been updated by setGridPosition
                // We just need to update our effect positions
            }
            
            // Update tendril target positions if any targets moved
            effectGroup.tendrils.forEach(tendril => {
                const targetMovement = movements.get(tendril.target.id);
                if (targetMovement) {
                    // Target bubble has moved, update tendril position
                    this.positionTendril(
                        tendril.mesh,
                        effectGroup.movingBubble.position,
                        tendril.target.position
                    );
                }
            });
            
            // Update warp field position if needed
            if (effectGroup.warpField && effectGroup.tendrils.length > 0) {
                const closestTarget = effectGroup.tendrils[0].target;
                const midpoint = new THREE.Vector3()
                    .addVectors(effectGroup.movingBubble.position, closestTarget.position)
                    .multiplyScalar(0.5);
                effectGroup.warpField.position.copy(midpoint);
                effectGroup.warpField.material.uniforms.center.value.copy(midpoint);
            }
        });
    }
    
    /**
     * Get bubble grid from game state
     */
    getBubbleGrid() {
        // This will be injected by the collision system
        return this.gameState ? this.gameState.bubbleGrid : [];
    }
    
    /**
     * Set game state reference
     */
    setGameState(gameState) {
        this.gameState = gameState;
    }
    
    /**
     * Update animation
     */
    update(deltaTime) {
        this.time += deltaTime;
        
        // Update material uniforms
        this.tendrilMaterial.uniforms.time.value = this.time;
        this.warpFieldMaterial.uniforms.time.value = this.time;
        this.rippleMaterial.uniforms.time.value = this.time;
        
        // Update active tendrils
        this.attractionPairs.forEach((effectGroup, bubbleId) => {
            // Check if bubble is still moving
            if (!effectGroup.movingBubble || !effectGroup.movingBubble.isMoving) {
                this.removeAttractionEffects(bubbleId);
                return;
            }
            
            // Update tendril positions dynamically
            effectGroup.tendrils.forEach(tendril => {
                this.positionTendril(
                    tendril.mesh,
                    effectGroup.movingBubble.position,
                    tendril.target.position
                );
                
                // Pulse intensity
                const pulse = Math.sin(this.time * this.PULSE_SPEED) * 0.3 + 0.7;
                tendril.material.uniforms.intensity.value = tendril.baseIntensity * pulse;
            });
            
            // Update warp field
            if (effectGroup.warpField) {
                const pulse = Math.sin(this.time * 2) * 0.2 + 0.8;
                effectGroup.warpField.material.uniforms.time.value = this.time;
                effectGroup.warpField.scale.setScalar(pulse);
            }
        });
        
        // Update snap ripples
        const currentTime = Date.now();
        this.snapRipples = this.snapRipples.filter(ripple => {
            const elapsed = currentTime - ripple.startTime;
            const progress = elapsed / ripple.duration;
            
            if (progress >= 1) {
                // Remove completed ripple
                this.scene.remove(ripple.mesh);
                ripple.mesh.geometry.dispose();
                ripple.material.dispose();
                return false;
            }
            
            // Update ripple animation
            ripple.material.uniforms.progress.value = progress;
            ripple.material.uniforms.innerRadius.value = progress * 0.8;
            ripple.material.uniforms.outerRadius.value = progress * 1.2 + 0.1;
            
            // Scale up slightly
            const scale = 1 + progress * 0.5;
            ripple.mesh.scale.setScalar(scale);
            
            return true;
        });
    }
    
    /**
     * Dispose of all resources
     */
    dispose() {
        // Clean up all active effects
        this.attractionPairs.forEach((_, bubbleId) => {
            this.removeAttractionEffects(bubbleId);
        });
        
        // Clean up ripples
        this.snapRipples.forEach(ripple => {
            this.scene.remove(ripple.mesh);
            ripple.mesh.geometry.dispose();
            ripple.material.dispose();
        });
        
        // Dispose of materials
        this.tendrilMaterial.dispose();
        this.warpFieldMaterial.dispose();
        this.rippleMaterial.dispose();
        
        // Dispose of geometry pools
        this.tendrilGeometryPool.forEach(geometry => geometry.dispose());
        this.rippleGeometryPool.forEach(geometry => geometry.dispose());
    }
}