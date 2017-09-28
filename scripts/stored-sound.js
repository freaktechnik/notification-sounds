const Database = {
    DB_NAME: "notification-sounds",
    DB_VERSION: 1,
    STORE_NAME: "sounds",
    db: undefined,
    _waitForRequest(request) {
        return new Promise((resolve, reject) => { // eslint-disable-line promise/avoid-new
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = reject;
        });
    },
    init() {
        if(!this.db) {
            const request = window.indexedDB.open(Database.DB_NAME, Database.DB_VERSION);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(Database.STORE_NAME);
            };
            return this._waitForRequest(request).then((r) => {
                this.db = r;
            });
        }
        return Promise.resolve();
    },
    async store(blob, name) {
        await this.init();
        const transaction = this.db.transaction(Database.STORE_NAME, "readwrite"),
            store = transaction.objectStore(Database.STORE_NAME),
            request = store.add(blob, name);
        return this._waitForRequest(request);
    },
    async get(name) {
        await this.init();
        const transaction = this.db.transaction(Database.STORE_NAME, "readonly"),
            store = transaction.objectStore(Database.STORE_NAME),
            request = store.get(name);
        return this._waitForRequest(request);
    },
    async remove(name) {
        await this.init();
        const transaction = this.db.transaction(Database.STORE_NAME, "readwrite"),
            store = transaction.objectStore(Database.STORE_NAME),
            request = store.delete(name);
        return this._waitForRequest(request);
    }
};

// eslint-disable-next-line no-unused-vars
class StoredBlob {
    constructor(name) {
        Database.init();
        this.name = name;
    }

    save(blob) {
        return Database.store(blob, this.name);
    }

    get() {
        return Database.get(this.name);
    }

    delete() {
        return Database.remove(this.name);
    }
}
