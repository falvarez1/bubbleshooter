import { effectsController } from './EffectsController.js';

/**
 * Developer Panel Controller
 * Manages all developer panel functionality
 */
export class DeveloperPanel {
    constructor() {
        this.panel = null;
        this.game = null;
        this.initialized = false;
    }

    async initialize(game) {
        this.game = game;
        this.panel = document.getElementById('developerPanel');
        
        if (!this.panel) {
            console.warn('Developer panel element not found');
            return;
        }

        // Initialize effects controller with game's event bus
        if (game.gameManager && game.gameManager.eventBus) {
            await effectsController.initialize(game.gameManager.eventBus);
        }
        
        // Setup all event listeners
        this.setupKeyboardShortcuts();
        this.setupBubbleSelectButtons();
        this.setupLevelControls();
        this.setupGameModeToggles();
        
        this.initialized = true;
        console.log('Developer panel initialized');
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Don't trigger if typing in an input
            if (event.target.tagName.toLowerCase() === 'input' || 
                event.target.tagName.toLowerCase() === 'textarea') {
                return;
            }

            switch(event.key.toLowerCase()) {
                case 'd':
                    this.togglePanel();
                    break;
            }
        });
    }

    togglePanel() {
        if (this.panel) {
            this.panel.classList.toggle('visible');
            console.log('Developer panel:', this.panel.classList.contains('visible') ? 'shown' : 'hidden');
        }
    }

    setupBubbleSelectButtons() {
        const buttons = document.querySelectorAll('.bubble-select-btn');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const bubbleType = button.dataset.bubbleType;
                if (bubbleType && this.game) {
                    // Map display names to actual power-up types
                    const powerUpMap = {
                        'Rainbow Bubble': 'rainbow',
                        'Bomb Bubble': 'bomb',
                        'Lightning Bubble': 'lightning',
                        'Precision Aim': 'precision',
                        'Color Change': 'colorchange',
                        'Fireball': 'fireball',
                        'Laser Bubble': 'laser',
                        'Meteor Bubble': 'meteor',
                        'Magnet Bubble': 'magnet',
                        'Time Freeze': 'timefreeze',
                        'Ghost Bubble': 'ghost',
                        'Multiplier Bubble': 'multiplier',
                        'Shield Bubble': 'shield',
                        'Anchor Bubble': 'anchor',
                        'Reinforcement': 'reinforcement',
                        'Block Bubbles': 'block',
                        'Spike Bubbles': 'spike',
                        'Ice Bubbles': 'ice',
                        'Chain Bubbles': 'chain',
                        'Mimic Bubbles': 'mimic'
                    };

                    const powerUpType = powerUpMap[bubbleType];
                    if (powerUpType) {
                        // Check if power-up is implemented
                        if (this.game.gameManager && this.game.gameManager.powerUpSystem) {
                            const powerUp = this.game.gameManager.powerUpSystem.getPowerUp(powerUpType);
                            if (powerUp) {
                                this.game.FORCED_NEXT_BUBBLE_TYPE = powerUpType;
                                console.log(`Next bubble will be: ${bubbleType} (${powerUpType})`);
                                this.showNotification(`Next bubble: ${bubbleType}`);
                            } else {
                                console.warn(`Power-up not implemented: ${powerUpType}`);
                                this.showNotification(`${bubbleType} not yet implemented`, 'warning');
                            }
                        }
                    }
                }
            });
        });
    }

    setupLevelControls() {
        // Load level input
        const loadLevelInput = document.getElementById('loadLevelInput');
        if (loadLevelInput) {
            loadLevelInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    const levelId = event.target.value.trim();
                    if (levelId) {
                        console.log(`Loading level: ${levelId}`);
                        this.showNotification(`Loading level: ${levelId}`);
                        // TODO: Implement level loading
                        if (this.game && this.game.gameManager && this.game.gameManager.eventBus) {
                            this.game.gameManager.eventBus.emit('loadLevel', levelId);
                        }
                    }
                }
            });
        }

        // Next level button
        const nextLevelBtn = document.getElementById('nextLevelBtn');
        if (nextLevelBtn) {
            nextLevelBtn.addEventListener('click', () => {
                console.log('Loading next level');
                this.showNotification('Loading next level');
                // TODO: Implement next level
                if (this.game && this.game.gameManager && this.game.gameManager.eventBus) {
                    this.game.gameManager.eventBus.emit('nextLevel');
                }
            });
        }

        // Previous level button
        const prevLevelBtn = document.getElementById('prevLevelBtn');
        if (prevLevelBtn) {
            prevLevelBtn.addEventListener('click', () => {
                console.log('Loading previous level');
                this.showNotification('Loading previous level');
                // TODO: Implement previous level
                if (this.game && this.game.gameManager && this.game.gameManager.eventBus) {
                    this.game.gameManager.eventBus.emit('previousLevel');
                }
            });
        }
    }

    setupGameModeToggles() {
        // God mode toggle
        const godModeToggle = document.getElementById('godModeToggle');
        if (godModeToggle) {
            godModeToggle.addEventListener('change', (event) => {
                const enabled = event.target.checked;
                if (this.game && this.game.gameState) {
                    this.game.gameState.godMode = enabled;
                    console.log('God mode:', enabled ? 'ON' : 'OFF');
                    this.showNotification(`God mode: ${enabled ? 'ON' : 'OFF'}`);
                    if (this.game && this.game.gameManager && this.game.gameManager.eventBus) {
                        this.game.gameManager.eventBus.emit('godModeChanged', enabled);
                    }
                }
            });
        }

        // Show coordinates toggle
        const showCoordsToggle = document.getElementById('showCoordsToggle');
        if (showCoordsToggle) {
            showCoordsToggle.addEventListener('change', (event) => {
                const enabled = event.target.checked;
                if (this.game && this.game.gameState) {
                    this.game.gameState.showCoordinates = enabled;
                    console.log('Show coordinates:', enabled ? 'ON' : 'OFF');
                    this.showNotification(`Coordinates: ${enabled ? 'ON' : 'OFF'}`);
                    if (this.game && this.game.gameManager && this.game.gameManager.eventBus) {
                        this.game.gameManager.eventBus.emit('showCoordinatesChanged', enabled);
                    }
                }
            });
        }
    }

    showNotification(message, type = 'info') {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.className = `dev-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'warning' ? 'rgba(255, 100, 0, 0.9)' : 'rgba(0, 255, 255, 0.9)'};
            color: #000;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: 'Orbitron', monospace;
            font-size: 14px;
            z-index: 10000;
            animation: fadeInOut 2s ease-in-out;
        `;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Remove after animation
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 2000);
    }

    // Method to update panel state based on game state
    updatePanelState() {
        if (!this.game || !this.game.gameState) return;

        // Update god mode checkbox
        const godModeToggle = document.getElementById('godModeToggle');
        if (godModeToggle) {
            godModeToggle.checked = this.game.gameState.godMode || false;
        }

        // Update show coordinates checkbox
        const showCoordsToggle = document.getElementById('showCoordsToggle');
        if (showCoordsToggle) {
            showCoordsToggle.checked = this.game.gameState.showCoordinates || false;
        }
    }
}

// Create singleton instance
export const developerPanel = new DeveloperPanel();