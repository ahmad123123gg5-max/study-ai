import type { CacheEnvelope, HybridCacheLayerName } from '../types.js';
import type { HybridPerformanceMonitor } from '../monitoring/performance-monitor.js';
import type { HybridCacheLayer } from './cache-layer.js';

export class MultiLevelCacheSystem {
  constructor(
    private readonly layers: HybridCacheLayer[],
    private readonly defaultTtlMs: number,
    private readonly monitor: HybridPerformanceMonitor
  ) {}

  private buildEnvelope<T>(value: T, ttlMs: number, metadata?: Record<string, unknown>): CacheEnvelope<T> {
    const createdAt = Date.now();
    return {
      value,
      createdAt,
      expiresAt: createdAt + ttlMs,
      metadata
    };
  }

  async get<T>(key: string): Promise<{ value: T | null; layer: HybridCacheLayerName }> {
    for (let index = 0; index < this.layers.length; index += 1) {
      const layer = this.layers[index];
      if (!layer.isAvailable()) {
        continue;
      }

      const entry = await layer.get<T>(key);
      if (!entry) {
        continue;
      }

      const promotionTargets = this.layers.slice(0, index);
      await Promise.all(promotionTargets
        .filter((target) => target.isAvailable())
        .map((target) => target.set<T>(key, entry)));

      return {
        value: entry.value,
        layer: layer.name
      };
    }

    return {
      value: null,
      layer: 'miss'
    };
  }

  async set<T>(
    key: string,
    value: T,
    ttlMs = this.defaultTtlMs,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const envelope = this.buildEnvelope(value, ttlMs, metadata);
    await Promise.all(this.layers
      .filter((layer) => layer.isAvailable())
      .map((layer) => layer.set<T>(key, envelope)));
  }

  async delete(key: string): Promise<void> {
    await Promise.all(this.layers
      .filter((layer) => layer.isAvailable())
      .map((layer) => layer.delete(key)));
  }

  recordCacheObservation(layer: HybridCacheLayerName): void {
    this.monitor.recordRequest('cache', 0, layer);
  }
}
