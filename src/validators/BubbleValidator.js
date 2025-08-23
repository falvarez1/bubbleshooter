import { CONFIG } from '../core/Config.js';

/**
 * BubbleValidator
 * Validates bubble state consistency across all systems
 * Detects and reports ghost bubbles and other inconsistencies
 */
export class BubbleValidator {
    /**
     * Validate all bubbles in the game
     * @param {Object} systems - Object containing gameState, bubbleInstances, collisionSystem
     * @returns {Object} Validation report with issues and statistics
     */
    static validateGame(systems) {
        const { gameState, bubbleInstances, collisionSystem } = systems;
        const report = {
            totalBubbles: 0,
            ghostBubbles: [],
            orphanedVisuals: [],
            missingVisuals: [],
            gridInconsistencies: [],
            collisionInconsistencies: [],
            timestamp: performance.now()
        };
        
        // Step 1: Check all grid positions
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = gameState.bubbleGrid[y][x];
                if (bubble) {
                    report.totalBubbles++;
                    
                    // Validate this bubble
                    const issues = this.validateBubble(bubble, systems);
                    
                    if (bubble.isDestroyed) {
                        report.ghostBubbles.push({
                            bubbleId: bubble.id,
                            position: { x, y },
                            issues: issues
                        });
                    } else if (issues.length > 0) {
                        report.gridInconsistencies.push({
                            bubbleId: bubble.id,
                            position: { x, y },
                            issues: issues
                        });
                    }
                }
            }
        }
        
        // Step 2: Check visual instances for orphans
        if (bubbleInstances && bubbleInstances.bubbleMap) {
            bubbleInstances.bubbleMap.forEach((mapping, bubbleId) => {
                const bubble = mapping.bubble;
                
                // Check if bubble exists in grid
                let foundInGrid = false;
                if (bubble && bubble.gridX !== undefined && bubble.gridY !== undefined) {
                    const gridBubble = gameState.getBubbleAt(bubble.gridX, bubble.gridY);
                    foundInGrid = (gridBubble === bubble);
                }
                
                if (!foundInGrid) {
                    report.orphanedVisuals.push({
                        bubbleId: bubbleId,
                        instanceIndex: mapping.index,
                        isDestroyed: bubble ? bubble.isDestroyed : 'unknown'
                    });
                }
            });
        }
        
        // Step 3: Check for missing visuals
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                const bubble = gameState.bubbleGrid[y][x];
                if (bubble && !bubble.isDestroyed && bubble.useInstancedRendering) {
                    if (bubbleInstances && !bubbleInstances.hasInstance(bubble.id)) {
                        report.missingVisuals.push({
                            bubbleId: bubble.id,
                            position: { x, y }
                        });
                    }
                }
            }
        }
        
        // Calculate summary
        report.hasIssues = report.ghostBubbles.length > 0 || 
                          report.orphanedVisuals.length > 0 || 
                          report.missingVisuals.length > 0 ||
                          report.gridInconsistencies.length > 0;
        
        report.issueCount = report.ghostBubbles.length + 
                           report.orphanedVisuals.length + 
                           report.missingVisuals.length +
                           report.gridInconsistencies.length;
        
        return report;
    }
    
    /**
     * Validate a single bubble's consistency
     * @param {Bubble} bubble - The bubble to validate
     * @param {Object} systems - Object containing gameState, bubbleInstances, collisionSystem
     * @returns {Array} Array of validation issues found
     */
    static validateBubble(bubble, systems) {
        const { gameState, bubbleInstances, collisionSystem } = systems;
        const issues = [];
        
        if (!bubble) {
            issues.push('Bubble is null or undefined');
            return issues;
        }
        
        if (bubble.isDestroyed) {
            // Destroyed bubbles should not exist anywhere
            
            // Check grid
            if (gameState && bubble.gridX !== undefined && bubble.gridY !== undefined) {
                const gridBubble = gameState.getBubbleAt(bubble.gridX, bubble.gridY);
                if (gridBubble === bubble) {
                    issues.push(`Destroyed bubble still in grid at ${bubble.gridX},${bubble.gridY}`);
                }
            }
            
            // Check visual
            if (bubbleInstances && bubbleInstances.hasInstance(bubble.id)) {
                issues.push('Destroyed bubble still has visual instance');
            }
            
            // Check collision system
            if (collisionSystem && collisionSystem.gridBubbleCache) {
                if (collisionSystem.gridBubbleCache.includes(bubble)) {
                    issues.push('Destroyed bubble still in collision cache');
                }
            }
        } else {
            // Active bubbles should exist in all relevant systems
            
            // Check grid position matches
            if (gameState && bubble.gridX !== undefined && bubble.gridY !== undefined) {
                const gridBubble = gameState.getBubbleAt(bubble.gridX, bubble.gridY);
                if (gridBubble !== bubble) {
                    if (gridBubble === null) {
                        issues.push(`Bubble not found at expected grid position ${bubble.gridX},${bubble.gridY}`);
                    } else {
                        issues.push(`Different bubble found at grid position ${bubble.gridX},${bubble.gridY}`);
                    }
                }
            }
            
            // Check visual exists for instanced bubbles
            if (bubble.useInstancedRendering && bubbleInstances) {
                if (!bubbleInstances.hasInstance(bubble.id)) {
                    issues.push('Instanced bubble missing visual instance');
                }
            }
        }
        
        return issues;
    }
    
    /**
     * Auto-fix detected issues (use with caution)
     * @param {Object} report - Validation report from validateGame
     * @param {Object} systems - Object containing gameState, bubbleInstances, collisionSystem
     * @returns {Object} Fix report with actions taken
     */
    static autoFix(report, systems) {
        const { gameState, bubbleInstances, collisionSystem } = systems;
        const fixReport = {
            ghostBubblesFixed: 0,
            orphanedVisualsFixed: 0,
            missingVisualsFixed: 0,
            timestamp: performance.now()
        };
        
        // Fix ghost bubbles
        report.ghostBubbles.forEach(ghost => {
            const { position } = ghost;
            if (gameState.bubbleGrid[position.y]) {
                gameState.bubbleGrid[position.y][position.x] = null;
                fixReport.ghostBubblesFixed++;
                console.warn(`Removed ghost bubble at ${position.x},${position.y}`);
            }
        });
        
        // Fix orphaned visuals
        report.orphanedVisuals.forEach(orphan => {
            if (bubbleInstances) {
                const mapping = bubbleInstances.getBubbleMapping({ id: orphan.bubbleId });
                if (mapping) {
                    // Hide the orphaned instance
                    const matrix = bubbleInstances.instancedMesh.instanceMatrix;
                    const index = mapping.index;
                    if (index !== undefined && index >= 0) {
                        // Set scale to 0 to hide
                        matrix.array[index * 16 + 0] = 0;
                        matrix.array[index * 16 + 5] = 0;
                        matrix.array[index * 16 + 10] = 0;
                        matrix.needsUpdate = true;
                        
                        // Remove from bubble map
                        bubbleInstances.bubbleMap.delete(orphan.bubbleId);
                        bubbleInstances.availableIndices.push(index);
                        
                        fixReport.orphanedVisualsFixed++;
                        console.warn(`Removed orphaned visual for bubble ${orphan.bubbleId}`);
                    }
                }
            }
        });
        
        // Force collision system cache update
        if (collisionSystem) {
            collisionSystem.lastCacheUpdate = 0;
        }
        
        return fixReport;
    }
    
    /**
     * Log validation report to console
     * @param {Object} report - Validation report from validateGame
     */
    static logReport(report) {
        if (!report.hasIssues) {
            console.log('✅ Bubble validation passed - no issues found');
            return;
        }
        
        console.group('⚠️ Bubble Validation Report');
        console.log(`Total bubbles: ${report.totalBubbles}`);
        console.log(`Total issues: ${report.issueCount}`);
        
        if (report.ghostBubbles.length > 0) {
            console.group(`Ghost Bubbles (${report.ghostBubbles.length})`);
            report.ghostBubbles.forEach(ghost => {
                console.error(`Ghost at ${ghost.position.x},${ghost.position.y}:`, ghost.issues);
            });
            console.groupEnd();
        }
        
        if (report.orphanedVisuals.length > 0) {
            console.group(`Orphaned Visuals (${report.orphanedVisuals.length})`);
            report.orphanedVisuals.forEach(orphan => {
                console.warn(`Orphan: Bubble ${orphan.bubbleId}, Instance ${orphan.instanceIndex}`);
            });
            console.groupEnd();
        }
        
        if (report.missingVisuals.length > 0) {
            console.group(`Missing Visuals (${report.missingVisuals.length})`);
            report.missingVisuals.forEach(missing => {
                console.warn(`Missing visual for bubble ${missing.bubbleId} at ${missing.position.x},${missing.position.y}`);
            });
            console.groupEnd();
        }
        
        if (report.gridInconsistencies.length > 0) {
            console.group(`Grid Inconsistencies (${report.gridInconsistencies.length})`);
            report.gridInconsistencies.forEach(inconsistency => {
                console.warn(`Inconsistency at ${inconsistency.position.x},${inconsistency.position.y}:`, inconsistency.issues);
            });
            console.groupEnd();
        }
        
        console.groupEnd();
    }
}