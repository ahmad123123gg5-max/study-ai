import type {
  BackgroundJobStatus,
  HybridCacheLayerName,
  HybridRouteType,
  HybridSystemStatus,
  HybridUsageSnapshot
} from '../types.js';

const round = (value: number): number => Math.round(value * 100) / 100;

const percentile = (values: number[], ratio: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
};

export class HybridPerformanceMonitor {
  private readonly responseTimes: number[] = [];
  private readonly aiLatencies: number[] = [];
  private readonly vectorLatencies: number[] = [];
  private readonly routeCounts: Record<HybridRouteType, number> = {
    logic: 0,
    cache: 0,
    rag: 0,
    ai: 0,
    rag_ai: 0,
    job: 0
  };
  private readonly cacheHits: Record<HybridCacheLayerName, number> = {
    l1_memory: 0,
    l2_redis: 0,
    l3_database: 0,
    miss: 0
  };
  private readonly jobCounts: Record<BackgroundJobStatus, number> = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0
  };
  private aiRequestCount = 0;
  private aiPromptTokens = 0;
  private aiCompletionTokens = 0;
  private aiTotalTokens = 0;
  private indexedDocuments = 0;
  private latestIndexAt: string | null = null;

  constructor(private readonly sampleLimit: number) {}

  private pushSample(bucket: number[], value: number): void {
    bucket.push(value);
    if (bucket.length > this.sampleLimit) {
      bucket.shift();
    }
  }

  recordRequest(route: HybridRouteType, durationMs: number, cacheLayer: HybridCacheLayerName): void {
    this.routeCounts[route] += 1;
    this.cacheHits[cacheLayer] += 1;
    this.pushSample(this.responseTimes, durationMs);
  }

  recordAiUsage(latencyMs: number, usage?: HybridUsageSnapshot): void {
    this.aiRequestCount += 1;
    this.pushSample(this.aiLatencies, latencyMs);

    if (usage?.promptTokens) {
      this.aiPromptTokens += usage.promptTokens;
    }
    if (usage?.completionTokens) {
      this.aiCompletionTokens += usage.completionTokens;
    }
    if (usage?.totalTokens) {
      this.aiTotalTokens += usage.totalTokens;
    }
  }

  recordVectorSearch(durationMs: number): void {
    this.pushSample(this.vectorLatencies, durationMs);
  }

  recordKnowledgeIndex(count: number): void {
    this.indexedDocuments = count;
    this.latestIndexAt = new Date().toISOString();
  }

  recordJobStatus(status: BackgroundJobStatus): void {
    this.jobCounts[status] += 1;
  }

  snapshot(system: HybridSystemStatus) {
    const avgResponseMs = this.responseTimes.length === 0
      ? 0
      : this.responseTimes.reduce((sum, value) => sum + value, 0) / this.responseTimes.length;
    const avgAiMs = this.aiLatencies.length === 0
      ? 0
      : this.aiLatencies.reduce((sum, value) => sum + value, 0) / this.aiLatencies.length;
    const avgVectorMs = this.vectorLatencies.length === 0
      ? 0
      : this.vectorLatencies.reduce((sum, value) => sum + value, 0) / this.vectorLatencies.length;

    return {
      system,
      requests: {
        total: Object.values(this.routeCounts).reduce((sum, value) => sum + value, 0),
        byRoute: { ...this.routeCounts },
        avgResponseMs: round(avgResponseMs),
        p95ResponseMs: round(percentile(this.responseTimes, 0.95))
      },
      cache: {
        hits: { ...this.cacheHits },
        hitRate: round(
          (this.cacheHits.l1_memory + this.cacheHits.l2_redis + this.cacheHits.l3_database) /
          Math.max(1, Object.values(this.cacheHits).reduce((sum, value) => sum + value, 0))
        )
      },
      ai: {
        requests: this.aiRequestCount,
        avgLatencyMs: round(avgAiMs),
        p95LatencyMs: round(percentile(this.aiLatencies, 0.95)),
        usage: {
          promptTokens: this.aiPromptTokens,
          completionTokens: this.aiCompletionTokens,
          totalTokens: this.aiTotalTokens
        }
      },
      vector: {
        indexedDocuments: this.indexedDocuments,
        latestIndexAt: this.latestIndexAt,
        avgSearchMs: round(avgVectorMs),
        p95SearchMs: round(percentile(this.vectorLatencies, 0.95))
      },
      jobs: {
        ...this.jobCounts
      }
    };
  }
}
