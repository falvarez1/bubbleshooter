import * as THREE from 'three';
import { CONFIG, PARTICLE_CONFIG, applyParticlePreset } from './core/Config.js';
import { GameState } from './core/GameState.js';
import { GameManager } from './core/GameManager.js';
import { SceneManager } from './graphics/SceneManager.js';
import { GameBoard } from './graphics/GameBoard.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { TrajectorySystem } from './systems/TrajectorySystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { GameLogic } from './systems/GameLogic.js';
import { UIManager } from './ui/VisualTextDisplay.js';
import { PerformanceManager } from './core/PerformanceManager.js';
import { Bubble } from './entities/Bubble.js';
import { ParticlePool, Particle } from './entities/Particle.js';
import { 
    RainbowPowerUp, 
    BombPowerUp, 
    PrecisionAimPowerUp,
    ChainLightningPowerUp,
    ColorSplashPowerUp
} from './powerups/index.js';

// Main game class
class BubbleShooterGame {
    constructor() {
        // Core systems
        this.gameState = new GameState();
        this.gameManager = new GameManager();
        this.sceneManager = new SceneManager(document.getElementById('gameCanvas'));
        this.audioSystem = new AudioSystem();
        this.uiManager = new UIManager();
        this.performanceManager = new PerformanceManager();
        
        // Get Three.js objects
        this.scene = this.sceneManager.getScene();
        this.camera = this.sceneManager.getCamera();
        this.renderer = this.sceneManager.getRenderer();
        
        // Game systems
        this.gameBoard = new GameBoard(this.scene, this.gameState);
        this.trajectorySystem = new TrajectorySystem(this.scene);
        this.collisionSystem = new CollisionSystem(this.gameState, this.gameManager);
        this.gameLogic = new GameLogic(this.gameState, this.gameManager, this.scene);
        
        // Game properties
        this.DEBUG_MODE = true;
        this.FORCED_NEXT_BUBBLE_TYPE = null;
        this.lastTime = 0;
        this.precisionTickTimer = 0;
        
        // Performance optimization timers
        this.audioUpdateTimer = 0;
        this.uiUpdateTimer = 0;
        
        // Initialize
        this.initialize();
        
        // Add debug console commands for sound system
        if (this.DEBUG_MODE) {
            window.soundStatus = () => {
                const status = this.gameManager.soundManager.getStatus();
                console.log('Sound System Status:', status);
                return status;
            };
        }
    }
    
