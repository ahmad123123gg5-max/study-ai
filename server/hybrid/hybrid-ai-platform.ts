import { fallbackKnowledgeValidationResult } from '../knowledge-validation.js';
import { getHybridRuntimeConfig, type HybridRuntimeConfig } from './config.js';
import { AIEngine } from './ai/ai-engine.js';
import { AIHyperOptimizationEngine } from './ai/ai-hyper-optimization-engine.js';
import { MultiLevelCacheSystem } from './cache/cache-system.js';
import { DatabaseCacheLayer } from './cache/database-cache.js';
import { MemoryCacheLayer } from './cache/memory-cache.js';
import { RedisCacheLayer } from './cache/redis-cache.js';
import { LocalKnowledgeBase } from './knowledge/knowledge-base.js';
import { LogicEngine } from './logic-engine.js';
import { HybridPerformanceMonitor } from './monitoring/performance-monitor.js';
import { RAGEngine } from './rag/rag-engine.js';
import { SmartRequestRouter } from './router/request-router.js';
import type {
  BackgroundJobRecord,
  BackgroundJobType,
  HybridChatRequest,
  HybridChatResponse,
  HybridStreamEvent,
  HybridSystemStatus
} from './types.js';
import { EmbeddingService } from './vector/embedding-service.js';
import { InMemoryVectorStore } from './vector/in-memory-vector-store.js';
import { QdrantVectorStore } from './vector/qdrant-client.js';
import { BackgroundJobQueue } from './workers/background-job-queue.js';

export class HybridAIPlatform {
  readonly config: HybridRuntimeConfig;
  readonly monitor: HybridPerformanceMonitor;
  private readonly cache: MultiLevelCacheSystem;
  private readonly knowledgeBase: LocalKnowledgeBase;
  private readonly router: SmartRequestRouter;
  private readonly logic: LogicEngine;
  private readonly rag: RAGEngine;
  private readonly ai: AIEngine;
  private readonly workers: BackgroundJobQueue;
  private readonly optimizer: AIHyperOptimizationEngine;
  private readonly redisLayer: RedisCacheLayer;

  constructor(private readonly apiKey: string | undefined, config = getHybridRuntimeConfig()) {
    this.config = config;
    this.monitor = new HybridPerformanceMonitor(config.monitoring.recentSamples);
    this.redisLayer = new RedisCacheLayer(config.cache.redisUrl);
    this.cache = new MultiLevelCacheSystem(
      [
        new MemoryCacheLayer(),
        this.redisLayer,
        new DatabaseCacheLayer(config.cache.dbFilePath)
      ],
      config.cache.defaultTtlMs,
      this.monitor
    );
    this.knowledgeBase = new LocalKnowledgeBase(config.knowledge.knowledgeDir);
    const embeddings = new EmbeddingService(apiKey, config.ai.embeddingModel, config.vector.dimensions, this.cache);
    const vectorStore = config.vector.qdrantUrl
      ? new QdrantVectorStore(
        config.vector.qdrantUrl,
        config.vector.qdrantApiKey,
        config.vector.collectionName,
        config.vector.dimensions
      )
      : new InMemoryVectorStore();

    this.router = new SmartRequestRouter();
    this.logic = new LogicEngine(this.knowledgeBase);
    this.rag = new RAGEngine(this.knowledgeBase, embeddings, vectorStore, this.monitor, config.vector.topK);
    this.optimizer = new AIHyperOptimizationEngine();
    this.ai = new AIEngine(apiKey, config.ai.fastModel, this.optimizer, this.monitor, config.ai.enableFullAuditOnLowRisk);
    this.workers = new BackgroundJobQueue(
      config.workers.concurrency,
      async (request) => this.handleChat(request, true),
      this.monitor
    );
  }

  private buildNonAiValidation(request: HybridChatRequest, text: string) {
    const validation = fallbackKnowledgeValidationResult(request.validationContext, text);
    return {
      ...validation,
      blocked: false,
      needsRevision: false,
      summary: request.validationContext.languageCode === 'ar'
        ? 'تمت الإجابة عبر المنطق أو قاعدة المعرفة بدون توليد نموذجي.'
        : 'Resolved through logic or grounded knowledge without model generation.'
    };
  }

  private systemStatus(): HybridSystemStatus {
    return {
      instanceId: this.config.runtime.instanceId,
      vectorBackend: this.rag.vectorBackend,
      redisEnabled: this.redisLayer.isAvailable(),
      backgroundWorkers: this.config.workers.concurrency,
      indexedDocuments: this.rag.indexedCount
    };
  }

