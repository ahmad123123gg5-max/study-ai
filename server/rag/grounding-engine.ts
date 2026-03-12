import { createHash } from 'crypto';
import { TTLCache } from './cache.js';
import { KNOWLEDGE_BASE_SEEDS } from './knowledge-base.js';
import {
  CachedGroundingResponse,
  GroundingConfidence,
  GroundingMetadata,
  GroundingMode,
  GroundingRequest,
  GroundingSource,
  KnowledgeChunk,
  KnowledgeDocumentSeed,
  KnowledgeDomain,
  PreparedGroundingResult
} from './types.js';

const VECTOR_DIMENSIONS = 256;
const TOP_K = 4;
const MAX_SOURCE_SNIPPET_CHARS = 520;
const MAX_HISTORY_CHARS = 1000;
const MAX_ATTACHMENT_CHUNKS = 10;
const INSUFFICIENT_KNOWLEDGE_MESSAGE =
  'The available knowledge base does not contain enough verified information for this question.';

const RESPONSE_CACHE_TTL_MS = 1000 * 60 * 20;
const QUERY_CACHE_TTL_MS = 1000 * 60 * 10;
const EMBEDDING_CACHE_TTL_MS = 1000 * 60 * 30;

const STRICT_FEATURES = new Set([
  'tutor',
  'simulation',
  'quiz',
  'research',
  'mindmap',
  'knowledge',
  'teacher',
  'content'
]);

const CREATIVE_HINT_RE =
  /\b(motivat(?:e|ion)|mood|emotion|quote|poem|story|creative|brainstorm|tagline|slogan|marketing|rewrite|paraphrase|translate)\b/i;

const EDUCATIONAL_HINT_RE =
  /\b(student|teacher|lesson|chapter|study|tutor|quiz|research|explain|explanation|summar(?:y|ize)|topic|academic|exam|simulation|lab|grounding|medical|nursing|engineering|legal|science|course)\b/i;

const FOLLOW_UP_HINT_RE =
  /\b(explain|clarify|expand|continue|summarize|summarise|more|again|that|this|these|those|why|how)\b/i;

const ENGLISH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'if', 'in', 'into',
  'is', 'it', 'of', 'on', 'or', 'that', 'the', 'their', 'there', 'these', 'this', 'to', 'was', 'were',
  'will', 'with', 'you', 'your', 'about', 'after', 'all', 'also', 'any', 'can', 'did', 'does', 'each',
  'how', 'its', 'more', 'not', 'only', 'other', 'our', 'should', 'than', 'them', 'then', 'they', 'what',
  'when', 'which', 'who', 'why', 'would'
]);

const ARABIC_STOP_WORDS = new Set([
  'في', 'من', 'على', 'الى', 'إلى', 'عن', 'ما', 'ماذا', 'هذا', 'هذه', 'ذلك', 'تلك', 'هو', 'هي', 'هم',
  'ثم', 'أو', 'او', 'و', 'كما', 'لكن', 'إذا', 'اذا', 'هل', 'كل', 'قد', 'تم', 'كان', 'كانت', 'يكون',
  'تكون', 'هناك', 'هنا', 'مع', 'بين', 'بعد', 'قبل', 'أي', 'اي', 'أيضا', 'ايضا', 'حتى', 'لدى', 'عند'
]);

const DOMAIN_KEYWORDS: Record<Exclude<KnowledgeDomain, 'attachment'>, string[]> = {
  medical: [
    'medical', 'medicine', 'patient', 'diagnosis', 'treatment', 'sepsis', 'cpr', 'cardiac', 'airway',
    'oxygen', 'vitals', 'infection', 'resuscitation', 'clinical', 'heart', 'ضغط', 'نبض', 'مريض', 'تشخيص',
    'علاج', 'إنتان', 'انعاش', 'قلبي', 'تنفس', 'اكسجين', 'اكسجين', 'حيويه'
  ],
  nursing: [
    'nursing', 'nurse', 'care plan', 'assessment', 'implementation', 'evaluation', 'adpie', 'delegation',
    'prioritization', 'patient safety', 'تمريض', 'ممرض', 'خطة رعاية', 'تقييم', 'تنفيذ', 'تقويم', 'أولويات',
    'اولويات', 'سلامة'
  ],
  science: [
    'science', 'scientific', 'biology', 'chemistry', 'physics', 'experiment', 'hypothesis', 'variable',
    'homeostasis', 'measurement', 'precision', 'accuracy', 'علم', 'أحياء', 'احياء', 'كيمياء', 'فيزياء',
    'تجربة', 'فرضية', 'متغير', 'اتزان', 'قياس'
  ],
  engineering: [
    'engineering', 'system', 'requirements', 'verification', 'validation', 'cybersecurity', 'incident',
    'risk', 'framework', 'recover', 'containment', 'design', 'هندسة', 'نظام', 'متطلبات', 'تحقق', 'اعتماد',
    'امن', 'سيبراني', 'حادث', 'مخاطر', 'تصميم'
  ],
  legal: [
    'legal', 'law', 'evidence', 'negligence', 'liability', 'hearsay', 'court', 'rule', 'damages',
    'causation', 'قانون', 'قانوني', 'اثبات', 'إثبات', 'أدلة', 'ادلة', 'اهمال', 'مسؤولية', 'محكمة', 'تعويض'
  ],
  general: ['education', 'learning', 'student', 'explain', 'teach', 'study', 'تعلم', 'تعليم', 'طالب', 'شرح']
};

