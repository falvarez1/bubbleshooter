import { BubbleStateMachine } from '../managers/BubbleStateMachine.js';
import { BubbleLifecycleManager } from '../managers/BubbleLifecycleManager.js';

/**
 * BubbleRepository
 * Single source of truth for all bubble state
 * Centralizes bubble data and provides atomic operations
 */
export class BubbleRepository {
    constructor() {
        // Core data structures
        this.bubbles = new Map();           // bubbleId -> bubble
        this.gridIndex = new Map();         // "x,y" -> bubbleId
        this.spatialIndex = new Map();      // spatial hash -> Set<bubbleId>
        this.visualIndex = new Map();       // bubbleId -> instanceIndex
        this.stateIndex = new Map();        // state -> Set<bubbleId>
        
        // Performance optimizations
        this.dirtyBubbles = new Set();      // Bubbles that need visual update
        this.needsVisualUpdate = false;
        this.lastUpdateFrame = -1;
        
        // Transaction support
        this.transactionStack = [];
        this.currentTransaction = null;
        
        // Observers for reactive updates
        this.observers = new Set();
        
        // Statistics
        this.stats = {
            totalAdded: 0,
            totalRemoved: 0,
            totalTransactions: 0,
            failedTransactions: 0
        };
    }
    
    /**
     * Add a bubble to the repository
     * @param {Bubble} bubble - The bubble to add
     * @param {number} gridX - Grid X position
     * @param {number} gridY - Grid Y position
     * @returns {boolean} Success status
     */
    addBubble(bubble, gridX, gridY) {
        const transaction = this.beginTransaction('add');
        
        try {
            // Check if bubble already exists
            if (this.bubbles.has(bubble.id)) {
                throw new Error(`Bubble ${bubble.id} already exists in repository`);
            }
            
            // Check if grid position is occupied
            const gridKey = this.getGridKey(gridX, gridY);
            if (this.gridIndex.has(gridKey)) {
                const existingId = this.gridIndex.get(gridKey);
                const existing = this.bubbles.get(existingId);
                if (existing && !existing.isDestroyed) {
                    throw new Error(`Grid position ${gridX},${gridY} already occupied by bubble ${existingId}`);
                }
            }
            
            // Add to all indices
            this.bubbles.set(bubble.id, bubble);
            this.gridIndex.set(gridKey, bubble.id);
            
            // Update spatial index
            this.updateSpatialIndex(bubble, 'add');
            
            // Update state index
            const state = bubble.stateMachine?.getState() || BubbleStateMachine.States.SPAWNING;
            this.updateStateIndex(bubble.id, null, state);
            
            // Mark as dirty for visual update
            this.dirtyBubbles.add(bubble.id);
            this.needsVisualUpdate = true;
            
            // Notify observers
            this.notifyObservers('add', bubble);
            
            // Update stats
            this.stats.totalAdded++;
            
            transaction.commit();
            return true;
            
        } catch (error) {
            console.error('Failed to add bubble:', error);
            transaction.rollback();
            return false;
        }
    }
    
    /**
     * Remove a bubble from the repository
     * @param {string} bubbleId - The bubble ID to remove
     * @returns {boolean} Success status
     */
    removeBubble(bubbleId) {
        const transaction = this.beginTransaction('remove');
        
        try {
            const bubble = this.bubbles.get(bubbleId);
            if (!bubble) {
                console.warn(`Bubble ${bubbleId} not found in repository`);
                transaction.commit();
                return true; // Consider it successful if already gone
            }
            
            // Remove from grid index
            if (bubble.gridX !== undefined && bubble.gridY !== undefined) {
                const gridKey = this.getGridKey(bubble.gridX, bubble.gridY);
                this.gridIndex.delete(gridKey);
            }
            
            // Remove from spatial index
            this.updateSpatialIndex(bubble, 'remove');
            
            // Remove from state index
            const state = bubble.stateMachine?.getState();
            if (state) {
                this.updateStateIndex(bubble.id, state, null);
            }
            
            // Remove from visual index
            this.visualIndex.delete(bubbleId);
            
            // Remove from main map
            this.bubbles.delete(bubbleId);
            
            // Remove from dirty set
            this.dirtyBubbles.delete(bubbleId);
            
            // Notify observers
            this.notifyObservers('remove', bubble);
            
            // Update stats
            this.stats.totalRemoved++;
            
            transaction.commit();
            return true;
            
        } catch (error) {
            console.error('Failed to remove bubble:', error);
            transaction.rollback();
            return false;
        }
    }
    
