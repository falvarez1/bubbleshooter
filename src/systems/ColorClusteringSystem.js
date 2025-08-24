import { CONFIG } from '../core/Config.js';

/**
 * Color Clustering System
 * Manages intelligent bubble color placement for difficulty tuning
 */
export class ColorClusteringSystem {
    constructor(gameState, eventBus) {
        this.gameState = gameState;
        this.eventBus = eventBus;
        
        // Clustering configuration
        this.config = {
            baseClusterChance: 0.7,     // 70% chance at level 1
            currentClusterChance: 0.7,   // Current clustering probability
            minClusterChance: 0.1,       // Minimum 10% clustering
            decreasePerLevel: 0.06,      // 6% decrease per level
            
            // Color variety configuration
            minColors: 4,                // Minimum colors in play
            maxColors: 8,                // Maximum colors in play
            colorsPerLevel: 0.33,        // Add new color every 3 levels
            
            // Pattern generation
            patternTypes: ['cluster', 'stripe', 'checkerboard', 'random'],
            currentPattern: 'cluster',
            
            // Difficulty adjustments
            mercyMode: false,           // Activated after multiple failures
            mercyClusterBonus: 0.15,    // Extra clustering in mercy mode
        };
        
        // Color pool management
        this.activeColors = [];
        this.updateColorPool();
        
        // Subscribe to events
        this.subscribeToEvents();
    }
    
    subscribeToEvents() {
        // Update difficulty on level change
        this.eventBus.on('levelUp', (data) => {
            this.updateDifficultyForLevel(data.level);
        });
        
        // Generate new row when needed
        this.eventBus.on('generateNewRow', (data) => {
            this.generateNewRow(data.row || 0);
        });
        
        // Activate mercy mode after failures
        this.eventBus.on('gameOver', () => {
            this.activateMercyMode();
        });
        
        // Reset mercy mode on success
        this.eventBus.on('levelComplete', () => {
            this.deactivateMercyMode();
        });
    }
    
    updateDifficultyForLevel(level) {
        // Update clustering chance
        this.config.currentClusterChance = Math.max(
            this.config.minClusterChance,
            this.config.baseClusterChance - (level - 1) * this.config.decreasePerLevel
        );
        
        // Update color pool
        const colorCount = Math.min(
            this.config.maxColors,
            Math.floor(this.config.minColors + (level - 1) * this.config.colorsPerLevel)
        );
        
        this.updateColorPool(colorCount);
        
        // Select pattern type based on level
        if (level <= 5) {
            this.config.currentPattern = 'cluster';
        } else if (level <= 10) {
            this.config.currentPattern = Math.random() < 0.7 ? 'cluster' : 'stripe';
        } else {
            // Higher levels get more variety
            const patterns = ['cluster', 'stripe', 'checkerboard'];
            this.config.currentPattern = patterns[Math.floor(Math.random() * patterns.length)];
        }
        
        console.log(`Level ${level}: Clustering ${(this.config.currentClusterChance * 100).toFixed(0)}%, Colors: ${this.activeColors.length}, Pattern: ${this.config.currentPattern}`);
    }
    
    updateColorPool(count = null) {
        if (count === null) {
            count = this.config.minColors;
        }
        
        // Use the available bubble colors from config
        const allColors = CONFIG.BUBBLE_COLORS || [0xFF6B6B, 0x4ECDC4, 0x45B7D1, 0xFECA57, 0x6C5CE7, 0xA8E6CF];
        this.activeColors = allColors.slice(0, Math.min(count, allColors.length));
        
        console.log(`Active colors: ${this.activeColors.length}`);
    }
    
    generateNewRow(rowIndex = 0) {
        const row = [];
        const pattern = this.config.currentPattern;
        
        // Apply mercy mode bonus if active
        const clusterChance = this.config.mercyMode 
            ? Math.min(1.0, this.config.currentClusterChance + this.config.mercyClusterBonus)
            : this.config.currentClusterChance;
        
        // Generate bubbles based on pattern type
        switch (pattern) {
            case 'cluster':
                this.generateClusteredRow(row, rowIndex, clusterChance);
                break;
            case 'stripe':
                this.generateStripedRow(row, rowIndex);
                break;
            case 'checkerboard':
                this.generateCheckerboardRow(row, rowIndex);
                break;
            default:
                this.generateRandomRow(row);
        }
        
        // Place bubbles in grid
        this.placeBubblesInGrid(row, rowIndex);
        
        return row;
    }
    
