const Database = {
    DB_NAME: "notification-sounds",
    DB_VERSION: 2,
    STORE_NAME: "sounds",
    db: undefined,
    _waitForRequest(request) {
        return new Promise((resolve, reject) => {
            request.addEventListener("success", (event) => resolve(event.target.result), { once: true });
            request.addEventListener("error", reject, { once: true });
        });
    },
    init() {
        if(!this.db) {
            const request = globalThis.indexedDB.open(Database.DB_NAME, Database.DB_VERSION);
            request.addEventListener("upgradeneeded", (event) => {
                if(!Array.from(event.target.result.objectStoreNames).includes(Database.STORE_NAME)) {
                    event.target.result.createObjectStore(Database.STORE_NAME);
                }
            }, { once: true });
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
            request = store.put(blob, name);
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
    },
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
