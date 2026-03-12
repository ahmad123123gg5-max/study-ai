import { getHybridRuntimeConfig } from './config.js';
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
import { EmbeddingService } from './vector/embedding-service.js';
import { InMemoryVectorStore } from './vector/in-memory-vector-store.js';
import { QdrantVectorStore } from './vector/qdrant-client.js';
import { BackgroundJobQueue } from './workers/background-job-queue.js';
export class HybridAIPlatform {
    apiKey;
    config;
    monitor;
    cache;
    knowledgeBase;
    router;
    logic;
    rag;
    ai;
    workers;
    optimizer;
    redisLayer;
    constructor(apiKey, config = getHybridRuntimeConfig()) {
        this.apiKey = apiKey;
        this.config = config;
        this.monitor = new HybridPerformanceMonitor(config.monitoring.recentSamples);
        this.redisLayer = new RedisCacheLayer(config.cache.redisUrl);
        this.cache = new MultiLevelCacheSystem([
            new MemoryCacheLayer(),
            this.redisLayer,
            new DatabaseCacheLayer(config.cache.dbFilePath)
        ], config.cache.defaultTtlMs, this.monitor);
        this.knowledgeBase = new LocalKnowledgeBase(config.knowledge.knowledgeDir);
        const embeddings = new EmbeddingService(apiKey, config.ai.embeddingModel, config.vector.dimensions, this.cache);
        const vectorStore = config.vector.qdrantUrl
            ? new QdrantVectorStore(config.vector.qdrantUrl, config.vector.qdrantApiKey, config.vector.collectionName, config.vector.dimensions)
            : new InMemoryVectorStore();
        this.router = new SmartRequestRouter();
        this.logic = new LogicEngine(this.knowledgeBase);
        this.rag = new RAGEngine(this.knowledgeBase, embeddings, vectorStore, this.monitor, config.vector.topK);
        this.optimizer = new AIHyperOptimizationEngine();
        this.ai = new AIEngine(apiKey, config.ai.fastModel, this.optimizer, this.monitor);
        this.workers = new BackgroundJobQueue(config.workers.concurrency, async (request) => this.handleChat(request, true), this.monitor);
    }
    systemStatus() {
        return {
            instanceId: this.config.runtime.instanceId,
            vectorBackend: this.rag.vectorBackend,
            redisEnabled: this.redisLayer.isAvailable(),
            backgroundWorkers: this.config.workers.concurrency,
            indexedDocuments: this.rag.indexedCount
        };
    }
    async handleChat(request, internalJob = false) {
        const startedAt = Date.now();
        const decision = this.router.classify(request);
        const cacheKey = this.optimizer.createResponseCacheKey(request, decision);
        if (decision.cacheable) {
            const cached = await this.cache.get(cacheKey);
            if (cached.value) {
                const response = {
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
        let groundedResults = [];
        let vectorSearchMs = 0;
        const logicFirst = await this.logic.resolve(request, groundedResults);
        if (logicFirst && logicFirst.route === 'logic') {
            const response = {
                text: logicFirst.text,
                route: 'logic',
                reason: logicFirst.reason,
                cacheLayer: 'miss',
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
                const response = {
                    text: ragResolution.text,
                    route: ragResolution.route,
                    reason: ragResolution.reason,
                    cacheLayer: 'miss',
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
            const response = {
                text: fallbackText,
                route: groundedResults.length > 0 ? 'rag' : 'logic',
                reason: decision.reason,
                cacheLayer: 'miss',
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
        const response = {
            text: generated.text,
            route,
            reason: decision.reason,
            cacheLayer: 'miss',
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
        if (decision.cacheable && !internalJob) {
            await this.cache.set(cacheKey, response);
        }
        this.monitor.recordRequest(route, Date.now() - startedAt, 'miss');
        return response;
    }
    async *streamChat(request) {
        const startedAt = Date.now();
        const decision = this.router.classify(request);
        const cacheKey = this.optimizer.createResponseCacheKey(request, decision);
        if (decision.cacheable) {
            const cached = await this.cache.get(cacheKey);
            if (cached.value) {
                yield { type: 'chunk', delta: cached.value.text };
                yield {
                    type: 'meta',
                    route: 'cache',
                    reason: 'Served from multi-level cache.',
                    cacheLayer: cached.layer,
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
        let groundedResults = [];
        let vectorSearchMs = 0;
        const logicFirst = await this.logic.resolve(request, groundedResults);
        if (logicFirst && logicFirst.route === 'logic') {
            yield { type: 'chunk', delta: logicFirst.text };
            yield {
                type: 'meta',
                route: 'logic',
                reason: logicFirst.reason,
                cacheLayer: 'miss',
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
            const finalEvent = {
                ...event,
                metrics: {
                    ...event.metrics,
                    durationMs: Date.now() - startedAt,
                    vectorSearchMs: vectorSearchMs || event.metrics.vectorSearchMs
                }
            };
            if (decision.cacheable) {
                await this.cache.set(cacheKey, {
                    text: fullText,
                    route: event.route,
                    reason: event.reason,
                    cacheLayer: 'miss',
                    groundedResults: event.groundedResults,
                    model: event.model,
                    metrics: finalEvent.metrics,
                    usage: event.usage,
                    cached: false
                });
            }
            this.monitor.recordRequest(event.route, Date.now() - startedAt, 'miss');
            yield finalEvent;
            return;
        }
    }
    async enqueueJob(type, request) {
        return this.workers.enqueue(type, request);
    }
    getJob(jobId) {
        return this.workers.get(jobId);
    }
    async reindexKnowledge() {
        await this.rag.reindex();
    }
    monitoringSnapshot() {
        return this.monitor.snapshot(this.systemStatus());
    }
}
