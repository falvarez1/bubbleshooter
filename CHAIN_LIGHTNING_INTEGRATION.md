# Chain Lightning Enhanced Visual Effects - Integration Guide

## Overview
This document provides the complete integration steps for the enhanced Chain Lightning power-up visual effects in the Three.js bubble shooter game.

## Visual Effects Implemented

### 1. **Dark Storm Core with Custom Shader**
- Near-black base with blue tint (0x001133)
- Custom GLSL shader with:
  - Plasma effect using noise functions
  - Electrical discharge patterns
  - Fresnel rim lighting
  - Random electrical flashes
  - Vertex displacement for organic warping

### 2. **Multi-Layered Plasma Core**
- Inner hot core with white-to-cyan gradient
- Middle plasma layer with chaotic movement
- Pulsing animations at different frequencies
- Additive blending for energy appearance

### 3. **Procedural Lightning System**
- 4 animated surface arcs with branching patterns
- Dynamic path generation using sine waves
- Chaotic electrical behavior with jitter
- Random disappearance/reappearance for realism
- Custom shader with color interpolation

### 4. **Energy Field Particles**
- 20 orbiting energy particles
- Complex orbital motion with vertical oscillation
- Flickering opacity with occasional brightness boosts
- Mixed white and cyan colors

### 5. **Electrical Discharge Events**
- 2% chance per frame for discharge
- Bright flash with intensity boost to 2.5x
- Radial particle burst
- Automatic intensity reset

### 6. **Screen-Space Distortion (Optional)**
- ElectricalDistortionPass for post-processing
- Warping effect around the bubble
- Chromatic aberration
- Spiral distortion for vortex effect

## Integration Steps

### Step 1: Update Main.js for Distortion Pass (Optional)

```javascript
// In main.js, after importing post-processing
import { ElectricalDistortionPass, ChainLightningDistortionManager } from './graphics/ElectricalDistortionPass.js';

// In the constructor, after setting up post-processing
this.electricalDistortionPass = new ElectricalDistortionPass();
this.postProcessingManager.addPass(this.electricalDistortionPass);
this.chainLightningDistortionManager = new ChainLightningDistortionManager(this.electricalDistortionPass);

// Share with GameManager
this.gameManager.chainLightningDistortionManager = this.chainLightningDistortionManager;
```

### Step 2: Register Chain Lightning Power-Up

```javascript
// Already in main.js
this.gameManager.powerUpSystem.registerPowerUp(new ChainLightningPowerUp());
```

### Step 3: Handle Bubble Creation with Distortion

When a Chain Lightning bubble is created:

```javascript
// In GameLogic or wherever bubbles are spawned
if (bubble.powerUpType === 'chainLightning' && this.chainLightningDistortionManager) {
    this.chainLightningDistortionManager.addChainLightningDistortion(bubble);
}
```

### Step 4: Handle Bubble Destruction

When a Chain Lightning bubble is destroyed:

```javascript
// In the bubble destruction handler
if (bubble.powerUpType === 'chainLightning' && this.chainLightningDistortionManager) {
    this.chainLightningDistortionManager.removeChainLightningDistortion(bubble);
}
```

### Step 5: Performance Optimization Settings

For lower-end devices, you can disable certain effects:

```javascript
// Performance profiles
const HIGH_PERFORMANCE = {
    plasmaCore: true,
    energyField: true,
    lightningArcs: true,
    electricalDischarges: true,
    distortionEffect: true,
    particleCount: 20
};

const MEDIUM_PERFORMANCE = {
    plasmaCore: true,
    energyField: true,
    lightningArcs: true,
    electricalDischarges: true,
    distortionEffect: false,
    particleCount: 10
};

const LOW_PERFORMANCE = {
    plasmaCore: true,
    energyField: false,
    lightningArcs: true,
    electricalDischarges: false,
    distortionEffect: false,
    particleCount: 5
};
```

## Shader Variables for Customization

### Main Bubble Shader Uniforms
- `baseColor`: Dark storm core color (default: 0x001133)
- `glowColor`: Electric blue glow (default: 0x00ddff)
- `hotColor`: White-hot accents (default: 0xffffff)
- `electricIntensity`: Intensity of electrical effects (0.0 - 2.5)
- `distortionAmount`: Vertex displacement amount (0.0 - 0.2)
- `plasmaSpeed`: Speed of plasma animation (1.0 - 4.0)

### Performance Considerations

1. **GPU Optimization**:
   - All shaders use optimized noise functions
   - Minimize texture lookups
   - Use LOD for particle effects based on distance

2. **CPU Optimization**:
   - Update intervals staggered to prevent frame drops
   - Particle pooling for efficient memory usage
   - Conditional rendering based on visibility

3. **Memory Management**:
   - Dispose of geometries and materials when bubbles are destroyed
   - Clear intervals and timeouts properly
   - Limit maximum number of simultaneous effects

## Visual Effect Tuning

### For More Dramatic Effects
```javascript
// Increase these values in ChainLightningPowerUp.js
electricIntensity: { value: 1.5 },  // More intense electrical patterns
distortionAmount: { value: 0.15 },   // More vertex warping
plasmaSpeed: { value: 3.0 }          // Faster plasma animation
```

### For Subtler Effects
```javascript
// Decrease these values
electricIntensity: { value: 0.7 },
distortionAmount: { value: 0.05 },
plasmaSpeed: { value: 1.5 }
```

## Bloom Integration

The Chain Lightning effects are designed to work with the existing bloom post-processing:

1. White-hot colors (0xffffff) will bloom intensely
2. Electric blue (0x00ddff) provides medium bloom
3. Dark core (0x001133) provides contrast

Adjust bloom threshold and intensity in the post-processing setup:
```javascript
bloomPass.threshold = 0.8;    // Lower for more bloom
bloomPass.strength = 1.5;     // Higher for stronger bloom
bloomPass.radius = 0.4;       // Bloom spread
```

## Testing the Effects

1. **Force spawn Chain Lightning bubble**:
```javascript
// In console
window.FORCED_NEXT_BUBBLE_TYPE = 'chainLightning';
```

2. **Test electrical discharge**:
```javascript
// Temporarily increase discharge chance
// In animation update: if (Math.random() < 0.1) // 10% instead of 2%
```

3. **Monitor performance**:
```javascript
// Check FPS and memory usage
window.performanceManager.getStatus();
```

## Troubleshooting

### Effects Not Visible
- Check if bubble.mesh.material is properly set
- Verify shader compilation (check console for errors)
- Ensure animation update is being called

### Performance Issues
- Reduce particle count
- Disable distortion effect
- Lower arc segment count
- Reduce discharge frequency

### Visual Artifacts
- Check blending modes (should be Additive for energy effects)
- Verify depth testing settings
- Ensure proper disposal of resources

## Future Enhancements

1. **Advanced Lightning Branching**: Implement recursive branching for more realistic lightning
2. **Heat Distortion**: Add heat shimmer effect using screen-space refraction
3. **Volumetric Lightning**: Use ray marching for volumetric electrical effects
4. **Dynamic Environment Interaction**: Lightning reflects off nearby metallic surfaces
5. **Chain Reaction Visuals**: Enhanced visual connections between chained bubbles