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
        let vel = direction.multiplyScalar(CONFIG.SHOOTING_SPEED);
        const step = 0.015; // Smaller steps for more accurate trajectory
        const maxSteps = gameState.precisionAimActive ? 500 : 200;
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
                    if (bubble) {
                        const distance = nextPos.distanceTo(bubble.position);
                        if (distance < CONFIG.BUBBLE_RADIUS * 1.15) {
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
            
            // Check wall bounce
            const wallLimit = 6;
            if (Math.abs(pos.x) > wallLimit - CONFIG.BUBBLE_RADIUS) {
                vel.x *= -1;
                pos.x = Math.sign(pos.x) * (wallLimit - CONFIG.BUBBLE_RADIUS);
                bounceCount++;
                
                if (bounceCount >= maxBounces && !gameState.precisionAimActive) {
                    break;
                }
            }
            
            // Stop at ceiling
            if (pos.y > CONFIG.CEILING_Y - 0.5 - CONFIG.BUBBLE_RADIUS) {
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
        
        // Check if we need to recreate the trajectory (path changed significantly)
        const needsRecreate = !this.trajectoryGroup || 
                             !this.trajectoryGroup.userData.trajectory ||
                             this.trajectoryPathChanged(gameState.trajectory, this.trajectoryGroup.userData.trajectory);
        
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
                dots: []
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
        const trajectoryColor = gameState.precisionAimActive ? 0x00ffff : gameState.currentBubble.color;
        const colorVec = new THREE.Color(trajectoryColor);
        
        // Create tube geometry for the entire trajectory
        const points = gameState.trajectory;
        const curve = new THREE.CatmullRomCurve3(points, false);
        const tubeGeometry = new THREE.TubeGeometry(curve, points.length * 2, CONFIG.TRAJECTORY.LASER.BEAM_RADIUS, 8, false);
        
        // Create flowing laser shader material
        const laserMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: colorVec },
                intensity: { value: gameState.precisionAimActive ? CONFIG.TRAJECTORY.LASER.INTENSITY * 1.5 : CONFIG.TRAJECTORY.LASER.INTENSITY },
                flowSpeed: { value: CONFIG.TRAJECTORY.LASER.FLOW_SPEED },
                pulseSpeed: { value: CONFIG.TRAJECTORY.LASER.PULSE_SPEED },
                opacity: { value: CONFIG.TRAJECTORY.LASER.OPACITY },
                waveFreq: { value: CONFIG.TRAJECTORY.LASER.WAVE_FREQUENCY },
                packetFreq: { value: CONFIG.TRAJECTORY.LASER.PACKET_FREQUENCY },
                highlightFreq: { value: CONFIG.TRAJECTORY.LASER.HIGHLIGHT_FREQUENCY },
                waveAmp: { value: CONFIG.TRAJECTORY.LASER.WAVE_AMPLITUDE },
                packetAmp: { value: CONFIG.TRAJECTORY.LASER.PACKET_AMPLITUDE },
                highlightAmp: { value: CONFIG.TRAJECTORY.LASER.HIGHLIGHT_AMPLITUDE }
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
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    // Create configurable flowing waves with higher base brightness
                    float wave1 = sin(vUv.x * waveFreq - time * flowSpeed) * waveAmp + (1.0 - waveAmp * 0.5);
                    float wave2 = sin(vUv.x * (waveFreq * 1.5) - time * flowSpeed * 1.3) * (waveAmp * 0.75) + (1.0 - waveAmp * 0.3);
                    float wave3 = cos(vUv.x * (waveFreq * 2.0) - time * flowSpeed * 0.8) * (waveAmp * 0.5) + (1.0 - waveAmp * 0.2);
                    
                    // Create much more visible traveling energy packets
                    float packets = smoothstep(0.5, 1.0, sin(vUv.x * packetFreq - time * flowSpeed * 2.0)) * packetAmp;
                    packets += smoothstep(0.6, 1.0, sin(vUv.x * (packetFreq * 1.67) - time * flowSpeed * 1.5)) * (packetAmp * 0.75);
                    
                    // Combine flowing effects with higher base level
                    float flow = wave1 * wave2 * wave3 + packets * 0.8;
                    flow = clamp(flow, 0.6, 2.5); // Much higher minimum and maximum
                    
                    // Create stronger pulsing effect
                    float pulse = sin(time * pulseSpeed + vUv.x * 3.0) * 0.3 + 0.8;
                    
                    // Create softer radial falloff for more visibility
                    float radial = 1.0 - pow(length(vUv - vec2(0.5, 0.5)) * 2.0, 0.8);
                    radial = smoothstep(0.0, 1.0, radial);
                    radial = max(radial, 0.3); // Ensure minimum visibility
                    
                    // Add much brighter configurable flowing highlights
                    float highlights = smoothstep(0.7, 1.0, sin(vUv.x * highlightFreq - time * flowSpeed * 3.0)) * highlightAmp;
                    
                    // Combine all effects with enhanced brightness
                    float finalIntensity = (flow + highlights * 0.8) * pulse * radial * intensity;
                    
                    // Enhanced color with stronger emission
                    vec3 finalColor = color * finalIntensity;
                    finalColor += color * 0.3; // Add base emission for visibility
                    
                    // Make opacity more consistent and brighter
                    float dynamicOpacity = opacity * radial * (0.7 + flow * 0.3);
                    
                    gl_FragColor = vec4(finalColor, dynamicOpacity);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        
        const laserMesh = new THREE.Mesh(tubeGeometry, laserMaterial);
        this.trajectoryGroup.add(laserMesh);
        
        // Create outer glow tube
        const glowGeometry = new THREE.TubeGeometry(curve, points.length * 2, CONFIG.TRAJECTORY.LASER.GLOW_RADIUS, 8, false);
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
        
        // Store laser data for animation
        this.trajectoryGroup.userData.laser = {
            mesh: laserMesh,
            glowMesh: glowMesh,
            material: laserMaterial,
            glowMaterial: glowMaterial,
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
                    
                    // Dynamic color shift for precision aim
                    if (gameState.precisionAimActive) {
                        const hue = (this.group.userData.time * 0.5) % 1;
                        const dynamicColor = new THREE.Color().setHSL(hue, 1, 0.6);
                        laser.material.uniforms.color.value = dynamicColor;
                        laser.glowMaterial.uniforms.color.value = dynamicColor;
                        
                        // Increase intensity for precision aim
                        laser.material.uniforms.intensity.value = 2.5;
                    } else {
                        // Reset to base color
                        const baseColor = new THREE.Color(laser.baseColor);
                        laser.material.uniforms.color.value = baseColor;
                        laser.glowMaterial.uniforms.color.value = baseColor;
                        laser.material.uniforms.intensity.value = 1.5;
                    }
                }
                
                return true;
            }
        };
        
        gameState.addAnimation(laserAnimation);
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