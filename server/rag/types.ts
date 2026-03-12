export type KnowledgeDomain = 'medical' | 'nursing' | 'science' | 'engineering' | 'legal' | 'general' | 'attachment';
export type GroundingMode = 'off' | 'auto' | 'strict';
export type GroundingConfidence = 'none' | 'low' | 'medium' | 'high';
export type GroundingSourceType = 'knowledge_base' | 'attachment';

export interface KnowledgeSource {
  id: string;
  title: string;
  publisher: string;
  url?: string;
  year?: number;
  kind: string;
}

export interface KnowledgeDocumentSeed {
  id: string;
  domain: Exclude<KnowledgeDomain, 'attachment'>;
  title: string;
  keywords: string[];
  source: KnowledgeSource;
  chunks: string[];
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  domain: KnowledgeDomain;
  title: string;
  keywords: string[];
  text: string;
  source: KnowledgeSource;
  sourceType: GroundingSourceType;
  vector: Float32Array;
  norm: number;
  normalizedText: string;
  tokenSet: Set<string>;
  titleTokenSet: Set<string>;
  keywordTokenSet: Set<string>;
}

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

export interface GroundingRequest {
  message: string;
  systemInstruction?: string;
  historyText?: string;
  attachmentsText?: string;
  jsonMode: boolean;
  featureHint?: string;
  knowledgeMode?: GroundingMode;
  model?: string;
}

export interface PreparedGroundingResult {
  metadata: GroundingMetadata;
  systemPrompt?: string;
  responseCacheKey?: string;
  shortCircuitText?: string;
}

export interface CachedGroundingResponse {
  text: string;
  metadata: GroundingMetadata;
}
