# Sympathy Pop Effect Implementation

## Overview
The Sympathy Pop effect creates visual anticipation and dramatic chain reactions when bubbles are about to be destroyed. It makes bubbles show increasing vibration, glow buildup, and wave-like propagation effects before popping.

## Features Implemented

### 1. **Vibration System**
- Bubbles vibrate with increasing intensity as destruction approaches
- Each bubble has unique phase offset for organic movement
- Amplitude increases based on proximity to epicenter
- Stored in `bubble.sympathyVibration` and `bubble.vibrationOffset`

### 2. **Glow Buildup**
- Internal emissive glow that pulses and intensifies
- Bright white glow color overlays the bubble's base color
- Intensity ramps up smoothly using interpolation
- Controlled via `bubble.sympathyGlowIntensity`

### 3. **Mexican Wave Effect**
- Bubbles rise and fall in a wave pattern
- Propagates outward from the destruction epicenter
- Phase-based animation creates smooth wave motion
- Managed through `bubble.mexicanWave` and `bubble.waveOffset`

### 4. **Scale Pulsing**
- Bubbles pulse in size to show anticipation
- Synchronized with vibration for cohesive effect
- Scale multiplier stored in `bubble.sympathyScale`

### 5. **Anticipation Particles**
- Sparkles emit from bubbles about to pop
- Particle rate increases with effect intensity
- Multiple colors (white, yellow, magenta) for visual variety
- Only spawns when intensity exceeds threshold

### 6. **Wave Propagation**
- Effects spread outward in discrete waves
- Distance-based grouping creates ripple effect
- Configurable wave speed and delay between groups
- Supports different destruction types (match, bomb, lightning)

## Technical Architecture

### Core Components

1. **SympathyPopEffect.js** (`/src/effects/SympathyPopEffect.js`)
   - Main effect controller
   - Manages affected bubbles and wave propagation
   - Handles all visual updates and particle spawning
   - Event-driven architecture for flexibility

2. **Bubble Entity Updates** (`/src/entities/Bubble.js`)
   - Added sympathy effect properties
   - Wave offset application in position updates
   - Properties persist through render cycles

3. **BubbleInstances Shader Support** (`/src/graphics/BubbleInstances.js`)
   - `instanceVibration` - vibration offset in world space
   - `instanceSympathyGlow` - glow intensity multiplier
   - `instanceSympathyScale` - scale multiplier
   - Wave offset applied to transformation matrix

4. **GameLogic Integration** (`/src/systems/GameLogic.js`)
   - Events emitted before destruction:
     - `matchesFound` - for match-3 chains
     - `bombActivating` - for bomb explosions
     - `lightningActivating` - for lightning chains
   - Configurable delay before actual destruction

### Event Flow

1. **Detection Phase**
   - Game detects matches or power-up activation
   - Emits appropriate event with affected bubbles

2. **Analysis Phase**
   - SympathyPopEffect analyzes destruction chain
   - Calculates wave groups based on distance
   - Creates wave propagation schedule

3. **Effect Phase**
   - Applies effects to each wave group sequentially
   - Ramps up intensity over time
   - Spawns particles and updates visuals

4. **Destruction Phase**
   - After delay, bubbles are actually destroyed
   - Effects are cleaned up
   - Score and combos are applied

## Configuration

Key parameters in `SympathyPopEffect.config`:

```javascript
{
    // Wave propagation
    waveSpeed: 8.0,        // Bubbles per second
    waveDelay: 50,         // ms between wave levels
    
    // Vibration
    baseVibration: 0.02,   // Minimum vibration
    maxVibration: 0.15,    // Maximum vibration
    
    // Glow
    baseGlow: 0.1,         // Minimum glow
    maxGlow: 0.8,          // Maximum glow
    glowPulseSpeed: 8.0,   // Pulse frequency
    
    // Scale
    maxScale: 1.15,        // Maximum scale multiplier
    scaleOscillation: 12.0 // Scale pulse frequency
}
```

## Testing

Use `test-sympathy-pop.html` to test the effect:
1. Open the test file in a browser
2. Click "Reset Test Grid" to create bubbles
3. Test different trigger types:
   - Match Chain - standard match-3 effect
   - Bomb Effect - radial shockwave
   - Lightning Effect - sequential chain

## Performance Considerations

- Effects only update bubbles that need it (conditional updates)
- Particle spawning has intensity threshold to limit count
- Wave groups limit simultaneous processing
- Cleanup ensures no memory leaks
- Instanced rendering minimizes draw calls

## Visual Impact

The Sympathy Pop effect dramatically enhances the game feel by:
- Creating anticipation before destruction
- Making chain reactions more visually satisfying
- Adding depth through layered animations
- Providing clear visual feedback for game mechanics
- Creating memorable "juice" moments

## Future Enhancements

Potential improvements:
- Color-coded effects for different power-ups
- Directional wave patterns for special effects
- Screen distortion near epicenter
- Dynamic lighting that pulses with waves
- Sound synchronization with visual beats