# Visual Effects Roadmap

## Overview
This document tracks the implementation of advanced visual effects to enhance the game feel and player satisfaction in the bubble shooter game. Each effect is designed to provide meaningful feedback and scale with player performance.

## Implementation Status

### 1. Magnetic Attraction Field ✅
**Status:** COMPLETED
**Priority:** HIGH
**Description:** When same-colored bubbles get close, create visual attraction effects
**Features:**
- [ ] Warping/distortion shader between matching bubbles
- [ ] Energy tendrils that reach out between same colors
- [ ] Satisfying "snap" with ripple when they connect
- [ ] Intensity scales based on combo potential (3 vs 7+ matches)
**Files to modify:** 
- `src/entities/Bubble.js`
- `src/systems/CollisionSystem.js`
- New: `src/effects/MagneticFieldEffect.js`

### 2. Impact Resonance ✅
**Status:** COMPLETED  
**Priority:** HIGH
**Description:** Enhanced collision feedback for every bubble impact
**Features:**
- [ ] Elastic squash & stretch deformation on impact
- [ ] Color particle exchange at contact points
- [ ] Harmonic rings that pulse outward (frequency based on color)
- [ ] Near-miss friction sparks when bubbles graze
**Files to modify:**
- `src/entities/Bubble.js`
- `src/systems/CollisionSystem.js`
- New: `src/effects/ImpactResonanceEffect.js`

### 3. Cascade Amplification System ✅
**Status:** COMPLETED
**Priority:** HIGH
**Description:** Progressive visual effects that scale with combo size
**Features:**
- [ ] Combo 1-3: Basic particle bursts
- [ ] Combo 4-6: Orbiting light sprites around popping bubbles
- [ ] Combo 7-9: Sacred geometry patterns between chain connections
- [ ] Combo 10+: TRANSCENDENCE MODE
  - [ ] Aurora borealis background
  - [ ] All bubbles gain breathing glow
  - [ ] Mandala patterns from combo center
  - [ ] Time dilation with each pop
**Files to modify:**
- `src/systems/GameLogic.js`
- `src/core/GameManager.js`
- New: `src/effects/CascadeAmplificationSystem.js`

### 4. Thread the Needle ✅
**Status:** COMPLETED
**Priority:** MEDIUM
**Description:** Reward precise shots through tight gaps
**Features:**
- [ ] Detect when bubble passes through gap < 1.5x bubble diameter
- [ ] Trigger slow-motion (0.5x for 0.2 seconds)
- [ ] Camera zoom effect on the gap
- [ ] "PRECISION!" text with metallic shine
- [ ] Bonus score multiplier
- [ ] Light trails showing perfect trajectory
**Files to modify:**
- `src/systems/CollisionSystem.js`
- `src/core/GameManager.js`
- New: `src/effects/ThreadTheNeedleEffect.js`

### 5. Chromatic Aberration Burst ⏳
**Status:** Not Started
**Priority:** MEDIUM
**Description:** Enhanced rainbow power-up activation
**Features:**
- [ ] Split screen into RGB channels momentarily
- [ ] Prismatic light rays in all directions
- [ ] Each matched bubble becomes rainbow fountain
- [ ] Time slows down (0.8x for 0.3 seconds)
**Files to modify:**
- `src/powerups/RainbowPowerUp.js`
- `src/graphics/PostProcessingManager.js`
- New: `src/effects/ChromaticAberrationEffect.js`

### 6. Living Backdrop ⏳
**Status:** Not Started
**Priority:** LOW
**Description:** Dynamic background that responds to gameplay
**Features:**
- [ ] Floating elements react to nearby bubbles
- [ ] Procedural nebula shifts based on dominant colors
- [ ] Intensity pulses with combo multiplier
- [ ] Golden hour lighting near victory
- [ ] Weather system (rain creates splash rings)
**Files to modify:**
- `src/graphics/GameBoard.js`
- New: `src/effects/LivingBackdropSystem.js`

