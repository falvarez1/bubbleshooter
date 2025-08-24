/**
 * PauseSystem
 * Comprehensive pause system that freezes all game elements including:
 * - Physics and game logic updates
 * - CSS animations and transitions
 * - JavaScript timers and time-based calculations
 * - Audio playback
 * - Notification animations
 * 
 * Designed for debugging with browser DevTools
 */
export class PauseSystem {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.isPaused = false;
        this.pauseStartTime = 0;
        this.totalPausedTime = 0;
        this.frameCount = 0;
        this.gameTime = 0;
        
        // Store original time functions for restoration
        this.originalDateNow = Date.now;
        this.originalPerformanceNow = performance.now.bind(performance);
        
        // Track paused elements
        this.pausedElements = new Set();
        this.pausedTimeouts = new Map();
        this.pausedIntervals = new Map();
        
        // Initialize pause indicator
        this.createPauseIndicator();
        
        // Setup keyboard handlers
        this.setupKeyboardHandler();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    createPauseIndicator() {
        // Create pause indicator container
        this.pauseIndicator = document.createElement('div');
        this.pauseIndicator.id = 'pause-indicator';
        this.pauseIndicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.8);
            color: #FFD700;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: 'Orbitron', monospace;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
            border: 2px solid #FFD700;
            display: none;
            backdrop-filter: blur(4px);
            animation: pausePulse 2s ease-in-out infinite;
        `;
        
        this.pauseIndicator.innerHTML = `
            <div style="font-size: 32px; font-weight: bold; margin-bottom: 8px;">⏸ PAUSED</div>
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 5px;">
                Press [P] or [ESC] to resume
            </div>
            <div style="font-size: 12px; opacity: 0.7; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 215, 0, 0.3);">
                <div>Frame: <span id="pauseFrameCount" style="color: #00ff00;">0</span></div>
                <div>Game Time: <span id="pauseGameTime" style="color: #00ff00;">00:00</span></div>
                <div style="margin-top: 5px; opacity: 0.6;">DevTools Ready - Elements Frozen</div>
            </div>
        `;
        
        document.body.appendChild(this.pauseIndicator);
        
        // Add CSS animation for the pulse effect
        if (!document.getElementById('pause-system-styles')) {
            const style = document.createElement('style');
            style.id = 'pause-system-styles';
            style.textContent = `
                @keyframes pausePulse {
                    0%, 100% { 
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% { 
                        opacity: 0.9;
                        transform: scale(1.02);
                    }
                }
                
                /* When paused, freeze all CSS animations except pause indicator */
                body.paused * {
                    animation-play-state: paused !important;
                }
                
                body.paused #pause-indicator,
                body.paused #pause-indicator * {
                    animation-play-state: running !important;
                }
                
                /* Optional debug grid overlay */
                .pause-debug-grid {
                    position: fixed;
                    inset: 0;
                    background-image: 
                        repeating-linear-gradient(0deg, 
                            transparent, 
                            transparent 49px, 
                            rgba(255, 215, 0, 0.02) 49px, 
                            rgba(255, 215, 0, 0.02) 50px),
                        repeating-linear-gradient(90deg, 
                            transparent, 
                            transparent 49px, 
                            rgba(255, 215, 0, 0.02) 49px, 
                            rgba(255, 215, 0, 0.02) 50px);
                    pointer-events: none;
                    z-index: 9998;
                    display: none;
                }
                
                body.paused .pause-debug-grid {
                    display: block;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Create debug grid overlay (optional)
        this.debugGrid = document.createElement('div');
        this.debugGrid.className = 'pause-debug-grid';
        document.body.appendChild(this.debugGrid);
    }
    
