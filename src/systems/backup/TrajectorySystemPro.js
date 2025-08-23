import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Professional Trajectory System
 * Real volumetric laser with bubble projection
 */
export class TrajectorySystem {
    constructor(scene) {
        this.scene = scene;
        
        // Trajectory data
        this.MAX_POINTS = 500;
        this.points = [];
        this.pointCount = 0;
        
        // Cache
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.bubbleCache = [];
        this.targetBubbles = []; // Bubbles that will be affected
        
        // Visual components
        this.laserGroup = new THREE.Group();
        this.scene.add(this.laserGroup);
        
        // Create the volumetric laser system
        this.createVolumetricLaser();
        
        // Animation
        this.time = 0;
        this.pulseTime = 0;
        
        // Track trajectory changes to avoid recreating geometry
        this.lastCurve = null;
        this.lastPoints = [];
        this.lastPointCount = 0;
    }
    
    createVolumetricLaser() {
        // Create a thick tube mesh for the main laser beam
        this.createMainBeam();
        
        // Create projection rings for bubble targeting
        this.createProjectionRings();
        
        // Create impact visualization
        this.createImpactEffects();
        
        // Create energy field
        this.createEnergyField();
    }
    
    createMainBeam() {
        // Main laser beam using TubeGeometry for actual volume
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 1, 0)
        ]);
        
        // Multiple layers for depth
        this.beamLayers = [];
        
        // Layer 1: Core beam (white hot center)
        const coreGeometry = new THREE.TubeGeometry(curve, 64, 0.02, 8, false);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        this.coreBeam = new THREE.Mesh(coreGeometry, coreMaterial);
        this.beamLayers.push(this.coreBeam);
        
        // Layer 2: Inner colored beam
        const innerGeometry = new THREE.TubeGeometry(curve, 64, 0.05, 8, false);
        const innerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        this.innerBeam = new THREE.Mesh(innerGeometry, innerMaterial);
        this.beamLayers.push(this.innerBeam);
        
        // Layer 3: Mid glow
        const midGeometry = new THREE.TubeGeometry(curve, 64, 0.1, 8, false);
        const midMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        this.midBeam = new THREE.Mesh(midGeometry, midMaterial);
        this.beamLayers.push(this.midBeam);
        
        // Layer 4: Outer glow with shader for animated effects
        const outerGeometry = new THREE.TubeGeometry(curve, 64, 0.15, 16, false);
        const outerShaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x0088ff) },
                time: { value: 0 },
                power: { value: 0 },
                opacity: { value: 0.3 }
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
                uniform float time;
                uniform float power;
                uniform float opacity;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    // Strong energy waves flowing along the beam - MORE VISIBLE
                    float flow = vUv.x * 40.0 - time * 10.0;
                    float wave1 = sin(flow) * 0.5 + 0.5;
                    float wave2 = sin(flow * 1.5 + 2.0) * 0.3 + 0.7;
                    float wave3 = cos(flow * 0.7) * 0.2 + 0.8;
                    
                    // Create visible energy packets
                    float packets = smoothstep(0.4, 0.6, sin(flow * 2.0)) * 0.5;
                    float energy = wave1 * wave2 * wave3 + packets;
                    
                    // Radial falloff for soft edges
                    float radial = 1.0 - abs(vUv.y - 0.5) * 2.0;
                    radial = smoothstep(0.0, 1.0, radial);
                    
                    // Power surge effects - more visible
                    float surge = 0.0;
                    if (power > 0.3) {
                        surge = sin(vUv.x * 80.0 - time * 15.0) * 
                               sin(vUv.x * 60.0 + time * 12.0) * 0.4 * power;
                        surge = max(0.0, surge);
                    }
                    
                    // Pulsing glow
                    float pulse = sin(time * 3.0) * 0.2 + 0.8;
                    
                    vec3 finalColor = color * (energy * pulse + 0.3) + vec3(surge * 2.0);
                    float finalOpacity = opacity * radial * (0.5 + energy * 0.5);
                    
                    gl_FragColor = vec4(finalColor, finalOpacity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        this.outerBeam = new THREE.Mesh(outerGeometry, outerShaderMaterial);
        this.beamLayers.push(this.outerBeam);
        
        // Add all layers to group
        this.beamLayers.forEach(layer => {
            this.laserGroup.add(layer);
            layer.visible = false;
        });
    }
    
    createProjectionRings() {
        // Create rings that will appear on bubbles the laser will hit
        this.projectionRings = [];
        const ringGeometry = new THREE.RingGeometry(0.3, 0.5, 32);
        
        for (let i = 0; i < 10; i++) {
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide
            });
            
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.visible = false;
            this.scene.add(ring); // Add to scene, not laser group
            this.projectionRings.push(ring);
        }
        
        // Create targeting reticles
        this.targetReticles = [];
        const reticleGeometry = new THREE.PlaneGeometry(0.8, 0.8);
        
        for (let i = 0; i < 10; i++) {
            const reticleMaterial = new THREE.MeshBasicMaterial({
                map: this.createReticleTexture(),
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
            reticle.visible = false;
            this.scene.add(reticle);
            this.targetReticles.push(reticle);
        }
    }
    
    createReticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, 128, 128);
        
        // Draw crosshair
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        
        // Outer circle
        ctx.beginPath();
        ctx.arc(64, 64, 50, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(64, 64, 30, 0, Math.PI * 2);
        ctx.stroke();
        
        // Cross lines
        ctx.beginPath();
        ctx.moveTo(64, 10);
        ctx.lineTo(64, 40);
        ctx.moveTo(64, 88);
        ctx.lineTo(64, 118);
        ctx.moveTo(10, 64);
        ctx.lineTo(40, 64);
        ctx.moveTo(88, 64);
        ctx.lineTo(118, 64);
        ctx.stroke();
        
        // Corner brackets
        ctx.beginPath();
        // Top-left
        ctx.moveTo(20, 30);
        ctx.lineTo(20, 20);
        ctx.lineTo(30, 20);
        // Top-right
        ctx.moveTo(98, 20);
        ctx.lineTo(108, 20);
        ctx.lineTo(108, 30);
        // Bottom-left
        ctx.moveTo(20, 98);
        ctx.lineTo(20, 108);
        ctx.lineTo(30, 108);
        // Bottom-right
        ctx.moveTo(98, 108);
        ctx.lineTo(108, 108);
        ctx.lineTo(108, 98);
        ctx.stroke();
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    
    createImpactEffects() {
        // Impact point visualization
        this.impactSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.3, 16, 16),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending
            })
        );
        this.impactSphere.visible = false;
        this.scene.add(this.impactSphere);
        
        // Impact rings (shockwave effect)
        this.impactRings = [];
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(0.1, 0.4 + i * 0.2, 32),
                new THREE.MeshBasicMaterial({
                    color: 0x00ffff,
                    transparent: true,
                    opacity: 0.3,
                    blending: THREE.AdditiveBlending,
                    side: THREE.DoubleSide
                })
            );
            ring.visible = false;
            this.scene.add(ring);
            this.impactRings.push(ring);
        }
    }
    
    createEnergyField() {
        // Particle system for energy effects
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;
            
            sizes[i] = Math.random() * 10 + 5;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 10,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        this.energyParticles = new THREE.Points(geometry, material);
        this.laserGroup.add(this.energyParticles);
    }
    
    calculateTrajectory(startBubble, mousePosition, gameState, forceRecalculate = false) {
        if (!startBubble || startBubble.isMoving || gameState.isPaused) {
            this.hideTrajectory();
            return;
        }
        
        // Check for significant mouse movement
        const dx = Math.abs(mousePosition.x - this.lastMouseX);
        const dy = Math.abs(mousePosition.y - this.lastMouseY);
        
        if (!forceRecalculate && dx < 0.005 && dy < 0.005) {
            // Just update visuals, don't recalculate
            this.updateVisuals(gameState);
            return;
        }
        
        this.lastMouseX = mousePosition.x;
        this.lastMouseY = mousePosition.y;
        
        // Clear previous data
        this.points = [];
        this.pointCount = 0;
        this.targetBubbles = [];
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
        
        // Calculate trajectory points
        const power = gameState.shootingPower || 0;
        const speed = gameState.precisionAimActive ? 
            CONFIG.SHOOTING_SPEED : 
            CONFIG.SHOOTING_SPEED + (CONFIG.MAX_SHOOTING_SPEED - CONFIG.SHOOTING_SPEED) * power;
        
        let pos = startBubble.position.clone();
        let vel = dir.multiplyScalar(speed);
        
        const dt = 0.015;
        const maxSteps = 500;
        const wallLimit = 5.5 - CONFIG.BUBBLE_RADIUS;
        
        for (let i = 0; i < maxSteps; i++) {
            this.points.push(pos.clone());
            this.pointCount++;
            
            // Store for game compatibility
            if (i % 4 === 0) {
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
                        
                        // Check if we'll hit this bubble
                        if (dist < CONFIG.BUBBLE_RADIUS * 1.8) {
                            hit = true;
                            gameState.trajectoryEndPosition = pos.clone();
                            
                            // Find all bubbles that would be affected
                            this.findTargetBubbles(pos, gameState);
                            break;
                        }
                        
                        // Check if laser passes near this bubble (for projection effect)
                        if (dist < CONFIG.BUBBLE_RADIUS * 3) {
                            const projDist = this.pointToLineDistance(bubble.position, pos, nextPos);
                            if (projDist < CONFIG.BUBBLE_RADIUS * 1.5) {
                                // This bubble is close to the laser path
                                if (!this.targetBubbles.find(t => t.bubble === bubble)) {
                                    this.targetBubbles.push({
                                        bubble: bubble,
                                        distance: projDist,
                                        position: bubble.position.clone()
                                    });
                                }
                            }
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
    }
    
    pointToLineDistance(point, lineStart, lineEnd) {
        const line = new THREE.Vector3().subVectors(lineEnd, lineStart);
        const lineLength = line.length();
        line.normalize();
        
        const toPoint = new THREE.Vector3().subVectors(point, lineStart);
        const projection = toPoint.dot(line);
        
        if (projection < 0) {
            return point.distanceTo(lineStart);
        } else if (projection > lineLength) {
            return point.distanceTo(lineEnd);
        } else {
            const closestPoint = lineStart.clone().add(line.multiplyScalar(projection));
            return point.distanceTo(closestPoint);
        }
    }
    
    findTargetBubbles(impactPos, gameState) {
        // Find bubbles that would match if we hit here
        const currentColor = gameState.currentBubble ? gameState.currentBubble.color : null;
        if (!currentColor) return;
        
        // Check surrounding bubbles
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            const isOddRow = y % 2 === 1;
            const bubblesInRow = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                const bubble = gameState.bubbleGrid[y][x];
                if (bubble && !bubble.isDestroyed && !bubble.isFloating) {
                    const dist = impactPos.distanceTo(bubble.position);
                    
                    // Would this bubble be part of a match?
                    if (dist < CONFIG.BUBBLE_RADIUS * 3 && bubble.color === currentColor) {
                        if (!this.targetBubbles.find(t => t.bubble === bubble)) {
                            this.targetBubbles.push({
                                bubble: bubble,
                                distance: dist,
                                position: bubble.position.clone(),
                                willMatch: true
                            });
                        }
                    }
                }
            }
        }
    }
    
    renderTrajectory(gameState) {
        if (this.pointCount < 2) {
            this.hideTrajectory();
            return;
        }
        
        // Always update visuals for animation
        this.updateVisuals(gameState);
    }
    
    trajectoryChanged() {
        if (!this.lastPointCount || this.lastPointCount !== this.pointCount) {
            this.lastPointCount = this.pointCount;
            return true;
        }
        
        // Check if any points changed significantly
        if (this.lastPoints && this.lastPoints.length === this.points.length) {
            for (let i = 0; i < this.points.length; i++) {
                if (this.lastPoints[i].distanceTo(this.points[i]) > 0.01) {
                    this.lastPoints = [...this.points];
                    return true;
                }
            }
            return false;
        }
        
        this.lastPoints = [...this.points];
        return true;
    }
    
    updateVisuals(gameState) {
        // Update time
        this.time += 0.016;
        this.pulseTime += 0.05;
        const pulse = Math.sin(this.pulseTime) * 0.5 + 0.5;
        
        // Get current color
        const color = this.getColor(gameState);
        const power = gameState.shootingPower || 0;
        
        // DON'T recreate geometry every frame! Just show/hide the beams
        if (this.pointCount > 2) {
            // Check if we need to recreate (only when trajectory actually changed)
            if (!this.lastCurve || this.trajectoryChanged()) {
                const curve = new THREE.CatmullRomCurve3(this.points);
                this.lastCurve = curve;
                
                // Only recreate geometry when trajectory changes
                this.beamLayers.forEach((beam, index) => {
                    beam.visible = true;
                    
                    // ULTRA THIN laser beams
                    const radii = [0.005, 0.01, 0.015, 0.02]; // MUCH thinner
                    const radius = radii[index] * (1 + power * 0.2); // Minimal power scaling
                    
                    const newGeometry = new THREE.TubeGeometry(curve, 32, radius, 6, false); // Less segments too
                    beam.geometry.dispose();
                    beam.geometry = newGeometry;
                });
            } else {
                // Just update visibility
                this.beamLayers.forEach(beam => beam.visible = true);
            }
            
            // Update materials for all beams
            this.beamLayers.forEach((beam, index) => {
                // Update material
                if (index > 0 && beam.material && beam.material.color) { // Skip core (keep it white)
                    beam.material.color.setHex(color);
                }
                
                // Animate opacity - MUCH MORE SUBTLE
                const opacities = [0.9, 0.5, 0.2, 0.1]; // Much lower opacity for outer layers
                beam.material.opacity = opacities[index] * (0.8 + pulse * 0.1); // Less pulsing
                
                // Update shader uniforms for outer beam
                if (beam === this.outerBeam && beam.material.uniforms) {
                    beam.material.uniforms.time.value = this.time;
                    beam.material.uniforms.power.value = power;
                    beam.material.uniforms.color.value.setHex(color);
                }
            });
        }
        
        // Update projection rings on target bubbles
        this.projectionRings.forEach(ring => ring.visible = false);
        this.targetReticles.forEach(reticle => reticle.visible = false);
        
        this.targetBubbles.forEach((target, index) => {
            if (index < this.projectionRings.length) {
                const ring = this.projectionRings[index];
                const reticle = this.targetReticles[index];
                
                // Position ring on bubble
                ring.position.copy(target.position);
                ring.position.z = 0.1; // Slightly in front
                ring.visible = true;
                
                // Animate ring
                const scale = 1 + pulse * 0.2;
                ring.scale.setScalar(scale);
                ring.rotation.z = this.time * 2;
                
                // Color based on whether it will match
                if (target.willMatch) {
                    ring.material.color.setHex(0x00ff00); // Green for matches
                    ring.material.opacity = 0.6 + pulse * 0.2;
                } else {
                    ring.material.color.setHex(color);
                    ring.material.opacity = 0.3 + pulse * 0.1;
                }
                
                // Show reticle for matches
                if (target.willMatch) {
                    reticle.position.copy(target.position);
                    reticle.position.z = 0.2;
                    reticle.visible = true;
                    reticle.rotation.z = -this.time * 1.5;
                    reticle.scale.setScalar(0.8 + pulse * 0.1);
                }
            }
        });
        
        // Update impact point
        if (gameState.trajectoryEndPosition) {
            this.impactSphere.visible = true;
            this.impactSphere.position.copy(gameState.trajectoryEndPosition);
            this.impactSphere.material.color.setHex(color);
            this.impactSphere.material.opacity = 0.3 + pulse * 0.3;
            
            const impactScale = 1 + pulse * 0.3;
            this.impactSphere.scale.setScalar(impactScale);
            
            // Animate impact rings
            this.impactRings.forEach((ring, i) => {
                ring.visible = true;
                ring.position.copy(gameState.trajectoryEndPosition);
                ring.position.z = 0.1;
                
                const ringScale = 1 + pulse * (i + 1) * 0.2;
                ring.scale.setScalar(ringScale);
                ring.rotation.z = this.time * (i + 1);
                ring.material.opacity = 0.3 - i * 0.08;
            });
        } else {
            this.impactSphere.visible = false;
            this.impactRings.forEach(ring => ring.visible = false);
        }
        
        // Update energy particles
        if (this.energyParticles && this.pointCount > 0) {
            const positions = this.energyParticles.geometry.attributes.position.array;
            const colors = this.energyParticles.geometry.attributes.color.array;
            const particleCount = positions.length / 3;
            
            const col = new THREE.Color(color);
            
            for (let i = 0; i < particleCount; i++) {
                const t = (i / particleCount + this.time * 0.1) % 1.0;
                const pointIndex = Math.floor(t * this.pointCount);
                
                if (pointIndex < this.pointCount - 1) {
                    const point = this.points[pointIndex];
                    const nextPoint = this.points[pointIndex + 1];
                    
                    // Interpolate between points
                    const lerpFactor = (t * this.pointCount) % 1.0;
                    const pos = point.clone().lerp(nextPoint, lerpFactor);
                    
                    // Add spiral motion
                    const angle = i * 0.5 + this.time * 3;
                    const radius = 0.1 + Math.sin(i * 2 + this.time) * 0.05;
                    
                    positions[i * 3] = pos.x + Math.cos(angle) * radius;
                    positions[i * 3 + 1] = pos.y + Math.sin(angle) * radius;
                    positions[i * 3 + 2] = pos.z;
                    
                    // Update color with energy effect
                    const energy = Math.sin(t * Math.PI) * 0.5 + 0.5;
                    colors[i * 3] = col.r * energy;
                    colors[i * 3 + 1] = col.g * energy;
                    colors[i * 3 + 2] = col.b;
                }
            }
            
            this.energyParticles.geometry.attributes.position.needsUpdate = true;
            this.energyParticles.geometry.attributes.color.needsUpdate = true;
            this.energyParticles.material.opacity = 0.4 + power * 0.3;
        }
    }
    
    hideTrajectory() {
        this.beamLayers.forEach(beam => beam.visible = false);
        this.projectionRings.forEach(ring => ring.visible = false);
        this.targetReticles.forEach(reticle => reticle.visible = false);
        this.impactSphere.visible = false;
        this.impactRings.forEach(ring => ring.visible = false);
        if (this.energyParticles) this.energyParticles.visible = false;
        
        // Clear cached data to force recreation next time
        this.lastCurve = null;
        this.lastPoints = [];
        this.lastPointCount = 0;
    }
    
    getColor(gameState) {
        if (gameState.precisionAimActive) return 0x00ffff;
        if (!gameState.currentBubble) return 0xffffff;
        
        if (gameState.currentBubble.isPowerUp && gameState.currentBubble.powerUpType === 'rainbow') {
            const hue = (this.time * 0.2) % 1;
            return new THREE.Color().setHSL(hue, 1, 0.6).getHex();
        }
        
        return gameState.currentBubble.color;
    }
    
    dispose() {
        this.beamLayers.forEach(beam => {
            beam.geometry.dispose();
            beam.material.dispose();
        });
        
        this.projectionRings.forEach(ring => {
            ring.geometry.dispose();
            ring.material.dispose();
        });
        
        this.targetReticles.forEach(reticle => {
            reticle.geometry.dispose();
            reticle.material.dispose();
        });
        
        if (this.impactSphere) {
            this.impactSphere.geometry.dispose();
            this.impactSphere.material.dispose();
        }
        
        this.impactRings.forEach(ring => {
            ring.geometry.dispose();
            ring.material.dispose();
        });
        
        if (this.energyParticles) {
            this.energyParticles.geometry.dispose();
            this.energyParticles.material.dispose();
        }
    }
}