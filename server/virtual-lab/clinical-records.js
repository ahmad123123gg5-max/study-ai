import { createHash, randomUUID } from 'crypto';
const DEFAULT_STATS = {
    totalCasesCompleted: 0,
    averageScore: 0,
    bestScore: 0,
    worstScore: 0,
    totalHoursPracticed: 0,
    mostPracticedSpecialty: 'None',
    specialtyBreakdown: [],
    levelTier: 'bronze',
    recommendedDifficulty: 'easy'
};
const TRACK_MATCHERS = [
    {
        id: 'emergency',
        keywords: ['emergency', 'er', 'triage', 'trauma', 'طوارئ', 'اسعاف', 'إسعاف', 'فرز'],
        label: { ar: 'الطوارئ', en: 'Emergency' }
    },
    {
        id: 'icu',
        keywords: ['icu', 'critical care', 'intensive care', 'عناية مركزة', 'عنايه مركزه', 'critical'],
        label: { ar: 'العناية المركزة', en: 'ICU' }
    },
    {
        id: 'pediatrics',
        keywords: ['pediatric', 'paediatric', 'child', 'children', 'طفل', 'أطفال', 'اطفال', 'حضانة', 'nicu'],
        label: { ar: 'الأطفال', en: 'Pediatrics' }
    },
    {
        id: 'ward',
        keywords: ['ward', 'medicine', 'medical', 'nursing', 'تمريض', 'باطنة', 'medicine'],
        label: { ar: 'الجناح السريري', en: 'Clinical Ward' }
    }
];
const DISEASE_TEMPLATES = [
    {
        key: 'asthma-attack',
        category: 'respiratory',
        label: { ar: 'نوبة ربو حادة', en: 'Asthma Attack' },
        tracks: ['emergency', 'icu', 'pediatrics', 'ward'],
        chiefComplaint: { ar: 'ضيق نفس وصفير متزايد', en: 'Progressive shortness of breath and wheeze' },
        complications: [
            { ar: 'إرهاق تنفسي', en: 'respiratory fatigue' },
            { ar: 'نقص أكسجة صامت', en: 'silent hypoxemia' },
            { ar: 'احتباس CO2 مبكر', en: 'early CO2 retention' }
        ],
        sources: [
            { ar: 'محفز تحسسي', en: 'allergic trigger' },
            { ar: 'عدوى تنفسية حديثة', en: 'recent respiratory infection' },
            { ar: 'تعرض لدخان كثيف', en: 'heavy smoke exposure' }
        ],
        histories: [
            { ar: 'ربو غير مضبوط مع استخدام متكرر للبخاخ الإسعافي', en: 'poorly controlled asthma with frequent rescue inhaler use' },
            { ar: 'تاريخ دخول سابق للعناية بسبب الربو', en: 'prior ICU admission for asthma' },
            { ar: 'التزام دوائي ضعيف في الأيام الأخيرة', en: 'missed controller therapy over recent days' }
        ],
        severities: [
            { ar: 'خفيفة', en: 'mild' },
            { ar: 'شديدة', en: 'severe' },
            { ar: 'مهددة للحياة', en: 'life-threatening' }
        ],
        responses: [
            { ar: 'تحسن تدريجي بعد العلاج المبكر', en: 'gradual improvement after early treatment' },
            { ar: 'استجابة جزئية مع حاجة لإعادة تقييم متكرر', en: 'partial response requiring repeated reassessment' },
            { ar: 'تحسن بطيء حتى بعد التصعيد', en: 'slow recovery even after escalation' }
        ],
        learningFocus: [
            { ar: 'الأولوية بين الأكسجة وفتح مجرى الهواء', en: 'oxygenation versus airway priority' },
            { ar: 'توقيت التصعيد والاستدعاء المبكر', en: 'timely escalation and early call for help' },
            { ar: 'إعادة التقييم بعد كل تدخل', en: 'reassessment after each intervention' }
        ],
        investigations: [
            { ar: 'غازات الدم', en: 'blood gas' },
            { ar: 'قياس ذروة الجريان إن أمكن', en: 'peak flow if feasible' },
            { ar: 'أشعة صدر عند الشك بمضاعفة', en: 'chest x-ray if a complication is suspected' }
        ]
    },
    {
        key: 'anaphylaxis',
        category: 'shock',
        label: { ar: 'تأق حاد', en: 'Anaphylaxis' },
        tracks: ['emergency', 'icu', 'ward'],
        chiefComplaint: { ar: 'هبوط ضغط مع صفير ووذمة', en: 'hypotension with wheeze and edema' },
        complications: [
            { ar: 'وذمة مجرى الهواء', en: 'upper airway edema' },
            { ar: 'صدمة دورانية سريعة', en: 'rapid distributive shock' },
            { ar: 'طفح جلدي متسارع مع تدهور تنفسي', en: 'rapid rash progression with respiratory decline' }
        ],
        sources: [
            { ar: 'مضاد حيوي وريدي', en: 'intravenous antibiotic exposure' },
            { ar: 'لسعة حشرة', en: 'insect sting' },
            { ar: 'غذاء عالي التحسس', en: 'high-risk food exposure' }
        ],
        histories: [
            { ar: 'حساسية معروفة مشابهة سابقاً', en: 'known prior allergic reaction' },
            { ar: 'ربو مرافق يزيد الخطورة التنفسية', en: 'concurrent asthma increasing respiratory risk' },
            { ar: 'عدم وجود حقنة أدرينالين ذاتية مع المريض', en: 'no personal epinephrine auto-injector available' }
        ],
        severities: [
            { ar: 'مبكرة', en: 'early' },
            { ar: 'شديدة', en: 'severe' },
            { ar: 'صدمة تأقية', en: 'anaphylactic shock' }
        ],
        responses: [
            { ar: 'تحسن سريع إذا بدأ العلاج مبكراً', en: 'rapid improvement when treated early' },
            { ar: 'استجابة متذبذبة تحتاج مراقبة لصيقة', en: 'fluctuating response requiring close monitoring' },
            { ar: 'تحسن محدود مع استمرار خطر الارتداد', en: 'limited improvement with rebound risk' }
        ],
        learningFocus: [
            { ar: 'التعرف المبكر على الصدمة التأقية', en: 'early recognition of anaphylactic shock' },
            { ar: 'ترتيب الهواء والتنفس والدوران', en: 'airway-breathing-circulation prioritization' },
            { ar: 'عدم تأخير التدخل الحاسم', en: 'avoiding delay in decisive treatment' }
        ],
        investigations: [
            { ar: 'مراقبة ضغط متكرر', en: 'repeat blood pressure monitoring' },
            { ar: 'تخطيط قلب عند عدم الاستقرار', en: 'ECG when unstable' },
            { ar: 'مؤشرات لاكتات/تروية', en: 'perfusion and lactate markers' }
        ]
    },
    {
        key: 'hypoglycemia-seizure',
        category: 'seizure',
        label: { ar: 'نقص سكر مع اختلاجات', en: 'Hypoglycemia With Seizure' },
        tracks: ['emergency', 'icu', 'pediatrics', 'ward'],
        chiefComplaint: { ar: 'انخفاض وعي مع اختلاج أو رجفان', en: 'reduced consciousness with seizure-like activity' },
        complications: [
            { ar: 'اختلاجات متكررة', en: 'recurrent convulsions' },
            { ar: 'استنشاق محتمل', en: 'possible aspiration' },
            { ar: 'ارتباك عصبي بعدي مطول', en: 'prolonged post-ictal confusion' }
        ],
        sources: [
            { ar: 'جرعة أنسولين زائدة', en: 'insulin dosing error' },
            { ar: 'تأخر تناول الطعام', en: 'missed meal' },
            { ar: 'مرض مرافق مع ضعف المدخول', en: 'intercurrent illness with poor intake' }
        ],
        histories: [
            { ar: 'سكري مع تحكم متذبذب', en: 'diabetes with unstable control' },
            { ar: 'فشل كلوي يزيد خطر استمرار النقص', en: 'renal impairment worsening prolonged hypoglycemia' },
            { ar: 'حمل دوائي معقد', en: 'complex medication regimen' }
        ],
        severities: [
            { ar: 'أولية', en: 'early' },
            { ar: 'متوسطة', en: 'moderate' },
            { ar: 'مع اضطراب عصبي شديد', en: 'with severe neurologic compromise' }
        ],
        responses: [
            { ar: 'تحسن سريع بعد التصحيح', en: 'rapid improvement after correction' },
            { ar: 'وعي يتحسن ببطء مع ضرورة مراقبة مجرى الهواء', en: 'slow neurologic recovery requiring airway vigilance' },
            { ar: 'تحسن جزئي مع استمرار خطر التكرار', en: 'partial response with ongoing recurrence risk' }
        ],
        learningFocus: [
            { ar: 'التفكير في السبب القابل للعكس', en: 'thinking of reversible causes' },
            { ar: 'حماية المجرى الهوائي أثناء الاختلاج', en: 'airway protection during seizure activity' },
            { ar: 'إعادة الفحص بعد التصحيح', en: 'repeat reassessment after correction' }
        ],
        investigations: [
            { ar: 'قياس سكر فوري ومتكرر', en: 'immediate and repeat glucose checks' },
            { ar: 'مراقبة عصبية متسلسلة', en: 'serial neurologic checks' },
            { ar: 'شوارد أساسية', en: 'basic electrolytes' }
        ]
    },
    {
        key: 'sepsis',
        category: 'shock',
        label: { ar: 'إنتان/تعفن دم', en: 'Sepsis' },
        tracks: ['emergency', 'icu', 'ward'],
        chiefComplaint: { ar: 'حمى وهبوط ضغط وتسرع قلبي', en: 'fever, hypotension, and tachycardia' },
        complications: [
            { ar: 'صدمة إنتانية', en: 'septic shock' },
            { ar: 'انخفاض وعي تدريجي', en: 'progressive encephalopathy' },
            { ar: 'نقص أكسجة مع مصدر رئوي', en: 'hypoxemia from a pulmonary source' }
        ],
        sources: [
            { ar: 'مصدر بولي', en: 'urinary source' },
            { ar: 'التهاب رئوي', en: 'pneumonia' },
            { ar: 'مصدر بطني', en: 'abdominal source' }
        ],
        histories: [
            { ar: 'سكري مزمن', en: 'diabetes mellitus' },
            { ar: 'كبت مناعي', en: 'immunosuppression' },
            { ar: 'جراحة حديثة', en: 'recent surgery' }
        ],
        severities: [
            { ar: 'خفيف', en: 'mild' },
            { ar: 'شديد', en: 'severe' },
            { ar: 'صدمة إنتانية', en: 'septic shock' }
        ],
        responses: [
            { ar: 'يستجيب بعد التدخل المبكر والمراقبة الجيدة', en: 'responds after early intervention and monitoring' },
            { ar: 'يتحسن ببطء مع ضغط دوراني مستمر', en: 'slow improvement with persistent hemodynamic pressure' },
            { ar: 'يحتاج تصعيداً مبكراً وإلا سيتدهور', en: 'requires early escalation or deterioration will continue' }
        ],
        learningFocus: [
            { ar: 'التقاط الصدمة مبكراً', en: 'recognizing shock early' },
            { ar: 'ربط المظاهر بمصدر العدوى', en: 'connecting presentation to infection source' },
            { ar: 'تكرار إعادة التقييم بعد كل خطوة', en: 'reassessing after every move' }
        ],
        investigations: [
            { ar: 'لاكتات', en: 'lactate' },
            { ar: 'عد دموي ومؤشرات التهاب', en: 'CBC and inflammatory markers' },
            { ar: 'زرع/عينات بحسب المصدر', en: 'cultures by likely source' }
        ]
    },
    {
        key: 'trauma-hemorrhage',
        category: 'shock',
        label: { ar: 'رضح مع نزف داخلي محتمل', en: 'Trauma With Possible Hemorrhage' },
        tracks: ['emergency', 'icu'],
        chiefComplaint: { ar: 'رضح حاد مع برودة وتسرع نبض', en: 'acute trauma with cool extremities and tachycardia' },
        complications: [
            { ar: 'نزف مستمر', en: 'ongoing hemorrhage' },
            { ar: 'تدهور سريع في الوعي', en: 'rapid mental status decline' },
            { ar: 'اختلاط ألم ونقص تروية', en: 'pain with worsening perfusion' }
        ],
        sources: [
            { ar: 'حادث سير', en: 'road traffic collision' },
            { ar: 'سقوط من ارتفاع', en: 'fall from height' },
            { ar: 'إصابة نافذة', en: 'penetrating injury' }
        ],
        histories: [
            { ar: 'مميعات دم مزمنة', en: 'chronic anticoagulation' },
            { ar: 'لا تاريخ مرضي مهم لكن زمن الوصول تأخر', en: 'no major history but delayed arrival' },
            { ar: 'ألم صدري/بطني يزيد الشك بمصدر نزف', en: 'chest or abdominal pain raising concern for bleeding source' }
        ],
        severities: [
            { ar: 'متوسط', en: 'moderate' },
            { ar: 'شديد', en: 'severe' },
            { ar: 'حرج', en: 'critical' }
        ],
        responses: [
            { ar: 'تتحسن التروية إذا تحركت مبكراً', en: 'perfusion improves if you act early' },
            { ar: 'يبقى التدهور قريباً ما لم يتم التصعيد', en: 'the case remains close to deterioration without escalation' },
            { ar: 'تحتاج إعادة تقييم سريعة ومتكررة جداً', en: 'requires extremely rapid and repeated reassessment' }
        ],
        learningFocus: [
            { ar: 'عدم التأخير في دعم الدوران', en: 'not delaying circulatory support' },
            { ar: 'مراقبة أثر كل تدخل على الضغط والنبض', en: 'watching the effect of every intervention on perfusion' },
            { ar: 'التصعيد المنظم مبكراً', en: 'organized early escalation' }
        ],
        investigations: [
            { ar: 'هيموغلوبين/هيماتوكريت', en: 'hemoglobin and hematocrit' },
            { ar: 'سونار سريع إذا توفر', en: 'FAST exam if available' },
            { ar: 'مراقبة دورية للضغط والنبض', en: 'serial hemodynamic checks' }
        ]
    },
    {
        key: 'af-rvr',
        category: 'cardiac',
        label: { ar: 'رجفان أذيني مع استجابة سريعة', en: 'Atrial Fibrillation With Rapid Ventricular Response' },
        tracks: ['emergency', 'icu', 'ward'],
        chiefComplaint: { ar: 'خفقان مع هبوط تحمل وتروية', en: 'palpitations with reduced tolerance and perfusion' },
        complications: [
            { ar: 'هبوط ضغط تدريجي', en: 'progressive hypotension' },
            { ar: 'ألم صدري مرافق', en: 'associated chest discomfort' },
            { ar: 'ضيق نفس متزايد', en: 'worsening dyspnea' }
        ],
        sources: [
            { ar: 'انتان أو إجهاد حاد', en: 'infection or acute stress' },
            { ar: 'انقطاع علاج قلبي', en: 'interrupted rate-control therapy' },
            { ar: 'اضطراب شوارد', en: 'electrolyte imbalance' }
        ],
        histories: [
            { ar: 'تاريخ رجفان أذيني متكرر', en: 'recurrent atrial fibrillation history' },
            { ar: 'قصور قلب خفيف', en: 'mild heart failure history' },
            { ar: 'ارتفاع ضغط مزمن', en: 'chronic hypertension' }
        ],
        severities: [
            { ar: 'غير مريح', en: 'uncomfortable' },
            { ar: 'غير مستقر', en: 'unstable' },
            { ar: 'حرج', en: 'critical' }
        ],
        responses: [
            { ar: 'يتحسن عند المراقبة والتدخل السريع', en: 'improves with early monitoring and action' },
            { ar: 'يبقى متذبذباً حتى بعد الخطوات الأولى', en: 'remains unstable even after initial actions' },
            { ar: 'يحتاج تصعيداً مبكراً إذا هبطت التروية', en: 'requires early escalation if perfusion falls' }
        ],
        learningFocus: [
            { ar: 'ربط النظم بالتروية', en: 'connecting rhythm to perfusion' },
            { ar: 'توقيت ECG والتصعيد', en: 'timing ECG and escalation' },
            { ar: 'إعادة التقييم بعد كل تغير', en: 'reassessment after each change' }
        ],
        investigations: [
            { ar: 'ECG فوري', en: 'immediate ECG' },
            { ar: 'شوارد ووظيفة كلوية', en: 'electrolytes and renal function' },
            { ar: 'مراقبة مستمرة للنظم', en: 'continuous rhythm monitoring' }
        ]
    },
    {
        key: 'stemi',
        category: 'cardiac',
        label: { ar: 'احتشاء قلبي حاد', en: 'STEMI' },
        tracks: ['emergency', 'icu'],
        chiefComplaint: { ar: 'ألم صدري مع تعرق وتدهور تروية', en: 'chest pain with diaphoresis and falling perfusion' },
        complications: [
            { ar: 'عدم استقرار نظم', en: 'rhythm instability' },
            { ar: 'هبوط ضغط', en: 'hypotension' },
            { ar: 'احتقان رئوي مبكر', en: 'early pulmonary congestion' }
        ],
        sources: [
            { ar: 'انسداد تاجي حاد', en: 'acute coronary occlusion' },
            { ar: 'تأخر في طلب الرعاية', en: 'delayed presentation' },
            { ar: 'إجهاد شديد مع عوامل خطورة عالية', en: 'high-risk stress trigger' }
        ],
        histories: [
            { ar: 'سكري وارتفاع ضغط', en: 'diabetes and hypertension' },
            { ar: 'تدخين مزمن', en: 'chronic smoking' },
            { ar: 'احتشاء سابق', en: 'prior myocardial infarction' }
        ],
        severities: [
            { ar: 'مبكر', en: 'early' },
            { ar: 'واسع الامتداد', en: 'extensive' },
            { ar: 'مع اختلاط دوراني', en: 'with hemodynamic compromise' }
        ],
        responses: [
            { ar: 'الاستقرار ممكن إذا تم التصعيد بسرعة', en: 'stabilization is possible with rapid escalation' },
            { ar: 'يبقى خطر التدهور قائماً رغم الخطوات الأولى', en: 'the deterioration risk remains despite initial actions' },
            { ar: 'الاستجابة محدودة إذا تأخرت الأولويات', en: 'response stays limited when priorities are delayed' }
        ],
        learningFocus: [
            { ar: 'الربط بين الألم والنظم والتروية', en: 'linking pain, rhythm, and perfusion' },
            { ar: 'التحرك بسرعة على المؤشرات القلبية', en: 'moving quickly on cardiac indicators' },
            { ar: 'تثبيت المريض أثناء التصعيد', en: 'stabilizing while escalating care' }
        ],
        investigations: [
            { ar: 'ECG متكرر', en: 'repeat ECG' },
            { ar: 'تروبونين/إنزيمات قلبية', en: 'troponin and cardiac enzymes' },
            { ar: 'مراقبة هيموديناميكية لصيقة', en: 'close hemodynamic monitoring' }
        ]
    },
    {
        key: 'status-epilepticus',
        category: 'seizure',
        label: { ar: 'حالة صرعية مستمرة', en: 'Status Epilepticus' },
        tracks: ['emergency', 'icu', 'pediatrics'],
        chiefComplaint: { ar: 'اختلاج مستمر مع خطر نقص أكسجة', en: 'ongoing seizure with hypoxia risk' },
        complications: [
            { ar: 'اختلاج مطول', en: 'prolonged seizure activity' },
            { ar: 'تكرر سريع دون استعادة وعي', en: 'rapid recurrence without full recovery' },
            { ar: 'تدهور تنفسي ثانوي', en: 'secondary respiratory decline' }
        ],
        sources: [
            { ar: 'إيقاف دواء مضاد صرع', en: 'antiepileptic interruption' },
            { ar: 'حمى/عدوى عصبية', en: 'fever or CNS infection' },
            { ar: 'سبب استقلابي', en: 'metabolic cause' }
        ],
        histories: [
            { ar: 'صرع معروف مع التزام غير منتظم', en: 'known epilepsy with irregular adherence' },
            { ar: 'طفل مع حمى مرتفعة', en: 'child with high fever' },
            { ar: 'لا تاريخ معروف لكن الأعراض بدأت فجأة', en: 'no known history but sudden onset' }
        ],
        severities: [
            { ar: 'مبكرة', en: 'early' },
            { ar: 'مطولة', en: 'prolonged' },
            { ar: 'حرجة', en: 'critical' }
        ],
        responses: [
            { ar: 'التوقف ممكن إذا نُفذت الأولويات سريعاً', en: 'seizure control is possible if priorities are executed fast' },
            { ar: 'يخف تدريجياً لكنه يحتاج مراقبة مستمرة', en: 'gradually settles but needs continuous monitoring' },
            { ar: 'الاستجابة بطيئة وتحتاج دقة عالية', en: 'response is slow and demands high precision' }
        ],
        learningFocus: [
            { ar: 'حماية مجرى الهواء تحت الضغط', en: 'airway protection under pressure' },
            { ar: 'التصعيد والدواء بوقت مناسب', en: 'timely escalation and medication readiness' },
            { ar: 'ربط الاستجابة العصبية بالمؤشرات الحيوية', en: 'tying neurologic response to vital signs' }
        ],
        investigations: [
            { ar: 'سكر وشوارد فورية', en: 'urgent glucose and electrolytes' },
            { ar: 'مراقبة عصبية متكررة', en: 'repeat neurologic assessments' },
            { ar: 'قياس حرارة ومصدر عدوى', en: 'temperature and infection workup' }
        ]
    },
    {
        key: 'bronchiolitis',
        category: 'respiratory',
        label: { ar: 'التهاب قصيبات تنفسي', en: 'Bronchiolitis' },
        tracks: ['pediatrics', 'emergency', 'ward'],
        chiefComplaint: { ar: 'زيادة جهد تنفسي عند طفل/رضيع', en: 'increasing work of breathing in an infant or child' },
        complications: [
            { ar: 'نوبات هبوط تشبع', en: 'desaturation spells' },
            { ar: 'إرهاق تنفسي', en: 'respiratory fatigue' },
            { ar: 'تجفاف خفيف مع سوء رضاعة', en: 'mild dehydration with poor feeding' }
        ],
        sources: [
            { ar: 'عدوى فيروسية موسمية', en: 'seasonal viral infection' },
            { ar: 'تعرض منزلي لعدوى', en: 'household viral exposure' },
            { ar: 'ولادة مبكرة مع قابلية أعلى', en: 'prematurity increasing vulnerability' }
        ],
        histories: [
            { ar: 'خداج سابق', en: 'history of prematurity' },
            { ar: 'أمراض رئوية طفولية سابقة', en: 'prior neonatal lung disease' },
            { ar: 'رضاعة ضعيفة خلال 24 ساعة', en: 'poor intake over the last 24 hours' }
        ],
        severities: [
            { ar: 'خفيف', en: 'mild' },
            { ar: 'متوسط', en: 'moderate' },
            { ar: 'شديد', en: 'severe' }
        ],
        responses: [
            { ar: 'يتحسن مع الدعم المبكر', en: 'improves with early supportive care' },
            { ar: 'يبقى متذبذباً مع نوبات هبوط متكررة', en: 'remains variable with repeated desaturation' },
            { ar: 'يتدهور سريعاً إذا تأخرت الأولويات', en: 'deteriorates quickly if priorities are delayed' }
        ],
        learningFocus: [
            { ar: 'مراقبة التنفس والجهد بدقة', en: 'watching respiratory effort closely' },
            { ar: 'عدم الاكتفاء بالمظهر الخارجي', en: 'not relying on appearance alone' },
            { ar: 'إعادة التقييم المستمر في الأطفال', en: 'continuous reassessment in pediatric cases' }
        ],
        investigations: [
            { ar: 'مراقبة SpO2 مستمرة', en: 'continuous SpO2 monitoring' },
            { ar: 'تقييم الترطيب', en: 'hydration assessment' },
            { ar: 'غازات دم عند التدهور', en: 'blood gas if worsening' }
        ]
    },
    {
        key: 'copd-exacerbation',
        category: 'respiratory',
        label: { ar: 'تفاقم COPD', en: 'COPD Exacerbation' },
        tracks: ['emergency', 'icu', 'ward'],
        chiefComplaint: { ar: 'ضيق نفس متزايد مع تعب تنفسي', en: 'worsening dyspnea with respiratory fatigue' },
        complications: [
            { ar: 'احتباس CO2', en: 'CO2 retention' },
            { ar: 'نقص أكسجة شديد', en: 'severe hypoxemia' },
            { ar: 'اختلاط انتاني', en: 'infective trigger' }
        ],
        sources: [
            { ar: 'عدوى تنفسية', en: 'respiratory infection' },
            { ar: 'انقطاع عن العلاج المنزلي', en: 'interrupted home therapy' },
            { ar: 'تعرض بيئي/دخاني', en: 'environmental smoke exposure' }
        ],
        histories: [
            { ar: 'مدخن مزمن مع أكسجين منزلي', en: 'chronic smoker on home oxygen' },
            { ar: 'دخول متكرر بسبب التفاقم', en: 'recurrent admissions for exacerbation' },
            { ar: 'قصور قلبي مرافق', en: 'concurrent heart failure' }
        ],
        severities: [
            { ar: 'مبكر', en: 'early' },
            { ar: 'شديد', en: 'severe' },
            { ar: 'حرج', en: 'critical' }
        ],
        responses: [
            { ar: 'يتحسن ببطء حتى مع التدخل الجيد', en: 'improves slowly even with good care' },
            { ar: 'الاستجابة جزئية وتحتاج مراقبة لصيقة', en: 'partial response requiring close reassessment' },
            { ar: 'التدهور يستمر إذا تأخرت الأولويات', en: 'deterioration continues when priorities are delayed' }
        ],
        learningFocus: [
            { ar: 'التعامل مع الأكسجة بحذر ووعي سريري', en: 'clinically disciplined oxygen support' },
            { ar: 'رصد الإرهاق التنفسي المبكر', en: 'spotting early respiratory fatigue' },
            { ar: 'ترتيب المراقبة والتصعيد', en: 'organizing monitoring and escalation' }
        ],
        investigations: [
            { ar: 'غازات دم شريانية', en: 'arterial blood gas' },
            { ar: 'أشعة صدر', en: 'chest x-ray' },
            { ar: 'مراقبة مستمرة للتشبع والتنفس', en: 'continuous oxygen and respiratory monitoring' }
        ]
    }
];
const normalizeText = (value) => value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/\s+/g, ' ');
const localize = (value, language) => language === 'ar' ? value.ar : value.en;
const hashToInt = (value) => {
    const hex = createHash('sha256').update(value).digest('hex').slice(0, 8);
    return Number.parseInt(hex, 16) >>> 0;
};
const mulberry32 = (seed) => {
    let state = seed >>> 0;
    return () => {
        state |= 0;
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeDifficulty = (value) => value === 'easy' || value === 'medium' || value === 'hard' || value === 'expert'
    ? value
    : 'medium';
const normalizeLabStatus = (value) => value === 'critical' || value === 'watch' || value === 'normal'
    ? value
    : 'normal';
const normalizeAgeGroup = (value) => value === 'neonate' || value === 'child' || value === 'adult' || value === 'older-adult'
    ? value
    : 'adult';
const normalizeStatus = (value) => value === 'failed' ? 'failed' : 'completed';
const normalizeLevelTier = (value) => value === 'silver' || value === 'gold' || value === 'platinum'
    ? value
    : 'bronze';
const normalizeStringArray = (value) => Array.isArray(value)
    ? value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];
const numberOr = (value, fallback, min, max) => {
    const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? fallback));
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    const boundedMin = typeof min === 'number' ? min : numeric;
    const boundedMax = typeof max === 'number' ? max : numeric;
    return clamp(Math.round(numeric * 100) / 100, boundedMin, boundedMax);
};
const inferTrack = (specialty, scenario, language) => {
    const haystack = normalizeText(`${specialty} ${scenario}`);
    for (const track of TRACK_MATCHERS) {
        if (track.keywords.some((keyword) => haystack.includes(normalizeText(keyword)))) {
            return localize(track.label, language);
        }
    }
    return language === 'ar' ? 'الرعاية الحادة' : 'Acute Care';
};
const inferTrackId = (specialty, scenario) => {
    const haystack = normalizeText(`${specialty} ${scenario}`);
    for (const track of TRACK_MATCHERS) {
        if (track.keywords.some((keyword) => haystack.includes(normalizeText(keyword)))) {
            return track.id;
        }
    }
    return 'emergency';
};
const preferredTemplatesForTrack = (specialty, scenario) => {
    const trackId = inferTrackId(specialty, scenario);
    const matched = DISEASE_TEMPLATES.filter((template) => template.tracks.includes(trackId));
    return matched.length > 0 ? matched : DISEASE_TEMPLATES;
};
const ageFromGroup = (group, rand) => {
    if (group === 'neonate')
        return Number((2.4 + rand() * 2.1).toFixed(1));
    if (group === 'child')
        return Math.round(2 + rand() * 11);
    if (group === 'older-adult')
        return Math.round(61 + rand() * 24);
    return Math.round(18 + rand() * 42);
};
const sexFromSeed = (rand) => rand() > 0.5 ? 'male' : 'female';
const tierMeta = (totalCasesCompleted) => {
    if (totalCasesCompleted >= 36) {
        return { tier: 'platinum', recommendedDifficulty: 'expert' };
    }
    if (totalCasesCompleted >= 18) {
        return { tier: 'gold', recommendedDifficulty: 'hard' };
    }
    if (totalCasesCompleted >= 8) {
        return { tier: 'silver', recommendedDifficulty: 'medium' };
    }
    return { tier: 'bronze', recommendedDifficulty: 'easy' };
};
const rounded = (value) => Math.round(value);
const buildVitals = (category, severityIndex, difficulty, ageGroup, rand) => {
    const difficultyOffset = difficulty === 'expert' ? 2 : difficulty === 'hard' ? 1 : difficulty === 'easy' ? -1 : 0;
    const severityBoost = severityIndex + difficultyOffset;
    const base = ageGroup === 'neonate'
        ? { hr: 138, rr: 40, spo2: 95, sys: 76, dia: 48, temp: 37.2 }
        : ageGroup === 'child'
            ? { hr: 118, rr: 28, spo2: 95, sys: 94, dia: 56, temp: 37.3 }
            : ageGroup === 'older-adult'
                ? { hr: 98, rr: 20, spo2: 94, sys: 112, dia: 66, temp: 37.5 }
                : { hr: 102, rr: 22, spo2: 94, sys: 114, dia: 68, temp: 37.4 };
    if (category === 'respiratory') {
        return {
            heartRate: rounded(base.hr + 12 + severityBoost * 7 + rand() * 6),
            respiratoryRate: rounded(base.rr + 6 + severityBoost * 4 + rand() * 3),
            oxygenSaturation: rounded(base.spo2 - 6 - severityBoost * 3 - rand() * 2),
            systolic: rounded(base.sys - severityBoost * 2 + rand() * 4),
            diastolic: rounded(base.dia - severityBoost + rand() * 3),
            temperatureCelsius: Number((base.temp + rand() * 0.8).toFixed(1))
        };
    }
    if (category === 'shock') {
        return {
            heartRate: rounded(base.hr + 18 + severityBoost * 8 + rand() * 7),
            respiratoryRate: rounded(base.rr + 4 + severityBoost * 3 + rand() * 2),
            oxygenSaturation: rounded(base.spo2 - 2 - severityBoost * 2 - rand()),
            systolic: rounded(base.sys - 14 - severityBoost * 10 - rand() * 6),
            diastolic: rounded(base.dia - 8 - severityBoost * 5 - rand() * 4),
            temperatureCelsius: Number((base.temp + 0.4 + rand() * 1.1).toFixed(1))
        };
    }
    if (category === 'cardiac') {
        return {
            heartRate: rounded(base.hr + 22 + severityBoost * 10 + rand() * 8),
            respiratoryRate: rounded(base.rr + 2 + severityBoost * 2 + rand() * 2),
            oxygenSaturation: rounded(base.spo2 - 1 - severityBoost * 2 - rand()),
            systolic: rounded(base.sys - 6 - severityBoost * 6 + rand() * 5),
            diastolic: rounded(base.dia - 3 - severityBoost * 3 + rand() * 4),
            temperatureCelsius: Number((base.temp + rand() * 0.6).toFixed(1))
        };
    }
    return {
        heartRate: rounded(base.hr + 16 + severityBoost * 7 + rand() * 7),
        respiratoryRate: rounded(base.rr + 3 + severityBoost * 3 + rand() * 2),
        oxygenSaturation: rounded(base.spo2 - 4 - severityBoost * 2 - rand()),
        systolic: rounded(base.sys - 4 - severityBoost * 5 + rand() * 4),
        diastolic: rounded(base.dia - 2 - severityBoost * 2 + rand() * 3),
        temperatureCelsius: Number((base.temp + 0.3 + rand() * 0.8).toFixed(1))
    };
};
const buildLabs = (template, language, severityIndex, rand) => {
    const inflammatory = 9 + severityIndex * 4 + rounded(rand() * 5);
    const lactate = Number((1.2 + severityIndex * 0.9 + rand() * 1.4).toFixed(1));
    const glucose = rounded(68 + rand() * 140);
    const ph = Number((7.38 - severityIndex * 0.06 + rand() * 0.04).toFixed(2));
    const defaults = [
        {
            id: 'wbc',
            label: language === 'ar' ? 'WBC' : 'WBC',
            value: `${inflammatory.toFixed(0)} x10^9/L`,
            status: inflammatory >= 17 ? 'critical' : inflammatory >= 13 ? 'watch' : 'normal'
        },
        {
            id: 'lactate',
            label: language === 'ar' ? 'Lactate' : 'Lactate',
            value: `${lactate.toFixed(1)} mmol/L`,
            status: lactate >= 3.5 ? 'critical' : lactate >= 2.1 ? 'watch' : 'normal'
        },
        {
            id: 'glucose',
            label: language === 'ar' ? 'Glucose' : 'Glucose',
            value: `${glucose} mg/dL`,
            status: glucose <= 70 || glucose >= 230 ? 'critical' : glucose <= 85 || glucose >= 180 ? 'watch' : 'normal'
        },
        {
            id: 'ph',
            label: language === 'ar' ? 'pH' : 'pH',
            value: ph.toFixed(2),
            status: ph <= 7.2 ? 'critical' : ph <= 7.3 ? 'watch' : 'normal'
        }
    ];
    if (template.category === 'respiratory') {
        defaults.push({
            id: 'co2',
            label: language === 'ar' ? 'CO2' : 'CO2',
            value: `${rounded(38 + severityIndex * 7 + rand() * 8)} mmHg`,
            status: severityIndex >= 2 ? 'critical' : severityIndex >= 1 ? 'watch' : 'normal'
        });
    }
    if (template.category === 'cardiac') {
        defaults.push({
            id: 'troponin',
            label: language === 'ar' ? 'Troponin' : 'Troponin',
            value: `${Number((0.02 + severityIndex * 0.08 + rand() * 0.06).toFixed(2))} ng/mL`,
            status: severityIndex >= 1 ? 'watch' : 'normal'
        });
    }
    return defaults.slice(0, 5);
};
const buildSignature = (parts) => createHash('sha256').update(parts.join('|')).digest('hex');
const resolveAgeGroup = (trackId, rand) => {
    if (trackId === 'pediatrics' && rand() > 0.55) {
        return rand() > 0.5 ? 'child' : 'neonate';
    }
    if (rand() > 0.82) {
        return 'older-adult';
    }
    return 'adult';
};
const diseaseOrder = (templates, history) => {
    const diseaseCounts = new Map();
    history.forEach((entry) => {
        diseaseCounts.set(entry.disease, (diseaseCounts.get(entry.disease) || 0) + 1);
    });
    return [...templates].sort((a, b) => {
        const aCount = diseaseCounts.get(a.label.en) || 0;
        const bCount = diseaseCounts.get(b.label.en) || 0;
        if (aCount === bCount) {
            return a.label.en.localeCompare(b.label.en);
        }
        return aCount - bCount;
    });
};
export const normalizeGeneratedClinicalCase = (value) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value;
    const caseId = typeof candidate['caseId'] === 'string' ? candidate.caseId : '';
    const signature = typeof candidate['signature'] === 'string' ? candidate.signature : '';
    const specialty = typeof candidate['specialty'] === 'string' ? candidate.specialty : '';
    const scenario = typeof candidate['scenario'] === 'string' ? candidate.scenario : '';
    const title = typeof candidate['title'] === 'string' ? candidate.title : '';
    const diseaseLabel = typeof candidate['diseaseLabel'] === 'string' ? candidate.diseaseLabel : '';
    const diseaseLabelEn = typeof candidate['diseaseLabelEn'] === 'string' ? candidate.diseaseLabelEn : '';
    const runtimeCategory = candidate['runtimeCategory'] === 'respiratory' || candidate['runtimeCategory'] === 'shock' || candidate['runtimeCategory'] === 'cardiac' || candidate['runtimeCategory'] === 'seizure'
        ? candidate.runtimeCategory
        : null;
    if (!caseId || !signature || !specialty || !scenario || !title || !diseaseLabel || !diseaseLabelEn || !runtimeCategory) {
        return null;
    }
    const vitalsCandidate = candidate['vitals'] && typeof candidate['vitals'] === 'object'
        ? candidate['vitals']
        : {};
    const sessionId = typeof candidate['sessionId'] === 'string' && candidate.sessionId.trim()
        ? candidate.sessionId
        : caseId;
    return {
        caseId,
        sessionId,
        signature,
        language: candidate['language'] === 'ar' ? 'ar' : 'en',
        specialty,
        scenario,
        specialtyTrack: typeof candidate['specialtyTrack'] === 'string' ? candidate.specialtyTrack : '',
        title,
        diseaseKey: typeof candidate['diseaseKey'] === 'string' ? candidate.diseaseKey : diseaseLabelEn,
        diseaseLabel,
        diseaseLabelEn,
        difficulty: normalizeDifficulty(candidate['difficulty']),
        runtimeCategory,
        patientAge: numberOr(candidate['patientAge'], 35, 0, 120),
        ageGroup: normalizeAgeGroup(candidate['ageGroup']),
        patientSex: candidate['patientSex'] === 'female' ? 'female' : 'male',
        severity: typeof candidate['severity'] === 'string' ? candidate.severity : '',
        complication: typeof candidate['complication'] === 'string' ? candidate.complication : '',
        source: typeof candidate['source'] === 'string' ? candidate.source : '',
        medicalHistory: normalizeStringArray(candidate['medicalHistory']),
        chiefComplaint: typeof candidate['chiefComplaint'] === 'string' ? candidate.chiefComplaint : '',
        openingMessage: typeof candidate['openingMessage'] === 'string' ? candidate.openingMessage : '',
        caseDescription: typeof candidate['caseDescription'] === 'string' ? candidate.caseDescription : '',
        treatmentResponse: typeof candidate['treatmentResponse'] === 'string' ? candidate.treatmentResponse : '',
        learningFocus: normalizeStringArray(candidate['learningFocus']),
        recommendedInvestigations: normalizeStringArray(candidate['recommendedInvestigations']),
        vitals: {
            heartRate: numberOr(vitalsCandidate['heartRate'], 100, 20, 220),
            respiratoryRate: numberOr(vitalsCandidate['respiratoryRate'], 20, 4, 80),
            oxygenSaturation: numberOr(vitalsCandidate['oxygenSaturation'], 95, 40, 100),
            systolic: numberOr(vitalsCandidate['systolic'], 110, 40, 220),
            diastolic: numberOr(vitalsCandidate['diastolic'], 65, 20, 140),
            temperatureCelsius: numberOr(vitalsCandidate['temperatureCelsius'], 37, 32, 42)
        },
        labs: Array.isArray(candidate['labs'])
            ? candidate['labs']
                .filter((item) => !!item && typeof item === 'object')
                .map((item) => ({
                id: typeof item['id'] === 'string' ? item.id : randomUUID(),
                label: typeof item['label'] === 'string' ? item.label : 'Lab',
                value: typeof item['value'] === 'string' ? item.value : '',
                status: normalizeLabStatus(item['status'])
            }))
            : [],
        levelTier: normalizeLevelTier(candidate['levelTier']),
        createdAt: typeof candidate['createdAt'] === 'string' ? candidate.createdAt : new Date().toISOString()
    };
};
export const normalizeStudentCaseHistoryEntry = (value) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value;
    const caseId = typeof candidate['caseId'] === 'string' ? candidate.caseId : '';
    const signature = typeof candidate['signature'] === 'string' ? candidate.signature : '';
    const specialty = typeof candidate['specialty'] === 'string' ? candidate.specialty : '';
    const disease = typeof candidate['disease'] === 'string' ? candidate.disease : '';
    const date = typeof candidate['date'] === 'string' ? candidate.date : '';
    if (!caseId || !signature || !specialty || !disease || !date) {
        return null;
    }
    return {
        caseId,
        signature,
        specialty,
        disease,
        difficulty: normalizeDifficulty(candidate['difficulty']),
        date
    };
};
export const normalizeStudentClinicalRecord = (value) => {
    if (!value || typeof value !== 'object') {
        return null;
    }
    const candidate = value;
    const recordId = typeof candidate['recordId'] === 'string' ? candidate.recordId : '';
    const caseId = typeof candidate['caseId'] === 'string' ? candidate.caseId : '';
    const signature = typeof candidate['signature'] === 'string' ? candidate.signature : '';
    const specialty = typeof candidate['specialty'] === 'string' ? candidate.specialty : '';
    const disease = typeof candidate['disease'] === 'string' ? candidate.disease : '';
    const date = typeof candidate['date'] === 'string' ? candidate.date : '';
    const title = typeof candidate['title'] === 'string' ? candidate.title : '';
    if (!recordId || !caseId || !signature || !specialty || !disease || !date || !title) {
        return null;
    }
    const transcript = Array.isArray(candidate['transcript'])
        ? candidate['transcript']
            .filter((item) => !!item && typeof item === 'object')
            .map((item) => ({
            role: (item['role'] === 'assistant' || item['role'] === 'system' ? item.role : 'user'),
            text: typeof item['text'] === 'string' ? item.text : '',
            timestamp: typeof item['timestamp'] === 'number' ? item.timestamp : undefined
        }))
            .filter((item) => item.text.trim().length > 0)
        : [];
    return {
        recordId,
        caseId,
        signature,
        specialty,
        specialtyTrack: typeof candidate['specialtyTrack'] === 'string' ? candidate.specialtyTrack : '',
        disease,
        difficulty: normalizeDifficulty(candidate['difficulty']),
        score: numberOr(candidate['score'], 0, 0, 100),
        status: normalizeStatus(candidate['status']),
        date,
        timeSpentSeconds: numberOr(candidate['timeSpentSeconds'], 0, 0, 24 * 60 * 60),
        mistakes: normalizeStringArray(candidate['mistakes']).slice(0, 12),
        correctDecisions: normalizeStringArray(candidate['correctDecisions']).slice(0, 12),
        treatmentChoices: normalizeStringArray(candidate['treatmentChoices']).slice(0, 16),
        title,
        caseDescription: typeof candidate['caseDescription'] === 'string' ? candidate.caseDescription : '',
        finalEvaluation: typeof candidate['finalEvaluation'] === 'string' ? candidate.finalEvaluation : '',
        educationalAnalysis: typeof candidate['educationalAnalysis'] === 'string' ? candidate.educationalAnalysis : '',
        transcript,
        summary: candidate['summary'] && typeof candidate['summary'] === 'object'
            ? candidate['summary']
            : null,
        generatedCase: normalizeGeneratedClinicalCase(candidate['generatedCase']),
        levelTier: normalizeLevelTier(candidate['levelTier'])
    };
};
export const generateClinicalCase = (args) => {
    const templates = diseaseOrder(preferredTemplatesForTrack(args.specialty, args.scenario), args.history);
    const usedSignatures = new Set(args.history.map((entry) => entry.signature));
    const { tier } = tierMeta(args.recordCount);
    const trackId = inferTrackId(args.specialty, args.scenario);
    const trackLabel = inferTrack(args.specialty, args.scenario, args.language);
    const baseSeed = hashToInt([
        args.userId,
        normalizeText(args.specialty),
        normalizeText(args.scenario),
        args.difficulty,
        String(args.history.length),
        String(args.recordCount)
    ].join('|'));
    for (let attempt = 0; attempt < 256; attempt += 1) {
        const rand = mulberry32(baseSeed + attempt * 9973);
        const template = templates[attempt % templates.length];
        const ageGroup = resolveAgeGroup(trackId, rand);
        const severity = template.severities[Math.floor(rand() * template.severities.length)] || template.severities[0];
        const complication = template.complications[Math.floor(rand() * template.complications.length)] || template.complications[0];
        const source = template.sources[Math.floor(rand() * template.sources.length)] || template.sources[0];
        const history = template.histories[Math.floor(rand() * template.histories.length)] || template.histories[0];
        const response = template.responses[Math.floor(rand() * template.responses.length)] || template.responses[0];
        const sex = sexFromSeed(rand);
        const age = ageFromGroup(ageGroup, rand);
        const severityIndex = template.severities.findIndex((item) => item.en === severity.en);
        const vitals = buildVitals(template.category, Math.max(0, severityIndex), args.difficulty, ageGroup, rand);
        const labs = buildLabs(template, args.language, Math.max(0, severityIndex), rand);
        const signature = buildSignature([
            args.userId,
            template.key,
            severity.en,
            complication.en,
            source.en,
            history.en,
            response.en,
            ageGroup,
            String(age),
            sex,
            String(vitals.heartRate),
            String(vitals.oxygenSaturation),
            String(vitals.systolic),
            String(vitals.temperatureCelsius),
            args.difficulty,
            trackId,
            String(attempt)
        ]);
        if (usedSignatures.has(signature)) {
            continue;
        }
        const diseaseLabel = localize(template.label, args.language);
        const severityText = localize(severity, args.language);
        const complicationText = localize(complication, args.language);
        const sourceText = localize(source, args.language);
        const historyText = localize(history, args.language);
        const responseText = localize(response, args.language);
        const complaintText = localize(template.chiefComplaint, args.language);
        const ageText = args.language === 'ar'
            ? ageGroup === 'neonate'
                ? `رضيع ${age} كغ تقريباً`
                : ageGroup === 'child'
                    ? `طفل بعمر ${age} سنوات`
                    : ageGroup === 'older-adult'
                        ? `مريض بعمر ${age} سنة`
                        : `بالغ بعمر ${age} سنة`
            : ageGroup === 'neonate'
                ? `neonate around ${age} kg`
                : ageGroup === 'child'
                    ? `${age}-year-old child`
                    : ageGroup === 'older-adult'
                        ? `${age}-year-old older adult`
                        : `${age}-year-old adult`;
        const sexText = args.language === 'ar'
            ? (sex === 'female' ? 'أنثى' : 'ذكر')
            : sex;
        const title = args.language === 'ar'
            ? `${trackLabel} - ${diseaseLabel} (${severityText})`
            : `${trackLabel} - ${template.label.en} (${severity.en})`;
        const openingMessage = args.language === 'ar'
            ? `وصل ${ageText} (${sexText}) إلى ${trackLabel} مع ${complaintText}. توجد دلائل على ${sourceText} مع ${complicationText}. التاريخ المرضي الأبرز: ${historyText}.`
            : `${ageText} (${sexText}) has arrived in ${trackLabel} with ${complaintText}. There are signs of ${source.en} and ${complication.en}. The key background is ${history.en}.`;
        const caseDescription = args.language === 'ar'
            ? `الحالة مبنية على ${diseaseLabel} بدرجة ${severityText} داخل ${trackLabel}. المعطيات الحالية تشير إلى ${sourceText} مع احتمال ${complicationText}. الاستجابة المتوقعة للعلاج: ${responseText}.`
            : `This case is built around ${template.label.en} at ${severity.en} severity inside ${trackLabel}. Current findings suggest ${source.en} with ${complication.en}. Expected treatment response: ${response.en}.`;
        return {
            caseId: randomUUID(),
            sessionId: randomUUID(),
            signature,
            language: args.language,
            specialty: args.specialty,
            scenario: args.scenario,
            specialtyTrack: trackLabel,
            title,
            diseaseKey: template.key,
            diseaseLabel,
            diseaseLabelEn: template.label.en,
            difficulty: args.difficulty,
            runtimeCategory: template.category,
            patientAge: age,
            ageGroup,
            patientSex: sex,
            severity: severityText,
            complication: complicationText,
            source: sourceText,
            medicalHistory: [historyText],
            chiefComplaint: complaintText,
            openingMessage,
            caseDescription,
            treatmentResponse: responseText,
            learningFocus: template.learningFocus.map((item) => localize(item, args.language)),
            recommendedInvestigations: template.investigations.map((item) => localize(item, args.language)),
            vitals,
            labs,
            levelTier: tier,
            createdAt: new Date().toISOString()
        };
    }
    const fallbackRand = mulberry32(baseSeed + 991);
    const fallbackTemplate = templates[0] || DISEASE_TEMPLATES[0];
    const fallbackAgeGroup = resolveAgeGroup(trackId, fallbackRand);
    const fallbackAge = ageFromGroup(fallbackAgeGroup, fallbackRand);
    const fallbackVitals = buildVitals(fallbackTemplate.category, 1, args.difficulty, fallbackAgeGroup, fallbackRand);
    return {
        caseId: randomUUID(),
        sessionId: randomUUID(),
        signature: buildSignature([args.userId, fallbackTemplate.key, String(Date.now())]),
        language: args.language,
        specialty: args.specialty,
        scenario: args.scenario,
        specialtyTrack: trackLabel,
        title: localize(fallbackTemplate.label, args.language),
        diseaseKey: fallbackTemplate.key,
        diseaseLabel: localize(fallbackTemplate.label, args.language),
        diseaseLabelEn: fallbackTemplate.label.en,
        difficulty: args.difficulty,
        runtimeCategory: fallbackTemplate.category,
        patientAge: fallbackAge,
        ageGroup: fallbackAgeGroup,
        patientSex: sexFromSeed(fallbackRand),
        severity: localize(fallbackTemplate.severities[0], args.language),
        complication: localize(fallbackTemplate.complications[0], args.language),
        source: localize(fallbackTemplate.sources[0], args.language),
        medicalHistory: [localize(fallbackTemplate.histories[0], args.language)],
        chiefComplaint: localize(fallbackTemplate.chiefComplaint, args.language),
        openingMessage: localize(fallbackTemplate.chiefComplaint, args.language),
        caseDescription: localize(fallbackTemplate.responses[0], args.language),
        treatmentResponse: localize(fallbackTemplate.responses[0], args.language),
        learningFocus: fallbackTemplate.learningFocus.map((item) => localize(item, args.language)),
        recommendedInvestigations: fallbackTemplate.investigations.map((item) => localize(item, args.language)),
        vitals: fallbackVitals,
        labs: buildLabs(fallbackTemplate, args.language, 1, fallbackRand),
        levelTier: tier,
        createdAt: new Date().toISOString()
    };
};
export const buildClinicalStats = (records) => {
    if (records.length === 0) {
        return { ...DEFAULT_STATS };
    }
    const totalCasesCompleted = records.length;
    const totalScore = records.reduce((sum, record) => sum + record.score, 0);
    const totalHoursPracticed = Number((records.reduce((sum, record) => sum + record.timeSpentSeconds, 0) / 3600).toFixed(1));
    const bestScore = records.reduce((best, record) => Math.max(best, record.score), 0);
    const worstScore = records.reduce((worst, record) => Math.min(worst, record.score), 100);
    const specialtyCounts = new Map();
    records.forEach((record) => {
        specialtyCounts.set(record.specialtyTrack, (specialtyCounts.get(record.specialtyTrack) || 0) + 1);
    });
    const specialtyBreakdown = [...specialtyCounts.entries()]
        .map(([specialty, count]) => ({ specialty, count }))
        .sort((a, b) => b.count - a.count || a.specialty.localeCompare(b.specialty));
    const tier = tierMeta(totalCasesCompleted);
    return {
        totalCasesCompleted,
        averageScore: Number((totalScore / totalCasesCompleted).toFixed(1)),
        bestScore,
        worstScore,
        totalHoursPracticed,
        mostPracticedSpecialty: specialtyBreakdown[0]?.specialty || DEFAULT_STATS.mostPracticedSpecialty,
        specialtyBreakdown,
        levelTier: tier.tier,
        recommendedDifficulty: tier.recommendedDifficulty
    };
};
export const paginateClinicalRecords = (records, cursor, limit) => {
    const safeLimit = clamp(limit, 5, 40);
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    const startIndex = cursor
        ? Math.max(0, sorted.findIndex((record) => record.recordId === cursor) + 1)
        : 0;
    const items = sorted.slice(startIndex, startIndex + safeLimit);
    const nextCursor = startIndex + safeLimit < sorted.length
        ? items[items.length - 1]?.recordId || null
        : null;
    return {
        items,
        total: sorted.length,
        hasMore: nextCursor !== null,
        nextCursor,
        stats: buildClinicalStats(sorted)
    };
};
