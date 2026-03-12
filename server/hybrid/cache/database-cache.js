import fs from 'node:fs/promises';
import path from 'node:path';
import { isExpiredEnvelope } from './cache-layer.js';
export class DatabaseCacheLayer {
    filePath;
    name = 'l3_database';
    store = new Map();
    loaded = false;
    flushTimer = null;
    flushPromise = null;
    constructor(filePath) {
        this.filePath = filePath;
    }
    isAvailable() {
        return true;
    }
    async ensureLoaded() {
        if (this.loaded) {
            return;
        }
        this.loaded = true;
        try {
            const raw = await fs.readFile(this.filePath, 'utf8');
            const parsed = JSON.parse(raw);
            Object.entries(parsed.entries || {}).forEach(([key, value]) => {
                if (!isExpiredEnvelope(value)) {
                    this.store.set(key, value);
                }
            });
        }
        catch {
            // First boot or malformed cache file should not block the app.
        }
    }
    scheduleFlush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
        }
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushPromise = this.flushNow();
        }, 120);
    }
    async flushNow() {
        const payload = {
            entries: Object.fromEntries(this.store.entries()),
            updatedAt: new Date().toISOString()
        };
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const tempPath = `${this.filePath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(payload), 'utf8');
        await fs.rename(tempPath, this.filePath);
    }
    async get(key) {
        await this.ensureLoaded();
        const entry = this.store.get(key);
        if (!entry) {
            return null;
        }
        if (isExpiredEnvelope(entry)) {
            this.store.delete(key);
            this.scheduleFlush();
            return null;
        }
        return entry;
    }
    async set(key, envelope) {
        await this.ensureLoaded();
        this.store.set(key, envelope);
        this.scheduleFlush();
    }
    async delete(key) {
        await this.ensureLoaded();
        this.store.delete(key);
        this.scheduleFlush();
    }
    async drain() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
            this.flushPromise = this.flushNow();
        }
        await this.flushPromise;
    }
}