    setupKeyboardHandler() {
        window.addEventListener('keydown', (e) => {
            // P key or Escape key to toggle pause
            if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && 
                !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.toggle();
            }
            
            // Additional debug keys while paused
            if (this.isPaused) {
                // Period key for frame stepping (future feature)
                if (e.key === '.') {
                    e.preventDefault();
                    console.log('Frame stepping not yet implemented');
                }
                
                // S key to snapshot state
                if (e.key === 's' || e.key === 'S') {
                    e.preventDefault();
                    this.snapshotState();
                }
            }
        });
    }
    
    setupEventListeners() {
        // Listen for external pause requests
        if (this.eventBus) {
            this.eventBus.on('requestPause', () => this.pause());
            this.eventBus.on('requestResume', () => this.resume());
        }
    }
    
    toggle() {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }
    
    pause() {
        if (this.isPaused) return;
        
        console.log('🔴 Game Paused');
        this.isPaused = true;
        this.pauseStartTime = performance.now();
        
        // Add paused class to body for CSS rules
        document.body.classList.add('paused');
        
        // Show pause indicator
        this.pauseIndicator.style.display = 'block';
        this.updatePauseDisplay();
        
        // Freeze all CSS animations and transitions
        this.freezeCSSAnimations();
        
        // Override time functions to freeze time-based calculations
        this.overrideTimeFunctions();
        
        // Pause all audio
        this.pauseAudio();
        
        // Emit pause event for other systems
        if (this.eventBus) {
            this.eventBus.emit('gamePaused', { 
                time: this.pauseStartTime,
                frame: this.frameCount 
            });
        }
    }
    
    resume() {
        if (!this.isPaused) return;
        
        const pauseDuration = performance.now() - this.pauseStartTime;
        this.totalPausedTime += pauseDuration;
        
        console.log(`🟢 Game Resumed (was paused for ${(pauseDuration / 1000).toFixed(2)}s)`);
        this.isPaused = false;
        
        // Remove paused class from body
        document.body.classList.remove('paused');
        
        // Hide pause indicator
        this.pauseIndicator.style.display = 'none';
        
        // Restore CSS animations and transitions
        this.restoreCSSAnimations();
        
        // Restore original time functions
        this.restoreTimeFunctions();
        
        // Resume audio
        this.resumeAudio();
        
        // Emit resume event for other systems
        if (this.eventBus) {
            this.eventBus.emit('gameResumed', { 
                pauseDuration,
                totalPausedTime: this.totalPausedTime 
            });
        }
    }
    
    freezeCSSAnimations() {
        // Get all animated elements
        const allElements = document.querySelectorAll('*');
        
        allElements.forEach(element => {
            const computed = window.getComputedStyle(element);
            
            // Check if element has animations
            if (computed.animationName !== 'none') {
                // Store current animation state
                element.dataset.pausedAnimationPlayState = computed.animationPlayState;
                // Pause the animation
                element.style.animationPlayState = 'paused';
                this.pausedElements.add(element);
            }
            
            // Check if element has transitions
            if (computed.transitionProperty !== 'none') {
                // Store current transition
                element.dataset.pausedTransition = computed.transition;
                // Temporarily set transition duration to 0
                element.style.transition = 'none';
                this.pausedElements.add(element);
            }
        });
    }
    
    restoreCSSAnimations() {
        this.pausedElements.forEach(element => {
            // Restore animation play state
            if (element.dataset.pausedAnimationPlayState) {
                element.style.animationPlayState = element.dataset.pausedAnimationPlayState || '';
                delete element.dataset.pausedAnimationPlayState;
            }
            
            // Restore transitions
            if (element.dataset.pausedTransition) {
                element.style.transition = element.dataset.pausedTransition || '';
                delete element.dataset.pausedTransition;
            }
        });
        
        this.pausedElements.clear();
    }
    
    overrideTimeFunctions() {
        const pausedAt = this.originalPerformanceNow();
        const dateNowPausedAt = this.originalDateNow();
        
        // Override Date.now to return frozen time
        Date.now = () => dateNowPausedAt;
        
        // Override performance.now to return frozen time
        performance.now = () => pausedAt;
    }
    
    restoreTimeFunctions() {
        // Restore original time functions
        Date.now = this.originalDateNow;
        performance.now = this.originalPerformanceNow;
    }
    
    pauseAudio() {
        // Pause all audio elements
        document.querySelectorAll('audio').forEach(audio => {
            if (!audio.paused) {
                audio.dataset.wasPlaying = 'true';
                audio.pause();
            }
        });
        
        // Handle Web Audio API if used
        if (window.audioContext || window.webkitAudioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext && AudioContext.prototype.suspend) {
                // Store and suspend any audio contexts
                if (window.gameAudioContext) {
                    window.gameAudioContext.suspend();
                }
            }
        }
    }
    
    resumeAudio() {
        // Resume audio elements that were playing
        document.querySelectorAll('audio[data-was-playing="true"]').forEach(audio => {
            audio.play();
            delete audio.dataset.wasPlaying;
        });
        
        // Resume Web Audio API contexts
        if (window.gameAudioContext && window.gameAudioContext.resume) {
            window.gameAudioContext.resume();
        }
    }
    
    updatePauseDisplay() {
        // Update frame count
        const frameElement = document.getElementById('pauseFrameCount');
        if (frameElement) {
            frameElement.textContent = this.frameCount.toLocaleString();
        }
        
        // Update game time
        const timeElement = document.getElementById('pauseGameTime');
        if (timeElement) {
            const minutes = Math.floor(this.gameTime / 60);
            const seconds = Math.floor(this.gameTime % 60);
            timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    updateFrameCount() {
        if (!this.isPaused) {
            this.frameCount++;
        }
    }
    
    updateGameTime(deltaTime) {
        if (!this.isPaused) {
            this.gameTime += deltaTime;
        }
    }
    
    snapshotState() {
        const snapshot = {
            frame: this.frameCount,
            gameTime: this.gameTime,
            timestamp: new Date().toISOString(),
            isPaused: this.isPaused,
            totalPausedTime: this.totalPausedTime,
            dom: {
                notifications: document.querySelectorAll('.game-notification').length,
                bubbles: document.querySelectorAll('[class*="bubble"]').length
            }
        };
        
        console.log('📸 Game State Snapshot:', snapshot);
        
        // Also save to window for easy access
        window.lastGameSnapshot = snapshot;
        
        return snapshot;
    }
    
    // Check if game is currently paused
    getIsPaused() {
        return this.isPaused;
    }
    
    // Get adjusted delta time (returns 0 when paused)
    getAdjustedDeltaTime(deltaTime) {
        return this.isPaused ? 0 : deltaTime;
    }
}