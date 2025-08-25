import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * TrajectorySystemBloom
 * Optimized trajectory system for selective bloom post-processing
 * Uses emissive materials for proper bloom effect
 */
export class TrajectorySystem {
    constructor(scene, postProcessing = null) {
        this.scene = scene;
        this.postProcessing = postProcessing;
        
        // Trajectory data
        this.MAX_POINTS = 300;
        this.points = [];
        this.pointCount = 0;
        
        // Cache for performance
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.lastTrajectoryHash = '';
        
        // Smooth power tracking for visual effects and trajectory
        this.smoothPower = 0;
        this.smoothTrajectoryPower = 0;
        this.powerSmoothingFactor = 0.15; // Lower = smoother for visual effects
        this.trajectorySmoothingFactor = 0.01; // Ultra smooth for trajectory to eliminate shaking
        
        // Visual components
        this.trajectoryGroup = new THREE.Group();
        this.trajectoryGroup.name = 'TrajectoryGroup';
        this.scene.add(this.trajectoryGroup);
        
        // Create the laser beam components
        this.createLaserBeam();
        
        // Create impact indicator
        this.createImpactIndicator();
        
        // Animation time
        this.time = 0;
        
        // Track if we've registered for bloom
        this.bloomRegistered = false;
        
        // Store fixed segment counts for consistency
        this.FIXED_SEGMENTS = 128;
        this.RADIAL_SEGMENTS = 12;
        
        // Register for bloom immediately
        // This ensures bloom effects are available from the start
        this.registerForBloom();
    }
    
