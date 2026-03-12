export type KnowledgeDomain =
  | 'medical'
  | 'engineering'
  | 'law'
  | 'general_science'
  | 'general_academic';

export type KnowledgeLanguageCode = 'ar' | 'en';

export interface KnowledgeValidationInput {
  message: string;
  systemInstruction?: string;
  historyText?: string;
  attachmentText?: string;
  jsonMode: boolean;
}

export interface KnowledgeValidationContext {
  domain: KnowledgeDomain;
  languageCode: KnowledgeLanguageCode;
}

const ARABIC_TEXT_RE = /[\u0600-\u06FF]/u;

const DOMAIN_RULES: Array<{ domain: KnowledgeDomain; patterns: RegExp[] }> = [
  {
    domain: 'medical',
    patterns: [
      /(medical|medicine|nursing|nurse|pharmac|drug|dose|dosage|diagnos|treat|therapy|clinical|patient|icu|emergency|cdc|who|pubmed|medscape|uptodate|harrison|oxford medical|تمريض|طب|صيدل|جرعة|دواء|تشخيص|علاج|مريض|سريري|مختبر|تحاليل|حالة مرضية)/i
    ]
  },
  {
    domain: 'engineering',
    patterns: [
      /(engineering|engineer|ieee|iso|mit opencourse|mechanic|mechanical|electrical|civil|industrial|thermodynamic|circuit|structural|pressure vessel|bridge|factory|machin|هندس|كهرب|مدني|ميكاني|صناع|هيكل|دوائر|مصنع|ورشة|ضغط|جسر)/i
    ]
  },
  {
    domain: 'law',
    patterns: [
      /(law|legal|court|statute|regulation|compliance|evidence|contract|judge|litigation|criminal|civil law|قانون|محكمة|تشريع|نظام|لائحة|قضية|دعوى|امتثال|إثبات|تحقيق)/i
    ]
  },
  {
    domain: 'general_science',
    patterns: [
      /(biology|physics|chemistry|scientific|science|research|peer reviewed|laboratory|hypothesis|experiment|anatomy|physiology|genetics|microbiology|biochem|علم|علوم|فيزياء|كيمياء|أحياء|تجربة|فرضية|بحث علمي)/i
    ]
  }
];

const detectLanguageCode = (input: string): KnowledgeLanguageCode => {
  if (ARABIC_TEXT_RE.test(input) || /\bArabic\b/i.test(input)) {
    return 'ar';
  }

  return 'en';
};

const detectDomain = (input: string): KnowledgeDomain => {
  for (const rule of DOMAIN_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(input))) {
      return rule.domain;
    }
  }

  return 'general_academic';
};

export const createKnowledgeValidationContext = ({
  message,
  systemInstruction = '',
  historyText = '',
  attachmentText = ''
}: KnowledgeValidationInput): KnowledgeValidationContext => {
  const combined = [systemInstruction, message, historyText, attachmentText]
    .filter(Boolean)
    .join('\n\n');

  return {
    domain: detectDomain(combined),
    languageCode: detectLanguageCode(combined)
  };
};
