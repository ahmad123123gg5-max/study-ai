import type { KnowledgeDocument } from '../types.js';

const updatedAt = '2026-03-12T00:00:00.000Z';

export const DEFAULT_KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'hybrid-ai-architecture',
    domain: 'general_academic',
    title: 'Hybrid AI architecture for educational platforms',
    sourceTitle: 'StudyVex Internal Architecture Guide',
    sourceFamily: 'Internal architecture guide',
    sourceType: 'internal',
    summaryAr: 'البنية الهجينة توزع الطلبات بين المنطق، قاعدة المعرفة، البحث الدلالي، والكاش، ثم تستخدم الذكاء الاصطناعي فقط عندما تكون هناك حاجة فعلية للشرح أو التحليل أو التوليد.',
    summaryEn: 'A hybrid architecture routes requests through logic, knowledge, vector retrieval, and cache before escalating to AI generation.',
    quickFactsAr: [
      'الطلبات السريعة يجب أن تمر عبر منطق مباشر وكاش متعدد الطبقات.',
      'RAG يستخدم أعلى 3 نتائج فقط لتقليل حجم الـ prompt.',
      'الذكاء الاصطناعي يستخدم للتفسير والتحليل والتوليد وليس لكل سؤال.'
    ],
    quickFactsEn: [
      'Fast requests should be served by logic and multi-layer cache.',
      'RAG should inject only the top three grounding results.',
      'AI should be reserved for explanation, analysis, and generation.'
    ],
    content: `Arabic:
البنية الاحترافية للمنصات التعليمية الذكية تعتمد على فصل الطلبات إلى طبقة منطق، قاعدة معرفة موثوقة، بحث دلالي، ثم طبقة AI. بهذه الطريقة يتم الرد على الأسئلة المتكررة والبيانات الثابتة بسرعة كبيرة عبر الكاش والمنطق، بينما تستخدم النماذج فقط عندما يحتاج المستخدم إلى شرح عميق أو تحليل أو إنشاء محتوى جديد.

English:
Professional educational AI systems separate fast deterministic work from model-driven work. Logic handles FAQs and static rules, cache removes repeated latency, vector search retrieves grounded evidence, and the AI model is reserved for explanation, reasoning, and generation.`,
    tags: ['hybrid-ai', 'rag', 'cache', 'performance'],
    keywords: ['hybrid ai', 'rag', 'cache', 'vector search', 'architecture', 'البنية الهجينة', 'الكاش', 'البحث الدلالي'],
    updatedAt
  },
  {
    id: 'studyvex-platform-basics',
    domain: 'general_academic',
    title: 'StudyVex learning platform basics',
    sourceTitle: 'StudyVex Product Notes',
    sourceFamily: 'Internal product knowledge',
    sourceType: 'internal',
    summaryAr: 'المنصة تجمع بين التعليم الذكي، الاختبارات، المعلم التفاعلي، والمحاكاة العملية مع طبقات أداء تمنع الاعتماد الكامل على AI.',
    summaryEn: 'The platform combines tutoring, quizzes, practical simulations, and AI-backed learning with performance-focused routing.',
    quickFactsAr: [
      'المعلم الذكي يجب أن يعتمد على معرفة موثوقة قبل التوليد.',
      'الاختبارات والتحليل والملفات الثقيلة يمكن إرسالها إلى background workers.',
      'المراقبة يجب أن تقيس زمن الاستجابة واستهلاك AI ونسبة ضربات الكاش.'
    ],
    quickFactsEn: [
      'Tutor responses should be grounded before generation.',
      'Heavy tasks can be moved to background workers.',
      'Monitoring should track latency, AI usage, and cache-hit rate.'
    ],
    content: `Arabic:
منصة StudyVex التعليمية مصممة لتقديم تعلم سريع وقابل للتوسع. المسارات السريعة مثل الأسئلة المتكررة والبيانات الثابتة يجب أن تعالج بدون استدعاء النموذج في كل مرة. أما الشرح، التحليل، وتوليد الأسئلة فيمر عبر طبقة AI مقيّدة بمعرفة موثوقة.

English:
StudyVex is designed to support educational tutoring, assessments, and simulations. The highest-performing architecture serves deterministic content without an LLM call and escalates only the complex learning interactions to the AI layer.`,
    tags: ['platform', 'education', 'operations'],
    keywords: ['studyvex', 'platform', 'learning platform', 'المنصة', 'ستاديفكس'],
    updatedAt
  },
  {
    id: 'medical-stemi-overview',
    domain: 'medical',
    title: 'STEMI educational overview',
    sourceTitle: 'Cardiology teaching note',
    sourceFamily: 'Medical guidelines',
    sourceType: 'guideline',
    summaryAr: 'احتشاء عضلة القلب المرتبط بارتفاع ST هو حالة إسعافية تعليمياً تتميز بألم صدري وأدلة ECG مثل ارتفاع مقطع ST في اشتقاقات متجاورة، ويجب شرحها كإطار تعليمي لا كأوامر سريرية مباشرة.',
    summaryEn: 'STEMI is an educational emergency concept defined by ischemic symptoms with ST-segment elevation in contiguous leads.',
    quickFactsAr: [
      'الشرح التعليمي يجب أن يركز على التعرف على النمط لا على إعطاء جرعات علاجية.',
      'يرتبط عادة بألم صدري، تغيّرات ECG، ورفع الواسمات القلبية.',
      'أي قرار علاجي نهائي يحتاج بروتوكول محلي وفريق سريري.'
    ],
    quickFactsEn: [
      'Educational answers should focus on recognition rather than dosing.',
      'Typical teaching points include chest pain, ECG changes, and cardiac biomarkers.',
      'Definitive treatment decisions require local protocols and clinicians.'
    ],
    content: `Arabic:
في التعليم الطبي، STEMI يعني صورة احتشاء حاد مع ارتفاع ST في اشتقاقات متجاورة مع سياق سريري مناسب. الهدف التعليمي هو فهم النمط الكهربائي، تفسير الصورة السريرية، وسبب الحاجة إلى التصعيد السريع. لا يجب تحويل الشرح التعليمي إلى أوامر علاج أو جرعات بدون مرجع معتمد.

English:
In medical education, STEMI is taught as an acute coronary syndrome pattern where symptoms and ECG findings together support urgent escalation. Student-facing explanations should emphasize pattern recognition, differential reasoning, and why early reperfusion pathways matter, without inventing local treatment orders.`,
    tags: ['medical', 'ecg', 'stemi'],
    keywords: ['stemi', 'ecg st elevation', 'احتشاء', 'ارتفاع st', 'acute coronary syndrome'],
    updatedAt
  },
  {
    id: 'medical-sepsis-overview',
    domain: 'medical',
    title: 'Sepsis educational overview',
    sourceTitle: 'Critical care teaching note',
    sourceFamily: 'Medical guidelines',
    sourceType: 'guideline',
    summaryAr: 'الإنتان يشرح تعليمياً كاستجابة غير منتظمة للعدوى تؤدي إلى اختلال أعضاء، مع التركيز على التعرف المبكر والمراقبة وتقييم شدة الحالة.',
    summaryEn: 'Sepsis is an educational concept of dysregulated host response to infection causing organ dysfunction.',
    quickFactsAr: [
      'التدهور السريري، علامات العدوى، واختلال الأعضاء هي محاور التقييم التعليمي.',
      'الأولوية التعليمية هي التعرف المبكر والتصعيد والمتابعة الدقيقة.',
      'أي أوامر علاجية تفصيلية يجب أن تعتمد على بروتوكول معتمد.'
    ],
    quickFactsEn: [
      'Teaching focuses on infection signs, organ dysfunction, and deterioration.',
      'Early recognition and escalation are core learning goals.',
      'Detailed treatment orders need validated protocols.'
    ],
    content: `Arabic:
الإنتان ليس مجرد عدوى؛ بل حالة تُشرح للطلاب على أنها عدوى مع استجابة فسيولوجية مختلة قد تقود إلى فشل أعضاء. الإجابة الجيدة تشرح العلامات، منطق الخطورة، وأهمية إعادة التقييم السريع دون اختلاق بروتوكولات غير مؤكدة.

English:
Sepsis education should explain the combination of suspected infection plus clinically meaningful organ dysfunction. High-quality student explanations connect physiology, hemodynamics, and escalation logic while avoiding unsupported bedside instructions.`,
    tags: ['medical', 'sepsis', 'critical care'],
    keywords: ['sepsis', 'shock', 'إنتان', 'تعفن الدم', 'critical care'],
    updatedAt
  },
  {
    id: 'medical-af-overview',
    domain: 'medical',
    title: 'Atrial fibrillation educational overview',
    sourceTitle: 'Arrhythmia teaching note',
    sourceFamily: 'Medical guidelines',
    sourceType: 'guideline',
    summaryAr: 'الرجفان الأذيني هو اضطراب نظم فوق بطيني يتميز بعدم انتظام واضح وغياب موجات P المنظمة، ويشرح تعليمياً عبر قراءة النظم والأثر السريري العام.',
    summaryEn: 'Atrial fibrillation is an irregular supraventricular rhythm typically taught through ECG interpretation and clinical implications.',
    quickFactsAr: [
      'التركيز التعليمي يكون على عدم انتظام النظم وغياب موجات P المنتظمة.',
      'التقييم السريري يعتمد على الاستقرار، الأعراض، والسياق المرضي.',
      'القرارات العلاجية النهائية ليست جزءاً من الرد السريع غير الموثق.'
    ],
    quickFactsEn: [
      'Teaching focuses on irregular rhythm and absent organized P waves.',
      'Clinical interpretation depends on stability, symptoms, and context.',
      'Definitive treatment plans should not be improvised.'
    ],
    content: `Arabic:
الرجفان الأذيني يقدَّم تعليمياً كنمط ECG غير منتظم دون موجات P واضحة مع تذبذب المسافات بين المركبات. يجب على الإجابة التعليمية أن توضح قراءة الشريط، التفكير في الاستقرار السريري، والفكرة العامة للمضاعفات.

English:
AF is classically taught as an irregularly irregular rhythm without consistent P waves. A grounded answer explains recognition, broad consequences, and why management depends on the patient's stability and risk profile.`,
    tags: ['medical', 'afib', 'ecg'],
    keywords: ['afib', 'atrial fibrillation', 'رجفان أذيني', 'irregular rhythm'],
    updatedAt
  },
  {
    id: 'engineering-ohms-law',
    domain: 'engineering',
    title: 'Ohm law and circuit troubleshooting',
    sourceTitle: 'Electrical engineering fundamentals',
    sourceFamily: 'Engineering textbooks',
    sourceType: 'textbook',
    summaryAr: 'قانون أوم يربط الجهد والتيار والمقاومة، ويستخدم تعليمياً لتشخيص سلوك الدوائر بشكل منهجي قبل الانتقال إلى تحليل أعقد.',
    summaryEn: 'Ohm law links voltage, current, and resistance and is foundational for circuit troubleshooting.',
    quickFactsAr: [
      'العلاقة الأساسية: V = I × R.',
      'أي تشخيص جيد يبدأ بالقياسات ثم مقارنة السلوك المتوقع بالفعلي.',
      'السلامة الكهربائية والحدود التشغيلية يجب ألا تُفترض بدون مرجع.'
    ],
    quickFactsEn: [
      'Core relationship: V = I × R.',
      'Good troubleshooting starts with measurements and expected behavior.',
      'Electrical safety limits should not be guessed.'
    ],
    content: `Arabic:
في التعليم الهندسي، قانون أوم هو نقطة البداية لشرح العلاقة بين الجهد والتيار والمقاومة. عند تحليل دائرة، تتم المقارنة بين القياسات الفعلية والقيم المتوقعة لتحديد مكان الخلل. يجب الحفاظ على لغة تعليمية منهجية وعدم اختلاق حدود أمان غير موثقة.

English:
Engineering explanations often begin with Ohm law because it provides a simple model for interpreting electrical behavior. Troubleshooting combines measured values, expected ranges, and component logic to isolate faults systematically.`,
    tags: ['engineering', 'electrical', 'circuits'],
    keywords: ['ohm', 'ohms law', 'circuit', 'voltage', 'current', 'resistance', 'قانون أوم', 'دائرة كهربائية'],
    updatedAt
  },
  {
    id: 'law-contract-elements',
    domain: 'law',
    title: 'Basic contract formation elements',
    sourceTitle: 'Legal foundations note',
    sourceFamily: 'Legal frameworks',
    sourceType: 'policy',
    summaryAr: 'العناصر التعليمية الأساسية للعقد تشمل الإيجاب والقبول والمقابل والأهلية والمشروعية، مع التأكيد أن التطبيق القانوني النهائي يختلف حسب الولاية القضائية.',
    summaryEn: 'Core teaching on contract formation covers offer, acceptance, consideration, capacity, and legality.',
    quickFactsAr: [
      'العقد الصحيح تعليمياً يحتاج عرضاً وقبولاً ومقابلاً ومشروعية.',
      'القواعد التفصيلية تختلف بين الأنظمة القانونية.',
      'الردود السريعة لا يجب أن تدّعي تقديم استشارة قانونية ملزمة.'
    ],
    quickFactsEn: [
      'Valid contract teaching includes offer, acceptance, consideration, and legality.',
      'Detailed rules vary by jurisdiction.',
      'Quick answers should not present binding legal advice.'
    ],
    content: `Arabic:
في الشرح القانوني الأكاديمي، يدرَّس تكوين العقد من خلال عناصر أساسية مثل الإيجاب والقبول والمقابل والأهلية والمشروعية. يجب أن توضح الإجابة أن هذه مبادئ تعليمية عامة وأن التطبيق العملي يعتمد على الولاية القضائية والنصوص الرسمية.

English:
Academic legal explanations typically frame contract formation through common foundational elements. Any student-facing answer should distinguish general doctrine from jurisdiction-specific legal advice.`,
    tags: ['law', 'contracts', 'legal'],
    keywords: ['contract', 'offer acceptance', 'consideration', 'عقد', 'إيجاب وقبول', 'قانون'],
    updatedAt
  },
  {
    id: 'science-scientific-method',
    domain: 'general_science',
    title: 'Scientific method overview',
    sourceTitle: 'General science primer',
    sourceFamily: 'Scientific textbooks',
    sourceType: 'textbook',
    summaryAr: 'المنهج العلمي يمر بالملاحظة، صياغة الفرضية، الاختبار، التحليل، ثم المراجعة أو التكرار، وهو أساس بناء التفسير العلمي الموثوق.',
    summaryEn: 'The scientific method progresses through observation, hypothesis, testing, analysis, and revision.',
    quickFactsAr: [
      'الفكرة الأساسية هي اختبار الفرضيات لا إثباتها بشكل مطلق.',
      'قابلية التكرار والقياس جزء من الموثوقية العلمية.',
      'النتائج يجب أن تفسر ضمن حدود المنهج والبيانات.'
    ],
    quickFactsEn: [
      'Science tests hypotheses rather than proving them absolutely.',
      'Reproducibility and measurement support reliability.',
      'Results must be interpreted within method limits.'
    ],
    content: `Arabic:
المنهج العلمي إطار تعليمي يربط الملاحظة بتوليد سؤال أو فرضية ثم اختبارها عبر بيانات قابلة للتحليل. عند بناء إجابة علمية موثوقة، يجب ربط الاستنتاج بالبيانات المتاحة وحدود التجربة.

English:
The scientific method offers a disciplined path from observation to testable hypothesis and evidence-driven interpretation. Strong educational answers explain both findings and methodological limits.`,
    tags: ['science', 'research', 'methodology'],
    keywords: ['scientific method', 'hypothesis', 'experiment', 'المنهج العلمي', 'فرضية', 'تجربة'],
    updatedAt
  }
];
