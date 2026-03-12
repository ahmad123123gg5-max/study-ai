export class QdrantVectorStore {
    qdrantUrl;
    apiKey;
    collectionName;
    dimensions;
    backend = 'qdrant';
    collectionReady = false;
    indexedCount = 0;
    constructor(qdrantUrl, apiKey, collectionName, dimensions) {
        this.qdrantUrl = qdrantUrl;
        this.apiKey = apiKey;
        this.collectionName = collectionName;
        this.dimensions = dimensions;
    }
    isAvailable() {
        return !!this.qdrantUrl;
    }
    get headers() {
        return this.apiKey
            ? { 'Content-Type': 'application/json', 'api-key': this.apiKey }
            : { 'Content-Type': 'application/json' };
    }
    async ensureCollection() {
        if (!this.qdrantUrl || this.collectionReady) {
            return;
        }
        const baseUrl = this.qdrantUrl.replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/collections/${this.collectionName}`, {
            method: 'PUT',
            headers: this.headers,
            body: JSON.stringify({
                vectors: {
                    size: this.dimensions,
                    distance: 'Cosine'
                }
            })
        });
        if (!response.ok && response.status !== 409) {
            throw new Error(`Qdrant collection setup failed (${response.status})`);
        }
        this.collectionReady = true;
    }
    async upsert(points) {
        if (!this.qdrantUrl || points.length === 0) {
            return;
        }
        await this.ensureCollection();
        const baseUrl = this.qdrantUrl.replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/collections/${this.collectionName}/points?wait=true`, {
            method: 'PUT',
            headers: this.headers,
            body: JSON.stringify({
                points: points.map((point) => ({
                    id: point.id,
                    vector: point.vector,
                    payload: point.payload
                }))
            })
        });
        if (!response.ok) {
            throw new Error(`Qdrant upsert failed (${response.status})`);
        }
        this.indexedCount += points.length;
    }
    async search(vector, limit, filter) {
        if (!this.qdrantUrl) {
            return [];
        }
        await this.ensureCollection();
        const baseUrl = this.qdrantUrl.replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/collections/${this.collectionName}/points/search`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                vector,
                limit,
                with_payload: true,
                ...(filter?.domain
                    ? {
                        filter: {
                            must: [
                                {
                                    key: 'domain',
                                    match: { value: filter.domain }
                                }
                            ]
                        }
                    }
                    : {})
            })
        });
        if (!response.ok) {
            throw new Error(`Qdrant search failed (${response.status})`);
        }
        const payload = await response.json().catch(() => null);
        return (payload?.result || [])
            .filter((item) => !!item?.payload)
            .map((item) => ({
            score: typeof item.score === 'number' ? item.score : 0,
            payload: item.payload
        }));
    }
    count() {
        return this.indexedCount;
    }
}