    /**
     * Update bubble position
     * @param {string} bubbleId - The bubble ID
     * @param {Object} position - New position {x, y, z}
     */
    updatePosition(bubbleId, position) {
        const bubble = this.bubbles.get(bubbleId);
        if (!bubble) return;
        
        // Update spatial index if position changed significantly
        const oldHash = this.getSpatialHash(bubble.position);
        const newHash = this.getSpatialHash(position);
        
        if (oldHash !== newHash) {
            this.updateSpatialIndex(bubble, 'remove');
            bubble.position.set(position.x, position.y, position.z);
            this.updateSpatialIndex(bubble, 'add');
        } else {
            bubble.position.set(position.x, position.y, position.z);
        }
        
        // Mark for visual update
        this.dirtyBubbles.add(bubbleId);
        this.needsVisualUpdate = true;
    }
    
    /**
     * Update bubble grid position
     * @param {string} bubbleId - The bubble ID
     * @param {number} gridX - New grid X
     * @param {number} gridY - New grid Y
     */
    updateGridPosition(bubbleId, gridX, gridY) {
        const bubble = this.bubbles.get(bubbleId);
        if (!bubble) return;
        
        // Remove from old grid position
        if (bubble.gridX !== undefined && bubble.gridY !== undefined) {
            const oldKey = this.getGridKey(bubble.gridX, bubble.gridY);
            this.gridIndex.delete(oldKey);
        }
        
        // Add to new grid position
        bubble.gridX = gridX;
        bubble.gridY = gridY;
        const newKey = this.getGridKey(gridX, gridY);
        this.gridIndex.set(newKey, bubbleId);
        
        // Mark for visual update
        this.dirtyBubbles.add(bubbleId);
        this.needsVisualUpdate = true;
    }
    
    /**
     * Get bubble by ID
     * @param {string} bubbleId - The bubble ID
     * @returns {Bubble|null} The bubble or null
     */
    getBubble(bubbleId) {
        return this.bubbles.get(bubbleId) || null;
    }
    
    /**
     * Get bubble at grid position
     * @param {number} x - Grid X
     * @param {number} y - Grid Y
     * @returns {Bubble|null} The bubble or null
     */
    getBubbleAt(x, y) {
        const gridKey = this.getGridKey(x, y);
        const bubbleId = this.gridIndex.get(gridKey);
        return bubbleId ? this.bubbles.get(bubbleId) : null;
    }
    
    /**
     * Get bubbles near a position
     * @param {Object} position - Position {x, y, z}
     * @param {number} radius - Search radius
     * @returns {Array} Array of nearby bubbles
     */
    getBubblesNear(position, radius) {
        const nearbyBubbles = [];
        const radiusSquared = radius * radius;
        
        // Get spatial cells to check
        const cellsToCheck = this.getSpatialCellsInRadius(position, radius);
        const checked = new Set();
        
        cellsToCheck.forEach(hash => {
            const bubbleIds = this.spatialIndex.get(hash);
            if (bubbleIds) {
                bubbleIds.forEach(bubbleId => {
                    if (!checked.has(bubbleId)) {
                        checked.add(bubbleId);
                        const bubble = this.bubbles.get(bubbleId);
                        if (bubble) {
                            const dx = bubble.position.x - position.x;
                            const dy = bubble.position.y - position.y;
                            const distSquared = dx * dx + dy * dy;
                            if (distSquared <= radiusSquared) {
                                nearbyBubbles.push(bubble);
                            }
                        }
                    }
                });
            }
        });
        
        return nearbyBubbles;
    }
    
    /**
     * Get bubbles by state
     * @param {string} state - The state to filter by
     * @returns {Array} Array of bubbles in the given state
     */
    getBubblesByState(state) {
        const bubbleIds = this.stateIndex.get(state);
        if (!bubbleIds) return [];
        
        return Array.from(bubbleIds).map(id => this.bubbles.get(id)).filter(Boolean);
    }
    
    /**
     * Get all bubbles
     * @returns {Array} Array of all bubbles
     */
    getAllBubbles() {
        return Array.from(this.bubbles.values());
    }
    
    /**
     * Get bubbles that need visual update
     * @returns {Array} Array of dirty bubbles
     */
    getDirtyBubbles() {
        return Array.from(this.dirtyBubbles).map(id => this.bubbles.get(id)).filter(Boolean);
    }
    
    /**
     * Clear dirty bubbles after visual update
     */
    clearDirtyBubbles() {
        this.dirtyBubbles.clear();
        this.needsVisualUpdate = false;
    }
    
    /**
     * Begin a transaction
     * @param {string} type - Transaction type
     * @returns {Object} Transaction object
     */
    beginTransaction(type) {
        const transaction = {
            id: Date.now() + Math.random(),
            type: type,
            snapshot: this.createSnapshot(),
            startTime: performance.now(),
            committed: false
        };
        
        this.transactionStack.push(transaction);
        this.currentTransaction = transaction;
        this.stats.totalTransactions++;
        
        transaction.commit = () => {
            transaction.committed = true;
            transaction.duration = performance.now() - transaction.startTime;
            this.currentTransaction = null;
        };
        
        transaction.rollback = () => {
            if (!transaction.committed) {
                this.restoreSnapshot(transaction.snapshot);
                this.stats.failedTransactions++;
            }
            this.currentTransaction = null;
        };
        
        return transaction;
    }
    
