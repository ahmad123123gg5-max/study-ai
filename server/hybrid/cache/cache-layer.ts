import type { CacheEnvelope, HybridCacheLayerName } from '../types.js';

export interface HybridCacheLayer {
  readonly name: HybridCacheLayerName;
  isAvailable(): boolean;
  get<T>(key: string): Promise<CacheEnvelope<T> | null>;
  set<T>(key: string, envelope: CacheEnvelope<T>): Promise<void>;
  delete(key: string): Promise<void>;
}

export const isExpiredEnvelope = <T>(envelope: CacheEnvelope<T>): boolean =>
  !envelope || envelope.expiresAt <= Date.now();
