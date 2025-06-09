import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Trajectory System
 * Handles trajectory calculation and rendering for bubble shooting
 */
export class TrajectorySystem {
    constructor(scene) {
        this.scene = scene;
        this.trajectoryGroup = null;
    }
    
    calculateTrajectory(startBubble, mousePosition, gameState) {
        if (!startBubble || startBubble.isMoving || gameState.isPaused) {
            gameState.trajectory = [];
            gameState.trajectoryEndPosition = null;
            return;
        }
        
        gameState.trajectory = [];
        gameState.trajectoryEndPosition = null;
        gameState.bouncePoints = []; // Track bounce locations for visual effects
        const startPos = startBubble.position.clone();
        const direction = new THREE.Vector3(
            mousePosition.x - startPos.x,
            mousePosition.y - startPos.y,
            0
        );
        
        // Check minimum angle
        if (direction.y < 0.3) {
            // Don't show trajectory for invalid angles
            return;
        }
        
        direction.normalize();
        
        let pos = startPos.clone();
        // Use the same speed calculation as the actual shooting
        const power = gameState.shootingPower || 0;
        const speed = gameState.precisionAimActive ? 
            CONFIG.SHOOTING_SPEED : 
            CONFIG.SHOOTING_SPEED + (CONFIG.MAX_SHOOTING_SPEED - CONFIG.SHOOTING_SPEED) * power;
        let vel = direction.multiplyScalar(speed);
        const step = 0.01; // Smaller steps for more accurate trajectory matching actual physics
        const maxSteps = gameState.precisionAimActive ? 750 : 300;
        let bounceCount = 0;
        const maxBounces = gameState.precisionAimActive ? 5 : 2;
        
        for (let i = 0; i < maxSteps; i++) {
            // Calculate next position
            const nextPos = pos.clone().add(vel.clone().multiplyScalar(step));
            
            // Check collision with existing bubbles BEFORE moving
            let hitBubble = false;
            for (let y = 0; y < CONFIG.GRID_HEIGHT && !hitBubble; y++) {
                const isOddRow = y % 2 === 1;
                const bubblesInRow = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
                
                for (let x = 0; x < bubblesInRow; x++) {
                    const bubble = gameState.bubbleGrid[y][x];
                    if (bubble && !bubble.isDestroyed && !bubble.isFloating) {
                        const distance = nextPos.distanceTo(bubble.position);
                        if (distance < CONFIG.BUBBLE_RADIUS * 1.8) {
                            hitBubble = true;
                            break;
                        }
                    }
                }
            }
            
            // Stop if we would hit a bubble
            if (hitBubble) {
                // Store the end position for precision aim indicator
                gameState.trajectoryEndPosition = pos.clone();
                // Add a few more points to show where it stops
                for (let j = 0; j < 6; j++) {
                    gameState.trajectory.push(pos.clone());
                }
                break;
            }
            
            // Now move to next position
            pos = nextPos;
            
            // Check wall bounce - use same values as actual bubble physics
            const wallLimit = 5.5;
            if (Math.abs(pos.x) > wallLimit - CONFIG.BUBBLE_RADIUS) {
                vel.x *= -CONFIG.WALL_BOUNCE_DAMPING; // Apply same damping as actual bubble
                pos.x = Math.sign(pos.x) * (wallLimit - CONFIG.BUBBLE_RADIUS);
                
                // Record bounce point for visual effects
                gameState.bouncePoints.push({
                    position: pos.clone(),
                    confidence: 1.0 - (bounceCount * CONFIG.TRAJECTORY.LASER.BOUNCE_EFFECTS.CONFIDENCE_FADE),
                    bounceIndex: bounceCount
                });
                
                bounceCount++;
                
                if (bounceCount >= maxBounces && !gameState.precisionAimActive) {
                    break;
                }
            }
            
            // Stop at ceiling - match actual bubble physics
            if (pos.y > CONFIG.CEILING_Y - 0.5 - CONFIG.BUBBLE_RADIUS) {
                pos.y = CONFIG.CEILING_Y - 0.5 - CONFIG.BUBBLE_RADIUS;
                gameState.trajectoryEndPosition = pos.clone();
                break;
            }
            
            // Add point to trajectory
            gameState.trajectory.push(pos.clone());
        }
    }
    
    renderTrajectory(gameState) {
        // Check if we need to render
        if (gameState.trajectory.length < 6 || !gameState.currentBubble) {
            // Hide existing trajectory
            if (this.trajectoryGroup) {
                this.trajectoryGroup.visible = false;
            }
            return;
        }
        
        // Check if we need to recreate the trajectory (path changed significantly or power changed)
        const needsRecreate = !this.trajectoryGroup || 
                             !this.trajectoryGroup.userData.trajectory ||
                             this.trajectoryPathChanged(gameState.trajectory, this.trajectoryGroup.userData.trajectory) ||
                             this.powerLevelChanged(gameState);
        
        if (needsRecreate) {
            // Remove old trajectory
            if (this.trajectoryGroup) {
                this.trajectoryGroup.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
                this.scene.remove(this.trajectoryGroup);
                this.trajectoryGroup = null;
            }
            
            this.trajectoryGroup = new THREE.Group();
            this.trajectoryGroup.name = 'trajectoryGroup';
            
            // Store trajectory data for animation
            this.trajectoryGroup.userData = {
                trajectory: [...gameState.trajectory],
                time: 0,
                dots: [],
                lastPowerLevel: gameState.shootingPower || 0,
                lastPrecisionAim: gameState.precisionAimActive || false
            };
            
            // Choose rendering style based on config
            if (CONFIG.TRAJECTORY.USE_ANIMATED_STYLE) {
                this.createLaserBeam(gameState);
            } else {
                this.createDotTrajectory(gameState);
            }
            
            this.scene.add(this.trajectoryGroup);
        } else {
            // Just update existing trajectory
            this.trajectoryGroup.visible = true;
            
            // Handle real-time power updates without full recreation
            this.updatePowerResponsiveUniforms(gameState);
            
            // Update stored power level for future comparisons
            this.trajectoryGroup.userData.lastPowerLevel = gameState.shootingPower || 0;
            this.trajectoryGroup.userData.lastPrecisionAim = gameState.precisionAimActive || false;
            
            // Update color if bubble color changed
            if (CONFIG.TRAJECTORY.USE_ANIMATED_STYLE && this.trajectoryGroup.userData.laser) {
                const trajectoryColor = gameState.precisionAimActive ? 0x00ffff : gameState.currentBubble.color;
                if (!gameState.precisionAimActive) {
                    const baseColor = new THREE.Color(trajectoryColor);
                    this.trajectoryGroup.userData.laser.material.uniforms.color.value = baseColor;
                    this.trajectoryGroup.userData.laser.glowMaterial.uniforms.color.value = baseColor;
                    this.trajectoryGroup.userData.laser.baseColor = trajectoryColor;
                }
            }
        }
    }
    
