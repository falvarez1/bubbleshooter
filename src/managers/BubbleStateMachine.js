/**
 * BubbleStateMachine
 * Manages bubble lifecycle states and ensures valid transitions
 * Prevents invalid states that can lead to ghost bubbles
 */
export class BubbleStateMachine {
    // Define all possible states
    static States = {
        SPAWNING: 'spawning',       // Initial creation
        SHOOTING: 'shooting',       // Ready to be shot
        FLYING: 'flying',          // In flight after being shot
        ATTACHING: 'attaching',    // Process of attaching to grid
        ATTACHED: 'attached',      // Successfully attached to grid
        MATCHED: 'matched',        // Part of a match (about to be destroyed)
        FLOATING: 'floating',      // No longer connected to ceiling
        DESTROYING: 'destroying',  // Being destroyed (animation/cleanup)
        DESTROYED: 'destroyed'     // Final state - fully cleaned up
    };
    
    // Define valid state transitions
    static ValidTransitions = {
        [this.States.SPAWNING]: [this.States.SHOOTING, this.States.ATTACHED],
        [this.States.SHOOTING]: [this.States.FLYING],
        [this.States.FLYING]: [this.States.ATTACHING, this.States.DESTROYING],
        [this.States.ATTACHING]: [this.States.ATTACHED, this.States.DESTROYING],
        [this.States.ATTACHED]: [this.States.MATCHED, this.States.FLOATING, this.States.DESTROYING],
        [this.States.MATCHED]: [this.States.DESTROYING],
        [this.States.FLOATING]: [this.States.DESTROYING],
        [this.States.DESTROYING]: [this.States.DESTROYED],
        [this.States.DESTROYED]: [] // Terminal state - no transitions allowed
    };
    
    constructor(bubble) {
        this.bubble = bubble;
        this.currentState = BubbleStateMachine.States.SPAWNING;
        this.previousState = null;
        this.stateHistory = [this.currentState];
        this.listeners = new Map();
        this.transitionTimestamp = performance.now();
    }
    
    /**
     * Get the current state
     * @returns {string} Current state
     */
    getState() {
        return this.currentState;
    }
    
    /**
     * Check if a transition to a new state is valid
     * @param {string} toState - Target state
     * @returns {boolean} Whether the transition is valid
     */
    canTransition(toState) {
        const validTransitions = BubbleStateMachine.ValidTransitions[this.currentState];
        return validTransitions ? validTransitions.includes(toState) : false;
    }
    
    /**
     * Transition to a new state
     * @param {string} toState - Target state
     * @param {Object} context - Optional context data for the transition
     * @returns {boolean} Whether the transition was successful
     */
    transition(toState, context = {}) {
        // Check if transition is valid
        if (!this.canTransition(toState)) {
            console.error(`Invalid state transition: ${this.currentState} → ${toState} for bubble ${this.bubble.id}`);
            return false;
        }
        
        // Store previous state
        this.previousState = this.currentState;
        
        // Perform state exit logic
        this.onStateExit(this.currentState, context);
        
        // Update state
        this.currentState = toState;
        this.stateHistory.push(toState);
        this.transitionTimestamp = performance.now();
        
        // Perform state entry logic
        this.onStateEntry(toState, context);
        
        // Notify listeners
        this.notifyListeners('transition', {
            from: this.previousState,
            to: toState,
            bubble: this.bubble,
            context: context
        });
        
        return true;
    }
    
    /**
     * Force a state change (use with caution - bypasses validation)
     * @param {string} toState - Target state
     */
    forceState(toState) {
        console.warn(`Forcing state transition: ${this.currentState} → ${toState} for bubble ${this.bubble.id}`);
        this.previousState = this.currentState;
        this.currentState = toState;
        this.stateHistory.push(toState);
        this.transitionTimestamp = performance.now();
    }
    
    /**
     * Handle state exit logic
     * @private
     */
    onStateExit(state, context) {
        switch (state) {
            case BubbleStateMachine.States.FLYING:
                // Clear velocity when leaving flying state
                if (this.bubble.velocity) {
                    this.bubble.velocity.set(0, 0, 0);
                }
                break;
                
            case BubbleStateMachine.States.ATTACHED:
                // Clear grid position if being destroyed
                if (context.clearGrid) {
                    this.bubble.gridX = undefined;
                    this.bubble.gridY = undefined;
                }
                break;
        }
    }
    
