# Refactoring Code Examples

## Modern JavaScript Transformation Examples

### 1. GameState Refactoring

#### Before (Global Object)
```javascript
const gameState = {
    score: 0,
    level: 1,
    combo: 0,
    bestCombo: 0,
    // ... more properties
};

// Direct mutation everywhere
gameState.score += points;
```

#### After (Encapsulated Class with State Management)
```javascript
// src/core/GameState.js
export class GameState extends EventEmitter {
    #state = new Map([
        ['score', 0],
        ['level', 1],
        ['combo', 0],
        ['bestCombo', 0],
    ]);
    
    #listeners = new Map();
    
    get score() { 
        return this.#state.get('score'); 
    }
    
    addScore(points) {
        const newScore = this.score + points;
        this.#updateState('score', newScore);
        
        if (this.combo > this.bestCombo) {
            this.#updateState('bestCombo', this.combo);
        }
    }
    
    #updateState(key, value) {
        const oldValue = this.#state.get(key);
        this.#state.set(key, value);
        this.emit('stateChanged', { key, oldValue, newValue: value });
    }
    
    subscribe(key, callback) {
        if (!this.#listeners.has(key)) {
            this.#listeners.set(key, new Set());
        }
        this.#listeners.get(key).add(callback);
        
        // Return unsubscribe function
        return () => this.#listeners.get(key)?.delete(callback);
    }
}
```

### 2. Bubble Class Modernization

#### Before (Monolithic Class)
```javascript
class Bubble {
    constructor(x, y, color, radius = CONFIG.BUBBLE_RADIUS) {
        this.position = new THREE.Vector3(x, y, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.color = color;
        // ... many more properties
        
        const geometry = new THREE.IcosahedronGeometry(radius, 2);
        this.material = new THREE.MeshPhysicalMaterial({
            color: color,
            // ... lots of material config
        });
        this.mesh = new THREE.Mesh(geometry, this.material);
        // ... more setup
    }
    
    update(deltaTime) {
        // Physics + rendering mixed together
    }
}
```

#### After (Component-Based Architecture)
```javascript
// src/entities/Bubble.js
import { Entity } from '../core/Entity.js';
import { TransformComponent } from '../components/TransformComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import { RenderComponent } from '../components/RenderComponent.js';
import { PowerUpComponent } from '../components/PowerUpComponent.js';

export class Bubble extends Entity {
    #color;
    #radius;
    
    constructor(x, y, color, radius = CONFIG.BUBBLE_RADIUS) {
        super();
        
        this.#color = color;
        this.#radius = radius;
        
        // Add components
        this.addComponent('transform', new TransformComponent(x, y, 0));
        this.addComponent('physics', new PhysicsComponent());
        this.addComponent('render', new RenderComponent(this.#createMesh()));
        
        this.tag('bubble');
    }
    
    #createMesh() {
        const geometry = BubbleGeometry.get(this.#radius);
        const material = BubbleMaterial.create(this.#color);
        return new THREE.Mesh(geometry, material);
    }
    
    get color() { return this.#color; }
    
    setColor(newColor) {
        this.#color = newColor;
        this.getComponent('render').updateMaterial({ color: newColor });
        this.emit('colorChanged', newColor);
    }
    
    attachPowerUp(powerUpType) {
        if (!this.hasComponent('powerUp')) {
            this.addComponent('powerUp', new PowerUpComponent(powerUpType));
        }
    }
}

// src/components/PhysicsComponent.js
export class PhysicsComponent extends Component {
    velocity = new THREE.Vector3();
    acceleration = new THREE.Vector3();
    mass = 1;
    
    update(deltaTime) {
        const transform = this.entity.getComponent('transform');
        
        // Apply physics
        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));
        transform.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Reset acceleration
        this.acceleration.set(0, 0, 0);
    }
    
    applyForce(force) {
        this.acceleration.add(force.clone().divideScalar(this.mass));
    }
}
```

