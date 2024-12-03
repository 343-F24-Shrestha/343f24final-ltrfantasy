// storage.js

// Wrapper class specifically for API response caching
export class StorageWrapper {
    constructor() {
        this.storage = window.localStorage;
        this.maxSize = 4800000; // ~4.8MB limit for localStorage
        this.maxItems = 50; // Limit total cached items
    }

    cleanup() {
        try {
            const keys = Object.keys(this.storage);
            if (keys.length > this.maxItems) {
                // Sort by timestamp and remove oldest
                const items = keys.map(key => ({
                    key,
                    timestamp: JSON.parse(this.storage.getItem(key)).timestamp
                }))
                .sort((a, b) => b.timestamp - a.timestamp);

                // Keep only newest maxItems
                items.slice(this.maxItems).forEach(item => {
                    this.storage.removeItem(item.key);
                });
            }
        } catch (error) {
            console.warn('Storage cleanup failed:', error);
        }
    }

    set(key, value, ttl) {
        try {
            const item = {
                value,
                timestamp: Date.now(),
                expires: Date.now() + (ttl * 1000)
            };
            const serialized = JSON.stringify(item);

             // Check size before storing
             if (serialized.length > this.maxSize * 0.1) { // Single item shouldn't be >10% of total
                console.warn('Item too large to cache:', key);
                return;
            }
            this.cleanup();
            this.storage.setItem(key, serialized);
            console.log(`Cached item ${key}, expires in ${ttl}s`);
        } catch (error) {
            console.error('Error caching item:', error);
        }
    }
    
    get(key) {
        try {
            const item = this.storage.getItem(key);
            if (!item) {
                console.log(`Cache miss for ${key}`);
                return null;
            }
    
            const parsed = JSON.parse(item);
            if (Date.now() > parsed.expires) {
                console.log(`Cache expired for ${key}`);
                this.storage.removeItem(key);
                return null;
            }
    
            console.log(`Cache hit for ${key}`);
            return parsed.value;
        } catch (error) {
            console.error('Error reading cache:', error);
            return null;
        }
    }
}

// Main storage manager for application data
class StorageManager {
    constructor() {
        this.storage = window.localStorage;
        this.maxSize = 4800000;
        this.maxItems = 50; // Can adjust maybe.. idk what the storage quota actually is but we're hiting the limit for caching
    }

    cleanup() {
        try {
            const keys = Object.keys(this.storage);
            if (keys.length > this.maxItems) {
                // Sort by timestamp and remove oldest
                const items = keys.map(key => ({
                    key,
                    timestamp: JSON.parse(this.storage.getItem(key)).timestamp
                }))
                .sort((a, b) => b.timestamp - a.timestamp);

                // Keep only newest maxItems
                items.slice(this.maxItems).forEach(item => {
                    this.storage.removeItem(item.key);
                });
            }
        } catch (error) {
            console.warn('Storage cleanup failed:', error);
        }
    }

    // Lineup storage
    saveLineup(lineup) {
        this.set('saved_lineup', lineup);
    }

    getLineup() {
        return this.get('saved_lineup');
    }

    // Betting preferences
    saveBettingPrefs(prefs) {
        this.set('betting_prefs', prefs);
    }

    getBettingPrefs() {
        return this.get('betting_prefs') || {};
    }

    set(key, value, ttl) {
        try {
            const item = {
                value,
                timestamp: Date.now(),
                expires: Date.now() + (ttl * 1000)
            };
            const serialized = JSON.stringify(item);

             // Check size before storing
             if (serialized.length > this.maxSize * 0.1) { // Single item shouldn't be >10% of total
                console.warn('Item too large to cache:', key);
                return;
            }
            this.cleanup();
            this.storage.setItem(key, serialized);
            console.log(`Cached item ${key}, expires in ${ttl}s`);
        } catch (error) {
            console.error('Error caching item:', error);
        }
    }
    
    get(key) {
        try {
            const item = this.storage.getItem(key);
            if (!item) {
                console.log(`Cache miss for ${key}`);
                return null;
            }
    
            const parsed = JSON.parse(item);
            if (Date.now() > parsed.expires) {
                console.log(`Cache expired for ${key}`);
                this.storage.removeItem(key);
                return null;
            }
    
            console.log(`Cache hit for ${key}`);
            return parsed.value;
        } catch (error) {
            console.error('Error reading cache:', error);
            return null;
        }
    }

    remove(key) {
        this.storage.removeItem(key);
    }

    clear() {
        this.storage.clear();
    }
}

export default StorageManager;