import { effectsController } from './EffectsController.js';
import { CONFIG } from '../core/Config.js';
import * as THREE from 'three';

/**
 * Developer Panel Controller
 * Manages all developer panel functionality
 */
export class DeveloperPanel {
    constructor() {
        this.panel = null;
        this.game = null;
        this.initialized = false;
        
        // Design mode state
        this.designMode = false;
        this.selectedBubble = null;
        this.draggedBubble = null;
        this.isDragging = false;
        this.designModeOverlay = null;
        
        // Color name mapping for CONFIG.BUBBLE_COLORS
        this.colorNames = {
            0xFF0000: 'Red',
            0x0000ff: 'Deep Blue', 
            0xFFD700: 'Gold',
            0x00FF00: 'Green',
            0xFF1493: 'Deep Pink',
            0x9400D3: 'Violet',
            0xFF8C00: 'Orange',
            0x00CED1: 'Turquoise'
        };
        this.bubblePalette = null;
        this.propertyPanel = null;
        this.levelData = null;
        
        // Spring physics for bubble repositioning
        this.springPhysics = {
            enabled: false,
            animatingBubbles: new Map(),
            springConstant: 0.8,
            dampening: 0.9,
            restThreshold: 0.01
        };
    }
    
    /**
     * Get a human-readable name for a color value
     * @param {number} color - Hex color value
     * @returns {string} Color name
     */
    getColorName(color) {
        return this.colorNames[color] || `Color #${color.toString(16).padStart(6, '0')}`;
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
        this.setupDesignMode();
        
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
                case 'l':
                    // Toggle design mode
                    const designModeToggle = document.getElementById('designModeToggle');
                    if (designModeToggle) {
                        designModeToggle.checked = !designModeToggle.checked;
                        this.toggleDesignMode(designModeToggle.checked);
                    }
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
        
        // Update design mode toggle
        const designModeToggle = document.getElementById('designModeToggle');
        if (designModeToggle) {
            designModeToggle.checked = this.designMode;
        }
    }
    
