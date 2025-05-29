import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { PowerUp } from './PowerUp.js';
import { ParticleFactory } from '../entities/Particle.js';

/**
 * Bomb Bubble Power-Up
 * Destroys bubbles in a 3x3 area
 */
export class BombPowerUp extends PowerUp {
    constructor() {
        super('bomb', {
            name: 'Bomb Bubble',
            rarity: 'common',
            spawnRate: 0.10,
            color: 0xff0000,
            glowColor: 0xff0000
        });
        this.explosionRadius = 1.5; // Distance to check for 3x3 grid area
    }
    
    activate(targetBubbleOrPosition, gameState, gameManager) {
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
            console.log('Bomb: No bubble found for activation');
            return false;
        }
        
        // Execute the bomb explosion
        this.executeBombExplosion(impactBubble, gameState, gameManager);
        
        return true;
    }
    
    executeBombExplosion(impactBubble, gameState, gameManager) {
        const destroyed = [impactBubble];
        
        // Find all bubbles within explosion radius (3x3 area)
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const target = gameState.getBubbleAt(x, y);
                if (target && target !== impactBubble) {
                    const distance = impactBubble.position.distanceTo(target.position);
                    if (distance <= this.explosionRadius * CONFIG.HEX_WIDTH) {
                        destroyed.push(target);
                        
                        // Check for chain reaction with other bombs
                        if (target.isPowerUp && target.powerUpType === 'bomb') {
                            // Trigger chain reaction after a short delay
                            setTimeout(() => {
                                this.executeBombExplosion(target, gameState, gameManager);
                            }, 200);
                        }
                    }
                }
            }
        }
        
        // Create explosion visual effects
        this.createExplosionEffects(impactBubble, gameState, gameManager);
        
        // Emit event for sound/UI feedback
        gameManager.eventBus.emit('bombExploded', { 
            position: impactBubble.position,
            radius: this.explosionRadius,
            bubblesDestroyed: destroyed.length
        });
        
        // Screen shake effect
        gameManager.addScreenShake(0.5, 10);
        
        // Emit event to handle bubble destruction through game logic
        setTimeout(() => {
            gameManager.eventBus.emit('bombDestroy', {
                bubbles: destroyed,
                points: destroyed.length * 30 // Triple points for bomb
            });
        }, 300);
    }
    
    createExplosionEffects(impactBubble, gameState, gameManager) {
        // Create bright explosion light
        const explosionLight = new THREE.PointLight(0xff0000, 8, 12);
        explosionLight.position.copy(impactBubble.position);
        explosionLight.position.z = 2;
        if (gameManager.scene) gameManager.scene.add(explosionLight);
        
        // Fade out explosion light over time
        let explosionIntensity = 8;
        const explosionFade = setInterval(() => {
            explosionIntensity -= 0.6;
            explosionLight.intensity = Math.max(0, explosionIntensity);
            if (explosionIntensity <= 0) {
                if (gameManager.scene) gameManager.scene.remove(explosionLight);
                clearInterval(explosionFade);
            }
        }, 50);
        
        // Create explosion particle burst
        ParticleFactory.createExplosion(
            impactBubble.position,
            0xff4400,
            50,
            gameState.particlePool
        );
        
        // Create expanding shockwave ring
        this.createShockwaveEffect(impactBubble.position, gameState, gameManager);
    }
    
    createShockwaveEffect(position, gameState, gameManager) {
        // Create expanding ring geometry
        const ringGeometry = new THREE.RingGeometry(0.1, 0.2, 16, 1);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const shockwave = new THREE.Mesh(ringGeometry, ringMaterial);
        shockwave.position.copy(position);
        shockwave.position.z = 0.5;
        if (gameManager.scene) gameManager.scene.add(shockwave);
        
        // Animate the expanding shockwave
        const shockwaveAnimation = {
            scale: 1,
            opacity: 0.8,
            update: function(deltaTime) {
                this.scale += deltaTime * 15; // Expand quickly
                this.opacity -= deltaTime * 2; // Fade out
                
                shockwave.scale.set(this.scale, this.scale, 1);
                ringMaterial.opacity = Math.max(0, this.opacity);
                
                if (this.opacity <= 0) {
                    if (gameManager.scene) gameManager.scene.remove(shockwave);
                    ringGeometry.dispose();
                    ringMaterial.dispose();
                    return false; // Remove from animations
                }
                return true;
            }
        };
        
        gameState.addAnimation(shockwaveAnimation);
    }
    
    createVisualEffect(bubble) {
        super.createVisualEffect(bubble);
        
        // Pulsing red glow
        bubble.mesh.material.emissive = new THREE.Color(0x660000);
        bubble.mesh.material.emissiveIntensity = 0.5;
        
        // Add timer ticking effect
        let tickTime = 0;
        const currentAnimation = bubble.powerUpAnimation; // The animation object set by super.createVisualEffect
        const originalUpdate = currentAnimation.update;
        const bombPowerUpType = this.type; // 'bomb'

        // Store timeout ID on the animation object itself
        currentAnimation.bombTickTimeoutID = null;

        currentAnimation.update = function(deltaTime) { // 'this' refers to currentAnimation
            // Check if animation is still active
            if (this.active === false) {
                // Clean up any pending timeouts
                if (this.bombTickTimeoutID) {
                    clearTimeout(this.bombTickTimeoutID);
                    this.bombTickTimeoutID = null;
                }
                return false;
            }
            
            originalUpdate.call(this, deltaTime); // 'this.bubble' is the bubble associated with this animation

            if (!this.bubble || !this.bubble.mesh || !this.bubble.mesh.material) {
                // If bubble is gone, try to clear any pending timeout for safety
                if (this.bombTickTimeoutID) {
                    clearTimeout(this.bombTickTimeoutID);
                    this.bombTickTimeoutID = null;
                }
                return;
            }

            tickTime += deltaTime;
            if (tickTime > 0.5) {
                tickTime = 0;

                // Ensure this animation is still the active one for this bubble and it's still this power-up type
                if (this.bubble.powerUpAnimation !== this || this.bubble.powerUpType !== bombPowerUpType) {
                    if (this.bombTickTimeoutID) { // Clear timeout if state is no longer valid
                        clearTimeout(this.bombTickTimeoutID);
                        this.bombTickTimeoutID = null;
                    }
                    return;
                }
                
                this.bubble.mesh.material.emissiveIntensity = 1;

                // Clear any existing timeout before setting a new one to prevent multiple stacked timeouts
                if (this.bombTickTimeoutID) {
                    clearTimeout(this.bombTickTimeoutID);
                }

                this.bombTickTimeoutID = setTimeout(() => {
                    this.bombTickTimeoutID = null; // Clear the ID once the timeout starts executing
                    if (this.bubble && this.bubble.mesh && this.bubble.mesh.material &&
                        this.bubble.powerUpAnimation === this && // Check if this animation object is still current
                        this.bubble.powerUpType === bombPowerUpType) { // Check if bubble is still this power-up type
                        
                        this.bubble.mesh.material.emissiveIntensity = 0.5;
                    }
                }, 100);
            }
        };

        // Add a specific cleanup method to this animation object
        currentAnimation.cleanupBombVisuals = function() {
            if (this.bombTickTimeoutID) {
                clearTimeout(this.bombTickTimeoutID);
                this.bombTickTimeoutID = null;
            }
            // Optionally, reset material properties if this animation was the last one to modify them
            // However, the main.js reset should handle the next bubble's material.
            // This cleanup is primarily for the timeout.
            // If the bubble still exists and is a bomb, we might want to set intensity back to 0.5
            // But if it's being destroyed or reset, other logic will take over.
        };
    }
}