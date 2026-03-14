export type GroundingMode = 'off' | 'auto' | 'strict';
export type GroundingConfidence = 'none' | 'low' | 'medium' | 'high';
export type GroundingSourceType = 'knowledge_base' | 'attachment';

export interface GroundingSource {
  id: string;
  label: string;
  title: string;
  publisher?: string;
  url?: string;
  year?: number;
  domain: string;
  kind: string;
  score: number;
  sourceType: GroundingSourceType;
  snippet: string;
}

export interface GroundingMetadata {
  enabled: boolean;
  used: boolean;
  mode: GroundingMode;
  featureHint?: string;
  confidence: GroundingConfidence;
  insufficientKnowledge: boolean;
  responseCacheHit: boolean;
  queryCacheHit: boolean;
  embeddingCacheHit: boolean;
  retrievalMs: number;
  totalMs: number;
  sources: GroundingSource[];
}

export interface AIChatRequestOptions {
  featureHint?: string;
  knowledgeMode?: GroundingMode;
  maxTokens?: number;
  temperature?: number;
}

export interface AIChatResponsePayload {
  text: string;
  grounding?: GroundingMetadata;
  error?: string;
}
