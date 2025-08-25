# Splash Screen Implementation Guide

## Overview
The splash screen system provides an immediate loading experience with an animated bubble galaxy, progress tracking, and a main menu with Start/Continue options. It integrates seamlessly with the existing game architecture without breaking any functionality.

## Architecture

### 1. Components

#### SplashScreen Class (`src/ui/SplashScreen.js`)
- **Purpose**: Manages the entire splash screen lifecycle
- **Features**:
  - Animated bubble galaxy with 8 orbiting bubbles
  - Progress bar with percentage display
  - Staged loading messages
  - Main menu with Start/Continue/Settings buttons
  - Particle effects on button clicks
  - Save game detection

#### AssetLoader Class (`src/ui/SplashScreen.js`)
- **Purpose**: Tracks Three.js asset loading
- **Features**:
  - Integrates with Three.js LoadingManager
  - Emits events for asset registration and completion
  - Categorizes assets by type (texture, model, data)

### 2. Loading Flow

```
1. index.html loads → Early splash shown immediately (0-30% progress)
2. Modules start loading → SplashScreen takes over early splash
3. Game systems initialize → Progress events update loading bar (30-90%)
4. All assets loaded → Loading complete triggered (100%)
5. Menu appears → User can Start/Continue
6. Game starts → Splash fades out with transition
7. Animation loop begins → Game is playable
```

### 3. Integration Points

#### main.js Modifications
- Constructor accepts `splashScreen` parameter
- Creates `AssetLoader` for tracking Three.js assets
- Listens for `game:start` event from splash
- Listens for `splash:hidden` to start animation loop
- Implements `handleGameStart()` for new/continue logic
- Implements `loadSavedGame()` for restoring progress

#### LevelProgressionSystem.js
- `saveProgress()` now saves to both slots:
  - `bubbleShooterProgress` - Full progress data
  - `bubbleShooterSave` - Simplified data for Continue button

## Features

### 1. Immediate Display
- Early splash shown via inline script before modules load
- No blank screen period
- Smooth handoff from early splash to module splash

### 2. Progress Tracking
```javascript
// Register an asset
eventBus.emit('asset:register', { id: 'texture-1', type: 'texture' });

// Mark asset as loaded
eventBus.emit('asset:loaded', { id: 'texture-1' });

// Trigger loading complete
eventBus.emit('loading:complete');
```

### 3. Staged Messages
Loading messages progress based on percentage:
- 0-15%: "Initializing bubble physics..."
- 15-30%: "Loading particle systems..."
- 30-45%: "Preparing power-ups..."
- 45-60%: "Setting up game board..."
- 60-75%: "Calibrating trajectory system..."
- 75-90%: "Loading sound effects..."
- 90-99%: "Finalizing graphics..."
- 100%: "Ready to play!"

### 4. Save Game Support
```javascript
// Save format in localStorage
{
  "level": 5,
  "score": 12500,
  "highScore": 15000,
  "timestamp": 1703123456789
}
```

Continue button shows: "Continue (Level X)"

### 5. Visual Effects

#### Bubble Galaxy
- 8 bubbles orbiting at different speeds/radii
- Shimmer effect on each bubble
- CSS animations for smooth performance
- Different hue values for variety

#### Button Effects
- Glass morphism design
- Cyan glow on hover
- Sweep animation on hover
- Particle burst on click (12 particles)
- Scale/transform feedback

#### Background
- Radial gradient from dark blue to black
- 20 floating background particles
- Subtle upward drift animation

## Performance Considerations

### 1. CSS-Only Animations
- All bubble orbits use CSS transforms
- GPU-accelerated via `will-change: transform`
- No JavaScript animation overhead during loading

### 2. Efficient DOM Updates
- Progress bar uses CSS width transitions
- Messages fade in/out with CSS opacity
- Minimal DOM manipulation

### 3. Asset Loading Optimization
- LoadingManager batches progress updates
- Debounced progress bar updates
- Prevents excessive reflows

### 4. Memory Management
- Splash screen fully removed after hide
- Event listeners properly cleaned up
- No lingering references

## Usage

### Basic Implementation
```javascript
import { SplashScreen } from './src/ui/SplashScreen.js';

// Create splash screen
const splash = new SplashScreen(eventBus);

// Track asset loading
eventBus.emit('asset:register', { id: 'asset1', type: 'texture' });
// ... load asset ...
eventBus.emit('asset:loaded', { id: 'asset1' });

// When all loading complete
eventBus.emit('loading:complete');

// Handle game start
eventBus.on('game:start', (data) => {
    if (data.newGame) {
        // Start new game
    } else {
        // Continue saved game
    }
});
```

### Testing
Use `test-splash.html` to test the splash screen in isolation:
```bash
# Open in browser
open test-splash.html
```

Debug commands in console:
- `splashScreen.forceComplete()` - Skip to menu
- `splashScreen.setProgress(50)` - Set progress manually
- `splashScreen.simulateLoading(3000)` - Simulate loading

## Customization

### Modify Loading Messages
Edit the `loadingMessages` array in SplashScreen constructor:
```javascript
this.loadingMessages = [
    'Your custom message 1...',
    'Your custom message 2...',
    // ...
];
```

### Adjust Bubble Count/Animation
Edit `createOrbitingBubbles()` and CSS:
```javascript
const bubbleCount = 10; // Change count
```

### Change Color Scheme
Modify CSS variables in `splash-screen.css`:
- Primary color: `#00ffff` (cyan)
- Secondary color: `#0080ff` (blue)
- Background gradient colors

## Troubleshooting

### Issue: Splash doesn't hide
- Check that `loading:complete` event is emitted
- Verify `game:start` event is handled
- Check console for errors

### Issue: Continue button not working
- Verify localStorage has `bubbleShooterSave` key
- Check save data format is correct
- Ensure level > 1 in save data

### Issue: Loading stuck at percentage
- Check asset registration/loading events match
- Verify all registered assets emit loaded event
- Use `forceComplete()` for debugging

## Future Enhancements

1. **Sound Integration**
   - Background music during loading
   - Button click sounds
   - Transition whoosh sound

2. **Advanced Animations**
   - 3D bubble rotation
   - Particle trails on bubbles
   - Morphing logo animation

3. **Social Features**
   - Leaderboard preview
   - Daily challenge notification
   - Achievement badges

4. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - Reduced motion option

5. **Performance Metrics**
   - Loading time analytics
   - Asset size tracking
   - Network speed detection