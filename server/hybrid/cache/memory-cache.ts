import type { CacheEnvelope } from '../types.js';
import { HybridCacheLayer, isExpiredEnvelope } from './cache-layer.js';

export class MemoryCacheLayer implements HybridCacheLayer {
  readonly name = 'l1_memory' as const;
  private readonly store = new Map<string, CacheEnvelope<unknown>>();

  isAvailable(): boolean {
    return true;
  }

  async get<T>(key: string): Promise<CacheEnvelope<T> | null> {
    const entry = this.store.get(key) as CacheEnvelope<T> | undefined;
    if (!entry) {
      return null;
    }

    if (isExpiredEnvelope(entry)) {
      this.store.delete(key);
      return null;
    }

    return entry;
  }

  async set<T>(key: string, envelope: CacheEnvelope<T>): Promise<void> {
    this.store.set(key, envelope as CacheEnvelope<unknown>);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
