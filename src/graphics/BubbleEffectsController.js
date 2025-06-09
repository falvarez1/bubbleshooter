import { settingsStorage } from '../core/SettingsStorage.js';
import * as THREE from 'three';

/**
 * Bubble Effects Controller
 * Manages visual effects for individual bubble materials
 */
export class BubbleEffectsController {
    constructor() {
        this.initialized = false;
        this.eventBus = null;
        this.currentEffects = {
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.5,
            thickness: 0.5,
            clearcoat: 1.0,
            clearcoatRoughness: 0.0,
            envMapIntensity: 1.5,
            ior: 1.5,
            reflectivity: 0.8,
            emissiveIntensity: 0.2,
            sheen: 1.0,
            sheenRoughness: 0.3
        };
        
        this.effectPresets = {
            low: {
                metalness: 0.0,
                roughness: 0.8,
                transmission: 0.0,
                thickness: 0.0,
                clearcoat: 0.0,
                clearcoatRoughness: 0.0,
                envMapIntensity: 0.5,
                ior: 1.33,
                reflectivity: 0.2,
                emissiveIntensity: 0.0,
                sheen: 0.0,
                sheenRoughness: 0.0
            },
            medium: {
                metalness: 0.1,
                roughness: 0.3,
                transmission: 0.3,
                thickness: 0.3,
                clearcoat: 0.5,
                clearcoatRoughness: 0.1,
                envMapIntensity: 1.0,
                ior: 1.45,
                reflectivity: 0.5,
                emissiveIntensity: 0.1,
                sheen: 0.5,
                sheenRoughness: 0.2
            },
            high: {
                metalness: 0.1,
                roughness: 0.1,
                transmission: 0.5,
                thickness: 0.5,
                clearcoat: 1.0,
                clearcoatRoughness: 0.0,
                envMapIntensity: 1.5,
                ior: 1.5,
                reflectivity: 0.8,
                emissiveIntensity: 0.2,
                sheen: 1.0,
                sheenRoughness: 0.3
            },
            ultra: {
                metalness: 0.2,
                roughness: 0.05,
                transmission: 0.8,
                thickness: 0.8,
                clearcoat: 1.0,
                clearcoatRoughness: 0.0,
                envMapIntensity: 2.0,
                ior: 1.6,
                reflectivity: 1.0,
                emissiveIntensity: 0.3,
                sheen: 1.0,
                sheenRoughness: 0.1
            }
        };
        
        this.effectCombinations = {
            glass: {
                metalness: 0.0,
                roughness: 0.0,
                transmission: 1.0,
                thickness: 0.3,
                clearcoat: 1.0,
                clearcoatRoughness: 0.0,
                envMapIntensity: 3.0,
                ior: 1.8,
                reflectivity: 1.0,
                emissiveIntensity: 0.0,
                sheen: 0.0,
                sheenRoughness: 0.0
            },
            magical: {
                metalness: 0.4,
                roughness: 0.1,
                transmission: 0.3,
                thickness: 0.8,
                clearcoat: 0.9,
                clearcoatRoughness: 0.05,
                envMapIntensity: 2.5,
                ior: 1.7,
                reflectivity: 1.0,
                emissiveIntensity: 0.6,
                sheen: 1.0,
                sheenRoughness: 0.8
            },
            soap: {
                metalness: 0.0,
                roughness: 0.4,
                transmission: 0.8,
                thickness: 0.1,
                clearcoat: 0.6,
                clearcoatRoughness: 0.1,
                envMapIntensity: 1.8,
                ior: 1.33,
                reflectivity: 0.6,
                emissiveIntensity: 0.1,
                sheen: 1.0,
                sheenRoughness: 0.9
            },
            underwater: {
                metalness: 0.0,
                roughness: 0.6,
                transmission: 0.9,
                thickness: 1.2,
                clearcoat: 0.2,
                clearcoatRoughness: 0.3,
                envMapIntensity: 1.0,
                ior: 1.6,
                reflectivity: 0.3,
                emissiveIntensity: 0.05,
                sheen: 0.3,
                sheenRoughness: 0.7
            }
        };
    }

    async initialize(eventBus) {
        if (this.initialized) return;
        
        this.eventBus = eventBus;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load saved settings
        await this.loadSavedSettings();
        
        // Apply effects to all existing bubbles after loading settings
        setTimeout(() => {
            this.applyToAllBubbles();
        }, 100); // Small delay to ensure game is fully initialized
        
        // Subscribe to bubble creation events
        if (this.eventBus) {
            this.eventBus.on('bubbleCreated', (bubble) => {
                this.applyEffectsToBubble(bubble);
            });
        }
        
        this.initialized = true;
        console.log('BubbleEffectsController initialized');
    }

