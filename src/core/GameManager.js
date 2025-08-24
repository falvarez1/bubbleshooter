import { EventBus } from './EventBus.js';
import { SoundManager } from '../systems/SoundManager.js';
import { PowerUpSystem } from '../powerups/PowerUpSystem.js';
import { VisualTextDisplay } from '../ui/VisualTextDisplay.js';
import { SimpleShockwaveEffect } from '../graphics/SimpleShockwave.js';
import { SympathyPopEffect } from '../effects/SympathyPopEffect.js';
import { CascadeAmplificationSystem } from '../effects/CascadeAmplificationSystem.js';

/**
 * Game Manager
 * Central coordination system for all game components
 */
export class GameManager {
    constructor() {
        this.eventBus = new EventBus();
        this.soundManager = new SoundManager();
        this.powerUpSystem = null; // Initialized after sound manager
        this.visualTextDisplay = null; // Initialized with camera
        this.screenShake = { intensity: 0, duration: 0 };
        this.shockwaveEffect = null; // Initialized with scene
        this.sympathyPopEffect = null; // Initialized with scene
        this.cascadeSystem = null; // Initialized with scene
        
        // Initialize sound manager
        this.soundManager.init();
    }
    
    /**
     * Initialize with dependencies
     * @param {THREE.Camera} camera - Three.js camera for visual text display
     * @param {THREE.Scene} scene - Three.js scene for power-up effects
     * @param {BubbleEffectsSystem} effectsSystem - Independent effects system
     * @param {THREE.WebGLRenderer} renderer - Three.js renderer for blast wave effects
     * @param {BubbleInstances} bubbleInstances - Instanced bubble renderer (optional)
     */
    initialize(camera, scene, effectsSystem, renderer, bubbleInstances = null) {
        // Store references for power-ups and effects
        this.scene = scene;
        this.effectsSystem = effectsSystem;
        this.camera = camera;
        this.renderer = renderer;
        this.bubbleInstances = bubbleInstances;
        this.gameState = null; // Will be set via setGameState
        
        // Initialize visual text display with eventBus for notification management
        this.visualTextDisplay = new VisualTextDisplay(camera, this.eventBus);
        
        // Initialize power-up system
        this.powerUpSystem = new PowerUpSystem(this.eventBus, this.soundManager);
        
        // Initialize enhanced shockwave effect
        this.shockwaveEffect = new SimpleShockwaveEffect(scene, renderer, camera);
        
        // Initialize sympathy pop effect
        this.sympathyPopEffect = new SympathyPopEffect(this, scene);
        
        // Initialize cascade amplification system (needs particlePool from gameState)
        // Will be initialized after gameState is set
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    /**
     * Set game state reference
     * @param {GameState} gameState - The game state instance
     */
    setGameState(gameState) {
        this.gameState = gameState;
        
        // Initialize cascade amplification system now that we have gameState
        if (this.scene && this.camera && this.renderer && gameState.particlePool) {
            this.cascadeSystem = new CascadeAmplificationSystem(
                this.scene, 
                this.camera, 
                this.renderer, 
                gameState.particlePool,
                this.soundManager
            );
        }
    }
    
    setupEventListeners() {
        // Rainbow activation handler
        this.eventBus.on('rainbowActivated', (data) => {
            // Rainbow power-up activated
            this.visualTextDisplay.showPowerUpText('rainbow', data.position);
            this.soundManager.play('rainbowActivate');
        });
        
        // Bomb explosion handler
        this.eventBus.on('bombExploded', (data) => {
            // Bomb exploded
            this.visualTextDisplay.showPowerUpText('bomb', data.position);
            this.soundManager.play('bombExplode');
            
            // Trigger enhanced shockwave effect
            if (this.shockwaveEffect) {
                this.shockwaveEffect.trigger(data.position, {
                    duration: 1.0,   // 2 second expansion for more dramatic effect
                    maxRadius: 12.0  // Very large blast radius
                });
            }
        });
        
        // Score update handler
        this.eventBus.on('scoreUpdated', (data) => {
            // Score updated
        });
        
        // Combo handler
        this.eventBus.on('comboAchieved', (data) => {
            // Combo achieved
            this.soundManager.playCombo(data.comboSize);
            if (data.comboSize >= 3) {
                this.visualTextDisplay.showEffectText('combo', data.comboSize);
            }
        });
        
        // Chain Lightning activation handler
        this.eventBus.on('chainLightningActivated', (data) => {
            // Chain Lightning power-up activated
            this.visualTextDisplay.showPowerUpText('chainLightning', data.position);
            this.soundManager.play('lightningStrike');
        });
        
        // Precision aim activation handler
        this.eventBus.on('precisionAimActivated', (data) => {
            // Precision aim activated
            this.visualTextDisplay.showPowerUpText('precision');
            this.soundManager.play('precisionActivate');
            this.activatePrecisionAim(data.duration);
        });
        
        // Color Splash activation handler
        this.eventBus.on('colorSplashActivated', (data) => {
            // Color Splash power-up activated
            this.visualTextDisplay.showPowerUpText('colorSplash', data.position);
            this.soundManager.play('colorSplash');
        });
        
        // Floating bubbles cleared
        this.eventBus.on('floatingCleared', (data) => {
            if (data.count >= 5) {
                this.visualTextDisplay.showEffectText('floatingClear', data.count);
                this.soundManager.play('crunchy_pop', { volume: 0.7 });
            }
        });
        
        // Combo end handler - reset cascade effects
        this.eventBus.on('comboEnd', () => {
            if (this.cascadeSystem) {
                this.cascadeSystem.resetCombo();
            }
        });
        
        // Level complete
        this.eventBus.on('levelComplete', () => {
            this.visualTextDisplay.showEffectText('victory');
            // Play with celebratory pitch variation
            this.soundManager.play('levelComplete', {
                volume: 1.0,
                rate: 0.95 + Math.random() * 0.1 // Slight pitch variation for variety
            });
        });
        
        // Game over
        this.eventBus.on('gameOver', () => {
            this.soundManager.play('gameOver');
        });
        
        // Game start
        this.eventBus.on('gameStart', () => {
            this.soundManager.play('gameStart');
        });
        
        // Handle generic notification requests
        this.eventBus.on('showNotification', (options) => {
            if (this.visualTextDisplay && this.visualTextDisplay.notificationManager) {
                this.visualTextDisplay.notificationManager.show(options);
            }
        });
        
        // Magnetic snap effect handler
        this.eventBus.on('magneticSnap', (data) => {
            // Play snap sound with intensity-based variation
            const intensity = Math.min(1.0, 0.3 + data.intensity * 0.1);
            this.soundManager.playWithVariation('bubbleAttach', {
                volume: intensity,
                rate: 0.9 + data.intensity * 0.05
            });
            
            // Add subtle screen shake for strong attractions
            if (data.intensity >= 5) {
                this.addScreenShake(0.2, data.intensity * 0.5);
            }
        });
        
        // Thread the Needle effect handler
        this.eventBus.on('threadTheNeedle', (data) => {
            // Apply score multiplier
            const baseScore = 50; // Base score for threading the needle
            const totalScore = Math.round(baseScore * data.multiplier);
            
            // Add score with position
            if (this.gameState) {
                this.gameState.addScore(totalScore);
                this.showFloatingScore(data.gapInfo.gapCenter, totalScore);
            }
            
            // Achievement for consecutive threads
            if (data.consecutive >= 3) {
                this.visualTextDisplay.showEffectText('combo', data.consecutive);
            }
            
            // Wall bounce achievement
            if (data.wallBounces > 0) {
                this.eventBus.emit('achievementProgress', {
                    id: 'trickshot',
                    progress: data.wallBounces
                });
            }
        });
        
        // Wall bounce event for tracking
        this.eventBus.on('wallBounce', (data) => {
            // Track wall bounces for Thread the Needle
            if (data.bubble) {
                // Play subtle bounce sound
                this.soundManager.play('bubbleBounce', {
                    volume: 0.4,
                    rate: 1.1
                });
            }
        });
    }
    
    activatePrecisionAim(duration) {
        // This will be handled by the game state
        this.eventBus.emit('startPrecisionAim', { duration });
    }
    
    addScreenShake(duration, intensity) {
        // Check if we're starting a new shake or extending existing one
        const wasShaking = this.screenShake.duration > 0;
        
        this.screenShake.duration = Math.max(this.screenShake.duration, duration);
        this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
        
        // Start playing the screen shake sound if not already shaking
        if (!wasShaking && this.soundManager) {
            // Store the audio instance so we can stop it later
            this.screenShakeAudio = this.soundManager.play('screenShake', {
                volume: Math.min(1.0, 0.5 + intensity * 0.03) // Scale volume with intensity
            });
        }
    }
    
    updateScreenShake(deltaTime, camera) {
        if (this.screenShake.duration > 0) {
            this.screenShake.duration -= deltaTime;
            
            const shakeX = (Math.random() - 0.5) * this.screenShake.intensity * 0.1;
            const shakeY = (Math.random() - 0.5) * this.screenShake.intensity * 0.1;
            
            camera.position.x = shakeX;
            camera.position.y = shakeY;
            
            if (this.screenShake.duration <= 0) {
                camera.position.x = 0;
                camera.position.y = 0;
                this.screenShake.intensity = 0;
                
                // Stop the screen shake sound when shaking ends
                if (this.screenShakeAudio) {
                    this.screenShakeAudio.pause();
                    this.screenShakeAudio.currentTime = 0;
                    this.screenShakeAudio = null;
                }
            }
        }
    }
    
    update(deltaTime, camera) {
        this.powerUpSystem.update(deltaTime);
        this.updateScreenShake(deltaTime, camera);
        
        // Update enhanced shockwave effect
        if (this.shockwaveEffect) {
            this.shockwaveEffect.update(deltaTime);
        }
        
        // Update sympathy pop effect
        if (this.sympathyPopEffect) {
            this.sympathyPopEffect.update(deltaTime);
        }
    }
    
    render() {
        // Simple shockwave doesn't need special rendering - it's just a mesh in the scene
        return false;
    }
    
    // Helper methods for game logic to use
    
    playSound(soundName, options) {
        return this.soundManager.play(soundName, options);
    }
    
    playSoundWithVariation(soundName, options) {
        return this.soundManager.playWithVariation(soundName, options);
    }
    
    showFloatingScore(position, points) {
        this.visualTextDisplay.showFloatingScore(position, points);
    }
    
    showEffectText(effectType, value) {
        this.visualTextDisplay.showEffectText(effectType, value);
    }
    
    registerPowerUp(powerUp) {
        this.powerUpSystem.registerPowerUp(powerUp);
    }
    
    applyPowerUpToBubble(bubble) {
        return this.powerUpSystem.applyPowerUpToBubble(bubble);
    }
    
    activatePowerUp(bubble, gameState) {
        return this.powerUpSystem.activatePowerUp(bubble, gameState, this);
    }
    
    /**
     * Update all game manager systems
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Update cascade amplification system
        if (this.cascadeSystem) {
            this.cascadeSystem.update(deltaTime);
        }
        
    }
}