    async initialize() {
        // Initialize performance manager first
        await this.performanceManager.initialize();
        
        // Create optimal bubble renderer based on capabilities
        this.bubbleRenderer = this.performanceManager.createOptimalBubbleRenderer(this.scene, 200);
        if (this.bubbleRenderer) {
            console.log('Using instanced bubble rendering for grid bubbles');
            
            this.bubbleRenderer.setQualityPreset('low'); // Set initial quality preset
            // Configure bubble special effects
            // Enable multiple effects for better visibility
            this.bubbleRenderer.setEffects({
                enableTransmission: true,
                enableRainbow: true,
                enableFoam: true,
                enableWobble: true
            });
            
            // Alternative: Use a quality preset for all effects
            // this.bubbleRenderer.setQualityPreset('ultra');
            
            // Debug: Check if uniforms are properly set
            const material = this.bubbleRenderer.instancedMesh.material;
            console.log('Sparkles uniform value:', material.uniforms.enableSparkles.value);
            console.log('Rainbow uniform value:', material.uniforms.enableRainbow.value);
            
            // Log current effect settings
            console.log('Bubble effects:', this.bubbleRenderer.getEffects());
        } else {
            console.log('Using individual meshes for all bubbles');
        }
        
        // Apply particle preset
        applyParticlePreset(PARTICLE_CONFIG.preset);
        
        // Initialize particle pool
        this.gameState.particlePool = new ParticlePool(PARTICLE_CONFIG.poolSize);
        this.gameState.particlePool.addToScene(this.scene);
        
        // Initialize audio
        await this.audioSystem.initialize();
        this.audioSystem.startAmbientAudio();
        
        // Initialize game manager with camera and scene
        this.gameManager.initialize(this.camera, this.scene);
        
        // Pass bubble renderer to game logic for proper cleanup
        if (this.bubbleRenderer) {
            this.gameLogic.setBubbleRenderer(this.bubbleRenderer);
        }
        
        // Register power-ups
        this.gameManager.registerPowerUp(new RainbowPowerUp());
        this.gameManager.registerPowerUp(new BombPowerUp());
        this.gameManager.registerPowerUp(new PrecisionAimPowerUp());
        this.gameManager.registerPowerUp(new ChainLightningPowerUp());
        this.gameManager.registerPowerUp(new ColorSplashPowerUp());
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize game
        this.gameBoard.create();
        this.createInitialBubbles();
        this.createShootingBubble();
        
        // Initialize power-up collection UI
        this.uiManager.updateCollectedPowerUps([]);
        
        // Start game
        this.gameManager.eventBus.emit('gameStart');
        
        // Start performance monitoring
        this.performanceManager.startPerformanceMonitoring();
        
        // Start animation loop
        this.animate(0);
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
        
        window.addEventListener('touchend', (e) => this.handleMouseUp(e));
        
        // Debug keyboard controls
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Settings controls
        const settingsIcon = document.getElementById('settingsIcon');
        const settingsClose = document.getElementById('settingsClose');
        const gameOverlay = document.getElementById('gameOverlay');
        const musicToggle = document.getElementById('musicToggle');
        const volumeSlider = document.getElementById('volumeSlider');
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
        
        musicToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isEnabled = this.audioSystem.toggleMusic();
            this.uiManager.updateMusicToggle(isEnabled);
        });
        
        volumeSlider?.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.audioSystem.setMusicVolume(volume);
            this.uiManager.updateVolume(volume);
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
        });
        
        this.gameManager.eventBus.on('bubbleAttached', (data) => {
            this.gameLogic.checkMatches(data.bubble);
            
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
        const rows = 5;
        for (let y = 0; y < rows; y++) {
            const isOddRow = y % 2 === 1;
            const bubblesInRow = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                if (Math.random() > 0.3) { // 70% chance to place a bubble
                    const color = CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
                    const bubble = new Bubble(0, 0, color);
                    bubble.setGridPosition(x, y);
                    
                    // Override onWallBounce to play sound
                    bubble.onWallBounce = () => {
                        this.gameManager.playSound('bubbleBounce');
                        this.createWallImpactParticles(bubble);
                        
                        // Add wall flash effect
                        this.sceneManager.createTemporaryLight(
                            new THREE.Vector3(bubble.position.x, bubble.position.y, 2),
                            0x00ffff,
                            2,
                            250
                        );
                    };
                    
                    // Add to instanced renderer if available, otherwise use individual mesh
                    if (this.bubbleRenderer) {
                        this.bubbleRenderer.addBubble(bubble);
                        // Mark bubble as using instanced rendering
                        bubble.useInstancedRendering = true;
                        // Hide the individual mesh since we're using instanced rendering
                        bubble.mesh.visible = false;
                    } else {
                        this.scene.add(bubble.mesh);
                        bubble.useInstancedRendering = false;
                    }
                    
                    this.gameState.setBubbleAt(x, y, bubble);
                    
                    // Apply power-up with lower rate for initial bubbles
                    if (Math.random() < 0.05) { // 5% chance for initial bubbles
                        this.gameManager.applyPowerUpToBubble(bubble);
                    }
                }
            }
        }
    }
    
    createShootingBubble() {
        // Force cleanup of any orphaned meshes at shooting position before creating new bubble
        // Use a more efficient approach - only check direct children of scene at shooting position
        const shootingY = CONFIG.SHOOTER_Y;
        const meshesToRemove = [];
        
        // Only check immediate children of scene to avoid expensive traversal
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
            color = this.gameState.nextBubbleColor ||
                CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
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
        
        // Override onWallBounce to play sound
        bubble.onWallBounce = () => {
            this.gameManager.playSound('bubbleBounce');
            this.createWallImpactParticles(bubble);
            
            // Add wall flash effect
            this.sceneManager.createTemporaryLight(
                new THREE.Vector3(bubble.position.x, bubble.position.y, 2),
                0x00ffff,
                2,
                250
            );
        };
        
        // Always use individual mesh for shooting bubble (needs special effects)
        this.scene.add(bubble.mesh);
        bubble.useInstancedRendering = false;
        this.gameState.currentBubble = bubble;
        
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
                    powerUpInstance.createVisualEffect(bubble);
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
                        randomPowerUp.createVisualEffect(bubble);
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
        
        // Set next bubble color
        this.gameState.nextBubbleColor = CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
        this.uiManager.updateNextBubble(this.gameState.nextBubbleColor);
    }
    
    createWallImpactParticles(bubble) {
        for (let i = 0; i < 10; i++) {
            this.gameState.particlePool.spawn(
                bubble.position.x,
                bubble.position.y,
                bubble.position.z,
                bubble.color,
                0.1
            );
        }
    }
    
    shootBubble(power) {
        if (!this.gameState.currentBubble || this.gameState.currentBubble.isMoving || this.gameState.isGameOver) return;
        
        // Calculate direction
        const direction = new THREE.Vector3(
            this.gameState.mousePosition.x - this.gameState.currentBubble.position.x,
            this.gameState.mousePosition.y - this.gameState.currentBubble.position.y,
            0
        );
        
        // Minimum upward angle requirement
        if (direction.y < 0.3) return;
        
        direction.normalize();
        
        const speed = CONFIG.SHOOTING_SPEED + (CONFIG.MAX_SHOOTING_SPEED - CONFIG.SHOOTING_SPEED) * power;
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
        
        this.gameState.currentBubble.isMoving = true;
        
        this.gameManager.playSound('bubbleShoot');
        this.createShootingEffect(this.gameState.currentBubble.position.clone());
    }
    
    createShootingEffect(position) {
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * 3,
                Math.sin(angle) * 3,
                0
            );
            
            const particle = this.gameState.particlePool.spawn(
                position.x,
                position.y,
                position.z,
                0x00ffff,
                0.15,
                velocity
            );
            
            if (particle) {
                particle.decay = 0.04;
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
                0.2
            );
            
            if (particle) {
                particle.decay = 0.05;
            }
        }, 50);
    }
    
    handleMouseMove(event) {
        if (this.gameState.isPaused) return;
        
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
        
        // Calculate trajectory
        this.trajectorySystem.calculateTrajectory(
            this.gameState.currentBubble,
            this.gameState.mousePosition,
            this.gameState
        );
    }
    
    handleMouseDown(event) {
        if (this.gameState.isGameOver || this.gameState.isPaused || 
            !this.gameState.currentBubble || this.gameState.currentBubble.isMoving) return;
        
        this.gameState.isCharging = true;
        this.uiManager.showPowerMeter();
    }
    
    handleMouseUp(event) {
        if (this.gameState.isGameOver || this.gameState.isPaused || 
            !this.gameState.currentBubble || this.gameState.currentBubble.isMoving) return;
        
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
            console.log(`Debug: Cycling to bubble color ${forcedType.toString(16)}`);
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
        
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        if (!this.gameState.isGameOver && !this.gameState.isPaused) {
            // Update precision aim
            if (this.gameState.updatePrecisionAim(deltaTime)) {
                this.precisionTickTimer += deltaTime;
                if (this.precisionTickTimer >= 1.0) {
                    this.gameManager.playSound('precisionTick');
                    this.precisionTickTimer = 0;
                }
                this.uiManager.updatePrecisionAim(this.gameState.precisionAimTime, 10);
            } else if (this.precisionTickTimer > 0) {
                this.precisionTickTimer = 0;
                this.uiManager.hidePrecisionAim();
            }
            
            // Update current bubble
            if (this.gameState.currentBubble) {
                this.gameState.currentBubble.update(deltaTime);
                
                // Check collisions
                if (this.collisionSystem.checkBubbleCollisions()) {
                    // Collision handled
                }
            }
            
            // Update all grid bubbles and count non-power-up bubbles in one pass
            let bubblesRemaining = 0;
            for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
                for (let x = 0; x < CONFIG.GRID_WIDTH; x++) {
                    const bubble = this.gameState.getBubbleAt(x, y);
                    if (bubble) {
                        bubble.update(deltaTime);
                        
                        // Update instanced bubble position if using instanced rendering
                        if (bubble.useInstancedRendering && this.bubbleRenderer) {
                            this.bubbleRenderer.updateBubble(bubble);
                        }
                        
                        if (!bubble.isPowerUp) {
                            bubblesRemaining++;
                        }
                    }
                }
            }
            
            // Update bubble renderer
            if (this.bubbleRenderer) {
                this.bubbleRenderer.update(deltaTime, this.camera);
            }
            
            // Update ambient audio based on game state (throttled to 30fps)
            this.audioUpdateTimer += deltaTime;
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
            this.gameState.updateParticles(deltaTime);
            
            // Update animations
            this.gameState.updateAnimations(deltaTime);
            
            // Update game manager
            this.gameManager.update(deltaTime, this.camera);
            
            // Update power meter
            if (this.gameState.isCharging) {
                this.gameState.shootingPower = Math.min(this.gameState.shootingPower + deltaTime * 2, 1);
                this.uiManager.updatePowerMeter(this.gameState.shootingPower);
                
                if (this.gameState.currentBubble) {
                    const scale = 1 + this.gameState.shootingPower * 0.3;
                    this.gameState.currentBubble.mesh.scale.setScalar(scale);
                    this.gameState.currentBubble.material.emissiveIntensity = 0.1 + this.gameState.shootingPower * 0.4;
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
            this.uiUpdateTimer += deltaTime;
            if (this.uiUpdateTimer >= 0.05) {
                this.uiUpdateTimer = 0;
                this.uiManager.updateScore(this.gameState.score);
                this.uiManager.updateLevel(this.gameState.level);
            }
            
            // Render trajectory
            this.trajectorySystem.renderTrajectory(this.gameState);
        }
        
        // Update game board (starfield, etc.)
        this.gameBoard.update(deltaTime, currentTime, this.gameState.mousePosition);
        
        // Animate lights
        this.sceneManager.animateLights(currentTime * 0.001);
        
        // Render
        this.sceneManager.render();
    }
}

// Initialize and start the game
const game = new BubbleShooterGame();

// Make restart function globally available
window.restartGame = function() {
    location.reload(); // Simple reload for now
};