interface EmbeddedText {
  normalizedText: string;
  tokenSet: Set<string>;
  vector: Float32Array;
  norm: number;
}

interface RawChunk {
  id: string;
  documentId: string;
  domain: KnowledgeDomain;
  title: string;
  keywords: string[];
  text: string;
  source: KnowledgeChunk['source'];
  sourceType: KnowledgeChunk['sourceType'];
  normalizedText: string;
  tokenSet: Set<string>;
  titleTokenSet: Set<string>;
  keywordTokenSet: Set<string>;
}

interface RetrievalResult {
  confidence: GroundingConfidence;
  queryCacheHit: boolean;
  embeddingCacheHit: boolean;
  retrievalMs: number;
  promptSources: GroundingSource[];
  contextBlocks: string[];
}

interface QueryCacheEntry {
  confidence: GroundingConfidence;
  promptSources: GroundingSource[];
  contextBlocks: string[];
}

const toHash = (value: string): string => createHash('sha1').update(value).digest('hex');

const normalizeArabic = (value: string): string =>
  value
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '');

const normalizeSemanticText = (value: string): string =>
  normalizeArabic(value.toLowerCase())
    .replace(/[`~!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string): string[] =>
  normalizeSemanticText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !ENGLISH_STOP_WORDS.has(token))
    .filter((token) => !ARABIC_STOP_WORDS.has(token));

const truncateSnippet = (value: string, maxChars: number = MAX_SOURCE_SNIPPET_CHARS): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars).trim()}...`;
};

const fnv1aHash = (value: string, seed: number): number => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const cosineSimilarity = (
  leftVector: Float32Array,
  leftNorm: number,
  rightVector: Float32Array,
  rightNorm: number
): number => {
  if (!leftNorm || !rightNorm) {
    return 0;
  }

  let dot = 0;
  for (let index = 0; index < leftVector.length; index += 1) {
    dot += leftVector[index] * rightVector[index];
  }

  return dot / (leftNorm * rightNorm);
};

const overlapRatio = (queryTokens: Set<string>, candidateTokens: Set<string>): number => {
  if (!queryTokens.size || !candidateTokens.size) {
    return 0;
  }

  let matches = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / queryTokens.size;
};

const chunkLongText = (value: string, maxChunkLength: number = 780): string[] => {
  const normalized = value.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }

    if ((current.length + paragraph.length + 2) <= maxChunkLength) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }

    chunks.push(current);
    current = paragraph;
    if (chunks.length >= MAX_ATTACHMENT_CHUNKS) {
      break;
    }
  }

  if (current && chunks.length < MAX_ATTACHMENT_CHUNKS) {
    chunks.push(current);
  }

  if (chunks.length > 0) {
    return chunks.slice(0, MAX_ATTACHMENT_CHUNKS);
  }

  const fallbackChunks: string[] = [];
  for (let start = 0; start < normalized.length && fallbackChunks.length < MAX_ATTACHMENT_CHUNKS; start += maxChunkLength - 120) {
    fallbackChunks.push(normalized.slice(start, start + maxChunkLength).trim());
  }
  return fallbackChunks.filter(Boolean);
};

export class GroundingEngine {
  private readonly responseCache = new TTLCache<CachedGroundingResponse>(300, RESPONSE_CACHE_TTL_MS);
  private readonly queryCache = new TTLCache<QueryCacheEntry>(500, QUERY_CACHE_TTL_MS);
  private readonly embeddingCache = new TTLCache<EmbeddedText>(900, EMBEDDING_CACHE_TTL_MS);
  private readonly documentFrequency = new Map<string, number>();
  private readonly chunkCount: number;
  private readonly chunks: KnowledgeChunk[];

