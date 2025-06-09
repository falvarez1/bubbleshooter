import * as THREE from 'three';

/**
 * Visual Text Display System
 * Shows animated text effects for power-ups, combos, and other game events
 */
export class VisualTextDisplay {
    constructor(camera) {
        this.camera = camera;
        this.activeDisplays = [];
    }
    
    showPowerUpText(powerUpType, position) {
        const textElement = document.createElement('div');
        textElement.className = 'powerup-text-display';
        
        let text = '';
        let className = '';
        
        switch(powerUpType) {
            case 'rainbow':
                text = 'RAINBOW POWER!';
                className = 'powerup-text-rainbow';
                break;
            case 'bomb':
                text = 'BOMB BLAST!';
                className = 'powerup-text-bomb';
                break;
            case 'chainLightning':
                text = 'CHAIN LIGHTNING!';
                className = 'powerup-text-lightning';
                break;
            case 'precision':
                text = 'PRECISION AIM!';
                className = 'powerup-text-precision';
                break;
            case 'colorSplash':
                text = 'COLOR SPLASH!';
                className = 'powerup-text-colorsplash';
                break;
            default:
                text = 'POWER-UP!';
                className = '';
        }
        
        textElement.textContent = text;
        textElement.classList.add(className);
        
        // Position the text based on the bubble position if provided
        if (position) {
            const screenPos = this.worldToScreen(position);
            textElement.style.left = `${screenPos.x}px`;
            textElement.style.top = `${screenPos.y}px`;
            textElement.style.transform = 'translate(-50%, -50%)';
        }
        
        document.body.appendChild(textElement);
        
        // Remove after animation completes
        setTimeout(() => {
            textElement.remove();
        }, 2000);
    }
    
    showEffectText(effectType, value) {
        const textElement = document.createElement('div');
        textElement.className = 'effect-text-display';
        
        let text = '';
        let className = '';
        
        switch(effectType) {
            case 'combo':
                text = `COMBO x${value}!`;
                className = 'effect-text-combo';
                break;
            case 'megaClear':
                text = 'MEGA CLEAR!';
                className = 'effect-text-megaclear';
                break;
            case 'victory':
                text = 'LEVEL CLEAR!';
                className = 'effect-text-victory';
                break;
            case 'floatingClear':
                text = `${value} FLOATING CLEARED!`;
                className = 'effect-text-megaclear';
                break;
            default:
                text = effectType;
                className = '';
        }
        
        textElement.textContent = text;
        textElement.classList.add(className);
        
        document.body.appendChild(textElement);
        
        // Remove after animation completes
        setTimeout(() => {
            textElement.remove();
        }, 1500);
    }
    
    showFloatingScore(position, points) {
        const scoreElement = document.createElement('div');
        scoreElement.className = 'floating-score';
        scoreElement.textContent = '+' + points;
        
        // Convert 3D position to screen coordinates
        const screenPos = this.worldToScreen(position);
        
        scoreElement.style.left = screenPos.x + 'px';
        scoreElement.style.top = screenPos.y + 'px';
        
        document.body.appendChild(scoreElement);
        
        // Remove after animation
        setTimeout(() => {
            scoreElement.remove();
        }, 1500);
    }
    
    worldToScreen(position) {
        const vector = position.clone();
        vector.project(this.camera);
        
        const x = (vector.x + 1) / 2 * window.innerWidth;
        const y = -(vector.y - 1) / 2 * window.innerHeight;
        
        return { x, y };
    }
}

/**
 * UI Manager
 * Manages all UI updates and interactions
 */
