import { CONFIG } from '../core/Config.js';

/**
 * BubbleLifecycleManager
 * Ensures atomic operations for bubble lifecycle management
 * Prevents ghost bubbles through transactional state changes
 */
export class BubbleLifecycleManager {
    /**
     * Atomically destroy a bubble across all systems
     * @param {Bubble} bubble - The bubble to destroy
     * @param {Object} systems - Object containing gameState, bubbleInstances, collisionSystem
     * @returns {Object} Transaction result with success status and details
     */
    static destroyBubble(bubble, systems) {
        const { gameState, bubbleInstances, collisionSystem } = systems;
        
        // Create transaction record
        const transaction = {
            bubbleId: bubble.id,
            gridPosition: { x: bubble.gridX, y: bubble.gridY },
            instanceMapping: null,
            startTime: performance.now(),
            completed: false,
            errors: []
        };
        
        // Early return if already destroyed
        if (bubble.isDestroyed) {
            console.warn(`Bubble ${bubble.id} already destroyed, skipping`);
            transaction.completed = true;
            return transaction;
        }
        
        try {
            // Get instance mapping before any modifications
            if (bubbleInstances) {
                transaction.instanceMapping = bubbleInstances.getBubbleMapping(bubble);
            }
            
            // Step 1: Mark as destroyed FIRST (prevents any new operations)
            bubble.isDestroyed = true;
            
            // Step 2: Remove from all systems atomically
            const removalResults = {
                visual: false,
                grid: false,
                collision: false
            };
            
            // Remove from visual representation
            if (bubble.useInstancedRendering && bubbleInstances) {
                try {
                    removalResults.visual = bubbleInstances.removeBubble(bubble);
                    if (!removalResults.visual) {
                        transaction.errors.push('Failed to remove from visual system');
                    }
                } catch (error) {
                    transaction.errors.push(`Visual removal error: ${error.message}`);
                }
            } else {
                // Non-instanced bubbles don't need visual removal here
                removalResults.visual = true;
            }
            
            // Remove from grid state
            if (gameState && bubble.gridX !== undefined && bubble.gridY !== undefined) {
                try {
                    gameState.removeBubbleAt(bubble.gridX, bubble.gridY);
                    // Verify removal
                    const stillInGrid = gameState.getBubbleAt(bubble.gridX, bubble.gridY) === bubble;
                    removalResults.grid = !stillInGrid;
                    
                    if (stillInGrid) {
                        // Force removal if still present
                        if (gameState.bubbleGrid[bubble.gridY]) {
                            gameState.bubbleGrid[bubble.gridY][bubble.gridX] = null;
                            console.warn(`Forced removal from grid at ${bubble.gridX},${bubble.gridY}`);
                        }
                        removalResults.grid = true;
                    }
                } catch (error) {
                    transaction.errors.push(`Grid removal error: ${error.message}`);
                }
            } else {
                removalResults.grid = true; // Not in grid, consider successful
            }
            
            // Remove from collision system
            if (collisionSystem && collisionSystem.spatialGrid) {
                try {
                    collisionSystem.spatialGrid.remove(bubble);
                    collisionSystem.lastCacheUpdate = 0; // Force cache update
                    removalResults.collision = true;
                } catch (error) {
                    transaction.errors.push(`Collision removal error: ${error.message}`);
                    removalResults.collision = true; // Don't fail on collision system errors
                }
            } else {
                removalResults.collision = true;
            }
            
            // Step 3: Verify all removals succeeded
            const allSuccessful = removalResults.visual && removalResults.grid && removalResults.collision;
            
            if (!allSuccessful) {
                console.error('Bubble removal not fully atomic:', {
                    bubbleId: bubble.id,
                    results: removalResults,
                    errors: transaction.errors
                });
                // Force cleanup even on partial failure
                this.forceCleanup(bubble, systems, transaction);
            }
            
            // Step 4: Scan entire grid for any ghost references (defensive)
            if (gameState) {
                this.scanAndCleanGhostReferences(bubble, gameState);
            }
            
            transaction.completed = true;
            transaction.duration = performance.now() - transaction.startTime;
            
        } catch (error) {
            console.error('Critical error in bubble destruction:', error);
            transaction.errors.push(`Critical error: ${error.message}`);
            // Attempt force cleanup on any error
            this.forceCleanup(bubble, systems, transaction);
            transaction.completed = false;
        }
        
        return transaction;
    }
    
    /**
     * Force cleanup of a bubble when normal removal fails
     * @private
     */
    static forceCleanup(bubble, systems, transaction) {
        const { gameState, bubbleInstances, collisionSystem } = systems;
        
        console.warn(`Force cleanup initiated for bubble ${bubble.id}`);
        
        // Ensure bubble is marked as destroyed
        bubble.isDestroyed = true;
        
        // Force removal from grid
        if (gameState && transaction.gridPosition) {
            const { x, y } = transaction.gridPosition;
            if (gameState.bubbleGrid[y]) {
                gameState.bubbleGrid[y][x] = null;
            }
        }
        
        // Force hide visual instance
        if (bubbleInstances && transaction.instanceMapping) {
            try {
                // Hide the instance by setting scale to 0
                const matrix = bubbleInstances.instancedMesh.instanceMatrix;
                const index = transaction.instanceMapping.index;
                if (index !== undefined && index >= 0) {
                    // Set scale to 0 to hide
                    matrix.array[index * 16 + 0] = 0;
                    matrix.array[index * 16 + 5] = 0;
                    matrix.array[index * 16 + 10] = 0;
                    matrix.needsUpdate = true;
                    
                    // Also update glow mesh if present
                    if (bubbleInstances.glowMesh) {
                        const glowMatrix = bubbleInstances.glowMesh.instanceMatrix;
                        glowMatrix.array[index * 16 + 0] = 0;
                        glowMatrix.array[index * 16 + 5] = 0;
                        glowMatrix.array[index * 16 + 10] = 0;
                        glowMatrix.needsUpdate = true;
                    }
                }
            } catch (error) {
                console.error('Failed to hide instance during force cleanup:', error);
            }
        }
        
        // Force removal from collision system
        if (collisionSystem && collisionSystem.spatialGrid) {
            try {
                collisionSystem.spatialGrid.remove(bubble);
            } catch (error) {
                // Ignore collision system errors during force cleanup
            }
        }
    }
    
