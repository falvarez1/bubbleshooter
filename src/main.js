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
import { SplashScreen, AssetLoader } from './ui/SplashScreen.js';

// Import new progressive game systems
import { ProgressiveTimerSystem } from './systems/ProgressiveTimerSystem.js';
import { DangerZoneSystem } from './systems/DangerZoneSystem.js';
import { ColorClusteringSystem } from './systems/ColorClusteringSystem.js';
import { LevelProgressionSystem } from './systems/LevelProgressionSystem.js';
import { SmartColorSelectionSystem } from './systems/SmartColorSelectionSystem.js';

// Main game class
class BubbleShooterGame {
    constructor(splashScreen = null) {
        // Store splash screen reference
        this.splashScreen = splashScreen;
        
        // Core systems
        this.gameState = new GameState();
        this.gameManager = new GameManager();
        
        // Create asset loader for Three.js assets
        this.assetLoader = new AssetLoader(this.gameManager.eventBus);
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
        // Pass post-processing manager to trajectory system for bloom
        this.postProcessingManager = this.sceneManager.getPostProcessing();
        this.trajectorySystem = new TrajectorySystem(this.scene, this.postProcessingManager);
        this.collisionSystem = new CollisionSystem(this.gameState, this.gameManager);
        this.gameLogic = new GameLogic(this.gameState, this.gameManager, this.scene);
        
        // Connect pause system to game logic so it can check pause state
        this.gameLogic.pauseSystem = this.pauseSystem;
        
        // Add bloom debugger (only in development)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.bloomDebugger = new BloomDebugger(this.postProcessingManager);
            // Don't add test object - it gets in the way of gameplay
            // User can add test objects manually via debug panel if needed
        }
        // Use event bus for communication instead of circular reference
        // GameManager can emit events that GameLogic responds to
        this.effectsSystem = new BubbleEffectsSystem(this.scene);
        this.precisionAimIndicator = new PrecisionAimIndicator(this.scene);
        
        // Initialize progressive game systems
        this.progressiveTimerSystem = new ProgressiveTimerSystem(this.gameState, this.gameManager.eventBus);
        this.dangerZoneSystem = new DangerZoneSystem(this.gameState, this.scene, this.gameManager.eventBus);
        this.colorClusteringSystem = new ColorClusteringSystem(this.gameState, this.gameManager.eventBus);
        this.levelProgressionSystem = new LevelProgressionSystem(this.gameState, this.gameManager.eventBus);
        // Connect pause system to level progression
        this.levelProgressionSystem.pauseSystem = this.pauseSystem;
        this.smartColorSelectionSystem = new SmartColorSelectionSystem(this.gameState, this.gameManager.eventBus);
        
        // Initialize instanced bubble renderer
        this.bubbleInstances = null; // Will be initialized after imports
        
        // Game properties
        this.DEBUG_MODE = true;
        this.FORCED_NEXT_BUBBLE_TYPE = null;
        this.lastTime = 0;
        this.precisionTickTimer = 0;
        
        // Performance optimization timers
        this.audioUpdateTimer = 0;
        this.uiUpdateTimer = 0;
        
        // Splash screen will be handled externally
        // The game will be started via handleGameStart and startGameLoop methods
        
        // Initialize
        this.initialize();
        