    trajectoryPathChanged(newPath, oldPath) {
        if (!oldPath || newPath.length !== oldPath.length) return true;
        
        // Check if path changed significantly (simple distance check)
        for (let i = 0; i < Math.min(newPath.length, oldPath.length); i += 5) {
            if (newPath[i].distanceTo(oldPath[i]) > 0.1) {
                return true;
            }
        }
        return false;
    }
    
    powerLevelChanged(gameState) {
        if (!this.trajectoryGroup || !this.trajectoryGroup.userData) return false;
        
        const currentPower = gameState.shootingPower || 0;
        const currentPrecisionAim = gameState.precisionAimActive || false;
        const lastPower = this.trajectoryGroup.userData.lastPowerLevel || 0;
        const lastPrecisionAim = this.trajectoryGroup.userData.lastPrecisionAim || false;
        
        // Check for precision aim change (always requires recreation)
        const precisionAimChanged = currentPrecisionAim !== lastPrecisionAim;
        
        // Check for significant power change that requires geometry recreation (parallel beams)
        const powerScaling = CONFIG.TRAJECTORY.LASER.POWER_SCALING;
        const needsParallelBeams = currentPower >= powerScaling.PARALLEL_BEAMS_THRESHOLD;
        const hadParallelBeams = lastPower >= powerScaling.PARALLEL_BEAMS_THRESHOLD;
        const parallelBeamsChanged = needsParallelBeams !== hadParallelBeams;
        
        // Check for major thickness changes (every 20% power change to update geometry)
        const powerTier = Math.floor(currentPower * 5); // 0-4 tiers
        const lastPowerTier = Math.floor(lastPower * 5);
        const thicknessChanged = powerTier !== lastPowerTier;
        
        // Recreate for major changes that affect geometry
        return precisionAimChanged || parallelBeamsChanged || thicknessChanged;
    }
    
    updatePowerResponsiveUniforms(gameState) {
        if (!this.trajectoryGroup || !this.trajectoryGroup.userData.laser) return;
        
        const laser = this.trajectoryGroup.userData.laser;
        const power = gameState.shootingPower || 0;
        const powerScaling = CONFIG.TRAJECTORY.LASER.POWER_SCALING;
        
        // Calculate power-responsive values
        const intensityMultiplier = 1 + (power * powerScaling.INTENSITY_MULTIPLIER);
        const flowSpeedMultiplier = 1 + (power * powerScaling.FLOW_SPEED_MULTIPLIER);
        const isPowerSurge = power >= powerScaling.POWER_SURGE_THRESHOLD;
        
        // Update main laser material uniforms
        if (laser.material && laser.material.uniforms) {
            const baseIntensity = gameState.precisionAimActive ? CONFIG.TRAJECTORY.LASER.INTENSITY * 1.5 : CONFIG.TRAJECTORY.LASER.INTENSITY;
            const finalIntensity = baseIntensity * intensityMultiplier * (isPowerSurge ? powerScaling.SURGE_INTENSITY : 1);
            
            laser.material.uniforms.power.value = power;
            laser.material.uniforms.intensity.value = finalIntensity;
            laser.material.uniforms.flowSpeed.value = CONFIG.TRAJECTORY.LASER.FLOW_SPEED * flowSpeedMultiplier;
            laser.material.uniforms.isPowerSurge.value = isPowerSurge ? 1.0 : 0.0;
        }
        
        // Update glow material if it exists
        if (laser.glowMaterial && laser.glowMaterial.uniforms) {
            laser.glowMaterial.uniforms.intensity.value = 1.2 * intensityMultiplier;
        }
        
        // Update parallel beams if they exist
        if (laser.parallelBeams && laser.parallelBeams.length > 0) {
            laser.parallelBeams.forEach((beam) => {
                if (beam.material && beam.material.uniforms) {
                    beam.material.uniforms.power.value = power;
                    beam.material.uniforms.isPowerSurge.value = isPowerSurge ? 1.0 : 0.0;
                    
                    const baseIntensity = gameState.precisionAimActive ? CONFIG.TRAJECTORY.LASER.INTENSITY * 1.5 : CONFIG.TRAJECTORY.LASER.INTENSITY;
                    const finalIntensity = baseIntensity * intensityMultiplier * (isPowerSurge ? powerScaling.SURGE_INTENSITY : 1);
                    beam.material.uniforms.intensity.value = finalIntensity * 0.6; // Dimmer than main beam
                }
            });
        }
    }
    
