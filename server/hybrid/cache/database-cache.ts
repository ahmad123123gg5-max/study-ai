import fs from 'node:fs/promises';
import path from 'node:path';
import type { CacheEnvelope } from '../types.js';
import { HybridCacheLayer, isExpiredEnvelope } from './cache-layer.js';

interface PersistedCacheShape {
  entries: Record<string, CacheEnvelope<unknown>>;
  updatedAt: string;
}

export class DatabaseCacheLayer implements HybridCacheLayer {
  readonly name = 'l3_database' as const;
  private readonly store = new Map<string, CacheEnvelope<unknown>>();
  private loaded = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushPromise: Promise<void> | null = null;

  constructor(private readonly filePath: string) {}

  isAvailable(): boolean {
    return true;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    this.loaded = true;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedCacheShape;
      Object.entries(parsed.entries || {}).forEach(([key, value]) => {
        if (!isExpiredEnvelope(value)) {
          this.store.set(key, value);
        }
      });
    } catch {
      // First boot or malformed cache file should not block the app.
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushPromise = this.flushNow();
    }, 120);
  }

  private async flushNow(): Promise<void> {
    const payload: PersistedCacheShape = {
      entries: Object.fromEntries(this.store.entries()),
      updatedAt: new Date().toISOString()
    };

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(payload), 'utf8');
    await fs.rename(tempPath, this.filePath);
  }

  async get<T>(key: string): Promise<CacheEnvelope<T> | null> {
    await this.ensureLoaded();
    const entry = this.store.get(key) as CacheEnvelope<T> | undefined;
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

  async set<T>(key: string, envelope: CacheEnvelope<T>): Promise<void> {
    await this.ensureLoaded();
    this.store.set(key, envelope as CacheEnvelope<unknown>);
    this.scheduleFlush();
  }

  async delete(key: string): Promise<void> {
    await this.ensureLoaded();
    this.store.delete(key);
    this.scheduleFlush();
  }

  async drain(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
      this.flushPromise = this.flushNow();
    }

    await this.flushPromise;
  }
}
