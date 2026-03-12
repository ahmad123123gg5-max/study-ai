import type { HybridChatRequest, HybridRoutingDecision } from '../types.js';

const SIMPLE_QUERY_RE = /^(what|who|when|where|define|explain briefly|ما هو|ما هي|عرّف|اذكر|اشرح باختصار|ما معنى)/i;
const GENERATIVE_RE = /(generate|create|write|compose|essay|research|quiz|test|exam|case|analy|plan|summarize|ترجم|أنشئ|اكتب|ابحث|اختبار|تحليل|خطة|لخص|حالة)/i;

export class SmartRequestRouter {
  classify(request: HybridChatRequest): HybridRoutingDecision {
    const message = request.message.trim();
    const combined = `${request.systemInstruction}\n${message}`;
    const knowledgeMode = request.knowledgeMode || 'auto';
    const hasFiles = (request.rawFilesCount || 0) > 0 || !!request.attachmentText || (request.attachmentImages || []).length > 0;
    const hasHistory = request.historyMessages.length > 0;
    const simpleQuery = SIMPLE_QUERY_RE.test(message) || message.length <= 220;
    const generative = GENERATIVE_RE.test(combined) || request.jsonMode || hasFiles;
    const factualDomain = knowledgeMode !== 'off' && request.validationContext.domain !== 'general_academic';
    const highRisk = request.validationContext.riskLevel === 'high';
    const heavy = message.length > 1400 || hasFiles || /research|quiz|exam|case|file|ملف|بحث/i.test(combined);

    if (!generative && !hasFiles && !hasHistory && simpleQuery) {
      return {
        route: factualDomain ? 'rag' : 'logic',
        complexity: 'simple',
        reason: factualDomain
          ? 'Simple factual query: try semantic retrieval before AI.'
          : 'Simple deterministic query: try logic and cache first.',
        cacheable: true,
        needsRag: knowledgeMode === 'strict' || factualDomain,
        canUseRagOnly: knowledgeMode === 'strict' || factualDomain,
        needsAi: false,
        allowStreaming: false,
        backgroundCandidate: false,
        preferredModel: request.model
      };
    }

    if (heavy) {
      return {
        route: factualDomain ? 'rag_ai' : 'ai',
        complexity: 'heavy',
        reason: 'Heavy request: use AI with optional background-processing path.',
        cacheable: !hasFiles && !hasHistory,
        needsRag: knowledgeMode !== 'off' && factualDomain,
        canUseRagOnly: false,
        needsAi: true,
        allowStreaming: !request.jsonMode && !highRisk,
        backgroundCandidate: true,
        preferredModel: request.model
      };
    }

    return {
      route: factualDomain ? 'rag_ai' : 'ai',
      complexity: generative ? 'moderate' : 'simple',
      reason: factualDomain
        ? 'Grounded AI path: retrieve evidence first, then generate.'
        : 'AI path selected for explanatory or generative response.',
      cacheable: !hasFiles && !hasHistory,
      needsRag: knowledgeMode !== 'off' && factualDomain,
      canUseRagOnly: false,
      needsAi: true,
      allowStreaming: !request.jsonMode && !highRisk,
      backgroundCandidate: heavy,
      preferredModel: request.model
    };
  }
}
