import * as THREE from 'three';
import { CONFIG } from '../core/Config.js';

/**
 * Danger Zone System
 * Manages warning zones and time slow effects when bubbles get too low
 */
export class DangerZoneSystem {
    constructor(gameState, scene, eventBus) {
        this.gameState = gameState;
        this.scene = scene;
        this.eventBus = eventBus;
        
        // Initialize danger zone state in gameState
        this.gameState.dangerZone = {
            active: false,
            level: 0,  // 0: safe, 1: yellow warning, 2: red danger
            timeSlowFactor: 1.0,  // 1.0 normal, 0.7 for slow effect
            warningAnimationTime: 0
        };
        
        // Visual elements
        this.warningMesh = null;
        this.dangerMesh = null;
        this.dangerLineIndicator = null;
        this.warningLineIndicator = null;
        
        // Screen effects
        this.screenShakeIntensity = 0;
        this.originalCameraPosition = null;
        
        // Create visual indicators
        this.createDangerZoneVisuals();
        this.createUI();
        
        // Subscribe to events
        this.subscribeToEvents();
    }
    
    createDangerZoneVisuals() {
        // Create warning zone indicator (yellow line at 3 rows from bottom)
        const warningY = CONFIG.SHOOTER_Y + CONFIG.HEX_HEIGHT * 3;
        const warningGeometry = new THREE.PlaneGeometry(
            CONFIG.GRID_WIDTH * CONFIG.HEX_WIDTH * 1.5,
            0.1
        );
        const warningMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFCC00,
            transparent: true,
            opacity: 0,
            emissive: 0xFFCC00,
            emissiveIntensity: 0.5
        });
        this.warningLineIndicator = new THREE.Mesh(warningGeometry, warningMaterial);
        this.warningLineIndicator.position.y = warningY;
        this.warningLineIndicator.position.z = -0.5;
        this.scene.add(this.warningLineIndicator);
        
        // Create danger zone indicator (red line at 2 rows from bottom)
        const dangerY = CONFIG.SHOOTER_Y + CONFIG.HEX_HEIGHT * 2;
        const dangerGeometry = new THREE.PlaneGeometry(
            CONFIG.GRID_WIDTH * CONFIG.HEX_WIDTH * 1.5,
            0.15
        );
        const dangerMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF3333,
            transparent: true,
            opacity: 0,
            emissive: 0xFF3333,
            emissiveIntensity: 0.8
        });
        this.dangerLineIndicator = new THREE.Mesh(dangerGeometry, dangerMaterial);
        this.dangerLineIndicator.position.y = dangerY;
        this.dangerLineIndicator.position.z = -0.5;
        this.scene.add(this.dangerLineIndicator);
        
        // Create warning zone overlay (yellow glow)
        const warningOverlayGeometry = new THREE.PlaneGeometry(
            CONFIG.GRID_WIDTH * CONFIG.HEX_WIDTH * 1.5,
            CONFIG.HEX_HEIGHT * 2
        );
        const warningOverlayMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFCC00,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        this.warningMesh = new THREE.Mesh(warningOverlayGeometry, warningOverlayMaterial);
        this.warningMesh.position.y = CONFIG.SHOOTER_Y + CONFIG.HEX_HEIGHT * 2;
        this.warningMesh.position.z = -0.2;
        this.scene.add(this.warningMesh);
        
        // Create danger zone overlay (red glow)
        const dangerOverlayMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF3333,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        this.dangerMesh = new THREE.Mesh(warningOverlayGeometry, dangerOverlayMaterial);
        this.dangerMesh.position.y = CONFIG.SHOOTER_Y + CONFIG.HEX_HEIGHT;
        this.dangerMesh.position.z = -0.2;
        this.scene.add(this.dangerMesh);
    }
    
    createUI() {
        // Create danger indicator UI
        const dangerUI = document.createElement('div');
        dangerUI.className = 'danger-zone-ui';
        dangerUI.innerHTML = `
            <div class="danger-indicator hidden" id="dangerIndicator">
                <div class="danger-warning hidden" id="warningZone">
                    <span class="warning-icon">⚠️</span>
                    <span class="warning-text">WARNING</span>
                </div>
                <div class="danger-critical hidden" id="dangerZone">
                    <span class="danger-icon">🚨</span>
                    <span class="danger-text">DANGER</span>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .danger-zone-ui {
                position: fixed;
                top: 80px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999;
                pointer-events: none;
            }
            
            .danger-indicator {
                text-align: center;
                font-family: 'Orbitron', monospace;
            }
            
            .danger-warning, .danger-critical {
                padding: 10px 30px;
                border-radius: 5px;
                margin: 10px 0;
                font-weight: bold;
                letter-spacing: 3px;
                animation: pulse 1s infinite;
            }
            
            .danger-warning {
                background: linear-gradient(135deg, rgba(255,204,0,0.9), rgba(255,153,0,0.9));
                border: 2px solid #FFCC00;
                color: #000;
                box-shadow: 0 0 30px rgba(255,204,0,0.6);
            }
            
            .danger-critical {
                background: linear-gradient(135deg, rgba(255,51,51,0.9), rgba(204,0,0,0.9));
                border: 2px solid #FF3333;
                color: #FFF;
                box-shadow: 0 0 40px rgba(255,51,51,0.8);
                animation: pulse-fast 0.5s infinite;
            }
            
            .warning-icon, .danger-icon {
                font-size: 24px;
                margin-right: 10px;
                vertical-align: middle;
            }
            
            .warning-text, .danger-text {
                font-size: 18px;
                vertical-align: middle;
            }
            
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
            
            @keyframes pulse-fast {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            
            .hidden {
                display: none !important;
            }
            
            /* Screen vignette effect for danger */
            .danger-vignette {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 998;
                background: radial-gradient(ellipse at center, transparent 40%, rgba(255,0,0,0.2) 100%);
                opacity: 0;
                transition: opacity 0.3s;
            }
            
            .danger-vignette.active {
                opacity: 1;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(dangerUI);
        
        // Create vignette effect
        const vignette = document.createElement('div');
        vignette.className = 'danger-vignette';
        vignette.id = 'dangerVignette';
        document.body.appendChild(vignette);
        
        // Store references
        this.dangerIndicator = document.getElementById('dangerIndicator');
        this.warningZone = document.getElementById('warningZone');
        this.dangerZoneUI = document.getElementById('dangerZone');
        this.vignette = document.getElementById('dangerVignette');
    }
    
    subscribeToEvents() {
        // Check danger zone after row push
        this.eventBus.on('rowPushComplete', () => this.checkDangerLevel());
        this.eventBus.on('checkDangerZone', () => this.checkDangerLevel());
        
        // Check after bubbles are destroyed
        this.eventBus.on('bubblesDestroyed', () => {
            setTimeout(() => this.checkDangerLevel(), 100);
        });
    }
    
    checkDangerLevel() {
        // Find lowest bubble position
        let lowestY = CONFIG.GRID_TOP_Y;
        let hasAnyBubbles = false;
        const bubbles = this.gameState.getAllBubbles();
        
        bubbles.forEach(bubble => {
            if (bubble && bubble.mesh) {
                hasAnyBubbles = true;
                if (bubble.mesh.position.y < lowestY) {
                    lowestY = bubble.mesh.position.y;
                }
            }
        });
        
        // If no bubbles, we're safe
        if (!hasAnyBubbles) {
            this.setDangerLevel(0);
            return;
        }
        
        // Calculate distance from shooter
        const distanceFromShooter = lowestY - CONFIG.SHOOTER_Y;
        const previousLevel = this.gameState.dangerZone.level;
        
        // Determine danger level based on distance
        if (distanceFromShooter <= CONFIG.HEX_HEIGHT * 2) {
            // RED DANGER - 2 rows or less from shooter
            this.setDangerLevel(2);
        } else if (distanceFromShooter <= CONFIG.HEX_HEIGHT * 3) {
            // YELLOW WARNING - 3 rows from shooter
            this.setDangerLevel(1);
        } else {
            // SAFE
            this.setDangerLevel(0);
        }
        
        // Emit event if danger level changed
        if (previousLevel !== this.gameState.dangerZone.level) {
            this.eventBus.emit('dangerLevelChanged', {
                level: this.gameState.dangerZone.level,
                timeSlowFactor: this.gameState.dangerZone.timeSlowFactor,
                lowestY: lowestY
            });
            
            console.log(`Danger level changed: ${previousLevel} -> ${this.gameState.dangerZone.level}`);
        }
    }
    
    setDangerLevel(level) {
        this.gameState.dangerZone.level = level;
        
        switch (level) {
            case 0:
                // SAFE
                this.gameState.dangerZone.timeSlowFactor = 1.0;
                this.gameState.dangerZone.active = false;
                this.deactivateEffects();
                break;
                
            case 1:
                // WARNING
                this.gameState.dangerZone.timeSlowFactor = 0.85;
                this.gameState.dangerZone.active = true;
                this.activateWarningEffects();
                break;
                
            case 2:
                // DANGER
                this.gameState.dangerZone.timeSlowFactor = 0.7;
                this.gameState.dangerZone.active = true;
                this.activateDangerEffects();
                break;
        }
    }
    
    activateWarningEffects() {
        // Show UI
        this.dangerIndicator.classList.remove('hidden');
        this.warningZone.classList.remove('hidden');
        this.dangerZoneUI.classList.add('hidden');
        
        // Remove vignette
        this.vignette.classList.remove('active');
        
        // Set line opacity
        this.warningLineIndicator.material.opacity = 0.5;
        this.dangerLineIndicator.material.opacity = 0;
        
        // Play warning sound if available
        this.eventBus.emit('playSound', { type: 'warning' });
    }
    
    activateDangerEffects() {
        // Show UI
        this.dangerIndicator.classList.remove('hidden');
        this.warningZone.classList.add('hidden');
        this.dangerZoneUI.classList.remove('hidden');
        
        // Add vignette effect
        this.vignette.classList.add('active');
        
        // Set line opacity
        this.warningLineIndicator.material.opacity = 0;
        this.dangerLineIndicator.material.opacity = 0.7;
        
        // Enable screen shake
        this.screenShakeIntensity = 0.002;
        
        // Play danger sound if available
        this.eventBus.emit('playSound', { type: 'danger' });
    }
    
    deactivateEffects() {
        // Hide UI
        this.dangerIndicator.classList.add('hidden');
        this.warningZone.classList.add('hidden');
        this.dangerZoneUI.classList.add('hidden');
        
        // Remove vignette
        this.vignette.classList.remove('active');
        
        // Hide lines
        this.warningLineIndicator.material.opacity = 0;
        this.dangerLineIndicator.material.opacity = 0;
        
        // Disable screen shake
        this.screenShakeIntensity = 0;
        
        // Reset warning/danger mesh opacity
        this.warningMesh.material.opacity = 0;
        this.dangerMesh.material.opacity = 0;
    }
    
    update(deltaTime, camera) {
        // Skip if game is over
        if (this.gameState.isGameOver) return;
        
        // Animate warning/danger visuals
        if (this.gameState.dangerZone.level > 0) {
            const time = Date.now() * 0.001;
            const pulse = Math.sin(time * 4) * 0.5 + 0.5;
            
            if (this.gameState.dangerZone.level === 1) {
                // Warning animation
                this.warningMesh.material.opacity = pulse * 0.1;
                this.warningLineIndicator.material.opacity = 0.3 + pulse * 0.3;
            } else if (this.gameState.dangerZone.level === 2) {
                // Danger animation
                this.dangerMesh.material.opacity = pulse * 0.15;
                this.dangerLineIndicator.material.opacity = 0.5 + pulse * 0.5;
                
                // Screen shake effect
                if (camera && this.screenShakeIntensity > 0) {
                    if (!this.originalCameraPosition) {
                        this.originalCameraPosition = camera.position.clone();
                    }
                    
                    // Apply small random shake
                    const shakeX = (Math.random() - 0.5) * this.screenShakeIntensity;
                    const shakeY = (Math.random() - 0.5) * this.screenShakeIntensity;
                    
                    camera.position.x = this.originalCameraPosition.x + shakeX;
                    camera.position.y = this.originalCameraPosition.y + shakeY;
                }
            }
        } else {
            // Reset camera position if needed
            if (camera && this.originalCameraPosition) {
                camera.position.copy(this.originalCameraPosition);
                this.originalCameraPosition = null;
            }
        }
    }
    
    addScreenShake(intensity) {
        this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
        
        // Decay shake over time
        setTimeout(() => {
            this.screenShakeIntensity *= 0.9;
            if (this.screenShakeIntensity < 0.001) {
                this.screenShakeIntensity = 0;
            }
        }, 50);
    }
    
    destroy() {
        // Remove visual elements from scene
        if (this.warningLineIndicator) this.scene.remove(this.warningLineIndicator);
        if (this.dangerLineIndicator) this.scene.remove(this.dangerLineIndicator);
        if (this.warningMesh) this.scene.remove(this.warningMesh);
        if (this.dangerMesh) this.scene.remove(this.dangerMesh);
        
        // Remove UI elements
        const dangerUI = document.querySelector('.danger-zone-ui');
        if (dangerUI) dangerUI.remove();
        
        const vignette = document.querySelector('.danger-vignette');
        if (vignette) vignette.remove();
        
        // Unsubscribe from events
        this.eventBus.off('rowPushComplete');
        this.eventBus.off('checkDangerZone');
        this.eventBus.off('bubblesDestroyed');
    }
}