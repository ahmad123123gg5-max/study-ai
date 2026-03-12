import type { HybridPerformanceMonitor } from '../monitoring/performance-monitor.js';
import type { HybridChatRequest, RetrievedDocument } from '../types.js';
import type { LocalKnowledgeBase } from '../knowledge/knowledge-base.js';
import type { EmbeddingService } from '../vector/embedding-service.js';
import type { VectorStore } from '../vector/vector-store.js';

export class RAGEngine {
  private indexingPromise: Promise<void> | null = null;
  private indexedDocuments = 0;

  constructor(
    private readonly knowledgeBase: LocalKnowledgeBase,
    private readonly embeddings: EmbeddingService,
    private readonly vectorStore: VectorStore,
    private readonly monitor: HybridPerformanceMonitor,
    private readonly topK: number
  ) {}

  get vectorBackend(): 'memory' | 'qdrant' {
    return this.vectorStore.backend;
  }

  get indexedCount(): number {
    return this.indexedDocuments;
  }

  async ensureIndexed(): Promise<void> {
    if (this.indexingPromise) {
      await this.indexingPromise;
      return;
    }

    this.indexingPromise = (async () => {
      const chunks = await this.knowledgeBase.buildChunks();
      const vectors = await this.embeddings.embed(chunks.map((chunk) => chunk.content));

      await this.vectorStore.upsert(chunks.map((chunk, index) => ({
        id: chunk.id,
        vector: vectors[index],
        payload: chunk
      })));

      this.indexedDocuments = chunks.length;
      this.monitor.recordKnowledgeIndex(chunks.length);
    })();

    await this.indexingPromise;
  }

  async reindex(): Promise<void> {
    this.indexingPromise = null;
    await this.ensureIndexed();
  }

  async search(request: HybridChatRequest): Promise<{ results: RetrievedDocument[]; durationMs: number }> {
    const startedAt = Date.now();
    await this.ensureIndexed();
    const [queryVector] = await this.embeddings.embed([request.message]);
    const rawResults = await this.vectorStore.search(queryVector, this.topK * 3, {
      domain: request.validationContext.domain === 'general_academic'
        ? undefined
        : request.validationContext.domain
    });
    const durationMs = Date.now() - startedAt;
    this.monitor.recordVectorSearch(durationMs);

    const deduped = new Map<string, RetrievedDocument>();

    rawResults.forEach((entry) => {
      const current = deduped.get(entry.payload.documentId);
      if (current && current.score >= entry.score) {
        return;
      }

      deduped.set(entry.payload.documentId, {
        id: entry.payload.id,
        documentId: entry.payload.documentId,
        domain: entry.payload.domain,
        title: entry.payload.title,
        sourceTitle: entry.payload.sourceTitle,
        sourceFamily: entry.payload.sourceFamily,
        sourceType: entry.payload.sourceType,
        sourceUrl: entry.payload.sourceUrl,
        content: entry.payload.content,
        score: entry.score,
        tags: entry.payload.tags,
        updatedAt: entry.payload.updatedAt
      });
    });

    return {
      results: [...deduped.values()]
        .sort((left, right) => right.score - left.score)
        .slice(0, this.topK),
      durationMs
    };
  }
}
