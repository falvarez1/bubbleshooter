# Selective Bloom Implementation for Trajectory System

## Overview
This document describes the working selective bloom implementation for the bubble shooter game's trajectory line. The implementation uses Three.js's built-in post-processing system with UnrealBloomPass and layer-based selective rendering.

## Implementation Approach

### Key Technique: Layer-Based Multi-Pass Rendering
The solution uses a multi-pass rendering approach with Three.js layers:
- **Layer 0**: Default layer (no bloom)
- **Layer 1**: Bloom layer (objects that should glow)

### Rendering Pipeline
1. **Pass 1**: Render scene with non-bloom objects darkened (black material)
2. **Pass 2**: Apply UnrealBloomPass to create the glow effect
3. **Pass 3**: Render normal scene 
4. **Pass 4**: Composite bloom texture on top with additive blending

## Core Components

### 1. PostProcessingManager (`src/graphics/PostProcessingManager.js`)
- Uses Three.js's built-in `EffectComposer`, `RenderPass`, and `UnrealBloomPass`
- Implements material swapping technique for selective bloom
- Manages layer-based object registration
- Handles multi-pass rendering pipeline

Key features:
- Dynamic bloom object registration/unregistration
- Material caching for performance
- Configurable bloom parameters (strength, radius, threshold)
- Debug mode with visual feedback

### 2. TrajectorySystemBloom (`src/systems/TrajectorySystemBloom.js`)
- Enhanced trajectory rendering with bloom-optimized materials
- Uses high emissive intensity (3.0-4.0) for strong glow
- Tone mapping disabled to prevent dimming
- Dynamic bloom registration (only when visible)

Material configuration:
```javascript
// Main beam material
{
    emissive: color,
    emissiveIntensity: 3.0,
    toneMapped: false,  // Critical for bright bloom
    opacity: 1.0
}
```

### 3. BloomDebugger (`src/utils/BloomDebugger.js`)
- Real-time bloom parameter adjustment
- Visual debug panel with sliders
- Test object creation for validation
- Performance monitoring

## Setup Requirements

### Import Configuration
The implementation uses Three.js's built-in post-processing, loaded from examples:
```javascript
// SceneManager.js
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
```

### HTML Import Map
```html
<script type="importmap">
{
    "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js",
        "three/examples/": "https://cdn.jsdelivr.net/npm/three@0.158.0/examples/"
    }
}
</script>
```

## Usage

### Adding Objects to Bloom
```javascript
// Register object for bloom
postProcessingManager.addBloomObject(trajectoryMesh);

// Remove from bloom
postProcessingManager.removeBloomObject(trajectoryMesh);
```

### Configuring Bloom Parameters
```javascript
postProcessingManager.setBloomParams({
    strength: 1.5,    // Intensity of glow
    radius: 0.5,      // Spread of bloom
    threshold: 0.0    // Brightness threshold
});
```

## Performance Optimizations

1. **Material Caching**: Original materials cached with WeakMap to avoid memory leaks
2. **Layer-Based Culling**: Only objects on bloom layer processed during bloom pass
3. **Dynamic Registration**: Objects only registered when visible
4. **Geometry Reuse**: Trajectory geometry updated rather than recreated

## Debugging

Enable debug mode to see bloom statistics and controls:
```javascript
// In main.js or initialization
window.bloomDebug = new BloomDebugger(postProcessingManager);
```

Debug panel shows:
- Current bloom parameters
- Number of registered bloom objects
- Real-time parameter adjustment sliders
- Test object creation button

## Common Issues and Solutions

### Issue: No Bloom Visible
**Solution**: Ensure materials have high emissive intensity and toneMapped: false

### Issue: Everything Glows
**Solution**: Check layer assignments - only bloom objects should be on Layer 1

### Issue: Performance Impact
**Solution**: Reduce bloom resolution or limit number of bloom objects

## References

Implementation based on these techniques:
- [Three.js Selective Bloom Discussion](https://discourse.threejs.org/t/glowing-item-looking-through-wall-selective-bloom/43053/4)
- [Unreal Bloom Selective Three.js](https://waelyasmina.net/articles/unreal-bloom-selective-threejs-post-processing/)
- [Post-Processing with Three.js](https://waelyasmina.net/articles/post-processing-with-three-js-the-what-and-how/)

## Key Differences from Previous Attempts

### What Didn't Work:
- pmndrs/postprocessing library's SelectiveBloomEffect
- Single-pass bloom with luminance threshold
- Layer camera switching

### What Works:
- Three.js built-in UnrealBloomPass
- Multi-pass rendering with material swapping
- Layer-based selective rendering
- High emissive materials with disabled tone mapping

## Future Improvements

1. **HDR Support**: Implement HDR rendering for better bloom quality
2. **Bloom Layers**: Support multiple bloom layers with different intensities
3. **Performance Mode**: Automatic quality adjustment based on FPS
4. **Bloom Animations**: Animated bloom intensity for power-ups