### 7. Momentum Visualizer ⏳
**Status:** Not Started
**Priority:** MEDIUM
**Description:** Visual feedback for maintaining good performance
**Features:**
- [ ] UI elements gain energy halos
- [ ] Shooter cannon accumulates spinning rings
- [ ] Background saturation increases
- [ ] Particle effects multiply
- [ ] Music layers add instruments
**Files to modify:**
- `src/ui/VisualTextDisplay.js`
- `src/main.js`
- New: `src/effects/MomentumVisualizerSystem.js`

### 8. Sympathy Pops ✅
**Status:** COMPLETED
**Priority:** HIGH
**Description:** Bubbles show anticipation before being affected by chains
**Features:**
- [ ] Vibration with increasing intensity
- [ ] Emit anticipation particles
- [ ] Mexican wave effect through grid
- [ ] Build internal glow before popping
**Files to modify:**
- `src/entities/Bubble.js`
- `src/systems/GameLogic.js`
- New: `src/effects/SympathyPopEffect.js`

### 9. Vortex Collapse (Bomb Enhancement) ⏳
**Status:** Not Started
**Priority:** LOW
**Description:** Enhanced bomb bubble explosion
**Features:**
- [ ] Everything gets sucked toward bomb before explosion
- [ ] Spiraling particle streams (black hole effect)
- [ ] Space tears with jagged void lines
- [ ] Color inversion in expanding sphere
**Files to modify:**
- `src/powerups/BombPowerUp.js`

### 10. Tesla Coil Build-up (Lightning Enhancement) ⏳
**Status:** Not Started
**Priority:** LOW
**Description:** Enhanced chain lightning activation
**Features:**
- [ ] Electrical charge builds on UI elements
- [ ] Static interference on screen edges
- [ ] Particles float upward (hair-raising effect)
- [ ] Multiple branching paths preview before selection
**Files to modify:**
- `src/powerups/ChainLightningPowerUp.js`

### 11. Ascension Ceremony (Victory) ⏳
**Status:** Not Started
**Priority:** LOW
**Description:** Spectacular victory sequence
**Features:**
- [ ] Remaining bubbles transform into butterflies/light sprites
- [ ] Spiral galaxy formation as they ascend
- [ ] Golden ratio spirals fill screen
- [ ] Score crystallizes into constellation
- [ ] Slow-motion replay of best combo
**Files to modify:**
- `src/systems/GameLogic.js`

### 12. The Zone State ⏳
**Status:** Not Started
**Priority:** LOW
**Description:** Visual state after 5+ perfect shots
**Features:**
- [ ] Motion blur on everything except aimed bubble
- [ ] Desaturation of non-essential elements
- [ ] Predictive ghost bubbles show outcomes
- [ ] Heartbeat bass pulse with shots
**Files to modify:**
- `src/core/GameState.js`
- `src/graphics/PostProcessingManager.js`

## Implementation Order

1. **Phase 1 - Core Interactions** (HIGH PRIORITY) ✅ COMPLETED
   - Magnetic Attraction Field ✅
   - Impact Resonance ✅
   - Sympathy Pops ✅
   - Cascade Amplification ✅

2. **Phase 2 - Skill Recognition** (MEDIUM PRIORITY)
   - Thread the Needle
   - Momentum Visualizer
   - Cascade Amplification (advanced)

3. **Phase 3 - Polish** (LOW PRIORITY)
   - Living Backdrop
   - Power-up enhancements
   - Victory/Zone states

## Technical Considerations

- All effects should be toggleable for performance
- Effects should scale based on device capabilities
- Particle counts should adapt to maintain 60fps
- Use object pooling for all repeated effects
- Implement LOD system for complex effects

## Performance Targets

- Maintain 60fps with all Phase 1 effects active
- Maintain 30fps minimum with all effects active
- Total particle count budget: 500 active particles
- Shader complexity budget: 10ms per frame

## Testing Checklist

- [ ] Effects work on low-end devices
- [ ] Effects can be disabled via settings
- [ ] No memory leaks from effect systems
- [ ] Effects enhance rather than obscure gameplay
- [ ] Color-blind accessibility maintained