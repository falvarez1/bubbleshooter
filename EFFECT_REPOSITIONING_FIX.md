# Effect Repositioning Fix

## Problem
Visual effects (magnetic field tendrils, impact resonance rings, sympathy pop effects, etc.) were not moving with bubbles when new rows were added to the grid. The effects stayed in their original positions while the bubbles moved down, breaking the visual connection.

## Root Cause
When `addNewRow()` was called in GameLogic.js:
1. Bubbles were shifted down via `shiftRowsDown()` which updated their grid coordinates
2. `setGridPosition()` was called to update their visual positions
3. **However**, effect systems were not notified about these position changes
4. Effects were positioned in world space but not tracking bubble movements

## Solution Architecture

### 1. Event-Based Notification System
Added a new event `bubblesRepositioned` that is emitted when bubbles are moved:

```javascript
// In GameLogic.js - addNewRow()
// Store old positions before moving
const bubbleMovements = new Map();
allBubbles.forEach(bubble => {
    bubbleMovements.set(bubble.id, {
        bubble: bubble,
        oldPosition: bubble.position.clone(),
        oldGridY: bubble.gridY
    });
});

// After moving bubbles
this.gameManager.eventBus.emit('bubblesRepositioned', {
    movements: bubbleMovements,
    reason: 'rowAdded'
});
```

### 2. Effect System Updates

#### MagneticFieldEffect.js
- Added `handleBubblesRepositioned()` listener
- Updates tendril positions when their target bubbles move
- Recalculates warp field positions

#### ImpactResonanceEffect.js
- Added `handleBubblesRepositioned()` listener
- Tracks which bubble each ring is attached to via `attachedBubbleId`
- Moves rings with their associated bubbles
- Clears collision pairs when rows are added

#### SympathyPopEffect.js
- Added `handleBubblesRepositioned()` listener
- Updates mexicanWave originalY positions
- Moves destruction wave epicenters with bubbles

#### CascadeAmplificationSystem.js
- Added `handleBubblesRepositioned()` listener
- Updates orbiting light positions
- Updates geometry pattern positions
- Updates breathing glow positions
- Recalculates chain connection meshes

## Key Implementation Details

### Bubble ID Tracking
Each bubble has a unique ID generated in the Bubble constructor:
```javascript
this.id = `bubble_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

### Effect Association
Effects track which bubbles they're associated with:
```javascript
// Example from ImpactResonanceEffect
ring.attachedBubbleId = bubble.id;
```

### Position Delta Calculation
When bubbles move, we calculate the delta and apply it to effects:
```javascript
const delta = new THREE.Vector3().subVectors(
    movement.bubble.position,
    movement.oldPosition
);
effect.mesh.position.add(delta);
```

## Testing
Use `test-effect-repositioning.html` to verify:
1. Effects move with bubbles when rows are added
2. No effects get stuck in old positions
3. All effect types (magnetic, resonance, sympathy, cascade) update correctly

## Performance Considerations
- Uses event-based system to avoid constant polling
- Only updates effects that are actually active
- Calculates position deltas instead of recreating effects
- Maintains effect-bubble associations via lightweight ID mapping

## Future Improvements
1. Consider pooling effect objects for better memory management
2. Add interpolation for smoother effect transitions
3. Implement effect priority system for performance optimization
4. Add debug visualization mode to show effect-bubble connections