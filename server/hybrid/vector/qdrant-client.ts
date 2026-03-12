import type { VectorPoint, VectorSearchFilter, VectorSearchResult, VectorStore } from './vector-store.js';

interface QdrantSearchResult {
  score?: number;
  payload?: unknown;
}

export class QdrantVectorStore implements VectorStore {
  readonly backend = 'qdrant' as const;
  private collectionReady = false;
  private indexedCount = 0;

  constructor(
    private readonly qdrantUrl: string | undefined,
    private readonly apiKey: string | undefined,
    private readonly collectionName: string,
    private readonly dimensions: number
  ) {}

  isAvailable(): boolean {
    return !!this.qdrantUrl;
  }

  private get headers(): Record<string, string> {
    return this.apiKey
      ? { 'Content-Type': 'application/json', 'api-key': this.apiKey }
      : { 'Content-Type': 'application/json' };
  }

  private async ensureCollection(): Promise<void> {
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

  async upsert(points: VectorPoint[]): Promise<void> {
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

  async search(vector: number[], limit: number, filter?: VectorSearchFilter): Promise<VectorSearchResult[]> {
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

    const payload = await response.json().catch(() => null) as {
      result?: QdrantSearchResult[];
    } | null;

    return (payload?.result || [])
      .filter((item) => !!item?.payload)
      .map((item) => ({
        score: typeof item.score === 'number' ? item.score : 0,
        payload: item.payload as VectorPoint['payload']
      }));
  }

  count(): number {
    return this.indexedCount;
  }
}
