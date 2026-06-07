/**
 * V-Train 混合儲存 (Hybrid Storage) IndexedDB 介面
 * 負責處理 20萬筆海量影片進度的寫入與清理
 */
if (typeof globalThis.vtDB === 'undefined') {

class VTDatabase {
    constructor() {
        this.dbName = 'VT_Storage';
        this.storeName = 'video_records'; // Default/legacy store
        this.version = 3; // Upgraded version for bookmarks
        this.db = null;
        this.initPromise = null;
    }

    async init() {
        if (this.initPromise) return this.initPromise;
        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // v1 store
                if (!db.objectStoreNames.contains('video_records')) {
                    const store = db.createObjectStore('video_records', { keyPath: 'id' });
                    store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }
                // v2 stores
                if (!db.objectStoreNames.contains('vt_bookmarks')) {
                    // Use videoId as primary key for bookmarks
                    db.createObjectStore('vt_bookmarks', { keyPath: 'videoId' });
                }
                if (!db.objectStoreNames.contains('vt_ratings')) {
                    // Use videoId as primary key for ratings
                    db.createObjectStore('vt_ratings', { keyPath: 'videoId' });
                }
                if (!db.objectStoreNames.contains('vt_bm_folders')) {
                    // Use id as primary key for folders
                    db.createObjectStore('vt_bm_folders', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('vt_thumbnails')) {
                    // Use videoId as primary key for thumbnails cache
                    db.createObjectStore('vt_thumbnails', { keyPath: 'videoId' });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onerror = (e) => {
                console.error('[VTDatabase] Init error:', e.target.error);
                reject(e.target.error);
            };
        });
        return this.initPromise;
    }

    // --- Generic Multi-Store Methods ---
    async put(storeName, obj) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(obj);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async putBulk(storeName, items) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
            for (const item of items) {
                store.put(item);
            }
        });
    }

    async get(storeName, key) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAll(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = (e) => resolve(e.target.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async delete(storeName, key) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async clear(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- Legacy / Specific Methods for video_records ---
    async putRecord(id, data) {
        return this.put(this.storeName, { id, ...data });
    }

    async getRecords(ids) {
        await this.init();
        if (!ids || ids.length === 0) return {};
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const results = {};
        await Promise.all(ids.map(id => new Promise((resolve) => {
            const req = store.get(id);
            req.onsuccess = (e) => {
                if (e.target.result) results[id] = e.target.result;
                resolve();
            };
            req.onerror = () => resolve();
        })));
        return results;
    }

    async getAllRecords() {
        return this.getAll(this.storeName);
    }

    async count(storeName = this.storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async runGC(limit, dropCount) {
        await this.init();
        return new Promise(async (resolve, reject) => {
            try {
                // If limit is Infinity, do not run GC
                if (limit === Infinity) return resolve(false);

                const currentCount = await this.count(this.storeName);
                if (currentCount <= limit) return resolve(false);

                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const index = store.index('lastUpdated');
                
                const request = index.openCursor();
                let deleted = 0;

                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor && deleted < dropCount) {
                        cursor.delete();
                        deleted++;
                        cursor.continue();
                    } else {
                        resolve(true);
                    }
                };
                request.onerror = (e) => reject(e.target.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    async clearRecords() {
        return this.clear(this.storeName);
    }
}

// 全域單例
globalThis.vtDB = new VTDatabase();

} // End of duplicate injection guard
