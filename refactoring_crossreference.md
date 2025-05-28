# Refactoring Cross-Reference Guide

## Function & Feature Mapping

This document maps every existing function and feature to its destination in the refactored architecture.

### 🎮 Core Game Functions

| Current Function/Feature | Current Location | New Module | Notes |
|-------------------------|------------------|------------|-------|
| `gameState` object | Lines 3011-3032 | `src/core/GameState.js` | Convert to class with private fields |
| `animate()` main loop | Lines 5048-5221 | `src/core/Game.js` | Main game loop |
| `createGameBoard()` | Lines 3450-3480 | `src/graphics/SceneManager.js` | Scene initialization |
| `createInitialBubbles()` | Lines 3888-3946 | `src/entities/Grid.js` | Grid population |
| `createShootingBubble()` | Lines 4692-4715 | `src/entities/BubbleFactory.js` | Bubble creation |
| `shootBubble()` | Lines 4734-4756 | `src/systems/ShootingSystem.js` | Shooting mechanics |
| `updateBubble()` | Lines 4036-4073 | `src/systems/PhysicsSystem.js` | Physics update |
| `checkBubbleCollisions()` | Lines 3736-3886 | `src/systems/CollisionSystem.js` | Collision detection |
| `attachBubbleToGrid()` | Lines 4000-4034 | `src/entities/Grid.js` | Grid attachment |
| `findConnectedBubbles()` | Lines 4180-4211 | `src/systems/MatchingSystem.js` | Match detection |
| `removeBubble()` | Lines 4215-4235 | `src/entities/Grid.js` | Bubble removal |
| `checkForFloatingBubbles()` | Lines 4257-4285 | `src/systems/MatchingSystem.js` | Floating detection |
| `removeFloatingBubbles()` | Lines 4288-4332 | `src/systems/MatchingSystem.js` | Floating removal |

### 🌟 Power-Up System

| Current Class/Function | Current Location | New Module | Notes |
|-----------------------|------------------|------------|-------|
| `PowerUp` base class | Lines 1741-1766 | `src/powerups/PowerUp.js` | Base class |
| `RainbowPowerUp` | Lines 1789-1825 | `src/powerups/RainbowPowerUp.js` | |
| `BombPowerUp` | Lines 1828-1876 | `src/powerups/BombPowerUp.js` | |
| `ChainLightningPowerUp` | Lines 1879-2301 | `src/powerups/LightningPowerUp.js` | |
| `PrecisionAimPowerUp` | Lines 2303-2383 | `src/powerups/PrecisionAimPowerUp.js` | |
| `ColorSplashPowerUp` | Lines 2385-2822 | `src/powerups/ColorSplashPowerUp.js` | |
| `PowerUpSystem` | Lines 2825-2890 | `src/powerups/PowerUpSystem.js` | Manager class |

### 🎨 Visual Effects

| Current Function/System | Current Location | New Module | Notes |
|------------------------|------------------|------------|-------|
| `Particle` class | Lines 3289-3308 | `src/graphics/Particle.js` | Legacy wrapper |
| `ParticlePool` class | Lines 3186-3286 | `src/systems/ParticleSystem.js` | Pool management |
| `createExplosionEffect()` | Lines 4339-4368 | `src/effects/ExplosionEffect.js` | |
| `createPopEffect()` | Lines 4371-4391 | `src/effects/PopEffect.js` | |
| `StarfieldLayer` class | Lines 3333-3447 | `src/graphics/Background.js` | |
| Screen shake | In GameManager | `src/effects/ScreenShake.js` | |
| Lightning effects | In LightningPowerUp | `src/effects/LightningEffect.js` | |
| Glow effects | Various locations | `src/effects/GlowEffect.js` | |

### 🔊 Audio System

| Current Class/Function | Current Location | New Module | Notes |
|-----------------------|------------------|------------|-------|
| `SoundManager` class | Lines 1520-1738 | `src/systems/AudioSystem.js` | Enhanced version |
| `AudioSystem` class | Lines 1275-1350 | `src/systems/AudioSystem.js` | Merge with SoundManager |
| Sound definitions | Lines 1532-1575 | `src/config/AudioConfig.js` | |

### 🎯 Input System

| Current Function | Current Location | New Module | Notes |
|-----------------|------------------|------------|-------|
| Mouse event handlers | Lines 4757-4845 | `src/systems/InputSystem.js` | |
| Touch event handlers | Lines 4846-4910 | `src/systems/InputSystem.js` | |
| Trajectory calculation | Lines 4489-4580 | `src/entities/Trajectory.js` | |
| `renderTrajectory()` | Lines 4583-4689 | `src/graphics/TrajectoryRenderer.js` | |

### 📊 Configuration

