import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Bubble Entity Class
 * Represents a single bubble in the game with physics, rendering, and animations
 */
export class Bubble {
    constructor(x, y, color, radius = CONFIG.BUBBLE_RADIUS) {
        this.gridX = -1;
        this.gridY = -1;
        this.position = new THREE.Vector3(x, y, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.color = color;
        this.radius = radius;
        this.isMoving = false;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        
        // Create geometry with high detail
        const geometry = new THREE.IcosahedronGeometry(radius, 2);
        
        // Premium glass-like material with enhanced rim lighting
        this.material = new THREE.MeshPhysicalMaterial({
            color: color,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.5,
            thickness: 0.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            envMapIntensity: 1.5,
            ior: 1.5,
            reflectivity: 0.8,
            emissive: color,
            emissiveIntensity: 0.2,
            sheen: 1.0,
            sheenRoughness: 0.3,
            sheenColor: new THREE.Color(color).multiplyScalar(1.5)
        });
        
        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.position.set(x, y, 0);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Add rim light glow
        const glowGeometry = new THREE.IcosahedronGeometry(radius * 1.1, 2);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });
        this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.mesh.add(this.glowMesh);
        
        // Connection animation properties
        this.connectionScale = 1.0;
        this.connectionAnimating = false;
        
        // Impact physics properties
        this.impactVelocity = new THREE.Vector3(0, 0, 0);
        this.impactDamping = CONFIG.IMPACT_PHYSICS.DAMPING;
        this.springConstant = CONFIG.IMPACT_PHYSICS.SPRING_CONSTANT;
        this.basePosition = new THREE.Vector3(x, y, 0);
        
        // Add subtle floating animation
        this.floatOffset = Math.random() * Math.PI * 2;
        this.floatSpeed = 0.5 + Math.random() * 0.5;
        
        // Power-up properties
        this.isPowerUp = false;
        this.powerUpType = null;
        this.powerUpAnimation = null;
    }
    
    update(deltaTime) {
        if (this.isMoving) {
            // Update position
            this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
            this.mesh.position.copy(this.position);
            
            // Check wall collisions
            const wallLimit = 5.5;
            if (Math.abs(this.position.x) > wallLimit - this.radius) {
                this.position.x = Math.sign(this.position.x) * (wallLimit - this.radius);
                this.velocity.x *= -CONFIG.WALL_BOUNCE_DAMPING;
                this.onWallBounce();
            }
            
            // Check ceiling
            if (this.position.y > CONFIG.CEILING_Y - this.radius) {
                this.position.y = CONFIG.CEILING_Y - this.radius;
                this.velocity.y = 0;
                this.isMoving = false;
            }
        }
        
        // Floating animation
        if (!this.isMoving) {
            const floatY = Math.sin(Date.now() * 0.001 * this.floatSpeed + this.floatOffset) * 0.05;
            this.mesh.position.y = this.position.y + floatY;
        }
        
        // Rotation
        this.mesh.rotation.x += this.rotationSpeed;
        this.mesh.rotation.y += this.rotationSpeed * 0.7;
        
        // Connection bounce animation
        if (this.connectionAnimating) {
            this.connectionScale = 1.0 + Math.sin(Date.now() * 0.01) * 0.1 * this.connectionAnimating;
            this.mesh.scale.setScalar(this.connectionScale);
            this.connectionAnimating *= 0.95; // Decay
            if (this.connectionAnimating < 0.01) {
                this.connectionAnimating = false;
                this.mesh.scale.setScalar(1.0);
            }
        }
        
        // Elastic impact physics
        if (!this.isMoving && this.impactVelocity.length() > 0.001) {
            // Apply spring force back to base position
            const displacement = new THREE.Vector3().subVectors(this.position, this.basePosition);
            const springForce = displacement.multiplyScalar(-this.springConstant);
            
            // Update impact velocity with spring force and damping
            this.impactVelocity.add(springForce);
            this.impactVelocity.multiplyScalar(this.impactDamping);
            
            // Update position based on impact velocity
            this.position.add(this.impactVelocity.clone().multiplyScalar(deltaTime * CONFIG.IMPACT_PHYSICS.POSITION_MULTIPLIER));
            this.mesh.position.copy(this.position);
            
            // Add subtle scale pulse
            const impactScale = 1.0 + this.impactVelocity.length() * CONFIG.IMPACT_PHYSICS.SCALE_RESPONSE;
            this.mesh.scale.setScalar(impactScale);
            
            // Reset if velocity is very small
            if (this.impactVelocity.length() < 0.001) {
                this.impactVelocity.set(0, 0, 0);
                this.position.copy(this.basePosition);
                this.mesh.position.copy(this.position);
                this.mesh.scale.setScalar(1.0);
            }
        }
        
        // Update rim glow
        if (this.glowMesh) {
            this.glowMesh.rotation.x = -this.mesh.rotation.x;
            this.glowMesh.rotation.y = -this.mesh.rotation.y;
        }
        
        // Update power-up animation if present
        if (this.powerUpAnimation) {
            this.powerUpAnimation.update(deltaTime);
        }
    }
    
    onWallBounce() {
        // Override in main game to play sound and create particles
    }
    
    createWallImpactParticles() {
        // Override in main game to create particles
    }
    
    destroy() {
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this.material.dispose();
        this.mesh.geometry.dispose();
        if (this.glowMesh) {
            this.glowMesh.material.dispose();
            this.glowMesh.geometry.dispose();
        }
    }
    
    // Set grid position and update base position for physics
    setGridPosition(x, y) {
        this.gridX = x;
        this.gridY = y;
        
        // Calculate world position
        const isOddRow = y % 2 === 1;
        const xPos = (x - CONFIG.GRID_WIDTH / 2 + 0.5) * CONFIG.HEX_WIDTH + (isOddRow ? CONFIG.HEX_WIDTH / 2 : 0);
        const yPos = CONFIG.GRID_TOP_Y - y * CONFIG.HEX_HEIGHT;
        
        this.position.set(xPos, yPos, 0);
        this.basePosition.copy(this.position);
        this.mesh.position.copy(this.position);
    }
    
    // Apply impact force
    applyImpact(force) {
        this.impactVelocity.add(force);
    }
    
    // Get neighbors in hexagonal grid
    static getNeighborOffsets(isOddRow) {
        return isOddRow ? [
            [-1, 0], [1, 0],   // Left, Right
            [0, -1], [1, -1],  // Top-left, Top-right (for odd rows)
            [0, 1], [1, 1]     // Bottom-left, Bottom-right (for odd rows)
        ] : [
            [-1, 0], [1, 0],   // Left, Right
            [-1, -1], [0, -1], // Top-left, Top-right (for even rows)
            [-1, 1], [0, 1]    // Bottom-left, Bottom-right (for even rows)
        ];
    }
}