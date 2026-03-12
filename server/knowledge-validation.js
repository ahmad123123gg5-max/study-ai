const ARABIC_TEXT_RE = /[\u0600-\u06FF]/u;
const SOURCE_POLICY_BY_DOMAIN = {
    medical: {
        label: 'Medical and nursing knowledge',
        sourceFamilies: [
            'WHO guidelines',
            'CDC guidance',
            'PubMed-indexed literature',
            'UpToDate',
            'Medscape',
            "Harrison's Principles of Internal Medicine",
            'Oxford medical guidelines',
            'Nursing clinical guidelines'
        ]
    },
    engineering: {
        label: 'Engineering knowledge',
        sourceFamilies: [
            'IEEE standards',
            'ISO standards',
            'Engineering textbooks',
            'MIT OpenCourse materials'
        ]
    },
    law: {
        label: 'Legal knowledge',
        sourceFamilies: [
            'Official legislation and regulations',
            'Court or government legal references',
            'Recognized legal principles',
            'Official compliance frameworks'
        ]
    },
    general_science: {
        label: 'General scientific knowledge',
        sourceFamilies: [
            'Peer-reviewed scientific sources',
            'University-level textbooks',
            'Recognized academic materials',
            'Official scientific agencies'
        ]
    },
    general_academic: {
        label: 'General academic knowledge',
        sourceFamilies: [
            'University-level textbooks',
            'Peer-reviewed academic materials',
            'Official institutional references',
            'Recognized educational resources'
        ]
    }
};
const DOMAIN_RULES = [
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
            /(biology|physics|chemistry|scientific|science|research|peer reviewed|laboratory|hypothesis|experiment|biology|anatomy|physiology|genetics|microbiology|biochem|علم|علوم|فيزياء|كيمياء|أحياء|تجربة|فرضية|بحث علمي)/i
        ]
    }
];
const HIGH_RISK_PATTERNS = [
    /(dose|dosage|mg\b|mcg\b|g\/day|ml\/hr|units\b|iu\b|infusion|titrate|contraindicat|interaction|drug interaction|جرعة|ملغ|ميكروغرام|وحدة|تسريب|تداخل دوائي)/i,
    /(diagnos|differential|treat|treatment|therapy|antibiotic|anticoagul|ventilat|resuscit|تشخيص|علاج|مضاد حيوي|إنعاش|تنفس اصطناعي)/i,
    /(legal advice|liability|penalty|court filing|binding|official legal position|استشارة قانونية|مسؤولية قانونية|عقوبة|إلزامي قانوناً)/i,
    /(safety critical|load bearing|structural failure|iso compliance|electrical hazard|pressure limit|critical threshold|سلامة حرجة|حمل إنشائي|فشل هيكلي|خطر كهربائي|حد ضغط)/i
];
const MEDICAL_EXACTNESS_PATTERNS = [
    /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|units|iu|mmol|meq)\b/i,
    /(first[- ]line|second[- ]line|definitive diagnosis|must diagnose|must treat)/i
];
const SHORT_RESPONSE_RE = /\S+/g;
export const extractJsonPayload = (raw) => {
    const text = String(raw || '').trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        return fenced[1].trim();
    }
    const objectStart = text.indexOf('{');
    const arrayStart = text.indexOf('[');
    const start = objectStart >= 0 && arrayStart >= 0
        ? Math.min(objectStart, arrayStart)
        : Math.max(objectStart, arrayStart);
    if (start < 0) {
        return text;
    }
    const objectEnd = text.lastIndexOf('}');
    const arrayEnd = text.lastIndexOf(']');
    const end = Math.max(objectEnd, arrayEnd);
    if (end < start) {
        return text;
    }
    return text.slice(start, end + 1).trim();
};
const detectLanguageCode = (input) => {
    if (ARABIC_TEXT_RE.test(input) || /\bArabic\b/i.test(input)) {
        return 'ar';
    }
    return 'en';
};
const detectDomain = (input) => {
    for (const rule of DOMAIN_RULES) {
        if (rule.patterns.some((pattern) => pattern.test(input))) {
            return rule.domain;
        }
    }
    return 'general_academic';
};
const detectRiskLevel = (domain, input) => {
    if (domain === 'medical') {
        return 'high';
    }
    if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(input))) {
        return domain === 'law' || domain === 'engineering' ? 'high' : 'moderate';
    }
    if (domain === 'law' || domain === 'engineering' || domain === 'general_science') {
        return 'moderate';
    }
    return 'low';
};
export const createKnowledgeValidationContext = ({ message, systemInstruction = '', historyText = '', attachmentText = '', jsonMode }) => {
    const combined = [systemInstruction, message, historyText, attachmentText].filter(Boolean).join('\n\n');
    const domain = detectDomain(combined);
    const languageCode = detectLanguageCode(combined);
    const policy = SOURCE_POLICY_BY_DOMAIN[domain];
    return {
        domain,
        riskLevel: detectRiskLevel(domain, combined),
        jsonMode,
        approvedSourceFamilies: [...policy.sourceFamilies],
        medicalSafetyApplied: domain === 'medical',
        languageCode,
        languageName: languageCode === 'ar' ? 'Arabic' : 'English',
        classificationText: combined
    };
};
const bulletList = (items) => items.map((item) => `- ${item}`).join('\n');
const domainLabel = (context) => SOURCE_POLICY_BY_DOMAIN[context.domain].label;
export const buildKnowledgeGuardianInstruction = (context) => {
    const jsonClause = context.jsonMode
        ? 'All safety and evidence rules apply inside every JSON field as well. Keep the required JSON shape exactly valid.'
        : 'Keep the final answer readable, structured, and educational.';
    const medicalClause = context.medicalSafetyApplied
        ? [
            'Medical Safety Logic is mandatory.',
            'Do not invent diagnoses, treatments, dosages, investigations, or drug interactions.',
            'If a dosage, diagnosis, treatment, or investigation is uncertain or depends on patient-specific data not provided, explicitly say it needs verification.',
            'Do not provide dangerous bedside advice as if it were confirmed fact.',
            'Keep the tone educational rather than directive clinical decision-making.'
        ].join(' ')
        : '';
    return [
        'You are the SmartEdge Knowledge Validation System.',
        `Current knowledge domain: ${domainLabel(context)}.`,
        `Current risk level: ${context.riskLevel}.`,
        `Respond in ${context.languageName}.`,
        'Only provide information that is scientifically or academically defensible.',
        'Do not fabricate facts, references, consensus statements, textbook claims, standards, case details, or numerical values.',
        'Reject guesswork, speculative claims, unsupported certainty, and pseudo-scientific explanations.',
        'If the prompt is underspecified or evidence is uncertain, say so clearly and mark the point as needing verification instead of pretending certainty.',
        'Every answer must be educational: define the concept, explain the scientific or academic rationale, walk through steps or interpretation, and include an example when helpful.',
        'Keep explanations clear, organized, and suitable for genuine student learning.',
        'Use only source families consistent with the following approved knowledge base:',
        bulletList(context.approvedSourceFamilies),
        medicalClause,
        jsonClause
    ].filter(Boolean).join('\n');
};
export const buildKnowledgeValidatorPrompt = (context, candidateResponse) => ({
    system: [
        'You are a strict academic and scientific response auditor.',
        'Evaluate whether the candidate answer is reliable, educational, internally coherent, and aligned with approved source families.',
        'Be conservative. If an answer sounds overconfident, unsupported, or unsafe, lower the score and add warnings.',
        'Return strictly valid JSON only.'
    ].join(' '),
    user: [
        `Domain: ${context.domain}`,
        `Risk level: ${context.riskLevel}`,
        `Medical safety required: ${context.medicalSafetyApplied ? 'yes' : 'no'}`,
        `Approved source families:\n${bulletList(context.approvedSourceFamilies)}`,
        'Score the answer using these criteria:',
        '- scientific or academic accuracy',
        '- agreement with accepted guidance or standards',
        '- absence of hallucinations or unsupported certainty',
        '- educational clarity and structure',
        '- medical safety where relevant',
        'Return JSON with keys:',
        '- score: integer 0-100',
        '- level: high | medium | needs_verification',
        '- summary: short validator summary',
        '- warnings: string[]',
        '- checks: string[]',
        '- sourceFamilies: string[]',
        '- needsRevision: boolean',
        '- blocked: boolean',
        'Mark blocked=true only if the answer is unsafe, misleading, or clearly unreliable for a student-facing product.',
        `Candidate answer:\n${candidateResponse}`
    ].join('\n\n')
});
export const buildKnowledgeRevisionInstruction = (context, validation) => {
    const warnings = validation.warnings.length > 0
        ? bulletList(validation.warnings)
        : '- Tighten unsupported claims.\n- Increase scientific clarity.\n- Remove unsafe or uncertain statements.';
    return [
        'Revise your previous answer to satisfy the SmartEdge Knowledge Validation System.',
        `Domain: ${domainLabel(context)}.`,
        `Risk level: ${context.riskLevel}.`,
        'Address the following validation issues:',
        warnings,
        'Revision rules:',
        '- keep the original task and response format',
        '- remove unsupported or unsafe claims',
        '- explicitly mark uncertain points as needing verification',
        '- improve educational clarity and structure',
        `- remain consistent with these source families:\n${bulletList(context.approvedSourceFamilies)}`,
        context.jsonMode
            ? '- keep the output as strictly valid JSON only'
            : '- keep the answer concise, structured, and directly useful to the learner'
    ].join('\n');
};
export const buildBlockedKnowledgeResponse = (context, validation) => {
    if (context.languageCode === 'ar') {
        const intro = context.medicalSafetyApplied
            ? 'تم إيقاف الإجابة الأصلية لأن المعلومة الطبية لم تصل إلى مستوى أمان علمي كافٍ للعرض المباشر.'
            : 'تم إيقاف الإجابة الأصلية لأن مستوى الموثوقية العلمية لم يكن كافياً للعرض المباشر.';
        const warningLine = validation.warnings.length > 0
            ? `نقاط تحتاج تحققاً إضافياً: ${validation.warnings.slice(0, 3).join(' | ')}.`
            : 'توجد نقاط تحتاج تحققاً إضافياً قبل اعتمادها تعليمياً.';
        return [
            intro,
            'يرجى إعادة صياغة السؤال بشكل أدق أو تزويد النظام بمصدر أكاديمي معتمد ليبني عليه الإجابة.',
            warningLine,
            `المصادر المرجعية المعتمدة لهذا المجال: ${context.approvedSourceFamilies.slice(0, 4).join('، ')}.`
        ].join(' ');
    }
    const intro = context.medicalSafetyApplied
        ? 'The original answer was withheld because the medical information did not meet a safe scientific threshold for direct display.'
        : 'The original answer was withheld because the scientific reliability threshold was not met for direct display.';
    const warningLine = validation.warnings.length > 0
        ? `Points needing verification: ${validation.warnings.slice(0, 3).join(' | ')}.`
        : 'Some points still need verification before they can be shown as educational content.';
    return [
        intro,
        'Please refine the question or provide an approved academic source so the answer can be rebuilt on stronger evidence.',
        warningLine,
        `Approved source families for this domain: ${context.approvedSourceFamilies.slice(0, 4).join(', ')}.`
    ].join(' ');
};
const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));
const dedupeStrings = (items, fallback = []) => {
    if (!Array.isArray(items)) {
        return [...fallback];
    }
    const seen = new Set();
    const normalized = [];
    for (const item of items) {
        const text = String(item || '').trim();
        if (!text) {
            continue;
        }
        const key = text.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        normalized.push(text);
    }
    return normalized;
};
const resolveLevelFromScore = (score) => {
    if (score >= 85) {
        return 'high';
    }
    if (score >= 68) {
        return 'medium';
    }
    return 'needs_verification';
};
export const fallbackKnowledgeValidationResult = (context, candidateResponse, reason) => {
    let score = context.riskLevel === 'high' ? 72 : context.riskLevel === 'moderate' ? 78 : 84;
    const warnings = [];
    const checks = [
        'Educational structure applied',
        'Approved source-family policy injected'
    ];
    const tokenCount = (candidateResponse.match(SHORT_RESPONSE_RE) || []).length;
    if (!context.jsonMode && tokenCount < 45) {
        score -= 14;
        warnings.push(context.languageCode === 'ar'
            ? 'الإجابة قصيرة أكثر من اللازم لتعليم أكاديمي موثوق.'
            : 'The answer is too short for reliable academic teaching.');
    }
    if (context.medicalSafetyApplied && MEDICAL_EXACTNESS_PATTERNS.some((pattern) => pattern.test(candidateResponse))) {
        score -= 12;
        warnings.push(context.languageCode === 'ar'
            ? 'المحتوى الطبي يتضمن تفاصيل حساسة تحتاج تحققاً إضافياً.'
            : 'The medical content contains sensitive details that need extra verification.');
    }
    if (reason) {
        score -= 8;
        warnings.push(reason);
    }
    score = clampScore(score);
    const level = resolveLevelFromScore(score);
    return {
        score,
        level,
        domain: context.domain,
        riskLevel: context.riskLevel,
        medicalSafetyApplied: context.medicalSafetyApplied,
        educationalMode: true,
        summary: context.languageCode === 'ar'
            ? 'تم تطبيق طبقة تحقق احتياطية بسبب تعذر قراءة تقرير المراجع الآلي بالكامل.'
            : 'A fallback validation layer was applied because the automated audit report could not be parsed fully.',
        warnings,
        checks,
        sourceFamilies: [...context.approvedSourceFamilies.slice(0, 4)],
        needsRevision: score < (context.riskLevel === 'high' ? 82 : 72),
        blocked: score < 48,
        createdAt: new Date().toISOString()
    };
};
export const normalizeKnowledgeValidationResult = (raw, context, candidateResponse) => {
    const candidate = raw && typeof raw === 'object' ? raw : {};
    const fallback = fallbackKnowledgeValidationResult(context, candidateResponse);
    let score = typeof candidate['score'] === 'number' && Number.isFinite(candidate['score'])
        ? candidate['score']
        : fallback.score;
    const warnings = dedupeStrings(candidate['warnings'], fallback.warnings);
    const checks = dedupeStrings(candidate['checks'], fallback.checks);
    const sourceFamilies = dedupeStrings(candidate['sourceFamilies'], context.approvedSourceFamilies.slice(0, 4))
        .filter((item) => context.approvedSourceFamilies.some((allowed) => allowed.toLowerCase() === item.toLowerCase()) || context.approvedSourceFamilies.length === 0)
        .slice(0, 6);
    score -= Math.min(18, warnings.length * 4);
    if (!context.jsonMode && (candidateResponse.match(SHORT_RESPONSE_RE) || []).length < 45) {
        score -= 8;
    }
    if (context.medicalSafetyApplied && MEDICAL_EXACTNESS_PATTERNS.some((pattern) => pattern.test(candidateResponse))) {
        score -= 6;
    }
    score = clampScore(score);
    const explicitLevel = typeof candidate['level'] === 'string' ? candidate['level'].trim() : '';
    const level = explicitLevel === 'high' || explicitLevel === 'medium' || explicitLevel === 'needs_verification'
        ? explicitLevel
        : resolveLevelFromScore(score);
    const needsRevision = typeof candidate['needsRevision'] === 'boolean'
        ? candidate['needsRevision']
        : score < (context.riskLevel === 'high' ? 82 : 72);
    const blocked = typeof candidate['blocked'] === 'boolean'
        ? candidate['blocked']
        : score < 48;
    return {
        score,
        level,
        domain: context.domain,
        riskLevel: context.riskLevel,
        medicalSafetyApplied: context.medicalSafetyApplied,
        educationalMode: true,
        summary: typeof candidate['summary'] === 'string' && candidate['summary'].trim()
            ? candidate['summary'].trim()
            : fallback.summary,
        warnings,
        checks: checks.length > 0 ? checks : fallback.checks,
        sourceFamilies: sourceFamilies.length > 0 ? sourceFamilies : fallback.sourceFamilies,
        needsRevision,
        blocked,
        createdAt: new Date().toISOString()
    };
};