| Current Object | Current Location | New Module | Notes |
|---------------|------------------|------------|-------|
| `CONFIG` | Lines 1357-1379 | `src/config/GameConfig.js` | |
| `PARTICLE_CONFIG` | Lines 1382-1437 | `src/config/ParticleConfig.js` | |
| `PARTICLE_PRESETS` | Lines 1440-1477 | `src/config/ParticleConfig.js` | |

### 🖼️ UI Components

| Current Element | Current Location | New Module | Notes |
|----------------|------------------|------------|-------|
| Score display | HTML + inline JS | `src/ui/HUD.js` | |
| Combo display | HTML + inline JS | `src/ui/ComboDisplay.js` | |
| Power meter | HTML + inline JS | `src/ui/PowerMeter.js` | |
| Next bubble preview | HTML + inline JS | `src/ui/NextBubblePreview.js` | |
| Settings panel | HTML + inline JS | `src/ui/SettingsPanel.js` | |
| Game over screen | HTML + inline JS | `src/ui/GameOverScreen.js` | |

### 🏗️ Three.js Components

| Current Setup | Current Location | New Module | Notes |
|--------------|------------------|------------|-------|
| Scene creation | Lines 2949-2965 | `src/graphics/SceneManager.js` | |
| Camera setup | Lines 2967-2972 | `src/graphics/CameraManager.js` | |
| Renderer setup | Lines 2974-2985 | `src/graphics/RendererManager.js` | |
| Lighting setup | Lines 2987-3008 | `src/graphics/Lighting.js` | |
| Materials | Various locations | `src/graphics/Materials.js` | |

### 🔧 Utility Functions

| Current Function | Current Location | New Module | Notes |
|-----------------|------------------|------------|-------|
| `EventBus` class | Lines 1498-1517 | `src/core/EventBus.js` | |
| `VisualTextDisplay` | Lines 1498-1601 | `src/ui/TextEffects.js` | |
| Hex calculations | Inline functions | `src/utils/HexGrid.js` | |
| Math utilities | Various locations | `src/utils/Math.js` | |
| Animation helpers | Various locations | `src/utils/Animation.js` | |

## 🔄 Data Flow Mapping

### Before Refactoring
```
index.html
    └── Inline JavaScript
        ├── Global variables
        ├── Direct DOM manipulation
        ├── Event listeners
        └── All game logic
```

### After Refactoring
```
index.html
    └── main.js (entry point)
        ├── Game.js
        │   ├── GameState.js
        │   ├── EventBus.js
        │   └── Systems
        ├── SceneManager.js
        │   ├── Renderer
        │   ├── Camera
        │   └── Lighting
        └── UI Manager
            ├── HUD
            ├── Menus
            └── Overlays
```

## ⚠️ Critical Dependencies

### Function Interdependencies
1. **Bubble shooting** → Trajectory → Physics → Collision → Grid attachment
2. **Match detection** → Bubble removal → Floating detection → Score update
3. **Power-ups** → Visual effects → Audio → UI updates → Game state

### Shared Resources
1. **Three.js Scene**: Used by all visual components
2. **gameState**: Accessed by most systems
3. **EventBus**: Central communication hub
4. **ParticlePool**: Shared by all effects

### Timing Dependencies
1. **Resource loading** must complete before game start
2. **Audio context** requires user interaction
3. **Particle pool** initialization before any effects
4. **Power-up registration** before bubble creation

## ✅ Testing Checklist

### Unit Test Coverage
- [ ] Each class has corresponding test file
- [ ] All public methods have tests
- [ ] Edge cases covered
- [ ] Mock dependencies properly

### Integration Tests
- [ ] Game flow (start → play → game over)
- [ ] Power-up activation sequences
- [ ] Scoring system
- [ ] Audio playback
- [ ] UI interactions

### Visual Regression Tests
- [ ] Particle effects render correctly
- [ ] Power-up visuals
- [ ] UI element positioning
- [ ] Animation smoothness

### Performance Tests
- [ ] Frame rate monitoring
- [ ] Memory usage
- [ ] Particle system stress test
- [ ] Large grid scenarios

## 🚨 Risk Mitigation

### High-Risk Areas
1. **Three.js Scene Management**: Complex dependencies
   - Mitigation: Careful module boundaries
   
2. **Event System**: Central to game flow
   - Mitigation: Comprehensive testing
   
3. **Particle Pool**: Performance critical
   - Mitigation: Benchmark before/after
   
4. **Power-Up Effects**: Complex visual sequences
   - Mitigation: State machine implementation

### Rollback Points
1. After each major system extraction
2. Before UI refactoring
3. Before final integration
4. After performance optimization

## 📈 Success Metrics

1. **Code Metrics**
   - Lines of code per module: <300
   - Cyclomatic complexity: <10
   - Test coverage: >80%

2. **Performance Metrics**
   - Maintain 60 FPS
   - Memory usage: <100MB
   - Load time: <3 seconds

3. **Quality Metrics**
   - Zero functionality loss
   - No new bugs introduced
   - Improved developer experience