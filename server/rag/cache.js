export class TTLCache {
    maxEntries;
    ttlMs;
    store = new Map();
    constructor(maxEntries, ttlMs) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
    }
    get(key) {
        this.pruneExpired();
        const entry = this.store.get(key);
        if (!entry) {
            return undefined;
        }
        if (entry.expiresAt <= Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        this.store.delete(key);
        this.store.set(key, entry);
        return entry.value;
    }
    set(key, value) {
        this.pruneExpired();
        if (this.store.has(key)) {
            this.store.delete(key);
        }
        this.store.set(key, {
            value,
            expiresAt: Date.now() + this.ttlMs
        });
        while (this.store.size > this.maxEntries) {
            const oldestKey = this.store.keys().next().value;
            if (typeof oldestKey !== 'string') {
                break;
            }
            this.store.delete(oldestKey);
        }
    }
    pruneExpired() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (entry.expiresAt <= now) {
                this.store.delete(key);
            }
        }
    }
}