    /**
     * Create a snapshot of current state
     * @private
     */
    createSnapshot() {
        return {
            bubbles: new Map(this.bubbles),
            gridIndex: new Map(this.gridIndex),
            spatialIndex: new Map(this.spatialIndex),
            visualIndex: new Map(this.visualIndex),
            stateIndex: new Map(this.stateIndex),
            dirtyBubbles: new Set(this.dirtyBubbles)
        };
    }
    
    /**
     * Restore from snapshot
     * @private
     */
    restoreSnapshot(snapshot) {
        this.bubbles = new Map(snapshot.bubbles);
        this.gridIndex = new Map(snapshot.gridIndex);
        this.spatialIndex = new Map(snapshot.spatialIndex);
        this.visualIndex = new Map(snapshot.visualIndex);
        this.stateIndex = new Map(snapshot.stateIndex);
        this.dirtyBubbles = new Set(snapshot.dirtyBubbles);
        this.needsVisualUpdate = this.dirtyBubbles.size > 0;
    }
    
    /**
     * Update spatial index for a bubble
     * @private
     */
    updateSpatialIndex(bubble, operation) {
        const hash = this.getSpatialHash(bubble.position);
        
        if (operation === 'add') {
            if (!this.spatialIndex.has(hash)) {
                this.spatialIndex.set(hash, new Set());
            }
            this.spatialIndex.get(hash).add(bubble.id);
        } else if (operation === 'remove') {
            const bubbleIds = this.spatialIndex.get(hash);
            if (bubbleIds) {
                bubbleIds.delete(bubble.id);
                if (bubbleIds.size === 0) {
                    this.spatialIndex.delete(hash);
                }
            }
        }
    }
    
    /**
     * Update state index
     * @private
     */
    updateStateIndex(bubbleId, oldState, newState) {
        // Remove from old state
        if (oldState) {
            const bubbleIds = this.stateIndex.get(oldState);
            if (bubbleIds) {
                bubbleIds.delete(bubbleId);
                if (bubbleIds.size === 0) {
                    this.stateIndex.delete(oldState);
                }
            }
        }
        
        // Add to new state
        if (newState) {
            if (!this.stateIndex.has(newState)) {
                this.stateIndex.set(newState, new Set());
            }
            this.stateIndex.get(newState).add(bubbleId);
        }
    }
    
    /**
     * Get grid key for indexing
     * @private
     */
    getGridKey(x, y) {
        return `${x},${y}`;
    }
    
    /**
     * Get spatial hash for position
     * @private
     */
    getSpatialHash(position) {
        const cellSize = 2; // Adjust based on bubble size
        const x = Math.floor(position.x / cellSize);
        const y = Math.floor(position.y / cellSize);
        return `${x},${y}`;
    }
    
    /**
     * Get spatial cells within radius
     * @private
     */
    getSpatialCellsInRadius(position, radius) {
        const cellSize = 2;
        const cells = [];
        const cellRadius = Math.ceil(radius / cellSize);
        
        const centerX = Math.floor(position.x / cellSize);
        const centerY = Math.floor(position.y / cellSize);
        
        for (let dx = -cellRadius; dx <= cellRadius; dx++) {
            for (let dy = -cellRadius; dy <= cellRadius; dy++) {
                cells.push(`${centerX + dx},${centerY + dy}`);
            }
        }
        
        return cells;
    }
    
    /**
     * Add observer for repository changes
     * @param {Function} callback - Observer callback
     */
    addObserver(callback) {
        this.observers.add(callback);
    }
    
    /**
     * Remove observer
     * @param {Function} callback - Observer callback
     */
    removeObserver(callback) {
        this.observers.delete(callback);
    }
    
    /**
     * Notify all observers
     * @private
     */
    notifyObservers(event, data) {
        this.observers.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Observer error:', error);
            }
        });
    }
    
    /**
     * Get repository statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            currentBubbleCount: this.bubbles.size,
            dirtyBubbleCount: this.dirtyBubbles.size,
            gridPositions: this.gridIndex.size,
            spatialCells: this.spatialIndex.size
        };
    }
    
    /**
     * Clear all bubbles (for game reset)
     */
    clear() {
        this.bubbles.clear();
        this.gridIndex.clear();
        this.spatialIndex.clear();
        this.visualIndex.clear();
        this.stateIndex.clear();
        this.dirtyBubbles.clear();
        this.needsVisualUpdate = false;
        this.notifyObservers('clear', null);
    }
}