### 3. Power-Up System with Modern Patterns

#### Before (Inheritance-Heavy)
```javascript
class RainbowPowerUp extends PowerUp {
    activate(targetPosition, gameState, gameManager) {
        // Direct implementation
        gameManager.eventBus.emit('rainbowActivated', { position: targetPosition });
    }
}
```

#### After (Strategy Pattern + Dependency Injection)
```javascript
// src/powerups/PowerUpFactory.js
export class PowerUpFactory {
    #strategies = new Map();
    #visualizers = new Map();
    
    register(type, config) {
        this.#strategies.set(type, config.strategy);
        this.#visualizers.set(type, config.visualizer);
    }
    
    create(type, bubble) {
        const strategy = this.#strategies.get(type);
        const visualizer = this.#visualizers.get(type);
        
        if (!strategy) {
            throw new Error(`Unknown power-up type: ${type}`);
        }
        
        return new PowerUp(type, strategy, visualizer, bubble);
    }
}

// src/powerups/strategies/RainbowStrategy.js
export class RainbowStrategy {
    #eventBus;
    #matchingSystem;
    
    constructor(dependencies) {
        this.#eventBus = dependencies.eventBus;
        this.#matchingSystem = dependencies.matchingSystem;
    }
    
    async execute(context) {
        const { bubble, grid } = context;
        
        // Find matches with any color
        const matches = this.#matchingSystem.findMatches(bubble, {
            ignoreColor: true
        });
        
        this.#eventBus.emit('rainbow:activated', {
            bubble,
            matches,
            score: matches.length * 20
        });
        
        return { matches, success: true };
    }
}

// Usage
const factory = new PowerUpFactory();
factory.register('rainbow', {
    strategy: new RainbowStrategy({ eventBus, matchingSystem }),
    visualizer: new RainbowVisualizer({ particleSystem, renderer })
});
```

### 4. Event System Enhancement

#### Before (Simple EventBus)
```javascript
class EventBus {
    constructor() {
        this.events = {};
    }
    
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }
}
```

#### After (Advanced Event System)
```javascript
// src/core/EventSystem.js
export class EventSystem {
    #events = new Map();
    #eventQueue = [];
    #isProcessing = false;
    
    on(event, callback, options = {}) {
        const { 
            priority = 0, 
            once = false,
            context = null,
            filter = null
        } = options;
        
        if (!this.#events.has(event)) {
            this.#events.set(event, new PriorityQueue());
        }
        
        const handler = {
            callback,
            priority,
            once,
            context,
            filter,
            id: Symbol('event-handler')
        };
        
        this.#events.get(event).add(handler);
        
        // Return unsubscribe function
        return () => this.off(event, handler.id);
    }
    
    emit(event, data, options = {}) {
        const { immediate = false, persist = false } = options;
        
        const eventData = {
            type: event,
            data,
            timestamp: performance.now(),
            canceled: false
        };
        
        if (immediate) {
            this.#processEvent(eventData);
        } else {
            this.#eventQueue.push(eventData);
            this.#scheduleProcessing();
        }
        
        if (persist) {
            this.#persistEvent(eventData);
        }
    }
    
    #scheduleProcessing() {
        if (!this.#isProcessing) {
            this.#isProcessing = true;
            requestAnimationFrame(() => this.#processQueue());
        }
    }
    
    #processQueue() {
        const startTime = performance.now();
        const maxTime = 16; // One frame
        
        while (this.#eventQueue.length > 0) {
            if (performance.now() - startTime > maxTime) {
                // Continue next frame
                requestAnimationFrame(() => this.#processQueue());
                return;
            }
            
            const event = this.#eventQueue.shift();
            this.#processEvent(event);
        }
        
        this.#isProcessing = false;
    }
}
```

### 5. Particle System with Object Pooling

#### Before (Creating/Destroying Objects)
```javascript
class Particle {
    constructor(x, y, z, color, size) {
        // Create new Three.js objects every time
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(size, 8, 8),
            new THREE.MeshStandardMaterial({ color })
        );
    }
    
    destroy() {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
```

