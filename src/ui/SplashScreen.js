// SplashScreen.js - Manages the loading screen and main menu

class SplashScreen {
    constructor(useExistingHTML = false) {
        this.container = null;
        this.progressBar = null;
        this.loadingMessage = null;
        this.mainMenu = null;
        this.assetsLoaded = false;
        this.onStartCallback = null;
        this.onContinueCallback = null;
        this.useExistingHTML = useExistingHTML;
        
        this.loadingMessages = [
            "Initializing Bubble Physics...",
            "Loading Power-Up Systems...",
            "Preparing Particle Effects...",
            "Charging Special Abilities...",
            "Setting Up Game Board...",
            "Almost Ready..."
        ];
        
        this.init();
    }
    
    init() {
        if (this.useExistingHTML) {
            // Use existing HTML elements
            this.attachToExistingHTML();
        } else {
            // Create splash screen HTML structure immediately
            this.createSplashScreen();
            // Force immediate render
            this.forceRender();
        }
        
        // Check for saved game state after DOM is ready
        requestAnimationFrame(() => {
            this.checkSavedGame();
        });
    }
    
    forceRender() {
        // Force browser to render the splash screen immediately
        if (this.container) {
            this.container.offsetHeight; // Trigger reflow
        }
    }
    
    attachToExistingHTML() {
        // Attach to existing HTML elements
        this.container = document.getElementById('splashScreen');
        if (!this.container) {
            console.error('Splash screen HTML not found!');
            return;
        }
        
        // Cache elements
        this.progressBar = this.container.querySelector('.loading-progress-fill');
        this.loadingMessage = this.container.querySelector('.loading-message');
        this.mainMenu = this.container.querySelector('.main-menu');
        
        // Setup menu event listeners
        this.setupMenuListeners();
    }
    