  async handleChat(request: HybridChatRequest, internalJob = false): Promise<HybridChatResponse> {
    const startedAt = Date.now();
    const decision = this.router.classify(request);
    const cacheKey = this.optimizer.createResponseCacheKey(request, decision);

    if (decision.cacheable) {
      const cached = await this.cache.get<HybridChatResponse>(cacheKey);
      if (cached.value) {
        const response: HybridChatResponse = {
          ...cached.value,
          route: 'cache',
          cacheLayer: cached.layer,
          cached: true,
          metrics: {
            ...cached.value.metrics,
            cacheLayer: cached.layer,
            durationMs: Date.now() - startedAt
          }
        };
        this.monitor.recordRequest('cache', Date.now() - startedAt, cached.layer);
        return response;
      }
    }

    let groundedResults: HybridChatResponse['groundedResults'] = [];
    let vectorSearchMs = 0;

    const logicFirst = await this.logic.resolve(request, groundedResults);
    if (logicFirst && logicFirst.route === 'logic') {
      const response: HybridChatResponse = {
        text: logicFirst.text,
        route: 'logic',
        reason: logicFirst.reason,
        cacheLayer: 'miss',
        validation: this.buildNonAiValidation(request, logicFirst.text),
        groundedResults: logicFirst.groundedResults,
        model: 'logic-engine',
        metrics: {
          durationMs: Date.now() - startedAt,
          cacheLayer: 'miss'
        },
        cached: false
      };

      if (decision.cacheable) {
        await this.cache.set(cacheKey, response);
      }
      this.monitor.recordRequest('logic', Date.now() - startedAt, 'miss');
      return response;
    }

    if (decision.needsRag) {
      const rag = await this.rag.search(request);
      groundedResults = rag.results;
      vectorSearchMs = rag.durationMs;

      const ragResolution = await this.logic.resolve(request, groundedResults);
      if (ragResolution && (decision.canUseRagOnly || !decision.needsAi)) {
        const response: HybridChatResponse = {
          text: ragResolution.text,
          route: ragResolution.route,
          reason: ragResolution.reason,
          cacheLayer: 'miss',
          validation: this.buildNonAiValidation(request, ragResolution.text),
          groundedResults: ragResolution.groundedResults,
          model: ragResolution.route === 'logic' ? 'logic-engine' : 'rag-engine',
          metrics: {
            durationMs: Date.now() - startedAt,
            cacheLayer: 'miss',
            vectorSearchMs
          },
          cached: false
        };

        if (decision.cacheable) {
          await this.cache.set(cacheKey, response);
        }

        this.monitor.recordRequest(ragResolution.route, Date.now() - startedAt, 'miss');
        return response;
      }
    }

    if (!decision.needsAi) {
      const fallbackText = request.validationContext.languageCode === 'ar'
        ? 'لم يتم العثور على جواب حتمي من طبقة المنطق أو البحث الدلالي.'
        : 'No deterministic answer was found in the logic or semantic search layers.';
      const response: HybridChatResponse = {
        text: fallbackText,
        route: groundedResults.length > 0 ? 'rag' : 'logic',
        reason: decision.reason,
        cacheLayer: 'miss',
        validation: this.buildNonAiValidation(request, fallbackText),
        groundedResults,
        model: groundedResults.length > 0 ? 'rag-engine' : 'logic-engine',
        metrics: {
          durationMs: Date.now() - startedAt,
          cacheLayer: 'miss',
          vectorSearchMs
        },
        cached: false
      };
      this.monitor.recordRequest(response.route, Date.now() - startedAt, 'miss');
      return response;
    }

    const generated = await this.ai.generate(request, decision, groundedResults);
    const route = groundedResults.length > 0 ? 'rag_ai' : 'ai';
    const response: HybridChatResponse = {
      text: generated.text,
      route,
      reason: decision.reason,
      cacheLayer: 'miss',
      validation: generated.validation,
      groundedResults,
      model: generated.model,
      metrics: {
        durationMs: Date.now() - startedAt,
        cacheLayer: 'miss',
        vectorSearchMs: vectorSearchMs || undefined,
        aiLatencyMs: generated.aiLatencyMs
      },
      usage: generated.usage,
      cached: false
    };

    if (decision.cacheable && !internalJob && !generated.validation.blocked) {
      await this.cache.set(cacheKey, response);
    }

    this.monitor.recordRequest(route, Date.now() - startedAt, 'miss');
    return response;
  }

