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
            <div style="margin-top: 10px;">
                <button id="toggle-bloom" style="padding: 5px 10px; background: #00ffff; color: black; border: none; cursor: pointer;">Toggle Bloom</button>
                <button id="log-bloom-objects" style="padding: 5px 10px; background: #00ff00; color: black; border: none; cursor: pointer; margin-left: 5px;">Log Objects</button>
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
        
        // Log bloom objects button
        document.getElementById('log-bloom-objects')?.addEventListener('click', () => {
            console.log('Bloom Objects:', Array.from(this.postProcessing.bloomObjects));
            console.log('Bloom Object Count:', this.postProcessing.bloomObjects.size);
            
            // Log details about each bloom object
            this.postProcessing.bloomObjects.forEach(obj => {
                console.log('Object:', obj.name || 'unnamed', {
                    visible: obj.visible,
                    layers: obj.layers.mask.toString(2),
                    material: obj.material,
                    emissive: obj.material?.emissive,
                    emissiveIntensity: obj.material?.emissiveIntensity
                });
            });
        });
    }
    
    startUpdateLoop() {
        const updateInfo = () => {
            const info = document.getElementById('bloom-info');
            if (info && this.postProcessing) {
                const bloomPass = this.postProcessing.bloomPass;
                info.innerHTML = `
                    <div>Objects: ${this.postProcessing.bloomObjects.size}</div>
                    <div>Enabled: ${this.postProcessing.enabled !== false ? 'Yes' : 'No'}</div>
                    <div>Pass Strength: ${bloomPass?.strength || 'N/A'}</div>
                    <div>Pass Radius: ${bloomPass?.radius || 'N/A'}</div>
                    <div>Pass Threshold: ${bloomPass?.threshold || 'N/A'}</div>
                    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #444;">
                        <div style="color: #00ff00;">Bloom Active: ${this.postProcessing.bloomObjects.size > 0 ? 'YES' : 'NO'}</div>
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