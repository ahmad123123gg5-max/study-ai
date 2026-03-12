import type { KnowledgeValidationContext } from '../knowledge-validation.js';

export type HybridCacheLayerName = 'l1_memory' | 'l2_redis' | 'l3_database' | 'miss';
export type HybridRouteType = 'logic' | 'cache' | 'rag' | 'ai' | 'rag_ai' | 'job';
export type HybridRequestComplexity = 'simple' | 'moderate' | 'heavy';
export type KnowledgeDomain =
  | 'medical'
  | 'engineering'
  | 'law'
  | 'general_science'
  | 'general_academic';

export interface HybridChatTextPart {
  type: 'text';
  text: string;
}

export interface HybridChatImagePart {
  type: 'image_url';
  image_url: {
    url: string;
  };
}

export type HybridChatContent = string | Array<HybridChatTextPart | HybridChatImagePart>;

export interface HybridChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: HybridChatContent;
}

export interface CacheEnvelope<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeDocument {
  id: string;
  domain: KnowledgeDomain;
  title: string;
  sourceTitle: string;
  sourceFamily: string;
  sourceType: 'guideline' | 'textbook' | 'policy' | 'internal' | 'reference';
  sourceUrl?: string;
  summaryAr?: string;
  summaryEn?: string;
  quickFactsAr?: string[];
  quickFactsEn?: string[];
  content: string;
  tags: string[];
  keywords: string[];
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  domain: KnowledgeDomain;
  title: string;
  sourceTitle: string;
  sourceFamily: string;
  sourceType: KnowledgeDocument['sourceType'];
  sourceUrl?: string;
  content: string;
  ordinal: number;
  tags: string[];
  keywords: string[];
  updatedAt: string;
}

export interface RetrievedDocument {
  id: string;
  documentId: string;
  domain: KnowledgeDomain;
  title: string;
  sourceTitle: string;
  sourceFamily: string;
  sourceType: KnowledgeDocument['sourceType'];
  sourceUrl?: string;
  content: string;
  score: number;
  tags: string[];
  updatedAt: string;
}

export interface HybridRoutingDecision {
  route: HybridRouteType;
  complexity: HybridRequestComplexity;
  reason: string;
  cacheable: boolean;
  needsRag: boolean;
  canUseRagOnly: boolean;
  needsAi: boolean;
  allowStreaming: boolean;
  backgroundCandidate: boolean;
  preferredModel?: string;
}

export interface HybridChatRequest {
  message: string;
  systemInstruction: string;
  jsonMode: boolean;
  model: string;
  maxTokens?: number;
  historyMessages: HybridChatMessage[];
  attachmentText?: string;
  attachmentImages?: HybridChatImagePart[];
  attachmentNotes?: string[];
  validationContext: KnowledgeValidationContext;
  userId?: string;
  preferBackground?: boolean;
  stream?: boolean;
  rawFilesCount?: number;
  featureHint?: string;
  knowledgeMode?: 'off' | 'auto' | 'strict';
}

export interface HybridUsageSnapshot {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface HybridResponseMetrics {
  durationMs: number;
  cacheLayer: HybridCacheLayerName;
  vectorSearchMs?: number;
  aiLatencyMs?: number;
}

export interface HybridChatResponse {
  text: string;
  route: HybridRouteType;
  reason: string;
  cacheLayer: HybridCacheLayerName;
  groundedResults: RetrievedDocument[];
  model: string;
  metrics: HybridResponseMetrics;
  usage?: HybridUsageSnapshot;
  cached: boolean;
}

export type HybridStreamEvent =
  | { type: 'chunk'; delta: string }
  | {
    type: 'meta';
    route: HybridRouteType;
    reason: string;
    cacheLayer: HybridCacheLayerName;
    groundedResults: RetrievedDocument[];
    model: string;
    metrics: HybridResponseMetrics;
    usage?: HybridUsageSnapshot;
    cached: boolean;
  };

export type BackgroundJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type BackgroundJobType =
  | 'quiz_generation'
  | 'file_analysis'
  | 'medical_case_generation'
  | 'ai_chat';

export interface BackgroundJobRecord {
  id: string;
  type: BackgroundJobType;
  status: BackgroundJobStatus;
  createdAt: string;
  updatedAt: string;
  request: HybridChatRequest;
  response?: HybridChatResponse;
  error?: string;
}

export interface HybridSystemStatus {
  instanceId: string;
  vectorBackend: 'memory' | 'qdrant';
  redisEnabled: boolean;
  backgroundWorkers: number;
  indexedDocuments: number;
}