    /**
     * Handle state entry logic
     * @private
     */
    onStateEntry(state, context) {
        switch (state) {
            case BubbleStateMachine.States.SHOOTING:
                // Prepare bubble for shooting
                this.bubble.isMoving = false;
                this.bubble.needsAttachment = false;
                break;
                
            case BubbleStateMachine.States.FLYING:
                // Mark bubble as moving
                this.bubble.isMoving = true;
                break;
                
            case BubbleStateMachine.States.ATTACHED:
                // Finalize attachment
                this.bubble.isMoving = false;
                this.bubble.needsAttachment = false;
                this.bubble.isFloating = false;
                break;
                
            case BubbleStateMachine.States.MATCHED:
                // Mark for destruction
                this.bubble.isMatched = true;
                break;
                
            case BubbleStateMachine.States.FLOATING:
                // Mark as floating
                this.bubble.isFloating = true;
                break;
                
            case BubbleStateMachine.States.DESTROYING:
                // Begin destruction process
                this.bubble.isDestroyed = true;
                this.notifyListeners('destroying', { bubble: this.bubble });
                break;
                
            case BubbleStateMachine.States.DESTROYED:
                // Final cleanup
                this.bubble.isDestroyed = true;
                this.notifyListeners('destroyed', { bubble: this.bubble });
                break;
        }
    }
    
    /**
     * Check if bubble is in a terminal state
     * @returns {boolean} Whether the bubble is in a terminal state
     */
    isTerminal() {
        return this.currentState === BubbleStateMachine.States.DESTROYED;
    }
    
    /**
     * Check if bubble is in an active gameplay state
     * @returns {boolean} Whether the bubble is active
     */
    isActive() {
        return this.currentState === BubbleStateMachine.States.ATTACHED ||
               this.currentState === BubbleStateMachine.States.MATCHED;
    }
    
    /**
     * Check if bubble is in motion
     * @returns {boolean} Whether the bubble is moving
     */
    isInMotion() {
        return this.currentState === BubbleStateMachine.States.FLYING ||
               this.currentState === BubbleStateMachine.States.ATTACHING ||
               this.currentState === BubbleStateMachine.States.FLOATING;
    }
    
    /**
     * Add an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }
    
    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.delete(callback);
        }
    }
    
    /**
     * Notify all listeners of an event
     * @private
     */
    notifyListeners(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in state machine listener:`, error);
                }
            });
        }
    }
    
    /**
     * Get state history for debugging
     * @returns {Array} Array of state transitions
     */
    getHistory() {
        return [...this.stateHistory];
    }
    
    /**
     * Get time in current state
     * @returns {number} Milliseconds in current state
     */
    getTimeInState() {
        return performance.now() - this.transitionTimestamp;
    }
    
    /**
     * Reset state machine (for pooled bubbles)
     */
    reset() {
        this.currentState = BubbleStateMachine.States.SPAWNING;
        this.previousState = null;
        this.stateHistory = [this.currentState];
        this.transitionTimestamp = performance.now();
        this.listeners.clear();
    }
    
    /**
     * Validate bubble state consistency
     * @returns {Array} Array of validation issues
     */
    validate() {
        const issues = [];
        
        // Check state matches bubble properties
        if (this.currentState === BubbleStateMachine.States.DESTROYED && !this.bubble.isDestroyed) {
            issues.push('State is DESTROYED but bubble.isDestroyed is false');
        }
        
        if (this.currentState !== BubbleStateMachine.States.DESTROYED && this.bubble.isDestroyed) {
            issues.push(`State is ${this.currentState} but bubble.isDestroyed is true`);
        }
        
        if (this.currentState === BubbleStateMachine.States.FLYING && !this.bubble.isMoving) {
            issues.push('State is FLYING but bubble.isMoving is false');
        }
        
        if (this.currentState === BubbleStateMachine.States.ATTACHED) {
            if (this.bubble.gridX === undefined || this.bubble.gridY === undefined) {
                issues.push('State is ATTACHED but grid position is undefined');
            }
        }
        
        if (this.currentState === BubbleStateMachine.States.FLOATING && !this.bubble.isFloating) {
            issues.push('State is FLOATING but bubble.isFloating is false');
        }
        
        return issues;
    }
    
    /**
     * Create a state machine for a bubble if it doesn't have one
     * @param {Bubble} bubble - The bubble to attach state machine to
     * @param {string} initialState - Optional initial state
     * @returns {BubbleStateMachine} The state machine instance
     */
    static attachTo(bubble, initialState = null) {
        if (!bubble.stateMachine) {
            bubble.stateMachine = new BubbleStateMachine(bubble);
            if (initialState) {
                bubble.stateMachine.forceState(initialState);
            }
        }
        return bubble.stateMachine;
    }
}