        // Add debug console commands for sound system
        if (this.DEBUG_MODE) {
            window.soundStatus = () => {
                const status = this.gameManager.soundManager.getStatus();
                // Sound System Status
                return status;
            };
        }
    }
    
    async initialize() {
        // Track initialization progress
        this.gameManager.eventBus.emit('asset:register', { id: 'performance-init', type: 'system' });
        
        // Initialize performance manager first
        await this.performanceManager.initialize();
        
        this.gameManager.eventBus.emit('asset:loaded', { id: 'performance-init' });
        
        // Initialize instanced bubble renderer
        this.gameManager.eventBus.emit('asset:register', { id: 'bubble-instances', type: 'system' });
        this.bubbleInstances = new BubbleInstances(this.scene, 300);
        // Instanced bubble renderer initialized
        this.gameManager.eventBus.emit('asset:loaded', { id: 'bubble-instances' });
        
        // Share references with game logic for bubble removal
        this.gameLogic.bubbleInstances = this.bubbleInstances;
        this.gameLogic.collisionSystem = this.collisionSystem;
        
        // Initialize UI controls based on CONFIG values
        this.initializeAudioControls();
        
        // Apply particle preset
        applyParticlePreset(PARTICLE_CONFIG.preset);
        
        // Create optimal particle system based on capabilities
        // TODO: GPU particles need debugging, using CPU for now
        const USE_GPU_PARTICLES = true; // Temporarily disabled
        this.gpuParticles = USE_GPU_PARTICLES ? this.performanceManager.createOptimalParticleSystem(this.scene) : null;
        
        if (this.gpuParticles) {
            // Using GPU particle system
            // Create a hybrid particle pool that uses GPU particles
            // Note: GPU particles don't support bloom categorization yet
            this.gameState.particlePool = {
                spawn: (x, y, z, color, _size, velocity, category) => {
                    // GPU particles don't support bloom categories yet
                    return this.gpuParticles.spawn(x, y, z, color, _size, velocity);
                },
                spawnPower: (x, y, z, color, size, velocity, power, category) => {
                    // Use power-based spawning for enhanced effects
                    const pos = new THREE.Vector3(x, y, z);
                    const count = Math.max(1, Math.floor(1 + power * 1.5)); // Reduced particle count
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
            // Fallback to CPU particle pool with power support
            const cpuPool = new ParticlePool(PARTICLE_CONFIG.poolSize, this.postProcessingManager);
            this.gameState.particlePool = {
                spawn: (x, y, z, color, size, velocity, category) => {
                    return cpuPool.spawn(x, y, z, color, size, velocity, category);
                },
                spawnPower: (x, y, z, color, size, velocity, power, category) => {
                    // Use power-based spawning for enhanced effects
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
        
        // Initialize game manager with camera, scene, effects system, renderer, and bubble instances
        this.gameManager.initialize(this.camera, this.scene, this.effectsSystem, this.renderer, this.bubbleInstances);
        
        // Register power-ups
        this.gameManager.registerPowerUp(new RainbowPowerUp());
        this.gameManager.registerPowerUp(new BombPowerUp());
        this.gameManager.registerPowerUp(new PrecisionAimPowerUp());
        this.gameManager.registerPowerUp(new ChainLightningPowerUp());
        this.gameManager.registerPowerUp(new ColorSplashPowerUp());
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Set up progressive game event handlers
        this.setupProgressiveGameEvents();
        
        // Initialize game
        this.gameBoard.create();
        this.createInitialBubbles();
        this.createShootingBubble();
        
        // Initialize power-up collection UI
        this.uiManager.updateCollectedPowerUps([]);
        
        // Initialize developer panel
        await developerPanel.initialize(this);
        
        // Initialize bubble effects controller with game manager's event bus
        await bubbleEffectsController.initialize(this.gameManager.eventBus);
        
        // Initialize smart color debug UI (if in debug mode)
        if (this.DEBUG_MODE) {
            this.smartColorDebugUI = new SmartColorDebugUI(this.smartColorSelectionSystem);
        }
        
        // Make game instance globally accessible for developer panel
        window.game = this;
        
        // Make effects controller available for debugging
        window.testEffect = (effectName) => bubbleEffectsController.testEffect(effectName);
        window.effectsController = bubbleEffectsController;
        
        // Add global cleanup commands for debugging ghost bubbles
        window.cleanupGhosts = () => {
            console.log('Running light orphaned visual cleanup...');
            const cleaned = this.gameLogic.cleanupOrphanedVisuals();
            console.log(`Cleanup complete. Removed ${cleaned} orphaned visuals.`);
            return cleaned;
        };
        
        // Force sync command (use with caution - can cause duplicates)
        window.forceSync = () => {
            console.warn('Running force sync - this may cause issues!');
            this.gameLogic.syncBubbleInstances();
        };
        
        // Debug command for precision aim
        window.testPrecisionAim = () => {
            this.gameManager.eventBus.emit('precisionAimActivated', { duration: 10 });
        };
        
        // Debug command to test ceiling collision
        window.testCeilingShot = () => {
            if (this.gameState.currentBubble) {
                const bubble = this.gameState.currentBubble;
                bubble.velocity.set(0, 100, 0); // High upward velocity
                bubble.startMoving();
                // Shooting bubble at ceiling with high velocity
            }
        };
        
        // Debug command for smart color selection stats
        window.colorStats = () => {
            const stats = this.smartColorSelectionSystem.getStatistics();
            console.log('Smart Color Selection Statistics:');
            console.log(`  Mode: ${stats.mode}`);
            console.log(`  Total Selections: ${stats.totalSelections}`);
            console.log(`  Helpful Selections: ${stats.helpfulSelections} (${stats.helpfulPercentage}%)`);
            console.log(`  Random Selections: ${stats.randomSelections}`);
            console.log(`  Current Helper Chance: ${stats.currentHelperChance}%`);
            console.log(`  Average Accessibility: ${(stats.averageAccessibility * 100).toFixed(1)}%`);
            return stats;
        };
        
        // Register remaining systems as loaded
        this.gameManager.eventBus.emit('asset:register', { id: 'game-systems', type: 'system' });
        setTimeout(() => {
            this.gameManager.eventBus.emit('asset:loaded', { id: 'game-systems' });
        }, 100);
        
        // Game will be started by splash screen callbacks
        // Do not auto-start here
    }
    
    setupProgressiveGameEvents() {
        // Handle addNewRow event from timer system
        this.gameManager.eventBus.on('addNewRow', () => {
            if (this.gameLogic) {
                this.gameLogic.addNewRow();
            }
        });
        
        // Handle bubble creation from new rows
        this.gameManager.eventBus.on('bubbleCreated', (data) => {
            const bubble = data.bubble;
            if (bubble && !bubble.useInstancedRendering) {
                // Add bubble to scene
                this.scene.add(bubble.mesh);
                // Enable instanced rendering
                bubble.useInstancedRendering = true;
                this.bubbleInstances.addBubble(bubble);
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
        });
        
        // Handle combo events for timer pausing
        this.gameManager.eventBus.on('comboStart', () => {
            // Timer will pause automatically
        });
        
        this.gameManager.eventBus.on('comboEnd', () => {
            // Timer will resume automatically
        });
        
        // Handle bubble destruction for timer reset
        this.gameManager.eventBus.on('bubblesDestroyed', (data) => {
            // Timer system will check for big clears automatically
        });
        
        // Handle zen moments
        this.gameManager.eventBus.on('zenMoment', (data) => {
            // Pause timer for zen moment duration
            this.progressiveTimerSystem.config.isPaused = true;
            setTimeout(() => {
                this.progressiveTimerSystem.config.isPaused = false;
            }, data.duration);
        });
        
        // Handle comprehensive pause events from notifications
        this.gameManager.eventBus.on('pauseAll', (data) => {
            if (data.reason === 'notification') {
                // Store current game state for resuming
                this.pausedByNotification = true;
                this.gameState.isPaused = true;
                
                // Pause timer system
                this.progressiveTimerSystem.config.isPaused = true;
                
                // Store bubble velocities if any are moving
                this.pausedBubbleStates = new Map();
                if (this.gameState.currentBubble && this.gameState.currentBubble.isMoving) {
                    this.pausedBubbleStates.set('current', {
                        velocity: this.gameState.currentBubble.velocity.clone(),
                        isMoving: true
                    });
                    // Zero out velocity
                    this.gameState.currentBubble.velocity.set(0, 0, 0);
                    this.gameState.currentBubble.isMoving = false;
                }
                
                console.log(`Game paused for ${data.notificationType} notification`);
            }
        });
        
        // Handle resume events from notifications
        this.gameManager.eventBus.on('resumeAll', (data) => {
            if (data.reason === 'notification' && this.pausedByNotification) {
                this.pausedByNotification = false;
                this.gameState.isPaused = false;
                
                // Resume timer system
                this.progressiveTimerSystem.config.isPaused = false;
                
                // Restore bubble velocities
                if (this.pausedBubbleStates && this.pausedBubbleStates.has('current')) {
                    const state = this.pausedBubbleStates.get('current');
                    if (this.gameState.currentBubble) {
                        this.gameState.currentBubble.velocity = state.velocity;
                        this.gameState.currentBubble.isMoving = state.isMoving;
                    }
                }
                this.pausedBubbleStates = null;
                
                console.log('Game resumed after notification');
            }
        });
        
        // Handle level settings changes
        this.gameManager.eventBus.on('levelSettingsChanged', (settings) => {
            console.log('Level settings updated:', settings);
        });
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Mouse/Touch controls
        window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        window.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.handleMouseMove(touch);
            this.handleMouseDown(touch);
        });
        
        window.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.handleMouseMove(touch);
        });
        
        window.addEventListener('touchend', (e) => {
            // For touchend, use the last known touch position if no touches remain
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
            // Save setting
            await settingsStorage.saveSetting('musicEnabled', isEnabled);
        });
        
        musicVolumeSlider?.addEventListener('input', async (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.audioSystem.setMusicVolume(volume);
            this.gameManager.soundManager.setMusicVolume(volume);
            if (musicVolumeValue) {
                musicVolumeValue.textContent = `${e.target.value}%`;
            }
            // Save setting
            await settingsStorage.saveSetting('musicVolume', volume);
        });
        
        // Sound effects controls
        effectsToggle?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const soundManager = this.gameManager.soundManager;
            const isEnabled = !soundManager.getEffectsEnabled();
            soundManager.setEffectsEnabled(isEnabled);
            effectsToggle.classList.toggle('active', isEnabled);
            // Save setting
            await settingsStorage.saveSetting('effectsEnabled', isEnabled);
        });
        
        effectsVolumeSlider?.addEventListener('input', async (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.gameManager.soundManager.setEffectsVolume(volume);
            if (effectsVolumeValue) {
                effectsVolumeValue.textContent = `${e.target.value}%`;
            }
            // Save setting
            await settingsStorage.saveSetting('effectsVolume', volume);
        });
        
        // Power-up collection slots click handlers
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
            
            // Immediately update trajectory and precision aim indicator
            this.updateTrajectoryAndIndicator();
        });
        
        this.gameManager.eventBus.on('bubbleAttached', (data) => {
            // Update bubble type in instanced renderer from 'shooting' to 'grid'
            if (data.bubble && data.bubble.useInstancedRendering && this.bubbleInstances) {
                this.bubbleInstances.updateBubbleType(data.bubble, 'grid');
            }
            
            // Clear current bubble reference AFTER checking matches
            // This ensures proper cleanup when creating the next bubble
            const attachedBubble = data.bubble;
            
            this.gameLogic.checkMatches(attachedBubble);
            
            // Force trajectory recalculation after bubble attachment and destruction
            // This ensures the laser beam updates to reflect the new game state
            const recalculateTrajectory = () => {
                if (this.gameState.currentBubble && !this.gameState.currentBubble.isMoving) {
                    this.trajectorySystem.calculateTrajectory(
                        this.gameState.currentBubble,
                        this.gameState.mousePosition,
                        this.gameState,
                        true // Force recalculation
                    );
                    this.trajectorySystem.renderTrajectory(this.gameState);
                }
            };
            
            // Recalculate immediately and after animations complete
            setTimeout(recalculateTrajectory, 100);
            setTimeout(recalculateTrajectory, 500); // After bubbles finish popping
            setTimeout(recalculateTrajectory, 1000); // Final update
            
            // NOW clear the reference after match checking is done
            this.gameState.currentBubble = null;
            
            // Check game over
            if (this.gameLogic.checkGameOver()) {
                this.uiManager.showGameOver(this.gameState.score, this.gameState.level, this.gameState.bestCombo);
            } else {
                // Create new bubble
                setTimeout(() => this.createShootingBubble(), 500);
            }
        });
        
        this.gameManager.eventBus.on('createShootingBubble', () => {
            this.createShootingBubble();
        });
        
        // UI updates
        this.gameManager.eventBus.on('scoreUpdated', (data) => {
            this.uiManager.updateScore(data.score);
        });
        
        this.gameManager.eventBus.on('comboAchieved', (data) => {
            this.uiManager.showCombo(data.comboSize);
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
            // All rows now have the same width
            const bubblesInRow = CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                if (Math.random() > 0.3) { // 70% chance to place a bubble
                    const color = CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
                    const bubble = new Bubble(0, 0, color);
                    // Set flag before setGridPosition so it doesn't update mesh
                    bubble.useInstancedRendering = true;
                    bubble.setGridPosition(x, y);
                    
                    // Override onWallBounce to play sound with variation
                    bubble.onWallBounce = () => {
                        // Play with pitch variation based on velocity
                        const speed = Math.sqrt(bubble.velocity.x * bubble.velocity.x + bubble.velocity.y * bubble.velocity.y);
                        const normalizedSpeed = Math.min(1, speed / 15); // Normalize to 0-1 range
                        const pitchVariation = 0.8 + normalizedSpeed * 0.4 + Math.random() * 0.2; // 0.8-1.4 range
                        
                        if (this.gameManager.soundManager) {
                            this.gameManager.soundManager.play('bubbleBounce', {
                                volume: 0.4 + normalizedSpeed * 0.3, // Louder for faster bounces
                                rate: pitchVariation
                            });
                        }
                        this.createWallImpactParticles(bubble);
                        
                        // Add wall flash effect
                        this.sceneManager.createTemporaryLight(
                            new THREE.Vector3(bubble.position.x, bubble.position.y, 2),
                            0x00ffff,
                            2,
                            250
                        );
                    };
                    
                    // Add bubble to instanced renderer instead of adding mesh to scene
                    this.bubbleInstances.addBubble(bubble, 'grid');
                    // useInstancedRendering already set before setGridPosition
                    
                    this.gameState.setBubbleAt(x, y, bubble);
                    
                    // Emit bubbleCreated event for effects controller
                    this.gameManager.eventBus.emit('bubbleCreated', bubble);
                    
                    // Initial bubbles should always be regular bubbles (no power-ups)
                    // Power-ups are only applied to shooting bubbles during gameplay
                }
            }
        }
        
        // Force collision cache update for initial bubbles
        // This ensures collision detection works immediately for initial grid bubbles
        this.collisionSystem.lastCacheUpdate = 0;
        this.collisionSystem.updateGridBubbleCache();
    }
    
    createShootingBubble() {
        // Prevent creating multiple shooting bubbles
        if (this.isCreatingShootingBubble) {
            // Already creating shooting bubble, skipping
            return;
        }
        this.isCreatingShootingBubble = true;
        
        // Reset trajectory power smoothing to prevent carryover from previous shot
        if (this.trajectorySystem) {
            this.trajectorySystem.resetPower();
        }
        
        // Debug: Creating new shooting bubble
        // Creating new shooting bubble
        
        // CRITICAL FIX: Properly clean up previous shooting bubble
        if (this.gameState.currentBubble) {
            // Cleaning up previous shooting bubble
            
            // Log cleanup
            // Cleaning up previous bubble
            
            // Remove from instanced renderer or scene
            if (this.gameState.currentBubble.useInstancedRendering && this.bubbleInstances) {
                this.bubbleInstances.removeBubble(this.gameState.currentBubble);
                // Removed bubble from instanced renderer
            } else if (this.gameState.currentBubble.mesh && this.gameState.currentBubble.mesh.parent) {
                this.scene.remove(this.gameState.currentBubble.mesh);
                // Removed individual mesh from scene
            }
            
            // Properly destroy the bubble to free all resources
            this.gameState.currentBubble.destroy();
            
            // Clear the reference
            this.gameState.currentBubble = null;
        }
        
        // Legacy cleanup for any remaining meshes at shooting position
        const shootingY = CONFIG.SHOOTER_Y;
        const meshesToRemove = [];
        
        this.scene.children.forEach(child => {
            if (child.isMesh && Math.abs(child.position.y - shootingY) < 0.1 && 
                child !== this.gameBoard && !child.name?.includes('wall') && !child.name?.includes('floor')) {
                meshesToRemove.push(child);
            }
        });
        
        meshesToRemove.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => mat.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        
        // Cleaned up legacy meshes
        
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
            // Use smart color selection system for regular bubbles
            color = this.gameState.nextBubbleColor || this.smartColorSelectionSystem.getNextBubbleColor();
        }
        
        const bubble = new Bubble(0, CONFIG.SHOOTER_Y, color);
        bubble.isMoving = false;

        // // Explicitly reset material to default to prevent lingering power-up effects
        // // This ensures that any modifications made by a previous power-up's visual effect
        // // on a bubble that might be reused or whose properties might otherwise persist
        // // are cleared before a new power-up (or no power-up) is applied.
        // const defaultMaterial = new THREE.MeshPhysicalMaterial({
        //     color: bubble.color, // Use the current bubble's intended color
        //     metalness: 0.1,
        //     roughness: 0.1,
        //     transmission: 0.5,
        //     thickness: 0.5,
        //     clearcoat: 1.0,
        //     clearcoatRoughness: 0.0,
        //     envMapIntensity: 1.5,
        //     ior: 1.5,
        //     reflectivity: 0.8,
        //     emissive: bubble.color,
        //     emissiveIntensity: 0.2,
        //     sheen: 1.0,
        //     sheenRoughness: 0.3,
        //     sheenColor: new THREE.Color(bubble.color).multiplyScalar(1.5)
        // });
        // // Dispose of the old material to prevent any lingering effects
        // if (bubble.mesh && bubble.mesh.material) {
        //     bubble.mesh.material.dispose();
        // }
        // if (bubble.material) {
        //     bubble.material.dispose();
        // }
        
        // // Set the new default material
        // if (bubble.mesh) {
        //     bubble.mesh.material = defaultMaterial;
        // }
        // bubble.material = defaultMaterial; // Ensure the bubble's own reference is updated

        // // Also reset power-up specific properties on the bubble instance itself
        // bubble.isPowerUp = false;
        // bubble.powerUpType = null;

        // // Before nullifying, explicitly clean up bomb visuals if the animation object has the method
        // if (bubble.powerUpAnimation) {
        //     // Mark as inactive first
        //     bubble.powerUpAnimation.active = false;
            
        //     if (typeof bubble.powerUpAnimation.cleanupBombVisuals === 'function') {
        //         bubble.powerUpAnimation.cleanupBombVisuals();
        //     }
        //     // Add similar checks for other power-ups if they have specific cleanup needs for their animations.
        // }

        // bubble.powerUpAnimation = null;
        
        // // Remove any power-up glow that might have been added
        // if (bubble.powerUpGlow && bubble.mesh) {
        //     bubble.mesh.remove(bubble.powerUpGlow);
        //     if (bubble.powerUpGlow.geometry) bubble.powerUpGlow.geometry.dispose();
        //     if (bubble.powerUpGlow.material) bubble.powerUpGlow.material.dispose();
        //     bubble.powerUpGlow = null;
        // }
        // // If power-ups add child meshes (like lightningCore), ensure they are removed.
        // // This might be better handled in a dedicated bubble.resetForShooter() method.
        // if (bubble.mesh && bubble.lightningCore) { // Example for ChainLightning
        //     bubble.mesh.remove(bubble.lightningCore);
        //     bubble.lightningCore.geometry.dispose();
        //     bubble.lightningCore.material.dispose();
        //     bubble.lightningCore = null;
        // }
        // if (bubble.mesh && bubble.electricArcs) { // Example for ChainLightning
        //     bubble.electricArcs.forEach(arc => {
        //         bubble.mesh.remove(arc.mesh);
        //         arc.mesh.geometry.dispose();
        //         arc.mesh.material.dispose();
        //     });
        //     bubble.electricArcs = [];
        // }
        
        // Override onWallBounce to play sound with variation
        bubble.onWallBounce = () => {
            // Play with pitch variation based on velocity
            const speed = Math.sqrt(bubble.velocity.x * bubble.velocity.x + bubble.velocity.y * bubble.velocity.y);
            const normalizedSpeed = Math.min(1, speed / 15); // Normalize to 0-1 range
            const pitchVariation = 0.8 + normalizedSpeed * 0.4 + Math.random() * 0.2; // 0.8-1.4 range
            
            if (this.gameManager.soundManager) {
                this.gameManager.soundManager.play('bubbleBounce', {
                    volume: 0.4 + normalizedSpeed * 0.3, // Louder for faster bounces
                    rate: pitchVariation
                });
            }
            this.createWallImpactParticles(bubble);
            
            // Add wall flash effect
            this.sceneManager.createTemporaryLight(
                new THREE.Vector3(bubble.position.x, bubble.position.y, 2),
                0x00ffff,
                2,
                250
            );
        };
        
        // Set as current bubble BEFORE adding to instanced renderer
        this.gameState.currentBubble = bubble;
        
        // Add bubble to instanced renderer instead of adding mesh to scene
        this.bubbleInstances.addBubble(bubble, 'shooting');
        bubble.useInstancedRendering = true;
        
        // Force trajectory recalculation with new bubble
        if (this.trajectorySystem) {
            this.trajectorySystem.calculateTrajectory(
                bubble,
                this.gameState.mousePosition,
                this.gameState,
                true // Force recalculation
            );
            this.trajectorySystem.renderTrajectory(this.gameState);
        }
        
        // Emit bubbleCreated event for effects controller
        this.gameManager.eventBus.emit('bubbleCreated', bubble);
        
        let appliedPowerUpDetails = null;
        if (powerUpToApply) {
            const powerUpInstance = this.gameManager.powerUpSystem.getPowerUp(powerUpToApply);
            if (powerUpInstance) {
                // Check if this is a collectable power-up
                if (powerUpToApply === 'precision') {
                    // Don't apply visual effect to bubble, collect it instead
                    if (this.gameState.collectPowerUp(powerUpToApply, powerUpInstance)) {
                        this.uiManager.updateCollectedPowerUps(this.gameState.getCollectedPowerUps());
                        this.gameManager.playSound('powerUpCollect');
                        // Don't make this bubble a power-up
                        bubble.isPowerUp = false;
                        bubble.powerUpType = null;
                    }
                } else {
                    // Apply visual effect for non-collectable power-ups
                    powerUpInstance.createVisualEffect(bubble, this.gameState);
                    appliedPowerUpDetails = powerUpInstance;
                }
            }
        } else if (!forcedTypeWasUsed) {
            // Random power-up chance
            if (this.gameManager.powerUpSystem.shouldSpawnPowerUp()) {
                const randomPowerUp = this.gameManager.powerUpSystem.getRandomPowerUp();
                if (randomPowerUp) {
                    // Check if this is a collectable power-up
                    if (randomPowerUp.type === 'precision') {
                        // Collect it instead of applying to bubble
                        if (this.gameState.collectPowerUp(randomPowerUp.type, randomPowerUp)) {
                            this.uiManager.updateCollectedPowerUps(this.gameState.getCollectedPowerUps());
                            this.gameManager.playSound('powerUpCollect');
                        }
                    } else {
                        // Apply visual effect for non-collectable power-ups
                        randomPowerUp.createVisualEffect(bubble, this.gameState);
                        appliedPowerUpDetails = randomPowerUp;
                    }
                }
            } else {
                // Explicitly ensure bubble is not a power-up if no power-up was applied
                bubble.isPowerUp = false;
                bubble.powerUpType = null;
                // Double-check no power-up visual elements exist
                if (bubble.powerUpGlow) {
                    bubble.mesh.remove(bubble.powerUpGlow);
                    bubble.powerUpGlow.geometry.dispose();
                    bubble.powerUpGlow.material.dispose();
                    bubble.powerUpGlow = null;
                }
                if (bubble.powerUpAnimation) {
                    bubble.powerUpAnimation.active = false;
                    bubble.powerUpAnimation = null;
                }
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
        
        // Set next bubble color using smart selection
        this.gameState.nextBubbleColor = this.smartColorSelectionSystem.getNextBubbleColor();
        this.uiManager.updateNextBubble(this.gameState.nextBubbleColor);
        
        // Debug: Shooting bubble created
        // Shooting bubble created
        
        // Reset flag
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
        
        // Reset trajectory power to prevent carryover to next bubble
        if (this.trajectorySystem) {
            this.trajectorySystem.resetPower();
        }
        
        // Calculate direction
        const direction = new THREE.Vector3(
            this.gameState.mousePosition.x - this.gameState.currentBubble.position.x,
            this.gameState.mousePosition.y - this.gameState.currentBubble.position.y,
            0
        );
        
        // Minimum upward angle requirement
        if (direction.y < 0.3) return;
        
        direction.normalize();
        
        // During precision aim, use fixed speed to prevent bubble from pushing through
        const speed = this.gameState.precisionAimActive ? 
            CONFIG.SHOOTING_SPEED : 
            CONFIG.SHOOTING_SPEED + (CONFIG.MAX_SHOOTING_SPEED - CONFIG.SHOOTING_SPEED) * power;
        this.gameState.currentBubble.velocity = direction.multiplyScalar(speed);
        
        // Clean up any power-up visual effects before shooting
        const bubble = this.gameState.currentBubble;
        if (bubble.powerUpAnimation) {
            // Stop the animation from updating
            bubble.powerUpAnimation.active = false;
            
            // Call any specific cleanup methods
            if (typeof bubble.powerUpAnimation.cleanupBombVisuals === 'function') {
                bubble.powerUpAnimation.cleanupBombVisuals();
            }
            
            // Remove the animation from the game state
            const animIndex = this.gameState.animations.indexOf(bubble.powerUpAnimation);
            if (animIndex !== -1) {
                this.gameState.animations.splice(animIndex, 1);
            }
            
            bubble.powerUpAnimation = null;
        }
        
        this.gameState.currentBubble.startMoving();
        
        // Play different sound for Chain Lightning with power-based pitch variation
        if (bubble.powerUpType === 'chainLightning') {
            if (this.gameManager.soundManager) {
                // Power affects pitch: lower pitch for soft shots (0.7), higher for powerful shots (1.2)
                const pitchRate = 0.7 + power * 0.5;
                // Volume also scales with power: quieter for soft (0.6), louder for powerful (1.0)
                const volume = 0.6 + power * 0.4;
                
                this.gameManager.soundManager.play('chainLightningThrow', {
                    volume: volume,
                    rate: pitchRate
                });
            }
        } else {
            // Regular bubble shoot sound with slight power variation
            if (this.gameManager.soundManager) {
                const pitchRate = 0.95 + power * 0.15; // Subtle pitch increase with power
                const volume = 0.7 + power * 0.2; // Slight volume increase with power
                
                this.gameManager.soundManager.play('bubbleShoot', {
                    volume: volume,
                    rate: pitchRate
                });
            }
        }
        this.createShootingEffect(this.gameState.currentBubble.position.clone(), power);
    }
    
    createShootingEffect(position, power = 0) {
        // Calculate the shooting direction from current bubble to mouse position
        const shootingDirection = new THREE.Vector3(
            this.gameState.mousePosition.x - this.gameState.currentBubble.position.x,
            this.gameState.mousePosition.y - this.gameState.currentBubble.position.y,
            0
        ).normalize();
        
        // Create rocket exhaust effect - particles go opposite to shooting direction
        const exhaustDirection = shootingDirection.clone().multiplyScalar(-1);
        
        // Scale effects based on power using configuration
        const config = PARTICLE_CONFIG?.rocketExhaust || {
            // Fallback configuration in case config not loaded
            baseParticles: 4,
            powerMultiplier: 1.2,
            sparkBaseSize: 0.05,
            sparkPowerSize: 0.03,
            baseSpeed: 4,
            maxSpeed: 10,
            speedVariation: 0.6,
            coneSpread: { 
                base: 0.3, 
                power: 0.5 
            },
            burstThreshold: 0.6,
            burstParticles: 6,
            burstConeAngle: 0.4,
            burstDecay: 0.08,
            colors: {
                low: 0x1e90ff,
                medium: 0xff8c00,
                high: 0xff4500,
                burst: { 
                    intensity: 0.8, 
                    yellow: 0.9, 
                    orange: 0.3 
                }
            },
            colorThresholds: { 
                medium: 0.4, 
                high: 0.7 
            }
        };
        
        const baseParticleCount = config.baseParticles;
        const powerMultiplier = 1 + power * config.powerMultiplier;
        const particleCount = Math.floor(baseParticleCount * powerMultiplier);
        
        // Enhanced colors based on power - like rocket exhaust
        const powerColor = power > config.colorThresholds.high ? config.colors.high :
                          power > config.colorThresholds.medium ? config.colors.medium :
                          config.colors.low;
        
        for (let i = 0; i < particleCount; i++) {
            // Create cone-shaped exhaust spread using config
            const spreadAngle = (power * config.coneSpread.power + config.coneSpread.base) * Math.PI;
            const randomAngle = (Math.random() - 0.5) * spreadAngle;
            const randomDistance = Math.random() * (power * 0.4 + 0.2);
            
            // Base speed increases with power using config
            const speedRange = config.maxSpeed - config.baseSpeed;
            const baseSpeed = config.baseSpeed + power * speedRange;
            const speedVariation = 1 - config.speedVariation + Math.random() * config.speedVariation * 2;
            
            // Create exhaust velocity in cone behind the bubble
            const exhaustVel = exhaustDirection.clone();
            
            // Add perpendicular spread for cone effect
            const perpendicular = new THREE.Vector3(-exhaustDirection.y, exhaustDirection.x, 0);
            exhaustVel.add(perpendicular.clone().multiplyScalar(Math.sin(randomAngle) * randomDistance));
            exhaustVel.add(new THREE.Vector3(0, 0, (Math.random() - 0.5) * 0.3));
            
            exhaustVel.normalize().multiplyScalar(baseSpeed * speedVariation);
            
            const velocity = exhaustVel;
            
            // Color variation based on power
            const colorVariation = Math.random() * 0.3;
            let finalColor = powerColor;
            if (power > 0.5) {
                // Mix in some hot colors for powerful shots
                const hotness = power * colorVariation;
                const r = ((finalColor >> 16) & 255) / 255;
                const g = ((finalColor >> 8) & 255) / 255;
                const b = (finalColor & 255) / 255;
                
                const hotColor = new THREE.Color(
                    Math.min(1, r + hotness), 
                    Math.min(1, g + hotness * 0.5), 
                    Math.max(0, b - hotness * 0.5)
                );
                finalColor = hotColor.getHex();
            }
            
            // Use smaller spark particles for rocket exhaust effect
            const sparkSize = config.sparkBaseSize + power * config.sparkPowerSize;
            
            // Use power-based spawning if available, otherwise fall back to regular spawn
            const particle = this.gameState.particlePool.spawnPower ? 
                this.gameState.particlePool.spawnPower(
                    position.x,
                    position.y,
                    position.z,
                    finalColor,
                    sparkSize,
                    velocity,
                    power,
                    'shootingParticles'
                ) :
                this.gameState.particlePool.spawn(
                    position.x,
                    position.y,
                    position.z,
                    finalColor,
                    sparkSize,
                    velocity,
                    'shootingParticles'
                );
            
            if (particle && !this.gameState.particlePool.spawnPower) {
                // Apply power effects manually for systems without spawnPower
                particle.decay = 0.04 / (1 + power * 0.5);
            }
        }
        
        // Add extra burst effect for high power shots
        if (power > config.burstThreshold) {
            this.createPowerBurstEffect(position, power);
        }
    }
    
    createPowerBurstEffect(position, power) {
        // Calculate the shooting direction for exhaust effect
        const shootingDirection = new THREE.Vector3(
            this.gameState.mousePosition.x - this.gameState.currentBubble.position.x,
            this.gameState.mousePosition.y - this.gameState.currentBubble.position.y,
            0
        ).normalize();
        
        // Create rocket exhaust burst - particles go opposite to shooting direction
        const exhaustDirection = shootingDirection.clone().multiplyScalar(-1);
        
        // Create an inner burst of high-energy sparks using config
        const config = PARTICLE_CONFIG?.rocketExhaust || {
            // Fallback configuration
            burstParticles: 6,
            burstConeAngle: 0.4,
            maxSpeed: 10,
            sparkBaseSize: 0.05,
            sparkPowerSize: 0.03,
            burstDecay: 0.08,
            colors: {
                burst: { 
                    intensity: 0.8, 
                    yellow: 0.9, 
                    orange: 0.3 
                }
            }
        };
        const burstCount = Math.floor(power * config.burstParticles);
        
        for (let i = 0; i < burstCount; i++) {
            // Create tight cone of high-speed exhaust sparks
            const coneAngle = Math.PI * config.burstConeAngle;
            const randomAngle = (Math.random() - 0.5) * coneAngle;
            const speed = config.maxSpeed * 1.2 + Math.random() * 8; // 20% higher than max speed
            
            // Create burst velocity in exhaust direction
            const burstVel = exhaustDirection.clone();
            
            // Add cone spread
            const perpendicular = new THREE.Vector3(-exhaustDirection.y, exhaustDirection.x, 0);
            burstVel.add(perpendicular.clone().multiplyScalar(Math.sin(randomAngle) * 0.3));
            burstVel.add(new THREE.Vector3(0, 0, (Math.random() - 0.5) * 0.4));
            
            burstVel.normalize().multiplyScalar(speed);
            
            const velocity = burstVel;
            
            // Hot white/yellow particles using config
            const burstConfig = config.colors.burst;
            const intensity = burstConfig.intensity + Math.random() * 0.2;
            const hotColor = new THREE.Color(intensity, intensity * burstConfig.yellow, intensity * burstConfig.orange);
            
            // Smaller spark size for burst effect
            const sparkSize = config.sparkBaseSize * 0.8 + power * config.sparkPowerSize * 0.5;
            
            // Use power-based spawning for burst effect
            const particle = this.gameState.particlePool.spawnPower ? 
                this.gameState.particlePool.spawnPower(
                    position.x,
                    position.y,
                    position.z,
                    hotColor.getHex(),
                    sparkSize,
                    velocity,
                    power,
                    'shootingParticles'
                ) :
                this.gameState.particlePool.spawn(
                    position.x,
                    position.y,
                    position.z,
                    hotColor.getHex(),
                    sparkSize,
                    velocity,
                    'shootingParticles'
                );
            
            if (particle && !this.gameState.particlePool.spawnPower) {
                // Apply power effects manually for systems without spawnPower
                particle.decay = config.burstDecay;
            }
        }
    }
    
    createShootingTrail(bubble) {
        const trailInterval = setInterval(() => {
            if (!bubble.isMoving) {
                clearInterval(trailInterval);
                return;
            }
            
            const particle = this.gameState.particlePool.spawn(
                bubble.position.x,
                bubble.position.y,
                bubble.position.z,
                bubble.color,
                0.2,
                null,
                'shootingParticles'
            );
            
            if (particle) {
                particle.decay = 0.05;
            }
        }, 50);
    }
    
    handleMouseMove(event) {
        if (this.gameState.isPaused) return;
        
        // Check if in design mode - hide trajectory
        if (this.designModeActive) {
            this.gameState.trajectory = [];
            if (this.trajectorySystem) {
                this.trajectorySystem.hideTrajectory();
            }
            return;
        }
        
        // Check if mouse is over any UI panel
        const uiPanels = [
            document.getElementById('developerPanel'),
            document.getElementById('bloom-debug-panel'),
            document.getElementById('settingsOverlay'),
            document.querySelector('.powerup-indicator'),
            document.querySelector('.precision-aim-timer'),
            document.querySelector('.powerup-collection')
        ];
        
        for (const panel of uiPanels) {
            if (panel && (panel.classList?.contains('visible') || 
                         (panel.style.display && panel.style.display !== 'none'))) {
                const rect = panel.getBoundingClientRect();
                if (event.clientX >= rect.left && event.clientX <= rect.right &&
                    event.clientY >= rect.top && event.clientY <= rect.bottom) {
                    // Don't update trajectory when hovering over UI panels
                    // Keep it visible but frozen
                    this.renderer.domElement.style.cursor = 'default';
                    return; // Mouse is over a UI panel, ignore mouse movement
                }
            }
        }
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const vector = new THREE.Vector3(x, y, 0.5);
        vector.unproject(this.camera);
        
        const dir = vector.sub(this.camera.position).normalize();
        const distance = -this.camera.position.z / dir.z;
        const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));
        
        this.gameState.mousePosition.set(pos.x, pos.y);
        
        // Update cursor style
        if (this.gameState.currentBubble && !this.gameState.currentBubble.isMoving) {
            const direction = new THREE.Vector3(
                pos.x - this.gameState.currentBubble.position.x,
                pos.y - this.gameState.currentBubble.position.y,
                0
            );
            
            if (direction.y < 0.3) {
                this.renderer.domElement.style.cursor = 'not-allowed';
            } else {
                this.renderer.domElement.style.cursor = 'crosshair';
            }
        }
        
        // Update trajectory immediately for responsiveness
        this.updateTrajectoryAndIndicator();
    }
    
    updateTrajectoryAndIndicator() {
        // Calculate trajectory
        this.trajectorySystem.calculateTrajectory(
            this.gameState.currentBubble,
            this.gameState.mousePosition,
            this.gameState
        );
        
        // Show/hide precision aim indicator
        if (this.gameState.precisionAimActive && this.gameState.trajectoryEndPosition) {
            const bubbleColor = this.gameState.currentBubble ? this.gameState.currentBubble.color : 0x00ffff;
            this.precisionAimIndicator.showAt(this.gameState.trajectoryEndPosition, bubbleColor);
        } else {
            this.precisionAimIndicator.hide();
        }
    }
    
    handleMouseDown(event) {
        // Check if in design mode
        if (this.designModeActive) return;
        
        // Check if click is on any UI panel (developer panel, bloom debug, settings, etc.)
        const uiPanels = [
            document.getElementById('developerPanel'),
            document.getElementById('bloom-debug-panel'),
            document.getElementById('settingsOverlay'),
            document.querySelector('.powerup-indicator'),
            document.querySelector('.precision-aim-timer')
        ];
        
        for (const panel of uiPanels) {
            if (panel && (panel.classList?.contains('visible') || panel.style.display !== 'none')) {
                const rect = panel.getBoundingClientRect();
                if (event.clientX >= rect.left && event.clientX <= rect.right &&
                    event.clientY >= rect.top && event.clientY <= rect.bottom) {
                    return; // Click is on a UI panel, ignore it
                }
            }
        }
        
        if (this.gameState.isGameOver || this.gameState.isPaused || 
            !this.gameState.currentBubble || this.gameState.currentBubble.isMoving) return;
        
        // Don't allow power charging during precision aim
        if (this.gameState.precisionAimActive) return;
        
        this.gameState.isCharging = true;
        this.uiManager.showPowerMeter();
    }
    
    handleMouseUp(event) {
        // Check if in design mode
        if (this.designModeActive) return;
        
        // Check if click is on any UI panel (developer panel, bloom debug, settings, etc.)
        const uiPanels = [
            document.getElementById('developerPanel'),
            document.getElementById('bloom-debug-panel'),
            document.getElementById('settingsOverlay'),
            document.querySelector('.powerup-indicator'),
            document.querySelector('.precision-aim-timer')
        ];
        
        for (const panel of uiPanels) {
            if (panel && (panel.classList?.contains('visible') || panel.style.display !== 'none')) {
                const rect = panel.getBoundingClientRect();
                if (event.clientX >= rect.left && event.clientX <= rect.right &&
                    event.clientY >= rect.top && event.clientY <= rect.bottom) {
                    // Reset charging state but don't shoot
                    if (this.gameState.isCharging) {
                        if (this.gameState.currentBubble) {
                            this.gameState.currentBubble.mesh.scale.setScalar(1);
                            this.gameState.currentBubble.material.emissiveIntensity = 0.1;
                        }
                        this.gameState.isCharging = false;
                        this.gameState.shootingPower = 0;
                        this.uiManager.hidePowerMeter();
                    }
                    return; // Click is on a UI panel, ignore it
                }
            }
        }
        
        if (this.gameState.isGameOver || this.gameState.isPaused || 
            !this.gameState.currentBubble || this.gameState.currentBubble.isMoving) return;
        
        // Allow shooting during precision aim with no power
        if (this.gameState.precisionAimActive) {
            this.shootBubble(0); // Shoot with no power
            return;
        }
        
        if (this.gameState.isCharging) {
            // Reset bubble scale
            if (this.gameState.currentBubble) {
                this.gameState.currentBubble.mesh.scale.setScalar(1);
                this.gameState.currentBubble.material.emissiveIntensity = 0.1;
            }
            
            this.shootBubble(this.gameState.shootingPower);
            this.gameState.isCharging = false;
            this.gameState.shootingPower = 0;
            this.uiManager.hidePowerMeter();
        }
    }
    
    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        
        // P key is handled by PauseSystem, but also update gameState
        if (key === 'p') {
            this.gameState.togglePause();
            return;
        }
        
        // Number keys 1-3 activate collected power-ups (not debug-only)
        if (key >= '1' && key <= '3') {
            const slotIndex = parseInt(key) - 1;
            this.activateCollectedPowerUp(slotIndex);
            return;
        }
        
        if (!this.DEBUG_MODE) return;
        
        let forcedType = null;
        
        // In debug mode, use A/S to cycle through bubble colors
        if (key === 'a' || key === 's') {
            // Get current color index
            let currentColorIndex = 0;
            if (this.gameState.currentBubble) {
                currentColorIndex = CONFIG.BUBBLE_COLORS.indexOf(this.gameState.currentBubble.color);
                if (currentColorIndex === -1) currentColorIndex = 0;
            }
            
            // Cycle forward (A) or backward (S)
            if (key === 'a') {
                currentColorIndex = (currentColorIndex + 1) % CONFIG.BUBBLE_COLORS.length;
            } else {
                currentColorIndex = (currentColorIndex - 1 + CONFIG.BUBBLE_COLORS.length) % CONFIG.BUBBLE_COLORS.length;
            }
            
            forcedType = CONFIG.BUBBLE_COLORS[currentColorIndex];
            // Debug: Cycling to bubble color
        } else {
            switch (key) {
                case '8':
                    forcedType = 'rainbow';
                    break;
                case '9':
                    forcedType = 'bomb';
                    break;
                case '0':
                    forcedType = 'chainLightning';
                    break;
                case '-':
                    forcedType = 'precision';
                    break;
                case '=':
                    forcedType = 'colorSplash';
                    break;
                case 'm':
                    const isEnabled = this.audioSystem.toggleMusic();
                    this.uiManager.updateMusicToggle(isEnabled);
                    break;
            }
        }
        
        if (forcedType !== null) {
            // For collectable power-ups, just collect them without changing current bubble
            if (forcedType === 'precision') {
                const powerUpInstance = this.gameManager.powerUpSystem.getPowerUp(forcedType);
                if (powerUpInstance && this.gameState.collectPowerUp(forcedType, powerUpInstance)) {
                    this.uiManager.updateCollectedPowerUps(this.gameState.getCollectedPowerUps());
                    this.gameManager.playSound('powerUpCollect');
                }
            } else {
                // For other power-ups, force them on the next bubble
                this.FORCED_NEXT_BUBBLE_TYPE = forcedType;
                if (this.gameState.currentBubble && !this.gameState.currentBubble.isMoving) {
                    // Remove from instanced renderer or scene before destroying
                    if (this.gameState.currentBubble.useInstancedRendering && this.bubbleInstances) {
                        this.bubbleInstances.removeBubble(this.gameState.currentBubble);
                    } else if (this.gameState.currentBubble.mesh && this.gameState.currentBubble.mesh.parent) {
                        this.scene.remove(this.gameState.currentBubble.mesh);
                    }
                    this.gameState.currentBubble.destroy();
                    this.gameState.currentBubble = null;
                    this.createShootingBubble();
                }
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
        
        // Load saved settings or use CONFIG defaults
        const savedMusicEnabled = await settingsStorage.loadSetting('musicEnabled', CONFIG.MUSIC_ENABLED);
        const savedMusicVolume = await settingsStorage.loadSetting('musicVolume', CONFIG.MUSIC_VOLUME);
        const savedEffectsEnabled = await settingsStorage.loadSetting('effectsEnabled', CONFIG.SOUND_ENABLED);
        const savedEffectsVolume = await settingsStorage.loadSetting('effectsVolume', CONFIG.SOUND_VOLUME);
        
        // Apply settings to SoundManager
        const soundManager = this.gameManager.soundManager;
        soundManager.setMusicEnabled(savedMusicEnabled);
        soundManager.setMusicVolume(savedMusicVolume);
        soundManager.setEffectsEnabled(savedEffectsEnabled);
        soundManager.setEffectsVolume(savedEffectsVolume);
        
        // Set music toggle state
        if (musicToggle) {
            musicToggle.classList.toggle('active', savedMusicEnabled);
        }
        
        // Set music volume slider and display
        if (musicVolumeSlider) {
            musicVolumeSlider.value = Math.round(savedMusicVolume * 100);
            if (musicVolumeValue) {
                musicVolumeValue.textContent = `${Math.round(savedMusicVolume * 100)}%`;
            }
        }
        
        // Set effects toggle state
        if (effectsToggle) {
            effectsToggle.classList.toggle('active', savedEffectsEnabled);
        }
        
        // Set effects volume slider and display
        if (effectsVolumeSlider) {
            effectsVolumeSlider.value = Math.round(savedEffectsVolume * 100);
            if (effectsVolumeValue) {
                effectsVolumeValue.textContent = `${Math.round(savedEffectsVolume * 100)}%`;
            }
        }
        
        // Also set AudioSystem music settings
        this.audioSystem.musicEnabled = savedMusicEnabled;
        this.audioSystem.setMusicVolume(savedMusicVolume);
    }
    
    activateCollectedPowerUp(slotIndex) {
        if (!this.gameState.currentBubble || this.gameState.currentBubble.isMoving || 
            this.gameState.isGameOver || this.gameState.isPaused) return;
        
        const powerUpData = this.gameState.consumeCollectedPowerUpAt(slotIndex);
        if (powerUpData) {
            // For precision aim, activate it immediately
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
            // Add handling for other collectable power-ups here in the future
        }
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
        
        // Clamp deltaTime to prevent issues with large gaps
        let clampedDeltaTime = Math.min(deltaTime, 0.1); // Max 100ms per frame
        
        // Update pause system tracking
        this.pauseSystem.updateFrameCount();
        this.pauseSystem.updateGameTime(clampedDeltaTime);
        
        // If paused by debug pause system, set deltaTime to 0 to freeze everything
        if (this.pauseSystem.getIsPaused()) {
            clampedDeltaTime = 0;
        }
        
        // Check if game should be paused due to blocking notifications or debug pause
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
                
                // Immediately update trajectory to revert to normal mode
                this.updateTrajectoryAndIndicator();
            }
            
            // Update precision aim indicator
            this.precisionAimIndicator.update(clampedDeltaTime);
            
            // Update current bubble only if not paused
            if (this.gameState.currentBubble && !shouldPause) {
                this.gameState.currentBubble.update(clampedDeltaTime);
                
                // Update instanced renderer for moving bubble
                if (this.gameState.currentBubble.useInstancedRendering) {
                    this.bubbleInstances.updateBubble(this.gameState.currentBubble);
                }
                
                // Update trajectory every frame
                // This ensures rainbow colors cycle and trajectory updates smoothly
                // Also ensures trajectory is hidden when bubble is moving
                this.updateTrajectoryAndIndicator();
                
                // Check collisions
                if (this.collisionSystem.checkBubbleCollisions()) {
                    // Collision handled
                }
            }
            
            // Check for game over condition every frame
            if (this.gameLogic.checkGameOver()) {
                if (!this.gameState.isGameOver) {
                    this.uiManager.showGameOver(this.gameState.score, this.gameState.level, this.gameState.bestCombo);
                }
            }
            
            // Update all grid bubbles and count non-power-up bubbles in one pass
            let bubblesRemaining = 0;
            const seenPositions = new Map(); // Track bubbles by position to detect duplicates
            
            for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
                for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                    const bubble = this.gameState.getBubbleAt(x, y);
                    if (bubble && bubble.isDestroyed) {
                        // Found a destroyed bubble still in grid - clean it up immediately
                        // Ghost bubble detected - removing from grid
                        this.gameState.bubbleGrid[y][x] = null;
                        continue;
                    }
                    if (bubble && !bubble.isDestroyed) {
                        // Check for duplicate bubbles at the same position
                        const posKey = `${bubble.position.x.toFixed(2)},${bubble.position.y.toFixed(2)}`;
                        if (seenPositions.has(posKey)) {
                            const otherBubble = seenPositions.get(posKey);
                            // Duplicate bubble found at position - removing duplicate
                            
                            // Remove the duplicate (keep the one in the correct grid position)
                            if (bubble.gridX !== x || bubble.gridY !== y) {
                                // This bubble is in the wrong position, remove it
                                this.gameLogic.destroyBubbleImmediately(bubble, true);
                                continue;
                            } else if (otherBubble.gridX !== otherBubble.expectedX || otherBubble.gridY !== otherBubble.expectedY) {
                                // The other bubble is in the wrong position, remove it
                                this.gameLogic.destroyBubbleImmediately(otherBubble, true);
                                seenPositions.set(posKey, bubble);
                            }
                        } else {
                            seenPositions.set(posKey, bubble);
                            bubble.expectedX = x;
                            bubble.expectedY = y;
                        }
                        // Migrate non-instanced bubbles to instanced rendering
                        if (!bubble.useInstancedRendering && !bubble.isDestroyed) {
                            // Migrating non-instanced bubble to instanced rendering
                            // Remove mesh from scene if it was added
                            if (bubble.mesh && bubble.mesh.parent) {
                                this.scene.remove(bubble.mesh);
                            }
                            // Set flag and add to instanced renderer
                            bubble.useInstancedRendering = true;
                            this.bubbleInstances.addBubble(bubble, 'grid');
                        }
                        
                        // Only update bubbles if not paused by notification
                        if (!shouldPause) {
                            bubble.update(clampedDeltaTime);
                        }
                        
                        // Only update instanced renderer if bubble is animating or has impact physics
                        if (bubble.useInstancedRendering && 
                            (bubble.connectionAnimating || 
                             bubble.impactVelocity.lengthSq() > 0.001 ||
                             bubble.powerUpAnimation)) {
                            this.bubbleInstances.updateBubble(bubble);
                        }
                        
                        if (!bubble.isPowerUp) {
                            bubblesRemaining++;
                        }
                    }
                }
            }
            
            // Update instanced renderer uniforms (time-based animations)
            if (this.bubbleInstances) {
                this.bubbleInstances.update(clampedDeltaTime, this.camera);
            }
            
            // Periodic victory check (as a safety net)
            if (!this.victoryCheckTimer) this.victoryCheckTimer = 0;
            this.victoryCheckTimer += clampedDeltaTime;
            if (this.victoryCheckTimer > 1.0) { // Check every second
                this.victoryCheckTimer = 0;
                if (bubblesRemaining === 0 && !this.gameState.isGameOver) {
                    // No bubbles remaining - triggering victory check
                    this.gameLogic.checkVictory();
                }
            }
            
            // Update ambient audio based on game state (throttled to 30fps)
            this.audioUpdateTimer += clampedDeltaTime;
            if (this.audioUpdateTimer >= 0.033 && this.audioSystem.isInitialized && !this.gameState.isGameOver) {
                this.audioUpdateTimer = 0;
                
                // Calculate how close we are to clearing the board
                const clearPercentage = 1 - (bubblesRemaining / 50); // Assume ~50 bubbles is "full"
                
                // Swell ambient audio when close to clearing
                if (bubblesRemaining < 10 || clearPercentage > 0.8) {
                    const swellFactor = bubblesRemaining < 10 ?
                        1 - (bubblesRemaining / 10) :
                        (clearPercentage - 0.8) * 5;
                    
                    this.audioSystem.updateAmbientVolume(swellFactor);
                } else {
                    this.audioSystem.updateAmbientVolume(0);
                }
                
                this.audioSystem.update();
            }
            
            // Update particles
            this.gameState.updateParticles(clampedDeltaTime);
            
            // Update animations
            const animationsBefore = this.gameState.animations.length;
            this.gameState.updateAnimations(clampedDeltaTime);
            const animationsAfter = this.gameState.animations.length;
            
            // If animations finished, recalculate trajectory
            if (animationsBefore > 0 && animationsAfter < animationsBefore) {
                if (this.gameState.currentBubble && !this.gameState.currentBubble.isMoving) {
                    this.trajectorySystem.calculateTrajectory(
                        this.gameState.currentBubble,
                        this.gameState.mousePosition,
                        this.gameState,
                        true // Force recalculation
                    );
                    this.trajectorySystem.renderTrajectory(this.gameState);
                }
            }
            
            // Update game manager
            this.gameManager.update(clampedDeltaTime, this.camera);
            
            // Update Chain Lightning visual effects if present
            if (this.chainLightningVisuals) {
                this.chainLightningVisuals.update(clampedDeltaTime);
            }
            
            // Update power meter
            if (this.gameState.isCharging) {
                // Reduced from 2 to 1 to double the charge time (from 0.5s to 1s for full charge)
                this.gameState.shootingPower = Math.min(this.gameState.shootingPower + clampedDeltaTime * 1, 1);
                this.uiManager.updatePowerMeter(this.gameState.shootingPower);
                
                if (this.gameState.currentBubble) {
                    const scale = 1 + this.gameState.shootingPower * 0.3;
                    if (this.gameState.currentBubble.useInstancedRendering) {
                        // Update scale in instanced renderer
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
            
            // Update UI scores (throttled to 20fps)
            this.uiUpdateTimer += clampedDeltaTime;
            if (this.uiUpdateTimer >= 0.05) {
                this.uiUpdateTimer = 0;
                this.uiManager.updateScore(this.gameState.score);
                this.uiManager.updateLevel(this.gameState.level);
            }
            
            // Render trajectory
            this.trajectorySystem.renderTrajectory(this.gameState);
        }
        
        // When paused, skip updates but still render for debugging visibility
        if (!this.pauseSystem.getIsPaused()) {
            // Update game board (starfield, etc.) only when not paused
            this.gameBoard.update(clampedDeltaTime, currentTime, this.gameState.mousePosition);
            
            // Animate lights only when not paused
            this.sceneManager.animateLights(currentTime * 0.001);
        }
        
        // Always render, even when paused (for debugging)
        if (!this.gameManager.render()) {
            // Pass deltaTime to scene manager for post-processing
            // Use 0 deltaTime when paused to freeze post-processing effects
            const renderDeltaTime = this.pauseSystem.getIsPaused() ? 0 : clampedDeltaTime;
            this.sceneManager.render(renderDeltaTime);
        }
    }
    
    /**
     * Handle game start from splash screen
     */
    handleGameStart(data) {
        if (data.newGame) {
            // Reset game state for new game
            this.gameState.reset();
            this.gameState.level = 1;
            this.levelProgressionSystem.loadLevel(1);
        } else {
            // Load saved game
            this.loadSavedGame();
        }
        
        // Start game
        this.gameManager.eventBus.emit('gameStart');
        
        // Start performance monitoring
        this.performanceManager.startPerformanceMonitoring();
    }
    
    /**
     * Start the game animation loop
     */
    startGameLoop() {
        // Start animation loop
        this.animate(0);
    }
    
    /**
     * Load saved game from localStorage
     */
    loadSavedGame() {
        try {
            const savedGame = localStorage.getItem('bubbleShooterSave');
            if (savedGame) {
                const gameData = JSON.parse(savedGame);
                
                // Restore game state
                this.gameState.level = gameData.level || 1;
                this.gameState.score = gameData.score || 0;
                this.gameState.highScore = gameData.highScore || 0;
                
                // Load the saved level
                this.levelProgressionSystem.loadLevel(this.gameState.level);
                
                // Update UI
                this.uiManager.updateScore(this.gameState.score);
                this.uiManager.updateLevel(this.gameState.level);
                
                console.log(`Loaded saved game at level ${this.gameState.level}`);
            }
        } catch (e) {
            console.error('Failed to load saved game:', e);
            // Fall back to new game
            this.gameState.reset();
            this.levelProgressionSystem.loadLevel(1);
        }
    }
    
    /**
     * Save game state to localStorage
     */
    saveGame() {
        try {
            const gameData = {
                level: this.gameState.level,
                score: this.gameState.score,
                highScore: this.gameState.highScore,
                timestamp: Date.now()
            };
            
            localStorage.setItem('bubbleShooterSave', JSON.stringify(gameData));
            console.log(`Game saved at level ${this.gameState.level}`);
        } catch (e) {
            console.error('Failed to save game:', e);
        }
    }
}

// Initialize splash screen and asset loader
const splashScreen = new SplashScreen();
const assetLoader = new AssetLoader(splashScreen);

// Set up callbacks for menu actions
splashScreen.onStart(() => {
    // Start new game
    game.handleGameStart({ newGame: true });
    game.startGameLoop();
});

splashScreen.onContinue(() => {
    // Continue saved game
    game.handleGameStart({ newGame: false });
    game.startGameLoop();
});

// Initialize the game (but don't start the loop yet)
const game = new BubbleShooterGame(splashScreen);

// Simulate asset loading
// In a real implementation, you would track actual Three.js asset loading
assetLoader.loadAll(THREE, () => {
    console.log('All assets loaded');
});

// Make game globally accessible for debugging
window.game = game;

// Make restart functions globally available
window.restartGame = function() {
    location.reload(); // Simple reload for now
};

// Retry the current level (keep progress)
window.retryLevel = function() {
    // Just reload - this will load from saved progress at current level
    location.reload();
};

// Start a completely new game from level 1
window.restartFromBeginning = function() {
    // Clear all saved progress
    localStorage.removeItem('bubbleShooterProgress');
    // Then reload to start fresh
    location.reload();
};

// Make bloom debug functions globally available
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