    createLaserBeam() {
        // Initial curve for geometry creation
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 1, 0)
        ]);
        
        // Use fixed high segment count to prevent UV discontinuities
        // Higher segment count = smoother bloom distribution
        const FIXED_SEGMENTS = 128; // Consistent high segment count
        const RADIAL_SEGMENTS = 12; // More radial segments for smoother tube
        
        // Main laser beam geometry
        const beamGeometry = new THREE.TubeGeometry(curve, FIXED_SEGMENTS, 0.025, RADIAL_SEGMENTS, false);
        
        // Use MeshStandardMaterial with strong emissive for bloom
        // Adjusted for better blue rendering
        this.beamMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff, // Emissive color for bloom
            emissiveIntensity: 2.5, // Reduced slightly to prevent oversaturation
            roughness: 0.2, // Slightly increased for softer glow
            metalness: 0.7, // Reduced metalness for more consistent bloom
            transparent: true,
            opacity: 0.9, // Slight transparency to blend better
            toneMapped: false, // Prevent tone mapping from dimming the glow
            depthWrite: false // Prevent depth conflicts between layers
        });
        
        this.laserBeam = new THREE.Mesh(beamGeometry, this.beamMaterial);
        this.laserBeam.visible = false;
        this.laserBeam.renderOrder = 1; // Render order to control layer ordering
        this.trajectoryGroup.add(this.laserBeam);
        
        // Energy core with animated shader - optimized for smooth bloom
        this.coreShaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x00ffff) },
                glowColor: { value: new THREE.Color(0x00ffff) },
                time: { value: 0 },
                opacity: { value: 0.7 }, // Reduced opacity to prevent stacking
                power: { value: 0 },
                intensity: { value: 1.5 } // Reduced intensity
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform vec3 glowColor;
                uniform float time;
                uniform float opacity;
                uniform float power;
                uniform float intensity;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    // Smoother energy flow with less variation
                    float flow = vUv.x * 10.0 - time * 3.0;
                    float energy = sin(flow) * 0.3 + 0.7; // Less variation for consistency
                    
                    // Gentler pulse effect
                    float pulse = sin(time * 3.0) * 0.1 + 0.9;
                    
                    // Power boost
                    float boost = 1.0 + power * 0.8;
                    
                    // Smoother core brightness falloff
                    float coreBrightness = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.0);
                    
                    // Mix colors with less intensity variation
                    vec3 finalColor = mix(color, glowColor, energy * 0.5) * pulse * boost * intensity;
                    finalColor += vec3(coreBrightness * 0.4); // Softer white core
                    
                    // Smoother opacity gradient
                    float finalOpacity = opacity * coreBrightness * (0.8 + energy * 0.2);
                    
                    gl_FragColor = vec4(finalColor, finalOpacity);
                }
            `,
            transparent: true,
            depthWrite: false,
            depthTest: false, // Disable depth testing to prevent conflicts
            blending: THREE.AdditiveBlending, // Additive blending for glow
            toneMapped: false // Prevent tone mapping
        });
        
        // Create energy core with consistent segment count
        const coreGeometry = new THREE.TubeGeometry(curve, FIXED_SEGMENTS, 0.012, RADIAL_SEGMENTS, false);
        this.energyCore = new THREE.Mesh(coreGeometry, this.coreShaderMaterial);
        this.energyCore.visible = false;
        this.energyCore.renderOrder = 2; // Render after main beam
        this.trajectoryGroup.add(this.energyCore);
        
        // Remove the outer glow layer - it causes too much overlap
        // Instead, we'll use a single optimized bloom layer
        this.glowLayer = null; // Placeholder for compatibility
    }
    
    createImpactIndicator() {
        // Impact ring with emissive material
        const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
        this.impactRingMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 2.5, // Increased for visibility
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            roughness: 0.2,
            metalness: 0.8,
            toneMapped: false
        });
        
        this.impactRing = new THREE.Mesh(ringGeometry, this.impactRingMaterial);
        this.impactRing.visible = false;
        this.scene.add(this.impactRing);
        
        // Create electrical arc sprites for Chain Lightning effect
        this.electricArcs = [];
        for (let i = 0; i < 6; i++) {
            const arcGeometry = new THREE.PlaneGeometry(0.2, 0.2);
            const arcMaterial = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? 0xffffff : 0x00ddff,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const arc = new THREE.Mesh(arcGeometry, arcMaterial);
            arc.visible = false;
            arc.userData = {
                offset: i / 6,  // Distribute along trajectory
                speed: 2 + Math.random() * 3,
                flickerPhase: Math.random() * Math.PI * 2,
                baseColor: i % 2 === 0 ? 0xffffff : 0x00ddff
            };
            this.electricArcs.push(arc);
            this.trajectoryGroup.add(arc);
        }
        
        // Target indicator with emissive material
        const targetGeometry = new THREE.CircleGeometry(0.5, 32);
        this.targetMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 2.0, // Increased for visibility
            transparent: true,
            opacity: 0.6,
            roughness: 0.3,
            metalness: 0.7,
            toneMapped: false
        });
        
        this.targetIndicator = new THREE.Mesh(targetGeometry, this.targetMaterial);
        this.targetIndicator.visible = false;
        this.scene.add(this.targetIndicator);
    }
    
    /**
     * Register trajectory components for bloom when they become visible
     */
    registerForBloom() {
        if (this.postProcessing && !this.bloomRegistered) {
            console.log('Registering trajectory components for bloom');
            // Add trajectory components to bloom (excluding removed glow layer)
            this.postProcessing.addBloomObject(this.laserBeam, 'trajectoryLine');
            this.postProcessing.addBloomObject(this.energyCore, 'trajectoryLine');
            // Glow layer removed - no longer register it
            this.postProcessing.addBloomObject(this.impactRing, 'impactRing');
            this.postProcessing.addBloomObject(this.targetIndicator, 'impactIndicator');
            this.bloomRegistered = true;
            console.log('Trajectory bloom registration complete');
        }
    }
    
    /**
     * Unregister from bloom when hiding
     */
    unregisterFromBloom() {
        if (this.postProcessing && this.bloomRegistered) {
            this.postProcessing.removeBloomObject(this.laserBeam, 'trajectoryLine');
            this.postProcessing.removeBloomObject(this.energyCore, 'trajectoryLine');
            // Glow layer removed - no longer unregister it
            this.postProcessing.removeBloomObject(this.impactRing, 'impactRing');
            this.postProcessing.removeBloomObject(this.targetIndicator, 'impactIndicator');
            this.bloomRegistered = false;
        }
    }
    
    calculateTrajectory(startBubble, mousePosition, gameState, forceRecalculate = false) {
        if (!startBubble || startBubble.isMoving || gameState.isPaused) {
            this.hideTrajectory();
            return;
        }
        
        // Always update position tracking
        this.lastMouseX = mousePosition.x;
        this.lastMouseY = mousePosition.y;
        
        // Clear previous data
        this.points = [];
        this.pointCount = 0;
        gameState.trajectory = [];
        
        // Calculate direction
        const dir = new THREE.Vector3(
            mousePosition.x - startBubble.position.x,
            mousePosition.y - startBubble.position.y,
            0
        );
        
        const length = dir.length();
        if (length < 0.01 || dir.y < 0.3) {
            this.hideTrajectory();
            return;
        }
        
        dir.normalize();
        
        // Calculate trajectory points with smoothed power to reduce shaking
        const targetPower = gameState.shootingPower || 0;
        this.smoothTrajectoryPower += (targetPower - this.smoothTrajectoryPower) * this.trajectorySmoothingFactor;
        
        // Round the smoothed power to reduce micro-adjustments
        const roundedPower = Math.round(this.smoothTrajectoryPower * 100) / 100;
        
        // Use smoothed and rounded power for trajectory to eliminate shaking
        const speed = gameState.precisionAimActive ? 
            CONFIG.SHOOTING_SPEED : 
            CONFIG.SHOOTING_SPEED + (CONFIG.MAX_SHOOTING_SPEED - CONFIG.SHOOTING_SPEED) * roundedPower;
        
        let pos = startBubble.position.clone();
        let vel = dir.multiplyScalar(speed);
        
        const dt = 0.016;
        const maxSteps = gameState.precisionAimActive ? 400 : 200;
        const wallLimit = CONFIG.WALL_LIMIT - CONFIG.BUBBLE_RADIUS;
        
        let hitBubble = null;
        
        for (let i = 0; i < maxSteps; i++) {
            this.points.push(pos.clone());
            this.pointCount++;
            
            // Store for game compatibility
            if (i % 3 === 0) {
                gameState.trajectory.push(pos.clone());
            }
            
            // Next position
            const nextPos = pos.clone().add(vel.clone().multiplyScalar(dt));
            
            // Check collision with bubbles
            let hit = false;
            for (let y = 0; y < CONFIG.GRID_HEIGHT && !hit; y++) {
                const isOddRow = y % 2 === 1;
                const bubblesInRow = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
                
                for (let x = 0; x < bubblesInRow; x++) {
                    const bubble = gameState.bubbleGrid[y][x];
                    if (bubble && !bubble.isDestroyed && !bubble.isFloating) {
                        const dist = nextPos.distanceTo(bubble.position);
                        
                        if (dist < CONFIG.BUBBLE_RADIUS * 1.8) {
                            hit = true;
                            hitBubble = bubble;
                            gameState.trajectoryEndPosition = pos.clone();
                            break;
                        }
                    }
                }
            }
            
            if (hit) break;
            
            // Wall bounce
            if (Math.abs(nextPos.x) > wallLimit) {
                vel.x *= -CONFIG.WALL_BOUNCE_DAMPING;
                nextPos.x = Math.sign(nextPos.x) * wallLimit;
            }
            
            // Ceiling
            if (nextPos.y > CONFIG.CEILING_Y - 0.5 - CONFIG.BUBBLE_RADIUS) {
                gameState.trajectoryEndPosition = nextPos.clone();
                break;
            }
            
            pos = nextPos;
        }
        
        // Update visuals
        this.updateLaserBeam(hitBubble, gameState);
    }
    
    updateLaserBeam(targetBubble, gameState) {
        if (this.pointCount < 2) {
            this.hideTrajectory();
            return;
        }
        
        // Create smooth curve from points with tension adjustment
        const curve = new THREE.CatmullRomCurve3(this.points);
        curve.tension = 0.5; // Smoother curve interpolation
        
        // Store old geometries
        const oldLaserGeometry = this.laserBeam.geometry;
        const oldCoreGeometry = this.energyCore.geometry;
        
        // Use fixed segment count for consistency - prevents UV discontinuities
        const FIXED_SEGMENTS = 128;
        const RADIAL_SEGMENTS = 12;
        
        // Update main laser beam geometry with consistent parameters
        const newGeometry = new THREE.TubeGeometry(curve, FIXED_SEGMENTS, 0.025, RADIAL_SEGMENTS, false);
        this.laserBeam.geometry = newGeometry;
        this.laserBeam.visible = true;
        
        // Update energy core with same segment count
        const coreGeometry = new THREE.TubeGeometry(curve, FIXED_SEGMENTS, 0.012, RADIAL_SEGMENTS, false);
        this.energyCore.geometry = coreGeometry;
        this.energyCore.visible = true;
        
        // Dispose old geometries AFTER setting new ones
        if (oldLaserGeometry) oldLaserGeometry.dispose();
        if (oldCoreGeometry) oldCoreGeometry.dispose();
        
        // Update colors based on state
        const color = this.getColor(gameState);
        const colorObj = new THREE.Color(color);
        
        // Adjust intensity based on color luminance for consistent bloom
        const luminance = colorObj.r * 0.299 + colorObj.g * 0.587 + colorObj.b * 0.114;
        const intensityBoost = luminance < 0.5 ? 1.3 : 1.0; // Boost for darker colors like blue
        
        // Update main beam material with luminance compensation
        this.beamMaterial.color = colorObj;
        this.beamMaterial.emissive = colorObj;
        this.beamMaterial.emissiveIntensity = (gameState.precisionAimActive ? 3.0 : 2.5) * intensityBoost;
        
        // Smooth the power value for visual effects
        const targetPower = gameState.shootingPower || 0;
        this.smoothPower += (targetPower - this.smoothPower) * this.powerSmoothingFactor;
        
        // Update shader uniforms with luminance compensation
        this.coreShaderMaterial.uniforms.color.value = colorObj;
        this.coreShaderMaterial.uniforms.glowColor.value = colorObj;
        // Use smoothed power for visual effects to eliminate jarring changes
        this.coreShaderMaterial.uniforms.power.value = this.smoothPower * 0.2; // Reduced power influence
        this.coreShaderMaterial.uniforms.intensity.value = (gameState.precisionAimActive ? 2.0 : 1.5) * intensityBoost;
        
        // Update impact indicator
        if (gameState.trajectoryEndPosition) {
            this.impactRing.visible = true;
            this.impactRing.position.copy(gameState.trajectoryEndPosition);
            this.impactRing.position.z = 0.1;
            
            // Show target indicator if hitting a matching bubble
            if (targetBubble && gameState.currentBubble && 
                targetBubble.color === gameState.currentBubble.color) {
                this.targetIndicator.visible = true;
                this.targetIndicator.position.copy(gameState.trajectoryEndPosition);
                this.targetIndicator.position.z = 0.05;
            } else {
                this.targetIndicator.visible = false;
            }
        } else {
            this.impactRing.visible = false;
            this.targetIndicator.visible = false;
        }
        
        // Register for bloom now that we're visible
        this.registerForBloom();
    }
    
    renderTrajectory(gameState) {
        // Update animation
        this.time += 0.016;
        
        // Animate shader uniforms
        if (this.coreShaderMaterial) {
            this.coreShaderMaterial.uniforms.time.value = this.time;
        }
        
        // Animate electrical arcs for Chain Lightning
        if (gameState.currentBubble && gameState.currentBubble.isPowerUp && 
            gameState.currentBubble.powerUpType === 'chainLightning' && 
            this.points.length > 2) {
            
            // Create curve from trajectory points for arc animation
            const curve = new THREE.CatmullRomCurve3(this.points);
            
            this.electricArcs.forEach((arc, index) => {
                // Move arc along the trajectory
                arc.userData.offset += arc.userData.speed * 0.005;
                if (arc.userData.offset > 1) arc.userData.offset = 0;
                
                // Get position along curve
                try {
                    const point = curve.getPointAt(Math.min(0.99, arc.userData.offset));
                    arc.position.copy(point);
                    
                    // Add electrical jitter
                    arc.position.x += (Math.random() - 0.5) * 0.08;
                    arc.position.y += (Math.random() - 0.5) * 0.08;
                    arc.position.z = 0.15; // Slightly above trajectory
                    
                    // Flicker effect with more variation
                    const flicker = Math.sin(this.time * 25 + arc.userData.flickerPhase) * 0.5 + 0.5;
                    const randomFlicker = Math.random() > 0.8 ? 0 : 1;
                    arc.material.opacity = (0.2 + flicker * 0.6) * randomFlicker;
                    
                    // Occasional bright flash
                    if (Math.random() < 0.02) {
                        arc.material.opacity = 1;
                        arc.material.color.setHex(0xffffff);
                    } else {
                        arc.material.color.setHex(arc.userData.baseColor);
                    }
                    
                    // Scale variation
                    const scale = 0.8 + Math.sin(this.time * 10 + index) * 0.3;
                    arc.scale.setScalar(scale);
                    
                    arc.visible = true;
                } catch(e) {
                    arc.visible = false;
                }
            });
        } else {
            // Hide arcs when not Chain Lightning
            this.electricArcs.forEach(arc => arc.visible = false);
        }
        
        // Update colors every frame for rainbow cycling and other dynamic effects
        const color = this.getColor(gameState);
        const colorObj = new THREE.Color(color);
        
        // Calculate luminance for intensity compensation
        const luminance = colorObj.r * 0.299 + colorObj.g * 0.587 + colorObj.b * 0.114;
        const intensityBoost = luminance < 0.5 ? 1.3 : 1.0;
        
        // Update main beam material color with compensation
        this.beamMaterial.color = colorObj;
        this.beamMaterial.emissive = colorObj;
        this.beamMaterial.emissiveIntensity = (gameState.precisionAimActive ? 3.0 : 2.5) * intensityBoost;
        
        // Smooth the power value for visual effects
        const targetPower = gameState.shootingPower || 0;
        this.smoothPower += (targetPower - this.smoothPower) * this.powerSmoothingFactor;
        
        // Update core shader color and power with luminance compensation
        if (this.coreShaderMaterial) {
            this.coreShaderMaterial.uniforms.glowColor.value = colorObj;
            // Use smoothed power for consistent visuals
            this.coreShaderMaterial.uniforms.power.value = this.smoothPower * 0.2;
            this.coreShaderMaterial.uniforms.intensity.value = 1.5 * intensityBoost;
        }
        
        // Update impact ring color
        if (this.impactRingMaterial) {
            this.impactRingMaterial.color = colorObj;
            this.impactRingMaterial.emissive = colorObj;
        }
        
        // Update target indicator color
        if (this.targetMaterial) {
            this.targetMaterial.color = colorObj;
            this.targetMaterial.emissive = colorObj;
        }
        
        // Animate impact ring
        if (this.impactRing.visible) {
            const pulse = Math.sin(this.time * 4) * 0.1 + 0.9;
            this.impactRing.scale.setScalar(pulse);
            this.impactRing.rotation.z = this.time * 2;
            
            // Animate emissive intensity for pulsing glow
            this.impactRingMaterial.emissiveIntensity = 1.0 + Math.sin(this.time * 3) * 0.5;
        }
        
        // Animate target indicator
        if (this.targetIndicator.visible) {
            const pulse = Math.sin(this.time * 5) * 0.15 + 0.85;
            this.targetIndicator.scale.setScalar(pulse);
            
            // Animate emissive intensity
            this.targetMaterial.emissiveIntensity = 0.8 + Math.sin(this.time * 4) * 0.4;
        }
        
        // Update material properties based on precision aim
        if (gameState.precisionAimActive) {
            this.beamMaterial.opacity = 0.9;
            this.coreShaderMaterial.uniforms.opacity.value = 0.7;
        } else {
            this.beamMaterial.opacity = 0.85;
            this.coreShaderMaterial.uniforms.opacity.value = 0.6;
        }
    }
    
    hideTrajectory() {
        this.laserBeam.visible = false;
        this.energyCore.visible = false;
        if (this.glowLayer) this.glowLayer.visible = false;
        this.impactRing.visible = false;
        this.targetIndicator.visible = false;
        this.points = [];
        this.pointCount = 0;
        
        // Don't unregister from bloom - keep bloom objects registered
        // This prevents bloom from disappearing between shots
        // The objects are hidden (visible = false) so they won't render anyway
    }
    
    resetPower() {
        // Reset smoothed power values to prevent carryover from previous shot
        this.smoothPower = 0;
        this.smoothTrajectoryPower = 0;
    }
    
    getColor(gameState) {
        if (gameState.precisionAimActive) return 0x00ffff;
        if (!gameState.currentBubble) return 0xffffff;
        
        // Check for Chain Lightning power-up
        if (gameState.currentBubble.isPowerUp && gameState.currentBubble.powerUpType === 'chainLightning') {
            // Electric blue color for chain lightning
            return 0x00ddff;
        }
        
        if (gameState.currentBubble.isPowerUp && gameState.currentBubble.powerUpType === 'rainbow') {
            // Use global time for synchronization with bubble color
            const globalTime = Date.now() * 0.001;
            const hue = (globalTime * 0.3) % 1; // Same speed as bubble
            return new THREE.Color().setHSL(hue, 1, 0.6).getHex();
        }
        
        return gameState.currentBubble.color;
    }
    
    dispose() {
        // Unregister from bloom
        this.unregisterFromBloom();
        
        // Dispose geometries and materials
        if (this.laserBeam) {
            this.laserBeam.geometry.dispose();
            this.beamMaterial.dispose();
        }
        
        if (this.energyCore) {
            this.energyCore.geometry.dispose();
            this.coreShaderMaterial.dispose();
        }
        
        // Glow layer removed - no disposal needed
        
        if (this.impactRing) {
            this.impactRing.geometry.dispose();
            this.impactRingMaterial.dispose();
        }
        
        if (this.targetIndicator) {
            this.targetIndicator.geometry.dispose();
            this.targetMaterial.dispose();
        }
        
        // Remove from scene
        this.scene.remove(this.trajectoryGroup);
        this.scene.remove(this.impactRing);
        this.scene.remove(this.targetIndicator);
    }
}