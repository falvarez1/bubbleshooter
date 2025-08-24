# Impact Resonance Effect Testing Guide

## Overview
The Impact Resonance effect system provides enhanced visual and physical feedback for all bubble collisions in the game. This creates a more satisfying and juicy gameplay experience.

## Features Implemented

### 1. Elastic Squash & Stretch Deformation
- **Bubble-to-Bubble**: Both bubbles deform elastically on impact
- **Bubble-to-Wall**: Bubble squashes against the wall
- **Velocity Scaling**: Deformation amount scales with impact velocity
- **Volume Preservation**: Bubbles stretch to maintain volume when squashed
- **Elastic Easing**: Natural bounce-back animation with cosine easing

### 2. Harmonic Rings
- **Color-Based Frequency**: Ring pulse frequency determined by color difference
- **Layered Rings**: Multiple rings spawn for high-velocity impacts
- **Color Interpolation**: Rings pulse between the two colliding bubble colors
- **Expansion & Fade**: Rings expand outward while fading
- **Bloom Integration**: Rings use additive blending for enhanced glow

### 3. Color Particle Exchange
- **Bidirectional Flow**: Particles flow from each bubble toward the other
- **Color Transfer**: Particles carry the color of their source bubble
- **Curved Trajectories**: Particles curve toward target bubble
- **Velocity Scaling**: Number and speed of particles based on impact force

### 4. Near-Miss Friction Sparks
- **Grazing Detection**: Detects when bubbles pass very close
- **Orange Sparks**: Friction creates orange-colored spark particles
- **Tangential Motion**: Sparks fly perpendicular to collision normal
- **Sound Feedback**: Unique graze sound effect

### 5. Enhanced Physics
- **Rotational Impact**: Collisions add spin to bubbles
- **Spring Physics**: Existing spring system enhanced with deformation
- **Damped Motion**: Smooth settling after impacts

## Testing Instructions

### Test 1: Basic Bubble Collision
1. Start the game
2. Shoot a bubble directly at another bubble
3. **Expected**: 
   - Both bubbles squash at contact point
   - Harmonic rings pulse outward
   - Color particles exchange between bubbles
   - Impact sound with pitch variation

### Test 2: Wall Bounce
1. Shoot a bubble at an angle to hit the wall
2. **Expected**:
   - Bubble squashes against wall
   - White-tinted ring expands from impact point
   - Wall particles spray away from wall
   - Wall bounce sound effect

### Test 3: High-Velocity Impact
1. Hold down to charge a powerful shot
2. Release for maximum velocity
3. **Expected**:
   - Larger deformation on impact
   - Multiple harmonic rings
   - More color exchange particles
   - Louder impact sound

### Test 4: Near-Miss Graze
1. Shoot a bubble to barely miss another bubble
2. **Expected**:
   - Orange friction sparks at closest approach
   - Subtle graze sound effect
   - No attachment, bubble continues moving

### Test 5: Chain Reactions
1. Create a cluster of same-colored bubbles
2. Shoot to trigger a match
3. **Expected**:
   - Impact effects propagate through cluster
   - Multiple overlapping ring effects
   - Rich particle effects during destruction

### Test 6: Different Color Combinations
1. Shoot bubbles of different colors at each other
2. **Expected**:
   - Ring frequency varies by color difference
   - Sound resonance changes with color pairing
   - Unique visual harmonics for each combination

## Debug Commands

Open the browser console and use these commands to test specific scenarios:

```javascript
// Force spawn a specific colored bubble
game.FORCED_NEXT_BUBBLE_TYPE = 0xFF0000; // Red bubble

// Increase shooting speed for testing
game.gameState.shootingPower = 1.0; // Maximum power

// Check if Impact Resonance is active
game.collisionSystem.impactResonanceEffect

// Monitor active harmonic rings
game.collisionSystem.impactResonanceEffect.activeRings.size

// Check collision pairs for near-misses
game.collisionSystem.impactResonanceEffect.collisionPairs
```

## Performance Considerations

The Impact Resonance effect system is optimized for performance:
- **Object Pooling**: Rings and particles are pooled and reused
- **Spatial Grid**: Efficient near-miss detection using spatial partitioning
- **LOD System**: Effects scale down at distance (if implemented)
- **Frame-Rate Independence**: All animations use deltaTime

## Configuration

The effect can be tuned via CONFIG in `src/core/Config.js`:
- `IMPACT_PHYSICS`: Controls spring physics and deformation
- `BUBBLE_RADIUS`: Affects collision thresholds
- `WALL_LIMIT`: Wall collision boundaries

## Known Limitations

1. **Instanced Rendering**: Deformation effects may not fully work with instanced bubbles
2. **Mobile Performance**: May need to reduce particle count on mobile devices
3. **Sound Variations**: Limited to available sound assets

## Future Enhancements

Potential improvements for even more juice:
1. Screen shake on high-velocity impacts
2. Time dilation (slow-mo) for critical shots
3. Dynamic music tempo based on collision frequency
4. Haptic feedback patterns for different collision types
5. Trail effects showing collision history