import { CONFIG } from '../core/Config.js';

/**
 * Level Progression System
 * Manages game levels, difficulty scaling, and progression persistence
 */
export class LevelProgressionSystem {
    constructor(gameState, eventBus) {
        this.gameState = gameState;
        this.eventBus = eventBus;
        this.pauseSystem = null; // Will be set by main game
        
        // Level configuration
        this.config = {
            // Score requirements
            baseScorePerLevel: 1000,      // Base score needed for level 2
            scoreMultiplier: 1.2,          // Each level requires 20% more than previous
            
            // Level phases (inspired by indie designer recommendations)
            phases: {
                learning: { start: 1, end: 5 },      // Levels 1-5
                mastery: { start: 6, end: 15 },      // Levels 6-15
                excellence: { start: 16, end: null }  // Levels 16+
            },
            
            // Difficulty parameters per phase
            phaseSettings: {
                learning: {
                    timerRange: [30000, 20000],    // 30s to 20s
                    clusterRange: [0.7, 0.5],       // 70% to 50% clustering
                    colorCount: 4,
                    powerUpChance: 0.15,
                    description: "Learning the Basics"
                },
                mastery: {
                    timerRange: [20000, 12000],    // 20s to 12s
                    clusterRange: [0.5, 0.3],       // 50% to 30% clustering
                    colorCount: 5,
                    powerUpChance: 0.20,
                    description: "Mastering Patterns"
                },
                excellence: {
                    timerRange: [12000, 8000],     // 12s to 8s
                    clusterRange: [0.3, 0.1],       // 30% to 10% clustering
                    colorCount: 6,
                    powerUpChance: 0.25,
                    description: "Pursuit of Excellence"
                }
            },
            
            // Adaptive difficulty
            adaptiveDifficulty: {
                enabled: true,
                failureCount: 0,
                maxFailures: 3,              // Trigger mercy mode after 3 failures
                successStreak: 0,
                bonusThreshold: 5,           // Give bonus after 5 successes
            },
            
            // Zen moments (breather levels)
            zenMomentInterval: 5,           // Every 5 levels
            zenMomentDuration: 30000,       // 30 second breather
            
            // Statistics tracking
            stats: {
                totalBubblesPopped: 0,
                totalCombos: 0,
                perfectClears: 0,
                totalPlayTime: 0,
                startTime: Date.now()
            }
        };
        
        // Current phase
        this.currentPhase = null;
        
        // Load saved progress
        this.loadProgress();
        
        // Initialize level
        this.initializeLevel(this.gameState.level);
        
        // Subscribe to events
        this.subscribeToEvents();
        
        // Create UI
        this.createUI();
    }
    
