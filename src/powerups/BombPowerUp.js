import * as THREE from 'three';
import { PowerUp } from './PowerUp.js';

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
        this.explosionRadius = 3; // 3x3 grid
    }
    
    activate(targetPosition, gameState, gameManager) {
        // Destroy bubbles in 3x3 area
        gameManager.eventBus.emit('bombExploded', { 
            position: targetPosition,
            radius: this.explosionRadius 
        });
        
        // Screen shake effect
        gameManager.addScreenShake(0.5, 10);
        
        return true;
    }
    
    createVisualEffect(bubble) {
        super.createVisualEffect(bubble);
        
        // Pulsing red glow
        bubble.mesh.material.emissive = new THREE.Color(0x660000);
        bubble.mesh.material.emissiveIntensity = 0.5;
        
        // Add timer ticking effect
        let tickTime = 0;
        const originalUpdate = bubble.powerUpAnimation.update;
        bubble.powerUpAnimation.update = function(deltaTime) {
            originalUpdate.call(this, deltaTime);
            tickTime += deltaTime;
            if (tickTime > 0.5) {
                tickTime = 0;
                // Flash effect
                bubble.mesh.material.emissiveIntensity = 1;
                setTimeout(() => {
                    bubble.mesh.material.emissiveIntensity = 0.5;
                }, 100);
            }
        };
    }
}