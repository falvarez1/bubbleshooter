# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Premium 3D Bubble Shooter game built as a single HTML file with embedded JavaScript using Three.js for 3D graphics. The game is self-contained in `premium-bubble-shooterV3.html`.

## Commands

### Running the Game
```bash
# Open the HTML file in a web browser
open premium-bubble-shooterV3.html  # macOS
xdg-open premium-bubble-shooterV3.html  # Linux
start premium-bubble-shooterV3.html  # Windows
```

### Development Server
Since this is a standalone HTML file with no build process, you can use any static file server:
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if http-server is installed globally)
http-server -p 8000
```

## Architecture

### Core Components

1. **Game State Management** (`gameState` object starting at line 334)
   - Manages bubble grid, scoring, combo system, game state flags
   - Grid structure: 2D array where odd rows have one less bubble for hexagonal packing

2. **Three.js Scene Setup** (lines 284-332)
   - Camera, renderer, lighting configuration
   - Multiple light sources for visual effects (ambient, directional, rim, accent)

3. **Game Objects**
   - `Bubble` class (line 354): Main game entity with physics, collision detection, and visual effects
   - `Particle` class (line 462): Visual effects for bubble pops and explosions

4. **Core Game Loop** (`animate` function at line 1506)
   - Updates all game objects with deltaTime
   - Handles collision detection
   - Manages particle systems and animations

5. **Input Handling**
   - Mouse/touch events for aiming and shooting
   - Power charging system for enhanced shots
   - Trajectory preview system

### Key Game Mechanics

- **Bubble Matching**: `findConnectedBubbles()` (line 1059) - Recursive flood-fill algorithm
- **Floating Detection**: `checkForFloatingBubbles()` (line 1136) - Finds unanchored bubbles
- **Collision System**: `checkBubbleCollisions()` (line 734) - Handles bubble-to-bubble collisions
- **Grid Attachment**: `findNearestGridPosition()` (line 848) - Snaps bubbles to hexagonal grid

### Visual Features
- Real-time trajectory preview with wall bounces
- Particle effects on bubble destruction
- Dynamic lighting effects
- Power meter visualization
- Combo display system

## Game Mechanics Reference

The file `game_mechanics_guide.md` contains detailed documentation about:
- Power-ups and special bubbles
- Progression systems
- Strategic depth mechanics
- Obstacle types
- Game modes

Refer to this file when implementing new features or understanding existing game mechanics.

## Power-Up System Implementation

### Architecture
- **EventBus**: Central communication system for all game events
- **GameManager**: Coordinates all systems (power-ups, effects, UI)
- **PowerUpSystem**: Manages power-up registration, spawning, and activation

### Implemented Power-Ups

1. **Rainbow Bubble** (15% spawn rate)
   - Matches any color, creates cascading chain reactions
   - Rainbow shimmer visual effect
   - 2x score multiplier

2. **Bomb Bubble** (10% spawn rate)
   - Destroys 3x3 area regardless of color
   - Pulsing red glow with timer effect
   - Screen shake and enhanced explosion particles
   - 3x score multiplier

3. **Lightning Bubble** (8% spawn rate)
   - Player selects row or column to destroy
   - Electric arc visual effects
   - Lightning bolt animation on activation
   - 25 points per bubble destroyed

4. **Precision Aim** (12% spawn rate)
   - 10-second duration with countdown timer
   - Shows extended trajectory (5+ bounces)
   - Cyan-colored trajectory lines
   - Visual timer indicator

### UI Elements
- Power-up indicator shows current bubble's power-up
- Lightning selector overlay for row/column choice
- Precision aim timer with circular progress
- Dynamic color-coded UI based on power-up type