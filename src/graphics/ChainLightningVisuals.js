import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Chain Lightning Visual Effects Helper
 * Creates additional visual effects for Chain Lightning bubbles
 */
export class ChainLightningVisuals {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = new Map();
    }
    
    /**
     * Create electrical field effect around bubble
     */
    createElectricField(bubble) {
        if (this.activeEffects.has(bubble.id)) {
            return; // Already has effects
        }
        
        const effects = {
            arcs: [],
            particles: [],
            field: null,
            update: null
        };
        
        // Create rotating electric field mesh
        const fieldGeometry = new THREE.TorusGeometry(
            CONFIG.BUBBLE_RADIUS * 1.5,
            0.05,
            8,
            32
        );
        const fieldMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ddff,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        effects.field = new THREE.Mesh(fieldGeometry, fieldMaterial);
        effects.field.position.copy(bubble.position);
        this.scene.add(effects.field);
        
        // Create orbiting electric arcs
        for (let i = 0; i < 3; i++) {
            const arcGeometry = new THREE.CylinderGeometry(0.01, 0.01, CONFIG.BUBBLE_RADIUS * 2);
            const arcMaterial = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? 0xffffff : 0x00ddff,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending
            });
            const arc = new THREE.Mesh(arcGeometry, arcMaterial);
            arc.userData = {
                angle: (Math.PI * 2 * i) / 3,
                speed: 2 + Math.random(),
                radius: CONFIG.BUBBLE_RADIUS * 1.2
            };
            this.scene.add(arc);
            effects.arcs.push(arc);
        }
        
        // Update function for animation
        effects.update = (deltaTime) => {
            if (!bubble || bubble.isDestroyed) {
                this.removeEffects(bubble.id);
                return;
            }
            
            // Update field position and rotation
            if (effects.field) {
                effects.field.position.copy(bubble.position);
                effects.field.rotation.x += deltaTime * 2;
                effects.field.rotation.y += deltaTime * 3;
                
                // More dramatic opacity flicker
                const baseOpacity = 0.15;
                const flicker1 = Math.sin(Date.now() * 0.005) * 0.1;
                const flicker2 = Math.sin(Date.now() * 0.02) * 0.05;
                const randomFlicker = Math.random() > 0.95 ? 0.3 : 0;
                effects.field.material.opacity = baseOpacity + flicker1 + flicker2 + randomFlicker;
                
                // Occasional bright flash
                if (Math.random() < 0.01) {
                    effects.field.material.opacity = 0.6;
                    effects.field.material.color.setHex(0xffffff);
                    setTimeout(() => {
                        if (effects.field) {
                            effects.field.material.color.setHex(0x00ddff);
                        }
                    }, 50);
                }
            }
            
            // Update arcs
            effects.arcs.forEach((arc, i) => {
                arc.userData.angle += arc.userData.speed * deltaTime;
                const x = bubble.position.x + Math.cos(arc.userData.angle) * arc.userData.radius;
                const y = bubble.position.y + Math.sin(arc.userData.angle) * arc.userData.radius;
                arc.position.set(x, y, bubble.position.z);
                arc.rotation.z = arc.userData.angle + Math.PI / 2;
                
                // Enhanced flicker with more electrical behavior
                const baseOpacity = 0.3;
                const wave1 = Math.sin(Date.now() * 0.015 + i) * 0.2;
                const wave2 = Math.sin(Date.now() * 0.04 + i * 2) * 0.15;
                const erratic = Math.random() < 0.3 ? Math.random() * 0.4 : 0;
                arc.material.opacity = Math.max(0, Math.min(1, baseOpacity + wave1 + wave2 + erratic));
                
                // More frequent visibility changes for electric effect
                arc.visible = Math.random() > 0.15;
                
                // Occasional bright white flash
                if (Math.random() < 0.02) {
                    arc.material.color.setHex(0xffffff);
                    arc.material.opacity = 0.9;
                    setTimeout(() => {
                        if (arc && arc.material) {
                            arc.material.color.setHex(i % 2 === 0 ? 0xffffff : 0x00ddff);
                        }
                    }, 30);
                }
            });
        };
        
        this.activeEffects.set(bubble.id, effects);
    }
    
    /**
     * Remove effects for a bubble
     */
    removeEffects(bubbleId) {
        const effects = this.activeEffects.get(bubbleId);
        if (!effects) return;
        
        // Remove field
        if (effects.field) {
            this.scene.remove(effects.field);
            effects.field.geometry.dispose();
            effects.field.material.dispose();
        }
        
        // Remove arcs
        effects.arcs.forEach(arc => {
            this.scene.remove(arc);
            arc.geometry.dispose();
            arc.material.dispose();
        });
        
        this.activeEffects.delete(bubbleId);
    }
    
    /**
     * Update all active effects
     */
    update(deltaTime) {
        for (const [bubbleId, effects] of this.activeEffects) {
            if (effects.update) {
                effects.update(deltaTime);
            }
        }
    }
    
    /**
     * Clean up all effects
     */
    dispose() {
        for (const bubbleId of this.activeEffects.keys()) {
            this.removeEffects(bubbleId);
        }
        this.activeEffects.clear();
    }
}