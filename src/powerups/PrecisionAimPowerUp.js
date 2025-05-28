import * as THREE from 'three';
import { PowerUp } from './PowerUp.js';
import { CONFIG } from '../core/Config.js';

/**
 * Precision Aim Power-Up
 * Provides extended trajectory preview for a limited time
 */
export class PrecisionAimPowerUp extends PowerUp {
    constructor() {
        super('precision', {
            name: 'Precision Aim',
            rarity: 'common',
            spawnRate: 0.12,
            color: 0x00ffff,
            glowColor: 0x00ffff,
            duration: 10 // Lasts for 10 seconds
        });
    }
    
    activate(powerUpBubble, gameState, gameManager) {
        gameManager.eventBus.emit('precisionAimActivated', { 
            duration: this.duration 
        });
        
        // Delay removal to ensure proper cleanup
        const currentGridX = powerUpBubble.gridX;
        const currentGridY = powerUpBubble.gridY;
        setTimeout(() => {
            // Ensure currentGridY and currentGridX are valid before accessing the grid
            if (typeof currentGridY === 'undefined' || typeof currentGridX === 'undefined' || 
                !gameState.bubbleGrid || !gameState.bubbleGrid[currentGridY]) {
                console.warn("PrecisionAim: Invalid grid coordinates or grid row after delay.", 
                    { currentGridY, currentGridX }, "powerUpBubble:", powerUpBubble);
                return;
            }
            const bubbleOnGrid = gameState.bubbleGrid[currentGridY][currentGridX];
            
            // Ensure we're removing the correct bubble that's actually on the grid
            if (bubbleOnGrid && bubbleOnGrid === powerUpBubble) {
                gameManager.removeBubble(bubbleOnGrid);
                gameManager.createExplosionEffect(bubbleOnGrid);
            } else if (powerUpBubble && gameState.bubbleGrid[currentGridY] && 
                      gameState.bubbleGrid[currentGridY][currentGridX] === null) {
                // It might have been removed by another effect
                console.log("PrecisionAim power-up bubble was already removed from grid.");
            } else {
                console.warn("PrecisionAim: Could not find the power-up bubble on the grid for removal or it was not the expected bubble.", 
                    powerUpBubble, bubbleOnGrid);
            }
        }, 100);
        
        return true;
    }
    
    createVisualEffect(bubble) {
        super.createVisualEffect(bubble);
        
        // Cyan crystalline material
        bubble.mesh.material = new THREE.MeshPhysicalMaterial({
            color: 0x00ffff,
            emissive: 0x00cccc,
            emissiveIntensity: 0.4,
            metalness: 0.2,
            roughness: 0.1,
            transparent: true,
            opacity: 0.9,
            clearcoat: 1
        });
        
        // Add targeting reticle effect
        const reticleGeometry = new THREE.RingGeometry(CONFIG.BUBBLE_RADIUS * 1.2, CONFIG.BUBBLE_RADIUS * 1.4, 32);
        const reticleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
        bubble.mesh.add(reticle);
        bubble.reticle = reticle;
        
        // Enhanced animation with rotating reticle
        const originalUpdate = bubble.powerUpAnimation.update;
        bubble.powerUpAnimation.update = function(deltaTime) {
            originalUpdate.call(this, deltaTime);
            bubble.reticle.rotation.z += deltaTime * 2;
            bubble.reticle.scale.setScalar(1 + Math.sin(this.time * 3) * 0.1);
        };
    }
}