import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';
import { SIMDUtils } from '../math/SIMDUtils.js';
import { SpatialGrid } from '../math/SpatialGrid.js';

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
        
        // Spatial grid for broad-phase collision detection
        // Use cell size slightly larger than bubble diameter for optimal performance
        this.spatialGrid = new SpatialGrid(
            CONFIG.BUBBLE_RADIUS * 2.5,  // Cell size
            CONFIG.HEX_WIDTH * CONFIG.GRID_WIDTH * 2,  // World width
            CONFIG.HEX_HEIGHT * CONFIG.GRID_HEIGHT * 2  // World height
        );
        
        // SIMD optimization buffers
        this.gridBubbleCache = [];
        this.positionBuffer = null;
        this.distanceBuffer = null;
        this.bufferSize = 0;
        this.lastCacheUpdate = 0;
        this.cacheUpdateInterval = 100; // Update cache every 100ms
    }
    
    /**
     * Update grid bubble cache for SIMD operations
     */
    updateGridBubbleCache() {
        const now = Date.now();
        if (now - this.lastCacheUpdate < this.cacheUpdateInterval) {
            return;
        }
        this.lastCacheUpdate = now;
        
        // Clear spatial grid
        this.spatialGrid.clear();
        
        // Collect all active grid bubbles
        this.gridBubbleCache = [];
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            const isOddRow = y % 2 === 1;
            const bubblesInRow = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                const bubble = this.gameState.bubbleGrid[y][x];
                if (bubble && !bubble.isDestroyed && !bubble.isFloating) {
                    // Robust validation to prevent ghost bubbles
                    const isValid = bubble.gridX === x && 
                                  bubble.gridY === y && 
                                  bubble.position && 
                                  !bubble.pendingRemoval &&
                                  !bubble.isMoving;
                    
                    if (isValid) {
                        // Include bubble regardless of mesh parent (for instanced rendering)
                        this.gridBubbleCache.push(bubble);
                        
                        // Add to spatial grid for efficient collision detection
                        this.spatialGrid.add(bubble, bubble.position.x, bubble.position.y);
                    } else {
                        // Found a ghost bubble - clean it up
                        // Silent cleanup - no console warning in production
                        this.gameState.bubbleGrid[y][x] = null;
                        if (bubble) {
                            bubble.pendingRemoval = true;
                        }
                    }
                }
            }
        }
        
        // Reallocate buffers if size changed
        const newSize = this.gridBubbleCache.length;
        if (newSize !== this.bufferSize) {
            this.bufferSize = newSize;
            this.positionBuffer = new Float32Array(newSize * 3);
            this.distanceBuffer = new Float32Array(newSize);
        }
        
        // Update position buffer
        for (let i = 0; i < this.gridBubbleCache.length; i++) {
            const bubble = this.gridBubbleCache[i];
            const offset = i * 3;
            this.positionBuffer[offset] = bubble.position.x;
            this.positionBuffer[offset + 1] = bubble.position.y;
            this.positionBuffer[offset + 2] = bubble.position.z;
        }
    }
    
    /**
     * Check collisions for the current shooting bubble
     * @returns {boolean} Whether a collision occurred
     */
    checkBubbleCollisions() {
        if (!this.gameState.currentBubble) return false;
        
        // Check if bubble needs attachment (even if not moving - ceiling collision case)
        if (this.gameState.currentBubble.needsAttachment) {
            this.gameState.currentBubble.needsAttachment = false;
            this.attachBubble(this.gameState.currentBubble);
            return true;
        }
        
        // Skip other collision checks if not moving
        if (!this.gameState.currentBubble.isMoving) return false;
        
        // Throttle collision checks to prevent performance spikes
        const now = Date.now();
        if (now - this.lastCollisionCheck < this.collisionCheckInterval) {
            return false;
        }
        this.lastCollisionCheck = now;
        
        const current = this.gameState.currentBubble;
        
        // Update grid bubble cache if needed
        this.updateGridBubbleCache();
        
        // Check for bubble collisions first (if there are any bubbles)
        if (this.gridBubbleCache.length > 0) {
            // Use spatial grid for broad-phase collision detection
            const threshold = CONFIG.BUBBLE_RADIUS * 1.95;
            const nearbyBubbles = this.spatialGrid.getNearby(
                current.position.x,
                current.position.y,
                threshold * 1.2  // Slightly larger radius for safety
            );
            
            // Check for collisions with nearby bubbles
            if (nearbyBubbles.length > 0) {
                // Use SIMD batch collision detection on nearby bubbles only
                const collisions = SIMDUtils.batchCollisionDetection(
                    [current],
                    nearbyBubbles,
                    threshold
                );
                
                // Process the first collision (closest)
                if (collisions.length > 0) {
                    // Find the closest collision
                    let closestCollision = collisions[0];
                    for (let i = 1; i < collisions.length; i++) {
                        if (collisions[i].distance < closestCollision.distance) {
                            closestCollision = collisions[i];
                        }
                    }
                    
                    const bubble = closestCollision.bubble2;
                    
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
        
        // No bubble collision, check if bubble reached the ceiling
        if (current.position.y > CONFIG.CEILING_Y - CONFIG.BUBBLE_RADIUS) {
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
            
            // Update mesh position only if not using instanced rendering
            if (!bubble.useInstancedRendering) {
                bubble.mesh.position.copy(bubble.position);
            }
            
            // Update base position for spring physics
            bubble.basePosition.copy(bubble.position);
            
            // Restore velocity for impact calculation
            bubble.velocity = attachmentVelocity;
            
            this.gameState.bubbleGrid[finalY][finalX] = bubble;
            
            // Bubble is now part of the grid
            bubble.isMoving = false;
            
            // Handle visibility based on rendering mode
            if (!bubble.useInstancedRendering) {
                // Ensure mesh is visible and in scene for individual meshes
                bubble.mesh.visible = true;
                bubble.mesh.scale.setScalar(1.0);
                
                // Make sure the mesh stays in the scene
                if (!bubble.mesh.parent) {
                    console.warn('Bubble mesh was not in scene, re-adding it');
                    if (this.gameManager.scene) {
                        this.gameManager.scene.add(bubble.mesh);
                    }
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
        // Calculate the row based on distance from top
        const centerY = Math.round((CONFIG.GRID_TOP_Y - position.y) / CONFIG.HEX_HEIGHT);
        const estimatedY = Math.max(0, Math.min(CONFIG.GRID_HEIGHT - 1, centerY));
        const isOddRow = estimatedY % 2 === 1;
        const xOffset = isOddRow ? CONFIG.HEX_WIDTH / 2 : 0;
        const centerX = Math.round((position.x + CONFIG.GRID_WIDTH / 2 * CONFIG.HEX_WIDTH - 0.5 * CONFIG.HEX_WIDTH - xOffset) / CONFIG.HEX_WIDTH);
        const estimatedX = Math.max(0, Math.min(CONFIG.GRID_WIDTH - 1, centerX));
        
        // Pre-calculate all possible positions and filter valid ones
        const candidatePositions = [];
        const worldPositions = new Float32Array(CONFIG.GRID_WIDTH * CONFIG.GRID_HEIGHT * 3);
        let positionCount = 0;
        
        // First pass: collect all empty positions
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            const isOddRowCheck = y % 2 === 1;
            const bubblesInRow = isOddRowCheck ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                const existingBubble = this.gameState.bubbleGrid[y][x];
                // Position is empty if there's no bubble OR if the bubble is destroyed
                if (!existingBubble || existingBubble.isDestroyed) {
                    // Clean up any destroyed bubbles we find
                    if (existingBubble && existingBubble.isDestroyed) {
                        console.warn(`Found destroyed bubble at ${x},${y} during position search - cleaning up`);
                        this.gameState.bubbleGrid[y][x] = null;
                    }
                    
                    // Calculate world position for this grid cell
                    const xPos = (x - CONFIG.GRID_WIDTH / 2 + 0.5) * CONFIG.HEX_WIDTH + (isOddRowCheck ? CONFIG.HEX_WIDTH / 2 : 0);
                    const yPos = CONFIG.GRID_TOP_Y - y * CONFIG.HEX_HEIGHT;
                    
                    worldPositions[positionCount * 3] = xPos;
                    worldPositions[positionCount * 3 + 1] = yPos;
                    worldPositions[positionCount * 3 + 2] = 0;
                    
                    candidatePositions.push({ x, y, index: positionCount });
                    positionCount++;
                }
            }
        }
        
        // If no empty positions found, the grid must be full
        if (positionCount === 0) {
            return null;
        }
        
        // Prepare target position array
        const targetPosition = new Float32Array(positionCount * 3);
        for (let i = 0; i < positionCount; i++) {
            targetPosition[i * 3] = position.x;
            targetPosition[i * 3 + 1] = position.y;
            targetPosition[i * 3 + 2] = 0;
        }
        
        // Batch distance calculation using SIMD
        const distances = new Float32Array(positionCount);
        SIMDUtils.batchDistance3D(
            worldPositions.subarray(0, positionCount * 3),
            targetPosition,
            distances
        );
        
        // Find best position with neighbors
        let bestDistance = Infinity;
        let bestX = -1;
        let bestY = -1;
        let fallbackDistance = Infinity;
        let fallbackX = -1;
        let fallbackY = -1;
        
        for (let i = 0; i < candidatePositions.length; i++) {
            const candidate = candidatePositions[i];
            const distance = distances[candidate.index];
            
            // Track closest empty position as fallback
            if (distance < fallbackDistance) {
                fallbackDistance = distance;
                fallbackX = candidate.x;
                fallbackY = candidate.y;
            }
            
            // Check if this position has adjacent bubbles
            // Top row is always valid for attachment (ceiling)
            let hasAdjacent = false;
            if (candidate.y === 0) {
                // Top row is always valid - it's attached to ceiling
                hasAdjacent = true;
            }
            
            if (!hasAdjacent) {
                const neighbors = this.getNeighbors(candidate.x, candidate.y);
                for (let neighbor of neighbors) {
                    if (neighbor) {
                        hasAdjacent = true;
                        break;
                    }
                }
            }
            
            if (hasAdjacent && distance < bestDistance) {
                bestDistance = distance;
                bestX = candidate.x;
                bestY = candidate.y;
                
                // Early exit if we found a good position close to the bubble
                if (distance < CONFIG.HEX_WIDTH) {
                    return { x: bestX, y: bestY };
                }
            }
        }
        
        // Use best position if found, otherwise use fallback
        let finalX = bestX !== -1 ? bestX : fallbackX;
        let finalY = bestY !== -1 ? bestY : fallbackY;
        
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