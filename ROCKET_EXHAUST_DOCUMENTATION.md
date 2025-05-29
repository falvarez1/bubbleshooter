# Rocket Exhaust Particle System Documentation

## Overview

The Rocket Exhaust Particle System creates realistic spark-like particle effects that simulate rocket or thruster exhaust when shooting bubbles. Particles shoot in the opposite direction of the bubble trajectory, creating a convincing propulsion effect that scales with shooting power.

## Configuration Location

All rocket exhaust parameters are configured in `/src/core/Config.js` under `PARTICLE_CONFIG.rocketExhaust`.

## Configuration Parameters

### Base Particle Counts
```javascript
baseParticles: 4,           // Base number of exhaust sparks
powerMultiplier: 1.2,       // Multiplier for high power (1x to 2.2x)
burstParticles: 6,          // Extra particles for power burst
burstThreshold: 0.6,        // Power level to trigger burst
```

**Usage:** Controls how many particles are spawned based on shooting power.
- Low power (0.0): 4 particles
- Medium power (0.5): ~6 particles  
- High power (1.0): ~9 particles + burst

### Spark Geometry
```javascript
sparkBaseSize: 0.05,        // Base spark size
sparkPowerSize: 0.03,       // Additional size per power unit
sparkLength: 4.0,           // Length multiplier for cylinder
sparkTaper: {
    base: 0.3,              // Base width ratio
    tip: 0.1                // Tip width ratio
},
sparkSegments: 4,           // Radial segments for performance
```

**Usage:** Defines the 3D shape of individual spark particles.
- Sparks are elongated cylinders (4x length)
- Tapered from base (0.3x) to tip (0.1x)
- Low polygon count (4 segments) for performance

### Exhaust Physics
```javascript
baseSpeed: 4,               // Minimum exhaust velocity
maxSpeed: 10,               // Maximum exhaust velocity  
speedVariation: 0.6,        // Random speed variation (±30%)
coneSpread: {
    base: 0.3,              // Base cone angle (radians)
    power: 0.5              // Additional spread per power unit
},
burstConeAngle: 0.4,        // Burst particle cone angle
```

**Usage:** Controls realistic exhaust physics and spread patterns.
- Speed scales from 4 to 10 units based on power
- Cone spreads from ~17° to ~45° based on power
- Burst uses tighter ~23° cone for focused effect

### Visual Properties
```javascript
colors: {
    low: 0x1e90ff,          // Blue for low power
    medium: 0xff8c00,       // Dark orange for medium power
    high: 0xff4500,         // Bright orange-red for high power
    burst: {
        intensity: 0.8,     // Base white intensity
        yellow: 0.9,        // Yellow component
        orange: 0.3         // Orange component  
    }
},
colorThresholds: {
    medium: 0.4,            // Power level for medium color
    high: 0.7               // Power level for high color
},
```

**Usage:** Defines color progression that simulates realistic thruster heat.
- Cold thrusters (low power): Blue
- Warming thrusters (medium power): Orange
- Hot thrusters (high power): Bright orange-red
- Maximum power burst: Hot white/yellow

### Material Properties
```javascript
opacity: 0.9,               // Base spark opacity
blending: 'additive',       // Blending mode for bright sparks
depthWrite: false,          // Allow overlapping sparks
```

**Usage:** Controls how sparks appear and blend with the scene.
- High opacity for visible bright sparks
- Additive blending for realistic bright overlapping
- Disabled depth writing for proper layering

### Animation Properties
```javascript
decay: 0.04,                // How fast sparks fade
shrinkRate: 0.97,           // Scale reduction per frame
burstDecay: 0.08,           // Faster decay for burst sparks
orientToVelocity: true,     // Align sparks with movement
minVelocityForOrientation: 0.1  // Minimum velocity to maintain orientation
```

**Usage:** Controls particle behavior over time.
- Sparks fade quickly (25 frames @ 60fps)
- Shrink by 3% each frame for natural dissipation
- Burst sparks fade twice as fast for flash effect
- Automatic orientation along flight path

## Performance Presets

The system includes performance scaling across four quality levels:

### Low Performance
```javascript
rocketExhaust: { baseParticles: 2, burstParticles: 3, sparkSegments: 3 }
```
- 50% fewer particles
- Lower geometry detail

### Medium Performance  
```javascript
rocketExhaust: { baseParticles: 3, burstParticles: 4, sparkSegments: 4 }
```
- 25% fewer particles
- Standard geometry detail

### High Performance
```javascript
rocketExhaust: { baseParticles: 4, burstParticles: 6, sparkSegments: 4 }
```
- Full particle count (default)
- Standard geometry detail

### Ultra Performance
```javascript
rocketExhaust: { baseParticles: 5, burstParticles: 8, sparkSegments: 6 }
```
- 25% more particles
- Higher geometry detail

## Implementation Details

### Particle Creation
Location: `/src/entities/Particle.js` - `createParticle()`

```javascript
// Create elongated spark geometry instead of sphere
geometry = new THREE.CylinderGeometry(
    size * config.sparkTaper.base,  // Base radius
    size * config.sparkTaper.tip,   // Tip radius
    size * config.sparkLength,      // Height
    config.sparkSegments,           // Radial segments
    1                               // Height segments
);
```

### Material Setup
```javascript
const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: config.opacity,
    blending: config.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: config.depthWrite,
    side: THREE.DoubleSide
});
```

