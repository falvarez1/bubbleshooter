# Bubble Special Effects Guide

This guide explains the configurable special effects available for the instanced bubble renderer and how to use them.

## Available Effects

### Core Rendering Effects
- **enablePBR**: Physically Based Rendering with proper BRDF calculations
- **enableTransmission**: Glass-like transparency and light transmission
- **enableClearcoat**: Glossy outer layer simulation (like car paint)
- **enableSheen**: Soft fabric-like highlights
- **enableEnvironmentMap**: Environment reflections on bubble surface

### Animation Effects
- **enablePulse**: Subtle size pulsing animation
- **enableColorShift**: Chromatic aberration and color variations
- **enableDistortion**: Heat/water-like distortion on the surface
- **enableSparkles**: Sparkle particles inside the bubbles
- **enableRainbow**: Iridescent rainbow effect based on viewing angle

### Advanced Effects
- **enableSubsurface**: Subsurface scattering for translucent appearance
- **enableCaustics**: Light caustics patterns (light focusing through glass)
- **enableFoam**: Soap foam texture on the surface
- **enableWobble**: Vertex wobble animation for organic movement
- **enableHolographic**: Holographic rainbow stripes (performance heavy)

## Usage Examples

### Basic Usage

```javascript
// Get the bubble instances renderer
const bubbleInstances = game.bubbleInstances;

// Toggle individual effects
bubbleInstances.setEffect('enableSparkles', true);
bubbleInstances.setEffect('enableRainbow', true);
bubbleInstances.setEffect('enableHolographic', false);

// Set multiple effects at once
bubbleInstances.setEffects({
    enableSparkles: true,
    enableRainbow: true,
    enableCaustics: true,
    enableFoam: false
});

// Get current effect settings
const currentEffects = bubbleInstances.getEffects();
console.log(currentEffects);
```

### Quality Presets

The system includes predefined quality presets for different performance levels:

```javascript
// Set quality preset
bubbleInstances.setQualityPreset('high'); // Options: 'low', 'medium', 'high', 'ultra'
```

#### Preset Details:

**Low Quality** (Best Performance)
- Basic rendering without PBR
- No special effects
- Suitable for low-end devices

**Medium Quality**
- PBR rendering enabled
- Basic transmission and environment mapping
- Pulse animation only
- Good balance for mid-range devices

**High Quality**
- Full PBR with clearcoat and sheen
- Multiple animation effects (pulse, color shift, sparkles)
- Rainbow iridescence
- Wobble animation
- Recommended for modern devices

**Ultra Quality** (Maximum Visual Fidelity)
- All effects enabled including:
  - Subsurface scattering
  - Caustics
  - Foam texture
  - Distortion
  - Holographic effect
- Requires high-end GPU

### Performance Considerations

1. **Start with a preset**: Use quality presets as a baseline
2. **Test incrementally**: Enable effects one by one to measure performance impact
3. **Monitor FPS**: Use the browser's performance tools to ensure smooth gameplay
4. **Device-specific settings**: Consider detecting device capabilities and adjusting accordingly

### Integration with Game Settings

You can integrate these effects with a settings menu:

```javascript
// Example settings integration
class GraphicsSettings {
    constructor(bubbleInstances) {
        this.bubbleInstances = bubbleInstances;
    }
    
    applySettings(settings) {
        // Apply quality preset first
        this.bubbleInstances.setQualityPreset(settings.quality);
        
        // Then apply custom overrides
        if (settings.customEffects) {
            this.bubbleInstances.setEffects(settings.customEffects);
        }
    }
    
    // Save current settings
    saveSettings() {
        return {
            effects: this.bubbleInstances.getEffects()
        };
    }
}
```

### Dynamic Effect Control

Effects can be toggled during gameplay for special moments:

```javascript
// Enable special effects during power-up activation
function activatePowerUp() {
    bubbleInstances.setEffect('enableHolographic', true);
    bubbleInstances.setEffect('enableSparkles', true);
    
    // Disable after duration
    setTimeout(() => {
        bubbleInstances.setEffect('enableHolographic', false);
    }, 5000);
}

// Adjust effects based on game state
function onBossLevel() {
    bubbleInstances.setEffects({
        enableRainbow: true,
        enableCaustics: true,
        enableDistortion: true
    });
}
```

## Effect Combinations

Some effects work particularly well together:

### Glass Bubble Look
```javascript
bubbleInstances.setEffects({
    enablePBR: true,
    enableTransmission: true,
    enableClearcoat: true,
    enableEnvironmentMap: true
});
```

### Magical Bubble Look
```javascript
bubbleInstances.setEffects({
    enableRainbow: true,
    enableSparkles: true,
    enablePulse: true,
    enableColorShift: true
});
```

### Soap Bubble Look
```javascript
bubbleInstances.setEffects({
    enableTransmission: true,
    enableRainbow: true,
    enableFoam: true,
    enableWobble: true
});
```

### Underwater Look
```javascript
bubbleInstances.setEffects({
    enableCaustics: true,
    enableDistortion: true,
    enableSubsurface: true,
    enableWobble: true
});
```

## Troubleshooting

- **Performance Issues**: Start with 'low' preset and gradually enable effects
- **Visual Artifacts**: Disable 'enableDistortion' if seeing rendering issues
- **Mobile Compatibility**: Use 'medium' preset or lower for mobile devices
- **Effect Not Visible**: Ensure the effect is compatible with current lighting setup

## Future Enhancements

The effect system is designed to be extensible. New effects can be added by:
1. Adding the effect toggle to the `effects` object
2. Adding the corresponding uniform to the shader
3. Implementing the effect logic in the fragment shader
4. Updating the quality presets as needed