    /**
     * Scan entire grid for ghost references and clean them
     * @private
     */
    static scanAndCleanGhostReferences(bubble, gameState) {
        let ghostsFound = 0;
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                if (gameState.bubbleGrid[y][x] === bubble) {
                    gameState.bubbleGrid[y][x] = null;
                    ghostsFound++;
                    console.warn(`Cleaned ghost bubble reference at ${x},${y}`);
                }
            }
        }
        
        if (ghostsFound > 1) {
            console.error(`Found ${ghostsFound} ghost references for bubble ${bubble.id}`);
        }
    }
    
    /**
     * Atomically add a bubble to all systems
     * @param {Bubble} bubble - The bubble to add
     * @param {Object} systems - Object containing gameState, bubbleInstances, collisionSystem
     * @param {number} gridX - Grid X position
     * @param {number} gridY - Grid Y position
     * @returns {boolean} Success status
     */
    static addBubble(bubble, systems, gridX, gridY) {
        const { gameState, bubbleInstances, collisionSystem } = systems;
        
        // Check if position is already occupied
        if (gameState) {
            const existing = gameState.getBubbleAt(gridX, gridY);
            if (existing && !existing.isDestroyed) {
                console.error(`Position ${gridX},${gridY} already occupied by bubble ${existing.id}`);
                return false;
            }
        }
        
        try {
            // Add to grid state
            if (gameState) {
                gameState.setBubbleAt(gridX, gridY, bubble);
            }
            
            // Add to visual system
            if (bubble.useInstancedRendering && bubbleInstances) {
                bubbleInstances.addBubble(bubble, 'grid');
            }
            
            // Add to collision system
            if (collisionSystem && collisionSystem.spatialGrid) {
                collisionSystem.spatialGrid.add(bubble, bubble.position.x, bubble.position.y);
                collisionSystem.lastCacheUpdate = 0; // Force cache update
            }
            
            return true;
            
        } catch (error) {
            console.error('Failed to add bubble atomically:', error);
            // Attempt rollback
            this.rollbackAdd(bubble, systems, gridX, gridY);
            return false;
        }
    }
    
    /**
     * Rollback a failed add operation
     * @private
     */
    static rollbackAdd(bubble, systems, gridX, gridY) {
        const { gameState, bubbleInstances, collisionSystem } = systems;
        
        console.warn(`Rolling back add operation for bubble ${bubble.id}`);
        
        // Remove from grid
        if (gameState && gameState.getBubbleAt(gridX, gridY) === bubble) {
            gameState.bubbleGrid[gridY][gridX] = null;
        }
        
        // Remove from visual
        if (bubbleInstances) {
            try {
                bubbleInstances.removeBubble(bubble);
            } catch (error) {
                // Ignore errors during rollback
            }
        }
        
        // Remove from collision
        if (collisionSystem && collisionSystem.spatialGrid) {
            try {
                collisionSystem.spatialGrid.remove(bubble);
            } catch (error) {
                // Ignore errors during rollback
            }
        }
    }
    
    /**
     * Validate bubble consistency across all systems
     * @param {Bubble} bubble - The bubble to validate
     * @param {Object} systems - Object containing gameState, bubbleInstances, collisionSystem
     * @returns {Array} Array of validation issues found
     */
    static validateBubble(bubble, systems) {
        const { gameState, bubbleInstances, collisionSystem } = systems;
        const issues = [];
        
        if (bubble.isDestroyed) {
            // Check bubble shouldn't exist anywhere
            if (gameState) {
                const gridBubble = gameState.getBubbleAt(bubble.gridX, bubble.gridY);
                if (gridBubble === bubble) {
                    issues.push(`Destroyed bubble still in grid at ${bubble.gridX},${bubble.gridY}`);
                }
            }
            
            if (bubbleInstances && bubbleInstances.hasInstance(bubble.id)) {
                issues.push(`Destroyed bubble still has visual instance`);
            }
        } else {
            // Check bubble exists where it should
            if (gameState && bubble.gridX !== undefined && bubble.gridY !== undefined) {
                const gridBubble = gameState.getBubbleAt(bubble.gridX, bubble.gridY);
                if (gridBubble !== bubble) {
                    issues.push(`Bubble not found at expected grid position ${bubble.gridX},${bubble.gridY}`);
                }
            }
            
            if (bubble.useInstancedRendering && bubbleInstances) {
                if (!bubbleInstances.hasInstance(bubble.id)) {
                    issues.push(`Bubble missing visual instance`);
                }
            }
        }
        
        return issues;
    }
}