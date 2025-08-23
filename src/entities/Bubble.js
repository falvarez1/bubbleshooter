import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { Vector3Pool } from '../utils/Vector3Pool.js';

// Material pool for reusing materials
const materialPool = new Map();

function getPooledMaterial(color) {
    const colorKey = color.toString();
    if (!materialPool.has(colorKey)) {
        const material = new THREE.MeshPhysicalMaterial({
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
        materialPool.set(colorKey, material);
    }
    return materialPool.get(colorKey);
}

// Geometry pool for reusing geometries
let sharedGeometry = null;
let sharedGlowGeometry = null;

/**
 * Bubble Entity Class
 * Represents a single bubble in the game with physics, rendering, and animations
 */
export class Bubble {
    constructor(x, y, color, radius = CONFIG.BUBBLE_RADIUS) {
        // Generate unique ID for instanced rendering tracking
        this.id = `bubble_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.gridX = -1;
        this.gridY = -1;
        this.position = new THREE.Vector3(x, y, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.color = color;
        this.radius = radius;
        this.isMoving = false;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        
        // Use instanced rendering flag
        this.useInstancedRendering = false; // Will be set to true by main game
        
        // Create shared geometry once
        if (!sharedGeometry) {
            sharedGeometry = new THREE.IcosahedronGeometry(CONFIG.BUBBLE_RADIUS, 2);
            sharedGlowGeometry = new THREE.IcosahedronGeometry(CONFIG.BUBBLE_RADIUS * 1.1, 2);
        }
        
        // Get pooled material
        this.material = getPooledMaterial(color);
        
        // Create mesh with shared geometry and pooled material
        this.mesh = new THREE.Mesh(sharedGeometry, this.material);
        this.mesh.position.set(x, y, 0);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Don't create glow mesh if using instanced rendering (handled by shader)
        this.glowMesh = null;
        if (!this.useInstancedRendering) {
            // Add rim light glow for individual meshes only
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.15,
                side: THREE.BackSide
            });
            this.glowMesh = new THREE.Mesh(sharedGlowGeometry, glowMaterial);
            this.mesh.add(this.glowMesh);
        }
        
        // Connection animation properties
        this.connectionScale = 1.0;
        this.connectionAnimating = false;
        
        // Impact scale for spring physics
        this.impactScale = 1.0;
        
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
        
        // Destruction state - used to prevent collision with bubbles being destroyed
        this.isDestroyed = false;
        
        // Attachment state - used when bubble hits ceiling
        this.needsAttachment = false;
        
        // Movement timeout - prevent bubbles from being stuck in moving state
        this.movementStartTime = 0;
    }
    
    startMoving() {
        this.isMoving = true;
        this.movementStartTime = Date.now();
    }
    
    stopMoving() {
        this.isMoving = false;
        this.movementStartTime = 0;
    }
    
    update(deltaTime) {
        if (this.isMoving) {
            // Track movement time to prevent infinite movement
            if (this.movementStartTime === 0) {
                this.movementStartTime = Date.now();
            } else if (Date.now() - this.movementStartTime > 10000) { // 10 second timeout
                // Bubble movement timeout, forcing attachment
                this.position.y = CONFIG.CEILING_Y - 0.5 - this.radius;
                this.velocity.set(0, 0, 0);
                this.isMoving = false;
                this.needsAttachment = true;
                return;
            }
            
            // Update position with frame-rate independence
            // Cap deltaTime to prevent physics explosions during frame drops
            const safeDelta = Math.min(deltaTime, 0.033); // Cap at 30fps minimum
            
            // Use Vector3Pool to avoid allocation
            const movement = Vector3Pool.get();
            movement.copy(this.velocity).multiplyScalar(safeDelta);
            this.position.add(movement);
            Vector3Pool.release(movement);
            
            this.mesh.position.copy(this.position);
            
            // Check wall collisions
            const wallLimit = 5.5;
            if (Math.abs(this.position.x) > wallLimit - this.radius) {
                this.position.x = Math.sign(this.position.x) * (wallLimit - this.radius);
                this.velocity.x *= -CONFIG.WALL_BOUNCE_DAMPING;
                this.onWallBounce();
            }
            
            // Check ceiling - use same threshold as CollisionSystem
            if (this.position.y > CONFIG.CEILING_Y - this.radius) {
                this.position.y = CONFIG.CEILING_Y - this.radius;
                this.velocity.set(0, 0, 0);
                this.isMoving = false;
                this.movementStartTime = 0; // Reset movement timer
                // Mark as needing attachment - will be handled by CollisionSystem
                this.needsAttachment = true;
            }
            
            // Safety check: if bubble goes way out of bounds, force attachment
            if (this.position.y > CONFIG.CEILING_Y + 2) {
                // Bubble went out of bounds, forcing attachment
                this.position.y = CONFIG.CEILING_Y - this.radius;
                this.velocity.set(0, 0, 0);
                this.isMoving = false;
                this.movementStartTime = 0; // Reset movement timer
                this.needsAttachment = true;
            }
        }
        
        // Floating animation
        if (!this.isMoving) {
            const floatY = Math.sin(Date.now() * 0.001 * this.floatSpeed + this.floatOffset) * 0.05;
            this.mesh.position.x = this.position.x;
            this.mesh.position.y = this.position.y + floatY;
            this.mesh.position.z = this.position.z;
        }
        
        // Rotation
        this.mesh.rotation.x += this.rotationSpeed;
        this.mesh.rotation.y += this.rotationSpeed * 0.7;
        
        // Connection bounce animation
        if (this.connectionAnimating) {
            this.connectionScale = 1.0 + Math.sin(Date.now() * 0.01) * 0.1 * this.connectionAnimating;
            this.mesh.scale.setScalar(this.connectionScale);
            this.connectionAnimating *= 0.85; // Faster decay (was 0.95)
            if (this.connectionAnimating < 0.01) {
                this.connectionAnimating = false;
                this.connectionScale = 1.0; // Reset scale value
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
            
            // Update position based on impact velocity with frame-rate independence
            const safeDelta = Math.min(deltaTime, 0.033); // Cap at 30fps minimum
            const impactMovement = Vector3Pool.get();
            impactMovement.copy(this.impactVelocity).multiplyScalar(safeDelta * CONFIG.IMPACT_PHYSICS.POSITION_MULTIPLIER);
            this.position.add(impactMovement);
            Vector3Pool.release(impactMovement);
            
            this.mesh.position.copy(this.position);
            
            // Add subtle scale pulse
            const impactScale = 1.0 + this.impactVelocity.length() * CONFIG.IMPACT_PHYSICS.SCALE_RESPONSE;
            this.mesh.scale.setScalar(impactScale);
            
            // Store the impact scale for instanced rendering
            this.impactScale = impactScale;
            
            // Reset if velocity is very small
            if (this.impactVelocity.length() < 0.001) {
                this.impactVelocity.set(0, 0, 0);
                this.position.copy(this.basePosition);
                this.mesh.position.copy(this.position);
                this.mesh.scale.setScalar(1.0);
                this.impactScale = 1.0; // Reset impact scale
            }
        }
        
        // Update rim glow
        if (this.glowMesh) {
            this.glowMesh.rotation.x = -this.mesh.rotation.x;
            this.glowMesh.rotation.y = -this.mesh.rotation.y;
        }
        
        // Update power-up animation if present and active
        if (this.powerUpAnimation && this.powerUpAnimation.active !== false) {
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
        // Prevent double destruction
        if (this.isDestroyed) {
            return;
        }
        
        // Mark as destroyed to prevent collision detection
        this.isDestroyed = true;
        
        // First, properly dispose of all children of the mesh
        if (this.mesh && this.mesh.children && this.mesh.children.length > 0) {
            // Create a copy of the children array since we'll be modifying it
            const children = [...this.mesh.children];
            children.forEach(child => {
                this.mesh.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
        
        // Remove mesh from scene if it's there (shouldn't be for instanced bubbles)
        if (this.mesh && this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        
        // For instanced bubbles, ensure they're fully hidden
        if (this.useInstancedRendering) {
            // The instanced renderer should have already removed this
            // but set mesh to null to ensure no references remain
            this.mesh = null;
        }
        // Don't dispose pooled materials and shared geometries
        // They will be reused by other bubbles
        // Only dispose if it's a special non-pooled material
        if (this.glowMesh) {
            this.glowMesh.material.dispose(); // Glow materials are not pooled
            // Don't dispose shared geometry
            this.glowMesh = null; // Nullify the reference
        }
        
        // Clean up power-up glow if it exists
        if (this.powerUpGlow) {
            if (this.powerUpGlow.parent) {
                this.powerUpGlow.parent.remove(this.powerUpGlow);
            }
            this.powerUpGlow.material.dispose();
            this.powerUpGlow.geometry.dispose();
            this.powerUpGlow = null;
        }

        // Nullify power-up related properties when the bubble is destroyed.
        // This helps prevent lingering effects if timeouts or async operations
        // in power-up animations try to act on a destroyed bubble.
        this.isPowerUp = false;
        this.powerUpType = null;

        // If the active power-up animation has a specific cleanup method (e.g., for bombs), call it.
        if (this.powerUpAnimation) {
            this.powerUpAnimation.active = false;
            if (typeof this.powerUpAnimation.cleanupBombVisuals === 'function') {
                this.powerUpAnimation.cleanupBombVisuals();
            } else if (typeof this.powerUpAnimation.clear === 'function') {
                // Fallback to a generic clear if it exists (hypothetical for other power-ups)
                this.powerUpAnimation.clear();
            }
        }
        this.powerUpAnimation = null;
        
        // Clean up any power-up specific child meshes
        if (this.lightningCore) {
            if (this.lightningCore.parent) {
                this.lightningCore.parent.remove(this.lightningCore);
            }
            this.lightningCore.geometry.dispose();
            this.lightningCore.material.dispose();
            this.lightningCore = null;
        }
        
        if (this.electricArcs) {
            this.electricArcs.forEach(arc => {
                if (arc.mesh.parent) {
                    arc.mesh.parent.remove(arc.mesh);
                }
                arc.mesh.geometry.dispose();
                arc.mesh.material.dispose();
            });
            this.electricArcs = null;
        }

        // It's generally good practice to nullify references to complex objects
        // like mesh and material after disposal to potentially help garbage collection,
        // though JavaScript's GC is usually smart enough if scopes are managed well.
        // However, ensure this doesn't break other parts of the code that might
        // expect these to exist (even if disposed) for a short period.
        // For now, let's keep them as they were in the reverted version to minimize risk,
        // as the main issue seems to be the powerUpAnimation state.
        // this.mesh = null; // Re-evaluating if this is safe/needed
        // this.material = null; // Re-evaluating if this is safe/needed
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
        
        // Only update mesh position if not using instanced rendering
        if (!this.useInstancedRendering) {
            this.mesh.position.copy(this.position);
        }
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