#### After (Advanced Object Pool)
```javascript
// src/systems/ParticlePool.js
export class ParticlePool {
    #available = [];
    #active = new Set();
    #geometryCache = new Map();
    #materialPool;
    
    constructor(size = 300) {
        this.#materialPool = new MaterialPool();
        this.#preallocate(size);
    }
    
    #preallocate(size) {
        // Create a single instanced mesh for all particles
        const geometry = this.#getGeometry(0.15);
        const material = new THREE.MeshBasicMaterial();
        
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, size);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.instancedMesh);
        
        // Initialize pool
        for (let i = 0; i < size; i++) {
            this.#available.push({
                index: i,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                color: new THREE.Color(),
                scale: 1,
                life: 0,
                active: false
            });
        }
    }
    
    spawn(config) {
        const particle = this.#available.pop();
        if (!particle) return null;
        
        // Configure particle
        Object.assign(particle, config, { active: true, life: 1 });
        this.#active.add(particle);
        
        // Update instance
        this.#updateInstance(particle);
        
        return particle;
    }
    
    update(deltaTime) {
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        
        for (const particle of this.#active) {
            // Update physics
            particle.velocity.y -= 9.8 * deltaTime;
            particle.position.addScaledVector(particle.velocity, deltaTime);
            particle.life -= particle.decay * deltaTime;
            
            if (particle.life <= 0) {
                this.#recycle(particle);
                continue;
            }
            
            // Update instance matrix
            scale.setScalar(particle.scale * particle.life);
            matrix.compose(particle.position, quaternion, scale);
            this.instancedMesh.setMatrixAt(particle.index, matrix);
            
            // Update color
            this.instancedMesh.setColorAt(particle.index, particle.color);
        }
        
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.instancedMesh.instanceColor) {
            this.instancedMesh.instanceColor.needsUpdate = true;
        }
    }
}
```

### 6. Async Resource Loading

#### Before (Callback Hell)
```javascript
function loadResources(callback) {
    loadTextures(function() {
        loadSounds(function() {
            loadModels(function() {
                callback();
            });
        });
    });
}
```

#### After (Modern Async/Await)
```javascript
// src/core/ResourceLoader.js
export class ResourceLoader extends EventEmitter {
    #loaders = new Map();
    #cache = new Map();
    
    constructor() {
        super();
        this.#setupLoaders();
    }
    
    #setupLoaders() {
        this.#loaders.set('texture', new THREE.TextureLoader());
        this.#loaders.set('audio', new AudioLoader());
        this.#loaders.set('model', new THREE.GLTFLoader());
    }
    
    async load(manifest) {
        const total = manifest.length;
        let loaded = 0;
        
        const loadPromises = manifest.map(async (resource) => {
            try {
                const data = await this.#loadResource(resource);
                this.#cache.set(resource.id, data);
                
                loaded++;
                this.emit('progress', { loaded, total, resource });
                
                return { id: resource.id, data, success: true };
            } catch (error) {
                console.error(`Failed to load ${resource.id}:`, error);
                return { id: resource.id, error, success: false };
            }
        });
        
        const results = await Promise.allSettled(loadPromises);
        
        this.emit('complete', {
            total,
            loaded,
            failed: total - loaded,
            results
        });
        
        return results;
    }
    
    async #loadResource(resource) {
        const { type, url, options = {} } = resource;
        const loader = this.#loaders.get(type);
        
        if (!loader) {
            throw new Error(`Unknown resource type: ${type}`);
        }
        
        // Check cache
        const cacheKey = `${type}:${url}`;
        if (this.#cache.has(cacheKey)) {
            return this.#cache.get(cacheKey);
        }
        
        // Load with retry logic
        return this.#loadWithRetry(
            () => loader.loadAsync(url),
            options.retries ?? 3
        );
    }
    
    async #loadWithRetry(loadFn, retries) {
        for (let i = 0; i < retries; i++) {
            try {
                return await loadFn();
            } catch (error) {
                if (i === retries - 1) throw error;
                await this.#delay(1000 * Math.pow(2, i)); // Exponential backoff
            }
        }
    }
    
    #delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Usage
const loader = new ResourceLoader();
const manifest = [
    { id: 'bubble-pop', type: 'audio', url: '/sounds/pop.mp3' },
    { id: 'star-texture', type: 'texture', url: '/textures/star.png' },
    { id: 'powerup-model', type: 'model', url: '/models/powerup.glb' }
];

await loader.load(manifest);
```

