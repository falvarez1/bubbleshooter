import { CONFIG } from '../core/Config.js';

/**
 * Smart Color Selection System
 * Analyzes accessible bubbles and intelligently selects shooting bubble colors
 * to match difficulty level - easier levels give more helpful colors
 */
export class SmartColorSelectionSystem {
    constructor(gameState, eventBus) {
        this.gameState = gameState;
        this.eventBus = eventBus;
        
        // Configuration for smart color selection
        this.config = {
            // Helper probability by level phase
            helperProbability: {
                learning: 0.7,     // 70% chance of helpful color in learning phase
                mastery: 0.4,      // 40% chance in mastery phase  
                excellence: 0.2    // 20% chance in excellence phase
            },
            
            // Edge analysis configuration
            edgeDepth: 3,          // How many rows from bottom to prioritize
            edgeWeight: 2.0,       // Weight multiplier for edge bubbles
            centerWeight: 0.5,     // Weight multiplier for center bubbles
            
            // Accessibility scoring
            directAccessWeight: 3.0,    // Bubbles directly reachable
            oneHopAccessWeight: 1.5,    // Bubbles reachable with one bounce
            twoHopAccessWeight: 0.8,    // Bubbles reachable with two bounces
            
            // Smart selection modes
            mode: 'adaptive',      // 'adaptive', 'random', 'helpful', 'challenging'
            
            // Statistics tracking
            stats: {
                totalSelections: 0,
                helpfulSelections: 0,
                randomSelections: 0,
                averageAccessibility: 0
            }
        };
        
        // Cache for performance
        this.accessibilityCache = new Map();
        this.lastAnalysisTime = 0;
        this.analysisInterval = 500; // Recalculate every 500ms
        
        // Subscribe to events
        this.subscribeToEvents();
    }
    
    subscribeToEvents() {
        // Update mode based on level changes
        this.eventBus.on('levelUp', (data) => {
            this.updateDifficultyMode(data.level);
        });
        
        // Clear cache when bubbles are destroyed
        this.eventBus.on('bubblesDestroyed', () => {
            this.clearAccessibilityCache();
        });
        
        // Clear cache when new row is added
        this.eventBus.on('rowPushComplete', () => {
            this.clearAccessibilityCache();
        });
    }
    
    /**
     * Get the next bubble color based on smart selection
     * @returns {number} The selected color
     */
    getNextBubbleColor() {
        const now = Date.now();
        
        // Analyze board if cache is stale
        if (now - this.lastAnalysisTime > this.analysisInterval) {
            this.analyzeAccessibility();
            this.lastAnalysisTime = now;
        }
        
        // Determine if we should be helpful based on difficulty
        const shouldBeHelpful = this.shouldProvideHelpfulColor();
        
        if (shouldBeHelpful) {
            return this.selectHelpfulColor();
        } else {
            return this.selectChallengeColor();
        }
    }
    
    /**
     * Analyze which bubbles are most accessible from the shooting position
     */
    analyzeAccessibility() {
        this.accessibilityCache.clear();
        const colorScores = new Map();
        
        // Get all bubbles in the grid
        const bubbles = this.gameState.getAllBubbles();
        
        for (const bubble of bubbles) {
            if (!bubble || bubble.isDestroyed) continue;
            
            // Calculate accessibility score for this bubble
            const score = this.calculateAccessibilityScore(bubble);
            
            // Add to color scores
            const currentScore = colorScores.get(bubble.color) || 0;
            colorScores.set(bubble.color, currentScore + score);
            
            // Cache the score
            this.accessibilityCache.set(`${bubble.gridX},${bubble.gridY}`, score);
        }
        
        // Normalize scores and store
        this.normalizeColorScores(colorScores);
        this.colorAccessibilityScores = colorScores;
        
        // Update statistics
        this.updateStatistics(colorScores);
    }
    
