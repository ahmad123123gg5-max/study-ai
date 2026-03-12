import type { HybridChatRequest, RetrievedDocument } from './types.js';
import type { LocalKnowledgeBase } from './knowledge/knowledge-base.js';

interface LogicResolution {
  text: string;
  route: 'logic' | 'rag';
  reason: string;
  groundedResults: RetrievedDocument[];
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isSimpleQuestion = (value: string): boolean => {
  const normalized = normalize(value);
  return normalized.length <= 280 &&
    !/(generate|create|write|analy|compare|essay|research|plan|quiz|case|تحليل|أنشئ|اكتب|قارن|ابحث|خطة|اختبار)/i.test(normalized);
};

export class LogicEngine {
  constructor(private readonly knowledgeBase: LocalKnowledgeBase) {}

  private buildLanguageAwareResponse(
    summaryAr: string | undefined,
    summaryEn: string | undefined,
    factsAr: string[] | undefined,
    factsEn: string[] | undefined,
    sourceTitle: string,
    languageCode: 'ar' | 'en'
  ): string {
    const summary = languageCode === 'ar'
      ? summaryAr || summaryEn || ''
      : summaryEn || summaryAr || '';
    const facts = languageCode === 'ar'
      ? (factsAr && factsAr.length > 0 ? factsAr : factsEn || [])
      : (factsEn && factsEn.length > 0 ? factsEn : factsAr || []);

    const sourceLabel = languageCode === 'ar' ? 'المصدر المعرفي' : 'Knowledge source';
    const quickLabel = languageCode === 'ar' ? 'نقاط سريعة' : 'Quick points';

    return [
      summary,
      '',
      `${quickLabel}:`,
      ...facts.slice(0, 3).map((fact) => `- ${fact}`),
      '',
      `${sourceLabel}: ${sourceTitle}`
    ].join('\n').trim();
  }

  async resolve(request: HybridChatRequest, groundedResults: RetrievedDocument[]): Promise<LogicResolution | null> {
    if (!isSimpleQuestion(request.message) || request.rawFilesCount || request.historyMessages.length > 0) {
      return null;
    }

    const languageCode = request.validationContext.languageCode;

    if (groundedResults.length > 0 && groundedResults[0].score >= 0.52) {
      const top = groundedResults[0];
      return {
        text: [
          languageCode === 'ar'
            ? `إجابة سريعة مبنية على قاعدة المعرفة: ${top.title}`
            : `Fast grounded answer from the knowledge base: ${top.title}`,
          '',
          top.content,
          '',
          `${languageCode === 'ar' ? 'المرجع' : 'Reference'}: ${top.sourceTitle}`
        ].join('\n').trim(),
        route: 'rag',
        reason: 'Served from top semantic retrieval result without invoking the model.',
        groundedResults: groundedResults.slice(0, 3)
      };
    }

    const normalizedMessage = normalize(request.message);
    const documents = await this.knowledgeBase.getDocuments();
    const matched = documents.find((document) =>
      document.keywords.some((keyword) => normalizedMessage.includes(normalize(keyword))) ||
      normalizedMessage.includes(normalize(document.title))
    );

    if (!matched) {
      return null;
    }

    return {
      text: this.buildLanguageAwareResponse(
        matched.summaryAr,
        matched.summaryEn,
        matched.quickFactsAr,
        matched.quickFactsEn,
        matched.sourceTitle,
        languageCode
      ),
      route: 'logic',
      reason: 'Resolved by deterministic logic and local knowledge card.',
      groundedResults: []
    };
  }
}
