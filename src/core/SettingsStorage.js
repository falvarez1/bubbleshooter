export class SettingsStorage {
    constructor() {
        this.dbName = 'BubbleShooterDB';
        this.dbVersion = 1;
        this.storeName = 'settings';
        this.db = null;
        this.initPromise = this.initDB();
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create settings store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
                    store.createIndex('key', 'key', { unique: true });
                }
            };
        });
    }

    async ensureDB() {
        if (!this.db) {
            await this.initPromise;
        }
    }

    async saveSetting(key, value) {
        await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ key, value, timestamp: Date.now() });

            request.onsuccess = () => {
                console.log(`Setting saved: ${key}`);
                resolve();
            };

            request.onerror = () => {
                console.error(`Failed to save setting ${key}:`, request.error);
                reject(request.error);
            };
        });
    }

    async loadSetting(key, defaultValue = null) {
        await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : defaultValue);
            };

            request.onerror = () => {
                console.error(`Failed to load setting ${key}:`, request.error);
                resolve(defaultValue);
            };
        });
    }

    async deleteSetting(key) {
        await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                console.log(`Setting deleted: ${key}`);
                resolve();
            };

            request.onerror = () => {
                console.error(`Failed to delete setting ${key}:`, request.error);
                reject(request.error);
            };
        });
    }

    async getAllSettings() {
        await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(item => {
                    settings[item.key] = item.value;
                });
                resolve(settings);
            };

            request.onerror = () => {
                console.error('Failed to get all settings:', request.error);
                reject(request.error);
            };
        });
    }

    async clearAllSettings() {
        await this.ensureDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('All settings cleared');
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to clear settings:', request.error);
                reject(request.error);
            };
        });
    }

    // Specific methods for effect combinations
    async saveEffectCombination(name, effects) {
        const combinations = await this.loadSetting('effectCombinations', {});
        combinations[name] = {
            effects,
            timestamp: Date.now()
        };
        await this.saveSetting('effectCombinations', combinations);
    }

    async loadEffectCombination(name) {
        const combinations = await this.loadSetting('effectCombinations', {});
        return combinations[name] ? combinations[name].effects : null;
    }

    async getAllEffectCombinations() {
        const combinations = await this.loadSetting('effectCombinations', {});
        return Object.keys(combinations).map(name => ({
            name,
            ...combinations[name]
        }));
    }

    async deleteEffectCombination(name) {
        const combinations = await this.loadSetting('effectCombinations', {});
        delete combinations[name];
        await this.saveSetting('effectCombinations', combinations);
    }

    async saveCurrentEffects(effects) {
        await this.saveSetting('currentBubbleEffects', effects);
    }

    async loadCurrentEffects() {
        return await this.loadSetting('currentBubbleEffects', null);
    }
}

// Create singleton instance
export const settingsStorage = new SettingsStorage();