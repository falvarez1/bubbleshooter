import { CONFIG } from '../core/Config.js';

/**
 * Progressive Timer System
 * Manages the timer that periodically adds new rows of bubbles
 */
export class ProgressiveTimerSystem {
    constructor(gameState, eventBus) {
        this.gameState = gameState;
        this.eventBus = eventBus;
        
        // Timer configuration
        this.config = {
            baseTime: 30000,           // 30 seconds for level 1
            currentTime: 30000,        // Current timer duration
            timeRemaining: 30000,      // Countdown timer
            lastUpdate: Date.now(),   // For delta time calculation
            isPaused: false,           // Pauses during combos
            comboStartTime: 0,         // Track combo duration
            minTime: 8000,             // Minimum time (8 seconds)
            decreasePerLevel: 2000,    // 2 seconds less per level
            warningShown: false,       // Track if warning was shown
            pushAnimationTime: 500,    // Duration of push animation
            speedUpOnMiss: 0.1        // 10% speed up on miss
        };
        
        // Initialize UI elements
        this.initializeUI();
        
        // Subscribe to events
        this.subscribeToEvents();
    }
    
    initializeUI() {
        // Create timer display container
        const timerContainer = document.createElement('div');
        timerContainer.className = 'progressive-timer-container';
        timerContainer.innerHTML = `
            <div class="timer-display">
                <div class="timer-label">Next Row In:</div>
                <div class="timer-bar">
                    <div class="timer-fill" id="progressiveTimerFill"></div>
                    <div class="timer-warning-zone"></div>
                </div>
                <span class="timer-text" id="progressiveTimerText">30.0s</span>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .progressive-timer-container {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1000;
                font-family: 'Orbitron', monospace;
            }
            
            .timer-display {
                background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(20,20,40,0.9));
                border: 2px solid #00ffcc;
                border-radius: 10px;
                padding: 10px 20px;
                box-shadow: 0 0 20px rgba(0,255,204,0.3);
                min-width: 300px;
            }
            
            .timer-label {
                color: #00ffcc;
                text-align: center;
                margin-bottom: 5px;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            
            .timer-bar {
                width: 100%;
                height: 20px;
                background: rgba(0,0,0,0.5);
                border: 1px solid #00ffcc;
                border-radius: 10px;
                overflow: hidden;
                position: relative;
            }
            
            .timer-fill {
                height: 100%;
                background: linear-gradient(90deg, #00ffcc, #00ff88);
                transition: width 0.1s linear;
                box-shadow: 0 0 10px rgba(0,255,204,0.5);
            }
            
            .timer-warning-zone {
                position: absolute;
                right: 0;
                top: 0;
                width: 20%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,200,0,0.2));
                pointer-events: none;
            }
            
            .timer-text {
                display: block;
                text-align: center;
                color: #ffffff;
                margin-top: 5px;
                font-size: 18px;
                font-weight: bold;
                text-shadow: 0 0 10px rgba(0,255,204,0.5);
            }
            
            .timer-display.warning {
                border-color: #ffcc00;
                animation: pulse-warning 1s infinite;
            }
            
            .timer-display.danger {
                border-color: #ff3333;
                animation: pulse-danger 0.5s infinite;
            }
            
            @keyframes pulse-warning {
                0%, 100% { box-shadow: 0 0 20px rgba(255,204,0,0.3); }
                50% { box-shadow: 0 0 30px rgba(255,204,0,0.6); }
            }
            
            @keyframes pulse-danger {
                0%, 100% { box-shadow: 0 0 20px rgba(255,51,51,0.5); }
                50% { box-shadow: 0 0 40px rgba(255,51,51,0.8); }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(timerContainer);
        
        // Store references
        this.timerFill = document.getElementById('progressiveTimerFill');
        this.timerText = document.getElementById('progressiveTimerText');
        this.timerDisplay = timerContainer.querySelector('.timer-display');
    }
    
    subscribeToEvents() {
        // Pause timer during combos
        this.eventBus.on('comboStart', () => this.pauseForCombo());
        this.eventBus.on('comboEnd', () => this.resumeAfterCombo());
        
        // Pause/resume timer for blocking notifications
        this.eventBus.on('pauseTimer', (data) => {
            if (data.reason === 'notification') {
                this.pauseForNotification();
            }
        });
        
        this.eventBus.on('resumeTimer', (data) => {
            if (data.reason === 'notification') {
                this.resumeAfterNotification();
            }
        });
        
        // Reset timer on big clears
        this.eventBus.on('bubblesDestroyed', (data) => {
            if (data.count >= 7) {
                this.resetOnBigClear(data.count);
            }
        });
        
        // Speed up on miss
        this.eventBus.on('bubbleMiss', () => this.speedUpOnMiss());
        
        // Level changes
        this.eventBus.on('levelUp', (data) => {
            this.updateTimerForLevel(data.level);
        });
    }
    
    update(deltaTime) {
        // Skip if paused or game over
        if (this.config.isPaused || this.gameState.isGameOver) return;
        
        // Convert deltaTime from seconds to milliseconds
        const deltaMs = deltaTime * 1000;
        
        // Apply time slow factor if in danger zone
        const timeSlowFactor = this.gameState.dangerZone?.timeSlowFactor || 1.0;
        const adjustedDelta = deltaMs * timeSlowFactor;
        
        // Update timer
        this.config.timeRemaining -= adjustedDelta;
        
        // Check for warning threshold (5 seconds)
        if (this.config.timeRemaining <= 5000 && !this.config.warningShown) {
            this.showWarning();
        }
        
        // Check for timer expiration
        if (this.config.timeRemaining <= 0) {
            this.triggerRowPush();
            this.resetTimer();
        }
        
        this.updateUI();
    }
    
    triggerRowPush() {
        console.log('Triggering row push!');
        
        // Show push warning animation
        this.eventBus.emit('rowPushWarning', {
            duration: 500
        });
        
        // Use the existing addNewRow method from GameLogic
        // This properly handles shifting rows, updating positions, and adding new bubbles
        this.eventBus.emit('addNewRow');
        
        // Emit row push complete event
        this.eventBus.emit('rowPushComplete', {
            timestamp: Date.now()
        });
        
        // Check for danger zone
        this.eventBus.emit('checkDangerZone');
        
        // Check for game over
        this.checkGameOver();
    }
    
    calculateGridPosition(x, y) {
        // Calculate position based on hexagonal grid
        const offsetX = (y % 2 === 0) ? 0 : CONFIG.HEX_WIDTH / 2;
        return {
            x: x * CONFIG.HEX_WIDTH - CONFIG.GRID_WIDTH * CONFIG.HEX_WIDTH / 2 + CONFIG.HEX_WIDTH / 2 + offsetX,
            y: CONFIG.GRID_TOP_Y - y * CONFIG.HEX_HEIGHT
        };
    }
    
    checkGameOver() {
        // Check if any bubbles are too low
        const bubbles = this.gameState.getAllBubbles();
        const dangerLine = CONFIG.SHOOTER_Y + CONFIG.HEX_HEIGHT * 2;
        
        for (const bubble of bubbles) {
            if (bubble && bubble.mesh && bubble.mesh.position.y <= dangerLine) {
                // Check if bubble is in the bottom row
                if (bubble.gridY >= CONFIG.GRID_HEIGHT - 2) {
                    this.eventBus.emit('gameOver', {
                        reason: 'Bubbles reached the bottom!'
                    });
                    return true;
                }
            }
        }
        return false;
    }
    
    pauseForCombo() {
        this.config.isPaused = true;
        this.config.comboStartTime = Date.now();
        console.log('Timer paused for combo');
    }
    
    resumeAfterCombo() {
        this.config.isPaused = false;
        // Optionally add bonus time for combos
        const comboDuration = Date.now() - this.config.comboStartTime;
        if (comboDuration > 0) {
            // Add small bonus time for combo duration
            this.config.timeRemaining += Math.min(comboDuration * 0.5, 2000); // Max 2 seconds bonus
        }
        console.log('Timer resumed after combo');
    }
    
    pauseForNotification() {
        this.config.isPaused = true;
        console.log('Timer paused for blocking notification');
        // Add visual indicator
        if (this.timerDisplay) {
            this.timerDisplay.style.opacity = '0.5';
        }
    }
    
    resumeAfterNotification() {
        this.config.isPaused = false;
        console.log('Timer resumed after notification');
        // Remove visual indicator
        if (this.timerDisplay) {
            this.timerDisplay.style.opacity = '1';
        }
    }
    
    resetOnBigClear(bubbleCount) {
        console.log(`Big clear! Resetting timer (${bubbleCount} bubbles)`);
        this.resetTimer();
        
        // Show visual feedback
        this.showTimerReset();
        
        // Emit event
        this.eventBus.emit('timerReset', {
            bubbleCount: bubbleCount,
            newTime: this.config.currentTime
        });
    }
    
    speedUpOnMiss() {
        // Speed up timer by 10% on miss, but don't go below minimum
        const speedUp = this.config.timeRemaining * this.config.speedUpOnMiss;
        this.config.timeRemaining = Math.max(1000, this.config.timeRemaining - speedUp);
        console.log('Timer sped up due to miss');
    }
    
    resetTimer() {
        this.config.timeRemaining = this.config.currentTime;
        this.config.warningShown = false;
        
        // Remove warning classes
        this.timerDisplay.classList.remove('warning', 'danger');
    }
    
    updateTimerForLevel(level) {
        // Calculate new timer duration based on level
        const newTime = Math.max(
            this.config.minTime,
            this.config.baseTime - (level - 1) * this.config.decreasePerLevel
        );
        
        this.config.currentTime = newTime;
        console.log(`Level ${level}: Timer set to ${newTime / 1000}s`);
        
        // Reset timer with new duration
        this.resetTimer();
    }
    
    showWarning() {
        this.config.warningShown = true;
        this.timerDisplay.classList.add('warning');
        
        // Emit warning event
        this.eventBus.emit('timerWarning', {
            timeRemaining: this.config.timeRemaining
        });
    }
    
    showTimerReset() {
        // Flash effect for timer reset
        this.timerDisplay.style.animation = 'none';
        setTimeout(() => {
            this.timerDisplay.style.animation = 'flash-reset 0.5s';
        }, 10);
        
        // Add flash animation if not exists
        if (!document.getElementById('timer-flash-style')) {
            const style = document.createElement('style');
            style.id = 'timer-flash-style';
            style.textContent = `
                @keyframes flash-reset {
                    0%, 100% { background: linear-gradient(135deg, rgba(0,0,0,0.8), rgba(20,20,40,0.9)); }
                    50% { background: linear-gradient(135deg, rgba(0,255,100,0.3), rgba(0,255,200,0.4)); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    updateUI() {
        // Update timer bar
        const percentage = (this.config.timeRemaining / this.config.currentTime) * 100;
        this.timerFill.style.width = `${Math.max(0, percentage)}%`;
        
        // Update timer text
        const seconds = Math.max(0, this.config.timeRemaining / 1000);
        this.timerText.textContent = `${seconds.toFixed(1)}s`;
        
        // Update warning states
        if (this.config.timeRemaining <= 2000) {
            this.timerDisplay.classList.add('danger');
            this.timerDisplay.classList.remove('warning');
        } else if (this.config.timeRemaining <= 5000) {
            this.timerDisplay.classList.add('warning');
            this.timerDisplay.classList.remove('danger');
        } else {
            this.timerDisplay.classList.remove('warning', 'danger');
        }
    }
    
    destroy() {
        // Clean up UI elements
        const container = document.querySelector('.progressive-timer-container');
        if (container) {
            container.remove();
        }
        
        // Unsubscribe from events
        this.eventBus.off('comboStart');
        this.eventBus.off('comboEnd');
        this.eventBus.off('bubblesDestroyed');
        this.eventBus.off('bubbleMiss');
        this.eventBus.off('levelUp');
    }
}