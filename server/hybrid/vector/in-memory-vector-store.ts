import type { VectorPoint, VectorSearchFilter, VectorSearchResult, VectorStore } from './vector-store.js';

const cosineSimilarity = (left: number[], right: number[]): number => {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

export class InMemoryVectorStore implements VectorStore {
  readonly backend = 'memory' as const;
  private readonly points = new Map<string, VectorPoint>();

  isAvailable(): boolean {
    return true;
  }

  async upsert(points: VectorPoint[]): Promise<void> {
    points.forEach((point) => {
      this.points.set(point.id, point);
    });
  }

  async search(vector: number[], limit: number, filter?: VectorSearchFilter): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    this.points.forEach((point) => {
      if (filter?.domain && point.payload.domain !== filter.domain) {
        return;
      }

      results.push({
        score: cosineSimilarity(vector, point.vector),
        payload: point.payload
      });
    });

    return results
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  count(): number {
    return this.points.size;
  }
}