export class UIManager {
    constructor() {
        this.elements = {
            scoreValue: document.getElementById('scoreValue'),
            levelValue: document.getElementById('levelValue'),
            comboDisplay: document.getElementById('comboDisplay'),
            comboValue: document.getElementById('comboValue'),
            gameOver: document.getElementById('gameOver'),
            finalScore: document.getElementById('finalScore'),
            finalLevel: document.getElementById('finalLevel'),
            bestCombo: document.getElementById('bestCombo'),
            powerMeter: document.getElementById('powerMeter'),
            powerFill: document.getElementById('powerFill'),
            nextBubble: document.getElementById('nextBubble'),
            powerupIndicator: document.getElementById('powerupIndicator'),
            powerupLabel: document.getElementById('powerupLabel'),
            precisionIndicator: document.getElementById('precisionIndicator'),
            precisionTime: document.getElementById('precisionTime'),
            precisionTimerCircle: document.getElementById('precisionTimerCircle'),
            settingsPanel: document.getElementById('settingsPanel'),
            gameOverlay: document.getElementById('gameOverlay'),
            musicToggle: document.getElementById('musicToggle'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            powerupCollectionBar: document.getElementById('powerupCollectionBar'),
            powerupSlots: document.querySelectorAll('.powerup-collection-slot')
        };
    }
    
    updateScore(score) {
        if (this.elements.scoreValue) {
            this.elements.scoreValue.textContent = score;
        }
    }
    
    updateLevel(level) {
        if (this.elements.levelValue) {
            this.elements.levelValue.textContent = level;
        }
    }
    
    showCombo(comboValue) {
        if (this.elements.comboDisplay && this.elements.comboValue) {
            this.elements.comboDisplay.classList.add('active');
            this.elements.comboValue.textContent = comboValue;
            
            // Clear any existing timeout
            if (this.comboTimeout) {
                clearTimeout(this.comboTimeout);
            }
            
            // Auto-hide after 2 seconds
            this.comboTimeout = setTimeout(() => {
                this.hideCombo();
            }, 2000);
        }
    }
    
    hideCombo() {
        if (this.elements.comboDisplay) {
            this.elements.comboDisplay.classList.remove('active');
        }
        
        // Clear timeout if it exists
        if (this.comboTimeout) {
            clearTimeout(this.comboTimeout);
            this.comboTimeout = null;
        }
    }
    
    showGameOver(score, level, bestCombo) {
        if (this.elements.gameOver) {
            this.elements.finalScore.textContent = score;
            this.elements.finalLevel.textContent = level;
            this.elements.bestCombo.textContent = bestCombo + 1;
            this.elements.gameOver.style.display = 'block';
        }
    }
    
    hideGameOver() {
        if (this.elements.gameOver) {
            this.elements.gameOver.style.display = 'none';
        }
    }
    
    showPowerMeter() {
        if (this.elements.powerMeter) {
            this.elements.powerMeter.classList.add('active');
        }
    }
    
    hidePowerMeter() {
        if (this.elements.powerMeter) {
            this.elements.powerMeter.classList.remove('active');
            this.elements.powerFill.style.width = '0%';
        }
    }
    
    updatePowerMeter(power) {
        if (this.elements.powerFill) {
            this.elements.powerFill.style.width = (power * 100) + '%';
        }
    }
    
    updateNextBubble(color) {
        if (this.elements.nextBubble) {
            const hexColor = `#${color.toString(16).padStart(6, '0')}`;
            this.elements.nextBubble.style.background = `radial-gradient(circle at 30% 30%, ${hexColor}88, ${hexColor}44)`;
            this.elements.nextBubble.style.borderColor = hexColor + '88';
            
            // Add bounce animation
            this.elements.nextBubble.style.animation = 'none';
            setTimeout(() => {
                this.elements.nextBubble.style.animation = 'bubbleBounce 0.5s ease-out';
            }, 10);
        }
    }
    
    showPowerUpIndicator(powerUp) {
        if (this.elements.powerupIndicator && this.elements.powerupLabel) {
            this.elements.powerupIndicator.style.display = 'block';
            this.elements.powerupLabel.textContent = powerUp.name;
            this.elements.powerupLabel.style.color = `#${powerUp.glowColor.toString(16).padStart(6, '0')}`;
            this.elements.powerupIndicator.style.borderColor = `#${powerUp.glowColor.toString(16).padStart(6, '0')}`;
        }
    }
    
    hidePowerUpIndicator() {
        if (this.elements.powerupIndicator) {
            this.elements.powerupIndicator.style.display = 'none';
        }
    }
    
    showPrecisionAim(duration) {
        if (this.elements.precisionIndicator) {
            this.elements.precisionIndicator.style.display = 'flex';
            this.elements.precisionTime.textContent = Math.ceil(duration);
            this.elements.precisionTimerCircle.style.strokeDashoffset = '0';
        }
    }
    
    updatePrecisionAim(timeLeft, totalDuration) {
        if (this.elements.precisionTime && this.elements.precisionTimerCircle) {
            this.elements.precisionTime.textContent = Math.ceil(timeLeft);
            const offset = 157 - (157 * (timeLeft / totalDuration));
            this.elements.precisionTimerCircle.style.strokeDashoffset = offset;
        }
    }
    
    hidePrecisionAim() {
        if (this.elements.precisionIndicator) {
            this.elements.precisionIndicator.style.display = 'none';
        }
    }
    
    showSettings() {
        if (this.elements.settingsPanel && this.elements.gameOverlay) {
            this.elements.settingsPanel.classList.add('active');
            this.elements.gameOverlay.classList.add('active');
        }
    }
    
    hideSettings() {
        if (this.elements.settingsPanel && this.elements.gameOverlay) {
            this.elements.settingsPanel.classList.remove('active');
            this.elements.gameOverlay.classList.remove('active');
        }
    }
    
    updateMusicToggle(enabled) {
        if (this.elements.musicToggle) {
            this.elements.musicToggle.classList.toggle('active', enabled);
        }
    }
    
    updateVolume(volume) {
        if (this.elements.volumeSlider && this.elements.volumeValue) {
            const percentage = Math.round(volume * 100);
            this.elements.volumeSlider.value = percentage;
            this.elements.volumeValue.textContent = `${percentage}%`;
        }
    }
    
    updateCollectedPowerUps(collectedPowerUps) {
        if (!this.elements.powerupSlots) return;
        
        // Update each slot
        this.elements.powerupSlots.forEach((slot, index) => {
            const content = slot.querySelector('.powerup-slot-content');
            const powerUp = collectedPowerUps[index];
            
            if (powerUp) {
                // Show power-up
                slot.classList.add('active');
                const iconHtml = `
                    <div class="powerup-slot-icon" style="
                        --powerup-color-light: #${powerUp.info.color.toString(16).padStart(6, '0')}88;
                        --powerup-color-dark: #${powerUp.info.color.toString(16).padStart(6, '0')}44;
                        --powerup-glow-color: #${powerUp.info.glowColor.toString(16).padStart(6, '0')};
                    "></div>
                    <span class="powerup-slot-index">${index + 1}</span>
                `;
                content.innerHTML = iconHtml;
            } else {
                // Show empty slot
                slot.classList.remove('active');
                const emptyHtml = `
                    <div class="powerup-slot-empty">+</div>
                    <span class="powerup-slot-index">${index + 1}</span>
                `;
                content.innerHTML = emptyHtml;
            }
        });
    }
    
    flashCollectionSlot(slotIndex) {
        if (this.elements.powerupSlots && this.elements.powerupSlots[slotIndex]) {
            const slot = this.elements.powerupSlots[slotIndex];
            slot.style.animation = 'none';
            setTimeout(() => {
                slot.style.animation = 'bubbleBounce 0.5s ease-out';
            }, 10);
        }
    }
    
    showPowerUpCollected(slotIndex) {
        this.flashCollectionSlot(slotIndex);
    }
}