### 7. State Machine for Game Flow

#### Before (Boolean Flags)
```javascript
if (gameState.isPaused) {
    // ...
} else if (gameState.isGameOver) {
    // ...
} else if (gameState.isCharging) {
    // ...
}
```

#### After (Proper State Machine)
```javascript
// src/core/GameStateMachine.js
export class GameStateMachine {
    #states = new Map();
    #currentState = null;
    #context;
    
    constructor(context) {
        this.#context = context;
        this.#setupStates();
    }
    
    #setupStates() {
        this.#states.set('menu', new MenuState());
        this.#states.set('playing', new PlayingState());
        this.#states.set('paused', new PausedState());
        this.#states.set('gameOver', new GameOverState());
        this.#states.set('powerUpSelection', new PowerUpSelectionState());
    }
    
    transition(stateName, data = {}) {
        const newState = this.#states.get(stateName);
        if (!newState) {
            throw new Error(`Unknown state: ${stateName}`);
        }
        
        // Check if transition is allowed
        if (this.#currentState && !this.#currentState.canTransitionTo(stateName)) {
            console.warn(`Cannot transition from ${this.#currentState.name} to ${stateName}`);
            return false;
        }
        
        // Exit current state
        if (this.#currentState) {
            this.#currentState.exit(this.#context);
        }
        
        // Enter new state
        this.#currentState = newState;
        this.#currentState.enter(this.#context, data);
        
        this.#context.eventBus.emit('stateChanged', {
            from: this.#currentState?.name,
            to: stateName,
            data
        });
        
        return true;
    }
    
    update(deltaTime) {
        this.#currentState?.update(this.#context, deltaTime);
    }
    
    handleInput(input) {
        this.#currentState?.handleInput(this.#context, input);
    }
}

// src/states/PlayingState.js
export class PlayingState extends State {
    name = 'playing';
    allowedTransitions = ['paused', 'gameOver', 'powerUpSelection'];
    
    enter(context) {
        context.ui.showHUD();
        context.physics.resume();
        context.audio.playMusic('game-theme');
    }
    
    update(context, deltaTime) {
        context.physics.update(deltaTime);
        context.renderer.update(deltaTime);
        
        if (context.grid.checkGameOver()) {
            context.stateMachine.transition('gameOver');
        }
    }
    
    handleInput(context, input) {
        switch (input.type) {
            case 'pause':
                context.stateMachine.transition('paused');
                break;
            case 'shoot':
                context.shooter.shoot(input.angle, input.power);
                break;
        }
    }
    
    exit(context) {
        context.ui.hideHUD();
    }
}
```

## Summary

These examples demonstrate:

1. **Encapsulation**: Using private fields and methods
2. **Composition**: Favoring composition over inheritance
3. **Dependency Injection**: Passing dependencies explicitly
4. **Event-Driven**: Decoupled communication
5. **Async/Await**: Modern asynchronous patterns
6. **State Machines**: Proper state management
7. **Object Pooling**: Performance optimization
8. **Module System**: ES6 imports/exports
9. **Type Safety**: Structure for future TypeScript migration
10. **SOLID Principles**: Applied throughout

Each refactoring maintains the exact same functionality while improving:
- Maintainability
- Testability
- Performance
- Developer experience