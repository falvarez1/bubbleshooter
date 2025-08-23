import * as THREE from 'three';

/**
 * BloomDebugger - Utility to debug and visualize bloom settings
 */
export class BloomDebugger {
    constructor(postProcessingManager) {
        this.postProcessing = postProcessingManager;
        this.debugInfo = {
            bloomObjectCount: 0,
            bloomPass: null,
            settings: {}
        };
        
        // Create debug UI
        this.createDebugUI();
    }
    
    createDebugUI() {
        // Create debug panel
        const panel = document.createElement('div');
        panel.id = 'bloom-debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10001;
            min-width: 250px;
            border: 1px solid #00ffff;
            display: none;
            pointer-events: auto;
        `;
        
        panel.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #00ffff;">Bloom Debug</h3>
            <div id="bloom-info"></div>
            <div style="margin-top: 10px;">
                <label>Strength: <span id="bloom-strength">2.0</span></label><br>
                <input type="range" id="bloom-strength-slider" min="0" max="5" step="0.1" value="2.0" style="width: 100%;">
            </div>
            <div style="margin-top: 5px;">
                <label>Radius: <span id="bloom-radius">0.8</span></label><br>
                <input type="range" id="bloom-radius-slider" min="0" max="2" step="0.05" value="0.8" style="width: 100%;">
            </div>
            <div style="margin-top: 5px;">
                <label>Threshold: <span id="bloom-threshold">0.0</span></label><br>
                <input type="range" id="bloom-threshold-slider" min="0" max="1" step="0.05" value="0.0" style="width: 100%;">
            </div>
            <div style="margin-top: 10px; border-top: 1px solid #00ffff; padding-top: 10px;">
                <h4 style="margin: 0 0 5px 0; color: #00ffff; font-size: 12px;">Bloom Categories</h4>
                <div style="font-size: 11px;">
                    <label style="display: block; margin: 3px 0;">
                        <input type="checkbox" id="bloom-cat-trajectoryLine"> Trajectory Line
                    </label>
                    <label style="display: block; margin: 3px 0;">
                        <input type="checkbox" id="bloom-cat-trajectoryGlow"> Trajectory Glow
                    </label>
                    <label style="display: block; margin: 3px 0;">
                        <input type="checkbox" id="bloom-cat-impactIndicator"> Impact Indicator
                    </label>
                    <label style="display: block; margin: 3px 0;">
                        <input type="checkbox" id="bloom-cat-impactRing"> Impact Ring
                    </label>
                    <label style="display: block; margin: 3px 0;">
                        <input type="checkbox" id="bloom-cat-collisionParticles"> Collision Particles
                    </label>
                    <label style="display: block; margin: 3px 0;">
                        <input type="checkbox" id="bloom-cat-explosionParticles"> Explosion Particles
                    </label>
                    <label style="display: block; margin: 3px 0;">
                        <input type="checkbox" id="bloom-cat-powerUpEffects"> Power-Up Effects
                    </label>
                    <label style="display: block; margin: 3px 0;">
                        <input type="checkbox" id="bloom-cat-wallImpact"> Wall Impact
                    </label>
                    <label style="display: block; margin: 3px 0;">
                        <input type="checkbox" id="bloom-cat-shootingParticles"> Shooting Particles
                    </label>
                </div>
            </div>
            <div style="margin-top: 10px;">
                <button id="toggle-bloom" style="padding: 5px 10px; background: #00ffff; color: black; border: none; cursor: pointer;">Toggle Bloom</button>
                <button id="refresh-bloom" style="padding: 5px 10px; background: #ff9900; color: black; border: none; cursor: pointer; margin-left: 5px;">Refresh</button>
                <button id="log-bloom-objects" style="padding: 5px 10px; background: #00ff00; color: black; border: none; cursor: pointer; margin-left: 5px;">Log</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Add event listeners
        this.setupEventListeners();
        
        // Start update loop
        this.startUpdateLoop();
    }
    
    setupEventListeners() {
        // Strength slider
        const strengthSlider = document.getElementById('bloom-strength-slider');
        const strengthLabel = document.getElementById('bloom-strength');
        strengthSlider?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            strengthLabel.textContent = value.toFixed(1);
            this.postProcessing.updateSettings({ bloomIntensity: value });
        });
        
        // Radius slider
        const radiusSlider = document.getElementById('bloom-radius-slider');
        const radiusLabel = document.getElementById('bloom-radius');
        radiusSlider?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            radiusLabel.textContent = value.toFixed(2);
            this.postProcessing.updateSettings({ bloomRadius: value });
        });
        
        // Threshold slider
        const thresholdSlider = document.getElementById('bloom-threshold-slider');
        const thresholdLabel = document.getElementById('bloom-threshold');
        thresholdSlider?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            thresholdLabel.textContent = value.toFixed(2);
            this.postProcessing.updateSettings({ bloomThreshold: value });
        });
        
        // Toggle bloom button
        document.getElementById('toggle-bloom')?.addEventListener('click', () => {
            this.postProcessing.setEnabled(!this.postProcessing.enabled);
            console.log('Bloom enabled:', this.postProcessing.enabled);
        });
        
        // Refresh bloom button
        document.getElementById('refresh-bloom')?.addEventListener('click', () => {
            if (this.postProcessing.refreshBloomState) {
                this.postProcessing.refreshBloomState();
                console.log('Bloom state refreshed');
            }
            
            // Log current state
            const states = this.postProcessing.getCategoryStates();
            console.log('Current bloom state after refresh:', {
                enabled: this.postProcessing.enabled,
                totalObjects: this.postProcessing.bloomObjects.size,
                categories: states
            });
        });
        
        // Category checkboxes
        const categories = ['trajectoryLine', 'trajectoryGlow', 'impactIndicator', 'impactRing', 
                          'collisionParticles', 'explosionParticles', 'powerUpEffects', 
                          'wallImpact', 'shootingParticles'];
        categories.forEach(cat => {
            const checkbox = document.getElementById(`bloom-cat-${cat}`);
            if (checkbox) {
                // Set initial state from post-processing manager (which comes from CONFIG)
                const isEnabled = this.postProcessing.categoryEnabled?.[cat] ?? false;
                checkbox.checked = isEnabled;
                
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    const enabled = e.target.checked;
                    this.postProcessing.setCategoryEnabled(cat, enabled);
                    console.log(`Bloom category '${cat}': ${enabled ? 'enabled' : 'disabled'}`);
                    
                    // Force update display
                    const states = this.postProcessing.getCategoryStates();
                    console.log('Current category states:', states);
                });
            }
        });
        
        // Log initial state
        console.log('Initial bloom categories:', this.postProcessing.getCategoryStates());
        
        // Log bloom objects button
        document.getElementById('log-bloom-objects')?.addEventListener('click', () => {
            console.log('=== BLOOM OBJECTS DETAILED LOG ===');
            console.log('Total bloom objects:', this.postProcessing.bloomObjects.size);
            
            // Log by categories
            const categories = this.postProcessing.bloomCategories;
            Object.keys(categories).forEach(cat => {
                const objects = Array.from(categories[cat]);
                console.log(`\nCategory: ${cat} (${this.postProcessing.categoryEnabled[cat] ? 'ENABLED' : 'DISABLED'})`);
                console.log(`  Objects in category: ${objects.length}`);
                objects.forEach(obj => {
                    const inBloomSet = this.postProcessing.bloomObjects.has(obj);
                    console.log(`  - ${obj.name || 'unnamed'}: ${inBloomSet ? 'BLOOMING' : 'NOT BLOOMING'}`, {
                        category: obj.userData.bloomCategory,
                        layers: obj.layers.mask.toString(2),
                        visible: obj.visible
                    });
                });
            });
            
            // Check for uncategorized bloom objects
            console.log('\n=== UNCATEGORIZED BLOOM OBJECTS ===');
            this.postProcessing.bloomObjects.forEach(obj => {
                let foundInCategory = false;
                Object.values(categories).forEach(catSet => {
                    if (catSet.has(obj)) foundInCategory = true;
                });
                if (!foundInCategory) {
                    console.log('UNCATEGORIZED:', obj.name || 'unnamed', {
                        layers: obj.layers.mask.toString(2),
                        material: obj.material?.type,
                        userData: obj.userData
                    });
                }
            });
        });
    }
    
    startUpdateLoop() {
        const updateInfo = () => {
            const info = document.getElementById('bloom-info');
            if (info && this.postProcessing) {
                const bloomPass = this.postProcessing.bloomPass;
                // Get category states
                const categoryStates = this.postProcessing.getCategoryStates ? this.postProcessing.getCategoryStates() : {};
                
                info.innerHTML = `
                    <div>Total Objects: ${this.postProcessing.bloomObjects.size}</div>
                    <div>Bloom: ${this.postProcessing.enabled !== false ? 'ON' : 'OFF'}</div>
                    <div style="margin-top: 5px; font-size: 10px;">
                        <div>TrajLine: ${categoryStates.trajectoryLine?.count || 0} ${categoryStates.trajectoryLine?.enabled ? '✓' : '✗'}</div>
                        <div>TrajGlow: ${categoryStates.trajectoryGlow?.count || 0} ${categoryStates.trajectoryGlow?.enabled ? '✓' : '✗'}</div>
                        <div>Impact: ${categoryStates.impactIndicator?.count || 0} ${categoryStates.impactIndicator?.enabled ? '✓' : '✗'}</div>
                        <div>Ring: ${categoryStates.impactRing?.count || 0} ${categoryStates.impactRing?.enabled ? '✓' : '✗'}</div>
                        <div>CollPart: ${categoryStates.collisionParticles?.count || 0} ${categoryStates.collisionParticles?.enabled ? '✓' : '✗'}</div>
                        <div>ExplPart: ${categoryStates.explosionParticles?.count || 0} ${categoryStates.explosionParticles?.enabled ? '✓' : '✗'}</div>
                        <div>PowerUps: ${categoryStates.powerUpEffects?.count || 0} ${categoryStates.powerUpEffects?.enabled ? '✓' : '✗'}</div>
                        <div>Wall: ${categoryStates.wallImpact?.count || 0} ${categoryStates.wallImpact?.enabled ? '✓' : '✗'}</div>
                        <div>Shoot: ${categoryStates.shootingParticles?.count || 0} ${categoryStates.shootingParticles?.enabled ? '✓' : '✗'}</div>
                    </div>
                `;
            }
            requestAnimationFrame(updateInfo);
        };
        updateInfo();
    }
    
    addTestBloomObject(scene) {
        // Create a test object with strong emission
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 3.0,
            toneMapped: false
        });
        
        const testObject = new THREE.Mesh(geometry, material);
        testObject.position.set(0, 5, 0);
        testObject.name = 'BloomTestObject';
        
        scene.add(testObject);
        this.postProcessing.addBloomObject(testObject);
        
        console.log('Test bloom object added at position (0, 5, 0)');
        return testObject;
    }
    
    dispose() {
        const panel = document.getElementById('bloom-debug-panel');
        if (panel) {
            panel.remove();
        }
    }
}

// Export as global for easy console access
if (typeof window !== 'undefined') {
    window.BloomDebugger = BloomDebugger;
}