    createUI() {
        // Create level display
        const levelUI = document.createElement('div');
        levelUI.className = 'level-progression-ui';
        levelUI.innerHTML = `
            <div class="level-display" id="levelDisplay">
                <div class="level-number">
                    <span class="level-label">LEVEL</span>
                    <span class="level-value" id="currentLevel">1</span>
                </div>
                <div class="level-phase" id="levelPhase">Learning the Basics</div>
                <div class="level-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" id="levelProgressFill"></div>
                    </div>
                    <span class="progress-text" id="levelProgressText">0 / 1000</span>
                </div>
            </div>
            
            <div class="level-up-animation hidden" id="levelUpAnimation">
                <div class="level-up-content">
                    <h2 class="level-up-title">LEVEL UP!</h2>
                    <div class="new-level-number" id="newLevelNumber">2</div>
                    <div class="level-up-message" id="levelUpMessage">Difficulty Increased</div>
                </div>
            </div>
            
            <div class="zen-moment hidden" id="zenMoment">
                <div class="zen-content">
                    <h2 class="zen-title">✨ ZEN MOMENT ✨</h2>
                    <p class="zen-message">Take a breather - No timer for 30 seconds!</p>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .level-progression-ui {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                font-family: 'Orbitron', monospace;
            }
            
            .level-display {
                background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(40,0,60,0.9));
                border: 2px solid #9B59B6;
                border-radius: 10px;
                padding: 15px;
                min-width: 200px;
                box-shadow: 0 0 20px rgba(155,89,182,0.4);
            }
            
            .level-number {
                text-align: center;
                margin-bottom: 10px;
            }
            
            .level-label {
                display: block;
                color: #9B59B6;
                font-size: 12px;
                letter-spacing: 3px;
                margin-bottom: 5px;
            }
            
            .level-value {
                display: block;
                color: #FFF;
                font-size: 36px;
                font-weight: bold;
                text-shadow: 0 0 20px rgba(155,89,182,0.8);
            }
            
            .level-phase {
                text-align: center;
                color: #BB99CC;
                font-size: 11px;
                margin-bottom: 10px;
                font-style: italic;
            }
            
            .level-progress {
                margin-top: 10px;
            }
            
            .progress-bar {
                width: 100%;
                height: 8px;
                background: rgba(0,0,0,0.5);
                border-radius: 4px;
                overflow: hidden;
                border: 1px solid #9B59B6;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #9B59B6, #E91E63);
                transition: width 0.3s ease;
                box-shadow: 0 0 10px rgba(155,89,182,0.6);
            }
            
            .progress-text {
                display: block;
                text-align: center;
                color: #BB99CC;
                font-size: 10px;
                margin-top: 5px;
            }
            
            .level-up-animation {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 2000;
                animation: levelUpPulse 2s ease-out;
            }
            
            .level-up-content {
                background: linear-gradient(135deg, rgba(155,89,182,0.95), rgba(233,30,99,0.95));
                border: 3px solid #FFF;
                border-radius: 20px;
                padding: 30px 50px;
                text-align: center;
                box-shadow: 0 0 50px rgba(155,89,182,0.8);
            }
            
            .level-up-title {
                color: #FFF;
                font-size: 36px;
                margin: 0;
                text-shadow: 0 0 20px rgba(255,255,255,0.5);
                animation: glow 1s ease-in-out infinite alternate;
            }
            
            .new-level-number {
                color: #FFF;
                font-size: 72px;
                font-weight: bold;
                margin: 10px 0;
                text-shadow: 0 0 30px rgba(255,255,255,0.8);
            }
            
            .level-up-message {
                color: #FFF;
                font-size: 14px;
                opacity: 0.9;
            }
            
            .zen-moment {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 2000;
                animation: zenFloat 3s ease-in-out infinite;
            }
            
            .zen-content {
                background: linear-gradient(135deg, rgba(0,200,200,0.95), rgba(0,150,255,0.95));
                border: 3px solid #FFF;
                border-radius: 20px;
                padding: 30px 50px;
                text-align: center;
                box-shadow: 0 0 50px rgba(0,200,200,0.8);
            }
            
            .zen-title {
                color: #FFF;
                font-size: 28px;
                margin: 0 0 10px 0;
            }
            
            .zen-message {
                color: #FFF;
                font-size: 16px;
                margin: 0;
            }
            
            @keyframes levelUpPulse {
                0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
            }
            
            @keyframes glow {
                from { text-shadow: 0 0 20px rgba(255,255,255,0.5); }
                to { text-shadow: 0 0 30px rgba(255,255,255,1), 0 0 40px rgba(255,255,255,0.5); }
            }
            
            @keyframes zenFloat {
                0%, 100% { transform: translate(-50%, -50%) translateY(0); }
                50% { transform: translate(-50%, -50%) translateY(-10px); }
            }
            
            .hidden {
                display: none !important;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(levelUI);
        
        // Store references
        this.levelValue = document.getElementById('currentLevel');
        this.levelPhase = document.getElementById('levelPhase');
        this.progressFill = document.getElementById('levelProgressFill');
        this.progressText = document.getElementById('levelProgressText');
        this.levelUpAnimation = document.getElementById('levelUpAnimation');
        this.newLevelNumber = document.getElementById('newLevelNumber');
        this.levelUpMessage = document.getElementById('levelUpMessage');
        this.zenMoment = document.getElementById('zenMoment');
        
        // Update initial display
        this.updateUI();
    }
    
    subscribeToEvents() {
        // Score updates
        this.eventBus.on('scoreUpdated', (data) => {
            this.checkLevelProgression(data.score);
            this.updateUI();
        });
        
        // Bubble destruction tracking
        this.eventBus.on('bubblesDestroyed', (data) => {
            this.config.stats.totalBubblesPopped += data.count;
            if (data.combo) {
                this.config.stats.totalCombos++;
            }
        });
        
        // Game over tracking
        this.eventBus.on('gameOver', () => {
            this.config.adaptiveDifficulty.failureCount++;
            this.config.adaptiveDifficulty.successStreak = 0;
            
            if (this.config.adaptiveDifficulty.failureCount >= this.config.adaptiveDifficulty.maxFailures) {
                this.activateMercyMode();
            }
        });
        
        // Perfect clear tracking
        this.eventBus.on('perfectClear', () => {
            this.config.stats.perfectClears++;
            this.config.adaptiveDifficulty.successStreak++;
            
            if (this.config.adaptiveDifficulty.successStreak >= this.config.adaptiveDifficulty.bonusThreshold) {
                this.grantBonus();
            }
        });
    }
    
    initializeLevel(level) {
        // Determine phase
        this.currentPhase = this.getPhaseForLevel(level);
        
        // Calculate level settings
        const settings = this.calculateLevelSettings(level);
        
        // Apply settings
        this.applyLevelSettings(settings);
        
        // Check for zen moment
        if (level > 1 && level % this.config.zenMomentInterval === 0) {
            this.triggerZenMoment();
        }
        
        console.log(`Initialized Level ${level} (${this.currentPhase}):`, settings);
    }
    
    getPhaseForLevel(level) {
        if (level <= this.config.phases.learning.end) {
            return 'learning';
        } else if (level <= this.config.phases.mastery.end) {
            return 'mastery';
        } else {
            return 'excellence';
        }
    }
    
    calculateLevelSettings(level) {
        const phase = this.getPhaseForLevel(level);
        const phaseConfig = this.config.phaseSettings[phase];
        const phaseInfo = this.config.phases[phase];
        
        // Calculate progress within phase
        const phaseStart = phaseInfo.start;
        const phaseEnd = phaseInfo.end || level + 10; // Excellence phase is open-ended
        const phaseProgress = (level - phaseStart) / (phaseEnd - phaseStart);
        
        // Interpolate timer duration within phase range
        const [timerMax, timerMin] = phaseConfig.timerRange;
        const timerDuration = Math.round(timerMax - (timerMax - timerMin) * phaseProgress);
        
        // Interpolate clustering chance within phase range
        const [clusterMax, clusterMin] = phaseConfig.clusterRange;
        const clusterChance = clusterMax - (clusterMax - clusterMin) * phaseProgress;
        
        // Apply adaptive difficulty modifiers
        let difficultyModifier = 1.0;
        if (this.config.adaptiveDifficulty.enabled) {
            if (this.config.adaptiveDifficulty.failureCount > 0) {
                difficultyModifier = 0.9; // Make 10% easier after failures
            } else if (this.config.adaptiveDifficulty.successStreak > 3) {
                difficultyModifier = 1.1; // Make 10% harder after success streak
            }
        }
        
        return {
            level: level,
            phase: phase,
            phaseDescription: phaseConfig.description,
            timerDuration: Math.round(timerDuration * difficultyModifier),
            clusterChance: Math.min(0.9, clusterChance * difficultyModifier),
            powerUpChance: phaseConfig.powerUpChance,
            maxColors: phaseConfig.colorCount,
            bubbleSpeed: CONFIG.SHOOTING_SPEED * (1 + (level - 1) * 0.02), // 2% faster per level
            scoreRequired: this.calculateScoreForLevel(level + 1)
        };
    }
    
    calculateScoreForLevel(level) {
        // Exponential score scaling
        return Math.round(
            this.config.baseScorePerLevel * 
            Math.pow(this.config.scoreMultiplier, level - 2)
        );
    }
    
    applyLevelSettings(settings) {
        // Emit events for other systems to respond to
        this.eventBus.emit('levelSettingsChanged', settings);
        
        // Update game state
        this.gameState.level = settings.level;
    }
    
    checkLevelProgression(currentScore) {
        const nextLevelScore = this.calculateScoreForLevel(this.gameState.level + 1);
        
        if (currentScore >= nextLevelScore) {
            this.levelUp();
        }
    }
    
    levelUp() {
        const newLevel = this.gameState.level + 1;
        const oldPhase = this.currentPhase;
        
        // Update level
        this.gameState.level = newLevel;
        this.initializeLevel(newLevel);
        
        // Track success
        this.config.adaptiveDifficulty.successStreak++;
        this.config.adaptiveDifficulty.failureCount = Math.max(0, this.config.adaptiveDifficulty.failureCount - 1);
        
        // Show level up animation
        this.showLevelUpAnimation(newLevel);
        
        // Emit level up event
        this.eventBus.emit('levelUp', {
            level: newLevel,
            phase: this.currentPhase,
            phaseChanged: oldPhase !== this.currentPhase,
            settings: this.calculateLevelSettings(newLevel)
        });
        
        // Save progress
        this.saveProgress();
        
        console.log(`Level up! Now level ${newLevel}`);
    }
    
    showLevelUpAnimation(level) {
        // Check if UI elements exist
        if (!this.levelUpAnimation || !this.newLevelNumber || !this.levelUpMessage) {
            console.log(`Level up to ${level}!`);
            return;
        }
        
        // Update animation content
        this.newLevelNumber.textContent = level;
        
        // Customize message based on phase
        const phase = this.getPhaseForLevel(level);
        const messages = {
            learning: ['Getting the hang of it!', 'Keep learning!', 'Nice progress!'],
            mastery: ['Mastering the patterns!', 'Skillful play!', 'Impressive combos!'],
            excellence: ['Excellence achieved!', 'True mastery!', 'Legendary skills!']
        };
        
        const messageList = messages[phase];
        this.levelUpMessage.textContent = messageList[Math.floor(Math.random() * messageList.length)];
        
        // Show animation
        this.levelUpAnimation.classList.remove('hidden');
        
        // Hide after animation
        setTimeout(() => {
            if (this.levelUpAnimation) {
                this.levelUpAnimation.classList.add('hidden');
            }
        }, 2000);
        
        // Update UI
        this.updateUI();
    }
    
    triggerZenMoment() {
        // Don't trigger zen moment if game is paused
        if (this.pauseSystem && this.pauseSystem.getIsPaused()) {
            console.log('Zen moment skipped - game is paused');
            return;
        }
        
        console.log('Zen moment activated!');
        
        // Use the notification manager through the event bus
        this.eventBus.emit('showNotification', {
            text: '✨ ZEN MOMENT ✨\nTake a breather - No timer for 30 seconds!',
            type: 'zenMoment',
            className: 'zen-moment-notification',
            priority: 4,
            duration: 3000,
            immediate: true
        });
        
        // Also show the original UI element if it exists (as backup)
        if (this.zenMoment) {
            this.zenMoment.classList.remove('hidden');
            
            // Hide after 3 seconds
            setTimeout(() => {
                if (this.zenMoment) {
                    this.zenMoment.classList.add('hidden');
                }
            }, 3000);
        }
        
        // Pause timer temporarily
        this.eventBus.emit('zenMoment', {
            duration: this.config.zenMomentDuration
        });
    }
    
    activateMercyMode() {
        console.log('Mercy mode activated - reducing difficulty');
        
        // Emit mercy mode event
        this.eventBus.emit('mercyMode', {
            active: true,
            reason: 'Multiple failures'
        });
        
        // Reset failure count
        this.config.adaptiveDifficulty.failureCount = 0;
    }
    
    grantBonus() {
        console.log('Bonus granted for success streak!');
        
        // Grant score bonus
        const bonus = 500 * this.gameState.level;
        this.gameState.addScore(bonus);
        
        // Emit bonus event
        this.eventBus.emit('bonusGranted', {
            amount: bonus,
            reason: 'Success streak'
        });
        
        // Reset success streak
        this.config.adaptiveDifficulty.successStreak = 0;
    }
    
    updateUI() {
        // Update level display
        this.levelValue.textContent = this.gameState.level;
        
        // Update phase display
        const phaseConfig = this.config.phaseSettings[this.currentPhase];
        this.levelPhase.textContent = phaseConfig.description;
        
        // Update progress bar
        const currentScore = this.gameState.score;
        const nextLevelScore = this.calculateScoreForLevel(this.gameState.level + 1);
        const prevLevelScore = this.gameState.level > 1 ? this.calculateScoreForLevel(this.gameState.level) : 0;
        
        const progress = (currentScore - prevLevelScore) / (nextLevelScore - prevLevelScore);
        this.progressFill.style.width = `${Math.min(100, progress * 100)}%`;
        this.progressText.textContent = `${currentScore} / ${nextLevelScore}`;
    }
    
    saveProgress() {
        const saveData = {
            level: this.gameState.level,
            score: this.gameState.score,
            bestCombo: this.gameState.bestCombo,
            stats: this.config.stats,
            adaptiveDifficulty: this.config.adaptiveDifficulty,
            timestamp: Date.now()
        };
        
        try {
            // Save to main progress slot
            localStorage.setItem('bubbleShooterProgress', JSON.stringify(saveData));
            
            // Also save simplified version for splash screen Continue button
            const simpleSave = {
                level: this.gameState.level,
                score: this.gameState.score,
                highScore: this.gameState.highScore || this.gameState.score,
                timestamp: Date.now()
            };
            localStorage.setItem('bubbleShooterSave', JSON.stringify(simpleSave));
            
            console.log('Progress saved');
        } catch (e) {
            console.warn('Failed to save progress:', e);
        }
    }
    
    loadProgress() {
        try {
            const saved = localStorage.getItem('bubbleShooterProgress');
            if (saved) {
                const data = JSON.parse(saved);
                
                // Only load if save is less than 24 hours old
                if (Date.now() - data.timestamp < 86400000) {
                    // Apply saved data
                    if (data.level) {
                        this.gameState.level = data.level;
                        // Notify timer system about the loaded level
                        this.eventBus.emit('levelUp', { level: data.level });
                    }
                    if (data.score) this.gameState.score = data.score;
                    if (data.bestCombo) this.gameState.bestCombo = data.bestCombo;
                    if (data.stats) Object.assign(this.config.stats, data.stats);
                    if (data.adaptiveDifficulty) Object.assign(this.config.adaptiveDifficulty, data.adaptiveDifficulty);
                    
                    console.log('Progress loaded:', data);
                    return true;
                }
            }
        } catch (e) {
            console.warn('Failed to load progress:', e);
        }
        return false;
    }
    
    getStatistics() {
        const playTime = Date.now() - this.config.stats.startTime;
        return {
            ...this.config.stats,
            currentLevel: this.gameState.level,
            currentScore: this.gameState.score,
            playTimeMinutes: Math.floor(playTime / 60000),
            averageComboSize: this.config.stats.totalCombos > 0 
                ? Math.round(this.config.stats.totalBubblesPopped / this.config.stats.totalCombos)
                : 0
        };
    }
    
    destroy() {
        // Save progress before destroying
        this.saveProgress();
        
        // Remove UI elements
        const levelUI = document.querySelector('.level-progression-ui');
        if (levelUI) levelUI.remove();
        
        // Unsubscribe from events
        this.eventBus.off('scoreUpdated');
        this.eventBus.off('bubblesDestroyed');
        this.eventBus.off('gameOver');
        this.eventBus.off('perfectClear');
    }
}