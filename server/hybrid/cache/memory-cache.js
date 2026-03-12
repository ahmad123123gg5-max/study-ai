import { isExpiredEnvelope } from './cache-layer.js';
export class MemoryCacheLayer {
    name = 'l1_memory';
    store = new Map();
    isAvailable() {
        return true;
    }
    async get(key) {
        const entry = this.store.get(key);
        if (!entry) {
            return null;
        }
        if (isExpiredEnvelope(entry)) {
            this.store.delete(key);
            return null;
        }
        return entry;
    }
    async set(key, envelope) {
        this.store.set(key, envelope);
    }
    async delete(key) {
        this.store.delete(key);
    }
}
