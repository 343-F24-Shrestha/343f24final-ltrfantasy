// storage.js
class StorageManager {
    constructor() {
        this.dbName = 'LTRFantasy';
        this.dbVersion = 1;
        this.db = null;
        this.stores = {
            players: 'players',
            teams: 'teams',
            lineups: 'lineups',
            stats: 'stats',
            cache: 'cache'
        };
        this.readyPromise = this.initDB();
        this.fallbackToLocalStorage = false;
    }

    async initDB() {
        try {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);
                
                request.onerror = (event) => {
                    console.error('IndexedDB error:', event.target.error);
                    this.fallbackToLocalStorage = true;
                    resolve(); // Resolve anyway to continue with localStorage
                };
    
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Create store if it doesn't exist
                    if (!db.objectStoreNames.contains(this.stores.cache)) {
                        const cacheStore = db.createObjectStore(this.stores.cache, { 
                            keyPath: 'key' 
                        });
                        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }
    
                    // Create other stores
                    Object.values(this.stores).forEach(storeName => {
                        if (!db.objectStoreNames.contains(storeName)) {
                            db.createObjectStore(storeName, { 
                                keyPath: 'id',
                                autoIncrement: true 
                            });
                        }
                    });
                };
    
                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    console.log('IndexedDB initialized successfully');
                    resolve(this.db);
                };
            });
        } catch (error) {
            console.error('IndexedDB initialization failed:', error);
            this.fallbackToLocalStorage = true;
            return Promise.resolve();
        }
    }

    async ensureReady() {
        await this.readyPromise;
    }

    // Cache methods
    async setCache(key, value, ttl = 3600) {
        await this.ensureReady();
        
        const data = {
            key,
            value,
            timestamp: Date.now(),
            expires: Date.now() + (ttl * 1000)
        };
    
        if (this.fallbackToLocalStorage) {
            localStorage.setItem(key, JSON.stringify(data));
            return;
        }
    
        try {
            const tx = this.db.transaction(this.stores.cache, 'readwrite');
            const store = tx.objectStore(this.stores.cache);
            await new Promise((resolve, reject) => {
                const request = store.put(data);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
    
            // Only cleanup occasionally
            if (Math.random() < 0.1) {
                await this.clearExpiredCache();
            }
        } catch (error) {
            console.error('Cache set error:', error);
            localStorage.setItem(key, JSON.stringify(data));
        }
    }

    async getCache(key) {
        await this.ensureReady();

        if (this.fallbackToLocalStorage) {
            const data = localStorage.getItem(key);
            if (!data) return null;
            const parsed = JSON.parse(data);
            if (Date.now() > parsed.expires) {
                localStorage.removeItem(key);
                return null;
            }
            return parsed.value;
        }

        try {
            const tx = this.db.transaction(this.stores.cache, 'readonly');
            const store = tx.objectStore(this.stores.cache);
            const data = await store.get(key);

            if (!data || Date.now() > data.expires) {
                if (data) {
                    // Remove expired data
                    const deleteTx = this.db.transaction(this.stores.cache, 'readwrite');
                    const deleteStore = deleteTx.objectStore(this.stores.cache);
                    await deleteStore.delete(key);
                }
                return null;
            }

            return data.value;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    async clearExpiredCache() {
        try {
            const tx = this.db.transaction(this.stores.cache, 'readwrite');
            const store = tx.objectStore(this.stores.cache);
            const index = store.index('timestamp');
            const now = Date.now();
            
            // Fix: Use a cursor to iterate through expired items
            const request = index.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const data = cursor.value;
                    if (data.expires && data.expires < now) {
                        store.delete(cursor.primaryKey);
                    }
                    cursor.continue();
                }
            };
        } catch (error) {
            console.error('Cache cleanup error:', error);
            // Don't throw - just log and continue
        }
    }


    // Player data methods
    async setPlayers(players, chunk = false) {
        await this.ensureReady();

        if (chunk) {
            const CHUNK_SIZE = 50;
            for (let i = 0; i < players.length; i += CHUNK_SIZE) {
                const playerChunk = players.slice(i, i + CHUNK_SIZE);
                await this.setPlayersChunk(playerChunk, i / CHUNK_SIZE);
            }
            await this.setCache('playerChunkCount', Math.ceil(players.length / CHUNK_SIZE));
        } else {
            try {
                const tx = this.db.transaction('players', 'readwrite');
                const store = tx.objectStore('players');
                for (const player of players) {
                    await store.put(player);
                }
            } catch (error) {
                console.error('Error storing players:', error);
                // Fallback to cache
                await this.setCache('players', players);
            }
        }
    }

    async setPlayersChunk(players, chunkIndex) {
        await this.ensureReady();
        try {
            const key = `players_chunk_${chunkIndex}`;
            await this.setCache(key, players);
        } catch (error) {
            console.error('Error storing player chunk:', error);
        }
    }

    async getPlayers(paginated = false, page = 0, pageSize = 50) {
        await this.ensureReady();
        try {
            if (this.fallbackToLocalStorage) {
                const players = await this.getCache('players');
                return players || [];
            }

            const tx = this.db.transaction('players', 'readonly');
            const store = tx.objectStore('players');

            if (paginated) {
                const allPlayers = await store.getAll();
                const start = page * pageSize;
                return allPlayers.slice(start, start + pageSize);
            } else {
                return await store.getAll();
            }
        } catch (error) {
            console.error('Error retrieving players:', error);
            // Fallback to cache
            const players = await this.getCache('players');
            return players || [];
        }
    }

    // Lineup methods
    async saveLineup(lineup) {
        try {
            const tx = this.db.transaction(this.stores.lineups, 'readwrite');
            const store = tx.objectStore(this.stores.lineups);
            await store.put(lineup);
        } catch (error) {
            console.error('Error saving lineup:', error);
        }
    }

    async getLineups() {
        try {
            const tx = this.db.transaction(this.stores.lineups, 'readonly');
            const store = tx.objectStore(this.stores.lineups);
            return await store.getAll();
        } catch (error) {
            console.error('Error retrieving lineups:', error);
            return [];
        }
    }

    // Export/Import methods
    async exportData() {
        try {
            const data = {
                lineups: await this.getLineups(),
                timestamp: Date.now()
            };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            return blob;
        } catch (error) {
            console.error('Error exporting data:', error);
            return null;
        }
    }

    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            const tx = this.db.transaction(this.stores.lineups, 'readwrite');
            const store = tx.objectStore(this.stores.lineups);

            // Clear existing lineups
            await store.clear();

            // Import new lineups
            for (const lineup of data.lineups) {
                await store.add(lineup);
            }

            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    // Clear all data
    async clearAllData() {
        try {
            const tx = this.db.transaction(
                [this.stores.players, this.stores.teams, this.stores.lineups, this.stores.stats, this.stores.cache],
                'readwrite'
            );

            await Promise.all([
                tx.objectStore(this.stores.players).clear(),
                tx.objectStore(this.stores.teams).clear(),
                tx.objectStore(this.stores.lineups).clear(),
                tx.objectStore(this.stores.stats).clear(),
                tx.objectStore(this.stores.cache).clear()
            ]);

            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }
}

export default StorageManager;