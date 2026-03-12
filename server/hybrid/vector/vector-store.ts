import type { KnowledgeChunk, KnowledgeDomain } from '../types.js';

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: KnowledgeChunk;
}

export interface VectorSearchResult {
  score: number;
  payload: KnowledgeChunk;
}

export interface VectorSearchFilter {
  domain?: KnowledgeDomain;
}

export interface VectorStore {
  readonly backend: 'memory' | 'qdrant';
  isAvailable(): boolean;
  upsert(points: VectorPoint[]): Promise<void>;
  search(vector: number[], limit: number, filter?: VectorSearchFilter): Promise<VectorSearchResult[]>;
  count(): number;
}
