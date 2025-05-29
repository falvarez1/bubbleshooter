import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Collision System
 * Handles all collision detection and bubble attachment logic
 */
export class CollisionSystem {
    constructor(gameState, gameManager) {
        this.gameState = gameState;
        this.gameManager = gameManager;
        this.lastCollisionCheck = 0;
        this.collisionCheckInterval = 1000 / 120; // Limit to 120fps for collision checks
    }
    
    /**
     * Check collisions for the current shooting bubble
     * @returns {boolean} Whether a collision occurred
     */
    checkBubbleCollisions() {
        if (!this.gameState.currentBubble || !this.gameState.currentBubble.isMoving) return false;
        
        // Throttle collision checks to prevent performance spikes
        const now = Date.now();
        if (now - this.lastCollisionCheck < this.collisionCheckInterval) {
            return false;
        }
        this.lastCollisionCheck = now;
        
        const current = this.gameState.currentBubble;
        
        // Check grid bubbles
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            const isOddRow = y % 2 === 1;
            const bubblesInRow = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                const bubble = this.gameState.bubbleGrid[y][x];
                if (!bubble || bubble.isDestroyed || bubble.isFloating) continue;
                
                // Skip if bubble mesh is not in scene
                if (!bubble.mesh || !bubble.mesh.parent) continue;
                
                const distance = current.position.distanceTo(bubble.position);
                // Use slightly less than 2 radii to ensure proper contact
                if (distance < CONFIG.BUBBLE_RADIUS * 1.8) {
                    // Apply impact force to the hit bubble before attachment
                    const impactDirection = new THREE.Vector3()
                        .subVectors(bubble.position, current.position)
                        .normalize();
                    const impactForce = current.velocity.length() * CONFIG.IMPACT_PHYSICS.DIRECT_HIT_FORCE;
                    
                    // Apply direct hit impact
                    bubble.impactVelocity.add(impactDirection.clone().multiplyScalar(impactForce));
                    bubble.connectionAnimating = CONFIG.IMPACT_PHYSICS.CONNECTION_ANIMATION;
                    
                    // Immediate propagation to all neighbors
                    this.propagateImpact(bubble, impactDirection, impactForce * CONFIG.IMPACT_PHYSICS.PROPAGATION_MULTIPLIER, 0);
                    
                    this.attachBubble(current);
                    return true;
                }
            }
        }
        
        // Check if bubble reached the ceiling
        if (current.position.y > CONFIG.CEILING_Y - 0.5 - CONFIG.BUBBLE_RADIUS) {
            this.attachBubble(current);
            return true;
        }
        
        return false;
    }
    
    /**
     * Attach bubble to grid
     * @param {Bubble} bubble - The bubble to attach
     */
    attachBubble(bubble) {
        bubble.isMoving = false;
        bubble.velocity.set(0, 0, 0);
        
        // Store the attachment velocity for impact calculation
        const attachmentVelocity = bubble.velocity.clone();
        
        // Find nearest valid grid position
        const gridPosition = this.findNearestGridPosition(bubble.position);
        
        if (gridPosition) {
            const { x: finalX, y: finalY } = gridPosition;
            
            // Snap to position
            const isOddRow = finalY % 2 === 1;
            bubble.position.x = (finalX - CONFIG.GRID_WIDTH / 2 + 0.5) * CONFIG.HEX_WIDTH + (isOddRow ? CONFIG.HEX_WIDTH / 2 : 0);
            bubble.position.y = CONFIG.GRID_TOP_Y - finalY * CONFIG.HEX_HEIGHT;
            bubble.gridX = finalX;
            bubble.gridY = finalY;
            bubble.mesh.position.copy(bubble.position);
            
            // Update base position for spring physics
            bubble.basePosition.copy(bubble.position);
            
            // Restore velocity for impact calculation
            bubble.velocity = attachmentVelocity;
            
            this.gameState.bubbleGrid[finalY][finalX] = bubble;
            
            // Bubble is now part of the grid
            bubble.isMoving = false;
            
            // Ensure mesh is visible and in scene
            bubble.mesh.visible = true;
            bubble.mesh.scale.setScalar(1.0);
            
            // Make sure the mesh stays in the scene
            if (!bubble.mesh.parent) {
                console.warn('Bubble mesh was not in scene, re-adding it');
                if (this.gameManager.scene) {
                    this.gameManager.scene.add(bubble.mesh);
                }
            }
            
            // Create attachment effect
            this.createAttachmentEffect(bubble);
            
            // Emit bubble attached event
            this.gameManager.eventBus.emit('bubbleAttached', { bubble });
        }
    }
    
    /**
     * Find nearest valid grid position for bubble attachment
     * @param {THREE.Vector3} position - World position
     * @returns {Object|null} Grid coordinates {x, y} or null
     */
    findNearestGridPosition(position) {
        // Use a more efficient spatial approach - start from bubble's approximate grid position
        // and search outward in a spiral pattern
        
        // First, estimate the grid position from world coordinates
        const centerY = Math.round((CONFIG.GRID_TOP_Y - position.y) / CONFIG.HEX_HEIGHT);
        const estimatedY = Math.max(0, Math.min(CONFIG.GRID_HEIGHT - 1, centerY));
        const isOddRow = estimatedY % 2 === 1;
        const xOffset = isOddRow ? CONFIG.HEX_WIDTH / 2 : 0;
        const centerX = Math.round((position.x + CONFIG.GRID_WIDTH / 2 * CONFIG.HEX_WIDTH - 0.5 * CONFIG.HEX_WIDTH - xOffset) / CONFIG.HEX_WIDTH);
        const estimatedX = Math.max(0, Math.min(CONFIG.GRID_WIDTH - 1, centerX));
        
        let bestDistance = Infinity;
        let bestX = -1;
        let bestY = -1;
        let fallbackX = -1;
        let fallbackY = -1;
        let fallbackDistance = Infinity;
        
        // Search in expanding rings around the estimated position
        const maxRadius = Math.max(CONFIG.GRID_WIDTH, CONFIG.GRID_HEIGHT);
        
        for (let radius = 0; radius < maxRadius; radius++) {
            // For radius 0, just check the center position
            const positions = radius === 0 ? [[estimatedX, estimatedY]] : this.getPositionsAtRadius(estimatedX, estimatedY, radius);
            
            for (let [x, y] of positions) {
                // Skip if out of bounds
                if (y < 0 || y >= CONFIG.GRID_HEIGHT) continue;
                const isOddRowCheck = y % 2 === 1;
                const bubblesInRow = isOddRowCheck ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
                if (x < 0 || x >= bubblesInRow) continue;
                
                // Skip if position is occupied
                if (this.gameState.bubbleGrid[y][x]) continue;
                
                // Calculate world position for this grid cell
                const xPos = (x - CONFIG.GRID_WIDTH / 2 + 0.5) * CONFIG.HEX_WIDTH + (isOddRowCheck ? CONFIG.HEX_WIDTH / 2 : 0);
                const yPos = CONFIG.GRID_TOP_Y - y * CONFIG.HEX_HEIGHT;
                
                const distance = Math.sqrt(
                    Math.pow(position.x - xPos, 2) + 
                    Math.pow(position.y - yPos, 2)
                );
                
                // Track closest empty position as fallback
                if (distance < fallbackDistance) {
                    fallbackDistance = distance;
                    fallbackX = x;
                    fallbackY = y;
                }
                
                // Check if this position has adjacent bubbles
                let hasAdjacent = false;
                const neighbors = this.getNeighbors(x, y);
                for (let neighbor of neighbors) {
                    if (neighbor) {
                        hasAdjacent = true;
                        break;
                    }
                }
                
                // For top row, always allow attachment
                if (y === 0) hasAdjacent = true;
                
                if (hasAdjacent && distance < bestDistance) {
                    bestDistance = distance;
                    bestX = x;
                    bestY = y;
                    
                    // Early exit if we found a good position close to the bubble
                    if (distance < CONFIG.HEX_WIDTH) {
                        return { x: bestX, y: bestY };
                    }
                }
            }
            
            // If we found a valid position, we can stop searching
            if (bestX !== -1) break;
        }
        
        // Use best position if found, otherwise use fallback
        let finalX = bestX;
        let finalY = bestY;
        
        if (finalX === -1) {
            // No valid position with neighbors found, use closest empty position
            finalX = fallbackX;
            finalY = fallbackY;
        }
        
        if (finalX !== -1 && finalY !== -1) {
            return { x: finalX, y: finalY };
        }
        
        return null;
    }
    
    /**
     * Get all positions at a given radius from center point
     * @param {number} centerX - Center x coordinate
     * @param {number} centerY - Center y coordinate
     * @param {number} radius - Search radius
     * @returns {Array} Array of [x, y] positions
     */
    getPositionsAtRadius(centerX, centerY, radius) {
        const positions = [];
        
        // Generate positions in a square pattern at the given radius
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                // Only include positions that are exactly at the radius distance (Manhattan distance)
                if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                    positions.push([centerX + dx, centerY + dy]);
                }
            }
        }
        
        return positions;
    }
    
    /**
     * Get neighboring bubbles for a grid position
     * @param {number} x - Grid x coordinate
     * @param {number} y - Grid y coordinate
     * @returns {Array} Array of neighboring bubbles
     */
    getNeighbors(x, y) {
        const neighbors = [];
        const isOddRow = y % 2 === 1;
        
        // Hexagonal grid neighbors
        const directions = isOddRow ? [
            [-1, 0], [1, 0],   // Left, Right
            [0, -1], [1, -1],  // Top-left, Top-right (for odd rows)
            [0, 1], [1, 1]     // Bottom-left, Bottom-right (for odd rows)
        ] : [
            [-1, 0], [1, 0],   // Left, Right
            [-1, -1], [0, -1], // Top-left, Top-right (for even rows)
            [-1, 1], [0, 1]    // Bottom-left, Bottom-right (for even rows)
        ];
        
        directions.forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            
            if (ny >= 0 && ny < CONFIG.GRID_HEIGHT) {
                const isNeighborOddRow = ny % 2 === 1;
                const maxX = isNeighborOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
                
                if (nx >= 0 && nx < maxX && this.gameState.bubbleGrid[ny][nx]) {
                    neighbors.push(this.gameState.bubbleGrid[ny][nx]);
                }
            }
        });
        
        return neighbors;
    }
    
    /**
     * Create attachment effect
     * @param {Bubble} bubble - The attached bubble
     */
    createAttachmentEffect(bubble) {
        this.gameManager.playSound('bubbleAttach');
        
        // Calculate impact force based on bubble velocity
        const impactForce = bubble.velocity.length() * CONFIG.IMPACT_PHYSICS.ATTACHMENT_FORCE;
        const impactDirection = bubble.velocity.normalize();
        
        // Apply instant impact to the attached bubble
        bubble.impactVelocity.add(impactDirection.clone().multiplyScalar(impactForce));
        bubble.connectionAnimating = CONFIG.IMPACT_PHYSICS.CONNECTION_ANIMATION;
        
        // Create ripple effect through ALL neighboring bubbles immediately
        this.propagateImpact(bubble, impactDirection, impactForce, 0);
        
        // Create attachment particles
        for (let i = 0; i < 15; i++) {
            const particle = this.gameState.particlePool.spawn(
                bubble.position.x,
                bubble.position.y,
                bubble.position.z,
                0xffffff,
                0.15,
                new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 3
                )
            );
        }
    }
    
    /**
     * Propagate impact through bubble grid
     * @param {Bubble} centerBubble - The center of impact
     * @param {THREE.Vector3} impactDirection - Direction of impact
     * @param {number} force - Impact force
     * @param {number} depth - Current propagation depth
     */
    propagateImpact(centerBubble, impactDirection, force, depth) {
        if (depth > CONFIG.IMPACT_PHYSICS.MAX_DEPTH || force < CONFIG.IMPACT_PHYSICS.MIN_FORCE) return;
        
        // Get all neighbors
        const neighbors = this.getNeighbors(centerBubble.gridX, centerBubble.gridY);
        
        // Process ALL neighbors simultaneously for each depth level
        const impactedNeighbors = [];
        
        neighbors.forEach((neighbor) => {
            if (neighbor) {
                // Calculate direction from center to neighbor
                const toNeighbor = new THREE.Vector3()
                    .subVectors(neighbor.position, centerBubble.position)
                    .normalize();
                
                // Less angle dependency for wider impact
                const dotProduct = Math.max(CONFIG.IMPACT_PHYSICS.ANGLE_FACTOR, impactDirection.dot(toNeighbor));
                const falloff = Math.pow(CONFIG.IMPACT_PHYSICS.FALLOFF_RATE, depth);
                const neighborForce = force * (0.7 + dotProduct * 0.3) * falloff;
                
                // Store for batch processing
                impactedNeighbors.push({ bubble: neighbor, direction: toNeighbor, force: neighborForce });
            }
        });
        
        // Apply forces to all neighbors at once with minimal delay
        setTimeout(() => {
            impactedNeighbors.forEach(({ bubble, direction, force }) => {
                // Add impact velocity to neighbor
                bubble.impactVelocity.add(direction.multiplyScalar(force * CONFIG.IMPACT_PHYSICS.NEIGHBOR_FORCE));
                bubble.connectionAnimating = Math.max(bubble.connectionAnimating, CONFIG.IMPACT_PHYSICS.CONNECTION_ANIMATION - depth * 0.2);
            });
            
            // Continue propagation to next level
            if (depth < CONFIG.IMPACT_PHYSICS.MAX_DEPTH) {
                impactedNeighbors.forEach(({ bubble, direction, force }) => {
                    this.propagateImpact(bubble, direction, force, depth + 1);
                });
            }
        }, depth * CONFIG.IMPACT_PHYSICS.PROPAGATION_DELAY);
    }
}