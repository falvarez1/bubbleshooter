import * as THREE from 'three';
import { CONFIG, PARTICLE_CONFIG } from '../core/Config.js';
import { PowerUp } from './PowerUp.js';
import { ParticleFactory } from '../entities/Particle.js';

/**
 * Chain Lightning Power-Up
 * Creates arcing lightning that jumps between nearby bubbles
 */
export class ChainLightningPowerUp extends PowerUp {
    constructor() {
        super('chainLightning', {
            name: 'Chain Lightning Bubble',
            rarity: 'rare',
            spawnRate: 0.08,
            color: 0x00aaff,
            glowColor: 0x00ddff
        });
        this.primaryArcCount = 3; // 2-3 primary arcs
        this.secondaryArcCount = 2; // 1-2 secondary arcs per primary
        this.hitBubbles = new Set(); // Track bubbles already hit
    }
    
    activate(targetBubbleOrPosition, gameState, gameManager) {
        // Clear hit tracking for this activation
        this.hitBubbles.clear();
        
        let impactBubble = null;
        let impactPos = null;
        
        // Handle both bubble object and position input
        if (targetBubbleOrPosition.position) {
            // It's a bubble object
            impactBubble = targetBubbleOrPosition;
            impactPos = targetBubbleOrPosition.position;
        } else {
            // It's a position, find the bubble at that position
            impactPos = targetBubbleOrPosition;
            let minDistance = Infinity;
            
            // Check all grid bubbles to find the one at impact position
            for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
                for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                    const bubble = gameState.getBubbleAt(x, y);
                    if (bubble) {
                        const distance = bubble.position.distanceTo(impactPos);
                        if (distance < minDistance) {
                            minDistance = distance;
                            impactBubble = bubble;
                        }
                    }
                }
            }
        }
        
        if (!impactBubble) {
            console.log('Chain Lightning: No bubble found for activation');
            return false;
        }
        
        // Emit event for visual/audio feedback
        gameManager.eventBus.emit('chainLightningActivated', {
            position: impactPos,
            bubble: impactBubble
        });
        
        // Start the chain lightning effect
        this.executeChainLightning(impactBubble, gameState, gameManager);
        
        return true;
    }
    
    executeChainLightning(impactBubble, gameState, gameManager) {
        const bubblesDestroyed = [];
        
        // 1. Destroy the initial impact bubble
        this.hitBubbles.add(impactBubble);
        bubblesDestroyed.push(impactBubble);
        
        // Create initial impact effect
        this.createLightningImpactEffect(impactBubble.position, gameState, gameManager);
        
        // 2. Find and destroy primary arc targets
        const primaryTargets = this.findNearestBubbles(
            impactBubble,
            this.primaryArcCount,
            gameState,
            this.hitBubbles
        );
        
        // Create primary lightning arcs with delay
        primaryTargets.forEach((target, index) => {
            setTimeout(() => {
                this.createLightningArc(
                    impactBubble.position,
                    target.position,
                    true, // isPrimary
                    gameState,
                    gameManager
                );
                this.hitBubbles.add(target);
                bubblesDestroyed.push(target);
                
                // Play electric arc sound
                gameManager.playSound('electricArc');
                
                // 3. For each primary target, find secondary targets
                const secondaryTargets = this.findNearestBubbles(
                    target,
                    Math.floor(Math.random() * 2) + 1, // 1-2 secondary arcs
                    gameState,
                    this.hitBubbles
                );
                
                // Create secondary arcs with additional delay
                secondaryTargets.forEach((secondaryTarget, secondaryIndex) => {
                    setTimeout(() => {
                        this.createLightningArc(
                            target.position,
                            secondaryTarget.position,
                            false, // not primary
                            gameState,
                            gameManager
                        );
                        this.hitBubbles.add(secondaryTarget);
                        bubblesDestroyed.push(secondaryTarget);
                        
                        // Play quieter arc sound for secondary
                        gameManager.playSound('electricArc');
                    }, 50 + secondaryIndex * 30);
                });
            }, 100 + index * 50);
        });
        
        // Create electrifying effect on each bubble before destruction
        setTimeout(() => {
            bubblesDestroyed.forEach((bubble, index) => {
                setTimeout(() => {
                    // First create the electric coursing effect on the bubble
                    this.createElectricCoursingEffect(bubble, gameState, gameManager);
                    
                    // Then destroy the bubble after a short delay to see the effect
                    setTimeout(() => {
                        this.createElectricDestructionEffect(bubble, gameState);
                    }, 100);
                }, index * 30);
            });
            
            // Emit event to handle bubble destruction through game logic after all effects
            setTimeout(() => {
                gameManager.eventBus.emit('chainLightningDestroy', {
                    bubbles: bubblesDestroyed,
                    points: bubblesDestroyed.length * 25
                });
            }, bubblesDestroyed.length * 30 + 200);
        }, primaryTargets.length * 50 + 300);
    }
    
    findNearestBubbles(centerBubble, count, gameState, excludeSet) {
        const candidates = [];
        
        // Find all valid neighbor bubbles
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = gameState.getBubbleAt(x, y);
                if (bubble && bubble !== centerBubble && !excludeSet.has(bubble) && !bubble.isPowerUp) {
                    const distance = centerBubble.position.distanceTo(bubble.position);
                    candidates.push({ bubble, distance });
                }
            }
        }
        
        // Sort by distance and return the nearest ones
        candidates.sort((a, b) => a.distance - b.distance);
        return candidates.slice(0, count).map(c => c.bubble);
    }
    
    createLightningImpactEffect(position, gameState, gameManager) {
        // Create electrical burst particles
        ParticleFactory.createLightningBurst(
            position,
            0x00ddff,
            PARTICLE_CONFIG.lightning.particles,
            gameState.particlePool
        );
        
        // Screen shake
        gameManager.addScreenShake(0.3, 8);
    }
    
    createLightningArc(startPos, endPos, isPrimary, gameState, gameManager) {
        // Create animated lightning bolt geometry
        const points = this.generateLightningPath(startPos, endPos, isPrimary ? 5 : 3);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        const material = new THREE.LineBasicMaterial({
            color: isPrimary ? 0x00ddff : 0x66ccff,
            transparent: true,
            opacity: 1,
            linewidth: isPrimary ? 3 : 2
        });
        
        const lightning = new THREE.Line(geometry, material);
        lightning.position.z = 1; // Above bubbles
        if (gameManager.scene) gameManager.scene.add(lightning);
        
        // Add glow effect
        const glowMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            linewidth: isPrimary ? 5 : 3
        });
        const glowLine = new THREE.Line(geometry, glowMaterial);
        glowLine.position.z = 1;
        if (gameManager.scene) gameManager.scene.add(glowLine);
        
        // Animate the lightning
        const lightningAnimation = {
            time: 0,
            opacity: 1,
            update: function(deltaTime) {
                this.time += deltaTime;
                
                // Flicker effect
                const flicker = Math.random() > 0.3 ? 1 : 0.5;
                material.opacity = this.opacity * flicker;
                glowMaterial.opacity = this.opacity * 0.5 * flicker;
                
                // Update path for dynamic movement
                if (this.time < 0.2) {
                    const newPoints = this.generateLightningPath(startPos, endPos, isPrimary ? 5 : 3);
                    geometry.setFromPoints(newPoints);
                }
                
                // Fade out
                if (this.time > 0.3) {
                    this.opacity -= deltaTime * 2;
                    if (this.opacity <= 0) {
                        if (gameManager.scene) {
                            gameManager.scene.remove(lightning);
                            gameManager.scene.remove(glowLine);
                        }
                        geometry.dispose();
                        material.dispose();
                        glowMaterial.dispose();
                        return false;
                    }
                }
                return true;
            }.bind(this)
        };
        
        gameState.addAnimation(lightningAnimation);
    }
    
    generateLightningPath(start, end, segments) {
        const points = [];
        points.push(new THREE.Vector3(start.x, start.y, start.z + 0.5));
        
        // Generate intermediate points with random offset
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const x = start.x + (end.x - start.x) * t;
            const y = start.y + (end.y - start.y) * t;
            const z = start.z + (end.z - start.z) * t + 0.5;
            
            // Add random offset perpendicular to the line
            const perpX = -(end.y - start.y);
            const perpY = end.x - start.x;
            const length = Math.sqrt(perpX * perpX + perpY * perpY);
            const normalizedPerpX = perpX / length;
            const normalizedPerpY = perpY / length;
            
            const offset = (Math.random() - 0.5) * 0.3;
            points.push(new THREE.Vector3(
                x + normalizedPerpX * offset,
                y + normalizedPerpY * offset,
                z
            ));
        }
        
        points.push(new THREE.Vector3(end.x, end.y, end.z + 0.5));
        return points;
    }
    
    createElectricDestructionEffect(bubble, gameState) {
        // Create electrical "short-circuit" effect
        ParticleFactory.createElectricDestruction(
            bubble.position,
            0x00ddff,
            PARTICLE_CONFIG.lightning.electricArcs,
            gameState.particlePool
        );
    }
    
    createElectricCoursingEffect(bubble, gameState, gameManager) {
        // Create electrical effect coursing through the bubble before destruction
        // This creates the visible electricity spreading through bubbles
        
        // Electric flash at bubble position  
        const flashLight = new THREE.PointLight(0x00ddff, 8, 4);
        flashLight.position.copy(bubble.position);
        flashLight.position.z = 2;
        if (gameManager.scene) gameManager.scene.add(flashLight);
        
        // Fade out flash quickly
        setTimeout(() => {
            if (gameManager.scene) gameManager.scene.remove(flashLight);
        }, 150);
        
        // Create electrical sparks coursing around the bubble
        const sparkCount = 20;
        for (let i = 0; i < sparkCount; i++) {
            const particle = gameState.particlePool.spawn(
                bubble.position.x,
                bubble.position.y, 
                bubble.position.z + 0.3,
                i % 4 === 0 ? 0xffffff : 0x00ddff, // Mix white sparks with blue
                0.12
            );
            
            if (particle) {
                // Erratic electrical movement around the bubble
                const angle = Math.random() * Math.PI * 2;
                const radius = CONFIG.BUBBLE_RADIUS * (0.8 + Math.random() * 0.4);
                const speed = 3 + Math.random() * 4;
                
                particle.velocity.set(
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    (Math.random() - 0.5) * 2
                );
                
                // Quick decay for spark effect
                particle.decay = 0.06;
                
                // Add jittery movement to simulate electricity
                const originalUpdate = particle.update;
                particle.update = function(deltaTime) {
                    // Add electrical jitter
                    this.velocity.x += (Math.random() - 0.5) * 0.5;
                    this.velocity.y += (Math.random() - 0.5) * 0.5;
                    this.velocity.z += (Math.random() - 0.5) * 0.3;
                    
                    return originalUpdate.call(this, deltaTime);
                };
            }
        }
        
        // Make the bubble itself flicker with electricity
        if (bubble.mesh && bubble.mesh.material) {
            const originalEmissive = bubble.mesh.material.emissive ? bubble.mesh.material.emissive.clone() : new THREE.Color(0x000000);
            const originalIntensity = bubble.mesh.material.emissiveIntensity || 0;
            
            // Electric flicker effect
            let flickerTime = 0;
            const flickerInterval = setInterval(() => {
                flickerTime += 16;
                
                if (bubble.mesh && bubble.mesh.material) {
                    const intensity = Math.random() > 0.4 ? 1.5 : 0.3;
                    bubble.mesh.material.emissive.setHex(0x00ddff);
                    bubble.mesh.material.emissiveIntensity = intensity;
                    
                    // Stop flickering after a short time
                    if (flickerTime > 120) {
                        bubble.mesh.material.emissive.copy(originalEmissive);
                        bubble.mesh.material.emissiveIntensity = originalIntensity;
                        clearInterval(flickerInterval);
                    }
                }
            }, 16);
        }
    }
    
    createVisualEffect(bubble) {
        super.createVisualEffect(bubble);
        
        // Dark stormy bubble with electric core
        bubble.mesh.material = new THREE.MeshPhysicalMaterial({
            color: 0x001144,
            emissive: 0x0066ff,
            emissiveIntensity: 0.6,
            metalness: 0.9,
            roughness: 0.1,
            clearcoat: 1,
            clearcoatRoughness: 0,
            transmission: 0.5,
            thickness: 0.5,
            ior: 1.5
        });
        
        // Add internal lightning core
        const coreGeometry = new THREE.SphereGeometry(CONFIG.BUBBLE_RADIUS * 0.3, 8, 8);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ddff,
            transparent: true,
            opacity: 0.8
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        bubble.mesh.add(core);
        bubble.lightningCore = core;
        
        // Add crackling electric arcs around the bubble
        const arcCount = 4;
        bubble.electricArcs = [];
        
        for (let i = 0; i < arcCount; i++) {
            const arcGeometry = new THREE.BufferGeometry();
            const arcPositions = new Float32Array(6 * 3);
            arcGeometry.setAttribute('position', new THREE.BufferAttribute(arcPositions, 3));
            
            const arcMaterial = new THREE.LineBasicMaterial({
                color: 0x00ddff,
                transparent: true,
                opacity: 0.8,
                linewidth: 2
            });
            
            const arc = new THREE.Line(arcGeometry, arcMaterial);
            bubble.mesh.add(arc);
            bubble.electricArcs.push({
                mesh: arc,
                phase: Math.random() * Math.PI * 2,
                speed: 2 + Math.random() * 2
            });
        }
        
        // Enhanced animation with pulsing core and dynamic arcs
        const originalUpdate = bubble.powerUpAnimation.update;
        bubble.powerUpAnimation.update = function(deltaTime) {
            originalUpdate.call(this, deltaTime);
            
            // Pulse the core
            const corePulse = 0.8 + Math.sin(this.time * 4) * 0.2;
            bubble.lightningCore.scale.setScalar(corePulse);
            bubble.lightningCore.material.opacity = 0.6 + Math.sin(this.time * 3) * 0.4;
            
            // Update electric arcs with more chaotic movement
            bubble.electricArcs.forEach((arc, index) => {
                const positions = arc.mesh.geometry.attributes.position.array;
                const time = this.time * arc.speed + arc.phase;
                
                for (let j = 0; j < 6; j++) {
                    const t = j / 5;
                    const angle = time + t * Math.PI * 2;
                    const radius = CONFIG.BUBBLE_RADIUS * (0.7 + Math.sin(time * 3 + j) * 0.4);
                    
                    // More erratic movement
                    const jitterX = (Math.random() - 0.5) * 0.2;
                    const jitterY = (Math.random() - 0.5) * 0.2;
                    
                    positions[j * 3] = Math.cos(angle) * radius + jitterX;
                    positions[j * 3 + 1] = Math.sin(angle) * radius + jitterY;
                    positions[j * 3 + 2] = (j - 2.5) * 0.3;
                }
                
                arc.mesh.geometry.attributes.position.needsUpdate = true;
                arc.mesh.material.opacity = 0.3 + Math.random() * 0.7;
            });
            
            // Occasional bright flash
            if (Math.random() < 0.02) {
                bubble.mesh.material.emissiveIntensity = 1.5;
                setTimeout(() => {
                    bubble.mesh.material.emissiveIntensity = 0.6;
                }, 50);
            }
        };
    }
}