    setupEventListeners() {
        // Quality preset selector
        const presetSelector = document.getElementById('effectPreset');
        if (presetSelector) {
            presetSelector.addEventListener('change', async (e) => {
                const preset = e.target.value;
                if (preset !== 'custom' && this.effectPresets[preset]) {
                    this.applyPreset(preset);
                    await this.saveCurrentEffects();
                }
            });
        }

        // Effect combination selector
        const comboSelector = document.getElementById('effectCombination');
        if (comboSelector) {
            comboSelector.addEventListener('change', async (e) => {
                const comboName = e.target.value;
                if (comboName && this.effectCombinations[comboName]) {
                    this.applyEffectCombination(this.effectCombinations[comboName]);
                    document.getElementById('effectPreset').value = 'custom';
                    await this.saveCurrentEffects();
                }
            });
        }

        // Save combination button
        const saveButton = document.getElementById('saveEffectCombo');
        if (saveButton) {
            saveButton.addEventListener('click', async () => {
                const name = prompt('Enter a name for this effect combination:');
                if (name) {
                    await settingsStorage.saveEffectCombination(name, this.currentEffects);
                    await this.updateCombinationsList();
                    alert(`Effect combination "${name}" saved!`);
                }
            });
        }

        // Delete combination button
        const deleteButton = document.getElementById('deleteEffectCombo');
        if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
                const comboSelector = document.getElementById('effectCombination');
                const selectedValue = comboSelector.value;
                
                if (selectedValue && !this.effectCombinations[selectedValue]) {
                    if (confirm(`Delete effect combination "${selectedValue}"?`)) {
                        await settingsStorage.deleteEffectCombination(selectedValue);
                        await this.updateCombinationsList();
                    }
                }
            });
        }

        // Individual effect controls
        this.setupEffectControls();
    }

    setupEffectControls() {
        // Map checkbox effects to material properties with more dramatic changes
        const effectMapping = {
            enablePBR: { 
                properties: { metalness: { enabled: 0.2, disabled: 0.0 }, roughness: { enabled: 0.1, disabled: 0.8 } }
            },
            enableTransmission: { 
                properties: { transmission: { enabled: 0.8, disabled: 0.0 }, thickness: { enabled: 0.5, disabled: 0.0 } }
            },
            enableClearcoat: { 
                properties: { clearcoat: { enabled: 1.0, disabled: 0.0 }, clearcoatRoughness: { enabled: 0.0, disabled: 0.2 } }
            },
            enableSheen: { 
                properties: { sheen: { enabled: 1.0, disabled: 0.0 }, sheenRoughness: { enabled: 0.2, disabled: 0.0 } }
            },
            enableEnvironmentMap: { 
                properties: { envMapIntensity: { enabled: 2.0, disabled: 0.0 } }
            },
            enablePulse: { 
                properties: { emissiveIntensity: { enabled: 0.4, disabled: 0.1 } }
            },
            enableColorShift: { 
                properties: { ior: { enabled: 1.8, disabled: 1.33 } }
            },
            enableDistortion: { 
                properties: { thickness: { enabled: 1.0, disabled: 0.2 }, transmission: { enabled: 0.9, disabled: 0.5 } }
            },
            enableSparkles: { 
                properties: { reflectivity: { enabled: 1.0, disabled: 0.3 }, metalness: { enabled: 0.3, disabled: 0.1 } }
            },
            enableRainbow: { 
                properties: { sheenRoughness: { enabled: 0.8, disabled: 0.1 }, sheen: { enabled: 1.0, disabled: 0.5 } }
            },
            enableSubsurface: { 
                properties: { transmission: { enabled: 0.6, disabled: 0.5 }, thickness: { enabled: 0.8, disabled: 0.5 } }
            },
            enableCaustics: { 
                properties: { transmission: { enabled: 0.9, disabled: 0.5 }, ior: { enabled: 1.6, disabled: 1.5 } }
            },
            enableFoam: { 
                properties: { roughness: { enabled: 0.4, disabled: 0.1 }, sheen: { enabled: 0.8, disabled: 1.0 } }
            },
            enableWobble: { 
                properties: { emissiveIntensity: { enabled: 0.3, disabled: 0.2 } }
            },
            enableHolographic: { 
                properties: { metalness: { enabled: 0.8, disabled: 0.1 }, roughness: { enabled: 0.0, disabled: 0.1 }, reflectivity: { enabled: 1.0, disabled: 0.8 } }
            }
        };

        const effectToggles = document.querySelectorAll('#effectToggles input[type="checkbox"]');
        effectToggles.forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const effect = e.target.dataset.effect;
                const enabled = e.target.checked;
                
                if (effectMapping[effect]) {
                    const mapping = effectMapping[effect];
                    
                    // Apply each property in the mapping
                    Object.entries(mapping.properties).forEach(([property, values]) => {
                        this.currentEffects[property] = enabled ? values.enabled : values.disabled;
                    });
                    
                    // Apply to all existing bubbles
                    this.applyToAllBubbles();
                    
                    document.getElementById('effectPreset').value = 'custom';
                    await this.saveCurrentEffects();
                }
            });
        });
    }

    async loadSavedSettings() {
        // Load saved effect combinations
        await this.updateCombinationsList();
        
        // Load current effects if saved
        const savedEffects = await settingsStorage.loadCurrentEffects();
        if (savedEffects) {
            this.currentEffects = { ...this.currentEffects, ...savedEffects };
            this.updateUIFromCurrentEffects();
            this.applyToAllBubbles();
        }
    }

    async updateCombinationsList() {
        const comboSelector = document.getElementById('effectCombination');
        if (!comboSelector) return;
        
        // Clear existing options except built-in ones
        const options = comboSelector.querySelectorAll('option');
        options.forEach(option => {
            if (!['', 'glass', 'magical', 'soap', 'underwater'].includes(option.value)) {
                option.remove();
            }
        });
        
        // Add saved combinations
        const savedCombos = await settingsStorage.getAllEffectCombinations();
        savedCombos.forEach(combo => {
            const option = document.createElement('option');
            option.value = combo.name;
            option.textContent = combo.name + ' (saved)';
            comboSelector.appendChild(option);
        });
    }

    applyPreset(presetName) {
        if (this.effectPresets[presetName]) {
            this.currentEffects = { ...this.currentEffects, ...this.effectPresets[presetName] };
            this.updateUIFromCurrentEffects();
            this.applyToAllBubbles();
        }
    }

    applyEffectCombination(effects) {
        this.currentEffects = { ...this.currentEffects, ...effects };
        this.updateUIFromCurrentEffects();
        this.applyToAllBubbles();
    }

    updateUIFromCurrentEffects() {
        // Update checkboxes based on current effects
        const effectMapping = {
            enablePBR: this.currentEffects.metalness > 0.1,
            enableTransmission: this.currentEffects.transmission > 0.5,
            enableClearcoat: this.currentEffects.clearcoat > 0.5,
            enableSheen: this.currentEffects.sheen > 0.5,
            enableEnvironmentMap: this.currentEffects.envMapIntensity > 1.0,
            enablePulse: this.currentEffects.emissiveIntensity > 0.25,
            enableColorShift: this.currentEffects.ior > 1.6,
            enableDistortion: this.currentEffects.thickness > 0.6,
            enableSparkles: this.currentEffects.reflectivity > 0.6,
            enableRainbow: this.currentEffects.sheenRoughness > 0.4,
            enableSubsurface: this.currentEffects.transmission > 0.55 && this.currentEffects.thickness > 0.6,
            enableCaustics: this.currentEffects.ior > 1.55,
            enableFoam: this.currentEffects.roughness > 0.2,
            enableWobble: this.currentEffects.emissiveIntensity > 0.25,
            enableHolographic: this.currentEffects.metalness > 0.5
        };

        Object.entries(effectMapping).forEach(([effect, enabled]) => {
            const toggle = document.querySelector(`#effectToggles input[data-effect="${effect}"]`);
            if (toggle) {
                toggle.checked = enabled;
            }
        });
    }

    applyEffectsToBubble(bubble) {
        if (!bubble || !bubble.material || !(bubble.material instanceof THREE.MeshPhysicalMaterial)) return;
        
        // Apply current effects to the bubble's material
        Object.entries(this.currentEffects).forEach(([property, value]) => {
            if (bubble.material.hasOwnProperty(property)) {
                bubble.material[property] = value;
            }
        });
        
        bubble.material.needsUpdate = true;
    }

    applyToAllBubbles() {
        if (!window.game || !window.game.gameState) {
            console.warn('Game or game state not available');
            return;
        }
        
        let bubbleCount = 0;
        
        // Apply effects to all bubbles in the grid
        const allBubbles = window.game.gameState.getAllBubbles();
        allBubbles.forEach(bubble => {
            if (bubble) {
                this.applyEffectsToBubble(bubble);
                bubbleCount++;
            }
        });
        
        // Apply to current bubble
        if (window.game.gameState.currentBubble) {
            this.applyEffectsToBubble(window.game.gameState.currentBubble);
            bubbleCount++;
        }
        
        console.log(`Applied effects to ${bubbleCount} bubbles`);
    }

    async saveCurrentEffects() {
        await settingsStorage.saveCurrentEffects(this.currentEffects);
    }

    // Debug method to test effects
    testEffect(effectName) {
        console.log(`Testing effect: ${effectName}`);
        const checkbox = document.querySelector(`#effectToggles input[data-effect="${effectName}"]`);
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
            console.log(`${effectName} is now ${checkbox.checked ? 'enabled' : 'disabled'}`);
        } else {
            console.warn(`Effect ${effectName} not found`);
        }
    }
}

// Create singleton instance
export const bubbleEffectsController = new BubbleEffectsController();