  async *streamChat(request: HybridChatRequest): AsyncGenerator<HybridStreamEvent> {
    const startedAt = Date.now();
    const decision = this.router.classify(request);
    const cacheKey = this.optimizer.createResponseCacheKey(request, decision);

    if (decision.cacheable) {
      const cached = await this.cache.get<HybridChatResponse>(cacheKey);
      if (cached.value) {
        yield { type: 'chunk', delta: cached.value.text };
        yield {
          type: 'meta',
          route: 'cache',
          reason: 'Served from multi-level cache.',
          cacheLayer: cached.layer,
          validation: cached.value.validation,
          groundedResults: cached.value.groundedResults,
          model: cached.value.model,
          metrics: {
            ...cached.value.metrics,
            cacheLayer: cached.layer,
            durationMs: Date.now() - startedAt
          },
          usage: cached.value.usage,
          cached: true
        };
        this.monitor.recordRequest('cache', Date.now() - startedAt, cached.layer);
        return;
      }
    }

    let groundedResults: HybridChatResponse['groundedResults'] = [];
    let vectorSearchMs = 0;

    const logicFirst = await this.logic.resolve(request, groundedResults);
    if (logicFirst && logicFirst.route === 'logic') {
      yield { type: 'chunk', delta: logicFirst.text };
      yield {
        type: 'meta',
        route: 'logic',
        reason: logicFirst.reason,
        cacheLayer: 'miss',
        validation: this.buildNonAiValidation(request, logicFirst.text),
        groundedResults: logicFirst.groundedResults,
        model: 'logic-engine',
        metrics: {
          durationMs: Date.now() - startedAt,
          cacheLayer: 'miss'
        },
        cached: false
      };
      this.monitor.recordRequest('logic', Date.now() - startedAt, 'miss');
      return;
    }

    if (decision.needsRag) {
      const rag = await this.rag.search(request);
      groundedResults = rag.results;
      vectorSearchMs = rag.durationMs;

      const ragResolution = await this.logic.resolve(request, groundedResults);
      if (ragResolution && (decision.canUseRagOnly || !decision.needsAi)) {
        yield { type: 'chunk', delta: ragResolution.text };
        yield {
          type: 'meta',
          route: ragResolution.route,
          reason: ragResolution.reason,
          cacheLayer: 'miss',
          validation: this.buildNonAiValidation(request, ragResolution.text),
          groundedResults: ragResolution.groundedResults,
          model: ragResolution.route === 'logic' ? 'logic-engine' : 'rag-engine',
          metrics: {
            durationMs: Date.now() - startedAt,
            cacheLayer: 'miss',
            vectorSearchMs
          },
          cached: false
        };
        this.monitor.recordRequest(ragResolution.route, Date.now() - startedAt, 'miss');
        return;
      }
    }

    let fullText = '';

    for await (const event of this.ai.stream(request, decision, groundedResults)) {
      if (event.type === 'chunk') {
        fullText += event.delta;
        yield event;
        continue;
      }

      const finalEvent: HybridStreamEvent = {
        ...event,
        metrics: {
          ...event.metrics,
          durationMs: Date.now() - startedAt,
          vectorSearchMs: vectorSearchMs || event.metrics.vectorSearchMs
        }
      };

      if (decision.cacheable && !event.validation.blocked) {
        await this.cache.set(cacheKey, {
          text: fullText,
          route: event.route,
          reason: event.reason,
          cacheLayer: 'miss',
          validation: event.validation,
          groundedResults: event.groundedResults,
          model: event.model,
          metrics: finalEvent.metrics,
          usage: event.usage,
          cached: false
        } satisfies HybridChatResponse);
      }

      this.monitor.recordRequest(event.route, Date.now() - startedAt, 'miss');
      yield finalEvent;
      return;
    }
  }

  async enqueueJob(type: BackgroundJobType, request: HybridChatRequest): Promise<BackgroundJobRecord> {
    return this.workers.enqueue(type, request);
  }

  getJob(jobId: string): BackgroundJobRecord | null {
    return this.workers.get(jobId);
  }

  async reindexKnowledge(): Promise<void> {
    await this.rag.reindex();
  }

  monitoringSnapshot() {
    return this.monitor.snapshot(this.systemStatus());
  }
}