    setupDesignMode() {
        // Design mode toggle
        const designModeToggle = document.getElementById('designModeToggle');
        if (designModeToggle) {
            designModeToggle.addEventListener('change', (event) => {
                this.toggleDesignMode(event.target.checked);
            });
        }
        
        // Level save button
        const saveLevelBtn = document.getElementById('saveLevelBtn');
        if (saveLevelBtn) {
            saveLevelBtn.addEventListener('click', () => {
                this.saveCurrentLevel();
            });
        }
        
        // Level name input
        const levelNameInput = document.getElementById('levelNameInput');
        if (levelNameInput) {
            levelNameInput.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.saveCurrentLevel();
                }
            });
        }
        
        // Clear grid button
        const clearGridBtn = document.getElementById('clearGridBtn');
        if (clearGridBtn) {
            clearGridBtn.addEventListener('click', () => {
                this.clearGrid();
            });
        }
        
        // Load level file input
        const loadLevelFile = document.getElementById('loadLevelFile');
        if (loadLevelFile) {
            loadLevelFile.addEventListener('change', (event) => {
                this.loadLevelFromFile(event.target.files[0]);
            });
        }
    }
    
    toggleDesignMode(enabled) {
        this.designMode = enabled;
        
        if (enabled) {
            this.enterDesignMode();
        } else {
            this.exitDesignMode();
        }
        
        console.log('Design mode:', enabled ? 'ON' : 'OFF');
        this.showNotification(`Design mode: ${enabled ? 'ON' : 'OFF'}`);
        
        if (this.game && this.game.gameManager && this.game.gameManager.eventBus) {
            this.game.gameManager.eventBus.emit('designModeChanged', enabled);
        }
    }
    
    enterDesignMode() {
        // Create design mode overlay
        this.createDesignModeOverlay();
        
        // Create bubble palette
        this.createBubblePalette();
        
        // Create property panel
        this.createPropertyPanel();
        
        // Create hexagonal grid overlay
        this.createHexGridOverlay();
        
        // Setup mouse events for bubble selection
        this.setupBubbleSelection();
        
        // Add design mode class to canvas
        if (this.game && this.game.renderer && this.game.renderer.domElement) {
            this.game.renderer.domElement.classList.add('design-mode-active');
        }
        
        // Hide scoreboard
        const scoreboard = document.querySelector('.score-container');
        if (scoreboard) {
            scoreboard.style.display = 'none';
        }
        
        // Pause the game
        if (this.game && this.game.gameState) {
            this.game.gameState.pause();
            // Set a flag to prevent shooting
            this.game.designModeActive = true;
            
            // Hide current shooting bubble
            if (this.game.gameState.currentBubble && this.game.gameState.currentBubble.mesh) {
                this.game.gameState.currentBubble.mesh.visible = false;
            }
        }
        
        // Capture current level state
        this.captureLevelData();
    }
    
    exitDesignMode() {
        // Cancel any active drag operation
        if (this.isDragging) {
            this.cancelDrag();
            this.finalizeDrag();
        }
        
        // Remove design mode overlay
        this.removeDesignModeOverlay();
        
        // Clear selection
        this.clearSelection();
        
        // Remove mouse event listeners
        this.removeBubbleSelection();
        
        // Clean up drop preview
        this.hideDropPreview();
        if (this.dropPreview) {
            this.game.scene.remove(this.dropPreview);
            this.dropPreview.geometry.dispose();
            this.dropPreview.material.dispose();
            this.dropPreview = null;
        }
        
        // Remove hexagonal grid overlay
        this.removeHexGridOverlay();
        
        // Remove design mode class from canvas
        if (this.game && this.game.renderer && this.game.renderer.domElement) {
            this.game.renderer.domElement.classList.remove('design-mode-active');
        }
        
        // Show scoreboard
        const scoreboard = document.querySelector('.score-container');
        if (scoreboard) {
            scoreboard.style.display = '';
        }
        
        // Resume the game
        if (this.game && this.game.gameState) {
            this.game.gameState.resume();
            // Clear the flag
            this.game.designModeActive = false;
            
            // Show current shooting bubble
            if (this.game.gameState.currentBubble && this.game.gameState.currentBubble.mesh) {
                this.game.gameState.currentBubble.mesh.visible = true;
            }
        }
    }
    
    createDesignModeOverlay() {
        if (this.designModeOverlay) return;
        
        this.designModeOverlay = document.createElement('div');
        this.designModeOverlay.className = 'design-mode-overlay';
        this.designModeOverlay.innerHTML = `
            <div class="design-mode-header">
                <h3>Design Mode Active</h3>
                <p>Click bubbles to select • Drag to move • Use palette to add new bubbles</p>
            </div>
        `;
        document.body.appendChild(this.designModeOverlay);
    }
    
    createBubblePalette() {
        if (this.bubblePalette) return;
        
        this.bubblePalette = document.createElement('div');
        this.bubblePalette.className = 'bubble-palette';
        // Generate palette items dynamically from CONFIG.BUBBLE_COLORS
        const colorPaletteItems = CONFIG.BUBBLE_COLORS.map(color => {
            const hexColor = `#${color.toString(16).padStart(6, '0')}`;
            const colorName = this.getColorName(color);
            return `<div class="palette-item" data-bubble-type="normal" data-color="0x${color.toString(16)}" style="background: ${hexColor};" title="${colorName}"></div>`;
        }).join('');

        this.bubblePalette.innerHTML = `
            <div class="palette-header">
                <h4>Palette</h4>
                <button class="palette-minimize" title="Minimize">−</button>
            </div>
            <div class="palette-content">
                <div class="palette-section">
                    <h5>Colors</h5>
                    <div class="palette-grid">
                        ${colorPaletteItems}
                        <div class="palette-item" data-bubble-type="empty" style="background: transparent; border: 2px dashed #666;" title="Empty"></div>
                    </div>
                </div>
                <div class="palette-section">
                    <h5>Power-ups</h5>
                    <div class="palette-grid">
                        <div class="palette-item" data-bubble-type="rainbow" style="background: linear-gradient(45deg, red, orange, yellow, green, blue, purple);" title="Rainbow"></div>
                        <div class="palette-item" data-bubble-type="bomb" style="background: radial-gradient(circle, #ff4444, #cc0000);" title="Bomb"></div>
                        <div class="palette-item" data-bubble-type="lightning" style="background: radial-gradient(circle, #ffff44, #ffaa00);" title="Lightning"></div>
                        <div class="palette-item" data-bubble-type="precision" style="background: radial-gradient(circle, #44ffff, #0088cc);" title="Precision"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Setup drag and drop from palette
        this.setupPaletteDragDrop();
        
        // Setup minimize button
        const minimizeBtn = this.bubblePalette.querySelector('.palette-minimize');
        const paletteContent = this.bubblePalette.querySelector('.palette-content');
        minimizeBtn.addEventListener('click', () => {
            paletteContent.classList.toggle('minimized');
            minimizeBtn.textContent = paletteContent.classList.contains('minimized') ? '+' : '−';
        });
        
        document.body.appendChild(this.bubblePalette);
    }
    
    createPropertyPanel() {
        if (this.propertyPanel) return;
        
        this.propertyPanel = document.createElement('div');
        this.propertyPanel.className = 'property-panel';
        this.propertyPanel.innerHTML = `
            <h4>Bubble Properties</h4>
            <div id="propertyContent">
                <p>Select a bubble to edit its properties</p>
            </div>
        `;
        document.body.appendChild(this.propertyPanel);
    }
    
    setupPaletteDragDrop() {
        const paletteItems = this.bubblePalette.querySelectorAll('.palette-item');
        
        paletteItems.forEach(item => {
            item.draggable = true;
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    type: item.dataset.bubbleType,
                    color: item.dataset.color || null
                }));
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
    }
    
    setupBubbleSelection() {
        this.boundMouseDown = this.onBubbleMouseDown.bind(this);
        this.boundMouseMove = this.onBubbleMouseMove.bind(this);
        this.boundMouseUp = this.onBubbleMouseUp.bind(this);
        this.boundClick = this.onBubbleClick.bind(this);
        this.boundDragOver = this.onCanvasDragOver.bind(this);
        this.boundDrop = this.onCanvasDrop.bind(this);
        
        if (this.game && this.game.renderer && this.game.renderer.domElement) {
            const canvas = this.game.renderer.domElement;
            canvas.addEventListener('mousedown', this.boundMouseDown);
            canvas.addEventListener('mousemove', this.boundMouseMove);
            canvas.addEventListener('mouseup', this.boundMouseUp);
            canvas.addEventListener('click', this.boundClick);
            
            // Setup drop zone for canvas
            canvas.addEventListener('dragover', this.boundDragOver);
            canvas.addEventListener('drop', this.boundDrop);
        }
    }
    
    onCanvasDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }
    
    onCanvasDrop(e) {
        e.preventDefault();
        this.handleCanvasDrop(e);
    }
    
    removeBubbleSelection() {
        if (this.game && this.game.renderer && this.game.renderer.domElement) {
            const canvas = this.game.renderer.domElement;
            canvas.removeEventListener('mousedown', this.boundMouseDown);
            canvas.removeEventListener('mousemove', this.boundMouseMove);
            canvas.removeEventListener('mouseup', this.boundMouseUp);
            canvas.removeEventListener('click', this.boundClick);
            canvas.removeEventListener('dragover', this.boundDragOver);
            canvas.removeEventListener('drop', this.boundDrop);
        }
    }
    
    onBubbleClick(event) {
        if (!this.designMode) return;
        
        const bubble = this.getBubbleAtMousePosition(event);
        if (bubble) {
            this.selectBubble(bubble);
        } else {
            this.clearSelection();
        }
    }
    
    onBubbleMouseDown(event) {
        if (!this.designMode) return;
        
        const bubble = this.getBubbleAtMousePosition(event);
        if (bubble) {
            this.draggedBubble = bubble;
            this.isDragging = true;
            this.selectBubble(bubble);
            
            // Store the original position for reverting if needed
            this.dragStartPosition = {
                x: bubble.gridX,
                y: bubble.gridY,
                worldPos: bubble.position.clone()
            };
            
            // Calculate drag offset to prevent jumping
            const mousePos = this.getMouseWorldPosition(event);
            this.dragOffset = new THREE.Vector3().subVectors(bubble.position, mousePos);
        }
    }
    
    onBubbleMouseMove(event) {
        if (!this.designMode || !this.isDragging || !this.draggedBubble) return;
        
        const mousePos = this.getMouseWorldPosition(event);
        
        // Apply drag offset to prevent jumping
        const dragPosition = new THREE.Vector3().addVectors(mousePos, this.dragOffset);
        
        // Show where the bubble will snap to
        const gridPos = this.getNearestGridPosition(dragPosition);
        if (gridPos) {
            // Check if this would be a valid drop
            let isValidDrop = true;
            
            // If hovering over a different position than where we started, displace other bubbles
            if (gridPos.x !== this.dragStartPosition.x || gridPos.y !== this.dragStartPosition.y) {
                this.previewBubbleDisplacement(gridPos.x, gridPos.y);
                
                // Check if displacement was successful
                const targetBubble = this.game.gameState.getBubbleAt(gridPos.x, gridPos.y);
                if (targetBubble && targetBubble !== this.draggedBubble) {
                    isValidDrop = this.displacedBubbles && this.displacedBubbles.length > 0;
                }
            } else {
                this.clearBubbleDisplacement();
            }
            
            this.showDropPreview(gridPos.x, gridPos.y, isValidDrop);
        } else {
            this.hideDropPreview();
            this.clearBubbleDisplacement();
        }
        
        // Move the dragged bubble with the mouse (with offset)
        this.draggedBubble.position.copy(dragPosition);
        this.draggedBubble.mesh.position.copy(dragPosition);
    }
    
    previewBubbleDisplacement(targetX, targetY) {
        // Clear any previous displacement
        this.clearBubbleDisplacement();
        
        // Get the bubble at the target position
        const targetBubble = this.game.gameState.getBubbleAt(targetX, targetY);
        if (!targetBubble || targetBubble === this.draggedBubble) return;
        
        // Find the best displacement direction
        const displacementDir = this.findBestDisplacementDirection(targetX, targetY);
        if (!displacementDir) return;
        
        // Find the chain of bubbles to displace
        const displaceChain = this.findDisplacementChain(targetX, targetY, displacementDir);
        
        // Temporarily move each bubble in the chain
        this.displacedBubbles = [];
        console.log(`Previewing displacement of ${displaceChain.length} bubbles in direction (${displacementDir.x},${displacementDir.y})`);
        
        for (let i = 0; i < displaceChain.length; i++) {
            const item = displaceChain[i];
            const newX = item.x + displacementDir.x;
            const newY = item.y + displacementDir.y;
            
            if (this.isValidDropPosition(newX, newY) && !this.game.gameState.getBubbleAt(newX, newY)) {
                // Store original position
                this.displacedBubbles.push({
                    bubble: item.bubble,
                    originalX: item.x,
                    originalY: item.y,
                    tempX: newX,
                    tempY: newY
                });
                
                // Temporarily move the bubble visually AND in game state
                this.game.gameState.setBubbleAt(item.x, item.y, null);
                this.game.gameState.setBubbleAt(newX, newY, item.bubble);
                item.bubble.setGridPosition(newX, newY);
                
                console.log(`Displaced bubble from (${item.x},${item.y}) to (${newX},${newY})`);
            } else {
                // Can't displace this bubble, stop the chain
                console.log(`Cannot displace bubble to (${newX},${newY}) - position invalid or occupied`);
                break;
            }
        }
    }
    
    findBestDisplacementDirection(targetX, targetY) {
        // Try all 6 hexagonal directions and pick the one with the most empty space
        const directions = [
            { x: 1, y: 0 },   // Right
            { x: -1, y: 0 },  // Left
            { x: 0, y: 1 },   // Down
            { x: 0, y: -1 },  // Up
            { x: 1, y: -1 },  // Up-right (for odd rows)
            { x: -1, y: -1 }  // Up-left (for odd rows)
        ];
        
        let bestDirection = null;
        let maxEmptySpaces = 0;
        
        for (const dir of directions) {
            const emptySpaces = this.countEmptySpacesInDirection(targetX, targetY, dir);
            if (emptySpaces > maxEmptySpaces) {
                maxEmptySpaces = emptySpaces;
                bestDirection = dir;
            }
        }
        
        return maxEmptySpaces > 0 ? bestDirection : null;
    }
    
    countEmptySpacesInDirection(startX, startY, direction) {
        let count = 0;
        let x = startX + direction.x;
        let y = startY + direction.y;
        
        while (this.isValidDropPosition(x, y) && !this.game.gameState.getBubbleAt(x, y)) {
            count++;
            x += direction.x;
            y += direction.y;
        }
        
        return count;
    }
    
    findDisplacementChain(startX, startY, direction) {
        const chain = [];
        let x = startX;
        let y = startY;
        
        while (this.isValidDropPosition(x, y)) {
            const bubble = this.game.gameState.getBubbleAt(x, y);
            if (!bubble || bubble === this.draggedBubble) break;
            
            chain.push({ bubble, x, y });
            
            x += direction.x;
            y += direction.y;
        }
        
        return chain;
    }
    
    clearBubbleDisplacement() {
        if (this.displacedBubbles) {
            // Restore all bubbles to their original positions in game state AND visually
            for (const item of this.displacedBubbles) {
                this.game.gameState.setBubbleAt(item.tempX, item.tempY, null);
                this.game.gameState.setBubbleAt(item.originalX, item.originalY, item.bubble);
                item.bubble.setGridPosition(item.originalX, item.originalY);
            }
            this.displacedBubbles = null;
        }
    }
    
    showDropPreview(x, y, isValidDrop = true) {
        if (!this.dropPreview) {
            // Create a preview mesh using the correct bubble radius
            const geometry = new THREE.IcosahedronGeometry(CONFIG.BUBBLE_RADIUS, 2);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.5,
                wireframe: false
            });
            this.dropPreview = new THREE.Mesh(geometry, material);
            
            // Add pulsing animation
            this.dropPreview.userData.time = 0;
            this.game.scene.add(this.dropPreview);
        }
        
        // Update color based on validity
        this.dropPreview.material.color.setHex(isValidDrop ? 0x00ff00 : 0xff0000);
        
        // Calculate world position using the same logic as the game
        const isOddRow = y % 2 === 1;
        const xPos = (x - CONFIG.GRID_WIDTH / 2 + 0.5) * CONFIG.HEX_WIDTH + (isOddRow ? CONFIG.HEX_WIDTH / 2 : 0);
        const yPos = CONFIG.GRID_TOP_Y - y * CONFIG.HEX_HEIGHT;
        
        this.dropPreview.position.set(xPos, yPos, 0.1); // Slightly in front
        this.dropPreview.visible = true;
        
        // Animate the preview
        if (!this.dropPreviewAnimation) {
            this.dropPreviewAnimation = () => {
                if (this.dropPreview && this.dropPreview.visible) {
                    this.dropPreview.userData.time += 0.05;
                    const scale = 1 + Math.sin(this.dropPreview.userData.time) * 0.1;
                    this.dropPreview.scale.setScalar(scale);
                }
            };
            this.game.gameManager.eventBus.on('update', this.dropPreviewAnimation);
        }
    }
    
    hideDropPreview() {
        if (this.dropPreview) {
            this.dropPreview.visible = false;
        }
        if (this.dropPreviewAnimation && this.game.gameManager) {
            this.game.gameManager.eventBus.off('update', this.dropPreviewAnimation);
            this.dropPreviewAnimation = null;
        }
    }
    
    onBubbleMouseUp() {
        if (!this.designMode) return;
        
        if (this.isDragging && this.draggedBubble) {
            // Get the nearest grid position based on current bubble position
            const gridPos = this.getNearestGridPosition(this.draggedBubble.position);
            
            if (gridPos && this.isValidDropPosition(gridPos.x, gridPos.y)) {
                // Check if we're dropping on the same position we started from
                if (gridPos.x === this.dragStartPosition.x && gridPos.y === this.dragStartPosition.y) {
                    // Just snap back to original position
                    this.commitBubblePlacement(this.draggedBubble, this.dragStartPosition.x, this.dragStartPosition.y);
                } else {
                    // Check if there's a bubble at the target position
                    const targetBubble = this.game.gameState.getBubbleAt(gridPos.x, gridPos.y);
                    if (targetBubble && targetBubble !== this.draggedBubble) {
                        // There's a bubble here, check if we have successful displacement
                        if (!this.displacedBubbles || this.displacedBubbles.length === 0) {
                            console.log('Cannot drop: target position occupied and no displacement possible');
                            this.cancelDrag();
                            this.finalizeDrag();
                            return;
                        }
                    }
                    
                    // Commit the displacement and place the bubble
                    this.commitBubblePlacement(this.draggedBubble, gridPos.x, gridPos.y);
                }
            } else {
                // Invalid position, snap back to original
                this.cancelDrag();
            }
        }
        
        // Clean up drag state
        this.finalizeDrag();
        
        // Validate grid integrity after drag operation
        this.validateAndFixGridPositions();
    }
    
    commitBubblePlacement(bubble, newX, newY) {
        // Clear the original position in the game state
        this.game.gameState.setBubbleAt(this.dragStartPosition.x, this.dragStartPosition.y, null);
        
        // Check if there's still a bubble at the target position that we need to handle
        const existingBubble = this.game.gameState.getBubbleAt(newX, newY);
        if (existingBubble && existingBubble !== bubble) {
            console.warn(`Warning: Found unexpected bubble at target position (${newX},${newY})`);
            
            // If we don't have displaced bubbles, this is an error state
            if (!this.displacedBubbles || this.displacedBubbles.length === 0) {
                console.error('Error: Cannot place bubble - target position occupied and no displacement occurred');
                // Restore the dragged bubble to its original position
                this.game.gameState.setBubbleAt(this.dragStartPosition.x, this.dragStartPosition.y, bubble);
                bubble.setGridPosition(this.dragStartPosition.x, this.dragStartPosition.y);
                return;
            }
        }
        
        // If there are displaced bubbles, commit their new positions first
        if (this.displacedBubbles) {
            console.log(`Committing displacement of ${this.displacedBubbles.length} bubbles`);
            
            for (const item of this.displacedBubbles) {
                console.log(`Bubble displaced from (${item.originalX},${item.originalY}) to (${item.tempX},${item.tempY})`);
                // The bubbles are already in their new positions from the preview
                // Just ensure they're properly set
                this.game.gameState.setBubbleAt(item.tempX, item.tempY, item.bubble);
                item.bubble.setGridPosition(item.tempX, item.tempY);
            }
            
            // Clear the displaced bubbles array without restoring them
            this.displacedBubbles = null;
        }
        
        // Place the dragged bubble at its final position
        this.game.gameState.setBubbleAt(newX, newY, bubble);
        bubble.setGridPosition(newX, newY);
        
        console.log(`Committed bubble placement at (${newX},${newY})`);
        
        // Update property panel if this bubble is selected
        if (this.selectedBubble === bubble) {
            this.updatePropertyPanel(bubble);
        }
    }
    
    cancelDrag() {
        // Restore the dragged bubble to its original position
        this.draggedBubble.setGridPosition(this.dragStartPosition.x, this.dragStartPosition.y);
        
        // Clear any displaced bubbles (this will restore them)
        this.clearBubbleDisplacement();
    }
    
    finalizeDrag() {
        // Only clear displacement preview if we haven't committed the displacement
        // (i.e., if this.displacedBubbles is still set, it means we need to restore)
        if (this.displacedBubbles) {
            this.clearBubbleDisplacement();
        }
        
        // Reset drag state
        this.isDragging = false;
        this.draggedBubble = null;
        this.dragStartPosition = null;
        this.dragOffset = null;
        
        // Hide drop preview
        this.hideDropPreview();
    }
    
    
    getBubbleAtMousePosition(event) {
        if (!this.game || !this.game.camera || !this.game.renderer) return null;
        
        const canvas = this.game.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        // Create raycaster for accurate 3D picking
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // Calculate mouse position in normalized device coordinates
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Set raycaster from camera
        raycaster.setFromCamera(mouse, this.game.camera);
        
        // Get all bubble meshes
        const bubbles = this.game.gameState.getAllBubbles();
        const meshes = bubbles.map(b => b.mesh).filter(m => m);
        
        // Find intersections
        const intersects = raycaster.intersectObjects(meshes, true);
        
        if (intersects.length > 0) {
            // Find the bubble that owns this mesh
            const hitMesh = intersects[0].object;
            for (const bubble of bubbles) {
                if (bubble.mesh === hitMesh || (bubble.mesh && bubble.mesh.children.includes(hitMesh))) {
                    return bubble;
                }
            }
        }
        
        return null;
    }
    
    getMouseWorldPosition(event) {
        if (!this.game || !this.game.camera || !this.game.renderer) {
            return new THREE.Vector3(0, 0, 0);
        }
        
        const canvas = this.game.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        // Create raycaster
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // Calculate mouse position
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Set raycaster
        raycaster.setFromCamera(mouse, this.game.camera);
        
        // Create a plane at z=0 for intersection
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersection = new THREE.Vector3();
        
        // Get intersection point
        raycaster.ray.intersectPlane(plane, intersection);
        
        return intersection;
    }
    
    selectBubble(bubble) {
        // Clear previous selection
        this.clearSelection();
        
        this.selectedBubble = bubble;
        this.highlightBubble(bubble);
        this.updatePropertyPanel(bubble);
    }
    
    clearSelection() {
        if (this.selectedBubble) {
            this.unhighlightBubble(this.selectedBubble);
            this.selectedBubble = null;
        }
        this.updatePropertyPanel(null);
    }
    
    highlightBubble(bubble) {
        // Add selection outline
        if (bubble.selectionOutline) return;
        
        const outlineGeometry = new THREE.IcosahedronGeometry(bubble.radius * 1.2, 2);
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        
        bubble.selectionOutline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        bubble.mesh.add(bubble.selectionOutline);
    }
    
    unhighlightBubble(bubble) {
        if (bubble.selectionOutline) {
            bubble.mesh.remove(bubble.selectionOutline);
            bubble.selectionOutline.geometry.dispose();
            bubble.selectionOutline.material.dispose();
            bubble.selectionOutline = null;
        }
    }
    
    updatePropertyPanel(bubble) {
        const content = document.getElementById('propertyContent');
        if (!content) return;
        
        if (!bubble) {
            content.innerHTML = '<p>Select a bubble to edit its properties</p>';
            return;
        }
        
        content.innerHTML = `
            <div class="property-group">
                <label>Grid Position:</label>
                <div class="grid-position">
                    <input type="number" id="gridX" value="${bubble.gridX}" min="0" max="15">
                    <input type="number" id="gridY" value="${bubble.gridY}" min="0" max="20">
                </div>
            </div>
            
            <div class="property-group">
                <label>Color:</label>
                <select id="bubbleColor">
                    ${this.generateColorOptions(bubble.color)}
                </select>
            </div>
            
            <div class="property-group">
                <label>Type:</label>
                <select id="bubbleType">
                    <option value="normal" ${!bubble.isPowerUp ? 'selected' : ''}>Normal</option>
                    <option value="rainbow" ${bubble.powerUpType === 'rainbow' ? 'selected' : ''}>Rainbow</option>
                    <option value="bomb" ${bubble.powerUpType === 'bomb' ? 'selected' : ''}>Bomb</option>
                    <option value="lightning" ${bubble.powerUpType === 'lightning' ? 'selected' : ''}>Lightning</option>
                    <option value="precision" ${bubble.powerUpType === 'precision' ? 'selected' : ''}>Precision</option>
                </select>
            </div>
            
            <div class="property-group">
                <button id="deleteBubble">Delete Bubble</button>
                <button id="duplicateBubble">Duplicate</button>
            </div>
        `;
        
        // Setup property change handlers
        this.setupPropertyHandlers(bubble);
    }
    
    setupPropertyHandlers(bubble) {
        const gridX = document.getElementById('gridX');
        const gridY = document.getElementById('gridY');
        const bubbleColor = document.getElementById('bubbleColor');
        const bubbleType = document.getElementById('bubbleType');
        const deleteBubble = document.getElementById('deleteBubble');
        const duplicateBubble = document.getElementById('duplicateBubble');
        
        if (gridX && gridY) {
            const updatePosition = () => {
                const x = parseInt(gridX.value);
                const y = parseInt(gridY.value);
                if (this.isValidDropPosition(x, y)) {
                    this.moveBubbleToGrid(bubble, x, y);
                }
            };
            
            gridX.addEventListener('change', updatePosition);
            gridY.addEventListener('change', updatePosition);
        }
        
        if (bubbleColor) {
            bubbleColor.addEventListener('change', (e) => {
                const colorHex = parseInt(e.target.value, 16);
                const color = new THREE.Color(colorHex);
                this.changeBubbleColor(bubble, color);
            });
        }
        
        if (bubbleType) {
            bubbleType.addEventListener('change', (e) => {
                this.changeBubbleType(bubble, e.target.value);
            });
        }
        
        if (deleteBubble) {
            deleteBubble.addEventListener('click', () => {
                this.deleteBubble(bubble);
            });
        }
        
        if (duplicateBubble) {
            duplicateBubble.addEventListener('click', () => {
                this.duplicateBubble(bubble);
            });
        }
    }
    
    colorToHex(color) {
        if (typeof color === 'number') {
            return '#' + color.toString(16).padStart(6, '0');
        } else if (color && typeof color.getHex === 'function') {
            return '#' + color.getHex().toString(16).padStart(6, '0');
        }
        return '#ffffff';
    }
    
    generateColorOptions(currentColor) {
        const colorNames = {
            0xFF0000: 'Red',
            0x0080FF: 'Sky Blue', 
            0xFFD700: 'Gold',
            0x00FF00: 'Green',
            0xFF1493: 'Pink',
            0x9400D3: 'Purple',
            0xFF8C00: 'Orange',
            0x00CED1: 'Turquoise'
        };
        
        let currentColorHex;
        if (typeof currentColor === 'number') {
            currentColorHex = currentColor;
        } else if (currentColor && typeof currentColor.getHex === 'function') {
            currentColorHex = currentColor.getHex();
        } else {
            currentColorHex = CONFIG.BUBBLE_COLORS[0];
        }
        
        let options = '';
        CONFIG.BUBBLE_COLORS.forEach(colorValue => {
            const colorName = colorNames[colorValue] || `Color ${colorValue.toString(16).toUpperCase()}`;
            const hexString = colorValue.toString(16).toUpperCase().padStart(6, '0');
            const isSelected = colorValue === currentColorHex ? 'selected' : '';
            options += `<option value="${hexString}" ${isSelected}>${colorName}</option>`;
        });
        
        return options;
    }
    
    handleCanvasDrop(event) {
        try {
            const data = JSON.parse(event.dataTransfer.getData('text/plain'));
            const mousePos = this.getMouseWorldPosition(event);
            const gridPos = this.getNearestGridPosition(mousePos);
            
            if (gridPos && this.isValidDropPosition(gridPos.x, gridPos.y)) {
                this.createBubbleAt(gridPos.x, gridPos.y, data.type, data.color);
            }
        } catch (e) {
            console.warn('Invalid drop data:', e);
        }
    }
    
    createBubbleAt(x, y, type, colorHex) {
        if (!this.game || !this.game.gameState) return;
        
        // Create bubble based on type
        let bubble;
        let colorValue; // Use the same format as CONFIG.BUBBLE_COLORS
        
        if (colorHex) {
            // Convert to hex number value (same format as CONFIG.BUBBLE_COLORS)
            if (typeof colorHex === 'string') {
                colorValue = parseInt(colorHex, 16);
            } else {
                colorValue = colorHex;
            }
        } else {
            // Get random valid color from CONFIG
            colorValue = CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)];
        }
        
        if (type === 'empty') {
            // Remove existing bubble at this position
            const existing = this.game.gameState.getBubbleAt(x, y);
            if (existing) {
                this.deleteBubble(existing);
            }
            return;
        }
        
        // Import Bubble class dynamically
        import('../entities/Bubble.js').then(({ Bubble }) => {
            // Create bubble with the hex number value (same as normal gameplay)
            bubble = new Bubble(0, 0, colorValue);
            
            console.log(`Created design mode bubble with color ${colorValue.toString(16)} at (${x},${y})`);
            
            if (type !== 'normal') {
                bubble.isPowerUp = true;
                bubble.powerUpType = type;
                // Apply power-up specific visual effects
                this.applyPowerUpEffects(bubble, type);
            }
            
            this.game.gameState.setBubbleAt(x, y, bubble);
            bubble.setGridPosition(x, y);
            
            // Add to scene
            if (this.game.scene) {
                this.game.scene.add(bubble.mesh);
            }
            
            // Emit bubbleCreated event for effects controller (same as normal gameplay)
            this.game.gameManager.eventBus.emit('bubbleCreated', bubble);
            
            // Trigger spring physics
            this.triggerSpringPhysicsAt(x, y);
        }).catch(error => {
            console.error('Failed to import Bubble class:', error);
        });
    }
    
    getRandomValidColor() {
        const randomIndex = Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length);
        return CONFIG.BUBBLE_COLORS[randomIndex]; // Return hex number, not THREE.Color
    }
    
    getRandomColor() {
        return CONFIG.BUBBLE_COLORS[Math.floor(Math.random() * CONFIG.BUBBLE_COLORS.length)]; // Return hex number, not THREE.Color
    }
    
    getNearestGridPosition(worldPos) {
        if (!this.game) return null;
        
        // Calculate row (y) position
        const y = Math.round((CONFIG.GRID_TOP_Y - worldPos.y) / CONFIG.HEX_HEIGHT);
        
        // Clamp y to valid range
        if (y < 0 || y >= CONFIG.GRID_HEIGHT) {
            return null;
        }
        
        const isOddRow = y % 2 === 1;
        
        // Calculate column (x) position
        let x = (worldPos.x + CONFIG.GRID_WIDTH / 2 * CONFIG.HEX_WIDTH - 0.5 * CONFIG.HEX_WIDTH) / CONFIG.HEX_WIDTH;
        if (isOddRow) {
            x -= 0.5;
        }
        x = Math.round(x);
        
        // Clamp x to valid range for this row
        const maxX = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
        if (x < 0 || x >= maxX) {
            return null;
        }
        
        return { x, y };
    }
    
    isValidDropPosition(x, y) {
        return this.game.gameState.isValidGridPosition(x, y);
    }
    
    moveBubbleToGrid(bubble, newX, newY) {
        if (!bubble || !this.game || !this.game.gameState) return;
        
        const oldX = bubble.gridX;
        const oldY = bubble.gridY;
        
        // If moving to the same position, just snap back
        if (oldX === newX && oldY === newY) {
            bubble.setGridPosition(newX, newY);
            return;
        }
        
        // Check if new position is occupied
        const existingBubble = this.game.gameState.getBubbleAt(newX, newY);
        
        // Remove bubble from old position
        if (oldX >= 0 && oldY >= 0) {
            this.game.gameState.setBubbleAt(oldX, oldY, null);
        }
        
        if (existingBubble && existingBubble !== bubble) {
            // Try to find an empty spot for the displaced bubble
            const emptySpot = this.findNearestEmptyPosition(newX, newY, oldX, oldY);
            
            if (emptySpot) {
                // Move existing bubble to empty spot
                existingBubble.setGridPosition(emptySpot.x, emptySpot.y);
                this.game.gameState.setBubbleAt(emptySpot.x, emptySpot.y, existingBubble);
                
                // Apply spring physics to show the displacement
                existingBubble.applyImpact(new THREE.Vector3(
                    (emptySpot.x - newX) * 0.2,
                    (emptySpot.y - newY) * 0.2,
                    0
                ));
            } else {
                // No empty spot found, swap positions
                this.game.gameState.setBubbleAt(oldX, oldY, existingBubble);
                existingBubble.setGridPosition(oldX, oldY);
                
                // Apply spring physics to show the swap
                existingBubble.applyImpact(new THREE.Vector3(
                    (oldX - newX) * 0.2,
                    (oldY - newY) * 0.2,
                    0
                ));
            }
        }
        
        // Move bubble to new position
        this.game.gameState.setBubbleAt(newX, newY, bubble);
        bubble.setGridPosition(newX, newY);
        
        // Update property panel if this bubble is selected
        if (this.selectedBubble === bubble) {
            this.updatePropertyPanel(bubble);
        }
    }
    
    findNearestEmptyPosition(centerX, centerY, excludeX, excludeY) {
        // Search in expanding rings for an empty position
        const maxRadius = 3;
        
        for (let radius = 1; radius <= maxRadius; radius++) {
            const positions = this.getPositionsAtRadius(centerX, centerY, radius);
            
            for (const pos of positions) {
                // Skip the excluded position (original position of dragged bubble)
                if (pos.x === excludeX && pos.y === excludeY) continue;
                
                if (this.isValidDropPosition(pos.x, pos.y) && !this.game.gameState.getBubbleAt(pos.x, pos.y)) {
                    return pos;
                }
            }
        }
        
        return null;
    }
    
    getPositionsAtRadius(centerX, centerY, radius) {
        const positions = [];
        const isOddRow = centerY % 2 === 1;
        
        // Generate positions in a hexagonal pattern
        for (let dy = -radius; dy <= radius; dy++) {
            const y = centerY + dy;
            if (y < 0 || y >= 20) continue; // Assuming max height of 20
            
            const rowIsOdd = y % 2 === 1;
            const xOffset = (rowIsOdd !== isOddRow) ? 0.5 : 0;
            
            for (let dx = -radius; dx <= radius; dx++) {
                const x = Math.floor(centerX + dx + xOffset);
                
                // Check if this position is at the correct radius (hexagonal distance)
                const hexDist = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dx + dy));
                if (hexDist === radius) {
                    positions.push({ x, y });
                }
            }
        }
        
        return positions;
    }
    
    changeBubbleColor(bubble, color) {
        // Ensure we store the color as a hex number (same format as CONFIG.BUBBLE_COLORS)
        let colorValue;
        if (typeof color === 'number') {
            colorValue = color;
        } else if (color && typeof color.getHex === 'function') {
            colorValue = color.getHex();
        } else {
            // Fallback to first valid color
            colorValue = CONFIG.BUBBLE_COLORS[0];
        }
        
        console.log(`Changing bubble color to ${colorValue.toString(16)}`);
        
        // Store the color as hex number (same as normal gameplay)
        bubble.color = colorValue;
        
        // Update visual appearance
        const threeColor = new THREE.Color(colorValue);
        bubble.material.color.copy(threeColor);
        bubble.material.emissive.copy(threeColor).multiplyScalar(0.2);
        
        if (bubble.glowMesh) {
            bubble.glowMesh.material.color.copy(threeColor);
        }
    }
    
    changeBubbleType(bubble, type) {
        bubble.isPowerUp = type !== 'normal';
        bubble.powerUpType = type !== 'normal' ? type : null;
        
        // Apply visual effects based on type
        this.applyPowerUpEffects(bubble, type);
    }
    
    applyPowerUpEffects(bubble, type) {
        // Remove existing power-up effects
        this.removePowerUpEffects(bubble);
        
        switch (type) {
            case 'rainbow':
                // Add rainbow shimmer effect
                bubble.material.iridescence = 1.0;
                bubble.material.iridescenceIOR = 1.5;
                break;
            case 'bomb':
                // Add pulsing red glow
                bubble.material.emissiveIntensity = 0.5;
                break;
            case 'lightning':
                // Add electric effects
                bubble.material.emissive.setHex(0xffff00);
                bubble.material.emissiveIntensity = 0.3;
                break;
            case 'precision':
                // Add cyan glow
                bubble.material.emissive.setHex(0x00ffff);
                bubble.material.emissiveIntensity = 0.3;
                break;
        }
    }
    
    removePowerUpEffects(bubble) {
        bubble.material.iridescence = 0;
        bubble.material.emissiveIntensity = 0.2;
    }
    
    deleteBubble(bubble) {
        // Remove from grid
        if (bubble.gridX >= 0 && bubble.gridY >= 0) {
            this.game.gameState.setBubbleAt(bubble.gridX, bubble.gridY, null);
        }
        
        // Remove from scene
        if (bubble.mesh && bubble.mesh.parent) {
            bubble.mesh.parent.remove(bubble.mesh);
        }
        
        // Clear selection if this was selected
        if (this.selectedBubble === bubble) {
            this.clearSelection();
        }
        
        // Dispose bubble
        bubble.destroy();
        
        // Trigger spring physics
        this.triggerSpringPhysicsAt(bubble.gridX, bubble.gridY);
    }
    
    duplicateBubble(bubble) {
        // Find nearest empty position
        const neighbors = this.getEmptyNeighbors(bubble.gridX, bubble.gridY);
        if (neighbors.length > 0) {
            const pos = neighbors[0];
            // Ensure we pass the color as a hex string for createBubbleAt
            const colorHex = bubble.color.toString(16).toUpperCase().padStart(6, '0');
            this.createBubbleAt(pos.x, pos.y, bubble.isPowerUp ? bubble.powerUpType : 'normal', colorHex);
        }
    }
    
    getEmptyNeighbors(x, y) {
        const neighbors = [];
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
        
        for (const [dx, dy] of offsets) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (this.isValidDropPosition(nx, ny) && !this.game.gameState.getBubbleAt(nx, ny)) {
                neighbors.push({ x: nx, y: ny });
            }
        }
        
        return neighbors;
    }
    
    startSpringPhysics() {
        this.springPhysics.enabled = true;
    }
    
    stopSpringPhysics() {
        this.springPhysics.enabled = false;
        this.springPhysics.animatingBubbles.clear();
    }
    
    updateSpringPhysics() {
        if (!this.springPhysics.enabled || !this.draggedBubble) return;
        
        const draggedPos = this.draggedBubble.position;
        const bubbles = this.game.gameState.getAllBubbles();
        
        bubbles.forEach(bubble => {
            if (bubble === this.draggedBubble) return;
            
            const distance = bubble.position.distanceTo(draggedPos);
            const influence = Math.max(0, 3.0 - distance); // 3 unit influence radius
            
            if (influence > 0) {
                const direction = new THREE.Vector3().subVectors(bubble.position, draggedPos).normalize();
                const force = direction.multiplyScalar(influence * 0.1);
                
                if (!this.springPhysics.animatingBubbles.has(bubble.id)) {
                    this.springPhysics.animatingBubbles.set(bubble.id, {
                        bubble: bubble,
                        originalPosition: bubble.position.clone(),
                        velocity: new THREE.Vector3()
                    });
                }
                
                const anim = this.springPhysics.animatingBubbles.get(bubble.id);
                anim.velocity.add(force);
            }
        });
        
        // Update animations
        this.springPhysics.animatingBubbles.forEach((anim, id) => {
            const restoreForce = new THREE.Vector3()
                .subVectors(anim.originalPosition, anim.bubble.position)
                .multiplyScalar(this.springPhysics.springConstant);
            
            anim.velocity.add(restoreForce).multiplyScalar(this.springPhysics.dampening);
            anim.bubble.position.add(anim.velocity.clone().multiplyScalar(0.016)); // 60fps delta
            anim.bubble.mesh.position.copy(anim.bubble.position);
            
            if (anim.velocity.length() < this.springPhysics.restThreshold) {
                anim.bubble.position.copy(anim.originalPosition);
                anim.bubble.mesh.position.copy(anim.originalPosition);
                this.springPhysics.animatingBubbles.delete(id);
            }
        });
    }
    
    triggerSpringPhysicsAt(x, y) {
        // Add satisfying animation when bubbles are added/removed
        const neighbors = this.game.gameState.getAllBubbles().filter(bubble => {
            const dx = Math.abs(bubble.gridX - x);
            const dy = Math.abs(bubble.gridY - y);
            return dx <= 2 && dy <= 2;
        });
        
        neighbors.forEach(bubble => {
            bubble.applyImpact(new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                0
            ));
        });
    }
    
    captureLevelData() {
        const bubbles = this.game.gameState.getAllBubbles();
        this.levelData = {
            bubbles: bubbles.map(bubble => ({
                x: bubble.gridX,
                y: bubble.gridY,
                color: typeof bubble.color === 'number' ? bubble.color : bubble.color.getHex(),
                type: bubble.isPowerUp ? bubble.powerUpType : 'normal'
            }))
        };
    }
    
    saveCurrentLevel() {
        this.captureLevelData();
        
        const levelNameInput = document.getElementById('levelNameInput');
        const levelName = levelNameInput ? levelNameInput.value.trim() : '';
        
        if (!levelName) {
            this.showNotification('Please enter a level name', 'warning');
            return;
        }
        
        const levelData = {
            name: levelName,
            timestamp: new Date().toISOString(),
            version: '1.0',
            ...this.levelData
        };
        
        // Create download
        const blob = new Blob([JSON.stringify(levelData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${levelName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(`Level "${levelName}" saved successfully!`);
    }
    
    clearGrid() {
        if (!confirm('Are you sure you want to clear the entire grid?')) {
            return;
        }
        
        const bubbles = this.game.gameState.getAllBubbles();
        bubbles.forEach(bubble => this.deleteBubble(bubble));
        
        this.showNotification('Grid cleared');
    }
    
    loadLevelFromFile(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const levelData = JSON.parse(e.target.result);
                this.loadLevelData(levelData);
                this.showNotification(`Level "${levelData.name || 'Unknown'}" loaded successfully!`);
            } catch (error) {
                console.error('Error loading level:', error);
                this.showNotification('Error loading level file', 'warning');
            }
        };
        reader.readAsText(file);
    }
    
    loadLevelData(levelData) {
        if (!levelData.bubbles) {
            this.showNotification('Invalid level data format', 'warning');
            return;
        }
        
        // Clear existing grid
        this.clearGrid();
        
        // Load bubbles from level data
        levelData.bubbles.forEach(bubbleData => {
            if (bubbleData.x >= 0 && bubbleData.y >= 0) {
                // Use setTimeout to ensure bubbles are created after grid is cleared
            setTimeout(() => {
                this.createBubbleAt(
                    bubbleData.x,
                    bubbleData.y,
                    bubbleData.type || 'normal',
                    bubbleData.color ? `0x${bubbleData.color.toString(16).padStart(6, '0')}` : null
                );
            }, 10);
            }
        });
        
        // Update level name input if available
        const levelNameInput = document.getElementById('levelNameInput');
        if (levelNameInput && levelData.name) {
            levelNameInput.value = levelData.name;
        }
        
        // Update our level data
        this.levelData = levelData;
    }
    
    validateAndFixGridPositions() {
        if (!this.game || !this.game.gameState) return;
        
        console.log('=== Validating Grid Positions ===');
        
        // Get all bubbles
        const bubbles = this.game.gameState.getAllBubbles();
        const occupiedPositions = new Map();
        const conflictingBubbles = [];
        
        // First pass: identify conflicts
        for (const bubble of bubbles) {
            const key = `${bubble.gridX},${bubble.gridY}`;
            
            if (occupiedPositions.has(key)) {
                // Conflict detected
                console.error(`Conflict detected at (${bubble.gridX},${bubble.gridY})`);
                conflictingBubbles.push(bubble);
            } else {
                occupiedPositions.set(key, bubble);
            }
            
            // Validate bubble is in game state at its position
            const stateAtPosition = this.game.gameState.getBubbleAt(bubble.gridX, bubble.gridY);
            if (stateAtPosition !== bubble) {
                console.error(`Bubble mismatch at (${bubble.gridX},${bubble.gridY}): bubble thinks it's there but state has different bubble`);
            }
        }
        
        // Second pass: resolve conflicts
        for (const bubble of conflictingBubbles) {
            const emptySpot = this.findNearestEmptyPosition(bubble.gridX, bubble.gridY, -1, -1);
            
            if (emptySpot) {
                // Move to empty spot
                console.log(`Moving conflicting bubble from (${bubble.gridX},${bubble.gridY}) to (${emptySpot.x},${emptySpot.y})`);
                this.game.gameState.setBubbleAt(bubble.gridX, bubble.gridY, null);
                bubble.setGridPosition(emptySpot.x, emptySpot.y);
                this.game.gameState.setBubbleAt(emptySpot.x, emptySpot.y, bubble);
                
                // Add visual feedback
                bubble.applyImpact(new THREE.Vector3(
                    Math.random() * 0.2 - 0.1,
                    Math.random() * 0.2 - 0.1,
                    0
                ));
            } else {
                // No empty spot found, remove the bubble
                console.warn(`Could not find empty spot for conflicting bubble at (${bubble.gridX},${bubble.gridY}), removing it`);
                this.deleteBubble(bubble);
            }
        }
        
        // Third pass: ensure all bubbles are properly positioned
        const remainingBubbles = this.game.gameState.getAllBubbles();
        for (const bubble of remainingBubbles) {
            // Ensure bubble is at its grid position
            bubble.setGridPosition(bubble.gridX, bubble.gridY);
        }
        
        console.log(`=== Validation Complete: ${conflictingBubbles.length} conflicts resolved ===`);
    }
    
    createHexGridOverlay() {
        if (this.hexGridGroup) return;
        
        this.hexGridGroup = new THREE.Group();
        
        console.log('Creating grid with CONFIG:', {
            BUBBLE_RADIUS: CONFIG.BUBBLE_RADIUS,
            GRID_WIDTH: CONFIG.GRID_WIDTH,
            HEX_WIDTH: CONFIG.HEX_WIDTH,
            HEX_HEIGHT: CONFIG.HEX_HEIGHT,
            GRID_TOP_Y: CONFIG.GRID_TOP_Y
        });
        
        // Create a single circle geometry that we'll reuse
        const circleGeometry = new THREE.BufferGeometry();
        const circleVertices = [];
        const numSegments = 32;
        
        // Create circle vertices using the actual bubble radius from CONFIG
        for (let i = 0; i <= numSegments; i++) {
            const angle = (i / numSegments) * Math.PI * 2;
            circleVertices.push(
                Math.cos(angle) * CONFIG.BUBBLE_RADIUS,
                Math.sin(angle) * CONFIG.BUBBLE_RADIUS,
                0
            );
        }
        
        circleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(circleVertices, 3));
        
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.4,
            depthTest: false,
            depthWrite: false
        });
        
        // Create grid using the same positioning logic as the game
        for (let y = 0; y < CONFIG.GRID_HEIGHT; y++) {
            const isOddRow = y % 2 === 1;
            const bubblesInRow = isOddRow ? CONFIG.GRID_WIDTH - 1 : CONFIG.GRID_WIDTH;
            
            for (let x = 0; x < bubblesInRow; x++) {
                // Use the exact same positioning logic as Bubble.setGridPosition
                const xPos = (x - CONFIG.GRID_WIDTH / 2 + 0.5) * CONFIG.HEX_WIDTH + (isOddRow ? CONFIG.HEX_WIDTH / 2 : 0);
                const yPos = CONFIG.GRID_TOP_Y - y * CONFIG.HEX_HEIGHT;
                
                const circleMesh = new THREE.LineLoop(circleGeometry, material);
                circleMesh.position.set(xPos, yPos, -0.1); // Slightly behind bubbles
                this.hexGridGroup.add(circleMesh);
            }
        }
        
        this.game.scene.add(this.hexGridGroup);
    }
    
    removeHexGridOverlay() {
        if (this.hexGridGroup) {
            // Remove all children and dispose geometries/materials
            while (this.hexGridGroup.children.length > 0) {
                const child = this.hexGridGroup.children[0];
                this.hexGridGroup.remove(child);
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
            
            this.game.scene.remove(this.hexGridGroup);
            this.hexGridGroup = null;
        }
    }
    
    removeDesignModeOverlay() {
        if (this.designModeOverlay) {
            this.designModeOverlay.remove();
            this.designModeOverlay = null;
        }
        
        if (this.bubblePalette) {
            this.bubblePalette.remove();
            this.bubblePalette = null;
        }
        
        if (this.propertyPanel) {
            this.propertyPanel.remove();
            this.propertyPanel = null;
        }
    }
}

// Create singleton instance
export const developerPanel = new DeveloperPanel();

// Import Three.js for type references
if (typeof window !== 'undefined') {
    window.THREE = window.THREE || {};
}