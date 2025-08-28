import * as THREE from 'three';
import { CONFIG, PARTICLE_CONFIG, applyParticlePreset } from './core/Config.js';
import { GameState } from './core/GameState.js';
import { GameManager } from './core/GameManager.js';
import { SceneManager } from './graphics/SceneManager.js';
import { GameBoard } from './graphics/GameBoard.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { TrajectorySystem } from './systems/TrajectorySystemBloom.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { PrecisionAimIndicator } from './systems/PrecisionAimIndicator.js';
import { GameLogic } from './systems/GameLogic.js';
import { UIManager } from './ui/VisualTextDisplay.js';
import { PerformanceManager } from './core/PerformanceManager.js';
import { PauseSystem } from './systems/PauseSystem.js';
import { SmartColorDebugUI } from './ui/SmartColorDebugUI.js';
import { BubbleEffectsSystem } from './graphics/BubbleEffectsSystem.js';
import { developerPanel } from './ui/DeveloperPanel.js';
import { bubbleEffectsController } from './graphics/BubbleEffectsController.js';
import { Bubble } from './entities/Bubble.js';
import { ParticlePool } from './entities/Particle.js';
import { BubbleInstances } from './graphics/BubbleInstances.js';
import { settingsStorage } from './core/SettingsStorage.js';
import { 
    RainbowPowerUp, 
    BombPowerUp, 
    PrecisionAimPowerUp,
    ChainLightningPowerUp,
    ColorSplashPowerUp
} from './powerups/index.js';
import { BloomDebugger } from './utils/BloomDebugger.js';

// Import new progressive game systems
import { ProgressiveTimerSystem } from './systems/ProgressiveTimerSystem.js';
import { DangerZoneSystem } from './systems/DangerZoneSystem.js';
import { ColorClusteringSystem } from './systems/ColorClusteringSystem.js';
import { LevelProgressionSystem } from './systems/LevelProgressionSystem.js';
import { SmartColorSelectionSystem } from './systems/SmartColorSelectionSystem.js';

// Import performance optimizations
import { 
    animationLoop,
    bubbleUpdater,
    shaderManager,
    memoryOptimizer,
    performanceMonitor,
    OptimizedTrajectory
} from './core/PerformanceOptimizations.js';

// Main game class with optimizations
class BubbleShooterGameOptimized {
    constructor() {
        // Core systems
        this.gameState = new GameState();
        this.gameManager = new GameManager();
        this.sceneManager = new SceneManager(document.getElementById('gameCanvas'));
        this.audioSystem = new AudioSystem();
        this.uiManager = new UIManager();
        this.performanceManager = new PerformanceManager();
        this.pauseSystem = new PauseSystem(this.gameManager.eventBus);
        
        // Get Three.js objects
        this.scene = this.sceneManager.getScene();
        this.camera = this.sceneManager.getCamera();
        this.renderer = this.sceneManager.getRenderer();
        
        // Game systems
        this.gameBoard = new GameBoard(this.scene, this.gameState);
        this.postProcessingManager = this.sceneManager.getPostProcessing();
        this.trajectorySystem = new TrajectorySystem(this.scene, this.postProcessingManager);
        this.collisionSystem = new CollisionSystem(this.gameState, this.gameManager);
        this.gameLogic = new GameLogic(this.gameState, this.gameManager, this.scene);
        
        // Optimized trajectory wrapper
        this.optimizedTrajectory = new OptimizedTrajectory(this.trajectorySystem);
        
        // Connect pause system to game logic
        this.gameLogic.pauseSystem = this.pauseSystem;
        
        // Add bloom debugger (only in development)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.bloomDebugger = new BloomDebugger(this.postProcessingManager);
        }
        
        this.effectsSystem = new BubbleEffectsSystem(this.scene);
        this.precisionAimIndicator = new PrecisionAimIndicator(this.scene);
        
        // Initialize progressive game systems
        this.progressiveTimerSystem = new ProgressiveTimerSystem(this.gameState, this.gameManager.eventBus);
        this.dangerZoneSystem = new DangerZoneSystem(this.gameState, this.scene, this.gameManager.eventBus);
        this.colorClusteringSystem = new ColorClusteringSystem(this.gameState, this.gameManager.eventBus);
        this.levelProgressionSystem = new LevelProgressionSystem(this.gameState, this.gameManager.eventBus);
        this.levelProgressionSystem.pauseSystem = this.pauseSystem;
        this.smartColorSelectionSystem = new SmartColorSelectionSystem(this.gameState, this.gameManager.eventBus);
        
        // Initialize instanced bubble renderer
        this.bubbleInstances = null;
        
        // Game properties
        this.DEBUG_MODE = true;
        this.FORCED_NEXT_BUBBLE_TYPE = null;
        this.lastTime = 0;
        this.precisionTickTimer = 0;
        