### Exhaust Direction Calculation
Location: `/src/main.js` - `createShootingEffect()`

```javascript
// Calculate the shooting direction from current bubble to mouse position
const shootingDirection = new THREE.Vector3(
    this.gameState.mousePosition.x - this.gameState.currentBubble.position.x,
    this.gameState.mousePosition.y - this.gameState.currentBubble.position.y,
    0
).normalize();

// Create rocket exhaust effect - particles go opposite to shooting direction
const exhaustDirection = shootingDirection.clone().multiplyScalar(-1);
```

### Cone Spread Calculation
```javascript
// Create cone-shaped exhaust spread using config
const spreadAngle = (power * config.coneSpread.power + config.coneSpread.base) * Math.PI;
const randomAngle = (Math.random() - 0.5) * spreadAngle;

// Add perpendicular spread for cone effect
const perpendicular = new THREE.Vector3(-exhaustDirection.y, exhaustDirection.x, 0);
exhaustVel.add(perpendicular.clone().multiplyScalar(Math.sin(randomAngle) * randomDistance));
```

### Spark Orientation
```javascript
// Orient spark along velocity direction for realistic exhaust
if (config.orientToVelocity && velocity && velocity.length() > config.minVelocityForOrientation) {
    const direction = velocity.clone().normalize();
    particle.mesh.lookAt(
        particle.position.x + direction.x,
        particle.position.y + direction.y,
        particle.position.z + direction.z
    );
}
```

## Customization Guide

### Adjusting Visual Intensity

**More Dramatic Effects:**
```javascript
baseParticles: 6,           // +50% particles
powerMultiplier: 1.5,       // Wider power scaling
opacity: 1.0,               // Full brightness
```

**Subtle Effects:**
```javascript
baseParticles: 2,           // -50% particles  
powerMultiplier: 0.8,       // Narrower power scaling
opacity: 0.6,               // Dimmer sparks
```

### Changing Exhaust Colors

**Hot Engine Theme:**
```javascript
colors: {
    low: 0xff6600,          // Orange for low power
    medium: 0xff3300,       // Red-orange for medium
    high: 0xff0000,         // Pure red for high power
}
```

**Electric Theme:**
```javascript
colors: {
    low: 0x00ffff,          // Cyan for low power
    medium: 0x0080ff,       // Blue for medium  
    high: 0x8000ff,         // Purple for high power
}
```

### Performance Tuning

**High-End Devices:**
```javascript
baseParticles: 8,           // More particles
burstParticles: 12,         // More burst particles
sparkSegments: 8,           // Higher detail geometry
decay: 0.02,                // Slower fade for longer trails
```

**Low-End Devices:**
```javascript
baseParticles: 2,           // Fewer particles
burstParticles: 2,          // Minimal burst
sparkSegments: 3,           // Lower detail geometry
decay: 0.08,                // Faster fade to reduce load
```

### Physics Adjustments

**Tighter Exhaust:**
```javascript
coneSpread: {
    base: 0.2,              // Narrower base cone
    power: 0.3              // Less power spreading
},
speedVariation: 0.3,        // More uniform speeds
```

**Wider Exhaust:**
```javascript
coneSpread: {
    base: 0.5,              // Wider base cone
    power: 0.8              // More power spreading
},
speedVariation: 0.8,        // More speed variation
```

## Debugging Tools

### Visual Debugging
Add to browser console to adjust parameters in real-time:
```javascript
// Increase particle count
PARTICLE_CONFIG.rocketExhaust.baseParticles = 8;

// Change exhaust color
PARTICLE_CONFIG.rocketExhaust.colors.low = 0x00ff00; // Green

// Adjust cone spread
PARTICLE_CONFIG.rocketExhaust.coneSpread.base = 0.5;
```

### Performance Monitoring
```javascript
// Check active particle count
console.log('Active particles:', game.gameState.particlePool.activeParticles?.length || 'GPU system');

// Monitor frame rate impact
const before = performance.now();
// Shoot bubble
const after = performance.now();
console.log('Particle spawn time:', after - before, 'ms');
```

## Technical Notes

### Memory Management
- Particles are pooled and reused to prevent garbage collection
- Geometry is cached and shared between particles
- Materials are lightweight MeshBasicMaterial for performance

### Compatibility
- GPU particle system automatically falls back to CPU on unsupported devices
- Performance presets automatically scale based on device capabilities
- Works with both WebGL 1.0 and 2.0 contexts

### Optimization Tips
1. **Reduce `sparkSegments`** for better performance on mobile
2. **Increase `decay`** rate to reduce particle lifetime on slow devices
3. **Lower `baseParticles`** count for constrained memory environments
4. **Disable `orientToVelocity`** to reduce CPU calculations per frame

## File Dependencies

- `/src/core/Config.js` - Configuration parameters
- `/src/entities/Particle.js` - Particle creation and behavior
- `/src/main.js` - Exhaust effect generation and physics
- `/src/graphics/GPUParticles.js` - GPU particle fallback (optional)

## Future Enhancements

Potential improvements that could be added:
- Temperature-based color cycling within individual sparks
- Smoke trail particles for atmospheric effects  
- Spark collision with bubble surfaces for deflection
- Variable exhaust intensity based on bubble mass/type
- Procedural exhaust sound generation correlation