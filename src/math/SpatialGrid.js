/**
 * Spatial Grid for optimized collision detection
 * Divides space into cells for efficient neighbor queries
 */
export class SpatialGrid {
    constructor(cellSize, worldWidth, worldHeight) {
        this.cellSize = cellSize;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        
        // Calculate grid dimensions
        this.gridWidth = Math.ceil(worldWidth / cellSize);
        this.gridHeight = Math.ceil(worldHeight / cellSize);
        
        // Initialize grid cells
        this.clear();
        
        // Cache for frequently used calculations
        this.invCellSize = 1 / cellSize;
    }
    
    /**
     * Clear all cells
     */
    clear() {
        this.cells = new Map();
        this.objectToCell = new Map();
    }
    
    /**
     * Get cell key from grid coordinates using integer encoding
     * Much faster than string concatenation
     */
    getCellKey(gridX, gridY) {
        // Use bit shifting for fast integer key generation
        // Assumes grid coordinates are within reasonable bounds (< 65536)
        return (gridX & 0xFFFF) | ((gridY & 0xFFFF) << 16);
    }
    
    /**
     * Get grid coordinates from world position
     */
    getGridCoords(x, y) {
        const gridX = Math.floor((x + this.worldWidth * 0.5) * this.invCellSize);
        const gridY = Math.floor((y + this.worldHeight * 0.5) * this.invCellSize);
        return { gridX, gridY };
    }
    
    /**
     * Add an object to the grid
     */
    add(object, x, y) {
        const { gridX, gridY } = this.getGridCoords(x, y);
        const key = this.getCellKey(gridX, gridY);
        
        // Remove from previous cell if it exists
        this.remove(object);
        
        // Add to new cell
        if (!this.cells.has(key)) {
            this.cells.set(key, new Set());
        }
        this.cells.get(key).add(object);
        
        // Track object's current cell
        this.objectToCell.set(object, key);
    }
    
    /**
     * Remove an object from the grid
     */
    remove(object) {
        const cellKey = this.objectToCell.get(object);
        if (cellKey && this.cells.has(cellKey)) {
            this.cells.get(cellKey).delete(object);
            
            // Clean up empty cells
            if (this.cells.get(cellKey).size === 0) {
                this.cells.delete(cellKey);
            }
        }
        this.objectToCell.delete(object);
    }
    
    /**
     * Update object position in grid
     */
    update(object, x, y) {
        const { gridX, gridY } = this.getGridCoords(x, y);
        const newKey = this.getCellKey(gridX, gridY);
        const oldKey = this.objectToCell.get(object);
        
        // Only update if cell changed
        if (oldKey !== newKey) {
            this.add(object, x, y);
        }
    }
    
    /**
     * Get all objects near a position within radius
     */
    getNearby(x, y, radius) {
        const nearby = new Set();
        const { gridX: centerX, gridY: centerY } = this.getGridCoords(x, y);
        
        // Calculate cell radius to check
        const cellRadius = Math.ceil(radius * this.invCellSize);
        
        // Check all cells within radius - optimized with early exit
        const cells = this.cells;
        const getCellKey = this.getCellKey.bind(this);
        const gridWidth = this.gridWidth;
        const gridHeight = this.gridHeight;
        
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            const checkX = centerX + dx;
            if (checkX < 0 || checkX >= gridWidth) continue;
            
            for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                const checkY = centerY + dy;
                if (checkY < 0 || checkY >= gridHeight) continue;
                
                const key = getCellKey(checkX, checkY);
                const cell = cells.get(key);
                if (cell) {
                    // Use iterator for better performance
                    for (const object of cell) {
                        nearby.add(object);
                    }
                }
            }
        }
        
        // Return array directly without intermediate conversion
        return [...nearby];
    }
    
    /**
     * Get potential collision pairs (broad phase)
     */
    getPotentialCollisions() {
        const pairs = [];
        const checked = new Set();
        
        // For each cell, check objects within it and neighboring cells
        for (const [cellKey, objects] of this.cells) {
            if (objects.size === 0) continue;
            
            const [gridX, gridY] = cellKey.split(',').map(Number);
            const objectsArray = Array.from(objects);
            
            // Check within same cell
            for (let i = 0; i < objectsArray.length - 1; i++) {
                for (let j = i + 1; j < objectsArray.length; j++) {
                    const pairKey = this.getPairKey(objectsArray[i], objectsArray[j]);
                    if (!checked.has(pairKey)) {
                        pairs.push([objectsArray[i], objectsArray[j]]);
                        checked.add(pairKey);
                    }
                }
            }
            
            // Check with neighboring cells
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const neighborKey = this.getCellKey(gridX + dx, gridY + dy);
                    if (this.cells.has(neighborKey)) {
                        const neighbors = this.cells.get(neighborKey);
                        
                        for (const obj1 of objectsArray) {
                            for (const obj2 of neighbors) {
                                const pairKey = this.getPairKey(obj1, obj2);
                                if (!checked.has(pairKey)) {
                                    pairs.push([obj1, obj2]);
                                    checked.add(pairKey);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return pairs;
    }
    
    /**
     * Get unique pair key for collision checking
     */
    getPairKey(obj1, obj2) {
        // Use object IDs or fallback to object references
        const id1 = obj1.id || obj1;
        const id2 = obj2.id || obj2;
        return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    }
    
    /**
     * Debug: Get grid statistics
     */
    getStats() {
        let totalObjects = 0;
        let maxObjectsPerCell = 0;
        let cellCount = this.cells.size;
        
        for (const objects of this.cells.values()) {
            totalObjects += objects.size;
            maxObjectsPerCell = Math.max(maxObjectsPerCell, objects.size);
        }
        
        return {
            cellCount,
            totalObjects,
            maxObjectsPerCell,
            averageObjectsPerCell: cellCount > 0 ? totalObjects / cellCount : 0
        };
    }
}