  constructor(seeds: KnowledgeDocumentSeed[] = KNOWLEDGE_BASE_SEEDS) {
    const rawChunks = this.buildRawChunks(seeds);
    this.chunkCount = rawChunks.length;
    this.chunks = rawChunks.map((chunk) => this.finalizeChunk(chunk));
  }

  prepare(request: GroundingRequest): PreparedGroundingResult {
    const mode = this.normalizeMode(request.knowledgeMode);
    const featureHint = typeof request.featureHint === 'string' && request.featureHint.trim()
      ? request.featureHint.trim().toLowerCase()
      : undefined;
    const enabled = this.shouldEnableGrounding(request, mode, featureHint);
    const baseMetadata: GroundingMetadata = {
      enabled,
      used: false,
      mode,
      featureHint,
      confidence: 'none',
      insufficientKnowledge: false,
      responseCacheHit: false,
      queryCacheHit: false,
      embeddingCacheHit: false,
      retrievalMs: 0,
      totalMs: 0,
      sources: []
    };

    if (!enabled) {
      return { metadata: baseMetadata };
    }

    const retrieval = this.retrieve(request, featureHint);
    const metadata: GroundingMetadata = {
      ...baseMetadata,
      used: retrieval.promptSources.length > 0,
      confidence: retrieval.confidence,
      queryCacheHit: retrieval.queryCacheHit,
      embeddingCacheHit: retrieval.embeddingCacheHit,
      retrievalMs: retrieval.retrievalMs,
      sources: retrieval.promptSources
    };

    if (retrieval.promptSources.length === 0 && this.shouldShortCircuit(request, mode, featureHint)) {
      return {
        metadata: {
          ...metadata,
          insufficientKnowledge: true
        },
        shortCircuitText: INSUFFICIENT_KNOWLEDGE_MESSAGE
      };
    }

    if (retrieval.promptSources.length === 0) {
      return { metadata };
    }

    const responseCacheKey = this.buildResponseCacheKey(request, retrieval.promptSources);
    return {
      metadata,
      systemPrompt: this.buildGroundingPrompt(request, retrieval.contextBlocks),
      responseCacheKey
    };
  }

  getCachedResponse(key?: string): CachedGroundingResponse | undefined {
    if (!key) {
      return undefined;
    }

    const cached = this.responseCache.get(key);
    if (!cached) {
      return undefined;
    }

    return {
      text: cached.text,
      metadata: this.cloneMetadata(cached.metadata)
    };
  }

  cacheResponse(key: string | undefined, text: string, metadata: GroundingMetadata): void {
    if (!key || !text.trim()) {
      return;
    }

    this.responseCache.set(key, {
      text,
      metadata: this.cloneMetadata(metadata)
    });
  }

  createInsufficientKnowledgeMessage(): string {
    return INSUFFICIENT_KNOWLEDGE_MESSAGE;
  }

  cloneMetadata(metadata: GroundingMetadata): GroundingMetadata {
    return {
      ...metadata,
      sources: metadata.sources.map((source) => ({ ...source }))
    };
  }

  private normalizeMode(mode: GroundingRequest['knowledgeMode']): GroundingMode {
    return mode === 'strict' || mode === 'off' ? mode : 'auto';
  }

  private shouldEnableGrounding(request: GroundingRequest, mode: GroundingMode, featureHint?: string): boolean {
    if (mode === 'off') {
      return false;
    }

    if (request.attachmentsText?.trim()) {
      return true;
    }

    if (mode === 'strict') {
      return true;
    }

    if (featureHint && STRICT_FEATURES.has(featureHint)) {
      return true;
    }

    const composite = `${request.systemInstruction || ''}\n${request.message}`;
    if (CREATIVE_HINT_RE.test(composite)) {
      return false;
    }

    return EDUCATIONAL_HINT_RE.test(composite);
  }

  private shouldShortCircuit(request: GroundingRequest, mode: GroundingMode, featureHint?: string): boolean {
    if (request.jsonMode) {
      return false;
    }

    if (request.attachmentsText?.trim()) {
      return true;
    }

    return mode === 'strict' || Boolean(featureHint && STRICT_FEATURES.has(featureHint));
  }