        // Initialize
        this.initialize();
    }
    
    async initialize() {
        // Initialize performance manager first
        await this.performanceManager.initialize();
        
        // Initialize instanced bubble renderer
        this.bubbleInstances = new BubbleInstances(this.scene, 300);
        
        // Apply dynamic shader settings
        const effectSettings = shaderManager.getEffectSettings();
        Object.assign(this.bubbleInstances.effects, effectSettings);
        
        // Share references with game logic for bubble removal
        this.gameLogic.bubbleInstances = this.bubbleInstances;
        this.gameLogic.collisionSystem = this.collisionSystem;
        
        // Initialize UI controls based on CONFIG values
        this.initializeAudioControls();
        
        // Apply particle preset
        applyParticlePreset(PARTICLE_CONFIG.preset);
        
        // Create optimal particle system based on capabilities
        const USE_GPU_PARTICLES = true;
        this.gpuParticles = USE_GPU_PARTICLES ? this.performanceManager.createOptimalParticleSystem(this.scene) : null;
        
        if (this.gpuParticles) {
            // Using GPU particle system
            this.gameState.particlePool = {
                spawn: (x, y, z, color, _size, velocity, category) => {
                    return this.gpuParticles.spawn(x, y, z, color, _size, velocity);
                },
                spawnPower: (x, y, z, color, size, velocity, power, category) => {
                    const pos = new THREE.Vector3(x, y, z);
                    const count = Math.max(1, Math.floor(1 + power * 1.5));
                    return this.gpuParticles.spawnPowerParticles(pos, velocity, color, count, power);
                },
                update: (deltaTime) => {
                    this.gpuParticles.update(deltaTime, this.renderer);
                },
                clear: () => {
                    this.gpuParticles.clear();
                },
                addToScene: (scene) => {
                    this.gpuParticles.addToScene(scene);
                },
                removeFromScene: (scene) => {
                    this.gpuParticles.removeFromScene(scene);
                }
            };
            this.gameState.particlePool.addToScene(this.scene);
        } else {
            // Using CPU particle system
            const cpuPool = new ParticlePool(PARTICLE_CONFIG.poolSize, this.postProcessingManager);
            this.gameState.particlePool = {
                spawn: (x, y, z, color, size, velocity, category) => {
                    return cpuPool.spawn(x, y, z, color, size, velocity, category);
                },
                spawnPower: (x, y, z, color, size, velocity, power, category) => {
                    return cpuPool.spawnPower(x, y, z, color, size, velocity, power, category);
                },
                update: (deltaTime) => {
                    cpuPool.update(deltaTime);
                },
                clear: () => {
                    cpuPool.clear();
                },
                addToScene: (scene) => {
                    cpuPool.addToScene(scene);
                },
                removeFromScene: (scene) => {
                    cpuPool.removeFromScene(scene);
                }
            };
            this.gameState.particlePool.addToScene(this.scene);
        }
        
        // Initialize audio
        await this.audioSystem.initialize();
        this.audioSystem.startAmbientAudio();
        
        // Initialize game manager
        this.gameManager.initialize(this.camera, this.scene, this.effectsSystem, this.renderer, this.bubbleInstances);
        
        // Register power-ups
        this.gameManager.registerPowerUp(new RainbowPowerUp());
        this.gameManager.registerPowerUp(new BombPowerUp());
        this.gameManager.registerPowerUp(new PrecisionAimPowerUp());
        this.gameManager.registerPowerUp(new ChainLightningPowerUp());
        this.gameManager.registerPowerUp(new ColorSplashPowerUp());
        
        // Set up event listeners
        this.setupEventListeners();
        this.setupProgressiveGameEvents();
        
        // Initialize game
        this.gameBoard.create();
        this.createInitialBubbles();
        this.createShootingBubble();
        
        // Initialize power-up collection UI
        this.uiManager.updateCollectedPowerUps([]);
        
        // Initialize developer panel
        await developerPanel.initialize(this);
        
        // Initialize bubble effects controller
        await bubbleEffectsController.initialize(this.gameManager.eventBus);
        
        // Initialize smart color debug UI (if in debug mode)
        if (this.DEBUG_MODE) {
            this.smartColorDebugUI = new SmartColorDebugUI(this.smartColorSelectionSystem);
        }
        
        // Make game instance globally accessible for developer panel
        window.game = this;
        
        // Add optimization commands
        window.perfStats = () => performanceMonitor.getMetrics();
        window.setQuality = (level) => {
            shaderManager.qualityLevel = level;
            const settings = shaderManager.getEffectSettings();
            Object.assign(this.bubbleInstances.effects, settings);
            this.bubbleInstances.updateEffectUniforms();
            console.log(`Quality set to ${level}`, settings);
        };
        window.toggleDynamicQuality = () => {
            shaderManager.dynamicQuality = !shaderManager.dynamicQuality;
            console.log(`Dynamic quality: ${shaderManager.dynamicQuality ? 'enabled' : 'disabled'}`);
        };
        
        // Start game
        this.gameManager.eventBus.emit('gameStart');
        
        // Start performance monitoring
        this.performanceManager.startPerformanceMonitoring();
        
        // Start animation loop
        this.animate(0);
    }
    
    setupProgressiveGameEvents() {
        // Handle addNewRow event from timer system
        this.gameManager.eventBus.on('addNewRow', () => {
            if (this.gameLogic) {
                this.gameLogic.addNewRow();
                animationLoop.markDirty('gridChanged');
            }
        });
        
        // Handle bubble creation from new rows
        this.gameManager.eventBus.on('bubbleCreated', (data) => {
            const bubble = data.bubble;
            if (bubble && !bubble.useInstancedRendering) {
                this.scene.add(bubble.mesh);
                bubble.useInstancedRendering = true;
                this.bubbleInstances.addBubble(bubble);
            }
            // Register as animating if it has any animation
            if (bubble.connectionAnimating || bubble.powerUpAnimation) {
                bubbleUpdater.registerAnimatingBubble(bubble);
            }
        });
        
        // Handle game over event
        this.gameManager.eventBus.on('gameOver', (data) => {
            console.log('Game Over:', data?.reason || 'No reason provided');
            this.gameState.setGameOver();
            this.uiManager.showGameOver(this.gameState.score, this.gameState.level);
            this.gameManager.playSound('gameOver');
        });
        
        // Handle score updates
        this.gameManager.eventBus.on('scoreUpdated', (data) => {
            this.uiManager.updateScore(data.score);
            animationLoop.markDirty('uiNeedsUpdate');
        });
        
        // Handle bubble destruction
        this.gameManager.eventBus.on('bubblesDestroyed', (data) => {
            animationLoop.markDirty('gridChanged');
            this.optimizedTrajectory.invalidate();
            
            // Register impacted bubbles for animation
            if (data.impactedBubbles) {
                bubbleUpdater.addImpactedBubbles(data.impactedBubbles);
            }
        });
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Mouse/Touch controls with optimized tracking
        let lastMouseMoveTime = 0;
        const mouseThrottle = 16; // ~60 FPS for mouse tracking
        
        const handleMouseMoveThrottled = (e) => {
            const now = Date.now();
            if (now - lastMouseMoveTime < mouseThrottle) return;
            lastMouseMoveTime = now;
            this.handleMouseMove(e);
            animationLoop.markDirty('trajectoryNeedsUpdate');
        };
        
        window.addEventListener('mousemove', handleMouseMoveThrottled);
        window.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        window.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.handleMouseMove(touch);
            this.handleMouseDown(touch);
        });
        
        window.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            handleMouseMoveThrottled(touch);
        });
        
        window.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            this.handleMouseUp(touch);
        });
        
        // Debug keyboard controls
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Settings controls
        const settingsIcon = document.getElementById('settingsIcon');
        const settingsClose = document.getElementById('settingsClose');
        const gameOverlay = document.getElementById('gameOverlay');
        const musicToggle = document.getElementById('musicToggle');
        const musicVolumeSlider = document.getElementById('musicVolumeSlider');
        const musicVolumeValue = document.getElementById('musicVolumeValue');
        const effectsToggle = document.getElementById('effectsToggle');
        const effectsVolumeSlider = document.getElementById('effectsVolumeSlider');
        const effectsVolumeValue = document.getElementById('effectsVolumeValue');
        const powerupSlots = document.querySelectorAll('.powerup-collection-slot');
        
        settingsIcon?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openSettings();
        });
        
        settingsClose?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeSettings();
        });
        
        gameOverlay?.addEventListener('click', (e) => {
            if (e.target === gameOverlay) {
                this.closeSettings();
            }
        });
        
        // Music controls
        musicToggle?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const isEnabled = this.audioSystem.toggleMusic();
            this.gameManager.soundManager.setMusicEnabled(isEnabled);
            this.uiManager.updateMusicToggle(isEnabled);
            await settingsStorage.saveSetting('musicEnabled', isEnabled);
        });
        
        musicVolumeSlider?.addEventListener('input', async (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.audioSystem.setMusicVolume(volume);
            this.gameManager.soundManager.setMusicVolume(volume);
            if (musicVolumeValue) {
                musicVolumeValue.textContent = `${e.target.value}%`;
            }
            await settingsStorage.saveSetting('musicVolume', volume);
        });
        
        // Sound effects controls
        effectsToggle?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const soundManager = this.gameManager.soundManager;
            const isEnabled = !soundManager.getEffectsEnabled();
            soundManager.setEffectsEnabled(isEnabled);
            effectsToggle.classList.toggle('active', isEnabled);
            await settingsStorage.saveSetting('effectsEnabled', isEnabled);
        });
        
        effectsVolumeSlider?.addEventListener('input', async (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.gameManager.soundManager.setEffectsVolume(volume);
            if (effectsVolumeValue) {
                effectsVolumeValue.textContent = `${e.target.value}%`;
            }
            await settingsStorage.saveSetting('effectsVolume', volume);
        });
        
        // Power-up collection slots
        powerupSlots.forEach((slot, index) => {
            slot.addEventListener('click', (e) => {
                e.stopPropagation();
                this.activateCollectedPowerUp(index);
            });
        });
        
        // Game manager events
        this.gameManager.eventBus.on('startPrecisionAim', (data) => {
            this.gameState.activatePrecisionAim(data.duration);
            this.uiManager.showPrecisionAim(data.duration);
            this.optimizedTrajectory.invalidate();
        });
        
        this.gameManager.eventBus.on('bubbleAttached', (data) => {
            if (data.bubble && data.bubble.useInstancedRendering && this.bubbleInstances) {
                this.bubbleInstances.updateBubbleType(data.bubble, 'grid');
            }
            
            const attachedBubble = data.bubble;
            this.gameLogic.checkMatches(attachedBubble);
            
            // Mark trajectory as needing update
            this.optimizedTrajectory.invalidate();
            animationLoop.markDirty('gridChanged');
            
            this.gameState.currentBubble = null;
            
            // Check game over
            if (this.gameLogic.checkGameOver()) {
                this.uiManager.showGameOver(this.gameState.score, this.gameState.level, this.gameState.bestCombo);
            } else {
                setTimeout(() => this.createShootingBubble(), 500);
            }
        });
        
        this.gameManager.eventBus.on('createShootingBubble', () => {
            this.createShootingBubble();
        });
        
        // Initialize audio on first interaction
        document.addEventListener('click', async () => {
            if (!this.audioSystem.isInitialized) {
                await this.audioSystem.initialize();
                this.audioSystem.startAmbientAudio();
            }
        }, { once: true });
    }
    
    createInitialBubbles() {
        const rows = 9;
        for (let y = 0; y < rows; y++) {
            const bubblesInRow = CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                if (Math.random() > 0.3) { // 70% chance to place a bubble
                    const color = CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
                    const bubble = new Bubble(0, 0, color);
                    bubble.useInstancedRendering = true;
                    bubble.setGridPosition(x, y);
                    
                    // Override onWallBounce
                    bubble.onWallBounce = () => {
                        const speed = Math.sqrt(bubble.velocity.x * bubble.velocity.x + bubble.velocity.y * bubble.velocity.y);
                        const normalizedSpeed = Math.min(1, speed / 15);
                        const pitchVariation = 0.8 + normalizedSpeed * 0.4 + Math.random() * 0.2;
                        
                        if (this.gameManager.soundManager) {
                            this.gameManager.soundManager.play('bubbleBounce', {
                                volume: 0.4 + normalizedSpeed * 0.3,
                                rate: pitchVariation
                            });
                        }
                        this.createWallImpactParticles(bubble);
                        
                        this.sceneManager.createTemporaryLight(
                            new THREE.Vector3(bubble.position.x, bubble.position.y, 2),
                            0x00ffff,
                            2,
                            250
                        );
                    };
                    
                    this.bubbleInstances.addBubble(bubble, 'grid');
                    this.gameState.setBubbleAt(x, y, bubble);
                    this.gameManager.eventBus.emit('bubbleCreated', bubble);
                }
            }
        }
        
        // Force collision cache update
        this.collisionSystem.lastCacheUpdate = 0;
        this.collisionSystem.updateGridBubbleCache();
    }
    
    createShootingBubble() {
        // Prevent creating multiple shooting bubbles
        if (this.isCreatingShootingBubble) {
            return;
        }
        this.isCreatingShootingBubble = true;
        
        // Reset trajectory
        if (this.trajectorySystem) {
            this.trajectorySystem.resetPower();
        }
        
        // Clean up previous shooting bubble
        if (this.gameState.currentBubble) {
            if (this.gameState.currentBubble.useInstanceedRendering && this.bubbleInstances) {
                this.bubbleInstances.removeBubble(this.gameState.currentBubble);
            } else if (this.gameState.currentBubble.mesh && this.gameState.currentBubble.mesh.parent) {
                this.scene.remove(this.gameState.currentBubble.mesh);
            }
            
            // Queue for disposal
            memoryOptimizer.queueForDisposal(this.gameState.currentBubble.mesh);
            this.gameState.currentBubble.destroy();
            this.gameState.currentBubble = null;
        }
        
        let color;
        let powerUpToApply = null;
        let forcedTypeWasUsed = false;
        
        if (this.DEBUG_MODE && this.FORCED_NEXT_BUBBLE_TYPE !== null) {
            forcedTypeWasUsed = true;
            if (typeof this.FORCED_NEXT_BUBBLE_TYPE === 'number') {
                color = this.FORCED_NEXT_BUBBLE_TYPE;
            } else if (typeof this.FORCED_NEXT_BUBBLE_TYPE === 'string') {
                powerUpToApply = this.FORCED_NEXT_BUBBLE_TYPE;
                color = CONFIG.BUBBLE_COLORS[0];
            }
        } else {
            color = this.gameState.nextBubbleColor || this.smartColorSelectionSystem.getNextBubbleColor();
        }
        
        const bubble = new Bubble(0, CONFIG.SHOOTER_Y, color);
        bubble.isMoving = false;
        
        // Override onWallBounce
        bubble.onWallBounce = () => {
            const speed = Math.sqrt(bubble.velocity.x * bubble.velocity.x + bubble.velocity.y * bubble.velocity.y);
            const normalizedSpeed = Math.min(1, speed / 15);
            const pitchVariation = 0.8 + normalizedSpeed * 0.4 + Math.random() * 0.2;
            
            if (this.gameManager.soundManager) {
                this.gameManager.soundManager.play('bubbleBounce', {
                    volume: 0.4 + normalizedSpeed * 0.3,
                    rate: pitchVariation
                });
            }
            this.createWallImpactParticles(bubble);
            
            this.sceneManager.createTemporaryLight(
                new THREE.Vector3(bubble.position.x, bubble.position.y, 2),
                0x00ffff,
                2,
                250
            );
        };
        
        this.gameState.currentBubble = bubble;
        this.bubbleInstances.addBubble(bubble, 'shooting');
        bubble.useInstancedRendering = true;
        
        // Force trajectory recalculation
        this.optimizedTrajectory.invalidate();
        
        this.gameManager.eventBus.emit('bubbleCreated', bubble);
        
        // Handle power-ups
        let appliedPowerUpDetails = null;
        if (powerUpToApply) {
            const powerUpInstance = this.gameManager.powerUpSystem.getPowerUp(powerUpToApply);
            if (powerUpInstance) {
                if (powerUpToApply === 'precision') {
                    if (this.gameState.collectPowerUp(powerUpToApply, powerUpInstance)) {
                        this.uiManager.updateCollectedPowerUps(this.gameState.getCollectedPowerUps());
                        this.gameManager.playSound('powerUpCollect');
                        bubble.isPowerUp = false;
                        bubble.powerUpType = null;
                    }
                } else {
                    powerUpInstance.createVisualEffect(bubble, this.gameState);
                    appliedPowerUpDetails = powerUpInstance;
                }
            }
        } else if (!forcedTypeWasUsed) {
            if (this.gameManager.powerUpSystem.shouldSpawnPowerUp()) {
                const randomPowerUp = this.gameManager.powerUpSystem.getRandomPowerUp();
                if (randomPowerUp) {
                    if (randomPowerUp.type === 'precision') {
                        if (this.gameState.collectPowerUp(randomPowerUp.type, randomPowerUp)) {
                            this.uiManager.updateCollectedPowerUps(this.gameState.getCollectedPowerUps());
                            this.gameManager.playSound('powerUpCollect');
                        }
                    } else {
                        randomPowerUp.createVisualEffect(bubble, this.gameState);
                        appliedPowerUpDetails = randomPowerUp;
                    }
                }
            } else {
                bubble.isPowerUp = false;
                bubble.powerUpType = null;
            }
        }
        
        if (forcedTypeWasUsed) {
            this.FORCED_NEXT_BUBBLE_TYPE = null;
        }
        
        // Update UI
        if (appliedPowerUpDetails) {
            this.uiManager.showPowerUpIndicator(appliedPowerUpDetails);
        } else {
            this.uiManager.hidePowerUpIndicator();
        }
        
        this.gameState.nextBubbleColor = this.smartColorSelectionSystem.getNextBubbleColor();
        this.uiManager.updateNextBubble(this.gameState.nextBubbleColor);
        
        this.isCreatingShootingBubble = false;
    }
    
    createWallImpactParticles(bubble) {
        for (let i = 0; i < 10; i++) {
            this.gameState.particlePool.spawn(
                bubble.position.x,
                bubble.position.y,
                bubble.position.z,
                bubble.color,
                0.1,
                null,
                'wallImpact'
            );
        }
    }
    
    shootBubble(power) {
        if (!this.gameState.currentBubble || this.gameState.currentBubble.isMoving || this.gameState.isGameOver) return;
        
        if (this.trajectorySystem) {
            this.trajectorySystem.resetPower();
        }
        
        const direction = new THREE.Vector3(
            this.gameState.mousePosition.x - this.gameState.currentBubble.position.x,
            this.gameState.mousePosition.y - this.gameState.currentBubble.position.y,
            0
        );
        
        if (direction.y < 0.3) return;
        
        direction.normalize();
        
        const speed = this.gameState.precisionAimActive ? 
            CONFIG.SHOOTING_SPEED : 
            CONFIG.SHOOTING_SPEED + (CONFIG.MAX_SHOOTING_SPEED - CONFIG.SHOOTING_SPEED) * power;
        this.gameState.currentBubble.velocity = direction.multiplyScalar(speed);
        
        const bubble = this.gameState.currentBubble;
        if (bubble.powerUpAnimation) {
            bubble.powerUpAnimation.active = false;
            if (typeof bubble.powerUpAnimation.cleanupBombVisuals === 'function') {
                bubble.powerUpAnimation.cleanupBombVisuals();
            }
            const animIndex = this.gameState.animations.indexOf(bubble.powerUpAnimation);
            if (animIndex !== -1) {
                this.gameState.animations.splice(animIndex, 1);
            }
            bubble.powerUpAnimation = null;
        }
        
        this.gameState.currentBubble.startMoving();
        
        // Register as animating
        bubbleUpdater.registerAnimatingBubble(this.gameState.currentBubble);
        
        // Play sound
        if (bubble.powerUpType === 'chainLightning') {
            if (this.gameManager.soundManager) {
                const pitchRate = 0.7 + power * 0.5;
                const volume = 0.6 + power * 0.4;
                this.gameManager.soundManager.play('chainLightningThrow', {
                    volume: volume,
                    rate: pitchRate
                });
            }
        } else {
            this.gameManager.playSound('shoot');
        }
        
        // Hide trajectory while bubble is moving
        this.trajectorySystem.hide();
    }
    
    handleMouseMove(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        const vector = new THREE.Vector3(x, y, 0.5);
        vector.unproject(this.camera);
        
        const dir = vector.sub(this.camera.position).normalize();
        const distance = -this.camera.position.z / dir.z;
        const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
        
        this.gameState.mousePosition.set(pos.x, pos.y);
    }
    
    handleMouseDown(e) {
        if (!this.gameState.isPaused && !this.gameState.isGameOver) {
            this.gameState.startCharging();
        }
    }
    
    handleMouseUp(e) {
        if (!this.gameState.isPaused && !this.gameState.isGameOver) {
            const power = this.gameState.stopCharging();
            this.shootBubble(power);
            this.uiManager.updatePowerMeter(0);
        }
    }
    
    handleKeyDown(e) {
        // Debug controls
        if (this.DEBUG_MODE) {
            if (e.key >= '1' && e.key <= '9') {
                const colorIndex = parseInt(e.key) - 1;
                if (colorIndex < CONFIG.BUBBLE_COLORS.length) {
                    this.FORCED_NEXT_BUBBLE_TYPE = CONFIG.BUBBLE_COLORS[colorIndex];
                }
            }
            
            // Power-up shortcuts
            const powerUpKeys = {
                'r': 'rainbow',
                'b': 'bomb',
                'l': 'chainLightning',
                'p': 'precision',
                'c': 'colorSplash'
            };
            
            if (powerUpKeys[e.key.toLowerCase()]) {
                this.FORCED_NEXT_BUBBLE_TYPE = powerUpKeys[e.key.toLowerCase()];
            }
        }
    }
    
    handleResize() {
        this.sceneManager.handleResize();
    }
    
    openSettings() {
        this.uiManager.showSettings();
        this.gameState.pause();
    }
    
    closeSettings() {
        this.uiManager.hideSettings();
        this.gameState.resume();
    }
    
    async initializeAudioControls() {
        const musicToggle = document.getElementById('musicToggle');
        const musicVolumeSlider = document.getElementById('musicVolumeSlider');
        const musicVolumeValue = document.getElementById('musicVolumeValue');
        const effectsToggle = document.getElementById('effectsToggle');
        const effectsVolumeSlider = document.getElementById('effectsVolumeSlider');
        const effectsVolumeValue = document.getElementById('effectsVolumeValue');
        
        const savedMusicEnabled = await settingsStorage.loadSetting('musicEnabled', CONFIG.MUSIC_ENABLED);
        const savedMusicVolume = await settingsStorage.loadSetting('musicVolume', CONFIG.MUSIC_VOLUME);
        const savedEffectsEnabled = await settingsStorage.loadSetting('effectsEnabled', CONFIG.SOUND_ENABLED);
        const savedEffectsVolume = await settingsStorage.loadSetting('effectsVolume', CONFIG.SOUND_VOLUME);
        
        const soundManager = this.gameManager.soundManager;
        soundManager.setMusicEnabled(savedMusicEnabled);
        soundManager.setMusicVolume(savedMusicVolume);
        soundManager.setEffectsEnabled(savedEffectsEnabled);
        soundManager.setEffectsVolume(savedEffectsVolume);
        
        if (musicToggle) {
            musicToggle.classList.toggle('active', savedMusicEnabled);
        }
        
        if (musicVolumeSlider) {
            musicVolumeSlider.value = Math.round(savedMusicVolume * 100);
            if (musicVolumeValue) {
                musicVolumeValue.textContent = `${Math.round(savedMusicVolume * 100)}%`;
            }
        }
        
        if (effectsToggle) {
            effectsToggle.classList.toggle('active', savedEffectsEnabled);
        }
        
        if (effectsVolumeSlider) {
            effectsVolumeSlider.value = Math.round(savedEffectsVolume * 100);
            if (effectsVolumeValue) {
                effectsVolumeValue.textContent = `${Math.round(savedEffectsVolume * 100)}%`;
            }
        }
        
        this.audioSystem.musicEnabled = savedMusicEnabled;
        this.audioSystem.setMusicVolume(savedMusicVolume);
    }
    
    activateCollectedPowerUp(slotIndex) {
        if (!this.gameState.currentBubble || this.gameState.currentBubble.isMoving || 
            this.gameState.isGameOver || this.gameState.isPaused) return;
        
        const powerUpData = this.gameState.consumeCollectedPowerUpAt(slotIndex);
        if (powerUpData) {
            if (powerUpData.type === 'precision') {
                const powerUp = this.gameManager.powerUpSystem.getPowerUp(powerUpData.type);
                if (powerUp) {
                    this.gameManager.eventBus.emit('precisionAimActivated', { 
                        duration: powerUp.duration 
                    });
                    this.uiManager.updateCollectedPowerUps(this.gameState.getCollectedPowerUps());
                    this.uiManager.flashCollectionSlot(slotIndex);
                    this.gameManager.playSound('powerUpActivate');
                }
            }
        }
    }
    
    updateTrajectoryAndIndicator() {
        if (!this.gameState.currentBubble || this.gameState.currentBubble.isMoving) {
            this.trajectorySystem.hide();
            this.precisionAimIndicator.hide();
            return;
        }
        
        // Check if trajectory needs update using optimized system
        if (this.optimizedTrajectory.needsUpdate(
            this.gameState.currentBubble,
            this.gameState.mousePosition,
            this.gameState.precisionAimActive
        )) {
            this.trajectorySystem.calculateTrajectory(
                this.gameState.currentBubble,
                this.gameState.mousePosition,
                this.gameState,
                true
            );
        }
        
        // Update precision aim indicator if active
        if (this.gameState.precisionAimActive) {
            this.precisionAimIndicator.show(
                this.gameState.currentBubble.position,
                this.gameState.mousePosition,
                this.gameState.precisionAimTime,
                10
            );
        } else {
            this.precisionAimIndicator.hide();
        }
        
        this.trajectorySystem.renderTrajectory(this.gameState);
    }
    
    animate(currentTime) {
        requestAnimationFrame((time) => this.animate(time));
        
        // Handle first frame
        if (this.lastTime === 0) {
            this.lastTime = currentTime;
            return;
        }
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Clamp deltaTime
        let clampedDeltaTime = Math.min(deltaTime, 0.1);
        
        // Update performance monitoring
        performanceMonitor.update(this.renderer);
        shaderManager.updateFrameTime(deltaTime);
        
        // Process memory disposal queue
        memoryOptimizer.processDisposalQueue();
        
        // Update pause system
        this.pauseSystem.updateFrameCount();
        this.pauseSystem.updateGameTime(clampedDeltaTime);
        
        if (this.pauseSystem.getIsPaused()) {
            clampedDeltaTime = 0;
        }
        
        const shouldPause = this.pauseSystem.getIsPaused() || 
            this.pausedByNotification || 
            (this.gameManager.visualTextDisplay?.notificationManager?.blockingNotificationCount > 0);
        
        if (!this.gameState.isGameOver && !shouldPause) {
            // Update progressive game systems
            this.progressiveTimerSystem.update(clampedDeltaTime);
            this.dangerZoneSystem.update(clampedDeltaTime, this.camera);
            
            // Update precision aim
            if (this.gameState.updatePrecisionAim(clampedDeltaTime)) {
                this.precisionTickTimer += clampedDeltaTime;
                if (this.precisionTickTimer >= 1.0) {
                    this.gameManager.playSound('precisionTick');
                    this.precisionTickTimer = 0;
                }
                this.uiManager.updatePrecisionAim(this.gameState.precisionAimTime, 10);
            } else if (this.precisionTickTimer > 0) {
                this.precisionTickTimer = 0;
                this.uiManager.hidePrecisionAim();
                this.precisionAimIndicator.hide();
                this.optimizedTrajectory.invalidate();
            }
            
            // Update precision aim indicator
            this.precisionAimIndicator.update(clampedDeltaTime);
            
            // Update current bubble
            if (this.gameState.currentBubble && !shouldPause) {
                this.gameState.currentBubble.update(clampedDeltaTime);
                
                if (this.gameState.currentBubble.useInstancedRendering) {
                    this.bubbleInstances.updateBubble(this.gameState.currentBubble);
                }
                
                // Update trajectory only when needed
                if (animationLoop.shouldUpdate('trajectoryUpdate') || animationLoop.isDirty('trajectoryNeedsUpdate')) {
                    this.updateTrajectoryAndIndicator();
                    animationLoop.clearDirty('trajectoryNeedsUpdate');
                }
                
                // Check collisions
                if (this.collisionSystem.checkBubbleCollisions()) {
                    bubbleUpdater.unregisterAnimatingBubble(this.gameState.currentBubble);
                }
            }
            
            // Check for game over
            if (this.gameLogic.checkGameOver()) {
                if (!this.gameState.isGameOver) {
                    this.uiManager.showGameOver(this.gameState.score, this.gameState.level, this.gameState.bestCombo);
                }
            }
            
            // Update grid bubbles with optimized system
            if (animationLoop.shouldUpdate('gridBubbleUpdate') || animationLoop.isDirty('gridChanged')) {
                const hasUpdates = bubbleUpdater.updateBubbles(this.gameState, clampedDeltaTime, this.bubbleInstances);
                
                if (animationLoop.isDirty('gridChanged')) {
                    // Do a full grid check only when grid changed
                    let bubblesRemaining = 0;
                    for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
                        for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                            const bubble = this.gameState.getBubbleAt(x, y);
                            if (bubble && !bubble.isDestroyed && !bubble.isPowerUp) {
                                bubblesRemaining++;
                            }
                        }
                    }
                    
                    if (bubblesRemaining === 0 && !this.gameState.isGameOver) {
                        this.gameLogic.checkVictory();
                    }
                    
                    animationLoop.clearDirty('gridChanged');
                }
            }
            
            // Update instanced renderer uniforms
            if (this.bubbleInstances) {
                this.bubbleInstances.update(clampedDeltaTime, this.camera);
            }
            
            // Update collision cache periodically
            if (animationLoop.shouldUpdate('collisionCacheUpdate')) {
                this.collisionSystem.updateGridBubbleCache();
            }
            
            // Update ambient audio (throttled)
            if (animationLoop.shouldUpdate('audioUpdate')) {
                if (this.audioSystem.isInitialized && !this.gameState.isGameOver) {
                    this.audioSystem.update();
                }
            }
            
            // Update particles
            this.gameState.updateParticles(clampedDeltaTime);
            
            // Update animations
            this.gameState.updateAnimations(clampedDeltaTime);
            
            // Update game manager
            this.gameManager.update(clampedDeltaTime, this.camera);
            
            // Update Chain Lightning visual effects if present
            if (this.chainLightningVisuals) {
                this.chainLightningVisuals.update(clampedDeltaTime);
            }
            
            // Update power meter
            if (this.gameState.isCharging) {
                this.gameState.shootingPower = Math.min(this.gameState.shootingPower + clampedDeltaTime * 1, 1);
                this.uiManager.updatePowerMeter(this.gameState.shootingPower);
                
                if (this.gameState.currentBubble) {
                    const scale = 1 + this.gameState.shootingPower * 0.3;
                    if (this.gameState.currentBubble.useInstancedRendering) {
                        this.gameState.currentBubble.connectionScale = scale;
                        this.bubbleInstances.updateBubble(this.gameState.currentBubble);
                    } else {
                        this.gameState.currentBubble.mesh.scale.setScalar(scale);
                        this.gameState.currentBubble.material.emissiveIntensity = 0.1 + this.gameState.shootingPower * 0.4;
                    }
                }
            }
            
            // Check level progression
            const newLevel = Math.floor(this.gameState.score / 1000) + 1;
            if (newLevel > this.gameState.level) {
                this.gameState.level = newLevel;
                this.uiManager.updateLevel(this.gameState.level);
                this.gameLogic.addNewRow();
            }
            
            // Update UI scores (throttled)
            if (animationLoop.shouldUpdate('uiUpdate') || animationLoop.isDirty('uiNeedsUpdate')) {
                this.uiManager.updateScore(this.gameState.score);
                this.uiManager.updateLevel(this.gameState.level);
                animationLoop.clearDirty('uiNeedsUpdate');
            }
            
            // Render trajectory
            this.trajectorySystem.renderTrajectory(this.gameState);
        }
        
        // Update game board and lights when not paused
        if (!this.pauseSystem.getIsPaused()) {
            this.gameBoard.update(clampedDeltaTime, currentTime, this.gameState.mousePosition);
            this.sceneManager.animateLights(currentTime * 0.001);
        }
        
        // Always render
        if (!this.gameManager.render()) {
            const renderDeltaTime = this.pauseSystem.getIsPaused() ? 0 : clampedDeltaTime;
            this.sceneManager.render(renderDeltaTime);
        }
    }
}

// Initialize and start the game
const game = new BubbleShooterGameOptimized();

// Make restart functions globally available
window.restartGame = function() {
    location.reload();
};

window.retryLevel = function() {
    location.reload();
};

window.restartFromBeginning = function() {
    localStorage.removeItem('bubbleShooterProgress');
    location.reload();
};

window.debugBloom = function() {
    if (game.postProcessingManager) {
        return game.postProcessingManager.debugBloomState();
    }
    console.warn('PostProcessingManager not available');
};

window.refreshBloom = function() {
    if (game.postProcessingManager) {
        game.postProcessingManager.refreshBloomState();
        console.log('Bloom state refreshed');
    }
};