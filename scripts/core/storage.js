// storage.js
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