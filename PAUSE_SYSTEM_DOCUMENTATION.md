# Pause System Documentation

## Overview
The pause system provides comprehensive freezing of all game elements while maintaining visibility for debugging purposes. When activated with the **P** key, it freezes all animations, timers, physics, and particle effects without overlays.

## Key Features

### 1. Complete Freeze
- **Animation Frame Updates**: Delta time set to 0 when paused
- **CSS Animations**: Paused using `animationPlayState`
- **CSS Transitions**: Frozen by temporarily setting duration to 0
- **Timer Countdowns**: Progressive timer system respects pause state
- **Physics Updates**: All bubble movements and collisions frozen
- **Particle Effects**: Updates skipped during pause
- **DOM Animations**: Notification animations paused mid-state

### 2. Debugging Support
- **No Overlay**: Game remains fully visible
- **Scene Rendering**: Continues rendering for visual inspection
- **DevTools Compatible**: All elements can be inspected while frozen
- **State Preservation**: All animation states preserved for resume

### 3. Visual Indicator
- **"PAUSED" text** appears in top-left corner
- Gold color (#FFD700) with shadow for visibility
- Subtle pulse animation (remains active to show pause is intentional)

## Architecture

### Core Components

#### PauseSystem (`/src/systems/PauseSystem.js`)
The main pause controller that:
- Manages pause/resume state
- Freezes CSS animations and transitions
- Overrides time functions (Date.now, performance.now)
- Handles audio pause/resume
- Emits events for other systems

#### Integration Points

1. **Main Game Loop** (`/src/main.js`)
   - Checks `pauseSystem.isPausedState()` before updates
   - Uses `pauseSystem.adjustDeltaTime()` to zero out deltaTime
   - Continues rendering even when paused

2. **NotificationManager** (`/src/ui/NotificationManager.js`)
   - Listens for `gamePaused`/`gameResumed` events
   - Pauses CSS animations on notifications
   - Stores timeout states for proper resume

3. **ProgressiveTimerSystem** (`/src/systems/ProgressiveTimerSystem.js`)
   - Respects pause state in update loop
   - Resets `lastUpdate` on resume to prevent time jumps

4. **GameState** (`/src/core/GameState.js`)
   - Maintains `isPaused` flag
   - Provides `pause()`, `resume()`, `togglePause()` methods

## Implementation Details

### CSS Animation Freezing
```javascript
// Pause all CSS animations
element.style.animationPlayState = 'paused';

// Freeze transitions by setting duration to 0
element.style.transitionDuration = '0s';
```

### Time Function Override
The system overrides JavaScript time functions to freeze time-based calculations:
```javascript
// Store pause time
const pauseTime = Date.now();

// Override to return frozen time
window.Date.now = () => pauseTime;
window.performance.now = () => frozenPerformanceTime;
```

### Delta Time Adjustment
```javascript
// In animate loop
let deltaTime = this.pauseSystem.adjustDeltaTime(originalDelta);
// Returns 0 when paused, original value when running
```

## Usage

### Basic Controls
- **P Key**: Toggle pause on/off
- Works in debug mode and production
- Can pause at any time except during game over

### For Developers

#### Checking Pause State
```javascript
if (this.pauseSystem.isPausedState()) {
    // Skip updates
}
```

#### Listening to Pause Events
```javascript
eventBus.on('gamePaused', (data) => {
    // Handle pause
    console.log('Paused at:', data.timestamp);
});

eventBus.on('gameResumed', (data) => {
    // Handle resume
    console.log('Pause duration:', data.pauseDuration);
});
```

#### Making Components Pauseable
1. Subscribe to pause events via EventBus
2. Check pause state before updates
3. Store animation states if needed for resume
4. Reset time tracking on resume

## Testing

### Test File
Use `test_pause.html` to verify pause functionality:
```bash
# Open in browser
open test_pause.html
```

### What to Test
1. Press P to pause
2. Verify all animations freeze
3. Check that "PAUSED" indicator appears
4. Open DevTools and inspect frozen elements
5. Press P again to resume
6. Verify animations continue from where they stopped

## Debugging While Paused

### Browser DevTools
With the game paused, you can:
- Inspect element positions and transforms
- Check computed styles
- Examine Three.js scene graph
- Profile memory usage
- Debug JavaScript state

### Console Commands
While paused, useful debugging commands:
```javascript
// Check pause state
game.pauseSystem.isPausedState()

// Get pause offset
game.pauseSystem.getPauseOffset()

// Manual pause/resume
game.pauseSystem.pause()
game.pauseSystem.resume()
```

## Performance Considerations

### Minimal Overhead
- Pause checking is a simple boolean test
- CSS animation pausing is native browser functionality
- Time function overrides only active during pause
- No performance impact when not paused

### Memory Management
- Animation states stored only during pause
- Cleared immediately on resume
- Minimal memory footprint

## Known Limitations

1. **requestAnimationFrame**: Continues running (by design for visibility)
2. **Web Audio API**: Some audio contexts may need manual handling
3. **WebGL Shaders**: Time-based shader uniforms need manual pause handling
4. **External Libraries**: Third-party animations may need additional integration

## Future Enhancements

Potential improvements:
- [ ] Pause indicator customization
- [ ] Step-through debugging (advance one frame)
- [ ] Slow-motion mode for debugging
- [ ] Pause state persistence
- [ ] Screenshot capture while paused