    getTrajectoryColor(gameState) {
        // Handle precision aim mode
        if (gameState.precisionAimActive) {
            return 0x00ffff; // Cyan for precision aim
        }
        
        // Handle rainbow bubble
        if (gameState.currentBubble && gameState.currentBubble.isPowerUp && gameState.currentBubble.powerUpType === 'rainbow') {
            // Rainbow cycling effect
            const time = Date.now() * 0.001;
            const hue = (time * CONFIG.TRAJECTORY.LASER.COLOR_CODING.RAINBOW_CYCLE_SPEED) % 1;
            return new THREE.Color().setHSL(hue, 1, 0.6).getHex();
        }
        
        // Assess shot quality and adjust color accordingly
        const shotAssessment = this.assessShotQuality(gameState);
        
        if (shotAssessment.isOptimal) {
            // Green tint for optimal shots
            const colorCoding = CONFIG.TRAJECTORY.LASER.COLOR_CODING;
            const baseColor = new THREE.Color(gameState.currentBubble.color);
            const optimalColor = new THREE.Color().setHSL(colorCoding.OPTIMAL_SHOT_HUE / 360, 0.8, 0.6);
            return baseColor.lerp(optimalColor, 0.4).getHex();
        } else if (shotAssessment.isRisky) {
            // Red tint for risky shots
            const colorCoding = CONFIG.TRAJECTORY.LASER.COLOR_CODING;
            const baseColor = new THREE.Color(gameState.currentBubble.color);
            const riskyColor = new THREE.Color().setHSL(colorCoding.RISKY_SHOT_HUE / 360, 0.8, 0.6);
            return baseColor.lerp(riskyColor, 0.3).getHex();
        }
        
        // Default to bubble color with slight saturation boost
        const baseColor = new THREE.Color(gameState.currentBubble.color);
        const hsl = {};
        baseColor.getHSL(hsl);
        baseColor.setHSL(hsl.h, Math.min(1, hsl.s + CONFIG.TRAJECTORY.LASER.COLOR_CODING.SATURATION_BOOST), hsl.l);
        return baseColor.getHex();
    }
    