    /**
     * Calculate how accessible a bubble is from the shooting position
     * @param {Bubble} bubble - The bubble to analyze
     * @returns {number} Accessibility score (higher = more accessible)
     */
    calculateAccessibilityScore(bubble) {
        let score = 1.0;
        
        // 1. Distance from bottom (closer to shooter = more accessible)
        const distanceFromBottom = CONFIG.GRID_HEIGHT - bubble.gridY;
        const distanceScore = Math.max(0, 1 - (distanceFromBottom / CONFIG.GRID_HEIGHT));
        score *= (1 + distanceScore);
        
        // 2. Edge proximity (edges are easier to hit directly)
        const isEdge = bubble.gridX === 0 || bubble.gridX === CONFIG.GRID_WIDTH - 1;
        const edgeBonus = isEdge ? this.config.edgeWeight : 1.0;
        score *= edgeBonus;
        
        // 3. Bottom rows get extra weight (most accessible)
        if (bubble.gridY >= CONFIG.GRID_HEIGHT - this.config.edgeDepth) {
            score *= 2.0;
        }
        
        // 4. Check if bubble has exposed faces (not completely surrounded)
        const exposedFaces = this.countExposedFaces(bubble);
        score *= (1 + exposedFaces * 0.3);
        
        // 5. Direct line of sight bonus
        if (this.hasDirectLineOfSight(bubble)) {
            score *= this.config.directAccessWeight;
        }
        
        // 6. Cluster size bonus (larger clusters are better targets)
        const clusterSize = this.getClusterSize(bubble);
        if (clusterSize >= 2) {
            score *= (1 + clusterSize * 0.2);
        }
        
        return score;
    }
    
    /**
     * Count how many faces of the bubble are exposed (not blocked by neighbors)
     */
    countExposedFaces(bubble) {
        let exposed = 0;
        const neighbors = this.getNeighborPositions(bubble.gridX, bubble.gridY);
        
        for (const [nx, ny] of neighbors) {
            const neighbor = this.gameState.getBubbleAt(nx, ny);
            if (!neighbor || neighbor.isDestroyed) {
                exposed++;
            }
        }
        
        return exposed;
    }
    