  private buildRawChunks(seeds: KnowledgeDocumentSeed[]): RawChunk[] {
    const rawChunks: RawChunk[] = [];

    for (const seed of seeds) {
      seed.chunks.forEach((text, index) => {
        const normalizedText = normalizeSemanticText(text);
        const tokenSet = new Set(tokenize(text));
        const titleTokenSet = new Set(tokenize(seed.title));
        const keywordTokenSet = new Set(tokenize(seed.keywords.join(' ')));

        for (const token of tokenSet) {
          this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
        }

        rawChunks.push({
          id: `${seed.id}-chunk-${index + 1}`,
          documentId: seed.id,
          domain: seed.domain,
          title: seed.title,
          keywords: seed.keywords,
          text: text.trim(),
          source: seed.source,
          sourceType: 'knowledge_base',
          normalizedText,
          tokenSet,
          titleTokenSet,
          keywordTokenSet
        });
      });
    }

    return rawChunks;
  }

  private finalizeChunk(chunk: RawChunk): KnowledgeChunk {
    const embedded = this.embedText(chunk.text);
    return {
      id: chunk.id,
      documentId: chunk.documentId,
      domain: chunk.domain,
      title: chunk.title,
      keywords: chunk.keywords,
      text: chunk.text,
      source: chunk.source,
      sourceType: chunk.sourceType,
      normalizedText: embedded.normalizedText,
      tokenSet: embedded.tokenSet,
      titleTokenSet: chunk.titleTokenSet,
      keywordTokenSet: chunk.keywordTokenSet,
      vector: embedded.vector,
      norm: embedded.norm
    };
  }

  private embedText(value: string): EmbeddedText {
    const normalizedText = normalizeSemanticText(value);
    const cached = this.embeddingCache.get(normalizedText);
    if (cached) {
      return {
        normalizedText: cached.normalizedText,
        tokenSet: new Set(cached.tokenSet),
        vector: Float32Array.from(cached.vector),
        norm: cached.norm
      };
    }

    const tokens = tokenize(value);
    const counts = new Map<string, number>();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    const vector = new Float32Array(VECTOR_DIMENSIONS);
    for (const [token, count] of counts.entries()) {
      const df = this.documentFrequency.get(token) || 1;
      const idf = 1 + Math.log((this.chunkCount + 1) / (df + 1));
      const weight = (1 + Math.log(count)) * idf;
      const bucket = fnv1aHash(token, 2166136261) % VECTOR_DIMENSIONS;
      const sign = (fnv1aHash(token, 16777619) & 1) === 0 ? 1 : -1;
      vector[bucket] += weight * sign;
    }

    let norm = 0;
    for (let index = 0; index < vector.length; index += 1) {
      norm += vector[index] * vector[index];
    }

    const embedded: EmbeddedText = {
      normalizedText,
      tokenSet: new Set(counts.keys()),
      vector,
      norm: Math.sqrt(norm)
    };

    this.embeddingCache.set(normalizedText, {
      normalizedText: embedded.normalizedText,
      tokenSet: new Set(embedded.tokenSet),
      vector: Float32Array.from(embedded.vector),
      norm: embedded.norm
    });

    return embedded;
  }