    assessShotQuality(gameState) {
        if (!gameState.trajectory || gameState.trajectory.length === 0 || !gameState.trajectoryEndPosition) {
            return { isOptimal: false, isRisky: false, confidence: 0 };
        }
        
        // Check for potential matches at end position
        const endPos = gameState.trajectoryEndPosition;
        const currentColor = gameState.currentBubble.color;
        let matchingNeighbors = 0;
        let totalNeighbors = 0;
        
        // Check surrounding bubbles at trajectory end
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            const isOddRow = y % 2 === 1;
            const bubblesInRow = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                const bubble = gameState.bubbleGrid[y][x];
                if (bubble && !bubble.isDestroyed && !bubble.isFloating) {
                    const distance = endPos.distanceTo(bubble.position);
                    if (distance < CONFIG.BUBBLE_RADIUS * 3) { // Within neighbor range
                        totalNeighbors++;
                        if (bubble.color === currentColor) {
                            matchingNeighbors++;
                        }
                    }
                }
            }
        }
        
        // Assess quality
        const matchRatio = totalNeighbors > 0 ? matchingNeighbors / totalNeighbors : 0;
        const bounceCount = gameState.bouncePoints ? gameState.bouncePoints.length : 0;
        const trajectoryLength = gameState.trajectory.length;
        
        // Optimal shot: good matches, few bounces, reasonable trajectory
        const isOptimal = matchRatio >= 0.5 && bounceCount <= 1 && trajectoryLength < 200;
        
        // Risky shot: poor matches, many bounces, or very long trajectory
        const isRisky = matchRatio < CONFIG.TRAJECTORY.LASER.COLOR_CODING.RISK_THRESHOLD || 
                       bounceCount > 2 || 
                       trajectoryLength > 400;
        
        return {
            isOptimal,
            isRisky,
            confidence: Math.max(0, 1 - bounceCount * 0.2 - (trajectoryLength / 500)),
            matchRatio,
            bounceCount,
            trajectoryLength
        };
    }
    
    createDotTrajectory(gameState) {
        // Create glowing dots along the trajectory using config settings
        const dotCount = Math.min(gameState.trajectory.length, 
            gameState.precisionAimActive ? CONFIG.TRAJECTORY.PRECISION_DOT_COUNT : CONFIG.TRAJECTORY.NORMAL_DOT_COUNT);
        const spacing = Math.max(1, Math.floor(gameState.trajectory.length / dotCount));
        
        for (let i = 0; i < dotCount; i++) {
            const index = i * spacing;
            if (index >= gameState.trajectory.length) break;
            
            const point = gameState.trajectory[index];
            const progress = i / dotCount;
            
            // Use config settings for size and opacity
            const baseSize = CONFIG.TRAJECTORY.BASE_SIZE_MIN + 
                progress * (CONFIG.TRAJECTORY.BASE_SIZE_MAX - CONFIG.TRAJECTORY.BASE_SIZE_MIN);
            const baseOpacity = CONFIG.TRAJECTORY.BASE_OPACITY_MIN + 
                progress * (CONFIG.TRAJECTORY.BASE_OPACITY_MAX - CONFIG.TRAJECTORY.BASE_OPACITY_MIN);
            
            const trajectoryColor = gameState.precisionAimActive ? 0x00ffff : gameState.currentBubble.color;
            const emissiveIntensity = gameState.precisionAimActive ? 
                CONFIG.TRAJECTORY.EMISSIVE_INTENSITY_PRECISION : 
                CONFIG.TRAJECTORY.EMISSIVE_INTENSITY;
            
            // Create main dot with proper materials for glowing effect
            const dotGeometry = new THREE.SphereGeometry(baseSize, 12, 12);
            const dotMaterial = new THREE.MeshStandardMaterial({
                color: trajectoryColor,
                transparent: true,
                opacity: baseOpacity,
                emissive: trajectoryColor,
                emissiveIntensity: emissiveIntensity
            });
            
            const dot = new THREE.Mesh(dotGeometry, dotMaterial);
            dot.position.copy(point);
            
            // Add glow effect using config multipliers
            const glowSize = baseSize * CONFIG.TRAJECTORY.GLOW_SIZE_MULTIPLIER;
            const glowOpacity = baseOpacity * CONFIG.TRAJECTORY.GLOW_OPACITY_MULTIPLIER;
            
            const glowGeometry = new THREE.SphereGeometry(glowSize, 8, 8);
            const glowMaterial = new THREE.MeshStandardMaterial({
                color: trajectoryColor,
                transparent: true,
                opacity: Math.max(CONFIG.TRAJECTORY.MIN_GLOW_OPACITY, glowOpacity),
                emissive: trajectoryColor,
                emissiveIntensity: emissiveIntensity * 0.8,
                blending: THREE.AdditiveBlending
            });
            
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            glow.position.copy(point);
            
            // Store dot data for animation
            this.trajectoryGroup.userData.dots.push({
                dot: dot,
                glow: glow,
                basePosition: point.clone(),
                index: i,
                trajectoryIndex: index,
                baseSize: baseSize,
                baseOpacity: baseOpacity,
                glowSize: glowSize,
                glowOpacity: glowOpacity,
                emissiveIntensity: emissiveIntensity,
                nextIndex: Math.min(index + spacing, gameState.trajectory.length - 1)
            });
            
            this.trajectoryGroup.add(glow);
            this.trajectoryGroup.add(dot);
        }
        
        // Add animation for dots only if animated style is enabled
        if (CONFIG.TRAJECTORY.USE_ANIMATED_STYLE) {
            this.addTrajectoryAnimation(gameState);
        }
    }
    
    createLaserBeam(gameState) {
        // Create animated flowing laser beam with shaders
        const trajectoryColor = this.getTrajectoryColor(gameState);
        const colorVec = new THREE.Color(trajectoryColor);
        
        // Calculate power-responsive properties
        const power = gameState.shootingPower || 0;
        const powerScaling = CONFIG.TRAJECTORY.LASER.POWER_SCALING;
        const thicknessMultiplier = 1 + (power * powerScaling.THICKNESS_MULTIPLIER);
        const intensityMultiplier = 1 + (power * powerScaling.INTENSITY_MULTIPLIER);
        const flowSpeedMultiplier = 1 + (power * powerScaling.FLOW_SPEED_MULTIPLIER);
        
        // Create tube geometry for the entire trajectory with power-responsive thickness
        const points = gameState.trajectory;
        const curve = new THREE.CatmullRomCurve3(points, false);
        const beamRadius = CONFIG.TRAJECTORY.LASER.BEAM_RADIUS * thicknessMultiplier;
        const tubeGeometry = new THREE.TubeGeometry(curve, points.length * 2, beamRadius, 8, false);
        
        // Create flowing laser shader material with power-responsive uniforms
        const baseIntensity = gameState.precisionAimActive ? CONFIG.TRAJECTORY.LASER.INTENSITY * 1.5 : CONFIG.TRAJECTORY.LASER.INTENSITY;
        const isPowerSurge = power >= powerScaling.POWER_SURGE_THRESHOLD;
        const finalIntensity = baseIntensity * intensityMultiplier * (isPowerSurge ? powerScaling.SURGE_INTENSITY : 1);
        
        const laserMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: colorVec },
                intensity: { value: finalIntensity },
                flowSpeed: { value: CONFIG.TRAJECTORY.LASER.FLOW_SPEED * flowSpeedMultiplier },
                pulseSpeed: { value: CONFIG.TRAJECTORY.LASER.PULSE_SPEED },
                opacity: { value: CONFIG.TRAJECTORY.LASER.OPACITY },
                waveFreq: { value: CONFIG.TRAJECTORY.LASER.WAVE_FREQUENCY },
                packetFreq: { value: CONFIG.TRAJECTORY.LASER.PACKET_FREQUENCY },
                highlightFreq: { value: CONFIG.TRAJECTORY.LASER.HIGHLIGHT_FREQUENCY },
                waveAmp: { value: CONFIG.TRAJECTORY.LASER.WAVE_AMPLITUDE },
                packetAmp: { value: CONFIG.TRAJECTORY.LASER.PACKET_AMPLITUDE },
                highlightAmp: { value: CONFIG.TRAJECTORY.LASER.HIGHLIGHT_AMPLITUDE },
                // Power-responsive uniforms
                power: { value: power },
                cracklingFreq: { value: powerScaling.CRACKLING_FREQUENCY },
                cracklingAmp: { value: powerScaling.CRACKLING_AMPLITUDE },
                isPowerSurge: { value: isPowerSurge ? 1.0 : 0.0 }
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
                uniform float time;
                uniform vec3 color;
                uniform float intensity;
                uniform float flowSpeed;
                uniform float pulseSpeed;
                uniform float opacity;
                uniform float waveFreq;
                uniform float packetFreq;
                uniform float highlightFreq;
                uniform float waveAmp;
                uniform float packetAmp;
                uniform float highlightAmp;
                uniform float power;
                uniform float cracklingFreq;
                uniform float cracklingAmp;
                uniform float isPowerSurge;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    // Create configurable flowing waves with power enhancement
                    float powerWaveBoost = 1.0 + power * 0.5;
                    float wave1 = sin(vUv.x * waveFreq - time * flowSpeed) * waveAmp * powerWaveBoost + (1.0 - waveAmp * 0.5);
                    float wave2 = sin(vUv.x * (waveFreq * 1.5) - time * flowSpeed * 1.3) * (waveAmp * 0.75 * powerWaveBoost) + (1.0 - waveAmp * 0.3);
                    float wave3 = cos(vUv.x * (waveFreq * 2.0) - time * flowSpeed * 0.8) * (waveAmp * 0.5 * powerWaveBoost) + (1.0 - waveAmp * 0.2);
                    
                    // Power-enhanced energy packets
                    float packetSpeedBoost = 1.0 + power * 2.0;
                    float packets = smoothstep(0.5, 1.0, sin(vUv.x * packetFreq - time * flowSpeed * packetSpeedBoost)) * packetAmp;
                    packets += smoothstep(0.6, 1.0, sin(vUv.x * (packetFreq * 1.67) - time * flowSpeed * packetSpeedBoost * 0.75)) * (packetAmp * 0.75);
                    
                    // Add power crackling effects
                    float crackling = 0.0;
                    if (power > 0.3) {
                        crackling = sin(vUv.x * cracklingFreq - time * flowSpeed * 4.0) * 
                                   cos(vUv.y * cracklingFreq * 0.7 - time * flowSpeed * 3.0) * 
                                   cracklingAmp * power;
                        crackling = max(0.0, crackling);
                    }
                    
                    // Power surge effects
                    float surge = 0.0;
                    if (isPowerSurge > 0.5) {
                        surge = sin(time * 20.0 + vUv.x * 10.0) * sin(time * 15.0 + vUv.y * 8.0) * 0.4;
                        surge = max(0.0, surge);
                    }
                    
                    // Combine flowing effects with power enhancements
                    float flow = wave1 * wave2 * wave3 + packets * 0.8 + crackling * 0.6 + surge;
                    float flowMin = 0.6 + power * 0.3;
                    float flowMax = 2.5 + power * 1.5;
                    flow = clamp(flow, flowMin, flowMax);
                    
                    // Power-enhanced pulsing
                    float pulseBoost = 1.0 + power * 0.4;
                    float pulse = sin(time * pulseSpeed * pulseBoost + vUv.x * 3.0) * 0.3 + 0.8;
                    
                    // Power affects radial falloff (thicker beam visually)
                    float radialPower = 0.8 - power * 0.3; // Softer falloff with more power
                    float radial = 1.0 - pow(length(vUv - vec2(0.5, 0.5)) * 2.0, radialPower);
                    radial = smoothstep(0.0, 1.0, radial);
                    radial = max(radial, 0.3 + power * 0.2); // Higher minimum with power
                    
                    // Power-enhanced highlights
                    float highlightBoost = 1.0 + power * 1.0;
                    float highlights = smoothstep(0.7, 1.0, sin(vUv.x * highlightFreq - time * flowSpeed * 3.0 * highlightBoost)) * highlightAmp * highlightBoost;
                    
                    // Combine all effects with power scaling
                    float finalIntensity = (flow + highlights * 0.8) * pulse * radial * intensity;
                    
                    // Enhanced color with power-based emission
                    vec3 finalColor = color * finalIntensity;
                    finalColor += color * (0.3 + power * 0.2); // More base emission with power
                    
                    // Power affects opacity consistency
                    float opacityBoost = 0.7 + flow * 0.3 + power * 0.2;
                    float dynamicOpacity = opacity * radial * opacityBoost;
                    
                    gl_FragColor = vec4(finalColor, dynamicOpacity);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        
        const laserMesh = new THREE.Mesh(tubeGeometry, laserMaterial);
        this.trajectoryGroup.add(laserMesh);
        
        // Add parallel beams for high power
        const parallelBeams = [];
        if (power >= powerScaling.PARALLEL_BEAMS_THRESHOLD) {
            const numParallelBeams = Math.min(
                Math.floor((power - powerScaling.PARALLEL_BEAMS_THRESHOLD) / 0.1) + 1,
                powerScaling.MAX_PARALLEL_BEAMS
            );
            
            for (let i = 0; i < numParallelBeams; i++) {
                const offset = (i + 1) * 0.1; // Small offset for parallel beams
                const offsetCurve = new THREE.CatmullRomCurve3(
                    points.map(p => new THREE.Vector3(p.x + offset * (i % 2 === 0 ? 1 : -1), p.y, p.z))
                );
                const parallelGeometry = new THREE.TubeGeometry(offsetCurve, points.length * 2, beamRadius * 0.7, 6, false);
                const parallelMaterial = laserMaterial.clone();
                
                // Slightly different animation phase for each parallel beam
                parallelMaterial.uniforms.time.value = this.trajectoryGroup.userData.time + i * 0.5;
                parallelMaterial.uniforms.intensity.value = finalIntensity * 0.6; // Dimmer parallel beams
                
                const parallelBeam = new THREE.Mesh(parallelGeometry, parallelMaterial);
                this.trajectoryGroup.add(parallelBeam);
                parallelBeams.push({ mesh: parallelBeam, material: parallelMaterial, offset: i * 0.5 });
            }
        }
        
        // Create outer glow tube with power-responsive thickness
        const glowRadius = CONFIG.TRAJECTORY.LASER.GLOW_RADIUS * thicknessMultiplier;
        const glowGeometry = new THREE.TubeGeometry(curve, points.length * 2, glowRadius, 8, false);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: colorVec },
                intensity: { value: 1.2 },
                opacity: { value: 0.6 }
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
                uniform float intensity;
                uniform float opacity;
                varying vec2 vUv;
                
                void main() {
                    // Create stronger flowing glow effect
                    float flow = sin(vUv.x * 6.0 - time * 1.5) * 0.4 + 0.8;
                    float pulse = sin(time * 3.0 + vUv.x) * 0.3 + 0.9;
                    
                    // Much softer radial falloff for glow with higher base
                    float radial = 1.0 - pow(length(vUv - vec2(0.5, 0.5)) * 2.0, 0.6);
                    radial = smoothstep(0.0, 1.0, radial);
                    radial = max(radial, 0.4); // Ensure strong base glow
                    
                    vec3 finalColor = color * intensity * pulse * flow;
                    finalColor += color * 0.2; // Add base glow
                    
                    float finalOpacity = opacity * radial * (0.8 + pulse * flow * 0.2);
                    gl_FragColor = vec4(finalColor, finalOpacity);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.trajectoryGroup.add(glowMesh);
        
        // Create bounce flash effects
        this.createBounceEffects(gameState);
        
        // Create collision prediction and attachment point preview
        this.createCollisionPrediction(gameState);
        
        // Store laser data for animation
        this.trajectoryGroup.userData.laser = {
            mesh: laserMesh,
            glowMesh: glowMesh,
            material: laserMaterial,
            glowMaterial: glowMaterial,
            parallelBeams: parallelBeams,
            baseColor: trajectoryColor
        };
        
        // Add laser animation
        this.addLaserAnimation(gameState);
    }
    
    addLaserAnimation(gameState) {
        // Remove any existing laser animation for this trajectory
        const existingAnimations = gameState.animations || [];
        for (let i = existingAnimations.length - 1; i >= 0; i--) {
            if (existingAnimations[i].group === this.trajectoryGroup) {
                existingAnimations.splice(i, 1);
            }
        }
        
        const laserAnimation = {
            group: this.trajectoryGroup,
            update: function(deltaTime) {
                if (!this.group.parent || !this.group.visible) return false;
                
                this.group.userData.time += deltaTime * CONFIG.TRAJECTORY.ANIMATION_SPEED;
                const laser = this.group.userData.laser;
                
                if (laser && laser.material && laser.material.uniforms) {
                    // Update shader time uniform for flowing animation
                    laser.material.uniforms.time.value = this.group.userData.time;
                    laser.glowMaterial.uniforms.time.value = this.group.userData.time;
                    
                    // Update power-responsive values
                    const power = gameState.shootingPower || 0;
                    const powerScaling = CONFIG.TRAJECTORY.LASER.POWER_SCALING;
                    const isPowerSurge = power >= powerScaling.POWER_SURGE_THRESHOLD;
                    
                    laser.material.uniforms.power.value = power;
                    laser.material.uniforms.isPowerSurge.value = isPowerSurge ? 1.0 : 0.0;
                    
                    // Update color based on current state
                    const trajectoryColor = gameState.currentBubble ? 
                        (gameState.precisionAimActive ? 0x00ffff : gameState.currentBubble.color) : 
                        0xffffff;
                    
                    // Dynamic color shift for precision aim
                    if (gameState.precisionAimActive) {
                        const hue = (this.group.userData.time * 0.5) % 1;
                        const dynamicColor = new THREE.Color().setHSL(hue, 1, 0.6);
                        laser.material.uniforms.color.value = dynamicColor;
                        laser.glowMaterial.uniforms.color.value = dynamicColor;
                    } else if (gameState.currentBubble && gameState.currentBubble.isPowerUp && gameState.currentBubble.powerUpType === 'rainbow') {
                        // Rainbow cycling
                        const time = Date.now() * 0.001;
                        const hue = (time * CONFIG.TRAJECTORY.LASER.COLOR_CODING.RAINBOW_CYCLE_SPEED) % 1;
                        const rainbowColor = new THREE.Color().setHSL(hue, 1, 0.6);
                        laser.material.uniforms.color.value = rainbowColor;
                        laser.glowMaterial.uniforms.color.value = rainbowColor;
                    } else {
                        // Use current trajectory color
                        const baseColor = new THREE.Color(trajectoryColor);
                        laser.material.uniforms.color.value = baseColor;
                        laser.glowMaterial.uniforms.color.value = baseColor;
                    }
                    
                    // Update power-based intensity
                    const baseIntensity = gameState.precisionAimActive ? CONFIG.TRAJECTORY.LASER.INTENSITY * 1.5 : CONFIG.TRAJECTORY.LASER.INTENSITY;
                    const intensityMultiplier = 1 + (power * powerScaling.INTENSITY_MULTIPLIER);
                    const finalIntensity = baseIntensity * intensityMultiplier * (isPowerSurge ? powerScaling.SURGE_INTENSITY : 1);
                    laser.material.uniforms.intensity.value = finalIntensity;
                    
                    // Update parallel beams
                    if (laser.parallelBeams && laser.parallelBeams.length > 0) {
                        laser.parallelBeams.forEach((beam, index) => {
                            beam.material.uniforms.time.value = this.group.userData.time + beam.offset;
                            beam.material.uniforms.power.value = power;
                            beam.material.uniforms.isPowerSurge.value = isPowerSurge ? 1.0 : 0.0;
                            beam.material.uniforms.intensity.value = finalIntensity * 0.6; // Dimmer than main beam
                            
                            // Copy color from main beam
                            beam.material.uniforms.color.value = laser.material.uniforms.color.value;
                        });
                    }
                    
                    // Update bounce effects
                    if (this.group.userData.bounceEffects && this.group.userData.bounceEffects.length > 0) {
                        this.group.userData.bounceEffects.forEach((effect, index) => {
                            // Update flash animation
                            if (effect.flash && effect.flash.material.uniforms) {
                                effect.flash.material.uniforms.time.value = this.group.userData.time + index * 0.2; // Stagger flashes
                                effect.flash.material.uniforms.color.value = laser.material.uniforms.color.value;
                            }
                            
                            // Animate dispersion particles
                            if (effect.dispersion && effect.dispersion.children) {
                                effect.dispersion.children.forEach((particle, pIndex) => {
                                    const time = this.group.userData.time + index * 0.2 + pIndex * 0.1;
                                    const scale = 1 + Math.sin(time * 4) * 0.3;
                                    particle.scale.setScalar(scale);
                                    particle.material.opacity = (0.6 + Math.sin(time * 3) * 0.2) * effect.confidence;
                                });
                            }
                        });
                    }
                    
                    // Update prediction effects
                    if (this.group.userData.predictionEffects) {
                        const prediction = this.group.userData.predictionEffects;
                        
                        // Update attachment point glow
                        if (prediction.attachmentGlow && prediction.attachmentGlow.material.uniforms) {
                            prediction.attachmentGlow.material.uniforms.time.value = this.group.userData.time;
                            prediction.attachmentGlow.material.uniforms.color.value = laser.material.uniforms.color.value;
                        }
                        
                        // Update match group highlights
                        if (prediction.matchHighlights && prediction.matchHighlights.length > 0) {
                            prediction.matchHighlights.forEach((highlight, index) => {
                                const time = this.group.userData.time + index * 0.1;
                                const opacity = CONFIG.TRAJECTORY.LASER.PREDICTION.MATCH_GROUP_HIGHLIGHT * 
                                              prediction.assessment.confidence * 
                                              (0.8 + Math.sin(time * 2) * 0.2); // Gentle pulsing
                                highlight.material.opacity = opacity;
                            });
                        }
                    }
                }
                
                return true;
            }
        };
        
        gameState.addAnimation(laserAnimation);
    }
    
    createBounceEffects(gameState) {
        if (!gameState.bouncePoints || gameState.bouncePoints.length === 0) return;
        
        const bounceConfig = CONFIG.TRAJECTORY.LASER.BOUNCE_EFFECTS;
        const bounceEffects = [];
        
        gameState.bouncePoints.forEach((bouncePoint, index) => {
            // Create bounce flash sphere
            const flashGeometry = new THREE.SphereGeometry(bounceConfig.FLASH_RADIUS, 12, 12);
            const flashMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 0 },
                    color: { value: new THREE.Color(this.getTrajectoryColor(gameState)) },
                    intensity: { value: bounceConfig.FLASH_INTENSITY },
                    confidence: { value: bouncePoint.confidence },
                    flashDuration: { value: bounceConfig.FLASH_DURATION }
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
                    uniform float time;
                    uniform vec3 color;
                    uniform float intensity;
                    uniform float confidence;
                    uniform float flashDuration;
                    varying vec2 vUv;
                    varying vec3 vPosition;
                    
                    void main() {
                        // Create pulsing flash effect
                        float pulse = sin(time * 8.0) * 0.5 + 0.5;
                        pulse = pow(pulse, 2.0); // Sharper pulse
                        
                        // Radial falloff
                        float radial = 1.0 - length(vUv - vec2(0.5, 0.5)) * 2.0;
                        radial = smoothstep(0.0, 1.0, radial);
                        
                        // Flash timing
                        float flashPhase = mod(time, flashDuration * 2.0);
                        float flashIntensity = flashPhase < flashDuration ? 
                            smoothstep(0.0, flashDuration * 0.3, flashPhase) * 
                            smoothstep(flashDuration, flashDuration * 0.7, flashPhase) : 
                            0.0;
                        
                        vec3 finalColor = color * intensity * pulse * flashIntensity * confidence;
                        float opacity = radial * flashIntensity * confidence * 0.8;
                        
                        gl_FragColor = vec4(finalColor, opacity);
                    }
                `,
                transparent: true,
                blending: THREE.AdditiveBlending
            });
            
            const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
            flashMesh.position.copy(bouncePoint.position);
            this.trajectoryGroup.add(flashMesh);
            
            // Create dispersion particles
            const dispersionGroup = new THREE.Group();
            for (let i = 0; i < bounceConfig.DISPERSION_PARTICLES; i++) {
                const particleGeometry = new THREE.SphereGeometry(0.02, 6, 6);
                const particleMaterial = new THREE.MeshBasicMaterial({
                    color: this.getTrajectoryColor(gameState),
                    transparent: true,
                    opacity: 0.6 * bouncePoint.confidence
                });
                
                const particle = new THREE.Mesh(particleGeometry, particleMaterial);
                
                // Random dispersion direction
                const angle = (i / bounceConfig.DISPERSION_PARTICLES) * Math.PI * 2;
                const radius = 0.1 + Math.random() * 0.1;
                particle.position.set(
                    bouncePoint.position.x + Math.cos(angle) * radius,
                    bouncePoint.position.y + Math.sin(angle) * radius,
                    bouncePoint.position.z
                );
                
                dispersionGroup.add(particle);
            }
            
            this.trajectoryGroup.add(dispersionGroup);
            
            bounceEffects.push({
                flash: flashMesh,
                dispersion: dispersionGroup,
                confidence: bouncePoint.confidence,
                bounceIndex: index
            });
        });
        
        // Store bounce effects for animation
        this.trajectoryGroup.userData.bounceEffects = bounceEffects;
    }
    
    createCollisionPrediction(gameState) {
        if (!gameState.trajectoryEndPosition) return;
        
        const predictionConfig = CONFIG.TRAJECTORY.LASER.PREDICTION;
        const shotAssessment = this.assessShotQuality(gameState);
        
        // Create attachment point glow
        const attachmentGlow = this.createAttachmentPointGlow(gameState, predictionConfig, shotAssessment);
        if (attachmentGlow) {
            this.trajectoryGroup.add(attachmentGlow);
        }
        
        // Create match group highlighting
        const matchHighlights = this.createMatchGroupHighlights(gameState, predictionConfig, shotAssessment);
        matchHighlights.forEach(highlight => {
            this.trajectoryGroup.add(highlight);
        });
        
        // Store prediction effects
        this.trajectoryGroup.userData.predictionEffects = {
            attachmentGlow,
            matchHighlights,
            assessment: shotAssessment
        };
    }
    
    createAttachmentPointGlow(gameState, predictionConfig, shotAssessment) {
        const endPos = gameState.trajectoryEndPosition;
        
        // Create pulsing glow at attachment point
        const glowGeometry = new THREE.SphereGeometry(predictionConfig.ATTACHMENT_GLOW_SIZE, 16, 16);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(this.getTrajectoryColor(gameState)) },
                intensity: { value: predictionConfig.ATTACHMENT_GLOW_INTENSITY },
                confidence: { value: shotAssessment.confidence }
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
                uniform float time;
                uniform vec3 color;
                uniform float intensity;
                uniform float confidence;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    // Create breathing/pulsing effect
                    float pulse = sin(time * 3.0) * 0.3 + 0.7;
                    
                    // Radial falloff with soft edges
                    float radial = 1.0 - length(vUv - vec2(0.5, 0.5)) * 2.0;
                    radial = smoothstep(0.0, 1.0, radial);
                    radial = pow(radial, 0.5); // Softer falloff
                    
                    // Inner core brightness
                    float core = 1.0 - length(vUv - vec2(0.5, 0.5)) * 4.0;
                    core = smoothstep(0.0, 1.0, core);
                    core = pow(core, 2.0); // Sharp inner core
                    
                    vec3 finalColor = color * intensity * pulse * confidence;
                    float opacity = (radial * 0.6 + core * 0.4) * confidence * pulse;
                    
                    gl_FragColor = vec4(finalColor, opacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.position.copy(endPos);
        
        return glowMesh;
    }
    
    createMatchGroupHighlights(gameState, predictionConfig, shotAssessment) {
        const highlights = [];
        
        if (!gameState.trajectoryEndPosition || shotAssessment.confidence < predictionConfig.PREDICTION_CONFIDENCE) {
            return highlights;
        }
        
        const endPos = gameState.trajectoryEndPosition;
        const currentColor = gameState.currentBubble.color;
        
        // Find potential matching bubbles
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            const isOddRow = y % 2 === 1;
            const bubblesInRow = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                const bubble = gameState.bubbleGrid[y][x];
                if (bubble && !bubble.isDestroyed && !bubble.isFloating) {
                    const distance = endPos.distanceTo(bubble.position);
                    
                    // Highlight matching color bubbles in nearby range
                    if (distance < CONFIG.BUBBLE_RADIUS * 4 && bubble.color === currentColor) {
                        const highlightGeometry = new THREE.RingGeometry(
                            CONFIG.BUBBLE_RADIUS * 0.9, 
                            CONFIG.BUBBLE_RADIUS * 1.2, 
                            16
                        );
                        
                        const highlightMaterial = new THREE.MeshBasicMaterial({
                            color: currentColor,
                            transparent: true,
                            opacity: predictionConfig.MATCH_GROUP_HIGHLIGHT * shotAssessment.confidence,
                            side: THREE.DoubleSide
                        });
                        
                        const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
                        highlight.position.copy(bubble.position);
                        highlight.rotation.x = Math.PI / 2; // Lay flat
                        
                        highlights.push(highlight);
                    }
                }
            }
        }
        
        return highlights;
    }
    
    addTrajectoryAnimation(gameState) {
        const trajectoryAnimation = {
            group: this.trajectoryGroup,
            update: function(deltaTime) {
                if (!this.group.parent) return false;
                
                this.group.userData.time += deltaTime * CONFIG.TRAJECTORY.ANIMATION_SPEED;
                
                this.group.userData.dots.forEach((dotData, i) => {
                    // Simple forward flow animation
                    const flowOffset = (this.group.userData.time * CONFIG.TRAJECTORY.FLOW_SPEED + i * 0.1) % 1;
                    
                    // Calculate new position along the entire trajectory
                    const trajectoryLength = this.group.userData.trajectory.length;
                    const basePosition = dotData.index / this.group.userData.dots.length;
                    const flowPosition = basePosition + flowOffset;
                    
                    // Reset to start when reaching the end
                    const wrappedPosition = flowPosition % 1;
                    const newIndex = Math.floor(wrappedPosition * trajectoryLength);
                    const nextIndex = Math.min(newIndex + 1, trajectoryLength - 1);
                    
                    const currentPoint = this.group.userData.trajectory[newIndex];
                    const nextPoint = this.group.userData.trajectory[nextIndex];
                    
                    if (currentPoint && nextPoint) {
                        // Interpolate between points
                        const lerpFactor = (wrappedPosition * trajectoryLength) % 1;
                        const animatedPos = new THREE.Vector3().lerpVectors(currentPoint, nextPoint, lerpFactor);
                        
                        // Add wave motion
                        if (nextIndex > newIndex) {
                            const direction = new THREE.Vector3().subVectors(nextPoint, currentPoint).normalize();
                            const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0);
                            const waveOffset = Math.sin(this.group.userData.time * CONFIG.TRAJECTORY.WAVE_FREQUENCY + i * 0.5) * CONFIG.TRAJECTORY.WAVE_AMPLITUDE;
                            animatedPos.add(perpendicular.multiplyScalar(waveOffset));
                        }
                        
                        dotData.dot.position.copy(animatedPos);
                        dotData.glow.position.copy(animatedPos);
                    }
                    
                    // Pulsing effect
                    const pulseBase = 1 - CONFIG.TRAJECTORY.PULSE_RANGE;
                    const pulse = Math.sin(this.group.userData.time * 2 + i * 0.3) * CONFIG.TRAJECTORY.PULSE_RANGE + pulseBase;
                    const sizeMultiplier = 1 + (pulse - (pulseBase + CONFIG.TRAJECTORY.PULSE_RANGE/2)) * 0.15;
                    
                    // Flowing opacity with fade at the end
                    const brightnessBase = 1 - CONFIG.TRAJECTORY.BRIGHTNESS_RANGE;
                    const brightness = Math.sin(flowOffset * Math.PI) * CONFIG.TRAJECTORY.BRIGHTNESS_RANGE + brightnessBase;
                    
                    // Fade out near the end to prevent visible wrap-around
                    const fadeStart = 0.8;
                    const fadeFactor = wrappedPosition < fadeStart ? 1.0 : (1.0 - wrappedPosition) / (1.0 - fadeStart);
                    const opacityMultiplier = (0.6 + brightness * 0.4) * fadeFactor;
                    
                    dotData.dot.scale.setScalar(sizeMultiplier);
                    dotData.glow.scale.setScalar(sizeMultiplier);
                    
                    dotData.dot.material.opacity = Math.max(CONFIG.TRAJECTORY.MIN_DOT_OPACITY, dotData.baseOpacity * opacityMultiplier);
                    dotData.glow.material.opacity = Math.max(CONFIG.TRAJECTORY.MIN_GLOW_OPACITY, dotData.baseOpacity * CONFIG.TRAJECTORY.GLOW_OPACITY_MULTIPLIER * opacityMultiplier);
                    
                    // Update emissive intensity
                    const emissiveIntensity = gameState.precisionAimActive ? 
                        CONFIG.TRAJECTORY.EMISSIVE_INTENSITY_PRECISION : 
                        CONFIG.TRAJECTORY.EMISSIVE_INTENSITY;
                    dotData.dot.material.emissiveIntensity = emissiveIntensity * (CONFIG.TRAJECTORY.EMISSIVE_MIN_MULTIPLIER + brightness * (1 - CONFIG.TRAJECTORY.EMISSIVE_MIN_MULTIPLIER));
                });
                
                return this.group.parent === this.group.parent;
            }
        };
        
        gameState.addAnimation(trajectoryAnimation);
    }
}