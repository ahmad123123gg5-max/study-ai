export class RAGEngine {
    knowledgeBase;
    embeddings;
    vectorStore;
    monitor;
    topK;
    indexingPromise = null;
    indexedDocuments = 0;
    constructor(knowledgeBase, embeddings, vectorStore, monitor, topK) {
        this.knowledgeBase = knowledgeBase;
        this.embeddings = embeddings;
        this.vectorStore = vectorStore;
        this.monitor = monitor;
        this.topK = topK;
    }
    get vectorBackend() {
        return this.vectorStore.backend;
    }
    get indexedCount() {
        return this.indexedDocuments;
    }
    async ensureIndexed() {
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
    async reindex() {
        this.indexingPromise = null;
        await this.ensureIndexed();
    }
    async search(request) {
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
        const deduped = new Map();
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