    generateClusteredRow(row, rowIndex, clusterChance) {
        // Track recent colors for clustering
        let lastColor = null;
        let clusterSize = 0;
        const maxClusterSize = 3 + Math.floor(Math.random() * 2); // 3-4 bubbles per cluster
        
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
            let color;
            
            // Get neighbor colors for more intelligent clustering
            const neighbors = this.getNeighborColors(x, rowIndex);
            
            // Decide whether to continue cluster or start new one
            if (lastColor && clusterSize < maxClusterSize && Math.random() < clusterChance) {
                // Continue current cluster
                color = lastColor;
                clusterSize++;
            } else if (neighbors.length > 0 && Math.random() < clusterChance) {
                // Match a neighbor for better connectivity
                color = this.selectClusteredColor(neighbors, clusterChance);
                lastColor = color;
                clusterSize = 1;
            } else {
                // Start new cluster with random color
                color = this.selectRandomColor();
                lastColor = color;
                clusterSize = 1;
            }
            
            row.push(color);
        }
    }
    
    generateStripedRow(row, rowIndex) {
        // Create vertical stripes of colors
        const stripeWidth = 2 + Math.floor(Math.random() * 2); // 2-3 bubbles per stripe
        const stripeColors = this.shuffleArray([...this.activeColors]);
        
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
            const stripeIndex = Math.floor(x / stripeWidth) % stripeColors.length;
            row.push(stripeColors[stripeIndex]);
        }
    }
    
    generateCheckerboardRow(row, rowIndex) {
        // Create checkerboard pattern
        const colors = this.shuffleArray([...this.activeColors]).slice(0, 2);
        
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
            const colorIndex = (x + rowIndex) % 2;
            row.push(colors[colorIndex]);
        }
    }
    
    generateRandomRow(row) {
        // Pure random distribution
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
            row.push(this.selectRandomColor());
        }
    }
    
    getNeighborColors(x, y) {
        const neighbors = [];
        
        // Check left neighbor in same row
        if (x > 0 && y < this.gameState.bubbleGrid.length) {
            const leftBubble = this.gameState.getBubbleAt(x - 1, y);
            if (leftBubble && leftBubble.color !== undefined) {
                neighbors.push(leftBubble.color);
            }
        }
        
        // Check neighbors in row above (if exists)
        if (y > 0) {
            // Direct above
            const aboveBubble = this.gameState.getBubbleAt(x, y - 1);
            if (aboveBubble && aboveBubble.color !== undefined) {
                neighbors.push(aboveBubble.color);
            }
            
            // Diagonal neighbors (hexagonal offset)
            const offset = y % 2 === 0 ? -1 : 1;
            
            // Left diagonal
            if (x + offset >= 0) {
                const leftDiagonal = this.gameState.getBubbleAt(x + offset, y - 1);
                if (leftDiagonal && leftDiagonal.color !== undefined) {
                    neighbors.push(leftDiagonal.color);
                }
            }
            
            // Right diagonal
            if (x + offset + 1 < CONFIG.GRID_WIDTH) {
                const rightDiagonal = this.gameState.getBubbleAt(x + offset + 1, y - 1);
                if (rightDiagonal && rightDiagonal.color !== undefined) {
                    neighbors.push(rightDiagonal.color);
                }
            }
        }
        
        return neighbors;
    }
    
    selectClusteredColor(neighbors, clusterChance) {
        // Count frequency of each color in neighbors
        const colorCounts = {};
        neighbors.forEach(color => {
            colorCounts[color] = (colorCounts[color] || 0) + 1;
        });
        
        // Create weighted selection array
        const weighted = [];
        Object.entries(colorCounts).forEach(([color, count]) => {
            // More frequent colors get more weight
            const weight = count * count; // Quadratic weighting for stronger clustering
            for (let i = 0; i < weight; i++) {
                weighted.push(parseInt(color));
            }
        });
        
        // Add some randomness to avoid perfect patterns
        if (Math.random() > clusterChance || weighted.length === 0) {
            return this.selectRandomColor();
        }
        
        return weighted[Math.floor(Math.random() * weighted.length)];
    }
    
    selectRandomColor() {
        return this.activeColors[Math.floor(Math.random() * this.activeColors.length)];
    }
    
    selectRandomColorWithBias(avoidColors = []) {
        // Select a color with bias against recently used colors
        const availableColors = this.activeColors.filter(c => !avoidColors.includes(c));
        
        if (availableColors.length === 0) {
            return this.selectRandomColor();
        }
        
        return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    
    placeBubblesInGrid(colors, rowIndex) {
        // Import Bubble class dynamically to avoid circular dependency
        import('../entities/Bubble.js').then(({ Bubble }) => {
            for (let x = 0; x < colors.length && x < CONFIG.GRID_WIDTH; x++) {
                const color = colors[x];
                
                // Create new bubble
                const bubble = new Bubble(color);
                
                // Set grid position
                bubble.setGridPosition(x, rowIndex);
                
                // Calculate world position
                const offsetX = (rowIndex % 2 === 0) ? 0 : CONFIG.HEX_WIDTH / 2;
                bubble.mesh.position.x = x * CONFIG.HEX_WIDTH - CONFIG.GRID_WIDTH * CONFIG.HEX_WIDTH / 2 + CONFIG.HEX_WIDTH / 2 + offsetX;
                bubble.mesh.position.y = CONFIG.GRID_TOP_Y - rowIndex * CONFIG.HEX_HEIGHT;
                bubble.mesh.position.z = 0;
                
                // Add to grid
                this.gameState.setBubbleAt(x, rowIndex, bubble);
                
                // Emit event for bubble creation
                this.eventBus.emit('bubbleCreated', {
                    bubble: bubble,
                    x: x,
                    y: rowIndex,
                    color: color
                });
            }
            
            console.log(`Generated new row at index ${rowIndex} with ${colors.length} bubbles`);
        });
    }
    
    activateMercyMode() {
        this.config.mercyMode = true;
        console.log('Mercy mode activated - increasing clustering chance');
    }
    
    deactivateMercyMode() {
        this.config.mercyMode = false;
        console.log('Mercy mode deactivated');
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    // Analysis methods for debugging
    analyzeRowDifficulty(rowIndex) {
        const analysis = {
            totalBubbles: 0,
            uniqueColors: new Set(),
            clusters: [],
            maxClusterSize: 0,
            averageClusterSize: 0
        };
        
        let currentCluster = null;
        
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
            const bubble = this.gameState.getBubbleAt(x, rowIndex);
            if (!bubble) continue;
            
            analysis.totalBubbles++;
            analysis.uniqueColors.add(bubble.color);
            
            // Track clusters
            if (!currentCluster || currentCluster.color !== bubble.color) {
                if (currentCluster) {
                    analysis.clusters.push(currentCluster);
                }
                currentCluster = { color: bubble.color, size: 1 };
            } else {
                currentCluster.size++;
            }
        }
        
        if (currentCluster) {
            analysis.clusters.push(currentCluster);
        }
        
        // Calculate cluster statistics
        if (analysis.clusters.length > 0) {
            analysis.maxClusterSize = Math.max(...analysis.clusters.map(c => c.size));
            analysis.averageClusterSize = analysis.clusters.reduce((sum, c) => sum + c.size, 0) / analysis.clusters.length;
        }
        
        analysis.difficulty = this.calculateDifficultyScore(analysis);
        
        return analysis;
    }
    
    calculateDifficultyScore(analysis) {
        // Higher score = more difficult
        let score = 0;
        
        // More unique colors = harder
        score += analysis.uniqueColors.size * 10;
        
        // Smaller clusters = harder
        score += (5 - analysis.averageClusterSize) * 15;
        
        // More clusters = harder (more fragmented)
        score += analysis.clusters.length * 5;
        
        return Math.max(0, Math.min(100, score));
    }
}