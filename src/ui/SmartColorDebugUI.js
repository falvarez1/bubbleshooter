/**
 * Smart Color Debug UI
 * Visual overlay showing accessibility scores for debugging
 */
export class SmartColorDebugUI {
    constructor(smartColorSystem) {
        this.smartColorSystem = smartColorSystem;
        this.enabled = false;
        this.container = null;
        
        this.createUI();
        this.setupKeyboardShortcut();
    }
    
    createUI() {
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'smart-color-debug';
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #00ffcc;
            border-radius: 10px;
            padding: 15px;
            font-family: 'Orbitron', monospace;
            color: #fff;
            font-size: 12px;
            z-index: 10000;
            display: none;
            min-width: 250px;
        `;
        
        // Create content
        this.container.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #00ffcc; font-size: 14px;">
                Smart Color Selection
            </h3>
            <div id="smartColorMode" style="margin: 5px 0;">Mode: -</div>
            <div id="smartColorHelper" style="margin: 5px 0;">Helper Chance: -</div>
            <div id="smartColorStats" style="margin: 5px 0;">Stats: -</div>
            <hr style="border: 1px solid #00ffcc; margin: 10px 0;">
            <div style="margin: 5px 0; font-size: 11px;">
                <strong>Color Priorities:</strong>
            </div>
            <div id="colorPriorities" style="margin: 5px 0;"></div>
            <hr style="border: 1px solid #00ffcc; margin: 10px 0;">
            <div style="margin: 5px 0; font-size: 10px; opacity: 0.7;">
                Press 'C' to toggle this display
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Store element references
        this.modeElement = document.getElementById('smartColorMode');
        this.helperElement = document.getElementById('smartColorHelper');
        this.statsElement = document.getElementById('smartColorStats');
        this.prioritiesElement = document.getElementById('colorPriorities');
    }
    
    setupKeyboardShortcut() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'c' || e.key === 'C') {
                this.toggle();
            }
        });
    }
    
    toggle() {
        this.enabled = !this.enabled;
        this.container.style.display = this.enabled ? 'block' : 'none';
        
        if (this.enabled) {
            this.startUpdating();
        } else {
            this.stopUpdating();
        }
    }
    
    startUpdating() {
        this.updateInterval = setInterval(() => this.update(), 500);
        this.update(); // Initial update
    }
    
    stopUpdating() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    update() {
        if (!this.enabled) return;
        
        // Get statistics
        const stats = this.smartColorSystem.getStatistics();
        
        // Update mode
        this.modeElement.textContent = `Mode: ${stats.mode}`;
        
        // Update helper chance
        const helperProb = this.smartColorSystem.getCurrentHelperProbability();
        this.helperElement.innerHTML = `Helper Chance: <span style="color: ${this.getColorForProbability(helperProb)}">${(helperProb * 100).toFixed(0)}%</span>`;
        
        // Update stats
        this.statsElement.innerHTML = `
            Helpful: <span style="color: #00ff88">${stats.helpfulSelections}</span> / 
            Total: ${stats.totalSelections} 
            (<span style="color: #00ffcc">${stats.helpfulPercentage}%</span>)
        `;
        
        // Update color priorities
        this.updateColorPriorities();
    }
    
    updateColorPriorities() {
        // Force accessibility analysis
        this.smartColorSystem.analyzeAccessibility();
        
        // Get color scores
        const colorScores = this.smartColorSystem.colorAccessibilityScores;
        
        if (!colorScores || colorScores.size === 0) {
            this.prioritiesElement.innerHTML = '<span style="opacity: 0.5;">No bubbles on board</span>';
            return;
        }
        
        // Sort colors by score
        const sortedColors = Array.from(colorScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Show top 5
        
        // Create visual representation
        let html = '';
        sortedColors.forEach(([color, score]) => {
            const percentage = (score * 100).toFixed(1);
            const barWidth = Math.max(10, score * 150);
            const colorHex = '#' + color.toString(16).padStart(6, '0');
            
            html += `
                <div style="margin: 3px 0; display: flex; align-items: center;">
                    <div style="
                        width: 20px;
                        height: 20px;
                        background: ${colorHex};
                        border: 1px solid #fff;
                        border-radius: 50%;
                        margin-right: 8px;
                    "></div>
                    <div style="flex: 1;">
                        <div style="
                            background: linear-gradient(90deg, ${colorHex}, transparent);
                            height: 15px;
                            width: ${barWidth}px;
                            border-radius: 3px;
                            position: relative;
                        ">
                            <span style="
                                position: absolute;
                                left: 5px;
                                top: 0;
                                line-height: 15px;
                                font-size: 10px;
                                color: #fff;
                                text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
                            ">${percentage}%</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        this.prioritiesElement.innerHTML = html;
    }
    
    getColorForProbability(probability) {
        // Green for high probability, red for low
        if (probability >= 0.6) return '#00ff88';
        if (probability >= 0.4) return '#ffcc00';
        if (probability >= 0.2) return '#ff8800';
        return '#ff3333';
    }
    
    destroy() {
        this.stopUpdating();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}