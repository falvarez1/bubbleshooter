import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Base PowerUp Class
 * Abstract base class for all power-ups in the game
 */
export class PowerUp {
    constructor(type, config) {
        this.type = type;
        this.name = config.name;
        this.rarity = config.rarity;
        this.spawnRate = config.spawnRate;
        this.color = config.color;
        this.glowColor = config.glowColor;
        this.duration = config.duration || 0;
        this.cooldown = config.cooldown || 0;
        this.isActive = false;
    }
    
    /**
     * Activate the power-up
     * @param {Object} targetPosition - The position where the power-up was activated
     * @param {GameState} gameState - Current game state
     * @param {GameManager} gameManager - Game manager instance
     * @returns {boolean} Whether the activation was successful
     */
    activate(targetPosition, gameState, gameManager) {
        // Override in subclasses
        throw new Error('PowerUp activate method must be implemented');
    }
    
    /**
     * Create visual effects for the power-up bubble
     * @param {Bubble} bubble - The bubble to apply visual effects to
     */
    createVisualEffect(bubble) {
        // Add glow and particle effects to power-up bubbles
        bubble.powerUpType = this.type;
        bubble.isPowerUp = true;
        
        // Add glowing effect
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: this.glowColor,
            transparent: true,
            opacity: 0.3
        });
        const glowGeometry = new THREE.SphereGeometry(CONFIG.BUBBLE_RADIUS * 1.5, 16, 16);
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        // Ensure glow is centered on the bubble
        glow.position.set(0, 0, 0);
        bubble.mesh.add(glow);
        bubble.powerUpGlow = glow;  // Use different property name to avoid conflict
        
        // Add pulsing animation
        bubble.powerUpAnimation = {
            bubble: bubble,
            time: 0,
            active: true,
            update: function(deltaTime) {
                if (!this.active) return false;
                
                this.time += deltaTime;
                const scale = 1 + Math.sin(this.time * 3) * 0.1;
                // Use the closure reference to glow, which is the power-up glow
                if (glow && glow.parent) {
                    glow.scale.set(scale, scale, scale);
                    glow.material.opacity = 0.3 + Math.sin(this.time * 2) * 0.1;
                } else if (this.bubble && this.bubble.powerUpGlow) {
                    // Fallback to check bubble.powerUpGlow if closure reference is lost
                    this.bubble.powerUpGlow.scale.set(scale, scale, scale);
                    this.bubble.powerUpGlow.material.opacity = 0.3 + Math.sin(this.time * 2) * 0.1;
                }
                return true;
            }
        };
    }
}