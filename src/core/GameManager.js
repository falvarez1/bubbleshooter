import { EventBus } from './EventBus.js';
import { SoundManager } from '../systems/SoundManager.js';
import { PowerUpSystem } from '../powerups/PowerUpSystem.js';
import { VisualTextDisplay } from '../ui/VisualTextDisplay.js';

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
        
        // Initialize sound manager
        this.soundManager.init();
    }
    
    /**
     * Initialize with dependencies
     * @param {THREE.Camera} camera - Three.js camera for visual text display
     * @param {THREE.Scene} scene - Three.js scene for power-up effects
     */
    initialize(camera, scene) {
        // Store scene reference for power-ups
        this.scene = scene;
        
        // Initialize visual text display
        this.visualTextDisplay = new VisualTextDisplay(camera);
        
        // Initialize power-up system
        this.powerUpSystem = new PowerUpSystem(this.eventBus, this.soundManager);
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Rainbow activation handler
        this.eventBus.on('rainbowActivated', (data) => {
            console.log('Rainbow power-up activated at', data.position);
            this.visualTextDisplay.showPowerUpText('rainbow', data.position);
            this.soundManager.play('rainbowActivate');
        });
        
        // Bomb explosion handler
        this.eventBus.on('bombExploded', (data) => {
            console.log('Bomb exploded at', data.position, 'with radius', data.radius);
            this.visualTextDisplay.showPowerUpText('bomb', data.position);
            this.soundManager.play('bombExplode');
        });
        
        // Score update handler
        this.eventBus.on('scoreUpdated', (data) => {
            console.log('Score updated:', data.score);
        });
        
        // Combo handler
        this.eventBus.on('comboAchieved', (data) => {
            console.log('Combo achieved:', data.comboSize);
            this.soundManager.playCombo(data.comboSize);
            if (data.comboSize >= 3) {
                this.visualTextDisplay.showEffectText('combo', data.comboSize);
            }
        });
        
        // Chain Lightning activation handler
        this.eventBus.on('chainLightningActivated', (data) => {
            console.log('Chain Lightning power-up activated at', data.position);
            this.visualTextDisplay.showPowerUpText('chainLightning', data.position);
            this.soundManager.play('lightningStrike');
        });
        
        // Precision aim activation handler
        this.eventBus.on('precisionAimActivated', (data) => {
            console.log('Precision aim activated for', data.duration, 'seconds');
            this.visualTextDisplay.showPowerUpText('precision');
            this.soundManager.play('precisionActivate');
            this.activatePrecisionAim(data.duration);
        });
        
        // Color Splash activation handler
        this.eventBus.on('colorSplashActivated', (data) => {
            console.log('Color Splash power-up activated at', data.position);
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
        
        // Level complete
        this.eventBus.on('levelComplete', () => {
            this.visualTextDisplay.showEffectText('victory');
            this.soundManager.play('levelComplete');
        });
        
        // Game over
        this.eventBus.on('gameOver', () => {
            this.soundManager.play('gameOver');
        });
        
        // Game start
        this.eventBus.on('gameStart', () => {
            this.soundManager.play('gameStart');
        });
    }
    
    activatePrecisionAim(duration) {
        // This will be handled by the game state
        this.eventBus.emit('startPrecisionAim', { duration });
    }
    
    addScreenShake(duration, intensity) {
        this.screenShake.duration = Math.max(this.screenShake.duration, duration);
        this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
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
            }
        }
    }
    
    update(deltaTime, camera) {
        this.powerUpSystem.update(deltaTime);
        this.updateScreenShake(deltaTime, camera);
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
}