  private retrieve(request: GroundingRequest, featureHint?: string): RetrievalResult {
    const startedAt = performance.now();
    const historyText = (request.historyText || '').slice(-MAX_HISTORY_CHARS).trim();
    const queryText = this.buildQueryText(request.message, historyText);
    const predictedDomain = this.detectDomain(`${request.systemInstruction || ''}\n${queryText}`, featureHint);
    const attachmentsHash = request.attachmentsText?.trim() ? toHash(request.attachmentsText.trim()) : '';
    const queryCacheKey = toHash([
      predictedDomain,
      featureHint || '',
      request.jsonMode ? 'json' : 'text',
      queryText,
      attachmentsHash
    ].join('|'));

    const cached = this.queryCache.get(queryCacheKey);
    if (cached) {
      return {
        confidence: cached.confidence,
        queryCacheHit: true,
        embeddingCacheHit: true,
        retrievalMs: performance.now() - startedAt,
        promptSources: cached.promptSources.map((source) => ({ ...source })),
        contextBlocks: [...cached.contextBlocks]
      };
    }

    const queryNormalized = normalizeSemanticText(queryText);
    const queryEmbeddingCached = Boolean(this.embeddingCache.get(queryNormalized));
    const queryEmbedding = this.embedText(queryText);
    const attachmentChunks = this.buildAttachmentChunks(request.attachmentsText);
    const candidates = [...attachmentChunks, ...this.chunks];

    const ranked = candidates
      .map((chunk) => ({
        chunk,
        score: this.scoreChunk(queryEmbedding, chunk, predictedDomain)
      }))
      .filter((candidate) => candidate.score >= 0.18)
      .sort((left, right) => right.score - left.score);

    const uniqueSources = new Map<string, { chunk: KnowledgeChunk; score: number }>();
    for (const item of ranked) {
      const sourceKey = `${item.chunk.sourceType}:${item.chunk.source.id}`;
      const existing = uniqueSources.get(sourceKey);
      if (!existing || item.score > existing.score) {
        uniqueSources.set(sourceKey, item);
      }
      if (uniqueSources.size >= TOP_K) {
        break;
      }
    }

    const selected = [...uniqueSources.values()]
      .sort((left, right) => right.score - left.score)
      .slice(0, TOP_K);

    const promptSources = selected.map((item, index) => this.toGroundingSource(item.chunk, item.score, index + 1));
    const confidence = this.measureConfidence(selected.map((item) => item.score));
    const contextBlocks = promptSources.map((source, index) => {
      const publisher = source.publisher ? `Publisher: ${source.publisher}` : '';
      const url = source.url ? `URL: ${source.url}` : '';
      return [
        `[${index + 1}] ${source.title}`,
        `Domain: ${source.domain}`,
        `Kind: ${source.kind}`,
        publisher,
        url,
        'Verified context:',
        source.snippet
      ].filter(Boolean).join('\n');
    });

    this.queryCache.set(queryCacheKey, {
      confidence,
      promptSources: promptSources.map((source) => ({ ...source })),
      contextBlocks: [...contextBlocks]
    });

    return {
      confidence,
      queryCacheHit: false,
      embeddingCacheHit: queryEmbeddingCached,
      retrievalMs: performance.now() - startedAt,
      promptSources,
      contextBlocks
    };
  }

  private buildAttachmentChunks(attachmentsText?: string): KnowledgeChunk[] {
    if (!attachmentsText?.trim()) {
      return [];
    }

    const sections = attachmentsText
      .split(/\n\s*---\s*\n/g)
      .map((section) => section.trim())
      .filter(Boolean)
      .slice(0, 4);

    const chunks: KnowledgeChunk[] = [];

    sections.forEach((section, sectionIndex) => {
      const nameMatch = section.match(/Document:\s*(.+)/i);
      const mimeMatch = section.match(/MIME:\s*(.+)/i);
      const sourceLabel = nameMatch?.[1]?.trim() || `Attachment ${sectionIndex + 1}`;
      const sourceTitle = mimeMatch?.[1]?.trim()
        ? `${sourceLabel} (${mimeMatch[1].trim()})`
        : sourceLabel;
      const extracted = section.includes('Extracted content:')
        ? section.slice(section.indexOf('Extracted content:') + 'Extracted content:'.length).trim()
        : section;

      chunkLongText(extracted).forEach((text, chunkIndex) => {
        const raw: RawChunk = {
          id: `attachment-${sectionIndex + 1}-${chunkIndex + 1}`,
          documentId: `attachment-${sectionIndex + 1}`,
          domain: 'attachment',
          title: sourceTitle,
          keywords: [sourceLabel, mimeMatch?.[1]?.trim() || 'attachment'],
          text,
          source: {
            id: `attachment-${sectionIndex + 1}`,
            title: sourceTitle,
            publisher: 'Uploaded file',
            kind: 'attachment'
          },
          sourceType: 'attachment',
          normalizedText: normalizeSemanticText(text),
          tokenSet: new Set(tokenize(text)),
          titleTokenSet: new Set(tokenize(sourceTitle)),
          keywordTokenSet: new Set(tokenize(sourceLabel))
        };

        const embedded = this.embedText(text);
        chunks.push({
          id: raw.id,
          documentId: raw.documentId,
          domain: 'attachment',
          title: raw.title,
          keywords: raw.keywords,
          text: raw.text,
          source: raw.source,
          sourceType: 'attachment',
          normalizedText: embedded.normalizedText,
          tokenSet: embedded.tokenSet,
          titleTokenSet: raw.titleTokenSet,
          keywordTokenSet: raw.keywordTokenSet,
          vector: embedded.vector,
          norm: embedded.norm
        });
      });
    });

    return chunks;
  }

