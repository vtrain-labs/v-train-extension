/**
 * V-Train 混合儲存 (Hybrid Storage) IndexedDB 介面
 * 負責處理 20萬筆海量影片進度的寫入與清理
 */
class VTDatabase {
    constructor() {
        this.dbName = 'VT_Storage';
        this.storeName = 'video_records';
        this.version = 1;
        this.db = null;
        this.initPromise = null;
    }

    async init() {
        if (this.initPromise) return this.initPromise;
        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    // 建立 lastUpdated 索引以供 GC 快速排序刪除
                    store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
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

    async putRecord(id, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const record = { id, ...data };
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getRecords(ids) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const results = {};
            let completed = 0;
            
            if (!ids || ids.length === 0) return resolve(results);

            ids.forEach(id => {
                const request = store.get(id);
                request.onsuccess = (e) => {
                    if (e.target.result) {
                        results[id] = e.target.result;
                    }
                    completed++;
                    if (completed === ids.length) resolve(results);
                };
                request.onerror = (e) => {
                    completed++;
                    if (completed === ids.length) resolve(results);
                };
            });
        });
    }

    async getAllRecords() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            request.onsuccess = (e) => resolve(e.target.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async count() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.count();
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async runGC(limit, dropCount) {
        await this.init();
        return new Promise(async (resolve, reject) => {
            try {
                const currentCount = await this.count();
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
                        resolve(true); // 表示有執行清理
                    }
                };
                request.onerror = (e) => reject(e.target.error);
            } catch (e) {
                reject(e);
            }
        });
    }

    async clearRecords() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

const _global = typeof window !== 'undefined' ? window : self;
// 全域單例
_global.vtDB = new VTDatabase();