    /**
     * Check if bubble has direct line of sight from shooter
     */
    hasDirectLineOfSight(bubble) {
        // Simplified check - bubbles in bottom 3 rows with exposed bottom face
        if (bubble.gridY < CONFIG.GRID_HEIGHT - 3) return false;
        
        // Check if there's a clear path (no bubbles directly below)
        for (let y = bubble.gridY + 1; y < CONFIG.GRID_HEIGHT; y++) {
            const below = this.gameState.getBubbleAt(bubble.gridX, y);
            if (below && !below.isDestroyed) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get the size of the color cluster this bubble belongs to
     */
    getClusterSize(bubble) {
        const visited = new Set();
        const toCheck = [bubble];
        let count = 0;
        
        while (toCheck.length > 0 && count < 10) { // Limit to prevent large searches
            const current = toCheck.pop();
            const key = `${current.gridX},${current.gridY}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            count++;
            
            // Add same-color neighbors
            const neighbors = this.getNeighborPositions(current.gridX, current.gridY);
            for (const [nx, ny] of neighbors) {
                const neighbor = this.gameState.getBubbleAt(nx, ny);
                if (neighbor && !neighbor.isDestroyed && neighbor.color === bubble.color) {
                    const nKey = `${nx},${ny}`;
                    if (!visited.has(nKey)) {
                        toCheck.push(neighbor);
                    }
                }
            }
        }
        
        return count;
    }
    
    /**
     * Get neighboring grid positions
     */
    getNeighborPositions(x, y) {
        const neighbors = [];
        const offset = y % 2 === 0 ? -1 : 0;
        
        // Six directions in hexagonal grid
        const directions = [
            [x - 1, y],           // Left
            [x + 1, y],           // Right
            [x + offset, y - 1],  // Top-left
            [x + offset + 1, y - 1], // Top-right
            [x + offset, y + 1],  // Bottom-left
            [x + offset + 1, y + 1]  // Bottom-right
        ];
        
        for (const [nx, ny] of directions) {
            if (nx >= 0 && nx < CONFIG.GRID_WIDTH && ny >= 0 && ny < CONFIG.GRID_HEIGHT) {
                neighbors.push([nx, ny]);
            }
        }
        
        return neighbors;
    }
    
    /**
     * Normalize color scores to probabilities
     */
    normalizeColorScores(colorScores) {
        let total = 0;
        for (const score of colorScores.values()) {
            total += score;
        }
        
        if (total > 0) {
            for (const [color, score] of colorScores.entries()) {
                colorScores.set(color, score / total);
            }
        }
    }
    
    /**
     * Determine if we should provide a helpful color based on difficulty
     */
    shouldProvideHelpfulColor() {
        const level = this.gameState.level;
        let helperChance;
        
        // Determine phase and helper probability
        if (level <= 5) {
            helperChance = this.config.helperProbability.learning;
        } else if (level <= 15) {
            helperChance = this.config.helperProbability.mastery;
        } else {
            helperChance = this.config.helperProbability.excellence;
        }
        
        // Apply adaptive difficulty modifiers
        if (this.gameState.dangerZone && this.gameState.dangerZone.level > 0) {
            // Increase helper chance when in danger
            helperChance = Math.min(1.0, helperChance + 0.2);
        }
        
        return Math.random() < helperChance;
    }
    
    /**
     * Select a helpful color that matches accessible bubbles
     */
    selectHelpfulColor() {
        if (!this.colorAccessibilityScores || this.colorAccessibilityScores.size === 0) {
            return this.selectRandomColor();
        }
        
        // Create weighted selection based on accessibility scores
        const colors = [];
        const weights = [];
        
        for (const [color, score] of this.colorAccessibilityScores.entries()) {
            colors.push(color);
            // Square the score to make highly accessible colors even more likely
            weights.push(score * score);
        }
        
        // Weighted random selection
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < colors.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                this.config.stats.helpfulSelections++;
                console.log(`Selected helpful color: ${colors[i]} (accessibility: ${(weights[i] * 100).toFixed(1)}%)`);
                return colors[i];
            }
        }
        
        // Fallback
        return colors[0];
    }
    
    /**
     * Select a challenging color (less likely to match)
     */
    selectChallengeColor() {
        if (!this.colorAccessibilityScores || this.colorAccessibilityScores.size === 0) {
            return this.selectRandomColor();
        }
        
        // Invert weights to prefer less accessible colors
        const colors = [];
        const weights = [];
        
        for (const [color, score] of this.colorAccessibilityScores.entries()) {
            colors.push(color);
            // Invert score (1 - score) and add minimum weight
            weights.push(Math.max(0.1, 1 - score));
        }
        
        // Weighted random selection
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < colors.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return colors[i];
            }
        }
        
        return colors[0];
    }
    
    /**
     * Select a random color from available colors
     */
    selectRandomColor() {
        const availableColors = CONFIG.BUBBLE_COLORS || [0xFF6B6B, 0x4ECDC4, 0x45B7D1, 0xFECA57, 0x6C5CE7, 0xA8E6CF];
        const colorCount = Math.min(
            availableColors.length,
            4 + Math.floor((this.gameState.level - 1) * 0.33)
        );
        
        const activeColors = availableColors.slice(0, colorCount);
        this.config.stats.randomSelections++;
        return activeColors[Math.floor(Math.random() * activeColors.length)];
    }
    
    /**
     * Update difficulty mode based on level
     */
    updateDifficultyMode(level) {
        if (level <= 5) {
            this.config.mode = 'helpful';
            console.log('Smart color selection: Helpful mode (70% helper chance)');
        } else if (level <= 15) {
            this.config.mode = 'adaptive';
            console.log('Smart color selection: Adaptive mode (40% helper chance)');
        } else {
            this.config.mode = 'challenging';
            console.log('Smart color selection: Challenging mode (20% helper chance)');
        }
    }
    
    /**
     * Clear the accessibility cache
     */
    clearAccessibilityCache() {
        this.accessibilityCache.clear();
        this.lastAnalysisTime = 0;
    }
    
    /**
     * Update statistics
     */
    updateStatistics(colorScores) {
        this.config.stats.totalSelections++;
        
        // Calculate average accessibility
        let total = 0;
        let count = 0;
        for (const score of colorScores.values()) {
            total += score;
            count++;
        }
        
        if (count > 0) {
            this.config.stats.averageAccessibility = total / count;
        }
    }
    
    /**
     * Get current statistics
     */
    getStatistics() {
        const stats = this.config.stats;
        return {
            ...stats,
            helpfulPercentage: stats.totalSelections > 0 
                ? (stats.helpfulSelections / stats.totalSelections * 100).toFixed(1)
                : 0,
            mode: this.config.mode,
            currentHelperChance: this.shouldProvideHelpfulColor() ? 
                this.getCurrentHelperProbability() * 100 : 0
        };
    }
    
    getCurrentHelperProbability() {
        const level = this.gameState.level;
        if (level <= 5) return this.config.helperProbability.learning;
        if (level <= 15) return this.config.helperProbability.mastery;
        return this.config.helperProbability.excellence;
    }
}