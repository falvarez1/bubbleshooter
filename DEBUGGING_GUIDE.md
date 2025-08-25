# Bubble Shooter Debugging Guide

This guide provides comprehensive debugging instructions for the Bubble Shooter game, with a focus on detecting and fixing state synchronization issues like ghost bubbles.

## Table of Contents
1. [Quick Debugging Commands](#quick-debugging-commands)
2. [Ghost Bubble Detection](#ghost-bubble-detection)
3. [Using the Test Suite](#using-the-test-suite)
4. [Browser Console Debugging](#browser-console-debugging)
5. [Common Issues and Solutions](#common-issues-and-solutions)
6. [Performance Debugging](#performance-debugging)
7. [Power-Up Debugging](#power-up-debugging)

## Quick Debugging Commands

### Load Debug Tools in Browser Console
```javascript
// Load the debug script
fetch('test_ghost_fix.js').then(r => r.text()).then(eval);

// Run comprehensive test
testGhostBubbleFix();

// Clean up any ghost bubbles found
cleanupGhostBubbles();
```

### Quick State Inspection
```javascript
// Check total bubble counts
console.log('Grid bubbles:', game.gameState.getAllBubbles().length);
console.log('Visual instances:', game.bubbleInstances.activeBubbles.size);

// Find destroyed bubbles still in grid
let ghosts = 0;
for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 15; x++) {
        const bubble = game.gameState.getBubbleAt(x, y);
        if (bubble && bubble.isDestroyed) {
            console.warn(`Ghost at ${x},${y}`);
            ghosts++;
        }
    }
}
console.log(`Total ghost bubbles: ${ghosts}`);
```

## Ghost Bubble Detection

### What are Ghost Bubbles?
Ghost bubbles are bubbles that appear visually but don't exist in the game logic, or vice versa. They can:
- Block shots without being visible
- Appear visible but not interact with game mechanics
- Cause inconsistent game state

### Detection Methods

#### Method 1: Visual Inspection Test
```javascript
function detectVisualGhosts() {
    const visualCount = game.bubbleInstances.bubbleMap.size;
    const gridCount = game.gameState.getAllBubbles().filter(b => !b.isDestroyed).length;
    
    console.log(`Visual: ${visualCount}, Grid: ${gridCount}`);
    
    if (Math.abs(visualCount - gridCount) > 1) { // Allow 1 for shooting bubble
        console.warn('⚠️ Possible ghost bubbles detected!');
        
        // Find orphaned visuals
        game.bubbleInstances.bubbleMap.forEach((mapping, id) => {
            const bubble = mapping.bubble;
            if (bubble.isDestroyed) {
                console.error(`Destroyed bubble ${id} still has visual!`);
            }
        });
    }
}
```

#### Method 2: Grid Consistency Check
```javascript
function checkGridConsistency() {
    const issues = [];
    
    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
            const bubble = game.gameState.getBubbleAt(x, y);
            
            if (bubble) {
                // Check if bubble position matches grid position
                if (bubble.gridX !== x || bubble.gridY !== y) {
                    issues.push(`Position mismatch at ${x},${y}`);
                }
                
                // Check if destroyed bubble is in grid
                if (bubble.isDestroyed) {
                    issues.push(`Destroyed bubble at ${x},${y}`);
                }
                
                // Check if bubble has visual
                if (bubble.useInstancedRendering && 
                    !game.bubbleInstances.hasInstance(bubble.id)) {
                    issues.push(`Missing visual for bubble at ${x},${y}`);
                }
            }
        }
    }
    
    if (issues.length > 0) {
        console.error('Grid consistency issues:', issues);
    } else {
        console.log('✅ Grid consistency check passed');
    }
    
    return issues;
}
```

#### Method 3: Automated Validation
```javascript
// Use the BubbleValidator if integrated
import { BubbleValidator } from './src/validators/BubbleValidator.js';

function runValidation() {
    const systems = {
        gameState: game.gameState,
        bubbleInstances: game.bubbleInstances,
        collisionSystem: game.collisionSystem
    };
    
    const report = BubbleValidator.validateGame(systems);
    
    if (report.hasIssues) {
        console.error('Validation failed:', report);
        BubbleValidator.logReport(report);
        
        // Auto-fix if desired
        if (confirm('Auto-fix detected issues?')) {
            const fixReport = BubbleValidator.autoFix(report, systems);
            console.log('Fix report:', fixReport);
        }
    } else {
        console.log('✅ Validation passed - no issues found');
    }
}
```

## Using the Test Suite

### Running the Test Page
1. Open `tests/test_ghost_bubble_fix.html` in a browser
2. Click "Run All Tests" to run automated tests
3. Use interactive buttons to test specific scenarios

### Test Suite Features
- **Atomic Destruction Test**: Verifies bubble removal is atomic
- **State Machine Test**: Validates state transitions
- **Validation Test**: Checks ghost bubble detection
- **Repository Test**: Tests centralized state management
- **Live Game Test**: Interactive testing with real game state

### Understanding Test Results
- ✅ Green results indicate passing tests
- ⚠️ Yellow results indicate warnings
- ❌ Red results indicate failures

## Browser Console Debugging

### Essential Console Commands

#### Inspect Specific Bubble
```javascript
function inspectBubble(x, y) {
    const bubble = game.gameState.getBubbleAt(x, y);
    if (!bubble) {
        console.log(`No bubble at ${x},${y}`);
        return;
    }
    
    console.log('Bubble Info:', {
        id: bubble.id,
        position: `(${x},${y})`,
        color: bubble.color,
        isDestroyed: bubble.isDestroyed,
        hasVisual: game.bubbleInstances.hasInstance(bubble.id),
        useInstancedRendering: bubble.useInstancedRendering,
        isPowerUp: bubble.isPowerUp,
        powerUpType: bubble.powerUpType
    });
    
    // Check visual mapping
    const mapping = game.bubbleInstances.getBubbleMapping(bubble);
    if (mapping) {
        console.log('Visual Mapping:', mapping);
    }
}

// Usage: inspectBubble(5, 3);
```

#### Track Bubble Lifecycle
```javascript
function trackBubble(bubble) {
    const originalDestroy = bubble.destroy;
    bubble.destroy = function() {
        console.trace(`Bubble ${bubble.id} destroy called`);
        originalDestroy.call(this);
    };
    
    console.log(`Now tracking bubble ${bubble.id}`);
}

// Usage: trackBubble(game.gameState.currentBubble);
```

#### Monitor State Changes
```javascript
function monitorStateChanges() {
    let lastGridCount = 0;
    let lastVisualCount = 0;
    
    setInterval(() => {
        const gridCount = game.gameState.getAllBubbles().filter(b => !b.isDestroyed).length;
        const visualCount = game.bubbleInstances.activeBubbles.size;
        
        if (gridCount !== lastGridCount || visualCount !== lastVisualCount) {
            console.log(`State change - Grid: ${lastGridCount}→${gridCount}, Visual: ${lastVisualCount}→${visualCount}`);
            lastGridCount = gridCount;
            lastVisualCount = visualCount;
            
            if (Math.abs(gridCount - visualCount) > 1) {
                console.warn('⚠️ State desync detected!');
            }
        }
    }, 100);
}
```

## Common Issues and Solutions

### Issue 1: Ghost Bubbles After Power-Up Use
**Symptoms:** Invisible bubbles block shots after using power-ups

**Detection:**
```javascript
// Run after using a power-up
setTimeout(() => {
    checkGridConsistency();
    detectVisualGhosts();
}, 1000);
```

**Solution:**
```javascript
// Force cleanup
cleanupGhostBubbles();

// Verify specific power-up
console.log('Power-up cleanup check:', {
    chainLightning: !document.querySelector('.lightning-arc'),
    bomb: !document.querySelector('.shockwave'),
    effects: game.gameManager.effectsSystem.activeEffects.size
});
```

### Issue 2: Bubbles Not Disappearing
**Symptoms:** Bubbles marked for destruction remain visible

**Detection:**
```javascript
// Find stuck bubbles
game.bubbleInstances.bubbleMap.forEach((mapping, id) => {
    if (mapping.bubble.isDestroyed) {
        console.error(`Stuck destroyed bubble: ${id}`);
        // Force remove
        game.bubbleInstances.removeBubble(mapping.bubble);
    }
});
```

### Issue 3: Collision Detection Issues
**Symptoms:** Bubbles pass through each other or don't attach properly

**Detection:**
```javascript
// Check collision system cache
console.log('Collision cache:', {
    cacheSize: game.collisionSystem.gridBubbleCache.length,
    lastUpdate: game.collisionSystem.lastCacheUpdate,
    spatialGridSize: game.collisionSystem.spatialGrid.grid.size
});

// Force cache rebuild
game.collisionSystem.updateGridBubbleCache();
```

## Performance Debugging

### Frame Rate Analysis
```javascript
function measureFrameRate() {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measure = () => {
        frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - lastTime >= 1000) {
            console.log(`FPS: ${frameCount}`);
            frameCount = 0;
            lastTime = currentTime;
        }
        
        requestAnimationFrame(measure);
    };
    
    measure();
}
```

### Memory Usage
```javascript
function checkMemoryUsage() {
    if (performance.memory) {
        const mb = 1024 * 1024;
        console.log('Memory Usage:', {
            used: Math.round(performance.memory.usedJSHeapSize / mb) + ' MB',
            total: Math.round(performance.memory.totalJSHeapSize / mb) + ' MB',
            limit: Math.round(performance.memory.jsHeapSizeLimit / mb) + ' MB'
        });
    }
    
    // Check object counts
    console.log('Object Counts:', {
        bubbles: game.gameState.getAllBubbles().length,
        particles: game.gameState.particles.length,
        effects: game.gameManager.effectsSystem?.activeEffects.size || 0,
        animations: game.gameState.animations.length
    });
}
```

## Power-Up Debugging

### Check Power-Up State
```javascript
function debugPowerUps() {
    console.log('Power-Up State:', {
        currentPowerUp: game.gameState.currentBubble?.powerUpType,
        activePowerUp: game.gameState.activePowerUp,
        collected: game.gameState.collectedPowerUps,
        system: game.gameManager.powerUpSystem?.getDebugInfo()
    });
}
```

### Test Specific Power-Up
```javascript
function testPowerUp(type) {
    // Create a power-up bubble at current position
    const bubble = game.gameState.currentBubble;
    if (bubble) {
        bubble.isPowerUp = true;
        bubble.powerUpType = type; // 'bomb', 'chainLightning', 'rainbow', etc.
        console.log(`Current bubble is now a ${type} power-up`);
    }
}
```

## Debug Mode Configuration

### Enable Debug Mode
Add to your game configuration:
```javascript
// In Config.js or at game start
CONFIG.DEBUG_MODE = true;
CONFIG.LOG_LEVEL = 'verbose'; // 'error', 'warn', 'info', 'verbose'
CONFIG.VALIDATE_STATE = true; // Run validation checks
CONFIG.SHOW_STATS = true; // Show performance stats
```

### Add Debug Overlay
```javascript
function createDebugOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'debug-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 10px;
        font-family: monospace;
        font-size: 12px;
        z-index: 10000;
    `;
    document.body.appendChild(overlay);
    
    setInterval(() => {
        const gridCount = game.gameState.getAllBubbles().filter(b => !b.isDestroyed).length;
        const visualCount = game.bubbleInstances.activeBubbles.size;
        
        overlay.innerHTML = `
            <div>FPS: ${Math.round(1000 / game.deltaTime)}</div>
            <div>Grid Bubbles: ${gridCount}</div>
            <div>Visual Instances: ${visualCount}</div>
            <div>Particles: ${game.gameState.particles.length}</div>
            <div>Ghost Check: ${gridCount === visualCount ? '✅' : '⚠️'}</div>
        `;
    }, 100);
}
```

## Logging and Monitoring

### Custom Logger
```javascript
class GameLogger {
    static log(category, message, data) {
        const timestamp = new Date().toISOString();
        const entry = { timestamp, category, message, data };
        
        // Store in array for later analysis
        this.logs = this.logs || [];
        this.logs.push(entry);
        
        // Console output with color coding
        const color = {
            'error': 'color: red',
            'warn': 'color: orange',
            'info': 'color: blue',
            'debug': 'color: gray'
        }[category] || 'color: black';
        
        console.log(`%c[${category}] ${message}`, color, data);
    }
    
    static exportLogs() {
        const blob = new Blob([JSON.stringify(this.logs, null, 2)], 
                              { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `game-logs-${Date.now()}.json`;
        a.click();
    }
}

// Usage
GameLogger.log('error', 'Ghost bubble detected', { position: {x: 5, y: 3} });
GameLogger.exportLogs(); // Download logs
```

## Troubleshooting Checklist

When debugging issues, go through this checklist:

1. ☐ Check browser console for errors
2. ☐ Run `testGhostBubbleFix()` to validate state
3. ☐ Check grid vs visual consistency
4. ☐ Verify power-ups aren't causing issues
5. ☐ Check memory usage and performance
6. ☐ Look for destroyed bubbles in grid
7. ☐ Verify collision system cache is updated
8. ☐ Check for orphaned visual instances
9. ☐ Validate state transitions if using state machine
10. ☐ Export and analyze logs if issue persists

## Emergency Fixes

If the game gets into a bad state:

```javascript
// Nuclear option - reset everything
function emergencyReset() {
    // Clean all ghost bubbles
    cleanupGhostBubbles();
    
    // Force collision cache update
    game.collisionSystem.updateGridBubbleCache();
    
    // Clear all particles and effects
    game.gameState.particles = [];
    game.gameState.animations = [];
    
    // Validate and fix
    const systems = { 
        gameState: game.gameState, 
        bubbleInstances: game.bubbleInstances,
        collisionSystem: game.collisionSystem 
    };
    const report = BubbleValidator.validateGame(systems);
    if (report.hasIssues) {
        BubbleValidator.autoFix(report, systems);
    }
    
    console.log('Emergency reset complete');
}
```

## Contact and Support

If you encounter persistent issues:
1. Run the full diagnostic suite
2. Export logs using `GameLogger.exportLogs()`
3. Take a screenshot of the console errors
4. Document steps to reproduce
5. Check ARCHITECTURE_REFACTORING.md for architectural context

Remember: Most issues can be resolved by running `cleanupGhostBubbles()` and forcing a cache update.