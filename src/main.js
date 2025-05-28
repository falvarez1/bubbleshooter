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
        
        // Initialize
        this.initialize();
    }
    
    async initialize() {
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
        
        // Start game
        this.gameManager.eventBus.emit('gameStart');
        
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
                    
                    this.scene.add(bubble.mesh);
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
        
        this.scene.add(bubble.mesh);
        this.gameState.currentBubble = bubble;
        
        let appliedPowerUpDetails = null;
        if (powerUpToApply) {
            const powerUpInstance = this.gameManager.powerUpSystem.getPowerUp(powerUpToApply);
            if (powerUpInstance) {
                powerUpInstance.createVisualEffect(bubble);
                appliedPowerUpDetails = powerUpInstance;
            }
        } else if (!forcedTypeWasUsed) {
            const randomPowerUp = this.gameManager.applyPowerUpToBubble(bubble);
            if (randomPowerUp) {
                appliedPowerUpDetails = randomPowerUp;
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
        if (!this.DEBUG_MODE) return;
        
        const key = event.key;
        let forcedType = null;
        
        if (key >= '1' && key <= '7') {
            const colorIndex = parseInt(key) - 1;
            if (colorIndex < CONFIG.BUBBLE_COLORS.length) {
                forcedType = CONFIG.BUBBLE_COLORS[colorIndex];
                console.log(`Debug: Forcing bubble color ${forcedType.toString(16)}`);
            }
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
            this.FORCED_NEXT_BUBBLE_TYPE = forcedType;
            if (this.gameState.currentBubble && !this.gameState.currentBubble.isMoving) {
                this.gameState.currentBubble.destroy();
                this.gameState.currentBubble = null;
                this.createShootingBubble();
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
            
            // Update all grid bubbles
            const allBubbles = this.gameState.getAllBubbles();
            allBubbles.forEach(bubble => bubble.update(deltaTime));
            
            // Count bubbles for audio swelling
            const bubblesRemaining = this.gameState.countBubbles(bubble => !bubble.isPowerUp);
            
            // Update ambient audio based on game state
            if (this.audioSystem.isInitialized && !this.gameState.isGameOver) {
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
            
            // Update UI scores
            this.uiManager.updateScore(this.gameState.score);
            this.uiManager.updateLevel(this.gameState.level);
            
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