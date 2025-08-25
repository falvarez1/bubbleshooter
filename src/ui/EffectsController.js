import { settingsStorage } from '../core/SettingsStorage.js';

/**
 * Effects Controller
 * Manages visual effects settings through the developer panel
 */
export class EffectsController {
    constructor() {
        this.initialized = false;
        this.bubbleInstances = null;
        this.eventBus = null;
        this.effectCombinations = {
            glass: {
                enablePBR: true,
                enableTransmission: true,
                enableClearcoat: true,
                enableEnvironmentMap: true,
                enableSheen: false,
                enablePulse: false,
                enableColorShift: false,
                enableDistortion: false,
                enableSparkles: false,
                enableRainbow: false,
                enableSubsurface: false,
                enableCaustics: false,
                enableFoam: false,
                enableWobble: false,
                enableHolographic: false
            },
            magical: {
                enablePBR: true,
                enableTransmission: false,
                enableClearcoat: false,
                enableEnvironmentMap: true,
                enableSheen: true,
                enablePulse: true,
                enableColorShift: true,
                enableDistortion: false,
                enableSparkles: true,
                enableRainbow: true,
                enableSubsurface: false,
                enableCaustics: false,
                enableFoam: false,
                enableWobble: false,
                enableHolographic: false
            },
            soap: {
                enablePBR: true,
                enableTransmission: true,
                enableClearcoat: false,
                enableEnvironmentMap: true,
                enableSheen: false,
                enablePulse: false,
                enableColorShift: false,
                enableDistortion: false,
                enableSparkles: false,
                enableRainbow: true,
                enableSubsurface: false,
                enableCaustics: false,
                enableFoam: true,
                enableWobble: true,
                enableHolographic: false
            },
            underwater: {
                enablePBR: true,
                enableTransmission: true,
                enableClearcoat: false,
                enableEnvironmentMap: true,
                enableSheen: false,
                enablePulse: false,
                enableColorShift: false,
                enableDistortion: true,
                enableSparkles: false,
                enableRainbow: false,
                enableSubsurface: true,
                enableCaustics: true,
                enableFoam: false,
                enableWobble: true,
                enableHolographic: false
            }
        };
    }

    async initialize(eventBus) {
        if (this.initialized) return;
        
        this.eventBus = eventBus;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load saved settings
        await this.loadSavedSettings();
        
        // Subscribe to game events
        if (this.eventBus) {
            this.eventBus.on('bubbleInstancesReady', (bubbleInstances) => {
                this.setBubbleInstances(bubbleInstances);
            });
        }
        
        this.initialized = true;
        console.log('EffectsController initialized');
    }

    setBubbleInstances(bubbleInstances) {
        this.bubbleInstances = bubbleInstances;
        console.log('BubbleInstances connected to EffectsController');
        
        // Apply saved effects if available
        this.applySavedEffects();
    }

    setupEventListeners() {
        // Quality preset selector
        const presetSelector = document.getElementById('effectPreset');
        if (presetSelector) {
            presetSelector.addEventListener('change', (e) => {
                const preset = e.target.value;
                if (preset !== 'custom' && this.bubbleInstances) {
                    this.bubbleInstances.setQualityPreset(preset);
                    this.updateUIFromCurrentEffects();
                    this.saveCurrentEffects();
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
                }
            });
        }

        // Save combination button
        const saveButton = document.getElementById('saveEffectCombo');
        if (saveButton) {
            saveButton.addEventListener('click', async () => {
                const name = prompt('Enter a name for this effect combination:');
                if (name && this.bubbleInstances) {
                    const effects = this.bubbleInstances.getEffects();
                    await settingsStorage.saveEffectCombination(name, effects);
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
                    // It's a custom saved combination
                    if (confirm(`Delete effect combination "${selectedValue}"?`)) {
                        await settingsStorage.deleteEffectCombination(selectedValue);
                        await this.updateCombinationsList();
                    }
                }
            });
        }

        // Individual effect toggles
        const effectToggles = document.querySelectorAll('#effectToggles input[type="checkbox"]');
        effectToggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const effect = e.target.dataset.effect;
                const enabled = e.target.checked;
                
                if (this.bubbleInstances && effect) {
                    this.bubbleInstances.setEffect(effect, enabled);
                    document.getElementById('effectPreset').value = 'custom';
                    this.saveCurrentEffects();
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
            // Update UI to match saved effects
            Object.entries(savedEffects).forEach(([effect, enabled]) => {
                const toggle = document.querySelector(`#effectToggles input[data-effect="${effect}"]`);
                if (toggle) {
                    toggle.checked = enabled;
                }
            });
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

    applyEffectCombination(effects) {
        if (!this.bubbleInstances) return;
        
        this.bubbleInstances.setEffects(effects);
        this.updateUIFromCurrentEffects();
        this.saveCurrentEffects();
    }

    updateUIFromCurrentEffects() {
        if (!this.bubbleInstances) return;
        
        const currentEffects = this.bubbleInstances.getEffects();
        Object.entries(currentEffects).forEach(([effect, enabled]) => {
            const toggle = document.querySelector(`#effectToggles input[data-effect="${effect}"]`);
            if (toggle) {
                toggle.checked = enabled;
            }
        });
    }

    async saveCurrentEffects() {
        if (!this.bubbleInstances) return;
        
        const currentEffects = this.bubbleInstances.getEffects();
        await settingsStorage.saveCurrentEffects(currentEffects);
    }

    async applySavedEffects() {
        if (!this.bubbleInstances) return;
        
        const savedEffects = await settingsStorage.loadCurrentEffects();
        if (savedEffects) {
            this.bubbleInstances.setEffects(savedEffects);
            console.log('Applied saved effects from IndexedDB');
        }
    }
}

// Create singleton instance
export const effectsController = new EffectsController();