  private buildQueryText(message: string, historyText: string): string {
    const normalizedMessage = message.trim();
    if (!historyText) {
      return normalizedMessage;
    }

    if (normalizedMessage.length < 80 || FOLLOW_UP_HINT_RE.test(normalizedMessage)) {
      return `${historyText}\n${normalizedMessage}`.trim();
    }

    return normalizedMessage;
  }

  private detectDomain(value: string, featureHint?: string): KnowledgeDomain {
    const normalized = normalizeSemanticText([featureHint || '', value].join(' '));
    let bestDomain: KnowledgeDomain = 'general';
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as Array<[Exclude<KnowledgeDomain, 'attachment'>, string[]]>) {
      const score = keywords.reduce((sum, keyword) => {
        const normalizedKeyword = normalizeSemanticText(keyword);
        return sum + (normalized.includes(normalizedKeyword) ? 1 : 0);
      }, 0);

      if (score > bestScore) {
        bestDomain = domain;
        bestScore = score;
      }
    }

    return bestDomain;
  }

  private scoreChunk(query: EmbeddedText, chunk: KnowledgeChunk, predictedDomain: KnowledgeDomain): number {
    const semantic = cosineSimilarity(query.vector, query.norm, chunk.vector, chunk.norm);
    const lexical = overlapRatio(query.tokenSet, chunk.tokenSet);
    const titleMatch = overlapRatio(query.tokenSet, chunk.titleTokenSet);
    const keywordMatch = overlapRatio(query.tokenSet, chunk.keywordTokenSet);
    const domainBoost = chunk.domain === predictedDomain ? 0.03 : 0;
    const attachmentBoost = chunk.sourceType === 'attachment' ? 0.06 : 0;

    return Math.min(
      1,
      (semantic * 0.68) +
      (lexical * 0.18) +
      (keywordMatch * 0.08) +
      (titleMatch * 0.05) +
      domainBoost +
      attachmentBoost
    );
  }

  private measureConfidence(scores: number[]): GroundingConfidence {
    const topScore = scores[0] || 0;
    const secondScore = scores[1] || 0;

    if (topScore >= 0.52 || (topScore >= 0.46 && secondScore >= 0.34)) {
      return 'high';
    }
    if (topScore >= 0.38) {
      return 'medium';
    }
    if (topScore >= 0.28) {
      return 'low';
    }
    return 'none';
  }

  private toGroundingSource(chunk: KnowledgeChunk, score: number, labelNumber: number): GroundingSource {
    return {
      id: `${chunk.sourceType}:${chunk.source.id}`,
      label: `[${labelNumber}]`,
      title: chunk.source.title,
      publisher: chunk.source.publisher,
      url: chunk.source.url,
      year: chunk.source.year,
      domain: chunk.domain,
      kind: chunk.source.kind,
      score: Number(score.toFixed(3)),
      sourceType: chunk.sourceType,
      snippet: truncateSnippet(chunk.text)
    };
  }

  private buildGroundingPrompt(request: GroundingRequest, contextBlocks: string[]): string {
    const instructions = request.jsonMode
      ? [
        'Knowledge grounding is enabled.',
        'Use only the verified context below and any attached material already parsed for the request.',
        'Do not invent sources, numbers, findings, measurements, legal rules, or scientific claims.',
        'Return strictly valid JSON only.',
        'If a requested detail is not supported by the verified context, keep it conservative and omit unsupported precision.'
      ]
      : [
        'Knowledge grounding is enabled.',
        'Answer only with claims supported by the verified context below and any attached material already parsed for the request.',
        'Do not invent sources or cite anything outside the verified source list.',
        'Use inline citations like [1] when a claim depends on a verified source.',
        'End the answer with a short "Sources" section listing only the sources actually used.',
        `If the verified context is insufficient, answer exactly: "${INSUFFICIENT_KNOWLEDGE_MESSAGE}"`
      ];

    return [
      ...instructions,
      '',
      'Verified source context:',
      ...contextBlocks
    ].join('\n');
  }

  private buildResponseCacheKey(request: GroundingRequest, sources: GroundingSource[]): string {
    const stableHistory = (request.historyText || '').slice(-MAX_HISTORY_CHARS);
    return toHash([
      request.model || '',
      request.jsonMode ? 'json' : 'text',
      request.featureHint || '',
      request.knowledgeMode || 'auto',
      request.systemInstruction || '',
      stableHistory,
      request.message,
      request.attachmentsText ? toHash(request.attachmentsText) : '',
      sources.map((source) => `${source.id}:${source.score}`).join('|')
    ].join('|'));
  }
}
