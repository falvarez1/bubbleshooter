import * as THREE from 'three';
import { PowerUp } from './PowerUp.js';

/**
 * Rainbow Bubble Power-Up
 * Matches any color it touches
 */
export class RainbowPowerUp extends PowerUp {
    constructor() {
        super('rainbow', {
            name: 'Rainbow Bubble',
            rarity: 'common',
            spawnRate: 0.15,
            color: 0xffffff,
            glowColor: 0xffffff
        });
    }
    
    activate(targetPosition, gameState, gameManager) {
        // Rainbow bubble matches any color it touches
        gameManager.eventBus.emit('rainbowActivated', { position: targetPosition });
        return true;
    }
    
    createVisualEffect(bubble) {
        super.createVisualEffect(bubble);
        
        // Create rainbow shimmer effect
        bubble.mesh.material = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x444444,
            emissiveIntensity: 0.5,
            shininess: 100
        });
        
        // Add rainbow animation
        const originalUpdate = bubble.powerUpAnimation.update;
        bubble.powerUpAnimation.update = function(deltaTime) {
            originalUpdate.call(this, deltaTime);
            const hue = (this.time * 0.1) % 1;
            bubble.mesh.material.color.setHSL(hue, 1, 0.5);
        };
    }
}