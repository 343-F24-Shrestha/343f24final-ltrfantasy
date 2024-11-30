// storage.js

// Wrapper class specifically for API response caching
export class StorageWrapper {
    constructor() {
        this.storage = window.localStorage;
    }

    // set(key, value, ttl) {
    //     const item = {
    //         value,
    //         expires: Date.now() + (ttl * 1000)
    //     };
    //     this.storage.setItem(key, JSON.stringify(item));
    // }

    // get(key) {
    //     const item = this.storage.getItem(key);
    //     if (!item) return null;

    //     const parsed = JSON.parse(item);
    //     if (Date.now() > parsed.expires) {
    //         this.storage.removeItem(key);
    //         return null;
    //     }
    //     return parsed.value;
    // }

    // MOORREEE DEBUUGGGG

    set(key, value, ttl) {
        try {
            const item = {
                value,
                expires: Date.now() + (ttl * 1000)
            };
            const serialized = JSON.stringify(item);
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

    // Generic storage methods
    set(key, value, ttl = null) {
        const item = {
            value,
            timestamp: Date.now(),
            expires: ttl ? Date.now() + (ttl * 1000) : null
        };
        this.storage.setItem(key, JSON.stringify(item));
    }

    get(key) {
        const item = this.storage.getItem(key);
        if (!item) return null;

        const parsed = JSON.parse(item);
        if (parsed.expires && Date.now() > parsed.expires) {
            this.storage.removeItem(key);
            return null;
        }
        return parsed.value;
    }

    remove(key) {
        this.storage.removeItem(key);
    }

    clear() {
        this.storage.clear();
    }
}

export default StorageManager;