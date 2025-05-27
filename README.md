# Premium 3D Bubble Shooter 🎮

A modern, feature-rich bubble shooter game built with Three.js, featuring advanced power-ups, stunning 3D graphics, and engaging gameplay mechanics.

![Game Version](https://img.shields.io/badge/version-3.0-blue.svg)
![Three.js](https://img.shields.io/badge/Three.js-r128-green.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)

## 🎯 Features

### Core Gameplay
- **3D Graphics**: Premium glass-like bubble rendering with Three.js
- **Hexagonal Grid**: Classic bubble shooter mechanics with precise physics
- **Power Meter**: Charge your shots for extra speed and power
- **Combo System**: Chain matches for multiplier bonuses
- **Dynamic Lighting**: Multiple light sources for atmospheric effects
- **Particle Effects**: Explosions, wall impacts, and floating bubbles

### 🌟 Power-Up System

#### 🌈 Rainbow Bubble (15% spawn rate)
- Matches with any color it touches
- Creates cascading chain reactions
- Animated rainbow shimmer effect
- 2x score multiplier

#### 💣 Bomb Bubble (10% spawn rate)
- Destroys all bubbles in a 3x3 area
- Pulsing red glow with timer tick effect
- Screen shake and explosive particles
- 3x score multiplier

#### ⚡ Lightning Bubble (8% spawn rate)
- Choose to destroy entire row or column
- Electric arc visual effects
- Lightning bolt animation
- Interactive selection UI
- 25 points per bubble destroyed

#### 🎯 Precision Aim (12% spawn rate)
- 10-second enhanced aiming mode
- Shows extended trajectory (5+ wall bounces)
- Cyan-colored trajectory preview
- Circular countdown timer
- Perfect for tricky shots

### Visual Effects
- **Screen Shake**: Dynamic camera effects for explosions
- **Glow Effects**: Power-ups have distinctive glowing auras
- **Electric Arcs**: Animated lightning effects on Lightning bubbles
- **Rainbow Shimmer**: Color-shifting effect on Rainbow bubbles
- **Particle Systems**: Custom particles for each power-up type

### UI Elements
- **Score Display**: Real-time score tracking with level indicator
- **Combo Display**: Shows current combo multiplier
- **Power Meter**: Visual feedback for charged shots
- **Next Bubble Preview**: See your next bubble color
- **Power-Up Indicator**: Shows active power-up on current bubble
- **Game Over Screen**: Final score, level reached, and best combo

## 🎮 How to Play

### Basic Controls
- **Mouse/Touch**: Aim your shot
- **Click/Tap and Hold**: Charge your shot for more power
- **Release**: Fire the bubble

### Gameplay Tips
1. **Match 3 or more** bubbles of the same color to pop them
2. **Use wall bounces** to reach difficult spots
3. **Create combos** by causing bubbles to fall for bonus points
4. **Save power-ups** for strategic moments
5. **Clear the ceiling** to prevent game over

### Power-Up Usage
- **Rainbow Bubble**: Aim for the largest cluster of any color
- **Bomb Bubble**: Target dense areas for maximum destruction
- **Lightning Bubble**: Use when a row/column has many bubbles
- **Precision Aim**: Activate for difficult bank shots

## 🚀 Getting Started

### Prerequisites
- Modern web browser with WebGL support
- No installation required!

### Running the Game

#### Option 1: Direct File Opening
Simply open `premium-bubble-shooterV3.html` in your web browser.

#### Option 2: Local Web Server (Recommended)
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if http-server is installed)
npx http-server -p 8000
```

Then navigate to `http://localhost:8000/premium-bubble-shooterV3.html`

## 🏗️ Technical Architecture

### Core Systems
- **GameManager**: Central coordination system
- **EventBus**: Event-driven communication between components
- **PowerUpSystem**: Manages power-up spawning and activation
- **Particle System**: Handles all visual effects

### Technologies Used
- **Three.js r128**: 3D graphics rendering
- **ES6+ JavaScript**: Modern class-based architecture
- **CSS3**: Animations and UI styling
- **HTML5 Canvas**: WebGL rendering context

### Performance Features
- Object pooling for particles
- Efficient collision detection
- Optimized trajectory calculation
- GPU-accelerated rendering

## 📊 Game Configuration

Key parameters in `CONFIG` object:
- `BUBBLE_RADIUS`: Size of bubbles (default: 0.5)
- `GRID_WIDTH`: Number of columns (default: 11)
- `GRID_HEIGHT`: Number of rows (default: 14)
- `SHOOTING_SPEED`: Base projectile speed (default: 20)
- `PARTICLE_COUNT`: Particles per explosion (default: 30)

## 🎨 Customization

### Adding New Power-Ups
1. Extend the `PowerUp` base class
2. Implement `activate()` and `createVisualEffect()` methods
3. Register with `PowerUpSystem`

Example:
```javascript
class MyPowerUp extends PowerUp {
    constructor() {
        super('mypower', {
            name: 'My Power-Up',
            rarity: 'rare',
            spawnRate: 0.05,
            color: 0xff00ff,
            glowColor: 0xff00ff
        });
    }
    
    activate(targetPosition, gameState, gameManager) {
        // Your activation logic
    }
}
```

### Modifying Visual Effects
- Bubble materials: Line 666-674
- Particle effects: `createExplosionEffect()` function
- Lighting: Lines 609-629

## 🐛 Known Issues
- Touch controls may need calibration on some devices
- Performance may vary on older graphics cards
- Lightning trajectory lines may appear thin on high-DPI displays

## 🔮 Future Enhancements
- Save system for progress persistence
- Achievement system
- Daily challenges
- Additional power-ups
- Boss battles
- Multiplayer mode

## 📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments
- Three.js community for excellent documentation
- Game design inspired by classic bubble shooter games
- Power-up concepts from `advanced_mechanics_prompt.md`

---

**Enjoy the game!** 🎉 Report any issues or suggestions in the GitHub repository.