    createSplashScreen() {
        // Create main container
        this.container = document.createElement('div');
        this.container.className = 'splash-screen';
        this.container.innerHTML = `
            <div class="splash-logo">
                SUPER BUBBLE SHOOTER
                <div class="splash-subtitle">By Oreo the Pitador</div>
            </div>
            
            <div class="bubble-galaxy">
                <div class="galaxy-container">
                    <div class="loading-bubble bubble-1"></div>
                    <div class="loading-bubble bubble-2"></div>
                    <div class="loading-bubble bubble-3"></div>
                    <div class="loading-bubble bubble-4"></div>
                    <div class="loading-bubble bubble-5"></div>
                    <div class="loading-bubble bubble-6"></div>
                    <div class="loading-bubble bubble-7"></div>
                    <div class="loading-bubble bubble-8"></div>
                </div>
            </div>
            
            <div class="loading-progress-container">
                <div class="loading-progress-bar">
                    <div class="loading-progress-fill"></div>
                </div>
                <div class="loading-message">Initializing...</div>
            </div>
            
            <div class="main-menu">
                <button class="menu-button" id="startNewGame">
                    Start New Game
                </button>
                <button class="menu-button disabled" id="continueGame">
                    Continue
                    <div class="menu-button-subtitle">No saved game</div>
                </button>
                <button class="menu-button" id="highScores">
                    High Scores
                </button>
                <div class="menu-small-buttons">
                    <button class="menu-small-button" id="settingsBtn">Settings</button>
                    <button class="menu-small-button" id="creditsBtn">Credits</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Cache elements
        this.progressBar = this.container.querySelector('.loading-progress-fill');
        this.loadingMessage = this.container.querySelector('.loading-message');
        this.mainMenu = this.container.querySelector('.main-menu');
        
        // Setup menu event listeners
        this.setupMenuListeners();
    }
    
    setupMenuListeners() {
        const startBtn = this.container.querySelector('#startNewGame');
        const continueBtn = this.container.querySelector('#continueGame');
        const highScoresBtn = this.container.querySelector('#highScores');
        const settingsBtn = this.container.querySelector('#settingsBtn');
        const creditsBtn = this.container.querySelector('#creditsBtn');
        
        startBtn.addEventListener('click', (e) => {
            this.createParticleBurst(e);
            this.startNewGame();
        });
        
        continueBtn.addEventListener('click', (e) => {
            if (!continueBtn.classList.contains('disabled')) {
                this.createParticleBurst(e);
                this.continueGame();
            }
        });
        
        highScoresBtn.addEventListener('click', (e) => {
            this.createParticleBurst(e);
            this.showHighScores();
        });
        
        settingsBtn.addEventListener('click', (e) => {
            this.createParticleBurst(e);
            // Settings will be handled by existing settings system
            console.log('Settings clicked');
        });
        
        creditsBtn.addEventListener('click', (e) => {
            this.createParticleBurst(e);
            this.showCredits();
        });
        
        // Add hover sound effects if audio system is available
        const buttons = this.container.querySelectorAll('.menu-button, .menu-small-button');
        buttons.forEach(button => {
            button.addEventListener('mouseenter', () => {
                // Play hover sound if available
                if (window.audioManager) {
                    window.audioManager.playSound('hover');
                }
            });
        });
    }
    
    createParticleBurst(event) {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        // Create 20 particles
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle-burst';
            
            // Random direction
            const angle = (Math.PI * 2 * i) / 20;
            const distance = 50 + Math.random() * 100;
            const tx = Math.cos(angle) * distance;
            const ty = Math.sin(angle) * distance;
            
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');
            
            document.body.appendChild(particle);
            
            // Remove particle after animation
            setTimeout(() => particle.remove(), 1000);
        }
    }
    
    updateProgress(progress) {
        // Clamp progress between 0 and 100
        progress = Math.max(0, Math.min(100, progress));
        
        // Update progress bar
        if (this.progressBar) {
            this.progressBar.style.width = progress + '%';
        }
        
        // Update loading message based on progress
        if (this.loadingMessage) {
            const messageIndex = Math.floor((progress / 100) * this.loadingMessages.length);
            const message = this.loadingMessages[Math.min(messageIndex, this.loadingMessages.length - 1)];
            this.loadingMessage.textContent = message;
        }
        
        // Show menu when loading complete
        if (progress >= 100 && !this.assetsLoaded) {
            this.assetsLoaded = true;
            this.onLoadingComplete();
        }
    }
    
    onLoadingComplete() {
        // Hide loading elements
        const galaxy = this.container.querySelector('.bubble-galaxy');
        const progressContainer = this.container.querySelector('.loading-progress-container');
        
        if (galaxy) {
            galaxy.style.display = 'none';
        }
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        
        // Show main menu with animation
        if (this.mainMenu) {
            this.mainMenu.classList.add('visible');
        }
        
        // Play ready sound if available
        if (window.audioManager) {
            window.audioManager.playSound('ready');
        }
    }
    
    checkSavedGame() {
        try {
            const savedGame = localStorage.getItem('bubbleShooterGameState');
            if (savedGame) {
                const gameState = JSON.parse(savedGame);
                const continueBtn = this.container.querySelector('#continueGame');
                const subtitle = continueBtn.querySelector('.menu-button-subtitle');
                
                if (gameState.currentLevel !== undefined) {
                    continueBtn.classList.remove('disabled');
                    subtitle.textContent = `Level ${gameState.currentLevel}`;
                    return true;
                }
            }
        } catch (error) {
            console.error('Error checking saved game:', error);
        }
        return false;
    }
    
    startNewGame() {
        console.log('Starting new game...');
        
        // Clear any saved game state
        localStorage.removeItem('bubbleShooterGameState');
        
        // Fade out splash screen
        this.hide(() => {
            if (this.onStartCallback) {
                this.onStartCallback();
            }
        });
    }
    
    continueGame() {
        console.log('Continuing game...');
        
        // Fade out splash screen
        this.hide(() => {
            if (this.onContinueCallback) {
                this.onContinueCallback();
            }
        });
    }
    
    showHighScores() {
        // This would show high scores overlay
        console.log('Showing high scores...');
        // Can be implemented with existing UI system
    }
    
    showCredits() {
        // Simple credits alert for now
        alert('Super Bubble Shooter 9001\n\nDeveloped by Frank Alvarez\nDesigned for shits and giggles!\n\n© 2025');
    }
    
    hide(callback) {
        if (this.container) {
            this.container.classList.add('fade-out');
            
            // Remove after fade animation
            setTimeout(() => {
                if (this.container && this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                }
                if (callback) {
                    callback();
                }
            }, 500);
        }
    }
    
    // Set callbacks for game start
    onStart(callback) {
        this.onStartCallback = callback;
    }
    
    onContinue(callback) {
        this.onContinueCallback = callback;
    }
}

// Asset loader with progress tracking
class AssetLoader {
    constructor(splashScreen) {
        this.splashScreen = splashScreen;
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.assets = [];
        this.startTime = null;
        this.minLoadTime = 1500; // Minimum time to show loading screen (ms)
    }
    
    addAsset(url, type = 'texture') {
        this.assets.push({ url, type, loaded: false });
        this.totalAssets++;
    }
    
    loadAll(THREE, callback) {
        this.startTime = Date.now();
        
        // Start loading asynchronously
        requestAnimationFrame(() => {
            this._performLoading(THREE, callback);
        });
    }
    
    _performLoading(THREE, callback) {
        if (this.assets.length === 0) {
            // Simulate loading with minimum time
            this.simulateLoading(callback);
            return;
        }
        
        const manager = new THREE.LoadingManager();
        
        manager.onStart = (url, itemsLoaded, itemsTotal) => {
            console.log('Started loading:', url);
        };
        
        manager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal) * 100;
            this.splashScreen.updateProgress(progress);
        };
        
        manager.onLoad = () => {
            console.log('All assets loaded!');
            this.splashScreen.updateProgress(100);
            if (callback) callback();
        };
        
        manager.onError = (url) => {
            console.error('Error loading:', url);
        };
        
        // Create loaders
        const textureLoader = new THREE.TextureLoader(manager);
        
        // Load actual assets here
        this.simulateLoading(callback);
    }
    
    simulateLoading(callback) {
        // Simulate loading with smooth progress
        let progress = 0;
        const startTime = Date.now();
        const duration = this.minLoadTime;
        
        const updateProgress = () => {
            const elapsed = Date.now() - startTime;
            progress = Math.min(100, (elapsed / duration) * 100);
            
            // Use easing for smoother progress
            const easedProgress = this.easeOutCubic(progress / 100) * 100;
            this.splashScreen.updateProgress(easedProgress);
            
            if (progress < 100) {
                requestAnimationFrame(updateProgress);
            } else {
                // Ensure minimum load time has passed
                const totalElapsed = Date.now() - this.startTime;
                if (totalElapsed < this.minLoadTime) {
                    setTimeout(() => {
                        if (callback) callback();
                    }, this.minLoadTime - totalElapsed);
                } else {
                    if (callback) callback();
                }
            }
        };
        
        requestAnimationFrame(updateProgress);
    }
    
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
}

// Export for use in main game
export { SplashScreen, AssetLoader };