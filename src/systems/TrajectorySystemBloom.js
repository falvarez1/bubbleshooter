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
        
        // Main laser beam geometry
        const beamGeometry = new THREE.TubeGeometry(curve, 32, 0.02, 8, false);
        
        // Use MeshStandardMaterial with strong emissive for bloom
        this.beamMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff, // Emissive color for bloom
            emissiveIntensity: 3.0, // Very strong emission for visible bloom
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 1.0, // Full opacity for maximum bloom
            toneMapped: false // Prevent tone mapping from dimming the glow
        });
        
        this.laserBeam = new THREE.Mesh(beamGeometry, this.beamMaterial);
        this.laserBeam.visible = false;
        this.trajectoryGroup.add(this.laserBeam);
        
        // Energy core with animated shader
        this.coreShaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x00ffff) },
                glowColor: { value: new THREE.Color(0x00ffff) },
                time: { value: 0 },
                opacity: { value: 0.9 },
                power: { value: 0 },
                intensity: { value: 2.0 }
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
                    // Energy flow along the beam
                    float flow = vUv.x * 20.0 - time * 5.0;
                    float energy = sin(flow) * 0.5 + 0.5;
                    
                    // Pulse effect
                    float pulse = sin(time * 4.0) * 0.2 + 0.8;
                    
                    // Power boost
                    float boost = 1.0 + power * 1.5;
                    
                    // Create bright core with falloff
                    float coreBrightness = 1.0 - smoothstep(0.0, 1.0, abs(vUv.y - 0.5) * 2.0);
                    
                    // Mix colors for variety - increased brightness
                    vec3 finalColor = mix(color, glowColor, energy) * pulse * boost * intensity * 2.0;
                    finalColor += vec3(coreBrightness * 0.8); // Brighter white core
                    
                    float finalOpacity = opacity * (0.7 + energy * 0.3) * coreBrightness;
                    
                    gl_FragColor = vec4(finalColor, finalOpacity);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending, // Additive blending for glow
            toneMapped: false // Prevent tone mapping
        });
        
        // Create energy core (slightly thinner)
        const coreGeometry = new THREE.TubeGeometry(curve, 32, 0.015, 6, false);
        this.energyCore = new THREE.Mesh(coreGeometry, this.coreShaderMaterial);
        this.energyCore.visible = false;
        this.trajectoryGroup.add(this.energyCore);
        
        // Add outer glow layer for enhanced bloom
        const glowGeometry = new THREE.TubeGeometry(curve, 16, 0.04, 4, false);
        this.glowMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 2.0, // Increased for more bloom
            transparent: true,
            opacity: 0.6, // Increased opacity
            roughness: 0,
            metalness: 0,
            toneMapped: false
        });
        
        this.glowLayer = new THREE.Mesh(glowGeometry, this.glowMaterial);
        this.glowLayer.visible = false;
        this.trajectoryGroup.add(this.glowLayer);
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
            // Add all trajectory components to bloom
            this.postProcessing.addBloomObject(this.laserBeam, 'trajectoryLine');
            this.postProcessing.addBloomObject(this.energyCore, 'trajectoryLine');
            this.postProcessing.addBloomObject(this.glowLayer, 'trajectoryGlow');
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
            this.postProcessing.removeBloomObject(this.glowLayer, 'trajectoryGlow');
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
        
        // Create smooth curve from points
        const curve = new THREE.CatmullRomCurve3(this.points);
        
        // Store old geometries
        const oldLaserGeometry = this.laserBeam.geometry;
        const oldCoreGeometry = this.energyCore.geometry;
        const oldGlowGeometry = this.glowLayer.geometry;
        
        // Update main laser beam geometry
        const newGeometry = new THREE.TubeGeometry(curve, Math.min(64, this.pointCount), 0.02, 8, false);
        this.laserBeam.geometry = newGeometry;
        this.laserBeam.visible = true;
        
        // Update energy core
        const coreGeometry = new THREE.TubeGeometry(curve, Math.min(32, this.pointCount), 0.015, 6, false);
        this.energyCore.geometry = coreGeometry;
        this.energyCore.visible = true;
        
        // Update glow layer
        const glowGeometry = new THREE.TubeGeometry(curve, Math.min(16, this.pointCount), 0.04, 4, false);
        this.glowLayer.geometry = glowGeometry;
        this.glowLayer.visible = true;
        
        // Dispose old geometries AFTER setting new ones
        oldLaserGeometry.dispose();
        oldCoreGeometry.dispose();
        oldGlowGeometry.dispose();
        
        // Update colors based on state
        const color = this.getColor(gameState);
        const colorObj = new THREE.Color(color);
        
        // Update main beam material
        this.beamMaterial.color = colorObj;
        this.beamMaterial.emissive = colorObj;
        this.beamMaterial.emissiveIntensity = gameState.precisionAimActive ? 4.0 : 3.0; // Increased intensity
        
        // Update glow material
        this.glowMaterial.color = colorObj;
        this.glowMaterial.emissive = colorObj;
        this.glowMaterial.emissiveIntensity = gameState.precisionAimActive ? 2.5 : 2.0; // Increased intensity
        
        // Smooth the power value for visual effects
        const targetPower = gameState.shootingPower || 0;
        this.smoothPower += (targetPower - this.smoothPower) * this.powerSmoothingFactor;
        
        // Update shader uniforms
        this.coreShaderMaterial.uniforms.color.value = colorObj;
        this.coreShaderMaterial.uniforms.glowColor.value = colorObj;
        // Use smoothed power for visual effects to eliminate jarring changes
        this.coreShaderMaterial.uniforms.power.value = this.smoothPower * 0.3;
        this.coreShaderMaterial.uniforms.intensity.value = gameState.precisionAimActive ? 3.0 : 2.5; // Increased intensity
        
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
        
        // Update main beam material color
        this.beamMaterial.color = colorObj;
        this.beamMaterial.emissive = colorObj;
        this.beamMaterial.emissiveIntensity = gameState.precisionAimActive ? 4.0 : 3.0;
        
        // Update glow material color
        this.glowMaterial.color = colorObj;
        this.glowMaterial.emissive = colorObj;
        this.glowMaterial.emissiveIntensity = gameState.precisionAimActive ? 2.5 : 2.0;
        
        // Smooth the power value for visual effects
        const targetPower = gameState.shootingPower || 0;
        this.smoothPower += (targetPower - this.smoothPower) * this.powerSmoothingFactor;
        
        // Update core shader color and power
        if (this.coreShaderMaterial) {
            this.coreShaderMaterial.uniforms.glowColor.value = colorObj;
            // Use smoothed power for consistent visuals
            this.coreShaderMaterial.uniforms.power.value = this.smoothPower * 0.3;
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
            this.beamMaterial.opacity = 0.95;
            this.coreShaderMaterial.uniforms.opacity.value = 0.95;
            this.glowMaterial.opacity = 0.4;
        } else {
            this.beamMaterial.opacity = 0.85;
            this.coreShaderMaterial.uniforms.opacity.value = 0.85;
            this.glowMaterial.opacity = 0.3;
        }
    }
    
    hideTrajectory() {
        this.laserBeam.visible = false;
        this.energyCore.visible = false;
        this.glowLayer.visible = false;
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
        
        if (this.glowLayer) {
            this.glowLayer.geometry.dispose();
            this.glowMaterial.dispose();
        }
        
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