import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Precision Aim Indicator System
 * Shows where the bubble will land during precision aim mode
 */
export class PrecisionAimIndicator {
    constructor(scene) {
        this.scene = scene;
        this.indicator = null;
        this.targetPosition = null;
        this.animationTime = 0;
    }

    createIndicator() {
        if (this.indicator) {
            this.removeIndicator();
        }

        // Create a group for the indicator
        this.indicator = new THREE.Group();
        this.indicator.name = 'precisionAimIndicator';

        // Main bubble outline
        const outlineGeometry = new THREE.IcosahedronGeometry(CONFIG.BUBBLE_RADIUS * 1.1, 2);
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.4,
            wireframe: true,
            side: THREE.BackSide
        });
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        this.indicator.add(outline);

        // Inner glow
        const glowGeometry = new THREE.IcosahedronGeometry(CONFIG.BUBBLE_RADIUS * 0.9, 2);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.indicator.add(glow);

        // Targeting rings
        for (let i = 0; i < 3; i++) {
            const ringRadius = CONFIG.BUBBLE_RADIUS * (1.3 + i * 0.2);
            const ringGeometry = new THREE.RingGeometry(ringRadius, ringRadius + 0.05, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.3 - i * 0.1,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2;
            ring.userData.ringIndex = i;
            this.indicator.add(ring);
        }

        // Cross-hair markers
        const crosshairGroup = new THREE.Group();
        for (let i = 0; i < 4; i++) {
            const markerGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.02);
            const markerMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.8
            });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            
            const angle = (i / 4) * Math.PI * 2;
            const distance = CONFIG.BUBBLE_RADIUS * 1.8;
            marker.position.set(
                Math.cos(angle) * distance,
                Math.sin(angle) * distance,
                0
            );
            marker.rotation.z = angle + Math.PI / 2;
            crosshairGroup.add(marker);
        }
        this.indicator.add(crosshairGroup);

        // Hide initially
        this.indicator.visible = false;
        this.scene.add(this.indicator);

        console.log('Precision aim indicator created');
    }

    showAt(position, bubbleColor = 0x00ffff) {
        if (!this.indicator) {
            this.createIndicator();
        }

        this.targetPosition = position.clone();
        this.indicator.position.copy(position);
        this.indicator.visible = true;

        // Update colors to match bubble color if provided
        this.indicator.children.forEach(child => {
            if (child.material) {
                if (child.userData.ringIndex !== undefined) {
                    // Keep rings cyan for visibility
                    child.material.color.setHex(0x00ffff);
                } else {
                    // Tint other elements with bubble color
                    child.material.color.setHex(bubbleColor);
                }
            }
            if (child.children) {
                child.children.forEach(grandChild => {
                    if (grandChild.material) {
                        grandChild.material.color.setHex(0x00ffff);
                    }
                });
            }
        });

        console.log('Precision aim indicator shown at:', position);
    }

    hide() {
        if (this.indicator) {
            this.indicator.visible = false;
        }
    }

    removeIndicator() {
        if (this.indicator) {
            // Dispose of all geometries and materials
            this.indicator.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            
            this.scene.remove(this.indicator);
            this.indicator = null;
        }
    }

    update(deltaTime) {
        if (!this.indicator || !this.indicator.visible) return;

        this.animationTime += deltaTime;

        // Animate the indicator
        const pulseFactor = Math.sin(this.animationTime * 4) * 0.1 + 1;
        const outline = this.indicator.children[0];
        if (outline) {
            outline.scale.setScalar(pulseFactor);
        }

        // Rotate rings
        this.indicator.children.forEach((child, index) => {
            if (child.userData.ringIndex !== undefined) {
                child.rotation.z = this.animationTime * (1 + child.userData.ringIndex * 0.5);
            }
        });

        // Pulse opacity
        const opacityFactor = Math.sin(this.animationTime * 3) * 0.2 + 0.8;
        this.indicator.children.forEach(child => {
            if (child.material) {
                const baseOpacity = child.userData.baseOpacity || child.material.opacity;
                child.material.opacity = baseOpacity * opacityFactor;
                if (!child.userData.baseOpacity) {
                    child.userData.baseOpacity = baseOpacity;
                }
            }
        });

        // Animate crosshair
        const crosshairGroup = this.indicator.children[this.indicator.children.length - 1];
        if (crosshairGroup && crosshairGroup.children) {
            crosshairGroup.rotation.z = this.animationTime * 2;
        }
    }

    dispose() {
        this.removeIndicator();
    }
}